import { describe, expect, it } from "vitest";
import { detectIndustry } from "@/lib/forja/industry-strategies";

describe("industry strategies", () => {
  it("separa e-commerce de servicios", () => {
    expect(detectIndustry("tienda online de zapatillas").id).toBe("ecommerce");
    expect(detectIndustry("servicio local de limpieza").id).toBe("local-service");
  });

  it("no detecta aliases dentro de palabras no relacionadas", () => {
    expect(detectIndustry("una app para organizar tareas").id).toBe("saas");
    expect(detectIndustry("un portfolio para fotografos").id).toBe("portfolio");
    expect(detectIndustry("un sitio para una barberia").id).toBe("local-service");
    expect(detectIndustry("un blog sobre el barometro y la felicidad").id).toBe("content");
  });
});
