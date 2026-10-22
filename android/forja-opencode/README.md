# Forja IA Android Host — v4.71.1

Este directorio contiene un proyecto Android Gradle inicial con Activity, WebView local, puente Kotlin y comprobación del servidor loopback.

## Estado comprobado
- El proyecto incluye `settings.gradle.kts`, configuración Gradle de app, manifest, Activity y una pantalla local de diagnóstico con comprobación del motor, listado de modelos de coste cero y formulario de tarea bloqueado cuando el motor no está activo.
- El puente solo se instala después de cargar `file:///android_asset/forja/index.html`; los enlaces de navegación fuera de ese origen se bloquean.
- La política de red permite HTTP solo para loopback (`127.0.0.1` y `localhost`), no para hosts externos.
- El supervisor devuelve `isInstalled() = false` de forma intencionada: no se distribuye todavía proot ni un ejecutor OpenCode. No finge que el motor está listo.

## Limitaciones pendientes
Este proyecto todavía no genera una APK funcional completa porque no incluye el runtime Linux ARM64/proot, el supervisor de instalación/actualización, ni la interfaz de producción compilada. La pantalla HTML es solo diagnóstico. No se pudo ejecutar Gradle en el entorno de trabajo porque no está instalado Gradle ni el Android SDK.

## Cambios en v4.71.1
- Pantalla de diagnóstico móvil mejorada con estados visuales, catálogo de modelos y formulario de prueba.
- Los errores al leer el catálogo ya no se ocultan como una lista vacía.
- Se mantiene el bloqueo de ejecución si el runtime no está iniciado y no se permite elegir modelos que no declaren coste cero de entrada y salida.

## Siguiente fase necesaria
1. Elegir y fijar una versión OpenCode compatible con Android ARM64/musl.
2. Integrar proot y sus dependencias con licencias, hashes y verificación de descarga.
3. Implementar el supervisor de procesos con argumentos fijos, cancelación, logs y cierre seguro.
4. Confirmar endpoints y esquema de respuestas contra esa versión exacta de OpenCode.
5. Integrar la interfaz web de producción y probar en un dispositivo Android ARM64.
