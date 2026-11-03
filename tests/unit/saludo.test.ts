import { describe, expect, it } from "vitest";
import { saludoPorHora } from "../../src/components/forja/welcome";

describe("bienvenida · saludo por hora", () => {
  it("mañana, tarde y noche, con los bordes", () => {
    expect(saludoPorHora(5)).toBe("Buenas noches");
    expect(saludoPorHora(6)).toBe("Buenos días");
    expect(saludoPorHora(13)).toBe("Buenos días");
    expect(saludoPorHora(14)).toBe("Buenas tardes");
    expect(saludoPorHora(20)).toBe("Buenas tardes");
    expect(saludoPorHora(21)).toBe("Buenas noches");
    expect(saludoPorHora(0)).toBe("Buenas noches");
  });
});
