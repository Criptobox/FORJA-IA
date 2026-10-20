import { describe, it, expect } from "vitest";
import {
  contratoCompacto,
  direccionDelProyecto,
  idDeDiseno,
  idsRecientes,
  pideCambioDeEstilo,
} from "../../src/lib/forja/contrato-diseno";
import { DIRECCIONES, direccionPorId, promptDireccion } from "../../src/lib/forja/design-directions";
import {
  aArchivosForja,
  addDiseno,
  deArchivosForja,
  MEMORIA_VACIA,
} from "../../src/lib/forja/memoria-proyecto";

const usado = (direccion: string) => ({ id: "x", direccion, resumen: "", creadoEl: 0 });

describe("contrato de diseño", () => {
  it("lee la dirección tanto por id como por nombre (memorias antiguas)", () => {
    expect(idDeDiseno(usado("editorial"))).toBe("editorial");
    expect(idDeDiseno(usado("Editorial de revista"))).toBe("editorial");
    expect(idDeDiseno(usado("referencia adjunta"))).toBeNull();
  });

  it("la rotación recibe ids, no nombres", () => {
    expect(idsRecientes([usado("Editorial de revista"), usado("minimal"), usado("referencia adjunta")])).toEqual([
      "editorial",
      "minimal",
    ]);
  });

  it("la fijada es la última del catálogo, saltando lo que no lo es", () => {
    expect(direccionDelProyecto([usado("referencia adjunta"), usado("calido")])?.id).toBe("calido");
    expect(direccionDelProyecto([])).toBeNull();
  });

  it("solo una petición expresa rompe el contrato", () => {
    expect(pideCambioDeEstilo("quiero otro estilo más oscuro")).toBe(true);
    expect(pideCambioDeEstilo("rediseña la web desde cero")).toBe(true);
    expect(pideCambioDeEstilo("cambia el botón a verde")).toBe(false);
  });

  it("el contrato compacto es mucho más corto que el bloque completo y lleva los tokens", () => {
    for (const d of DIRECCIONES) {
      const c = contratoCompacto(d);
      expect(c).toContain(d.paleta.acento);
      expect(c).toContain(d.fuentes.display);
      expect(c.length).toBeLessThan(promptDireccion({ direccion: d, origen: "proyecto" }).length / 4);
    }
  });

  it("addDiseno no apila la misma dirección dos veces seguidas", () => {
    let m = addDiseno(MEMORIA_VACIA, "Editorial de revista", "a", 1);
    m = addDiseno(m, "Editorial de revista", "b", 2);
    expect(m.disenos).toHaveLength(1);
  });

  it(".forja/DESIGN.md sale en el export y se recupera al importar sin el JSON", () => {
    const m = addDiseno(MEMORIA_VACIA, direccionPorId("calido")!.nombre, "r", 1);
    const archivos = aArchivosForja(m);
    expect(archivos[".forja/DESIGN.md"]).toContain("(calido)");
    const soloMd = { ".forja/DESIGN.md": archivos[".forja/DESIGN.md"] };
    expect(direccionDelProyecto(deArchivosForja(soloMd).disenos)?.id).toBe("calido");
  });
});
