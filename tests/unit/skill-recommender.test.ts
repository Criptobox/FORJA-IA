import { describe, expect, it } from "vitest";
import { recommendSkills, skillsPlanContext } from "@/lib/forja/skill-recommender";
import type { SkillItem } from "@/lib/forja/types";

const skill = (over: Partial<SkillItem>): SkillItem => ({
  id: over.id ?? "skill",
  name: over.name ?? "Skill",
  description: over.description ?? "",
  icon: "🧩",
  instructions: over.instructions ?? "",
  enabled: over.enabled ?? false,
  kinds: over.kinds,
});

describe("skill-recommender", () => {
  it("recomienda skills según señales del proyecto", () => {
    const skills = [
      skill({ id: "visual", name: "Visual QA", description: "revisión de UI y capturas", instructions: "analizar visual y accesibilidad", kinds: ["web"] }),
      skill({ id: "debug", name: "Debug", description: "reparación de errores", instructions: "diagnosticar bug y reparar", kinds: ["code"] }),
    ];
    const out = recommendSkills({ brief: "recrea esta captura y revisa accesibilidad", taskKind: "web", needsVisualReference: true }, skills);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].skill.name).toBe("Visual QA");
    expect(out[0].reasons.length).toBeGreaterThan(0);
  });

  it("no recomienda skills ya activadas", () => {
    const skills = [skill({ id: "visual", name: "Visual QA", description: "revisión de UI y capturas", kinds: ["web"], enabled: true })];
    const out = recommendSkills({ brief: "revisa la captura visual", taskKind: "web" }, skills);
    expect(out).toEqual([]);
  });

  it("skillsPlanContext explica que son recomendaciones, no activaciones", () => {
    const skills = [skill({ id: "visual", name: "Visual QA", description: "revisión de UI y capturas", kinds: ["web"] })];
    const out = recommendSkills({ brief: "captura visual de la web", taskKind: "web" }, skills);
    const ctx = skillsPlanContext(out);
    expect(ctx).toContain("[FORJA SKILL PLAN]");
    expect(ctx).toContain("no activaciones automáticas");
  });

  it("sin señales detectadas, el contexto lo dice explícitamente", () => {
    const ctx = skillsPlanContext(recommendSkills({ brief: "algo sin relación", taskKind: "chat" }, []));
    expect(ctx).toContain("No se detectaron skills");
  });
});
