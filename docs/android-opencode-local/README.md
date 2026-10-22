# Forja IA 4.70.6 — plan de integración OpenCode local en Android

## Objetivo

Reutilizar el patrón observado en la APK de referencia: ejecutar OpenCode dentro de un entorno Linux local de Android y presentar sus modelos en la interfaz de Forja IA. Esta entrega prepara la arquitectura y los criterios de seguridad; **no incluye una APK Android compilada ni afirma que el runtime local ya esté integrado**.

## Qué se pudo observar en la APK de referencia

- Interfaz web embebida en `assets/ui/index.html`.
- Un puente JavaScript hacia código nativo (`window.OpenCodeNative`).
- Cadenas que apuntan a `proot`, un binario OpenCode y un servidor enlazado a `127.0.0.1`.
- Una referencia al catálogo de OpenCode Zen (`https://opencode.ai/zen/v1/models`).

Esto indica un enfoque de ejecución local, pero la inspección estática de una APK no demuestra que todos los flujos funcionen ni que sus modelos sean siempre gratuitos.

## Arquitectura recomendada

```text
Forja IA (interfaz actual)
        │ interfaz estable RuntimeOpenCode
        ▼
Puente Android nativo (WebView / JS bridge)
        │ estado, iniciar, detener, enviar tarea
        ▼
Entorno Linux aislado (proot)
        │ proceso local y puerto loopback
        ▼
OpenCode CLI + catálogo de proveedores/modelos
```

En web de escritorio, el conector remoto existente debe seguir siendo opcional. Una web alojada no puede instalar ni arrancar por sí sola un proceso Linux en el teléfono. Para Android se necesita una envoltura nativa o una aplicación compañera con un puente explícito.

## Contrato mínimo del puente nativo

El puente debe exponer métodos versionados y devolver errores estructurados:

- `getRuntimeStatus()` → `not-installed | starting | ready | stopped | error`, versión y puerto local si existe.
- `startRuntime()` → iniciar una sola instancia y devolver estado; no bloquear la UI.
- `stopRuntime()` → detener el proceso hijo y liberar recursos.
- `getModelCatalog()` → modelos y proveedor; `free=true` únicamente cuando el coste de entrada y salida se pueda verificar como cero.
- `runTask({prompt, model, sessionId?})` → resultado o error con código y mensaje seguro.
- `cancelTask({taskId})` → cancelar sin destruir el historial.

La interfaz no debe depender de detalles internos de proot ni de una versión concreta de OpenCode. El puente debe rechazar llamadas no autorizadas, validar el esquema de datos y limitar los tamaños de entrada.

## Reglas para modelos y costes

1. Mostrar por separado: **gratis verificado**, **precio desconocido** y **de pago**.
2. Si el catálogo no declara precio, no inferir que es gratis.
3. Nunca cambiar silenciosamente a un modelo de pago tras un fallo.
4. Revalidar el catálogo antes de ejecutar una tarea.
5. Avisar si un proveedor requiere inicio de sesión, cuota o configuración adicional; “gratis” no significa disponibilidad ilimitada.

## Seguridad

- Vincular el servidor solo a loopback (`127.0.0.1`), no a todas las interfaces de red.
- No exponer tokens de proveedor en el JavaScript de la web ni en logs.
- No permitir que una página web arbitraria controle el proceso nativo; restringir origen y métodos del puente.
- No descargar ni ejecutar binarios sin verificar versión, arquitectura, origen y checksum cuando esté disponible.
- Solicitar confirmación antes de ejecutar operaciones destructivas en archivos del proyecto.
- Añadir límites de tiempo, cancelación, salida máxima y recuperación tras reinicio.

## Fases verificables

### Fase 1 — Puente Android
- Crear una envoltura Android que conserve la UI actual de Forja IA en WebView.
- Añadir el puente JS nativo con estado de runtime y diagnóstico.
- Probar inicio/parada, permisos, reinicio del proceso y Android ARM64.

### Fase 2 — Catálogo
- Leer el catálogo desde OpenCode local.
- Etiquetar el coste de forma conservadora.
- Probar proveedor desconectado, catálogo vacío y precios incompletos.

### Fase 3 — Chat y tareas
- Enviar tareas a una sesión OpenCode y devolver respuesta al chat.
- Mostrar progreso, cancelar, reintentar y recuperar sesiones.
- Mantener el chat normal de Forja IA operativo si el runtime no está disponible.

### Fase 4 — Herramientas del agente
- Permitir acceso solo a una carpeta de proyecto elegida por el usuario.
- Vista previa de cambios y confirmación antes de aplicar cambios destructivos.
- Ejecutar pruebas disponibles y exportar ZIP.

## Pruebas de aceptación

- Runtime apagado: Forja IA muestra una instrucción útil y el chat normal no se rompe.
- Runtime encendido: el estado cambia a conectado y el catálogo carga.
- Catálogo sin precios: esos modelos nunca se etiquetan como gratuitos.
- Modelo gratuito no disponible: no hay sustitución silenciosa por uno de pago.
- Error de servidor: se muestra el código y se puede reintentar.
- Cancelación: la tarea deja de ejecutarse y la conversación permanece.
- El servidor local no es accesible desde otros dispositivos de la red.

## Estado de esta entrega

- [x] Inspección estática de la APK de referencia y documentación de arquitectura.
- [x] Reglas de coste, seguridad y aceptación documentadas.
- [ ] Puente Android nativo implementado.
- [ ] OpenCode CLI empaquetado/instalado y arrancado en Android.
- [ ] Integración de catálogo y chat conectada al puente.
- [ ] APK compilada e instalada en un teléfono real.

No se debe considerar terminada la integración hasta que las últimas cuatro casillas se validen en un dispositivo Android.

## Actualización v4.70.8 — puente nativo inicial

Se añadió `android/forja-opencode/src/main/java/app/forja/opencode/ForjaOpenCodeBridge.kt`, una implementación Kotlin inicial para WebView que consulta salud y catálogo por loopback, valida el modelo contra el catálogo en cada tarea y rechaza modelos sin coste cero explícito. También se sincronizó el respaldo de versión en `src/lib/forja/app-version.ts`.

**Límite importante:** esta clase aún necesita el host Android que conecte los callbacks y un supervisor que instale/inicie OpenCode. No se pudo compilar el módulo Android porque este entorno no tiene Gradle ni Android SDK. La instalación de dependencias Node tampoco finalizó dentro del tiempo disponible; por tanto no se declara que los tests/build web hayan pasado.
