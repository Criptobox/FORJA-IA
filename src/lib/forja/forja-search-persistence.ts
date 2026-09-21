/**
 * Forja IA — persistencia y sincronización incremental del índice de búsqueda.
 *
 * Usa IndexedDB en navegador (mucho más apropiado que localStorage para índices
 * grandes) y memoria como fallback SSR/tests. El índice se guarda como snapshot
 * y cada documento lleva una firma para detectar cambios sin reconstruir todo.
 */
import type { ForjaSearchDocument, ForjaSearchIndex, ForjaSearchSnapshot } from "./forja-search";

const DB_NAME = "forja-search";
const DB_VERSION = 1;
const STORE = "indexes";
const MEMORY = new Map<string, PersistedForjaSearchIndex>();

export interface PersistedForjaSearchIndex {
  version: 1;
  key: string;
  savedAt: string;
  documentFingerprints: Record<string, string>;
  snapshot: ForjaSearchSnapshot;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** Huella estable de un documento (id+path+texto+metadata). Exportada para
 * que otros mecanismos de sincronización (p. ej. forja-sync-watcher.ts, V29)
 * detecten altas/cambios/bajas con el mismo criterio, sin duplicar la lógica. */
export function fingerprint(document: ForjaSearchDocument): string {
  const input = `${document.id}\n${document.path ?? ""}\n${document.text}\n${stableStringify(document.metadata ?? {})}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir IndexedDB"));
  });
}

async function readStored(key: string): Promise<PersistedForjaSearchIndex | null> {
  const memory = MEMORY.get(key);
  if (memory) return memory;
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    request.onsuccess = () => resolve((request.result as PersistedForjaSearchIndex | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("No se pudo leer el índice"));
  });
}

async function writeStored(value: PersistedForjaSearchIndex): Promise<void> {
  MEMORY.set(value.key, value);
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("No se pudo guardar el índice"));
  });
}

export interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
  persisted: boolean;
}

/**
 * Sincroniza solo documentos nuevos, modificados o eliminados.
 * El caller mantiene la misma instancia del índice para consultas inmediatas.
 */
export async function syncForjaSearchIndex(
  key: string,
  index: ForjaSearchIndex,
  documents: ForjaSearchDocument[],
): Promise<SyncResult> {
  const previous = await readStored(key);
  const oldFingerprints = previous?.documentFingerprints ?? {};
  const nextFingerprints: Record<string, string> = {};
  const incoming = new Map(documents.map(doc => [doc.id, doc]));
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let removed = 0;

  // Si tenemos snapshot previo y el índice actual está vacío, restauramos primero.
  if (previous && index.size === 0) index.restore(previous.snapshot);

  for (const document of documents) {
    const fp = fingerprint(document);
    nextFingerprints[document.id] = fp;
    if (!oldFingerprints[document.id]) {
      index.add(document);
      added += 1;
    } else if (oldFingerprints[document.id] !== fp) {
      index.add(document);
      updated += 1;
    } else {
      unchanged += 1;
    }
  }

  for (const id of Object.keys(oldFingerprints)) {
    if (!incoming.has(id)) {
      index.remove(id);
      removed += 1;
    }
  }

  const record: PersistedForjaSearchIndex = {
    version: 1,
    key,
    savedAt: new Date().toISOString(),
    documentFingerprints: nextFingerprints,
    snapshot: index.snapshot(),
  };
  try {
    await writeStored(record);
    return { added, updated, removed, unchanged, persisted: true };
  } catch {
    return { added, updated, removed, unchanged, persisted: false };
  }
}

export async function loadForjaSearchIndex(key: string, index: ForjaSearchIndex): Promise<boolean> {
  try {
    const stored = await readStored(key);
    if (!stored) return false;
    index.restore(stored.snapshot);
    return true;
  } catch {
    return false;
  }
}

export async function clearPersistedForjaSearchIndex(key: string): Promise<void> {
  MEMORY.delete(key);
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}
