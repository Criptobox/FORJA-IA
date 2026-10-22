# Forja IA + OpenCode local en Android

## Qué cambia en v4.70.7

Se añade un contrato TypeScript seguro para que una futura APK Android comunique la interfaz de Forja IA con el runtime OpenCode local. El navegador normal no puede arrancar procesos Linux; por eso la integración completa requiere una capa nativa Android (WebView + servicio/proot), como hace la APK de referencia.

## Contrato de puente

La APK debe exponer `window.ForjaOpenCodeNative` en el WebView de Forja IA:

- `getStatus()` → `{ available, running, version?, message }`
- `listModels()` → catálogo con `id`, `name`, `providerID`, `free` y opcionalmente `context`.
- `runTask({ prompt, model, sessionID? })` → `{ ok, sessionID?, model?, text?, error? }`
- `openRuntimeSettings?()` → abre diagnóstico/ajustes nativos.

El campo `free` solo puede ser `true` si el catálogo consultado en ese momento confirma explícitamente coste de entrada y salida igual a cero. Un modelo cuyo precio falte o sea desconocido debe permanecer excluido. La app nativa debe volver a validar el modelo antes de ejecutar; la validación TypeScript del cliente no sustituye la validación nativa.

## Seguridad obligatoria para la APK

1. Registrar el puente solo en el WebView que carga el origen confiable de Forja IA; no en pestañas o páginas arbitrarias.
2. No exponer una API sin autenticación en `0.0.0.0`; enlazar el servidor local a `127.0.0.1` y usar un token aleatorio por instalación si el protocolo local lo necesita.
3. No aceptar comandos de shell arbitrarios desde JavaScript. `runTask` debe aceptar solo el objeto validado y construir llamadas al API de OpenCode, no concatenar comandos.
4. Limitar el tamaño de la tarea, permitir cancelar la ejecución y mostrar el error real sin claves ni variables de entorno.
5. No usar fallback silencioso a modelos con coste desconocido o de pago.
6. El catálogo y los resultados son datos no confiables: nunca interpretar la respuesta del modelo como instrucciones nativas privilegiadas.

## Límite de esta fase

Este commit crea el contrato de comunicación y pruebas unitarias; no contiene todavía el runtime Linux/proot ni una APK compilada. El runtime debe integrarse en un proyecto Android con Gradle, SDK y pruebas en dispositivo. No debe presentarse como terminado hasta verificar arranque, catálogo, ejecución, cancelación, reinicio y permisos en el Xiaomi 15.
