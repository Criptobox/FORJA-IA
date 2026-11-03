/** FORJA IA — Estudio de diseño: la Biblioteca (lógica pura).
 *
 * Referencias = imágenes que guían el diseño: inspiración subida, pantallas
 * propias guardadas o archivos de Drive. Al modelo le llegan de dos formas:
 *   1. siempre como TEXTO (nombre + paleta en hex): sirve a cualquier modelo;
 *   2. como IMAGEN adjunta si el modelo ve, con las instrucciones de
 *      `referencia-visual.ts` (leerla como sistema visual, no copiarla). */

import { instruccionReferencia } from "../referencia-visual";
import type { Referencia } from "./tipos";

/** Colores dominantes de unos píxeles RGBA (un `ImageData.data`).
 * Agrupa en cubos de 4 bits por canal, cuenta, y se queda con los `n` más
 * frecuentes que se distingan entre sí (distancia mínima en RGB). Ignora
 * los transparentes. Pura: se prueba sin canvas. */
export function paletaDePixeles(data: ArrayLike<number>, n = 5, distanciaMinima = 90): string[] {
  // por cubo: [cuántos, suma R, suma G, suma B] — el color que se devuelve es
  // la media real de sus píxeles, no el centro del cubo (#ff0000 sigue
  // siendo #ff0000, no #f80808)
  const cubos = new Map<number, [number, number, number, number]>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const k = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const c = cubos.get(k);
    if (c) {
      c[0]++;
      c[1] += data[i];
      c[2] += data[i + 1];
      c[3] += data[i + 2];
    } else cubos.set(k, [1, data[i], data[i + 1], data[i + 2]]);
  }
  const elegidos: [number, number, number][] = [];
  for (const [cuantos, r, g, b] of [...cubos.values()].sort((a, b) => b[0] - a[0])) {
    const rgb: [number, number, number] = [Math.round(r / cuantos), Math.round(g / cuantos), Math.round(b / cuantos)];
    const lejos = elegidos.every((e) => Math.abs(e[0] - rgb[0]) + Math.abs(e[1] - rgb[1]) + Math.abs(e[2] - rgb[2]) > distanciaMinima);
    if (lejos) elegidos.push(rgb);
    if (elegidos.length >= n) break;
  }
  return elegidos.map((c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join(""));
}

/** Nombre legible a partir de un nombre de archivo. */
export function nombreDeArchivo(archivo: string): string {
  const base = archivo.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[-_]+/g, " ").trim();
  return (base || "Referencia").slice(0, 48);
}

/** Bloque del system prompt con las referencias elegidas.
 * `conImagenes`: cuántas viajan adjuntas (0 si el modelo no las verá). */
export function bloqueReferencias(refs: Pick<Referencia, "nombre" | "paleta">[], conImagenes: number): string {
  if (!refs.length) return "";
  return [
    "## Referencias visuales del usuario (guían el estilo de TODAS las pantallas)",
    ...refs.map((r) => `- «${r.nombre}»${r.paleta.length ? `: paleta ${r.paleta.join(", ")}` : ""}`),
    "Usa sus colores dominantes para afinar los tokens del sistema de diseño (mantén los nombres de las variables) y su carácter visual para la composición.",
    conImagenes > 0 ? "\n" + instruccionReferencia(conImagenes) : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Las referencias de un proyecto que siguen existiendo en la Biblioteca. */
export function referenciasDe(ids: readonly string[] | undefined, biblioteca: readonly Referencia[]): Referencia[] {
  if (!ids?.length) return [];
  const porId = new Map(biblioteca.map((r) => [r.id, r]));
  return ids.map((id) => porId.get(id)).filter((r): r is Referencia => !!r);
}
