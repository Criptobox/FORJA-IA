import { describe, expect, it, beforeEach } from "vitest";
import {
  acceptAsRelated,
  discardDuplicateFromIndex,
  getVisualReviewPair,
  getVisualReviewQueue,
  keepBothVisualResources,
} from "@/lib/forja/kb-review";
import { kbGetResources, kbUpsertResource, type KBResource } from "@/lib/forja/kb-index";

function stubLocalStorage() {
  const mem = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
      removeItem: (k: string) => mem.delete(k),
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, "window", { value: { dispatchEvent: () => true }, configurable: true });
}

const original: KBResource = {
  id: "o", name: "original.png", mimeType: "image/png", sizeBytes: 100,
  accountEmail: "a@example.com", webViewLink: "https://drive.google.com/file/o",
  category: "ui", tags: [], technology: "", license: "", status: "clasificado",
  indexedAt: "2026-01-01T00:00:00.000Z",
};

const nuevo: KBResource = {
  id: "n", name: "nuevo.png", mimeType: "image/png", sizeBytes: 100,
  accountEmail: "a@example.com", webViewLink: "https://drive.google.com/file/n",
  category: "", tags: [], technology: "", license: "", status: "revision-duplicado",
  indexedAt: "2026-01-02T00:00:00.000Z", duplicateOf: "o", visualSimilarity: 0.9,
};

describe("KB visual review", () => {
  it("orders review items by similarity", () => {
    const a = { id: "a", name: "a", status: "revision-duplicado", visualSimilarity: 0.8, duplicateOf: "o" } as never;
    const b = { id: "b", name: "b", status: "revision-duplicado", visualSimilarity: 0.95, duplicateOf: "o" } as never;
    expect(getVisualReviewQueue([a, b]).map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("resolves the related resource", () => {
    const original = { id: "o", name: "original" } as never;
    const current = { id: "n", name: "new", duplicateOf: "o" } as never;
    expect(getVisualReviewPair(current, [original, current]).original?.name).toBe("original");
  });

  describe("acciones sobre el índice real", () => {
    beforeEach(() => {
      stubLocalStorage();
      kbUpsertResource(original);
      kbUpsertResource(nuevo);
    });

    it("«Conservar ambos» clasifica el nuevo y lo saca de la cola, sin tocar el original", () => {
      keepBothVisualResources("n");
      const resources = kbGetResources();
      expect(resources.find((r) => r.id === "n")?.status).toBe("clasificado");
      expect(getVisualReviewQueue(resources)).toHaveLength(0);
      expect(resources.find((r) => r.id === "o")).toEqual(original);
    });

    it("«Quitar del índice» borra solo el recurso local, nunca el original ni el archivo remoto", () => {
      discardDuplicateFromIndex("n");
      const resources = kbGetResources();
      expect(resources.map((r) => r.id)).toEqual(["o"]);
    });

    it("«Relacionarlos» registra la relación en ambos sentidos y cierra la revisión", () => {
      acceptAsRelated("n");
      const resources = kbGetResources();
      const actualizado = resources.find((r) => r.id === "n");
      const actualizadoOriginal = resources.find((r) => r.id === "o");
      expect(actualizado?.status).toBe("clasificado");
      expect(actualizado?.relatedResourceIds).toEqual(["o"]);
      expect(actualizadoOriginal?.relatedResourceIds).toEqual(["n"]);
    });

    it("«Relacionarlos» no hace nada si el recurso no tiene un original al que apuntar", () => {
      kbUpsertResource({ ...nuevo, id: "huerfano", duplicateOf: undefined });
      acceptAsRelated("huerfano");
      expect(kbGetResources().find((r) => r.id === "huerfano")?.status).toBe("revision-duplicado");
    });
  });
});
