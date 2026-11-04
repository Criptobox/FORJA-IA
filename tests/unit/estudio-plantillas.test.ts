import { describe, expect, it } from "vitest";
import { agregarPantallas, conNuevaVersion, crearProyecto } from "../../src/lib/forja/estudio/proyecto";
import {
  conPlantilla,
  MAX_CHARS_DISENOS,
  MAX_PLANTILLAS,
  plantillaDeProyecto,
  proyectoDesdePlantilla,
  tamanoDisenos,
} from "../../src/lib/forja/estudio/plantillas";
import type { ProyectoDiseno } from "../../src/lib/forja/estudio/tipos";

function proyecto(html = "<!doctype html><html><body><h1>Inicio</h1></body></html>"): ProyectoDiseno {
  let p = crearProyecto({ brief: "App de reservas para una peluquería", tipo: "app", direccionId: "minimal" });
  p = agregarPantallas(p, [
    { nombre: "Inicio", proposito: "resumen" },
    { nombre: "Reservar", proposito: "elegir hora" },
  ]);
  p = { ...p, pantallas: p.pantallas.map((s, i) => (i === 0 ? { ...conNuevaVersion(s, { pedido: "Generada", archivos: [{ path: "index.html", text: html }], entrada: "index.html" }), skills: ["marco-app"] } : s)) };
  return p;
}

describe("estudio · plantillas", () => {
  it("guarda tipo, estilo, pantallas con propósito y patrones, y el diseño visible", () => {
    const p = proyecto();
    const t = plantillaDeProyecto(p, { nombre: "Reservas", conDisenos: true });
    expect(t).toMatchObject({ nombre: "Reservas", tipo: "app", direccionId: "minimal", conDisenos: true, briefOriginal: p.brief });
    expect(t.pantallas.map((s) => s.nombre)).toEqual(["Inicio", "Reservar"]);
    expect(t.pantallas[0].skills).toEqual(["marco-app"]);
    expect(t.pantallas[0].diseno?.archivos[0].text).toContain("<h1>Inicio</h1>");
    expect(t.pantallas[1].diseno).toBeUndefined(); // esa no estaba hecha
  });

  it("sin diseños, o si no caben, guarda solo la estructura", () => {
    expect(plantillaDeProyecto(proyecto()).pantallas.every((s) => !s.diseno)).toBe(true);
    const grande = proyecto("x".repeat(MAX_CHARS_DISENOS + 1));
    expect(tamanoDisenos(grande)).toBeGreaterThan(MAX_CHARS_DISENOS);
    const t = plantillaDeProyecto(grande, { conDisenos: true });
    expect(t.conDisenos).toBe(false);
    expect(t.pantallas.every((s) => !s.diseno)).toBe(true);
  });

  it("un proyecto desde plantilla con diseños arranca con las pantallas hechas (0 llamadas)", () => {
    const t = plantillaDeProyecto(proyecto(), { conDisenos: true });
    const n = proyectoDesdePlantilla(t, { brief: "Peluquería de Valencia" });
    expect(n.brief).toBe("Peluquería de Valencia");
    expect(n.direccionId).toBe("minimal");
    expect(n.pantallas[0]).toMatchObject({ estado: "lista", actual: 0, skills: ["marco-app"] });
    expect(n.pantallas[0].versiones[0].pedido).toBe("De plantilla");
    expect(n.pantallas[1]).toMatchObject({ estado: "vacia", actual: -1, versiones: [] });
    // ids nuevos y archivos copiados, no compartidos con la plantilla
    expect(n.id).not.toBe(t.id);
    n.pantallas[0].versiones[0].archivos[0].text = "cambiado";
    expect(t.pantallas[0].diseno?.archivos[0].text).toContain("<h1>Inicio</h1>");
  });

  it("sin diseños (o pidiendo solo la estructura) arranca vacío y sin brief usa el original", () => {
    const t = plantillaDeProyecto(proyecto(), { conDisenos: true });
    const n = proyectoDesdePlantilla(t, { brief: "  ", conDisenos: false });
    expect(n.brief).toBe(t.briefOriginal);
    expect(n.pantallas.every((s) => s.estado === "vacia" && !s.versiones.length)).toBe(true);
  });

  it("la lista guarda las más recientes primero y con tope", () => {
    let lista = [] as ReturnType<typeof conPlantilla>;
    for (let i = 0; i < MAX_PLANTILLAS + 3; i++) lista = conPlantilla(lista, plantillaDeProyecto(proyecto(), { nombre: `t${i}` }));
    expect(lista).toHaveLength(MAX_PLANTILLAS);
    expect(lista[0].nombre).toBe(`t${MAX_PLANTILLAS + 2}`);
  });
});
