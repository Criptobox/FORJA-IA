import { describe, expect, it } from "vitest";
import { buildRepairPlan } from "@/lib/forja/repair-agent";

describe("Repair Agent", () => {
  it("prioriza fallos de layout y no propone archivos de parche", () => {
    const plan = buildRepairPlan([
      { tipo: "scroll", detalle: "overflow horizontal a 390px" },
      { tipo: "sin-alt", detalle: "imagen sin alt" },
    ]);
    expect(plan.actions[0]?.priority).toBe("critical");
    expect(plan.stopCondition).toContain("Visual QA");
  });
});
