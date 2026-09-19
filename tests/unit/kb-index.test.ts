import { describe, it, expect, beforeEach } from "vitest";
import {
  kbExistingCategories,
  kbFindByHash,
  kbGetResources,
  kbHashFile,
  kbHasResource,
  kbRemoveResource,
  kbStats,
  kbUpdateResource,
  kbUpsertResource,
  type KBResource,
} from "../../src/lib/forja/kb-index";

const resource: KBResource = {
  id: "file-1",
  name: "landing.png",
  mimeType: "image/png",
  sizeBytes: 2048,
  accountEmail: "ana@example.com",
  webViewLink: "https://drive.google.com/file/d/1",
  category: "",
  tags: [],
  technology: "",
  license: "",
  status: "nuevo",
  indexedAt: "2026-01-01T00:00:00.000Z",
};

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

describe("índice de la Knowledge Base (localStorage)", () => {
  beforeEach(() => stubLocalStorage());

  it("añade, actualiza y elimina recursos por id", () => {
    expect(kbGetResources()).toEqual([]);
    kbUpsertResource(resource);
    expect(kbGetResources()).toEqual([resource]);

    kbUpsertResource({ ...resource, category: "componentes" });
    expect(kbGetResources()).toHaveLength(1);
    expect(kbGetResources()[0]?.category).toBe("componentes");

    kbUpsertResource({ ...resource, id: "file-2", name: "otro.pdf" });
    expect(kbGetResources()).toHaveLength(2);

    kbRemoveResource("file-1");
    expect(kbGetResources().map((r) => r.id)).toEqual(["file-2"]);
  });

  it("localStorage con basura no rompe la lectura", () => {
    localStorage.setItem("forja-kb-index", "no-json");
    expect(kbGetResources()).toEqual([]);
  });

  it("kbHasResource distingue lo que ya está indexado", () => {
    expect(kbHasResource("file-1")).toBe(false);
    kbUpsertResource(resource);
    expect(kbHasResource("file-1")).toBe(true);
    expect(kbHasResource("file-2")).toBe(false);
  });

  it("kbUpdateResource solo toca los campos editables y pasa a clasificado", () => {
    kbUpsertResource(resource);
    kbUpdateResource("file-1", { category: "visual", tags: ["dashboard", "oscuro"], status: "clasificado" });
    const [updated] = kbGetResources();
    expect(updated).toMatchObject({
      id: "file-1",
      name: "landing.png",
      category: "visual",
      tags: ["dashboard", "oscuro"],
      status: "clasificado",
    });
  });

  it("kbUpdateResource sobre un id inexistente no hace nada", () => {
    kbUpsertResource(resource);
    kbUpdateResource("no-existe", { category: "x" });
    expect(kbGetResources()).toEqual([resource]);
  });
});

describe("kbFindByHash / kbExistingCategories", () => {
  beforeEach(() => stubLocalStorage());

  it("encuentra el recurso con ese hash exacto, si existe", () => {
    kbUpsertResource({ ...resource, contentHash: "abc123" });
    expect(kbFindByHash("abc123")?.id).toBe("file-1");
    expect(kbFindByHash("otro-hash")).toBeUndefined();
  });

  it("lista categorías existentes sin repetir ni vacíos", () => {
    const resources: KBResource[] = [
      { ...resource, id: "1", category: "visual" },
      { ...resource, id: "2", category: "visual" },
      { ...resource, id: "3", category: "componentes" },
      { ...resource, id: "4", category: "" },
    ];
    expect(kbExistingCategories(resources)).toEqual(["visual", "componentes"]);
  });
});

describe("kbHashFile", () => {
  it("el mismo contenido da el mismo hash; contenido distinto, hash distinto", async () => {
    const a1 = await kbHashFile(new File(["hola mundo"], "a.txt"));
    const a2 = await kbHashFile(new File(["hola mundo"], "otro-nombre.txt"));
    const b = await kbHashFile(new File(["otro contenido"], "a.txt"));
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("kbStats", () => {
  it("cuenta solo lo que hay de verdad, por estado", () => {
    const resources: KBResource[] = [
      { ...resource, id: "1", status: "nuevo" },
      { ...resource, id: "2", status: "nuevo" },
      { ...resource, id: "3", status: "clasificado" },
      { ...resource, id: "4", status: "pendiente" },
    ];
    expect(kbStats(resources)).toEqual({ total: 4, nuevo: 2, clasificado: 1, pendiente: 1 });
  });

  it("sin recursos, todo en cero", () => {
    expect(kbStats([])).toEqual({ total: 0, nuevo: 0, clasificado: 0, pendiente: 0 });
  });
});
