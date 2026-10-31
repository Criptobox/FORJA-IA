plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Versión: la pone la CI (número de ejecución), así cada APK publicada es
// mayor que la anterior y la app sabe si hay una nueva.
val codigoVersion = (System.getenv("FORJA_VERSION_CODE") ?: "1").toInt()
val nombreVersion = System.getenv("FORJA_VERSION_NAME") ?: "dev"

android {
    namespace = "app.forja.ia"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.forja.ia"
        minSdk = 28
        targetSdk = 35
        versionCode = codigoVersion
        versionName = nombreVersion
        // llama-server está compilado solo para arm64 (todos los móviles de
        // los últimos años).
        ndk { abiFilters += "arm64-v8a" }
        buildConfigField("String", "REPO", "\"Criptobox/FORJA-IA\"")
        buildConfigField("String", "ETIQUETA_RELEASE", "\"android-latest\"")
    }

    // Misma firma en todas las APK: si no, Android no deja instalar una
    // actualización encima de la anterior. La clave NUNCA va en el repo (es
    // público): la CI la saca del secreto FORJA_KEYSTORE_B64. Sin secreto se
    // firma con la clave de depuración de la máquina, que sirve para probar
    // pero cambia en cada compilación.
    val almacen = System.getenv("FORJA_KEYSTORE")?.let { file(it) }?.takeIf { it.exists() }
    signingConfigs {
        if (almacen != null) {
            create("forja") {
                storeFile = almacen
                storePassword = System.getenv("FORJA_KEYSTORE_PASS")
                keyAlias = System.getenv("FORJA_KEY_ALIAS") ?: "forja"
                keyPassword = System.getenv("FORJA_KEYSTORE_PASS")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("forja") ?: signingConfigs.getByName("debug")
        }
    }

    buildFeatures { buildConfig = true }

    // Por defecto, Android descarta de los assets las carpetas que empiezan
    // por «_» (patrón «<dir>_*»), y Next pone TODO su JS y CSS en «_next/»:
    // la app abría el HTML sin estilos ni lógica. Mismo patrón sin esa regla.
    androidResources {
        ignoreAssetsPattern = "!.svn:!.git:!.ds_store:!*.scc:!CVS:!thumbs.db:!picasa.ini:!*~"
    }

    // llama-server va como «libllama-server.so» en jniLibs: Android solo deja
    // ejecutar binarios desde nativeLibraryDir, y para eso tienen que
    // extraerse al instalar (empaquetado «legacy»).
    packaging { jniLibs { useLegacyPackaging = true } }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.webkit:webkit:1.12.1")
}
