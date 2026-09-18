/** Tests del HUD de contexto (estimación honesta, sin inventar).
 *
 * El HUD es una ESTIMACIÓN local (chars/4) contra una ventana de
 * REFERENCIA: ningún test debe tratar estos números como datos de un
 * proveedor, igual que la UI no lo hace.
 */
import { describe, expect, it } from "vitest";
import {
  VENTANA_DEFECTO,
  UMBRAL_AVISO,
  UMBRAL_ROJO,
  calcularHud,
  estimarTokensChars,
  estimarTokensConversacion,
  fmtTokens,
  nivelCtx,
  ventanaReferencia,
} from "../../src/lib/forja/ctx-hud";
import { VIGENCIA_MS, type Limites } from "../../src/lib/forja/limites-medidos";

describe("estimarTokensChars", () => {
  it("4 caracteres ≈ 1 token, redondeando hacia arriba", () => {
    expect(estimarTokensChars(400)).toBe(100);
    expect(estimarTokensChars(401)).toBe(101);
    expect(estimarTokensChars(0)).toBe(0);
  });
  it("negativos no existen: 0", () => {
    expect(estimarTokensChars(-50)).toBe(0);
  });
});

describe("estimarTokensConversacion", () => {
  it("suma los mensajes y el texto del compositor", () => {
    const msgs = [
      { role: "user", content: "a".repeat(400) },
      { role: "assistant", content: "b".repeat(600) },
    ];
    // 1000 chars + 200 del input = 1200 chars = 300 tokens
    expect(estimarTokensConversacion(msgs, 200)).toBe(300);
  });
  it("mensajes sin contenido no rompen", () => {
    expect(estimarTokensConversacion([{ role: "user", content: "" }], 0)).toBe(0);
  });
});

describe("nivelCtx", () => {
  it("umbrales: 79 ok, 80 aviso, 95 rojo", () => {
    expect(nivelCtx(0)).toBe("ok");
    expect(nivelCtx(UMBRAL_AVISO - 0.1)).toBe("ok");
    expect(nivelCtx(UMBRAL_AVISO)).toBe("aviso");
    expect(nivelCtx(UMBRAL_ROJO - 0.1)).toBe("aviso");
    expect(nivelCtx(UMBRAL_ROJO)).toBe("rojo");
    expect(nivelCtx(300)).toBe("rojo");
  });
});

describe("fmtTokens", () => {
  it("formato español con coma decimal", () => {
    expect(fmtTokens(820)).toBe("820");
    expect(fmtTokens(1000)).toBe("1k");
    expect(fmtTokens(12400)).toBe("12,4k");
    // sin ceros de relleno
    expect(fmtTokens(20000)).toBe("20k");
  });
});

describe("calcularHud", () => {
  it("porcentaje con un decimal", () => {
    const h = calcularHud(16000, 32000);
    expect(h.pct).toBe(50);
    expect(h.nivel).toBe("ok");
  });
  it("ventana ausente o minúscula cae al default defendido", () => {
    expect(calcularHud(1000, 0).pct).toBe(Math.round((1000 / VENTANA_DEFECTO) * 1000) / 10);
  });
  it("porcentaje techo 999 (no pinta 3000%)", () => {
    expect(calcularHud(VENTANA_DEFECTO * 30, VENTANA_DEFECTO).pct).toBe(999);
  });
});

describe("ventanaReferencia — un dato real del proveedor, cuando lo hay, gana a la estimación", () => {
  const ahora = 1_700_000_000_000;

  it("sin modelKey o sin nada aprendido: la configurada tal cual", () => {
    expect(ventanaReferencia({}, null, 40_000, ahora)).toBe(40_000);
    expect(ventanaReferencia({}, "custom::algo", 40_000, ahora)).toBe(40_000);
  });

  it("un límite real MÁS PEQUEÑO que la configurada: gana el real", () => {
    const limites: Limites = { "custom::mini": { limite: 7_000, rechazado: 21_138, at: ahora } };
    expect(ventanaReferencia(limites, "custom::mini", 32_000, ahora)).toBe(7_000);
  });

  it("nunca ENSANCHA: un límite real más GRANDE que la configurada no gana", () => {
    const limites: Limites = { "custom::grande": { limite: 200_000, rechazado: 0, at: ahora } };
    expect(ventanaReferencia(limites, "custom::grande", 32_000, ahora)).toBe(32_000);
  });

  it("sin número del proveedor (solo lo rechazado), no hay ventana que ajustar", () => {
    const limites: Limites = { "custom::x": { limite: null, rechazado: 9_000, at: ahora } };
    expect(ventanaReferencia(limites, "custom::x", 32_000, ahora)).toBe(32_000);
  });

  it("caducado (misma vigencia que cabe()): se ignora, vuelve la configurada", () => {
    const limites: Limites = {
      "custom::viejo": { limite: 5_000, rechazado: 10_000, at: ahora - VIGENCIA_MS - 1 },
    };
    expect(ventanaReferencia(limites, "custom::viejo", 32_000, ahora)).toBe(32_000);
  });

  it("sin ventana configurada, cae al VENTANA_DEFECTO igual que calcularHud", () => {
    expect(ventanaReferencia({}, null, 0, ahora)).toBe(VENTANA_DEFECTO);
  });
});
