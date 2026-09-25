/** Forja IA — El motor creativo, dentro del chat.
 *
 * El motor (`./motor/`) sabía cosas que el chat no: decidir el CONTENIDO de
 * una página (qué secciones, con cuántas piezas, qué datos del encargo hay
 * que usar tal cual), dar un juego de iconos SVG coherente en vez de emojis,
 * y auditar la página terminada CONTRA ese plano. Todo determinista y sin
 * llamadas. Solo lo usaba el Estudio (/forja); el chat —donde se hacen las
 * páginas de verdad— improvisaba hero + tres tarjetas + CTA.
 *
 * Aquí se conectan las tres piezas al chat, en el turno en que se CREA una
 * página (no en un retoque, ni en el Modo App: sus pantallas no son las
 * secciones de una landing):
 *   1. `piezaPlanoContenido` → el plano y la iconografía viajan en el prompt.
 *   2. `revisionDeDetalle` → tras generar, la página se audita contra el
 *      MISMO plano (se recalcula del mismo encargo: es determinista) y, si
 *      falta algo crítico, se pide una reparación quirúrgica por el mismo
 *      bucle que ya corrige errores de consola.
 */
import { esEncargoUINueva } from "./design-directions";
import { esEncargoDeApp } from "./modo-app";
import { construirPlanoContenido, nivelDeDetalle, seccionPlanoContenido, type NivelDetalle, type PlanoContenido } from "./motor/plano-contenido";
import { elegirIconos, iconoPorId } from "./motor/iconos";
import { auditarDetalle, seccionReparacionDetalle, type InformeDetalle } from "./motor/qa-detalle";

/** Iconos que viajan en el prompt: bastan para una página, y cada SVG son
 *  ~250 caracteres. */
const MAX_ICONOS_PROMPT = 8;

/** Una página más corta que esto no se audita contra el plano: no es una
 *  landing a medias, es otra cosa (un componente, una prueba, un fragmento).
 *  Un modelo que genera una página de verdad pasa de largo este umbral. */
export const MIN_HTML_AUDITABLE = 2_000;

/** ¿Este encargo crea una página a la que se le aplica el plano? */
export function aplicaPlanoContenido(brief: string): boolean {
  const t = brief ?? "";
  return esEncargoUINueva(t) && !esEncargoDeApp(t);
}

/** El nivel del motor, con techo en «produccion»: «showcase» pide
 *  1.100-1.800 líneas, que un modelo gratuito corta a medias. Quien lo quiera
 *  tiene el Estudio. */
function nivelChat(brief: string): NivelDetalle {
  const n = nivelDeDetalle(brief);
  return n === "showcase" ? "produccion" : n;
}

/** El plano del encargo. Determinista: el mismo brief da el mismo plano. */
export function planoDelEncargo(brief: string): PlanoContenido {
  return construirPlanoContenido(brief, { nivel: nivelChat(brief) });
}

/** Iconografía por REFERENCIA: el modelo escribe `<i data-icono="id"></i>` y
 *  Forja pone el SVG real al pintar (`expandirIconos`, en `answer-files.ts`).
 *  Antes viajaban los SVG enteros (~3.000 caracteres) y el modelo los copiaba
 *  en su respuesta, pagando otra vez cada icono como salida. */
function seccionIconos(brief: string): string {
  const ids = elegirIconos(brief, MAX_ICONOS_PROMPT).iconos.slice(0, MAX_ICONOS_PROMPT);
  const lista = ids
    .map((id) => {
      const def = iconoPorId(id);
      return def ? `\`${id}\` (${def.uso})` : "";
    })
    .filter(Boolean);
  if (!lista.length) return "";
  return [
    "# ICONOS (del motor: úsalos en vez de emojis)",
    'Escribe SOLO la marca, no el SVG: `<i data-icono="ID"></i>`. Forja la sustituye por el SVG y añade su CSS. Admite `class` (p. ej. `f-ico--acento`, o dentro de `<span class="f-ico-caja">`) y `aria-label` si el icono comunica algo por sí solo.',
    `IDs disponibles: ${lista.join(" · ")}.`,
  ].join("\n");
}

/** La pieza del prompt: plano de contenido + iconos. null si no aplica. */
export function piezaPlanoContenido(brief: string): { texto: string; resumen: string } | null {
  if (!aplicaPlanoContenido(brief)) return null;
  const plano = planoDelEncargo(brief);
  const texto = [seccionPlanoContenido(plano), seccionIconos(brief)].filter(Boolean).join("\n\n");
  return { texto, resumen: `${plano.secciones.length} secciones · detalle ${plano.nivel}` };
}

/** Auditoría de la página terminada contra el plano de su encargo. Devuelve
 *  el encargo de reparación solo si hay algo CRÍTICO (los avisos no gastan
 *  una llamada). */
export function revisionDeDetalle(
  html: string,
  brief: string
): { informe: InformeDetalle; reparacion: string | null } | null {
  if (!aplicaPlanoContenido(brief) || (html ?? "").length < MIN_HTML_AUDITABLE) return null;
  const plano = planoDelEncargo(brief);
  const informe = auditarDetalle(html, plano);
  const criticos = informe.hallazgos.filter((h) => h.gravedad === "critico");
  return { informe, reparacion: criticos.length ? seccionReparacionDetalle(informe, plano) : null };
}

/** Frase corta para el aviso en pantalla. */
export function resumenRevisionDetalle(informe: InformeDetalle): string {
  const criticos = informe.hallazgos.filter((h) => h.gravedad === "critico");
  const titulos = criticos.slice(0, 2).map((h) => h.titulo.toLowerCase());
  return `Detalle ${informe.puntuacion}/100: ${titulos.join("; ")}${criticos.length > 2 ? "…" : ""}.`;
}
