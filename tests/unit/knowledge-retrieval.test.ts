import { describe, expect, it } from "vitest";
import { retrieveKB, kbContext } from "@/lib/forja/knowledge-retrieval";
import type { KBResource } from "@/lib/forja/kb-index";

function recurso(overrides: Partial<KBResource>): KBResource {
  return {
    id: overrides.id ?? "r1",
    name: "recurso",
    mimeType: "image/png",
    sizeBytes: 1024,
    accountEmail: "cuenta@example.com",
    webViewLink: "https://drive.example.com/r1",
    category: "componentes",
    tags: [],
    technology: "react",
    license: "propia",
    status: "clasificado",
    indexedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Recuperación selectiva de Knowledge Base", () => {
  it("prioriza coincidencias de categoría, tecnología y tags sobre el resto", () => {
    const exacto = recurso({ id: "exacto", name: "hero minimal", category: "hero", technology: "react", tags: ["landing"] });
    const parcial = recurso({ id: "parcial", name: "footer generico", category: "footer", technology: "vue", tags: [] });
    const sinRelacion = recurso({ id: "sin-relacion", name: "logo cliente", category: "branding", technology: "figma", tags: [] });

    const resultados = retrieveKB(
      { text: "hero landing", category: "hero", technology: "react", tags: ["landing"] },
      [sinRelacion, parcial, exacto]
    );

    expect(resultados[0]?.resource.id).toBe("exacto");
    expect(resultados.some((r) => r.resource.id === "sin-relacion")).toBe(false);
  });

  it("no devuelve nada cuando ningún recurso aporta señal", () => {
    const resultados = retrieveKB({ text: "algo muy especifico" }, [recurso({ id: "otro", name: "irrelevante" })]);
    expect(resultados).toEqual([]);
  });

  it("recorta el número de resultados a `limit`", () => {
    const recursos = Array.from({ length: 5 }, (_, i) => recurso({ id: `r${i}`, name: `componente boton ${i}` }));
    const resultados = retrieveKB({ text: "boton", limit: 2 }, recursos);
    expect(resultados.length).toBeLessThanOrEqual(2);
  });

  it("kbContext no supera el tope de caracteres y respeta el orden recibido", () => {
    const resultados = retrieveKB({ text: "componente boton" }, [
      recurso({ id: "a", name: "boton primario" }),
      recurso({ id: "b", name: "boton secundario" }),
    ]);
    const contexto = kbContext(resultados, 60);
    expect(contexto.startsWith("[FORJA KNOWLEDGE RETRIEVAL]")).toBe(true);
    expect(contexto.length).toBeLessThanOrEqual(60);
  });
});
