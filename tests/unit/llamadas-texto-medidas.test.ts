/** Forja IA — Lo que cada modelo demostró sobre CÓMO pide las herramientas.
 *
 * `tools-probe.ts` solo sabe si el proveedor ACEPTA `tools`, nunca si el
 * modelo va a devolver `tool_calls` de verdad — nvidia/nemotron pasa el
 * probe y aun así entrega su propia plantilla en texto. Esto guarda lo que
 * SÍ se vio pasar de verdad, con el mismo patrón reactivo (y caducidad)
 * que `limites-medidos.ts`.
 */
import { describe, expect, it } from "vitest";
import {
  VIGENCIA_MS,
  mensajeLlamadaComoTexto,
  pideComoTexto,
  type LlamadasTexto,
} from "../../src/lib/forja/llamadas-texto-medidas";

describe("pideComoTexto", () => {
  const ahora = 1_700_000_000_000;

  it("un modelo nunca visto: no se sabe nada, no se afirma nada", () => {
    expect(pideComoTexto({}, "custom::nunca-visto", ahora)).toBe(false);
  });

  it("visto de verdad y fresco: sí", () => {
    const medidas: LlamadasTexto = { "openrouter::nemotron": { veces: 2, at: ahora } };
    expect(pideComoTexto(medidas, "openrouter::nemotron", ahora)).toBe(true);
  });

  it("caducado (el proveedor pudo cambiar el modelo detrás del id): se ignora", () => {
    const medidas: LlamadasTexto = {
      "openrouter::viejo": { veces: 1, at: ahora - VIGENCIA_MS - 1 },
    };
    expect(pideComoTexto(medidas, "openrouter::viejo", ahora)).toBe(false);
  });

  it("justo en el borde de la vigencia: todavía cuenta", () => {
    const medidas: LlamadasTexto = { "x::y": { veces: 1, at: ahora - VIGENCIA_MS } };
    expect(pideComoTexto(medidas, "x::y", ahora)).toBe(true);
  });
});

describe("mensajeLlamadaComoTexto", () => {
  it("sin nada visto, no hay mensaje que dar", () => {
    expect(mensajeLlamadaComoTexto(false)).toBeNull();
  });

  it("visto: explica qué pasa, sin decir que el modelo no soporta tools (sí las soporta)", () => {
    const msg = mensajeLlamadaComoTexto(true);
    expect(msg).toMatch(/texto/i);
    expect(msg).not.toMatch(/no soporta/i);
  });
});
