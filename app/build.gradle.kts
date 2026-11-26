import com.android.build.api.artifact.ArtifactTransformationRequest
import com.android.build.api.artifact.SingleArtifact
import javax.inject.Inject
import org.gradle.process.ExecOperations

plugins {
    id("com.android.application")
}

android {
    namespace = "vadiole.bugged"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "vadiole.bugged"
        minSdk = 29
        targetSdk = 37
        versionCode = 2
        versionName = "1.1.0"
        base.archivesName = "bugged-v$versionName"
    }

    androidResources {
        generateLocaleConfig = true
        localeFilters += listOf("en", "cs", "da", "de", "el", "es", "fr", "hi", "it", "ja", "ka", "nb", "nl", "pl", "pt", "pt-rBR", "ru", "sl", "sv", "tr", "uk", "zh-rCN")
    }

    signingConfigs {
        val storeFile = providers.gradleProperty("bugged.signing.storeFile").orNull
        if (storeFile != null) {
            create("release") {
                val password = file(providers.gradleProperty("bugged.signing.passwordFile").get()).readText().trim()
                this.storeFile = file(storeFile)
                storePassword = password
                keyAlias = providers.gradleProperty("bugged.signing.keyAlias").get()
                keyPassword = password
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
        }
        release {
            optimization {
                enable = true
                keepRules {
                    includeDefault = false
                }
            }
            vcsInfo.include = false
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug").also {
                val allowed = providers.gradleProperty("bugged.debugSignedRelease").orNull == "true"
                gradle.taskGraph.whenReady {
                    if (!allowed && allTasks.any { it.name.endsWith("Release") && (it.name.startsWith("package") || it.name.startsWith("bundle")) }) {
                        throw GradleException("Release needs bugged.signing.* in ~/.gradle/gradle.properties, or -Pbugged.debugSignedRelease=true for a local test build")
                    }
                }
            }
        }
        create("alpha") {
            initWith(getByName("release"))
            applicationIdSuffix = ".alpha"
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    dependenciesInfo {
        includeInApk = false
        includeInBundle = false
    }

    packaging {
        dex {
            useLegacyPackaging = true
        }
        resources {
            excludes += "kotlin/**"
            excludes += "META-INF/**"
            excludes += "DebugProbesKt.bin"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }

    lint {
        abortOnError = true
        warningsAsErrors = true
        checkDependencies = true
        disable += listOf(
            "StaticFieldLeak",
            "GradleDependency",
            "NewerVersionAvailable",
            "AndroidGradlePluginVersion",
            "OldTargetApi",
            "ViewConstructor",
        )
    }
}

kotlin {
    jvmToolchain(17)
}

abstract class RecompressApk : DefaultTask() {
    @get:InputDirectory
    abstract val input: DirectoryProperty

    @get:OutputDirectory
    abstract val output: DirectoryProperty

    @get:Internal
    abstract val buildTools: DirectoryProperty

    @get:Internal
    abstract val storeFile: RegularFileProperty

    @get:Internal
    abstract val storePassword: Property<String>

    @get:Internal
    abstract val keyAlias: Property<String>

    @get:Internal
    abstract val keyPassword: Property<String>

    @get:Internal
    abstract val request: Property<ArtifactTransformationRequest<RecompressApk>>

    @get:Inject
    abstract val exec: ExecOperations

    @TaskAction
    fun run() {
        val tools = buildTools.get().asFile
        request.get().submit(this) { artifact ->
            val source = File(artifact.outputFile)
            val target = output.get().file(source.name).asFile
            val aligned = File(temporaryDir, source.name)
            exec.exec {
                commandLine(File(tools, "zipalign").path, "-f", "-z", "4", source.path, aligned.path)
            }
            exec.exec {
                environment("STORE_PASSWORD", storePassword.get())
                environment("KEY_PASSWORD", keyPassword.get())
                commandLine(
                    File(tools, "apksigner").path, "sign",
                    "--ks", storeFile.get().asFile.path,
                    "--ks-key-alias", keyAlias.get(),
                    "--ks-pass", "env:STORE_PASSWORD",
                    "--key-pass", "env:KEY_PASSWORD",
                    "--v1-signing-enabled", "false",
                    "--v2-signing-enabled", "true",
                    "--v3-signing-enabled", "false",
                    "--v4-signing-enabled", "false",
                    "--out", target.path,
                    aligned.path,
                )
            }
            aligned.delete()
            target
        }
    }
}

androidComponents {
    onVariants { variant ->
        val signing = android.buildTypes.getByName(variant.buildType!!).signingConfig
        if (variant.buildType == "debug" || signing == null) return@onVariants
        val task = tasks.register<RecompressApk>("recompress${variant.name.replaceFirstChar(Char::uppercase)}Apk") {
            buildTools.set(androidComponents.sdkComponents.sdkDirectory.map { it.dir("build-tools/${android.buildToolsVersion}") })
            storeFile.set(signing.storeFile)
            storePassword.set(signing.storePassword)
            keyAlias.set(signing.keyAlias)
            keyPassword.set(signing.keyPassword)
        }
        val request = variant.artifacts.use(task)
            .wiredWithDirectories(RecompressApk::input, RecompressApk::output)
            .toTransformMany(SingleArtifact.APK)
        task.configure { this.request.set(request) }
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
}
