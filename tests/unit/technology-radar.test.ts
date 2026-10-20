import { describe, expect, it } from "vitest";
import {
  listTechnologyRadar,
  getTechnologyRadarEntry,
  recommendRadarTools,
  technologyRadarContext,
  mergeTechnologyRadarEntries,
  type RadarArea,
  type TechnologyRadarEntry,
} from "@/lib/forja/technology-radar";

const ALL_AREAS: RadarArea[] = [
  "agents", "rag", "embeddings", "reranking", "evaluation", "observability",
  "routing", "context", "structured-output", "security", "local-inference", "data",
];

describe("listTechnologyRadar", () => {
  it("cubre las 12 categorías anunciadas: ninguna se queda sin candidatos", () => {
    // Encontrado durante la integración: el catálogo original declaraba
    // "observability" como área válida (y el anuncio de la fase la incluye:
    // "📊 Observabilidad") pero no traía ningún candidato real para ella.
    const areasConCandidato = new Set(listTechnologyRadar().map((e) => e.area));
    for (const area of ALL_AREAS) expect(areasConCandidato.has(area)).toBe(true);
  });

  it("devuelve copias defensivas: mutar el resultado no toca el catálogo interno", () => {
    const first = listTechnologyRadar();
    first[0].signals.push("hackeado");
    const second = listTechnologyRadar();
    expect(second[0].signals).not.toContain("hackeado");
  });
});

describe("getTechnologyRadarEntry", () => {
  it("encuentra una entrada conocida por id", () => {
    expect(getTechnologyRadarEntry("ollama")?.name).toBe("Ollama");
  });

  it("undefined para un id que no existe", () => {
    expect(getTechnologyRadarEntry("no-existe")).toBeUndefined();
  });
});

describe("recommendRadarTools", () => {
  it("puntúa por señales del brief", () => {
    const matches = recommendRadarTools({ brief: "necesito RAG con recuperación de documentos" });
    expect(matches.some((m) => m.id === "llamaindex" || m.id === "haystack")).toBe(true);
    expect(matches[0].score).toBeGreaterThan(0);
    expect(matches[0].reasons.length).toBeGreaterThan(0);
  });

  it("respeta el filtro de áreas", () => {
    const matches = recommendRadarTools({ brief: "rag local inference offline model", areas: ["local-inference"] });
    expect(matches.every((m) => m.area === "local-inference")).toBe(true);
  });

  it("respeta localOnly", () => {
    const matches = recommendRadarTools({ brief: "necesito observability tracing logs", localOnly: true });
    expect(matches.every((m) => m.localFriendly)).toBe(true);
  });

  it("encuentra el candidato de observabilidad con sus propias señales", () => {
    const matches = recommendRadarTools({ brief: "necesito tracing y logs para poder debug de mis agentes" });
    expect(matches.some((m) => m.area === "observability")).toBe(true);
  });

  it("respeta el límite (limit)", () => {
    const matches = recommendRadarTools({ brief: "rag agent embeddings evaluation routing local offline", limit: 2 });
    expect(matches.length).toBeLessThanOrEqual(2);
  });

  it("sin ninguna señal en el brief: no devuelve nada por relleno", () => {
    const matches = recommendRadarTools({ brief: "xyz sin relación alguna" });
    expect(matches).toHaveLength(0);
  });
});

describe("mergeTechnologyRadarEntries (V28)", () => {
  const externa: TechnologyRadarEntry = {
    id: "externa-nueva", name: "Externa Nueva", area: "agents", description: "candidata externa",
    license: "MIT", maturity: "candidate", integration: "reference", localFriendly: true,
    costProfile: "free-open-source", signals: ["externa"],
  };

  it("agrega una entrada externa nueva al catálogo", () => {
    const merged = mergeTechnologyRadarEntries([externa]);
    expect(merged.some((e) => e.id === "externa-nueva")).toBe(true);
    expect(merged.length).toBe(listTechnologyRadar().length + 1);
  });

  it("una entrada externa con el mismo id que una propia NO la reemplaza", () => {
    const suplantacion: TechnologyRadarEntry = { ...externa, id: "ollama", name: "Ollama Falso" };
    const merged = mergeTechnologyRadarEntries([suplantacion]);
    expect(merged.find((e) => e.id === "ollama")?.name).toBe("Ollama");
  });

  it("descarta entradas externas sin los campos mínimos, sin lanzar", () => {
    const incompleta = { ...externa, id: "", name: "" } as TechnologyRadarEntry;
    const merged = mergeTechnologyRadarEntries([incompleta]);
    expect(merged.length).toBe(listTechnologyRadar().length);
  });

  it("no muta el catálogo interno: llamarlo dos veces no acumula duplicados", () => {
    mergeTechnologyRadarEntries([externa]);
    const merged = mergeTechnologyRadarEntries([externa]);
    expect(merged.filter((e) => e.id === "externa-nueva")).toHaveLength(1);
  });
});

describe("technologyRadarContext", () => {
  it("sin candidatos: mensaje explícito, no una lista vacía muda", () => {
    const context = technologyRadarContext([]);
    expect(context).toContain("[FORJA TECHNOLOGY RADAR]");
    expect(context).toContain("No se detectaron");
  });

  it("con candidatos: incluye nombre, área y aviso de que no son instalaciones", () => {
    const matches = recommendRadarTools({ brief: "necesito ollama para inferencia local offline" });
    const context = technologyRadarContext(matches);
    expect(context).toContain("Ollama");
    expect(context).toContain("no son instalaciones");
  });
});
