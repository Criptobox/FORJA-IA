/** Tests de forja-search-persistence.ts (FASE V26).
 *
 * En vitest (`environment: "node"`) no hay `indexedDB` global, así que todo
 * esto ejercita el fallback en memoria — es justo el camino que el propio
 * módulo documenta para SSR/tests, no un atajo del test. */
import { describe, expect, it, beforeEach } from "vitest";
import { ForjaSearchIndex } from "@/lib/forja/forja-search";
import {
  syncForjaSearchIndex,
  loadForjaSearchIndex,
  clearPersistedForjaSearchIndex,
} from "@/lib/forja/forja-search-persistence";

describe("syncForjaSearchIndex", () => {
  it("sincroniza solo altas/cambios/bajas y conserva el índice", async () => {
    const index = new ForjaSearchIndex();
    const first = await syncForjaSearchIndex("test-persist", index, [
      { id: "a", text: "ProductCard React", path: "ProductCard.tsx" },
      { id: "b", text: "Navbar React", path: "Navbar.tsx" },
    ]);
    expect(first.added).toBe(2);
    expect(index.search("ProductCard")[0]?.id).toBe("a");

    const second = await syncForjaSearchIndex("test-persist", index, [
      { id: "a", text: "ProductCard React responsive", path: "ProductCard.tsx" },
      { id: "c", text: "CartDrawer React", path: "CartDrawer.tsx" },
    ]);
    expect(second.updated).toBe(1);
    expect(second.added).toBe(1);
    expect(second.removed).toBe(1);
    expect(second.unchanged).toBe(0);
    expect(index.search("CartDrawer")[0]?.id).toBe("c");
    expect(index.search("Navbar")).toHaveLength(0);
  });

  it("un documento sin cambios se cuenta como unchanged, no como updated", async () => {
    const key = "test-unchanged";
    await clearPersistedForjaSearchIndex(key);
    const index = new ForjaSearchIndex();
    await syncForjaSearchIndex(key, index, [{ id: "a", text: "Navbar", path: "Navbar.tsx" }]);
    const second = await syncForjaSearchIndex(key, index, [{ id: "a", text: "Navbar", path: "Navbar.tsx" }]);
    expect(second.unchanged).toBe(1);
    expect(second.updated).toBe(0);
    expect(second.added).toBe(0);
  });

  it("marca persisted:true cuando guarda bien (memoria disponible en tests)", async () => {
    const index = new ForjaSearchIndex();
    const result = await syncForjaSearchIndex("test-persisted-flag", index, [{ id: "a", text: "x" }]);
    expect(result.persisted).toBe(true);
  });
});

describe("loadForjaSearchIndex — el escenario real de V26: cerrar y volver a abrir Forja", () => {
  const key = "test-reload";

  beforeEach(async () => {
    await clearPersistedForjaSearchIndex(key);
  });

  it("una instancia NUEVA del índice recupera lo que guardó una sesión anterior", async () => {
    const sesionAnterior = new ForjaSearchIndex();
    await syncForjaSearchIndex(key, sesionAnterior, [
      { id: "a", path: "Card.tsx", text: "ProductCard" },
      { id: "b", path: "Navbar.tsx", text: "Navbar" },
    ]);

    // "Cerrar y volver a abrir Forja": índice en blanco, no la misma instancia.
    const sesionNueva = new ForjaSearchIndex();
    expect(sesionNueva.size).toBe(0);
    const cargado = await loadForjaSearchIndex(key, sesionNueva);
    expect(cargado).toBe(true);
    expect(sesionNueva.size).toBe(2);
    expect(sesionNueva.search("ProductCard")[0]?.path).toBe("Card.tsx");
  });

  it("sin nada guardado todavía: devuelve false y no toca el índice", async () => {
    const index = new ForjaSearchIndex();
    index.add({ id: "z", text: "algo previo" });
    const cargado = await loadForjaSearchIndex("test-reload-vacio", index);
    expect(cargado).toBe(false);
    expect(index.size).toBe(1);
  });
});

describe("clearPersistedForjaSearchIndex", () => {
  it("borra lo guardado: la siguiente carga no encuentra nada", async () => {
    const key = "test-clear";
    const index = new ForjaSearchIndex();
    await syncForjaSearchIndex(key, index, [{ id: "a", text: "x" }]);
    await clearPersistedForjaSearchIndex(key);
    const cargado = await loadForjaSearchIndex(key, new ForjaSearchIndex());
    expect(cargado).toBe(false);
  });
});
