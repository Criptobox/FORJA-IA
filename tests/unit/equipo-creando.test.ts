import { describe, expect, it } from "vitest";
import { AGENTES_EQUIPO, agentesDelPaso } from "../../src/components/forja/equipo-creando";

describe("equipo de agentes del panel «Creando…»", () => {
  it("son los ocho del equipo de Tinta", () => {
    expect(AGENTES_EQUIPO.map((a) => a.id)).toEqual(["research", "architect", "ux", "ui", "writer", "a11y", "dev", "critic"]);
  });
  it("cada paso real tiene agentes y todos existen", () => {
    for (const paso of ["encargo", "modelo", "pensando", "escribiendo", "entrega", "desconocido"]) {
      const a = agentesDelPaso(paso);
      expect(a.length).toBeGreaterThan(0);
      a.forEach((i) => expect(AGENTES_EQUIPO[i]).toBeTruthy());
    }
    expect(agentesDelPaso("entrega")).toEqual([7]);
  });
});
