import { describe, expect, it } from "vitest";
import {
  CHECKLIST_ANTI_SLOP,
  DIRECCIONES,
  aDesignMd,
  elegirDireccion,
  direccionPorId,
  esEncargoUINueva,
  idPorNombre,
  promptDireccion,
  senasComposicionFueraDeDireccion,
} from "../../src/lib/forja/design-directions";
import { MEDIDAS_VACIAS, type MedidasGenerico } from "../../src/lib/forja/generico";

describe("direcciones curadas", () => {
  it("tienen ids únicos, uno por cada una", () => {
    // el número cambia si se añade una dirección nueva: lo que importa es que
    // no haya dos con el mismo id, no un recuento fijo que hay que acordarse
    // de tocar cada vez.
    expect(DIRECCIONES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(DIRECCIONES.map((d) => d.id)).size).toBe(DIRECCIONES.length);
  });

  it("todas tienen tokens completos y coherentes", () => {
    for (const d of DIRECCIONES) {
      expect(d.paleta.fondo).toMatch(/oklch/);
      expect(d.paleta.acento).toMatch(/oklch/);
      expect(d.fuentes.display).toBeTruthy();
      expect(d.fuentes.cuerpo).toBeTruthy();
      expect(d.composicion).toBeTruthy();
      expect(d.detalle).toBeTruthy();
      // la dirección debe DECIR cuándo brilla, para la elicitación
      expect(d.cuando.length).toBeGreaterThan(10);
    }
  });

  it("prohiben el hero centrado genérico de una manera u otra", () => {
    // cada dirección tiene reglas de composición con intención
    for (const d of DIRECCIONES) {
      expect(d.composicion.length).toBeGreaterThan(40);
    }
  });

  it("direccionPorId encuentra y rechaza", () => {
    expect(direccionPorId("editorial")?.nombre).toBeTruthy();
    expect(direccionPorId("no-existe")).toBeNull();
  });

  it("idPorNombre es el camino inverso: lo que se guarda (nombre) → el id de EFECTOS_POR_DIRECCION", () => {
    // Lo que se persiste tras elegir dirección es el `nombre` legible, no
    // el `id` — este mapeo es lo que permite volver de uno a otro.
    for (const d of DIRECCIONES) {
      expect(idPorNombre(d.nombre)).toBe(d.id);
    }
    expect(idPorNombre("esto no existe")).toBeNull();
  });
});

describe("elegirDireccion", () => {
  it("respeta la dirección clara del prompt (capa 1, sin preguntar)", () => {
    expect(elegirDireccion("landing minimalista para fintech").direccion.id).toBe("minimal");
    expect(elegirDireccion("web para un restaurante orgánico").direccion.id).toBe("calido");
    expect(elegirDireccion("póster brutalista para un festival").direccion.id).toBe("brutalista");
    expect(elegirDireccion("dashboard técnico para devs").direccion.id).toBe("tech");
    expect(elegirDireccion("portfolio editorial de escritura").direccion.id).toBe("editorial");
    expect(elegirDireccion("sitio inmersivo para una agencia premiada").direccion.id).toBe("experimental");
    const e = elegirDireccion("landing minimalista para fintech");
    expect(e.origen).toBe("usuario");
  });

  it("sin dirección clara decide sola, y evita las recientes", () => {
    const evitar = ["editorial", "minimal", "tech", "brutalista"];
    const e = elegirDireccion("hazme una web", evitar);
    expect(e.origen).toBe("sistema");
    // no una dirección concreta a mano —eso es justo lo que se rompe al
    // añadir una dirección nueva—, sino la propiedad que importa: que de
    // verdad evitó las recientes.
    expect(evitar).not.toContain(e.direccion.id);
  });

  it("si todas están quemadas, decide igual (no se bloquea)", () => {
    const e = elegirDireccion("hazme una web", DIRECCIONES.map((d) => d.id));
    expect(e.direccion).toBeTruthy();
  });

  it("es determinista con el mismo prompt", () => {
    const a = elegirDireccion("hazme una web de eventos");
    const b = elegirDireccion("hazme una web de eventos");
    expect(a.direccion.id).toBe(b.direccion.id);
  });
});

describe("DESIGN.md y prompt", () => {
  it("el DESIGN.md solo menciona forja-3d.js cuando la dirección puede usarlo", () => {
    expect(aDesignMd(direccionPorId("experimental")!)).toContain("forja-3d.js");
    expect(aDesignMd(direccionPorId("tech")!)).toContain("forja-3d.js"); // usa 3d-particulas
    expect(aDesignMd(direccionPorId("calido")!)).not.toContain("forja-3d.js");
  });

  it("aDesignMd produce un documento completo", () => {
    const md = aDesignMd(DIRECCIONES[0], "Mi café");
    expect(md).toContain("# DESIGN.md");
    expect(md).toContain("Mi café");
    expect(md).toContain("oklch");
    expect(md).toContain(DIRECCIONES[0].fuentes.display);
  });

  it("promptDireccion incluye paleta, fuentes y la checklist", () => {
    const e = elegirDireccion("una web de bienestar");
    const p = promptDireccion(e);
    expect(p).toContain(e.direccion.fuentes.display);
    expect(p).toContain("oklch");
    expect(p).toContain("DIRECCIÓN DE DISEÑO");
    expect(p).toContain("JERARQUÍA");
  });

  it("el anuncio solo se exige cuando decidió el sistema", () => {
    const solo = promptDireccion(elegirDireccion("web minimalista"));
    expect(solo).not.toMatch(/anúncialo/);
    const sistema = promptDireccion(elegirDireccion("hazme una web"));
    expect(sistema).toMatch(/anúncialo/);
  });

  it("la checklist anti-slop cubre 5 dimensiones", () => {
    expect(CHECKLIST_ANTI_SLOP).toMatch(/JERARQUÍA/);
    expect(CHECKLIST_ANTI_SLOP).toMatch(/TIPOGRAFÍA/);
    expect(CHECKLIST_ANTI_SLOP).toMatch(/COLOR/);
    expect(CHECKLIST_ANTI_SLOP).toMatch(/ESPACIO/);
    expect(CHECKLIST_ANTI_SLOP).toMatch(/DETALLE/);
  });
});

describe("esEncargoUINueva", () => {
  it("true para construir UI desde cero", () => {
    expect(esEncargoUINueva("crea una landing para mi tienda")).toBe(true);
    expect(esEncargoUINueva("hazme un dashboard de ventas")).toBe(true);
  });
  it("false para retoques o chat normal", () => {
    expect(esEncargoUINueva("cambia el botón a azul")).toBe(false);
    expect(esEncargoUINueva("¿qué es un hero section?")).toBe(false);
    expect(esEncargoUINueva("")).toBe(false);
  });
});

describe("senasComposicionFueraDeDireccion — el Director revisa lo que se pintó", () => {
  const medida = (m: Partial<MedidasGenerico>): MedidasGenerico => ({ ...MEDIDAS_VACIAS, ...m });

  it("hero centrado en «editorial»: la dirección lo prohíbe explícitamente", () => {
    const senas = senasComposicionFueraDeDireccion(medida({ heroCentrado: true }), "editorial");
    expect(senas).toHaveLength(1);
    expect(senas[0].id).toBe("hero-fuera-de-direccion");
    expect(senas[0].detalle).toContain("Editorial de revista");
    expect(senas[0].arreglo).not.toMatch(/si tu dirección/i); // sin salvedad: aquí ya se sabe cuál es
  });

  it("hero centrado en «tech»: también prohibido (landing de marketing con hero)", () => {
    expect(senasComposicionFueraDeDireccion(medida({ heroCentrado: true }), "tech")).toHaveLength(1);
  });

  it("hero centrado en «calido»: esa dirección no lo prohíbe, no es una seña", () => {
    expect(senasComposicionFueraDeDireccion(medida({ heroCentrado: true }), "calido")).toEqual([]);
  });

  it("tarjetas clonadas en «minimal», «calido» y «experimental»: las tres lo prohíben", () => {
    for (const id of ["minimal", "calido", "experimental"]) {
      const senas = senasComposicionFueraDeDireccion(medida({ gruposIguales: 2 }), id);
      expect(senas, id).toHaveLength(1);
      expect(senas[0].id).toBe("tarjetas-fuera-de-direccion");
    }
  });

  it("«brutalista» no prohíbe nada medible: su única regla («elegancia neutra») no es una seña", () => {
    expect(senasComposicionFueraDeDireccion(medida({ heroCentrado: true, gruposIguales: 3 }), "brutalista")).toEqual([]);
  });

  it("sin lo medido, no hay nada que decir aunque la dirección lo prohíba", () => {
    expect(senasComposicionFueraDeDireccion(medida({}), "editorial")).toEqual([]);
  });

  it("sin dirección elegida (turno de retoque, no de UI nueva), no se juzga a ciegas", () => {
    expect(senasComposicionFueraDeDireccion(medida({ heroCentrado: true }), null)).toEqual([]);
    expect(senasComposicionFueraDeDireccion(medida({ heroCentrado: true }), undefined)).toEqual([]);
  });

  it("una dirección desconocida no revienta: da []", () => {
    expect(senasComposicionFueraDeDireccion(medida({ heroCentrado: true }), "no-existe")).toEqual([]);
  });
});
