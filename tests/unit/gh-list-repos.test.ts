import { describe, expect, it, vi } from "vitest";
import { ghListRepos } from "@/lib/forja/github-upload";

const repo = (n: number) => ({ name: `r${n}`, full_name: `yo/r${n}`, owner: { login: "yo" }, default_branch: "main" });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("ghListRepos", () => {
  it("devuelve los repos y entrega cada página completa según llega", async () => {
    const paginas = [Array.from({ length: 100 }, (_, i) => repo(i)), [repo(100)]];
    let n = 0;
    const parciales: number[] = [];
    const lista = await ghListRepos("t", {
      fetchImpl: async () => json(paginas[n++]),
      onParcial: (l) => parciales.push(l.length),
    });
    expect(lista).toHaveLength(101);
    expect(parciales).toEqual([100]);
  });

  it("cancelar corta de inmediato y no se disfraza de fallo de red", async () => {
    const ctl = new AbortController();
    const p = ghListRepos("t", {
      signal: ctl.signal,
      fetchImpl: (_u, init) =>
        new Promise((_res, rej) => init?.signal?.addEventListener("abort", () => rej(new DOMException("x", "AbortError")))),
    });
    ctl.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });

  it("un 401 falla a la primera, sin reintentos", async () => {
    let llamadas = 0;
    await expect(
      ghListRepos("t", { fetchImpl: async () => (llamadas++, json({ message: "Bad credentials" }, 401)) })
    ).rejects.toThrow();
    expect(llamadas).toBe(1);
  });
});

describe("caché de repos", () => {
  it("devuelve la lista solo para el mismo token", async () => {
    const mem = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
    });
    const { ghReposCacheGuardar, ghReposCacheLeer } = await import("@/lib/forja/github-upload");
    const item = { owner: "yo", repo: "a", fullName: "yo/a", isPrivate: false, defaultBranch: "main", htmlUrl: "" };
    ghReposCacheGuardar("token-A", [item]);
    expect(ghReposCacheLeer("token-A")).toEqual([item]);
    expect(ghReposCacheLeer("token-B")).toEqual([]);
    vi.unstubAllGlobals();
  });
});
