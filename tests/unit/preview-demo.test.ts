import { describe, it, expect } from "vitest";
import { decideDemo, type DemoContext } from "../../src/lib/forja/preview-demo";

/** El demo se auto-metía en la app de cualquiera que no tuviera todavía la
 * marca de «ya vista»: aparecía una conversación que nadie pidió, con el panel
 * de vista previa abierto encima. Le pasaba a quien borrase los datos del
 * sitio, y a los 62 escenarios E2E, que arrancan siempre de cero. */
const ctx = (over: Partial<DemoContext> = {}): DemoContext => ({
  forzado: false,
  yaVista: false,
  hayDemo: false,
  usuarioConDatos: false,
  ...over,
});

describe("decideDemo", () => {
  it("ya no se mete solo: ni a quien llega por primera vez ni a quien ya lo vio", () => {
    expect(decideDemo(ctx())).toBe("nada");
    expect(decideDemo(ctx({ usuarioConDatos: true }))).toBe("nada");
    expect(decideDemo(ctx({ yaVista: true, hayDemo: true }))).toBe("nada");
    expect(decideDemo(ctx({ yaVista: true, hayDemo: false }))).toBe("nada");
  });

  it("?demo=preview lo escribe siempre", () => {
    expect(decideDemo(ctx({ forzado: true }))).toBe("escribir");
    expect(decideDemo(ctx({ forzado: true, yaVista: true, usuarioConDatos: true }))).toBe("escribir");
  });
});
