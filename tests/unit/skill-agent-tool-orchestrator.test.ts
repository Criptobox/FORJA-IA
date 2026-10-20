import { describe, expect, it, beforeEach } from "vitest";
import { buildForjaOrchestration, orchestrationContext, orchestrationKBQuery } from "@/lib/forja/skill-agent-tool-orchestrator";
import { buildForjaRecipe, saveForjaRecipe } from "@/lib/forja/recipe-builder";
import type { KBSmartResult } from "@/lib/forja/kb-smart-retrieval";

const hit = (id: string, component: string): KBSmartResult => ({
  resource: { id, name: `${component}.tsx`, mimeType: "text/tsx", sizeBytes: 10, accountEmail: "MEGA", webViewLink: "", category: "codigo", tags: [], technology: "React", license: "MIT", status: "clasificado", indexedAt: new Date().toISOString(), sourceProvider: "mega", sourceKind: "mega", relativePath: `shop/${component}.tsx` },
  score: 20, reasons: [`componente:${component}`], matchedComponent: component, matchedProject: "shop-ui", matchedPath: `shop/${component}.tsx`,
});

function stubLocalStorage() {
  const mem = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => { mem.set(k, v); },
      removeItem: (k: string) => mem.delete(k),
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, "window", { value: { dispatchEvent: () => true }, configurable: true });
}

describe("skill-agent-tool-orchestrator", () => {
  it("builds a bounded agent plan with dependencies", () => {
    const plan = buildForjaOrchestration({ brief: "crear una tienda React con captura visual", needsVisualReference: true });
    // La secuencia completa por defecto repite "qa" tras "repair" (7 pasos):
    // `DEFAULT_BUDGET.maxIterations` es 2, así que `buildAgentSequence`
    // siempre activa el ciclo de reparación salvo que se pida menos.
    expect(plan.agents.map((a) => a.agent)).toEqual(["planner", "designer", "coder", "browser", "qa", "repair", "qa"]);
    expect(plan.agents.find((a) => a.agent === "coder")?.dependsOn).toContain("designer");
    expect(plan.budget.maxContextChars).toBeGreaterThan(0);
  });

  it("no trunca por defecto el QA final que verifica la reparación", () => {
    // Un fallback fijo de 6 (los seis roles distintos, sin contar la
    // repetición de "qa") cortaba siempre el último paso de la secuencia
    // real de 7, contradiciendo el propio gate del orquestador: "Si QA
    // falla, devolver el trabajo a Repair y después repetir QA dentro del
    // presupuesto". El plan real que usa `cerebro-web.ts` (sin `maxAgents`
    // explícito) debe terminar en "qa", no en "repair".
    const plan = buildForjaOrchestration({ brief: "crear una landing" });
    expect(plan.agents.at(-1)?.agent).toBe("qa");
    expect(plan.agents.map((a) => a.agent)).toContain("repair");
  });

  it("never promotes demoted recipes", () => {
    const plan = buildForjaOrchestration({ brief: "tienda" });
    expect(plan.recipes.every((recipe) => recipe.confidence >= 0)).toBe(true);
  });

  it("creates compact context and a KB query", () => {
    const plan = buildForjaOrchestration({ brief: "dashboard React" });
    const context = orchestrationContext(plan);
    const query = orchestrationKBQuery(plan);
    expect(context).toContain("[FORJA ORCHESTRATOR V24]");
    expect(query.codeFirst).toBe(true);
    expect(query.text).toBe("dashboard React");
  });

  describe("technology radar (V27)", () => {
    it("incluye candidatos del radar cuando el brief trae señales", () => {
      const plan = buildForjaOrchestration({ brief: "necesito RAG con recuperación de documentos" });
      expect(plan.technologyRadar.length).toBeGreaterThan(0);
      expect(orchestrationContext(plan)).toContain("Radar tecnológico:");
    });

    it("sin señales de radar en el brief: plan vacío de radar, no ausente", () => {
      const plan = buildForjaOrchestration({ brief: "tienda" });
      expect(plan.technologyRadar).toEqual([]);
      expect(orchestrationContext(plan)).toContain("Radar tecnológico: ningún candidato.");
    });

    it("respeta radarAreas y maxRadarTools", () => {
      const plan = buildForjaOrchestration({
        brief: "rag agent embeddings evaluation routing local offline",
        radarAreas: ["rag"],
        maxRadarTools: 1,
      });
      expect(plan.technologyRadar).toHaveLength(1);
      expect(plan.technologyRadar[0].area).toBe("rag");
    });
  });

  describe("pool de recetas (localStorage)", () => {
    beforeEach(() => stubLocalStorage());

    it("no descarta una receta reutilizable por estrechar el pool de búsqueda con maxRecipes", () => {
      // Cuatro recetas empatan en score (mismo brief, mismos campos). Solo
      // "d" pasó el quality gate ("approved"); a/b/c nunca se evaluaron.
      // Se guardan en orden a,b,c,d con `unshift`, así que el orden final
      // en el almacén es [a, b, c, d] — "d" queda fuera de los primeros 3.
      // Si el pool de búsqueda se limitara a `maxRecipes` (3) ANTES de
      // filtrar por `recipeCanBeReused`, "d" nunca se consideraría y el
      // resultado quedaría vacío pese a existir una receta reutilizable real.
      const make = (id: string) => buildForjaRecipe({ text: "tienda ProductCard" }, [hit(id, "ProductCard")]);
      const d = { ...make("d"), qualityStatus: "approved" as const };
      const c = make("c");
      const b = make("b");
      const a = make("a");
      saveForjaRecipe(d);
      saveForjaRecipe(c);
      saveForjaRecipe(b);
      saveForjaRecipe(a);

      const plan = buildForjaOrchestration({ brief: "tienda ProductCard", maxRecipes: 3 });
      expect(plan.recipes.map((r) => r.id)).toContain(d.id);
    });
  });
});
