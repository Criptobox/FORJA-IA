import { describe, it, expect } from "vitest";
import { formatBytes, quotaPercent } from "../../src/lib/forja/gdrive-oauth";

describe("formatBytes", () => {
  it("formatea unidades crecientes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1_500_000)).toBe("1.4 MB");
    expect(formatBytes(15 * 1024 ** 3)).toBe("15 GB");
  });
  it("valores no finitos o negativos caen a 0 B", () => {
    expect(formatBytes(NaN)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
  });
});

describe("quotaPercent", () => {
  it("calcula porcentaje con límite", () => {
    expect(quotaPercent({ limit: 100, usage: 40, usageInDrive: 40 })).toBe(40);
  });
  it("sin límite (Workspace ilimitado) devuelve null", () => {
    expect(quotaPercent({ limit: null, usage: 999, usageInDrive: 999 })).toBeNull();
  });
  it("no supera 100", () => {
    expect(quotaPercent({ limit: 10, usage: 999, usageInDrive: 999 })).toBe(100);
  });
});
