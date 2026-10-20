import { describe, expect, it, beforeEach } from "vitest";
import { kbGetProjectManifest, kbGetProjectManifests, kbSaveProjectManifest } from "@/lib/forja/kb-projects";
import type { KBRepoAnalysis } from "@/lib/forja/kb-repo-analyzer";

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
}

function manifest(overrides: Partial<KBRepoAnalysis> = {}): KBRepoAnalysis {
  return {
    version: 1,
    id: "kb-project-1",
    name: "demo",
    analyzedAt: "2026-01-01T00:00:00.000Z",
    totalFiles: 3,
    indexedFiles: 3,
    ignoredFiles: 0,
    totalBytes: 300,
    technologies: ["TypeScript"],
    frameworks: [],
    packageManagers: ["npm"],
    components: [],
    patterns: [],
    licenses: [],
    entryPoints: [],
    importantFiles: [],
    files: [],
    ...overrides,
  };
}

describe("persistencia de manifiestos de proyecto", () => {
  beforeEach(() => stubLocalStorage());

  it("sin nada guardado, la lista está vacía y buscar por id no rompe", () => {
    expect(kbGetProjectManifests()).toEqual([]);
    expect(kbGetProjectManifest("no-existe")).toBeUndefined();
  });

  it("guarda y recupera un manifiesto por id", () => {
    kbSaveProjectManifest(manifest());
    expect(kbGetProjectManifest("kb-project-1")?.name).toBe("demo");
    expect(kbGetProjectManifests()).toHaveLength(1);
  });

  it("guardar de nuevo el mismo id lo reemplaza, no lo duplica", () => {
    kbSaveProjectManifest(manifest());
    kbSaveProjectManifest(manifest({ name: "demo-actualizado" }));
    const all = kbGetProjectManifests();
    expect(all).toHaveLength(1);
    expect(all[0]?.name).toBe("demo-actualizado");
  });

  it("localStorage con basura no rompe la lectura", () => {
    localStorage.setItem("forja-kb-project-manifests", "no-json");
    expect(kbGetProjectManifests()).toEqual([]);
  });

  it("recorta a los 100 manifiestos más recientes", () => {
    for (let i = 0; i < 105; i++) {
      kbSaveProjectManifest(manifest({ id: `kb-project-${i}`, name: `demo-${i}` }));
    }
    const all = kbGetProjectManifests();
    expect(all).toHaveLength(100);
    // El más reciente queda primero.
    expect(all[0]?.id).toBe("kb-project-104");
  });
});
