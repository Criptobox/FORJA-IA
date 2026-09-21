/**
 * Forja IA — watcher/sync coordinator.
 *
 * No ejecuta código remoto ni depende de un watcher de filesystem concreto.
 * Cada fuente entrega un snapshot de documentos; el coordinador compara,
 * sincroniza el índice incremental y notifica cambios a Knowledge/Radar.
 */
import { syncForjaSearchIndex, type SyncResult } from "./forja-search-persistence";
import type { ForjaSearchDocument, ForjaSearchIndex } from "./forja-search";

export type ForjaSyncSource = "mega" | "github" | "sandbox" | "drive" | "local" | "unknown";

export interface ForjaSyncSnapshot {
  source: ForjaSyncSource;
  key: string;
  documents: ForjaSearchDocument[];
  collectedAt?: string;
}

export interface ForjaSyncEvent {
  source: ForjaSyncSource;
  key: string;
  result: SyncResult;
  changed: boolean;
  at: string;
}

export type ForjaSyncListener = (event: ForjaSyncEvent) => void;
export type ForjaSyncLoader = () => Promise<ForjaSyncSnapshot>;

export interface ForjaSyncWatcherOptions {
  intervalMs?: number;
  debounceMs?: number;
  onSync?: ForjaSyncListener;
}

const DEFAULT_INTERVAL = 60_000;
const DEFAULT_DEBOUNCE = 750;

export class ForjaSyncWatcher {
  private timer: ReturnType<typeof setInterval> | null = null;
  private pending: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private readonly listeners = new Set<ForjaSyncListener>();
  private readonly intervalMs: number;
  private readonly debounceMs: number;

  constructor(
    private readonly index: ForjaSearchIndex,
    options: ForjaSyncWatcherOptions = {},
  ) {
    this.intervalMs = Math.max(5_000, options.intervalMs ?? DEFAULT_INTERVAL);
    this.debounceMs = Math.max(0, options.debounceMs ?? DEFAULT_DEBOUNCE);
    if (options.onSync) this.listeners.add(options.onSync);
  }

  subscribe(listener: ForjaSyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async sync(loader: ForjaSyncLoader): Promise<ForjaSyncEvent> {
    if (this.running) {
      // El siguiente tick volverá a comprobar la fuente; no lanzamos dos
      // sincronizaciones concurrentes contra el mismo índice.
      return {
        source: "unknown",
        key: "busy",
        result: { added: 0, updated: 0, removed: 0, unchanged: 0, persisted: false },
        changed: false,
        at: new Date().toISOString(),
      };
    }
    this.running = true;
    try {
      const snapshot = await loader();
      const result = await syncForjaSearchIndex(snapshot.key, this.index, snapshot.documents);
      const event: ForjaSyncEvent = {
        source: snapshot.source,
        key: snapshot.key,
        result,
        changed: result.added + result.updated + result.removed > 0,
        at: new Date().toISOString(),
      };
      for (const listener of this.listeners) listener(event);
      return event;
    } finally {
      this.running = false;
    }
  }

  start(loader: ForjaSyncLoader): void {
    this.stop();
    void this.sync(loader);
    this.timer = setInterval(() => {
      void this.sync(loader);
    }, this.intervalMs);
  }

  /** Solicita una comprobación anticipada, agrupando cambios muy cercanos. */
  requestSync(loader: ForjaSyncLoader): void {
    if (this.pending) clearTimeout(this.pending);
    this.pending = setTimeout(() => {
      this.pending = null;
      void this.sync(loader);
    }, this.debounceMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.pending) clearTimeout(this.pending);
    this.timer = null;
    this.pending = null;
  }

  isRunning(): boolean { return this.running; }
}

export function createForjaSyncWatcher(
  index: ForjaSearchIndex,
  options?: ForjaSyncWatcherOptions,
): ForjaSyncWatcher {
  return new ForjaSyncWatcher(index, options);
}
