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
        versionCode = 1
        versionName = "1.0.0"
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

    packaging {
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

dependencies {
    testImplementation("junit:junit:4.13.2")
}
