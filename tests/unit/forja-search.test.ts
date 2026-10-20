import { describe, expect, it } from "vitest";
import { ForjaSearchIndex } from "@/lib/forja/forja-search";

describe("ForjaSearchIndex", () => {
  it("encuentra candidatos sin recorrer el texto completo desde cero", () => {
    const index = new ForjaSearchIndex();
    index.addMany([
      { id: "a", path: "src/ProductCard.tsx", text: "ProductCard React component product grid" },
      { id: "b", path: "src/FilterDrawer.tsx", text: "FilterDrawer React filters" },
    ]);
    const hits = index.search("ProductCard");
    expect(hits[0]?.id).toBe("a");
    expect(hits[0]?.exact).toBe(true);
  });

  it("actualiza y elimina documentos incrementalmente", () => {
    const index = new ForjaSearchIndex();
    index.add({ id: "a", text: "Navbar" });
    index.add({ id: "a", text: "CartDrawer" });
    expect(index.search("Navbar")).toHaveLength(0);
    expect(index.search("CartDrawer")[0]?.id).toBe("a");
    expect(index.remove("a")).toBe(true);
    expect(index.size).toBe(0);
  });

  it("no confunde dos palabras solo por compartir la primera o la última letra", () => {
    // El texto se acolcha con 2 espacios a cada lado para anclar principio y
    // fin de palabra. Sin filtrar los trigramas de frontera (2+ espacios),
    // "Navbar" y "CartDrawer" comparten el trigrama final "r  " por
    // terminar ambos en "r" —sin ninguna relación real de contenido— y
    // "Norte" compartiría el trigrama inicial "  n" con "Navbar" solo por
    // empezar ambos en "n".
    const index = new ForjaSearchIndex();
    index.add({ id: "a", text: "CartDrawer" });
    index.add({ id: "b", text: "Norte" });
    expect(index.search("Navbar")).toHaveLength(0);
  });

  it("puede serializar y restaurar el índice", () => {
    const index = new ForjaSearchIndex();
    index.add({ id: "a", path: "Card.tsx", text: "ProductCard" });
    const restored = new ForjaSearchIndex();
    restored.restore(index.snapshot());
    expect(restored.search("ProductCard")[0]?.path).toBe("Card.tsx");
  });

  it("getDocumentIds() lista lo indexado ahora, sin lo ya eliminado", () => {
    const index = new ForjaSearchIndex();
    index.addMany([{ id: "a", text: "x" }, { id: "b", text: "y" }]);
    index.remove("a");
    expect(index.getDocumentIds()).toEqual(["b"]);
  });

  it("el snapshot no incluye postings derivables: solo los documentos", () => {
    // `restore()` siempre recalcula los trigramas desde `documents` (misma
    // función `grams()`), así que guardar además los postings solo duplica
    // el mismo dato sin que nada lo lea — justo el tipo de índice gigante
    // que esta fase promete evitar al fijar límites de tamaño.
    const index = new ForjaSearchIndex();
    index.add({ id: "a", text: "ProductCard" });
    const snapshot = index.snapshot();
    expect(snapshot).not.toHaveProperty("trigrams");
    expect(Object.keys(snapshot.documents)).toEqual(["a"]);
  });
});
