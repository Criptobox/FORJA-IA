import { describe, expect, it } from "vitest";
import { buildKBCorpusManifest, renderKBCorpusManifest } from "@/lib/forja/kb-corpus";

const resource = (overrides: Record<string, unknown> = {}) => ({
  id: "1", name: "Hero", mimeType: "image/png", sizeBytes: 100,
  accountEmail: "a@example.com", webViewLink: "", category: "ui",
  tags: ["hero"], technology: "React", license: "MIT", status: "clasificado",
  indexedAt: new Date().toISOString(), sourceKind: "upload", ...overrides,
}) as never;

describe("KB corpus manifest", () => {
  it("resume el corpus sin cargar contenido", () => {
    const manifest = buildKBCorpusManifest([resource(), resource({ id: "2", mimeType: "text/plain", sizeBytes: 50, category: "code", status: "revision-duplicado" })]);
    expect(manifest.total).toBe(2);
    expect(manifest.totalBytes).toBe(150);
    expect(manifest.imageResources).toBe(1);
    expect(manifest.textResources).toBe(1);
    expect(manifest.visualReviewCount).toBe(1);
    expect(renderKBCorpusManifest(manifest)).toContain("Recursos: 2");
  });
});
