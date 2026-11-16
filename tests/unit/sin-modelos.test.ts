import { describe, expect, it } from "vitest";
import { pausaDeLaCadena, textoEnPausa } from "@/lib/forja/sin-modelos";

const key = (p: string, m: string) => `${p}::${m}`;
const ahora = 1_000_000;
const en = (ms: number) => ({ until: ahora + ms, consecutive: 1, lastStatus: 429 });

describe("pausaDeLaCadena", () => {
  it("sin candidatos no es una pausa: de verdad no hay IA", () => {
    expect(pausaDeLaCadena([], {}, {}, key, ahora)).toBeNull();
  });
  it("si el proveedor entero está en pausa, dice cuánto falta y cuál", () => {
    const r = pausaDeLaCadena([{ providerId: "opencode", modelId: "beam-free" }, { providerId: "opencode", modelId: "big-pickle" }], {}, { opencode: en(5 * 60_000) }, key, ahora);
    expect(r).toEqual({ ms: 5 * 60_000, proveedores: ["opencode"] });
  });
  it("se queda con el primero que vuelve, también si es un solo modelo en pausa", () => {
    const r = pausaDeLaCadena(
      [{ providerId: "opencode", modelId: "a" }, { providerId: "groq", modelId: "b" }],
      { [key("groq", "b")]: en(30_000) },
      { opencode: en(120_000) },
      key,
      ahora
    );
    expect(r).toEqual({ ms: 30_000, proveedores: ["opencode", "groq"] });
  });
  it("si alguno está libre, la cadena no estaba vacía por pausas", () => {
    expect(pausaDeLaCadena([{ providerId: "opencode", modelId: "a" }, { providerId: "groq", modelId: "b" }], {}, { opencode: en(60_000) }, key, ahora)).toBeNull();
  });
  it("un cooldown ya caducado cuenta como libre", () => {
    expect(pausaDeLaCadena([{ providerId: "opencode", modelId: "a" }], {}, { opencode: { until: ahora - 1, consecutive: 1, lastStatus: 429 } }, key, ahora)).toBeNull();
  });
});

describe("textoEnPausa", () => {
  it("nombra la IA, los minutos y NO dice que falte una", () => {
    const t = textoEnPausa({ ms: 4 * 60_000 + 1, proveedores: ["opencode"] }, () => "OpenCode Zen");
    expect(t).toContain("OpenCode Zen");
    expect(t).toContain("~5 min");
    expect(t).toContain("No es que falte una IA");
    expect(t).not.toMatch(/necesito una IA conectada/);
  });
  it("redondea hacia arriba y nunca dice 0 min", () => {
    expect(textoEnPausa({ ms: 1000, proveedores: ["x"] }, (i) => i)).toContain("~1 min");
  });
});
