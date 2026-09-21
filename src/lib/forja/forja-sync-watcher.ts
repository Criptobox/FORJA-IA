/** Forja IA — Sync Watcher (V29).
 *
 * Propaga cambios de una fuente (MEGA/GitHub/Sandbox/Drive) al índice de
 * Forja Search sin reconstruirlo entero: reusa el mismo sistema de huellas
 * (`fingerprint`) que ya usa la persistencia de V26 para saber qué
 * documento es nuevo, cuál cambió y cuál desapareció.
 *
 * Reconstruido a partir del test que sobrevivió a un ZIP corrupto (la
 * implementación original no llegó) y de la descripción de la fase — ver
 * docs/FASE-V29-SYNC-WATCHER.md para el detalle de qué está confirmado
 * contra ese test y qué es interpretación de la especificación.
 *
 * Reglas de seguridad: un `SyncLoader` solo devuelve DATOS (documentos de
 * texto); este módulo nunca ejecuta ni evalúa nada que reciba, y no guarda
 * credenciales — quien implemente un loader real (un adaptador de MEGA,
 * GitHub, etc.) es responsable de autenticarse por su cuenta y de no pasar
 * aquí nada más que el texto ya leído.
 */
import type { ForjaSearchDocument, ForjaSearchIndex } from "./forja-search";
import { fingerprint } from "./forja-search-persistence";

/** Orígenes previstos; los adaptadores concretos llegan en una fase
 * posterior (V30) — aquí solo se define el contrato que van a implementar. */
export type SyncSource = "mega" | "github" | "sandbox" | "drive";

/** Lo que un adaptador entrega en cada sincronización: TODOS los documentos
 * vigentes de esa fuente+clave ahora mismo (no un delta) — el watcher es
 * quien calcula altas/cambios/bajas comparando con la vez anterior. */
export interface SyncBatch {
  source: SyncSource;
  key: string;
  documents: ForjaSearchDocument[];
}

export type SyncLoader = () => Promise<SyncBatch>;

export interface SyncEvent {
  source: SyncSource;
  key: string;
  /** Hubo al menos un alta, cambio o baja en esta sincronización. */
  changed: boolean;
  added: number;
  updated: number;
  removed: number;
}

export type SyncListener = (event: SyncEvent) => void;

export interface ForjaSyncWatcherOptions {
  /** Cada cuánto repetir un loader registrado con `watch()`. Sin esto,
   * `watch()` no arranca ningún polling. */
  intervalMs?: number;
  /** Cuánto esperar tras la última llamada a `requestSync()` antes de
   * ejecutar el loader — agrupa varias llamadas rápidas en una sola. */
  debounceMs?: number;
}

export interface ForjaSyncWatcher {
  /** Sincroniza ahora mismo con el resultado de `loader()`. Si ya hay una
   * sincronización en curso (de esta u otra llamada), espera a que termine
   * antes de correr — nunca dos a la vez, para no pisarse las huellas. */
  sync(loader: SyncLoader): Promise<SyncEvent>;
  /** Pide sincronizar, pero agrupado: varias llamadas seguidas dentro de
   * `debounceMs` terminan en una sola ejecución (la del loader más reciente). */
  requestSync(loader: SyncLoader): void;
  /** Registra un loader para sondear cada `intervalMs` (si se configuró).
   * Llamarlo de nuevo reemplaza el polling anterior. */
  watch(loader: SyncLoader): void;
  /** @returns función para cancelar la suscripción. */
  subscribe(listener: SyncListener): () => void;
  /** Cancela cualquier polling y debounce pendiente. No cancela una
   * sincronización ya en curso (la deja terminar). */
  stop(): void;
}

export function createForjaSyncWatcher(
  index: ForjaSearchIndex,
  options: ForjaSyncWatcherOptions = {}
): ForjaSyncWatcher {
  const listeners = new Set<SyncListener>();
  // Huellas de la última sincronización, por clave — así una misma fuente
  // puede traer varios proyectos/repos (`key` distinta) sin mezclarlos.
  const fingerprintsByKey = new Map<string, Map<string, string>>();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let intervalTimer: ReturnType<typeof setInterval> | null = null;
  // Cadena de promesas: cada sincronización se encadena detrás de la
  // anterior, así nunca corren dos a la vez ni se pisan las huellas, sin
  // importar en qué orden ni cuán seguidas se pidan.
  let queue: Promise<unknown> = Promise.resolve();

  function emit(event: SyncEvent): void {
    for (const listener of listeners) listener(event);
  }

  async function doSync(loader: SyncLoader): Promise<SyncEvent> {
    const batch = await loader();
    const oldFingerprints = fingerprintsByKey.get(batch.key) ?? new Map<string, string>();
    const nextFingerprints = new Map<string, string>();
    const incoming = new Map(batch.documents.map((doc) => [doc.id, doc]));
    let added = 0;
    let updated = 0;
    let removed = 0;

    for (const document of batch.documents) {
      const fp = fingerprint(document);
      nextFingerprints.set(document.id, fp);
      const old = oldFingerprints.get(document.id);
      if (!old) {
        index.add(document);
        added += 1;
      } else if (old !== fp) {
        index.add(document);
        updated += 1;
      }
    }
    for (const id of oldFingerprints.keys()) {
      if (!incoming.has(id)) {
        index.remove(id);
        removed += 1;
      }
    }

    fingerprintsByKey.set(batch.key, nextFingerprints);
    const event: SyncEvent = {
      source: batch.source,
      key: batch.key,
      changed: added > 0 || updated > 0 || removed > 0,
      added,
      updated,
      removed,
    };
    emit(event);
    return event;
  }

  /** Encadena esta sincronización detrás de todas las anteriores (éxito o
   * error): así nunca hay dos corriendo a la vez, sin importar si se llama
   * directo o desde `requestSync`/`watch`. */
  function runSync(loader: SyncLoader): Promise<SyncEvent> {
    const result = queue.then(() => doSync(loader));
    queue = result.catch(() => {});
    return result;
  }

  function requestSync(loader: SyncLoader): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void runSync(loader);
    }, options.debounceMs ?? 0);
  }

  function watch(loader: SyncLoader): void {
    if (intervalTimer) clearInterval(intervalTimer);
    intervalTimer = null;
    if (!options.intervalMs) return;
    intervalTimer = setInterval(() => {
      void runSync(loader);
    }, options.intervalMs);
  }

  function subscribe(listener: SyncListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function stop(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (intervalTimer) {
      clearInterval(intervalTimer);
      intervalTimer = null;
    }
  }

  return { sync: runSync, requestSync, watch, subscribe, stop };
}
