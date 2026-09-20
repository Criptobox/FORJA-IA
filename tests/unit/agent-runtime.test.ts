import { describe, expect, it } from "vitest";
import { advanceAgentRun, buildAgentRuntimePrompt, buildAgentSequence, createAgentRun } from "@/lib/forja/agent-runtime";

describe("Forja Agent Runtime", () => {
  it("define la secuencia especializada", () => {
    expect(buildAgentSequence({ task: "crear una tienda", maxIterations: 1 })).toEqual([
      "planner", "designer", "coder", "browser", "qa",
    ]);
  });

  it("añade reparación y nueva QA cuando hay iteración", () => {
    expect(buildAgentSequence({ task: "crear una tienda", maxIterations: 2 })).toEqual([
      "planner", "designer", "coder", "browser", "qa", "repair", "qa",
    ]);
  });

  it("no marca el trabajo terminado antes del último agente", () => {
    let run = createAgentRun({ task: "crear una tienda", maxIterations: 1 });
    run = advanceAgentRun(run, "planner", ["plan creado"]);
    expect(run.status).toBe("running");
    expect(run.active).toBe("designer");
    expect(run.handoffs[0].evidence).toEqual(["plan creado"]);
  });

  it("produce un contrato claro para el Cerebro", () => {
    const prompt = buildAgentRuntimePrompt({ task: "landing de restaurante", maxIterations: 2 });
    expect(prompt).toContain("Planner");
    expect(prompt).toContain("Coder edita directamente");
    expect(prompt).toContain("Repair corrige directamente");
  });

  it("no muta el run recibido: cada avance es un objeto nuevo", () => {
    const run = createAgentRun({ task: "crear una tienda", maxIterations: 1 });
    const before = [...run.completed];
    advanceAgentRun(run, "planner", ["plan creado"]);
    expect(run.completed).toEqual(before);
    expect(run.status).toBe("pending");
  });

  it("completa el ciclo repair → qa en vez de quedarse atascado entre ambos", () => {
    // Con `maxIterations: 2` la secuencia repite "qa" dos veces
    // (`... qa, repair, qa`). Resolver la posición con
    // `sequence.indexOf(agent)` siempre encuentra la PRIMERA "qa": al cerrar
    // el ciclo de reparación, el QA final calcularía su "siguiente" a partir
    // de ese primer índice (osea "repair" otra vez) y el run nunca llegaría
    // a "completed".
    let run = createAgentRun({ task: "crear una tienda", maxIterations: 2 });
    run = advanceAgentRun(run, "planner", ["plan"]);
    run = advanceAgentRun(run, "designer", ["arquitectura"]);
    run = advanceAgentRun(run, "coder", ["código"]);
    run = advanceAgentRun(run, "browser", ["consola limpia"]);
    run = advanceAgentRun(run, "qa", ["hallazgo pendiente"]);
    expect(run.active).toBe("repair");
    run = advanceAgentRun(run, "repair", ["corrección aplicada"]);
    expect(run.active).toBe("qa");
    run = advanceAgentRun(run, "qa", ["verificado sin hallazgos"]);
    expect(run.status).toBe("completed");
  });
});
