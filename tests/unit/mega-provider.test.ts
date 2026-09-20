import { describe, expect, it } from "vitest";
import { createMegaProvider, isMegaCodeRole, megaConnectionState, megaItemLabel } from "@/lib/forja/mega-provider";

describe("Adaptador MEGA", () => {
  it("se declara desconectado en vez de fingir una sesión", () => {
    const state = megaConnectionState();
    expect(state.connected).toBe(false);
    expect(state.reason).toBeTruthy();
  });

  it("el provider no soporta ninguna operación mientras no haya sesión real", () => {
    const provider = createMegaProvider();
    expect(provider.id).toBe("mega");
    expect(Object.values(provider.capabilities).every((v) => v === false)).toBe(true);
  });

  it("las operaciones del provider rechazan en vez de fingir éxito", async () => {
    const provider = createMegaProvider();
    await expect(provider.list()).rejects.toThrow(/no está conectado/);
    await expect(provider.read("x")).rejects.toThrow(/no está conectado/);
  });

  it("reconoce los roles de código/repositorio de MEGA", () => {
    expect(isMegaCodeRole("code")).toBe(true);
    expect(isMegaCodeRole("repositories")).toBe(true);
    expect(isMegaCodeRole("knowledge")).toBe(false);
  });

  it("etiqueta un item con su nombre y tipo", () => {
    const label = megaItemLabel({ id: "1", name: "componente.tsx", kind: "file", provider: "mega" });
    expect(label).toBe("componente.tsx · file");
  });
});
