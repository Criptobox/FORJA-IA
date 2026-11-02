/** FORJA IA — Estudio de diseño: del texto del modelo a una pantalla pintable.
 *
 * Reutiliza el embudo de la vista previa del chat (`answer-files.ts`):
 * nombra los bloques de código, expande los iconos y empaqueta CSS/JS
 * hermanos dentro del HTML. El kit de efectos no se guarda (es constante):
 * se añade al pintar. */

import { bundlePreview, filesFromAnswer, type AnswerFile } from "../answer-files";
import { faltanDelKit, FX3D_JS_PATH, FX_CSS_PATH, FX_JS_PATH } from "../efectos";
import { pickEntryPath } from "../sandbox";
import type { DireccionVisual } from "../design-directions";
import { asegurarTokens } from "./tokens";
import type { ArchivoPantalla, VersionPantalla } from "./tipos";

const KIT = new Set([FX_CSS_PATH, FX_JS_PATH, FX3D_JS_PATH]);

export interface PantallaExtraida {
  archivos: ArchivoPantalla[];
  entrada: string;
}

/** Saca la pantalla de una respuesta completa. `null` si no hay HTML. */
export function extraerPantalla(respuesta: string): PantallaExtraida | null {
  const archivos = filesFromAnswer(respuesta)
    .filter((f) => !KIT.has(f.path))
    .map((f) => ({ path: f.path, text: f.text }));
  const entrada = pickEntryPath(archivos.map((f) => f.path));
  if (entrada) return { archivos, entrada };
  // Sin cerca de código: algunos modelos sueltan el documento a pelo.
  const i = respuesta.search(/<!doctype html|<html[\s>]/i);
  if (i >= 0) return { archivos: [{ path: "index.html", text: respuesta.slice(i).trim() }], entrada: "index.html" };
  return null;
}

/** HTML que se lleva escrito durante el streaming (para pintar en vivo). */
export function htmlParcial(texto: string): string {
  const cerca = texto.match(/```html?[^\n]*\n([\s\S]*)/i);
  if (cerca) return cerca[1].replace(/```[\s\S]*$/, "");
  const i = texto.search(/<!doctype html|<html[\s>]/i);
  return i >= 0 ? texto.slice(i) : "";
}

/** HTML autónomo de una versión: con su CSS/JS dentro, el kit y los tokens. */
export function htmlDeVersion(v: Pick<VersionPantalla, "archivos" | "entrada">, d: DireccionVisual): string {
  const entrada = v.archivos.find((f) => f.path === v.entrada);
  if (!entrada) return "";
  const archivos: AnswerFile[] = v.archivos.map((f) => ({ ...f, inferido: false }));
  for (const k of faltanDelKit(
    archivos.map((f) => f.path),
    archivos.map((f) => f.text)
  )) {
    archivos.push({ ...k, inferido: true });
  }
  return asegurarTokens(bundlePreview(entrada.text, archivos), d);
}

/** El código que se le pasa al modelo para editar: el HTML de entrada tal
 * cual lo escribió (sin el kit, que son miles de caracteres repetidos). */
export function codigoParaEditar(v: Pick<VersionPantalla, "archivos" | "entrada">, limite = 40_000): string {
  const partes = v.archivos.map((f) => (v.archivos.length > 1 ? `/* ${f.path} */\n${f.text}` : f.text));
  const todo = partes.join("\n\n");
  return todo.length > limite ? `${todo.slice(0, limite)}\n<!-- …recortado: el archivo sigue -->` : todo;
}
