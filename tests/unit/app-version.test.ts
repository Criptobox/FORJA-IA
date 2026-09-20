import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  APP_VERSION,
  buildLabel,
  compareSemver,
  versionCheck,
} from "../../src/lib/forja/app-version";
import { pickManualModel, AUTO_MODEL_KEY, FORJA_WEB_MODEL_KEY, isForjaWebKey } from "../../src/lib/forja/types";

describe("APP_VERSION", () => {
  it("coincide con package.json", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
  });
});

describe("compareSemver", () => {
  it("ordena 3.4.0 < 3.5.0 < 3.10.0", () => {
    expect(compareSemver("3.4.0", "3.5.0")).toBe(-1);
    expect(compareSemver("3.10.0", "3.4.0")).toBe(1);
    expect(compareSemver("3.4.0", "3.4.0")).toBe(0);
  });
});

describe("versionCheck", () => {
  it("al día si local >= latest", () => {
    expect(versionCheck("3.4.0", "3.4.0")).toBe("ok");
    expect(versionCheck("3.5.0", "3.4.0")).toBe("ok");
    expect(versionCheck("3.4.0", "3.4.1")).toBe("outdated");
    expect(versionCheck("3.4.0", null)).toBe("unknown");
  });
});

describe("pickManualModel", () => {
  it("apaga Auto aunque no haya modelos: devuelve null, no Auto", () => {
    expect(pickManualModel(AUTO_MODEL_KEY, null, undefined)).toBeNull();
  });
  it("prioriza el último modelo a mano", () => {
    expect(pickManualModel(AUTO_MODEL_KEY, "kimi::kimi-k3", "groq::llama")).toBe("kimi::kimi-k3");
  });
  it("apaga FORJA WEB igual que Auto: devuelve null, no el pseudo-modelo", () => {
    expect(pickManualModel(FORJA_WEB_MODEL_KEY, null, undefined)).toBeNull();
  });
  it("con FORJA WEB puesto, también prioriza el último modelo a mano", () => {
    expect(pickManualModel(FORJA_WEB_MODEL_KEY, "kimi::kimi-k3", "groq::llama")).toBe("kimi::kimi-k3");
  });
});

describe("isForjaWebKey", () => {
  it("distingue el pseudo-modelo FORJA WEB de Auto y de un modelo real", () => {
    expect(isForjaWebKey(FORJA_WEB_MODEL_KEY)).toBe(true);
    expect(isForjaWebKey(AUTO_MODEL_KEY)).toBe(false);
    expect(isForjaWebKey("kimi::kimi-k3")).toBe(false);
    expect(isForjaWebKey(null)).toBe(false);
    expect(isForjaWebKey(undefined)).toBe(false);
  });
});

describe("una sola versión de verdad", () => {
  it("el respaldo del código coincide con package.json", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    // Tenerlo escrito a mano en dos sitios ya salió mal: Ajustes anunció «v3.1»
    // durante cuatro versiones porque nadie tocó ese texto.
    expect(APP_VERSION).toBe(pkg.version);
  });
});

describe("buildLabel", () => {
  it("lleva versión, commit y fecha", () => {
    expect(buildLabel("3.5.0", "a1b2c3d", "2026-08-29T10:00:00.000Z")).toBe(
      "v3.5.0 · a1b2c3d · 2026-08-29"
    );
  });
  it("sin commit ni fecha se queda en la versión", () => {
    expect(buildLabel("3.5.0", "", "")).toBe("v3.5.0");
  });
  it("una fecha ilegible no rompe la etiqueta", () => {
    expect(buildLabel("3.5.0", "abc", "no-es-fecha")).toBe("v3.5.0 · abc");
  });
});
