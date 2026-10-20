import { describe, expect, it, vi, beforeEach } from "vitest";

/** Un `Storage` de MEGAJS falso, suficiente para probar `mega-provider.ts`
 * sin tocar la red real ni depender de una cuenta MEGA de verdad. La forma
 * (root/children/nodeId/directory/…) es la misma que usa `mega-provider.ts`. */
function buildFakeRoot() {
  return {
    nodeId: "root",
    name: "Root",
    directory: true,
    children: [
      {
        nodeId: "f1",
        name: "componente.tsx",
        directory: false,
        size: 120,
        timestamp: 1700000000,
        downloadBuffer: async () => new Uint8Array([1, 2, 3]),
        delete: async () => {},
      },
      {
        nodeId: "d1",
        name: "carpeta",
        directory: true,
        children: [{ nodeId: "f2", name: "anidado.ts", directory: false, size: 10 }],
        upload: (name: string, data: Uint8Array) => ({
          complete: Promise.resolve({ nodeId: "nuevo-1", name, directory: false, size: data.length }),
        }),
      },
    ],
  };
}

let closedCalls = 0;

class FakeStorage {
  ready: Promise<unknown>;
  constructor(opts: { email: string; password: string; secondFactorCode?: string }) {
    if (opts.password === "mal") {
      this.ready = Promise.reject(new Error("Credenciales de MEGA inválidas."));
    } else if (opts.email.includes("2fa") && !opts.secondFactorCode) {
      this.ready = Promise.reject(new Error("Falta el código 2FA."));
    } else {
      this.ready = Promise.resolve({
        root: buildFakeRoot(),
        name: "Cuenta de prueba",
        getAccountInfo: async () => ({ spaceUsed: 1000, spaceTotal: 5000 }),
        close: () => {
          closedCalls++;
        },
      });
    }
  }
}

vi.mock("megajs", () => ({ Storage: FakeStorage }));

describe("Adaptador MEGA", () => {
  let mega: typeof import("@/lib/forja/mega-provider");

  beforeEach(async () => {
    closedCalls = 0;
    vi.resetModules();
    // `connectMega` exige navegador (`typeof window === "undefined"` corta
    // el paso en Node); el entorno de vitest es "node", así que se simula
    // igual que hace `attachment-blob.test.ts` para el mismo caso.
    if (typeof globalThis.window === "undefined") {
      (globalThis as { window: typeof globalThis }).window = globalThis;
    }
    mega = await import("@/lib/forja/mega-provider");
  });

  it("se declara desconectado antes de cualquier login", () => {
    expect(mega.megaConnectionState()).toEqual({ connected: false });
  });

  it("el provider soporta las operaciones reales una vez conectado", async () => {
    await mega.connectMega("ana@example.com", "buena");
    const provider = mega.createMegaProvider();
    expect(provider.id).toBe("mega");
    expect(Object.values(provider.capabilities).every((v) => v === true)).toBe(true);
  });

  it("sin conexión, las operaciones rechazan en vez de fingir éxito", async () => {
    const provider = mega.createMegaProvider();
    await expect(provider.list()).rejects.toThrow(/no está conectado/);
    await expect(provider.read("x")).rejects.toThrow(/no está conectado/);
  });

  it("login real: lista la raíz, incluyendo carpetas anidadas por id", async () => {
    await mega.connectMega("ana@example.com", "buena");
    expect(mega.megaConnectionState()).toEqual({ connected: true, email: "ana@example.com", name: "Cuenta de prueba" });
    const provider = mega.createMegaProvider();
    const raiz = await provider.list();
    expect(raiz.map((f) => f.name)).toEqual(["componente.tsx", "carpeta"]);
    const dentro = await provider.list("d1");
    expect(dentro.map((f) => f.name)).toEqual(["anidado.ts"]);
  });

  it("lee y sube archivos contra el árbol de MEGA", async () => {
    await mega.connectMega("ana@example.com", "buena");
    const provider = mega.createMegaProvider();
    const bytes = await provider.read("f1");
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
    const subido = await provider.write("nuevo.ts", new Uint8Array([9, 9]), "d1");
    expect(subido.name).toBe("nuevo.ts");
  });

  it("borrar pasa por el archivo real, no por un stub", async () => {
    await mega.connectMega("ana@example.com", "buena");
    const provider = mega.createMegaProvider();
    await expect(provider.delete("f1")).resolves.toBeUndefined();
    await expect(provider.delete("no-existe")).rejects.toThrow(/no encontrado/);
  });

  it("credenciales inválidas no dejan una sesión a medias", async () => {
    await expect(mega.connectMega("ana@example.com", "mal")).rejects.toThrow(/inválidas/);
    expect(mega.megaConnectionState()).toEqual({ connected: false });
  });

  it("pide 2FA cuando la cuenta lo requiere, y funciona al mandarlo", async () => {
    await expect(mega.connectMega("ana-2fa@example.com", "buena")).rejects.toThrow(/2FA/);
    expect(mega.megaConnectionState().connected).toBe(false);
    await mega.connectMega("ana-2fa@example.com", "buena", "123456");
    expect(mega.megaConnectionState().connected).toBe(true);
  });

  it("desconectar cierra la sesión y borra el estado", async () => {
    await mega.connectMega("ana@example.com", "buena");
    mega.disconnectMega();
    expect(mega.megaConnectionState()).toEqual({ connected: false });
    expect(closedCalls).toBe(1);
  });

  it("consulta la cuota real de la cuenta conectada", async () => {
    await mega.connectMega("ana@example.com", "buena");
    expect(await mega.megaAccountInfo()).toEqual({ spaceUsed: 1000, spaceTotal: 5000 });
  });

  it("rechaza conectar sin correo o sin contraseña", async () => {
    await expect(mega.connectMega("", "buena")).rejects.toThrow(/correo/);
    await expect(mega.connectMega("ana@example.com", "")).rejects.toThrow(/correo/);
  });

  it("reconoce los roles de código/repositorio de MEGA", () => {
    expect(mega.isMegaCodeRole("code")).toBe(true);
    expect(mega.isMegaCodeRole("repositories")).toBe(true);
    expect(mega.isMegaCodeRole("knowledge")).toBe(false);
  });

  it("etiqueta un item con su nombre y tipo", () => {
    const label = mega.megaItemLabel({ id: "1", name: "componente.tsx", kind: "file", provider: "mega" });
    expect(label).toBe("componente.tsx · file");
  });
});
