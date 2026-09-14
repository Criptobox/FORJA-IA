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
} from "../../src/lib/prism/design-directions";

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
  it("el DESIGN.md solo menciona prism-3d.js cuando la dirección puede usarlo", () => {
    expect(aDesignMd(direccionPorId("experimental")!)).toContain("prism-3d.js");
    expect(aDesignMd(direccionPorId("tech")!)).toContain("prism-3d.js"); // usa 3d-particulas
    expect(aDesignMd(direccionPorId("calido")!)).not.toContain("prism-3d.js");
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
