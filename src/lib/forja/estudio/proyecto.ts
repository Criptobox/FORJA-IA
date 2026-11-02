/** FORJA IA — Estudio de diseño: operaciones puras sobre un proyecto.
 *
 * Nada de React ni almacenamiento: cada función recibe un proyecto y devuelve
 * otro nuevo (inmutable), así el store solo guarda y estas se prueban solas. */

import { DIRECCIONES, direccionPorId, elegirDireccion } from "../design-directions";
import type {
  Pantalla,
  PantallaPlan,
  ProyectoDiseno,
  TipoProyecto,
  VersionPantalla,
} from "./tipos";

/** Versiones que se conservan por pantalla. localStorage no es infinito y
 * cinco pasos atrás bastan para «vuelve a como estaba». */
export const MAX_VERSIONES = 5;

let contador = 0;
export function idEstudio(prefijo: string): string {
  contador = (contador + 1) % 1_000_000;
  return `${prefijo}-${Date.now().toString(36)}-${contador.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export interface NuevoProyecto {
  nombre?: string;
  brief: string;
  tipo: TipoProyecto;
  /** dirección elegida por el usuario; sin ella se elige del encargo */
  direccionId?: string | null;
  /** direcciones usadas en proyectos recientes, para no repetir */
  evitar?: readonly string[];
}

/** Nombre corto a partir del encargo, si el usuario no puso ninguno. */
export function nombreDesdeBrief(brief: string): string {
  const limpio = brief
    .replace(/\s+/g, " ")
    .replace(/^(crea|haz|diseña|disena|quiero|necesito|hazme|genera)\s+(me\s+)?(una?|el|la|los|las)?\s*/i, "")
    .trim();
  const corto = limpio.split(/[.,;:\n]/)[0].slice(0, 48).trim();
  return corto ? corto.charAt(0).toUpperCase() + corto.slice(1) : "Proyecto sin nombre";
}

export function crearProyecto(n: NuevoProyecto, ahora = Date.now()): ProyectoDiseno {
  const direccion =
    (n.direccionId && direccionPorId(n.direccionId)) ||
    elegirDireccion(n.brief, n.evitar ?? []).direccion;
  return {
    id: idEstudio("proy"),
    nombre: (n.nombre ?? "").trim() || nombreDesdeBrief(n.brief),
    brief: n.brief.trim(),
    tipo: n.tipo,
    direccionId: direccion.id,
    creado: ahora,
    actualizado: ahora,
    pantallas: [],
  };
}

export function nuevaPantalla(p: PantallaPlan): Pantalla {
  return {
    id: idEstudio("pant"),
    nombre: p.nombre.trim() || "Pantalla",
    proposito: p.proposito.trim(),
    versiones: [],
    actual: -1,
    estado: "vacia",
  };
}

function tocar(p: ProyectoDiseno, cambios: Partial<ProyectoDiseno>, ahora = Date.now()): ProyectoDiseno {
  return { ...p, ...cambios, actualizado: ahora };
}

export function agregarPantallas(p: ProyectoDiseno, planes: PantallaPlan[]): ProyectoDiseno {
  return tocar(p, { pantallas: [...p.pantallas, ...planes.map(nuevaPantalla)] });
}

export function actualizarPantalla(
  p: ProyectoDiseno,
  pantallaId: string,
  cambio: (s: Pantalla) => Pantalla
): ProyectoDiseno {
  if (!p.pantallas.some((s) => s.id === pantallaId)) return p;
  return tocar(p, { pantallas: p.pantallas.map((s) => (s.id === pantallaId ? cambio(s) : s)) });
}

export function eliminarPantalla(p: ProyectoDiseno, pantallaId: string): ProyectoDiseno {
  return tocar(p, { pantallas: p.pantallas.filter((s) => s.id !== pantallaId) });
}

/** Mueve una pantalla una posición (−1 arriba, +1 abajo). */
export function moverPantalla(p: ProyectoDiseno, pantallaId: string, delta: -1 | 1): ProyectoDiseno {
  const i = p.pantallas.findIndex((s) => s.id === pantallaId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= p.pantallas.length) return p;
  const lista = [...p.pantallas];
  [lista[i], lista[j]] = [lista[j], lista[i]];
  return tocar(p, { pantallas: lista });
}

/** Añade una versión y la deja como actual; recorta las más viejas. */
export function conNuevaVersion(s: Pantalla, v: Omit<VersionPantalla, "id" | "creada">, ahora = Date.now()): Pantalla {
  const version: VersionPantalla = { ...v, id: idEstudio("ver"), creada: ahora };
  const versiones = [...s.versiones, version].slice(-MAX_VERSIONES);
  return { ...s, versiones, actual: versiones.length - 1, estado: "lista", error: undefined };
}

export function versionActual(s: Pantalla): VersionPantalla | null {
  if (!s.versiones.length) return null;
  const i = s.actual >= 0 && s.actual < s.versiones.length ? s.actual : s.versiones.length - 1;
  return s.versiones[i];
}

export function elegirVersion(s: Pantalla, indice: number): Pantalla {
  if (indice < 0 || indice >= s.versiones.length) return s;
  return { ...s, actual: indice };
}

export function cambiarDireccion(p: ProyectoDiseno, direccionId: string): ProyectoDiseno {
  if (!direccionPorId(direccionId)) return p;
  return tocar(p, { direccionId });
}

/** La dirección del proyecto, o la primera si el id dejó de existir. */
export function direccionDe(p: Pick<ProyectoDiseno, "direccionId">) {
  return direccionPorId(p.direccionId) ?? DIRECCIONES[0];
}

/** «Pantalla de inicio» → «pantalla-de-inicio» (para nombres de archivo). */
export function slug(texto: string): string {
  return (
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "pantalla"
  );
}
