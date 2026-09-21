import { describe, expect, it } from "vitest";
import {
  validateRadarRecord,
  validateRadarSnapshot,
  diffRadarSnapshots,
  activeRadarRecords,
  type RadarRegistrySnapshot,
} from "@/lib/forja/technology-radar-registry";

const record = {
  id: "demo", name: "Demo", area: "agents", description: "test", license: "MIT",
  maturity: "candidate", integration: "reference", localFriendly: true, costProfile: "free-open-source",
  signals: ["agent"], sourceUrl: "https://example.com", checkedAt: "2026-09-21T00:00:00Z",
  status: "active", provenanceHash: "abc",
};

describe("validateRadarRecord", () => {
  it("acepta un registro bien formado", () => {
    expect(validateRadarRecord(record).ok).toBe(true);
  });

  it("rechaza un área desconocida", () => {
    expect(validateRadarRecord({ ...record, area: "evil" })).toEqual({ ok: false, reason: "invalid-enum" });
  });

  it("rechaza madurez/integración/costo fuera de los enums permitidos", () => {
    expect(validateRadarRecord({ ...record, maturity: "wishful" }).ok).toBe(false);
    expect(validateRadarRecord({ ...record, integration: "magic" }).ok).toBe(false);
    expect(validateRadarRecord({ ...record, costProfile: "free-beer" }).ok).toBe(false);
  });

  it("rechaza si falta un campo obligatorio", () => {
    const { id, ...sinId } = record;
    void id;
    expect(validateRadarRecord(sinId)).toEqual({ ok: false, reason: "missing-required-field" });
  });

  it("rechaza una URL de procedencia inválida", () => {
    expect(validateRadarRecord({ ...record, sourceUrl: "no-es-una-url" })).toEqual({ ok: false, reason: "invalid-source-or-date" });
  });

  it("rechaza una fecha de verificación inválida", () => {
    expect(validateRadarRecord({ ...record, checkedAt: "no-es-una-fecha" })).toEqual({ ok: false, reason: "invalid-source-or-date" });
  });

  it("rechaza señales que no son un array de strings, o con más de 64", () => {
    expect(validateRadarRecord({ ...record, signals: "agent" })).toEqual({ ok: false, reason: "invalid-signals" });
    expect(validateRadarRecord({ ...record, signals: Array(65).fill("x") })).toEqual({ ok: false, reason: "invalid-signals" });
    expect(validateRadarRecord({ ...record, signals: [123] })).toEqual({ ok: false, reason: "invalid-signals" });
  });

  it("rechaza cautelas mal formadas si vienen presentes, pero las acepta si faltan (opcionales)", () => {
    expect(validateRadarRecord({ ...record, caveats: "ojo" })).toEqual({ ok: false, reason: "invalid-caveats" });
    expect(validateRadarRecord(record).ok).toBe(true); // sin `caveats` en absoluto: válido
  });

  it("un registro que no es objeto (string, null, array) se rechaza sin lanzar", () => {
    expect(validateRadarRecord(null).ok).toBe(false);
    expect(validateRadarRecord("agent").ok).toBe(false);
    expect(validateRadarRecord([1, 2, 3]).ok).toBe(false);
  });

  it("status desconocido cae a 'active' por defecto (no revienta el enum cerrado)", () => {
    const r = validateRadarRecord({ ...record, status: "algo-raro" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.record.status).toBe("active");
  });
});

describe("validateRadarSnapshot", () => {
  const snapshotBase = { schemaVersion: 1 as const, generatedAt: "2026-09-21", source: "external" };

  it("acepta un snapshot con registros válidos", () => {
    const s = validateRadarSnapshot({ ...snapshotBase, records: [record] });
    expect(s.ok).toBe(true);
    if (s.ok) expect(s.snapshot.records).toHaveLength(1);
  });

  it("rechaza schemaVersion distinto de 1", () => {
    expect(validateRadarSnapshot({ ...snapshotBase, schemaVersion: 2, records: [] }).ok).toBe(false);
  });

  it("rechaza duplicados de id dentro del mismo snapshot", () => {
    const s = validateRadarSnapshot({ ...snapshotBase, records: [record, { ...record }] });
    expect(s.ok).toBe(false);
    if (!s.ok) expect(s.reasons).toContain("duplicate:demo");
  });

  it("un registro inválido en la lista invalida todo el snapshot, con el motivo", () => {
    const s = validateRadarSnapshot({ ...snapshotBase, records: [{ ...record, area: "evil" }] });
    expect(s.ok).toBe(false);
    if (!s.ok) expect(s.reasons).toContain("invalid-enum");
  });
});

describe("diffRadarSnapshots", () => {
  const a: RadarRegistrySnapshot = { schemaVersion: 1, generatedAt: "2026-09-21", source: "a", records: [record] as never };
  it("detecta altas, cambios y bajas", () => {
    const b: RadarRegistrySnapshot = {
      schemaVersion: 1, generatedAt: "2026-09-21", source: "b",
      records: [{ ...record, description: "changed" }, { ...record, id: "new" }] as never,
    };
    expect(diffRadarSnapshots(a, b)).toMatchObject({ added: ["new"], changed: ["demo"], removed: [] });
  });

  it("detecta bajas cuando un id desaparece", () => {
    const vacio: RadarRegistrySnapshot = { schemaVersion: 1, generatedAt: "2026-09-21", source: "b", records: [] };
    expect(diffRadarSnapshots(a, vacio)).toMatchObject({ added: [], changed: [], removed: ["demo"] });
  });

  it("marca los registros en cuarentena del snapshot nuevo", () => {
    const conCuarentena: RadarRegistrySnapshot = {
      schemaVersion: 1, generatedAt: "2026-09-21", source: "b",
      records: [{ ...record, status: "quarantined" }] as never,
    };
    expect(diffRadarSnapshots(a, conCuarentena).quarantined).toEqual(["demo"]);
  });

  it("sin diferencias: los cuatro campos vienen vacíos", () => {
    expect(diffRadarSnapshots(a, a)).toEqual({ added: [], changed: [], removed: [], quarantined: [] });
  });
});

describe("activeRadarRecords", () => {
  it("no activa registros expirados", () => {
    const r = { ...record, expiresAt: "2020-01-01T00:00:00Z" };
    const s = validateRadarSnapshot({ schemaVersion: 1, generatedAt: "2026", source: "x", records: [r] });
    expect(s.ok).toBe(true);
    if (s.ok) expect(activeRadarRecords(s.snapshot, new Date("2026-01-01"))).toHaveLength(0);
  });

  it("un registro sin expiresAt nunca expira", () => {
    const s = validateRadarSnapshot({ schemaVersion: 1, generatedAt: "2026", source: "x", records: [record] });
    expect(s.ok).toBe(true);
    if (s.ok) expect(activeRadarRecords(s.snapshot, new Date("2099-01-01"))).toHaveLength(1);
  });

  it("un registro en revisión o cuarentena no cuenta como activo aunque no haya expirado", () => {
    const s = validateRadarSnapshot({
      schemaVersion: 1, generatedAt: "2026", source: "x",
      records: [{ ...record, status: "review" }, { ...record, id: "otro", status: "quarantined" }],
    });
    expect(s.ok).toBe(true);
    if (s.ok) expect(activeRadarRecords(s.snapshot)).toHaveLength(0);
  });
});
