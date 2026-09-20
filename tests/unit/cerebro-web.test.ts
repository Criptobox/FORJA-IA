import { describe, expect, it } from "vitest";
import { buildCerebroPlan } from "@/lib/forja/cerebro-web";

describe("Cerebro Web", () => {
  it("detecta la industria y evita la plantilla universal", () => {
    const plan = buildCerebroPlan({
      task: "create-web",
      brief: "una pizzeria artesanal con pedidos online y menú",
      hasExistingProject: true,
    });
    expect(plan.architecture.industry.id).toBe("restaurant");
    expect(plan.architecture.forbiddenPatterns.join(" ")).toContain("tres cards");
    expect(plan.stages).toContain("visual-qa");
    expect(plan.stages).toContain("repair");
  });

  it("mantiene el prompt compacto y orientado a decisiones", () => {
    const plan = buildCerebroPlan({
      task: "create-web",
      brief: "una plataforma SaaS para equipos",
    });
    expect(plan.prompt).toContain("[FORJA CEREBRO WEB");
    expect(plan.prompt).toContain("[FORJA DESIGN ARCHITECT]");
    expect(plan.prompt).toContain("INDUSTRIA: saas");
  });
});
