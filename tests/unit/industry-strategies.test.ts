import { describe, expect, it } from "vitest";
import { detectIndustry } from "@/lib/forja/industry-strategies";

describe("industry strategies", () => {
  it("separa e-commerce de servicios", () => {
    expect(detectIndustry("tienda online de zapatillas").id).toBe("ecommerce");
    expect(detectIndustry("servicio local de limpieza").id).toBe("local-service");
  });
});
