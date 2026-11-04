/** FORJA IA — Estudio: guardar un proyecto como plantilla y empezar de una.
 *
 * Una plantilla es la ESTRUCTURA de un proyecto que salió bien: tipo (app o
 * web), dirección visual, la lista de pantallas con su propósito y sus
 * patrones (skills) y, si se quiere, el diseño actual de cada una.
 *
 * Por qué ahorra tokens:
 *  · empezar de una plantilla se salta la llamada de «Planificar pantallas»;
 *  · con los diseños incluidos, el proyecto nuevo arranca con sus pantallas
 *    ya hechas: cero llamadas hasta que pidas un cambio (que es barato:
 *    `pedidoIterar` sobre lo que ya hay).
 *
 * Todo puro y serializable (vive en localStorage junto a los proyectos). */

import { idEstudio, MAX_VERSIONES } from "./proyecto";
import type { ArchivoPantalla, Pantalla, ProyectoDiseno, TipoProyecto } from "./tipos";

/** Plantillas que se guardan (las más recientes). */
export const MAX_PLANTILLAS = 12;
/** Techo de lo que puede ocupar una plantilla con diseños (≈ caracteres de
 * HTML). Por encima, se guarda sin diseños: localStorage no es infinito. */
export const MAX_CHARS_DISENOS = 400_000;

export interface PantallaPlantilla {
  nombre: string;
  proposito: string;
  skills?: string[];
  /** el diseño de la versión que se veía al guardar (opcional) */
  diseno?: { archivos: ArchivoPantalla[]; entrada: string };
}

export interface PlantillaDiseno {
  id: string;
  nombre: string;
  creada: number;
  tipo: TipoProyecto;
  direccionId: string;
  /** el encargo original, como pista para el nuevo */
  briefOriginal: string;
  pantallas: PantallaPlantilla[];
  conDisenos: boolean;
}

function versionVisible(s: Pantalla) {
  if (!s.versiones.length) return null;
  const i = s.actual >= 0 && s.actual < s.versiones.length ? s.actual : s.versiones.length - 1;
  return s.versiones[i];
}

/** Tamaño (caracteres) de los diseños de un proyecto. */
export function tamanoDisenos(p: ProyectoDiseno): number {
  return p.pantallas.reduce((n, s) => n + (versionVisible(s)?.archivos.reduce((m, f) => m + f.text.length, 0) ?? 0), 0);
}

/** La plantilla de un proyecto. Con `conDisenos`, copia la versión que se ve
 * de cada pantalla, salvo que el total pase de `MAX_CHARS_DISENOS`. */
export function plantillaDeProyecto(
  p: ProyectoDiseno,
  opts: { nombre?: string; conDisenos?: boolean } = {},
  ahora = Date.now()
): PlantillaDiseno {
  const conDisenos = !!opts.conDisenos && tamanoDisenos(p) <= MAX_CHARS_DISENOS;
  return {
    id: idEstudio("plt"),
    nombre: (opts.nombre ?? "").trim() || p.nombre,
    creada: ahora,
    tipo: p.tipo,
    direccionId: p.direccionId,
    briefOriginal: p.brief,
    conDisenos,
    pantallas: p.pantallas.map((s) => {
      const v = conDisenos ? versionVisible(s) : null;
      return {
        nombre: s.nombre,
        proposito: s.proposito,
        ...(s.skills ? { skills: [...s.skills] } : {}),
        ...(v ? { diseno: { archivos: v.archivos.map((f) => ({ ...f })), entrada: v.entrada } } : {}),
      };
    }),
  };
}

/** Un proyecto nuevo a partir de una plantilla. Con `conDisenos`, cada
 * pantalla arranca con el diseño guardado como versión 1 («De plantilla»);
 * sin él, vacía y lista para generar con el brief nuevo. */
export function proyectoDesdePlantilla(
  t: PlantillaDiseno,
  opts: { brief: string; nombre?: string; conDisenos?: boolean },
  ahora = Date.now()
): ProyectoDiseno {
  const usarDisenos = opts.conDisenos !== false && t.conDisenos;
  const brief = opts.brief.trim() || t.briefOriginal;
  return {
    id: idEstudio("proy"),
    nombre: (opts.nombre ?? "").trim() || t.nombre,
    brief,
    tipo: t.tipo,
    direccionId: t.direccionId,
    creado: ahora,
    actualizado: ahora,
    referencias: [],
    pantallas: t.pantallas.map((s) => {
      const diseno = usarDisenos ? s.diseno : undefined;
      return {
        id: idEstudio("pant"),
        nombre: s.nombre,
        proposito: s.proposito,
        ...(s.skills ? { skills: [...s.skills] } : {}),
        versiones: diseno
          ? [{ id: idEstudio("ver"), creada: ahora, pedido: "De plantilla", archivos: diseno.archivos.map((f) => ({ ...f })), entrada: diseno.entrada }].slice(0, MAX_VERSIONES)
          : [],
        actual: diseno ? 0 : -1,
        estado: diseno ? ("lista" as const) : ("vacia" as const),
      };
    }),
  };
}

/** Añade una plantilla a la lista (la más reciente primero, con tope). */
export function conPlantilla(lista: readonly PlantillaDiseno[], t: PlantillaDiseno): PlantillaDiseno[] {
  return [t, ...lista.filter((x) => x.id !== t.id)].slice(0, MAX_PLANTILLAS);
}
