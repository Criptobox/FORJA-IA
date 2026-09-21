/** Forja IA — Dynamic Technology Radar registry (V28).
 * External catalogs are data only: validated, diffed and quarantined before use.
 */
import type { TechnologyRadarEntry } from "./technology-radar";

export interface RadarRegistryRecord extends TechnologyRadarEntry {
  sourceUrl: string;
  sourceVersion?: string;
  checkedAt: string;
  expiresAt?: string;
  status: "active" | "review" | "expired" | "quarantined";
  provenanceHash: string;
}

export interface RadarRegistrySnapshot {
  schemaVersion: 1;
  generatedAt: string;
  source: string;
  records: RadarRegistryRecord[];
}

export interface RadarRegistryDiff {
  added: string[];
  changed: string[];
  removed: string[];
  quarantined: string[];
}

const VALID_AREAS = new Set(["agents", "rag", "embeddings", "reranking", "evaluation", "observability", "routing", "context", "structured-output", "security", "local-inference", "data"]);
const VALID_MATURITY = new Set(["experimental", "candidate", "established"]);
const VALID_INTEGRATION = new Set(["native", "adapter", "reference"]);
const VALID_COST = new Set(["free-open-source", "mixed", "paid-service"]);

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

export function validateRadarRecord(input: unknown): { ok: true; record: RadarRegistryRecord } | { ok: false; reason: string } {
  if (!input || typeof input !== "object") return { ok: false, reason: "record-not-object" };
  const r = input as Record<string, unknown>;
  const required = ["id", "name", "area", "description", "license", "maturity", "integration", "costProfile", "sourceUrl", "checkedAt", "provenanceHash"];
  if (required.some((key) => !text(r[key]))) return { ok: false, reason: "missing-required-field" };
  if (!VALID_AREAS.has(text(r.area)) || !VALID_MATURITY.has(text(r.maturity)) || !VALID_INTEGRATION.has(text(r.integration)) || !VALID_COST.has(text(r.costProfile))) return { ok: false, reason: "invalid-enum" };
  if (!Array.isArray(r.signals) || r.signals.length > 64 || r.signals.some((x) => !text(x))) return { ok: false, reason: "invalid-signals" };
  if (r.caveats !== undefined && (!Array.isArray(r.caveats) || r.caveats.length > 32 || r.caveats.some((x) => !text(x)))) return { ok: false, reason: "invalid-caveats" };
  try { new URL(text(r.sourceUrl)); new Date(text(r.checkedAt)).toISOString(); } catch { return { ok: false, reason: "invalid-source-or-date" }; }
  return { ok: true, record: {
    id: text(r.id), name: text(r.name), area: r.area as TechnologyRadarEntry["area"], description: text(r.description), license: text(r.license),
    maturity: r.maturity as TechnologyRadarEntry["maturity"], integration: r.integration as TechnologyRadarEntry["integration"], localFriendly: Boolean(r.localFriendly),
    costProfile: r.costProfile as TechnologyRadarEntry["costProfile"], signals: (r.signals as unknown[]).map(text), caveats: Array.isArray(r.caveats) ? (r.caveats as unknown[]).map(text) : undefined,
    source: text(r.source) || "external-registry", sourceUrl: text(r.sourceUrl), sourceVersion: text(r.sourceVersion) || undefined,
    checkedAt: new Date(text(r.checkedAt)).toISOString(), expiresAt: text(r.expiresAt) || undefined, status: r.status === "quarantined" ? "quarantined" : r.status === "review" ? "review" : r.status === "expired" ? "expired" : "active", provenanceHash: text(r.provenanceHash),
  }};
}

export function validateRadarSnapshot(input: unknown): { ok: true; snapshot: RadarRegistrySnapshot } | { ok: false; reasons: string[] } {
  if (!input || typeof input !== "object") return { ok: false, reasons: ["snapshot-not-object"] };
  const r = input as Record<string, unknown>;
  if (r.schemaVersion !== 1 || !Array.isArray(r.records)) return { ok: false, reasons: ["invalid-snapshot-schema"] };
  const records: RadarRegistryRecord[] = [];
  const reasons: string[] = [];
  const ids = new Set<string>();
  for (const item of r.records) {
    const result = validateRadarRecord(item);
    if (!result.ok) { reasons.push(result.reason); continue; }
    if (ids.has(result.record.id)) { reasons.push(`duplicate:${result.record.id}`); continue; }
    ids.add(result.record.id); records.push(result.record);
  }
  return reasons.length ? { ok: false, reasons } : { ok: true, snapshot: { schemaVersion: 1, generatedAt: text(r.generatedAt), source: text(r.source), records } };
}

export function diffRadarSnapshots(previous: RadarRegistrySnapshot, next: RadarRegistrySnapshot): RadarRegistryDiff {
  const oldMap = new Map(previous.records.map((r) => [r.id, r]));
  const newMap = new Map(next.records.map((r) => [r.id, r]));
  const added: string[] = [], changed: string[] = [], removed: string[] = [], quarantined: string[] = [];
  for (const [id, record] of newMap) {
    if (record.status === "quarantined") quarantined.push(id);
    const old = oldMap.get(id);
    if (!old) added.push(id);
    else if (JSON.stringify(old) !== JSON.stringify(record)) changed.push(id);
  }
  for (const id of oldMap.keys()) if (!newMap.has(id)) removed.push(id);
  return { added, changed, removed, quarantined };
}

export function activeRadarRecords(snapshot: RadarRegistrySnapshot, now = new Date()): RadarRegistryRecord[] {
  return snapshot.records.filter((r) => {
    if (r.status !== "active") return false;
    if (r.expiresAt && new Date(r.expiresAt).getTime() <= now.getTime()) return false;
    return true;
  });
}
