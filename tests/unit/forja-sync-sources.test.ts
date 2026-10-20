import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createGitHubSyncLoader,
  createSandboxSyncLoader,
  createMegaSyncLoader,
} from "@/lib/forja/forja-sync-sources";
import type { StorageItem, StorageProvider } from "@/lib/forja/storage-providers";

vi.mock("@/lib/forja/mega-provider", () => ({
  createMegaProvider: vi.fn(),
}));

import { createMegaProvider } from "@/lib/forja/mega-provider";

function fakeMegaProvider(overrides: Partial<StorageProvider> = {}): StorageProvider {
  return {
    id: "mega",
    label: "MEGA",
    capabilities: { list: true, read: true, write: false, move: false, delete: false, search: false },
    list: vi.fn(async () => []),
    read: vi.fn(async () => new Uint8Array()),
    write: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  };
}

describe("forja sync sources", () => {
  it("crea un snapshot de Sandbox sin dependencias remotas", async () => {
    const snapshot = await createSandboxSyncLoader("p1", [{ path: "src/a.ts", content: "export const x = 1" }, { path: "image.png", content: "no" }])();
    expect(snapshot.source).toBe("sandbox");
    expect(snapshot.documents).toHaveLength(1);
    expect(snapshot.documents[0].metadata?.provider).toBe("sandbox");
  });

  it("Sandbox: trunca contenido a 250.000 caracteres y limita a 2000 archivos", async () => {
    const enorme = "x".repeat(300_000);
    const muchos = Array.from({ length: 2500 }, (_, i) => ({ path: `src/f${i}.ts`, content: "x" }));
    const snapshot = await createSandboxSyncLoader("p2", [{ path: "src/grande.ts", content: enorme }, ...muchos])();
    expect(snapshot.documents).toHaveLength(2000);
    expect(snapshot.documents[0].text.length).toBeLessThanOrEqual(250_000);
  });

  it("lee un árbol GitHub y sus blobs de texto", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ tree: [{ path: "src/a.ts", type: "blob", sha: "abc", size: 10 }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ encoding: "base64", content: btoa("Navbar") }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const snapshot = await createGitHubSyncLoader({ owner: "o", repo: "r" })();
    expect(snapshot.documents[0].text).toBe("Navbar");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it("GitHub: ignora binarios/no-texto y archivos que superan MAX_FILE_BYTES", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      tree: [
        { path: "logo.png", type: "blob", sha: "img", size: 10 },
        { path: "src/gigante.ts", type: "blob", sha: "big", size: 600_000 },
        { path: "src/carpeta", type: "tree", sha: "dir" },
      ],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const snapshot = await createGitHubSyncLoader({ owner: "o", repo: "r" })();
    expect(snapshot.documents).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1); // ninguno calificó para pedir su blob
    vi.unstubAllGlobals();
  });

  it("GitHub: un blob que falla no aborta el resto del snapshot", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        tree: [
          { path: "src/roto.ts", type: "blob", sha: "malo", size: 10 },
          { path: "src/bien.ts", type: "blob", sha: "bueno", size: 10 },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ encoding: "base64", content: btoa("Footer") }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const snapshot = await createGitHubSyncLoader({ owner: "o", repo: "r" })();
    expect(snapshot.documents).toHaveLength(1);
    expect(snapshot.documents[0].text).toBe("Footer");
    vi.unstubAllGlobals();
  });

  it("GitHub: un tree inaccesible (404/403) lanza en vez de devolver un snapshot vacío silencioso", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("nope", { status: 404 })));
    await expect(createGitHubSyncLoader({ owner: "o", repo: "no-existe" })()).rejects.toThrow();
    vi.unstubAllGlobals();
  });

  describe("MEGA", () => {
    beforeEach(() => {
      vi.mocked(createMegaProvider).mockReset();
    });

    it("recorre carpetas y arma un snapshot con los archivos de texto", async () => {
      const root: StorageItem[] = [
        { id: "f1", name: "a.ts", kind: "file", sizeBytes: 5, provider: "mega" },
        { id: "d1", name: "carpeta", kind: "folder", provider: "mega" },
        { id: "img", name: "foto.png", kind: "file", sizeBytes: 5, provider: "mega" },
      ];
      const dentroDeCarpeta: StorageItem[] = [{ id: "f2", name: "b.ts", kind: "file", sizeBytes: 5, provider: "mega" }];
      const provider = fakeMegaProvider({
        list: vi.fn(async (parentId?: string) => (parentId === "d1" ? dentroDeCarpeta : root)),
        read: vi.fn(async (id: string) => new TextEncoder().encode(id === "f1" ? "Navbar" : "Footer")),
      });
      vi.mocked(createMegaProvider).mockReturnValue(provider);

      const snapshot = await createMegaSyncLoader()();
      expect(snapshot.source).toBe("mega");
      expect(snapshot.documents).toHaveLength(2); // a.ts y carpeta/b.ts; foto.png queda afuera
      expect(snapshot.documents.map((d) => d.path).sort()).toEqual(["a.ts", "carpeta/b.ts"]);
    });

    it("un archivo remoto que falla al leerse no aborta el resto del snapshot", async () => {
      const root: StorageItem[] = [
        { id: "malo", name: "roto.ts", kind: "file", sizeBytes: 5, provider: "mega" },
        { id: "bueno", name: "bien.ts", kind: "file", sizeBytes: 5, provider: "mega" },
      ];
      const provider = fakeMegaProvider({
        list: vi.fn(async () => root),
        read: vi.fn(async (id: string) => {
          if (id === "malo") throw new Error("fallo de red");
          return new TextEncoder().encode("contenido");
        }),
      });
      vi.mocked(createMegaProvider).mockReturnValue(provider);

      const snapshot = await createMegaSyncLoader()();
      expect(snapshot.documents).toHaveLength(1);
      expect(snapshot.documents[0].path).toBe("bien.ts");
    });

    it("respeta el tope de tamaño por archivo (MAX_FILE_BYTES)", async () => {
      const root: StorageItem[] = [{ id: "grande", name: "grande.ts", kind: "file", sizeBytes: 600_000, provider: "mega" }];
      const provider = fakeMegaProvider({ list: vi.fn(async () => root) });
      vi.mocked(createMegaProvider).mockReturnValue(provider);

      const snapshot = await createMegaSyncLoader()();
      expect(snapshot.documents).toHaveLength(0);
      expect(provider.read).not.toHaveBeenCalled();
    });
  });
});
