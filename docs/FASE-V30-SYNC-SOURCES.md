# FASE V30 — Source Sync Adapters

V30 conecta el coordinador de V29 con fuentes reales sin convertirlas en un canal de ejecución.

## Fuentes

- **MEGA**: recorre la sesión ya autenticada (`mega-provider.ts`, V-anterior) y crea un snapshot de archivos de texto pequeños.
- **GitHub**: usa Git Trees + Blobs API para un repositorio concreto; el token se recibe por argumento y nunca se persiste aquí.
- **Sandbox**: convierte los archivos del proyecto abierto en snapshot local.

## Límites

- 512 KB por archivo y 8 MB por snapshot, para proteger memoria/contexto.
- Se omiten binarios y archivos no textuales (por extensión).
- Un fallo de un archivo (lectura de MEGA, blob de GitHub) no aborta el resto del snapshot.
- Sandbox además trunca cada archivo a 250.000 caracteres y el snapshot a 2000 archivos.
- No se ejecuta código remoto: los loaders solo devuelven texto ya leído.
- Un árbol de GitHub inaccesible (404/403/etc.) lanza en vez de devolver un snapshot vacío silencioso — para no hacer pasar un repo inalcanzable por "no había nada que indexar".

## Arquitectura

Los loaders solo producen `ForjaSyncSnapshot` (mismo contrato que espera `ForjaSyncWatcher.sync()`/`.start()`/`.requestSync()` de V29). El Orchestrator puede llamar a estos loaders bajo permisos explícitos; nada de esto se activa solo.

## Archivos

- `src/lib/forja/forja-sync-sources.ts`: `createMegaSyncLoader`, `createGitHubSyncLoader`, `createSandboxSyncLoader`, `createForjaSourceLoaders`.
- Tests: `tests/unit/forja-sync-sources.test.ts` — los 2 casos del ZIP original (Sandbox, GitHub) + 7 propios: límites de tamaño de Sandbox, GitHub ignorando binarios/archivos grandes, un blob roto no aborta el resto, un tree 404 lanza, y MEGA completo (recorrido de carpetas, un archivo remoto roto no aborta el resto, tope por archivo) — MEGA no tenía ningún test en el ZIP original.

## Pendiente

Ningún caller real de la app arma todavía estos loaders y se los pasa a un `ForjaSyncWatcher` — el Orchestrator puede hacerlo en una fase posterior.
