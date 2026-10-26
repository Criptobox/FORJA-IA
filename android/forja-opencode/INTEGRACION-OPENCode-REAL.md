# Forja IA + OpenCode Mobile — fase de corrección

## Cambios en esta fase
- Corregido el WebView en blanco: la actividad carga `file:///android_asset/forja/index.html` al iniciar.
- Habilitado acceso a archivos locales solo para que el HTML/CSS/JS empaquetado pueda cargarse; la navegación externa sigue bloqueada. No cargar contenido remoto en ese WebView con el puente nativo habilitado.
- Ajustado `targetSdk` a 28 para seguir el enfoque del proyecto OpenCode-mobile, que documenta la necesidad de un target bajo para ejecutar PRoot en Android.
- Actualizado el texto de la UI para que no afirme que el formulario de tareas está deshabilitado por diseño.
- Se mantiene el contrato asíncrono `ForjaOpenCodeNative` ↔ `ForjaOpenCodeNativeAndroid` mediante IDs de callback.

## Pruebas realizadas aquí
- Los dos ZIP fuente y el ZIP resultante pasan `ZipFile.testzip()` sin errores.
- Revisión estática de las rutas de carga de UI, manifest, Gradle y puente Kotlin/JavaScript.
- No se ha ejecutado compilación Android ni prueba en dispositivo: este entorno no tiene Gradle ni Android SDK configurados.

## Pendiente antes de declarar listo
- Compilar el workflow de GitHub Actions y corregir errores reales de compilación si aparecen.
- Instalar en Android ARM64 y probar instalación del rootfs, servidor, catálogo, selección y ejecución de un modelo gratuito.
- El coste cero se valida con los metadatos del catálogo de OpenCode; las condiciones del proveedor pueden cambiar y pueden existir límites de uso.

## Revisión correctiva (2026-10-24)
- Corregido el flujo de apertura: antes la WebView se hacía visible pero nunca cargaba `file:///android_asset/forja/index.html`; ahora carga la interfaz al pulsar Abrir Forja IA y registra el puente una sola vez.
- Corregida la versión de Gradle en CI: AGP 8.10.1 no debe ejecutarse con Gradle 8.7; workflow usa Gradle 8.14.3.
- Añadida comprobación previa de que `fetch_proot.py` generó `proot_libs.txt`, `libproot.so` y `libproot-loader.so` antes de compilar.
- Actualizado el diagnóstico de la interfaz para que no contradiga la presencia del instalador.
- El chequeo del servidor ahora consulta `/global/health` y no acepta cualquier código HTTP como prueba de salud.

## Verificación pendiente
No se ha compilado la APK ni probado el runtime en un dispositivo físico en esta sesión. La prueba real debe confirmar: instalación limpia, reanudación tras interrupción, arranque del servidor, lectura de `/provider`, autenticación y respuesta de un modelo gratuito.
