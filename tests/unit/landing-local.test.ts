import { describe, expect, it } from "vitest";
import { esPedidoDeWeb, landingLocal, sectorDeWeb } from "../../src/lib/forja/web/landing-local";

describe("web de escritorio sin IA", () => {
  it("distingue una página web de una app", () => {
    expect(esPedidoDeWeb("Crea una página web para una pizzería")).toBe(true);
    expect(esPedidoDeWeb("hazme una landing para mi gimnasio")).toBe(true);
    expect(esPedidoDeWeb("quiero un sitio web para mi clínica")).toBe(true);
    expect(esPedidoDeWeb("hazme una app para mi cafetería")).toBe(false);
    expect(esPedidoDeWeb("¿qué es una página web?")).toBe(false);
  });
  it("reconoce el sector", () => {
    expect(sectorDeWeb("una pizzería")).toBe("comida");
    expect(sectorDeWeb("tienda de zapatos")).toBe("tienda");
    expect(sectorDeWeb("academia de inglés")).toBe("educacion");
    expect(sectorDeWeb("un dentista")).toBe("salud");
    expect(sectorDeWeb("una cosa rara")).toBe("general");
  });
  it("arma una web completa, adaptable y sin recursos externos", () => {
    const { html, sector } = landingLocal("Crea una página web para una pizzería");
    expect(sector).toBe("comida");
    for (const parte of ['<header>', 'class="hero"', 'id="catalogo"', 'id="ofertas"', 'id="opiniones"', 'class="sobre"', 'id="contacto"', "<form", "<footer>", '<meta name="viewport"', "@media (max-width:860px)", "prefers-reduced-motion", ":focus-visible"]) {
      expect(html, parte).toContain(parte);
    }
    expect(html).toContain("Reserva tu mesa");
    expect(html).toContain("Pendiente"); // no inventa teléfono ni dirección
    expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    expect(html).not.toMatch(/<script/i);
  });
  it("respeta el nombre que da la persona y no sale igual para encargos distintos", () => {
    expect(landingLocal('Crea una web para mi pizzería llamada Luigi').marca).toBe("Luigi");
    expect(landingLocal('Crea una web para «Horno Feliz»').marca).toBe("Horno Feliz");
    const a = landingLocal("web para una pizzería en el centro").html, b = landingLocal("web para una hamburguesería de barrio").html;
    expect(a).not.toBe(b);
  });
  it("cada sector tiene su formulario", () => {
    expect(landingLocal("página web para mi gimnasio").html).toContain("clase de prueba");
    expect(landingLocal("página web para una clínica dental").html).toContain("Pide tu cita");
    expect(landingLocal("web para mi agencia de viajes").html).toContain("Cuéntanos tu viaje");
  });
});
