import { describe, expect, it, vi } from "vitest";
import { createForjaSearchIndex } from "@/lib/forja/forja-search";
import { createForjaSyncWatcher } from "@/lib/forja/forja-sync-watcher";

describe("forja sync watcher", () => {
  const doc = (text: string) => ({ id: "a", path: "src/a.ts", text, metadata: {} });

  it("sincroniza y notifica solo cuando cambia la fuente", async () => {
    const index = createForjaSearchIndex();
    const watcher = createForjaSyncWatcher(index, { intervalMs: 5000 });
    const events: boolean[] = [];
    watcher.subscribe((event) => events.push(event.changed));

    await watcher.sync(async () => ({ source: "github", key: "repo", documents: [doc("Navbar")] }));
    await watcher.sync(async () => ({ source: "github", key: "repo", documents: [doc("Navbar")]}));
    await watcher.sync(async () => ({ source: "github", key: "repo", documents: [doc("CartDrawer")] }));

    expect(events).toEqual([true, false, true]);
    expect(index.search("CartDrawer").length).toBe(1);
  });

  it("agrupa requestSync y permite detenerlo", async () => {
    vi.useFakeTimers();
    const index = createForjaSearchIndex();
    const watcher = createForjaSyncWatcher(index, { debounceMs: 100 });
    const loader = vi.fn(async () => ({ source: "sandbox" as const, key: "p", documents: [doc("Hero")] }));

    watcher.requestSync(loader);
    watcher.requestSync(loader);
    await vi.advanceTimersByTimeAsync(99);
    expect(loader).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(loader).toHaveBeenCalledTimes(1);
    watcher.stop();
    vi.useRealTimers();
  });

  it("el evento trae el desglose de altas/cambios/bajas, no solo el booleano", async () => {
    const index = createForjaSearchIndex();
    const watcher = createForjaSyncWatcher(index);
    let last: Awaited<ReturnType<typeof watcher.sync>> | null = null;
    watcher.subscribe((event) => { last = event; });

    await watcher.sync(async () => ({
      source: "mega", key: "proyecto",
      documents: [doc("Navbar"), { id: "b", path: "src/b.ts", text: "Footer", metadata: {} }],
    }));
    expect(last).toMatchObject({ source: "mega", key: "proyecto", added: 2, updated: 0, removed: 0, changed: true });

    await watcher.sync(async () => ({
      source: "mega", key: "proyecto",
      documents: [{ id: "a", path: "src/a.ts", text: "Navbar cambiado", metadata: {} }],
    }));
    // "a" cambió de texto, "b" ya no viene en el batch: se da de baja.
    expect(last).toMatchObject({ added: 0, updated: 1, removed: 1, changed: true });
  });

  it("no confunde huellas entre dos claves distintas de la misma fuente", async () => {
    const index = createForjaSearchIndex();
    const watcher = createForjaSyncWatcher(index);
    const eventos: Array<{ key: string; changed: boolean }> = [];
    watcher.subscribe((e) => eventos.push({ key: e.key, changed: e.changed }));

    await watcher.sync(async () => ({ source: "github", key: "repo-1", documents: [doc("Navbar")] }));
    await watcher.sync(async () => ({ source: "github", key: "repo-2", documents: [doc("Navbar")] }));
    // Mismo id+texto que repo-1, pero es la PRIMERA vez que se ve en repo-2:
    // tiene que contar como alta (changed=true), no como "sin cambios".
    expect(eventos).toEqual([{ key: "repo-1", changed: true }, { key: "repo-2", changed: true }]);
  });

  it("protección contra sincronizaciones concurrentes: dos sync() en paralelo no se pisan", async () => {
    const index = createForjaSearchIndex();
    const watcher = createForjaSyncWatcher(index);
    const orden: string[] = [];

    const lenta = async (): Promise<{ source: "sandbox"; key: string; documents: ReturnType<typeof doc>[] }> => {
      orden.push("lenta:empieza");
      await new Promise((r) => setTimeout(r, 20));
      orden.push("lenta:termina");
      return { source: "sandbox", key: "p", documents: [doc("Uno")] };
    };
    const rapida = async () => {
      orden.push("rapida:empieza-y-termina");
      return { source: "sandbox" as const, key: "p", documents: [doc("Dos")] };
    };

    const [, resultadoRapida] = await Promise.all([watcher.sync(lenta), watcher.sync(rapida)]);

    // Si corrieran en paralelo, "rapida" (sin espera) terminaría antes que
    // "lenta" empezara a resolver — la cola lo impide: "lenta" siempre
    // termina completa antes de que "rapida" arranque.
    expect(orden).toEqual(["lenta:empieza", "lenta:termina", "rapida:empieza-y-termina"]);
    // El resultado final en el índice es el de la que corrió después ("rapida").
    expect(index.search("Dos")).toHaveLength(1);
    expect(resultadoRapida.updated).toBe(1);
  });

  it("watch(): hace polling cada intervalMs hasta llamar stop()", async () => {
    vi.useFakeTimers();
    const index = createForjaSearchIndex();
    const watcher = createForjaSyncWatcher(index, { intervalMs: 1000 });
    const loader = vi.fn(async () => ({ source: "drive" as const, key: "carpeta", documents: [doc("Uno")] }));

    watcher.watch(loader);
    expect(loader).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(loader).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(loader).toHaveBeenCalledTimes(3);

    watcher.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(loader).toHaveBeenCalledTimes(3); // stop() corta el polling

    vi.useRealTimers();
  });

  it("sin intervalMs configurado, watch() no arranca ningún polling", async () => {
    vi.useFakeTimers();
    const index = createForjaSearchIndex();
    const watcher = createForjaSyncWatcher(index);
    const loader = vi.fn(async () => ({ source: "drive" as const, key: "x", documents: [] }));

    watcher.watch(loader);
    await vi.advanceTimersByTimeAsync(60000);
    expect(loader).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("subscribe() devuelve una función para cancelar la suscripción", async () => {
    const index = createForjaSearchIndex();
    const watcher = createForjaSyncWatcher(index);
    const eventos: boolean[] = [];
    const cancelar = watcher.subscribe((e) => eventos.push(e.changed));

    await watcher.sync(async () => ({ source: "sandbox", key: "p", documents: [doc("Uno")] }));
    cancelar();
    await watcher.sync(async () => ({ source: "sandbox", key: "p", documents: [doc("Dos")] }));

    expect(eventos).toEqual([true]); // el segundo cambio ya no llega: se canceló antes
  });
});
