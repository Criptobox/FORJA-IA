# Fase V31 — Host Android OpenCode (v4.71.0)

## Incluido
- Esqueleto Gradle Kotlin DSL de una aplicación Android.
- `MainActivity` con WebView que carga contenido local empaquetado.
- Registro del puente solo tras cargar el asset local confiable.
- Supervisor provisional que no declara instalado un runtime ausente.
- Política de cleartext restringida a loopback.
- Pantalla local de diagnóstico.

## No incluido todavía
- Proot, rootfs, binario OpenCode ni verificación de firmas/checksums.
- Instalador/actualizador del runtime.
- UI web completa de Forja IA en assets.
- APK compilada o prueba en dispositivo real.

## Criterio de aceptación siguiente
La APK debe instalarse, mostrar el diagnóstico, iniciar el runtime desde una fuente fijada y verificable, comprobar `/global/health`, listar modelos cuyo coste de entrada y salida sea cero y ejecutar una tarea de prueba. No usar la etiqueta “gratis” si el coste falta o es desconocido.
