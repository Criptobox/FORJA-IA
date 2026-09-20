import { describe, expect, it } from "vitest";
import { buildDesignArchitecture } from "@/lib/forja/design-architect";

describe("Design Architect", () => {
  it("produce decisiones antes del código", () => {
    const a = buildDesignArchitecture({ brief: "portfolio de fotógrafo" });
    expect(a.industry.id).toBe("portfolio");
    expect(a.layoutPrinciples.length).toBeGreaterThan(3);
    expect(a.responsiveRules.join(" ")).toContain("320");
  });
});
