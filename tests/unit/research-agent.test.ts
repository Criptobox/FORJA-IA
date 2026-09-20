import { describe, expect, it } from "vitest";
import { research } from "@/lib/forja/research-agent";
import type { KBResource } from "@/lib/forja/kb-index";

const resource: KBResource = {
  id: "1", name: "Dashboard oscuro", mimeType: "image/png", sizeBytes: 10,
  accountEmail: "demo@example.com", webViewLink: "https://drive.google.com/file/1",
  category: "ui", tags: ["dashboard", "oscuro"], technology: "React", license: "MIT",
  status: "clasificado", indexedAt: "2026-09-20T00:00:00.000Z",
};

describe("research agent", () => {
  it("usa la Knowledge Base y no necesita web cuando hay evidencia suficiente", async () => {
    const result = await research("dashboard oscuro React", [resource], { allowWeb: true });
    expect(result.usedKnowledgeBase).toBe(true);
    expect(result.usedWeb).toBe(false);
    expect(result.sources[0]?.kind).toBe("knowledge-base");
    expect(result.context).toContain("Dashboard oscuro");
  });
});
