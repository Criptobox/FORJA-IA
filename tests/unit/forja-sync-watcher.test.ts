import { describe, expect, it, vi, beforeEach } from "vitest";
import { createForjaSearchIndex } from "@/lib/forja/forja-search";
import { createForjaSyncWatcher } from "@/lib/forja/forja-sync-watcher";
import { clearPersistedForjaSearchIndex } from "@/lib/forja/forja-search-persistence";

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

  describe("desglose y aislamiento por key (sync() delega en syncForjaSearchIndex de V26)", () => {
    beforeEach(async () => {
      await clearPersistedForjaSearchIndex("desglose-a");
      await clearPersistedForjaSearchIndex("aislamiento-1");
      await clearPersistedForjaSearchIndex("aislamiento-2");
    });

    it("event.result trae el desglose de altas/cambios/bajas de V26, no solo el booleano", async () => {
      const index = createForjaSearchIndex();
      const watcher = createForjaSyncWatcher(index, { intervalMs: 5000 });

      const primero = await watcher.sync(async () => ({
        source: "mega", key: "desglose-a",
        documents: [doc("Navbar"), { id: "b", path: "src/b.ts", text: "Footer", metadata: {} }],
      }));
      expect(primero.result).toMatchObject({ added: 2, updated: 0, removed: 0 });
      expect(primero.changed).toBe(true);

      const segundo = await watcher.sync(async () => ({
        source: "mega", key: "desglose-a",
        documents: [{ id: "a", path: "src/a.ts", text: "Navbar cambiado", metadata: {} }],
      }));
      // "a" cambió de texto, "b" ya no viene en el batch: se da de baja.
      expect(segundo.result).toMatchObject({ added: 0, updated: 1, removed: 1 });
    });

    it("no confunde huellas entre dos claves distintas", async () => {
      const index = createForjaSearchIndex();
      const watcher = createForjaSyncWatcher(index, { intervalMs: 5000 });

      const e1 = await watcher.sync(async () => ({ source: "github", key: "aislamiento-1", documents: [doc("Navbar")] }));
      const e2 = await watcher.sync(async () => ({ source: "github", key: "aislamiento-2", documents: [doc("Navbar")] }));
      // Mismo id+texto que la clave 1, pero es la PRIMERA vez que se ve en la
      // clave 2: tiene que contar como alta, no como "sin cambios".
      expect(e1.changed).toBe(true);
      expect(e2.changed).toBe(true);
      expect(e2.result.added).toBe(1);
    });
  });

  describe("protección contra sincronizaciones concurrentes", () => {
    it("una sync() mientras otra está en curso se descarta (no se encola ni corre en paralelo)", async () => {
      const index = createForjaSearchIndex();
      const watcher = createForjaSyncWatcher(index, { intervalMs: 5000 });
      const control = { liberar: () => {} };
      const lenta = () => new Promise<void>((resolve) => { control.liberar = () => resolve(); });

      const primeraPromesa = watcher.sync(async () => {
        await lenta();
        return { source: "sandbox" as const, key: "concurrencia", documents: [doc("Uno")] };
      });

      expect(watcher.isRunning()).toBe(true);
      const segunda = await watcher.sync(async () => ({ source: "sandbox", key: "concurrencia", documents: [doc("Dos")] }));

      // La segunda encontró al watcher ocupado: vuelve al toque, sin tocar el índice.
      expect(segunda).toMatchObject({ source: "unknown", key: "busy", changed: false });

      control.liberar();
      const primera = await primeraPromesa;
      expect(primera.result.added).toBe(1);
      expect(watcher.isRunning()).toBe(false);
    });
  });

  describe("start()/stop()", () => {
    it("start() sincroniza de inmediato y luego repite cada intervalMs", async () => {
      vi.useFakeTimers();
      const index = createForjaSearchIndex();
      const watcher = createForjaSyncWatcher(index, { intervalMs: 5000 });
      const loader = vi.fn(async () => ({ source: "drive" as const, key: "carpeta", documents: [doc("Uno")] }));

      watcher.start(loader);
      await vi.advanceTimersByTimeAsync(0);
      expect(loader).toHaveBeenCalledTimes(1); // inmediato, sin esperar el primer intervalo

      await vi.advanceTimersByTimeAsync(5000);
      expect(loader).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(10000);
      expect(loader).toHaveBeenCalledTimes(4);

      watcher.stop();
      await vi.advanceTimersByTimeAsync(20000);
      expect(loader).toHaveBeenCalledTimes(4); // stop() corta el polling

      vi.useRealTimers();
    });

    it("intervalMs tiene un piso de 5000ms aunque se pida menos", async () => {
      vi.useFakeTimers();
      const index = createForjaSearchIndex();
      const watcher = createForjaSyncWatcher(index, { intervalMs: 100 });
      const loader = vi.fn(async () => ({ source: "drive" as const, key: "carpeta-2", documents: [] }));

      watcher.start(loader);
      await vi.advanceTimersByTimeAsync(0);
      expect(loader).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(4999);
      expect(loader).toHaveBeenCalledTimes(1); // todavía no pasaron los 5000ms reales
      await vi.advanceTimersByTimeAsync(1);
      expect(loader).toHaveBeenCalledTimes(2);

      watcher.stop();
      vi.useRealTimers();
    });
  });

  it("subscribe() devuelve una función para cancelar la suscripción", async () => {
    await clearPersistedForjaSearchIndex("unsubscribe-key");
    const index = createForjaSearchIndex();
    const watcher = createForjaSyncWatcher(index, { intervalMs: 5000 });
    const eventos: boolean[] = [];
    const cancelar = watcher.subscribe((e) => eventos.push(e.changed));

    await watcher.sync(async () => ({ source: "sandbox", key: "unsubscribe-key", documents: [doc("Uno")] }));
    cancelar();
    await watcher.sync(async () => ({ source: "sandbox", key: "unsubscribe-key", documents: [doc("Dos")] }));

    expect(eventos).toEqual([true]); // el segundo cambio ya no llega: se canceló antes
  });
});
