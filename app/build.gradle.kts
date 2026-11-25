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
        versionName = "0.1.0"
        base.archivesName = "bugged-v$versionName"
    }

    androidResources {
        generateLocaleConfig = true
        localeFilters += listOf("en")
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
            signingConfig = signingConfigs.getByName("debug")
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
        )
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    testImplementation("junit:junit:4.13.2")
}
