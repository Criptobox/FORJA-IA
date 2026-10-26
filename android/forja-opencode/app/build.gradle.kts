plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "app.forja.opencodemobile"
    compileSdk = 35
    defaultConfig {
        applicationId = "app.forja.opencodemobile"
        minSdk = 26
        targetSdk = 28
        versionCode = 47101
        versionName = "4.71.1-opencode-runtime"
        ndk { abiFilters += "arm64-v8a" }
    }
    packaging { jniLibs { useLegacyPackaging = true } }
    buildTypes { release { isMinifyEnabled = false } }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
