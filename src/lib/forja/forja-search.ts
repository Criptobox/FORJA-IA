/**
 * Forja IA — índice de búsqueda rápida estilo trigram.
 *
 * Inspirado conceptualmente en buscadores de índice persistente como tgrep,
 * pero implementado de forma independiente para el runtime de Forja.
 * No sustituye la búsqueda semántica: reduce primero el universo de candidatos.
 */

export interface ForjaSearchDocument {
  id: string;
  text: string;
  path?: string;
  metadata?: Record<string, string | number | boolean | string[]>;
}

export interface ForjaSearchHit {
  id: string;
  score: number;
  exact: boolean;
  path?: string;
  metadata?: ForjaSearchDocument["metadata"];
}

export interface ForjaSearchSnapshot {
  version: 1;
  documents: Record<string, ForjaSearchDocument>;
}

const norm = (value: string) => value
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .toLowerCase();

/**
 * El texto se acolcha con 2 espacios a cada lado para poder anclar el
 * principio/fin de palabra en el índice, pero eso produce un trigrama de
 * frontera ("  x" o "x  ") que codifica UN SOLO carácter real junto a 2
 * espacios de relleno — cualquier documento que empiece o termine con esa
 * misma letra lo comparte, sin relación real de contenido (p. ej. "Navbar"
 * y "CartDrawer" comparten el trigrama final "r  " solo por terminar
 * ambos en "r"). Se descartan los trigramas con 2+ espacios porque no
 * aportan señal real, para no generar coincidencias falsas.
 */
function grams(value: string): string[] {
  const text = `  ${norm(value).replace(/\s+/g, " ")}  `;
  if (text.length < 3) return [text];
  const out = new Set<string>();
  for (let i = 0; i <= text.length - 3; i += 1) {
    const gram = text.slice(i, i + 3);
    if ((gram.match(/ /g) ?? []).length >= 2) continue;
    out.add(gram);
  }
  return [...out];
}

function tokenCount(text: string, query: string): number {
  const q = norm(query).trim();
  if (!q) return 0;
  return norm(text).split(/[^a-z0-9_]+/i).filter(Boolean).filter(t => t === q || t.includes(q)).length;
}

export class ForjaSearchIndex {
  private readonly documents = new Map<string, ForjaSearchDocument>();
  private readonly postings = new Map<string, Set<string>>();

  add(document: ForjaSearchDocument): void {
    this.remove(document.id);
    const stored = { ...document, text: document.text.slice(0, 250_000) };
    this.documents.set(stored.id, stored);
    for (const gram of grams(stored.text)) {
      let posting = this.postings.get(gram);
      if (!posting) {
        posting = new Set<string>();
        this.postings.set(gram, posting);
      }
      posting.add(stored.id);
    }
  }

  addMany(documents: ForjaSearchDocument[]): void {
    for (const document of documents) this.add(document);
  }

  remove(id: string): boolean {
    const previous = this.documents.get(id);
    if (!previous) return false;
    for (const gram of grams(previous.text)) {
      const posting = this.postings.get(gram);
      posting?.delete(id);
      if (posting && posting.size === 0) this.postings.delete(gram);
    }
    this.documents.delete(id);
    return true;
  }

  clear(): void {
    this.documents.clear();
    this.postings.clear();
  }

  get size(): number { return this.documents.size; }

  /** IDs de todo lo indexado ahora mismo — para que quien sincroniza (p. ej.
   * forja-search-persistence.ts) sepa qué borrar cuando un documento ya no
   * viene en la lista nueva, sin tener que llevar esa lista por su cuenta. */
  getDocumentIds(): string[] { return [...this.documents.keys()]; }

  search(query: string, limit = 20): ForjaSearchHit[] {
    const q = norm(query).trim();
    if (!q) return [];
    const queryGrams = grams(q);
    const candidates = new Map<string, number>();
    for (const gram of queryGrams) {
      for (const id of this.postings.get(gram) ?? []) candidates.set(id, (candidates.get(id) ?? 0) + 1);
    }

    const results: ForjaSearchHit[] = [];
    for (const [id, matchedGrams] of candidates) {
      const doc = this.documents.get(id);
      if (!doc) continue;
      const text = norm(doc.text);
      const exact = text.includes(q);
      const gramRatio = matchedGrams / Math.max(1, queryGrams.length);
      const tokenBoost = Math.min(3, tokenCount(doc.text, q));
      const pathBoost = doc.path && norm(doc.path).includes(q) ? 3 : 0;
      const score = gramRatio * 10 + (exact ? 8 : 0) + tokenBoost + pathBoost;
      results.push({ id, score, exact, path: doc.path, metadata: doc.metadata });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(limit, 100)));
  }

  /**
   * Los postings NO se serializan: son puramente derivables de `documents`
   * (misma función `grams()` en `add`/`restore`), y `restore()` los
   * recalcula siempre desde cero. Incluirlos en el snapshot solo duplicaba
   * el mismo dato sin que nada lo leyera nunca al restaurar — justo el tipo
   * de índice/contexto gigante que esta fase promete evitar (un posting por
   * cada trigrama único, con la lista de IDs que lo contienen).
   */
  snapshot(): ForjaSearchSnapshot {
    const documents: Record<string, ForjaSearchDocument> = {};
    for (const [id, doc] of this.documents) documents[id] = doc;
    return { version: 1, documents };
  }

  restore(snapshot: ForjaSearchSnapshot): void {
    this.clear();
    for (const document of Object.values(snapshot.documents ?? {})) this.add(document);
  }
}

export function createForjaSearchIndex(documents: ForjaSearchDocument[] = []): ForjaSearchIndex {
  const index = new ForjaSearchIndex();
  index.addMany(documents);
  return index;
}
