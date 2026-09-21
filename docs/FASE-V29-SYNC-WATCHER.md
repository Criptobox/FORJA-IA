# FASE V29 — Forja Sync Watcher

Propaga cambios de una fuente (MEGA/GitHub/Sandbox/Drive) al índice de Forja Search sin reconstruirlo entero, reusando el sistema de huellas (`fingerprint`) de V26.

## Aviso de procedencia — importante

El ZIP subido para esta fase llegó **corrupto**: tenía ~1,3 MB de datos de otra fase pegados después del final real de un ZIP más chico y sin relación (un demo de "web hamburguesa"). Se recuperó el contenido real parseando las cabeceras del ZIP a mano (sin depender del índice central, que faltaba): 397 de 398 archivos recuperados con CRC verificado byte a byte.

Pero **`src/lib/forja/forja-sync-watcher.ts` (la implementación) nunca estuvo en el archivo** — solo sobrevivió su test, `forja-sync-watcher.test.ts`. La implementación de este archivo fue **reconstruida por Claude** a partir de:
1. Lo que el test exige exactamente (ver más abajo qué está CONFIRMADO por él).
2. La descripción de la fase que dio el usuario (el diagrama y la lista de puntos).

Esto significa que el código que corre hoy en `forja-sync-watcher.ts` **no es necesariamente el original que se construyó fuera de esta sesión** — es una reconstrucción de buena fe, funcionalmente compatible con el único artefacto que sobrevivió (el test), pero puede diferir del original en detalles no cubiertos por ese test.

## Qué está CONFIRMADO por el test recuperado

- `createForjaSyncWatcher(index, options)` con `intervalMs`/`debounceMs` opcionales.
- `.sync(loader)`: ejecuta el loader, indexa el resultado, y notifica `changed: true/false` según si algo cambió respecto a la sincronización anterior de esa misma `key`.
- `.subscribe(listener)`: recibe cada evento de sincronización.
- `.requestSync(loader)`: agrupa llamadas rápidas — dos seguidas dentro de `debounceMs` terminan en una sola ejecución del loader.
- `.stop()`: existe y se puede llamar sin argumentos.

## Qué es INTERPRETACIÓN (no confirmado por ningún test original)

- El desglose `added`/`updated`/`removed` en el evento (el test solo mira `changed`).
- `.watch(loader)` y el polling por `intervalMs` — el test constructor pasa `intervalMs` pero nunca llama a `watch()` ni verifica polling.
- La protección contra sincronizaciones concurrentes (cola de promesas: cada `sync()`/`requestSync()` espera a que termine la anterior antes de correr).
- Los tipos `SyncSource`/`SyncBatch`/`SyncLoader` como contrato para futuros adaptadores (V30) — nombres e forma razonados a partir de la descripción, no verificados contra un archivo real.
- Que una entrada externa no reemplaza fingerprints entre `key` distintas (aislamiento por proyecto/repo).

Todo lo de esta segunda lista tiene tests propios en `tests/unit/forja-sync-watcher.test.ts` (además de los dos del test original), pero son tests que Claude escribió para su propia reconstrucción — no una verificación contra un original perdido.

## Flujo

`MEGA / GitHub / Sandbox / Drive → Sync Watcher → ¿qué cambió? (alta/cambio/baja vía fingerprint) → Forja Search → Knowledge Base → Technology Radar → Cerebro`

## Reglas de seguridad

- Un `SyncLoader` solo entrega datos (documentos de texto ya leídos); el watcher nunca ejecuta ni evalúa nada que reciba.
- No maneja ni guarda credenciales — un adaptador real es responsable de autenticarse por su cuenta.

## Archivos

- `src/lib/forja/forja-sync-watcher.ts`.
- `src/lib/forja/forja-search-persistence.ts`: `fingerprint()` ahora exportada, para que este módulo la reuse en vez de duplicarla.
- Tests: `tests/unit/forja-sync-watcher.test.ts` (2 casos recuperados del ZIP + 6 propios: desglose del evento, aislamiento entre `key`, concurrencia, polling con y sin `intervalMs`, cancelar una suscripción).

## Pendiente

Sin adaptadores reales todavía (MEGA/GitHub/Sandbox/Drive) — eso es V30. Este módulo define el contrato (`SyncSource`, `SyncBatch`, `SyncLoader`) que esos adaptadores van a implementar, pero nada lo llama todavía desde la app.
