# FASE V29 — Forja Sync Watcher

Coordina la sincronización de una fuente (MEGA/GitHub/Sandbox/Drive) hacia el índice de Forja Search, reusando `syncForjaSearchIndex` (V26) para el diffing incremental por fingerprint — sin reconstruir el índice entero en cada vuelta.

## Aviso de procedencia

El ZIP subido originalmente para esta fase llegó **corrupto**: tenía ~1,3 MB de otra fase pegados después del final real de un ZIP más chico y sin relación. Se recuperó casi todo el contenido parseando las cabeceras a mano, pero `forja-sync-watcher.ts` (la implementación) no estaba — solo sobrevivió su test. Claude reconstruyó una implementación propia a partir de ese test más la descripción de la fase.

**Esa reconstrucción quedó reemplazada.** El ZIP de la fase siguiente (V30) traía, sin corrupción, una copia intacta de `forja-sync-watcher.ts` — el original real. Se adoptó esa versión completa en su lugar; la reconstrucción de Claude ya no está en el repo. Los dos tests del ZIP original pasan contra ella sin cambios.

## API real (confirmada por el archivo original)

- `class ForjaSyncWatcher` / `createForjaSyncWatcher(index, options)` — `intervalMs` (piso de 5000ms) y `debounceMs` (piso 0, por defecto 750ms).
- `.sync(loader)`: llama a `syncForjaSearchIndex(snapshot.key, index, snapshot.documents)` y devuelve un `ForjaSyncEvent` con `result` (el mismo `{added, updated, removed, unchanged, persisted}` de V26) y `changed`.
- **Concurrencia**: si ya hay una sincronización en curso, una llamada nueva a `.sync()` NO se encola ni espera — devuelve de inmediato un evento `{source: "unknown", key: "busy", changed: false}` sin tocar el índice. (Nota: esto es distinto de lo que asumió la reconstrucción descartada, que encolaba en vez de descartar.)
- `.requestSync(loader)`: debounce — agrupa llamadas seguidas.
- `.start(loader)`: sincroniza de inmediato y arranca el polling cada `intervalMs`. `.stop()` corta ambos.
- `.subscribe(listener)` devuelve función de cancelación. `.isRunning()`.

## Flujo

`MEGA / GitHub / Sandbox / Drive → Sync Watcher → syncForjaSearchIndex (V26) → Forja Search → Knowledge Base → Technology Radar → Cerebro`

## Reglas de seguridad

- Un loader solo entrega datos (documentos de texto); el watcher nunca ejecuta ni evalúa nada que reciba.
- No maneja ni guarda credenciales.

## Archivos

- `src/lib/forja/forja-sync-watcher.ts`.
- Tests: `tests/unit/forja-sync-watcher.test.ts` — los 2 casos del ZIP original + 6 propios (desglose de `result`, aislamiento entre `key`, la concurrencia que DESCARTA en vez de encolar, `start()`/`stop()` con el piso de 5000ms, cancelar una suscripción).

## Pendiente

Sin adaptadores reales al momento de escribir esto — llegan en V30 (`forja-sync-sources.ts`).
