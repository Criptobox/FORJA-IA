/** FORJA IA — Estudio: memoria de gustos (fase 5).
 *
 * Cuando apruebas (👍) o descartas (👎) una pantalla, Forja no guarda la
 * pantalla ni se la vuelve a mandar al modelo —eso serían miles de tokens
 * por generación—: saca del HTML unos pocos RASGOS medibles, sin modelo
 * (esquinas, sombras, degradados, densidad, titulares…). Con varios votos,
 * los rasgos que se repiten en lo aprobado y en lo descartado viajan en una
 * sola línea del pedido: «Le gusta: … Evita: …». Coste: ~50 tokens.
 *
 * Todo es determinista y se prueba solo. Los votos viven en el store del
 * Estudio (localStorage), no en el proyecto: el gusto es de la persona. */

export type Voto = "si" | "no";

export interface VotoGusto {
  rasgos: string[];
  voto: Voto;
  cuando: number;
}

/** Votos que se recuerdan (los más recientes). */
export const MAX_VOTOS = 40;
/** Votos mínimos antes de decirle nada al modelo: con uno solo no hay patrón. */
export const MIN_VOTOS = 2;
/** Techo de la línea de gustos en el pedido. */
export const LIMITE_GUSTOS = 260;

interface Rasgo {
  id: string;
  /** cómo se le dice al modelo, en pocas palabras */
  texto: string;
  /** ¿el HTML lo tiene? (css = solo los <style>, cuerpo = el marcado) */
  hay: (css: string, cuerpo: string) => boolean;
}

const px = (css: string, prop: string): number[] =>
  [...css.matchAll(new RegExp(`${prop}\\s*:\\s*([0-9.]+)(px|rem)`, "gi"))].map((m) => Number(m[1]) * (m[2] === "rem" ? 16 : 1));

export const RASGOS: readonly Rasgo[] = [
  { id: "redondeado", texto: "esquinas muy redondeadas", hay: (c) => px(c, "border-radius").some((v) => v >= 14) },
  {
    id: "recto",
    texto: "esquinas rectas",
    hay: (c) => {
      const r = px(c, "border-radius");
      return r.length > 0 && r.every((v) => v <= 4);
    },
  },
  { id: "sombras", texto: "sombras suaves y amplias", hay: (c) => /box-shadow\s*:[^;]*\b(1[6-9]|[2-9]\d)px/i.test(c) },
  { id: "degradados", texto: "degradados", hay: (c) => /(linear|radial|conic)-gradient\(/i.test(c.replace(/:root\s*\{[^}]*\}/g, "")) },
  { id: "titular-grande", texto: "titulares muy grandes", hay: (c) => px(c, "font-size").some((v) => v >= 44) || /font-size\s*:\s*clamp\([^)]*\b([4-9]\d|1\d\d)px/i.test(c) },
  { id: "aire", texto: "mucho espacio entre bloques", hay: (c) => px(c, "padding").filter((v) => v >= 32).length + px(c, "gap").filter((v) => v >= 24).length >= 3 },
  { id: "denso", texto: "interfaz densa, mucha información", hay: (c) => px(c, "font-size").filter((v) => v > 0 && v <= 13).length >= 3 },
  { id: "mayusculas", texto: "rótulos en mayúsculas", hay: (c) => /text-transform\s*:\s*uppercase/i.test(c) },
  { id: "rejilla", texto: "rejillas de tarjetas", hay: (c) => /display\s*:\s*grid/i.test(c) && /grid-template-columns/i.test(c) },
  { id: "carrusel", texto: "carruseles horizontales", hay: (c) => /scroll-snap-type|overflow-x\s*:\s*(auto|scroll)/i.test(c) },
  { id: "barra-inferior", texto: "barra de navegación inferior", hay: (c, b) => /<nav\b/i.test(b) && /position\s*:\s*fixed[^}]*bottom\s*:\s*0|bottom\s*:\s*0[^}]*position\s*:\s*fixed/i.test(c) },
  { id: "iconos", texto: "iconos SVG propios", hay: (_c, b) => (b.match(/<svg\b/gi) ?? []).length >= 3 },
  { id: "emoji", texto: "emojis como iconos", hay: (_c, b) => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(b.replace(/<[^>]+>/g, " ")) },
  { id: "imagenes", texto: "fotos o imágenes", hay: (_c, b) => /<img\b/i.test(b) },
  { id: "animacion", texto: "animaciones y efectos", hay: (c, b) => /data-fx=|@keyframes/i.test(b + c) },
];

const POR_ID = new Map(RASGOS.map((r) => [r.id, r]));

/** Rasgos que tiene una pantalla (ids). */
export function rasgosDeHtml(html: string): string[] {
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\b[^>]*>/gi)].map((m) => m[1]).join("\n") +
    "\n" + [...html.matchAll(/\bstyle\s*=\s*"([^"]*)"/gi)].map((m) => m[1]).join(";");
  const cuerpo = html.replace(/<style\b[\s\S]*?<\/style\b[^>]*>/gi, " ").replace(/<script\b[\s\S]*?<\/script\b[^>]*>/gi, " ");
  return RASGOS.filter((r) => r.hay(css, cuerpo)).map((r) => r.id);
}

/** Lo que se ha aprendido: rasgos que gustan y que se evitan, por peso. */
export function resumenGustos(votos: readonly VotoGusto[], max = 3): { gusta: string[]; evita: string[]; votos: number } {
  const recientes = [...votos].sort((a, b) => b.cuando - a.cuando).slice(0, MAX_VOTOS);
  const peso = new Map<string, number>();
  recientes.forEach((v, i) => {
    // lo reciente pesa algo más: el gusto cambia
    const w = 1 + (recientes.length - i) / recientes.length;
    for (const r of new Set(v.rasgos)) peso.set(r, (peso.get(r) ?? 0) + (v.voto === "si" ? w : -w));
  });
  const ordenados = [...peso.entries()].filter(([id]) => POR_ID.has(id));
  // hace falta aparecer en al menos dos votos del mismo signo (peso ≥ 2)
  const gusta = ordenados.filter(([, p]) => p >= 2).sort((a, b) => b[1] - a[1]).slice(0, max).map(([id]) => id);
  const evita = ordenados.filter(([, p]) => p <= -2).sort((a, b) => a[1] - b[1]).slice(0, max).map(([id]) => id);
  return { gusta, evita, votos: recientes.length };
}

export function textoRasgo(id: string): string {
  return POR_ID.get(id)?.texto ?? id;
}

/** La línea que viaja en el pedido de una pantalla nueva. Vacía si aún no
 * hay patrón. Va subordinada a la dirección: los gustos matizan, no mandan. */
export function bloqueGustos(votos: readonly VotoGusto[]): string {
  const r = resumenGustos(votos);
  if (r.votos < MIN_VOTOS || (!r.gusta.length && !r.evita.length)) return "";
  const partes = [
    r.gusta.length ? `le gusta: ${r.gusta.map(textoRasgo).join(", ")}` : "",
    r.evita.length ? `evita: ${r.evita.map(textoRasgo).join(", ")}` : "",
  ].filter(Boolean);
  const linea = `Gustos de esta persona (de pantallas que aprobó o descartó; aplícalos si encajan con la dirección) — ${partes.join("; ")}.`;
  return linea.length > LIMITE_GUSTOS ? `${linea.slice(0, LIMITE_GUSTOS - 1)}…` : linea;
}
