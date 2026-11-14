/** FORJA IA — Cambios a una app de Tinta SIN IA.
 *
 * La idea de Tinta: crear y retocar sin gastar, y dejar la IA solo para lo
 * que de verdad la necesita. Aquí se entienden los cambios habituales escritos
 * en español y se aplican a la receta directamente:
 *
 *   «ponla en modo oscuro» · «más clara» · «en azul» · «paleta Lavanda»
 *   «letra elegante» · «fondo aurora» · «quita el fondo»
 *   «llámala Café Brisa» · «quita el buscador» · «añade un calendario»
 *   «más tarjetas» · «otra versión»
 *
 * Si no se entiende nada, devuelve null y quien llama decide (la IA, si hay
 * alguna conectada; si no, explicar qué se puede pedir). Es puro: recibe el
 * catálogo del motor y la receta, devuelve la receta nueva. */
import type { CatalogoTinta, RecetaTinta } from "./cliente";

export interface CambioLocal {
  receta: RecetaTinta;
  /** lo que se hizo, en frases cortas para el chat */
  hechos: string[];
  /** pidió otra propuesta entera: se vuelve a llamar al equipo */
  rehacer?: boolean;
}

const MAX_BLOQUES = 14;

/** minúsculas, sin tildes, espacios simples */
export function normalizar(t: string): string {
  return String(t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const contiene = (texto: string, palabra: string) => {
  const p = normalizar(palabra);
  if (p.length < 3) return false;
  return new RegExp(`(^|[^a-z0-9])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(texto);
};

function hsl(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return [0, 0, 0.5];
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

/** color dicho → tono (grados), o «gris» para los neutros */
const COLORES: [RegExp, number | "gris"][] = [
  [/\b(rojo|roja|rojos|granate|vino)\b/, 0],
  [/\b(naranja|anaranjad[oa]|mandarina|coral)\b/, 22],
  [/\b(marron|cafe|chocolate|tierra)\b/, 28],
  [/\b(amarill[oa]|dorad[oa]|mostaza|ambar)\b/, 48],
  [/\b(verde|verdes|oliva|bosque)\b/, 130],
  [/\b(turquesa|menta|aqua|aguamarina)\b/, 172],
  [/\b(azul|azules|celeste|marino|cielo)\b/, 215],
  [/\b(violeta|morad[oa]|lila|lavanda|purpura)\b/, 268],
  [/\b(rosa|rosad[oa]|fucsia|magenta)\b/, 330],
  [/\b(gris|negro|negra|grafito|blanco y negro|neutr[oa]|sobri[oa])\b/, "gris"],
];

const distanciaTono = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

function paletaPorColor(t: string, cat: CatalogoTinta, oscuro: boolean): CatalogoTinta["paletas"][number] | null {
  const c = COLORES.find(([re]) => re.test(t));
  if (!c) return null;
  const objetivo = c[1];
  let mejor: { p: CatalogoTinta["paletas"][number]; puntos: number } | null = null;
  for (const p of cat.paletas) {
    const [h, s] = hsl(p.acento);
    const fondoOscuro = hsl(p.fondo)[2] < 0.4;
    const puntos =
      (objetivo === "gris" ? s * 200 : distanciaTono(h, objetivo) + (s < 0.25 ? 120 : 0)) + (fondoOscuro === oscuro ? 0 : 25);
    if (!mejor || puntos < mejor.puntos) mejor = { p, puntos };
  }
  return mejor && (objetivo === "gris" || mejor.puntos < 70) ? mejor.p : null;
}

/** el elemento del catálogo cuyo nombre o id sale en el texto (el más largo gana) */
function porNombre<T extends { id: string; nombre: string }>(t: string, lista: T[]): T | null {
  let mejor: T | null = null;
  let largo = 0;
  for (const x of lista) {
    for (const n of [x.nombre, x.id.replace(/-/g, " ")]) {
      const nn = normalizar(n);
      if (nn.length > largo && contiene(t, nn)) {
        mejor = x;
        largo = nn.length;
      }
    }
  }
  return mejor;
}

const VACIAS = new Set(["para", "con", "una", "uno", "unos", "unas", "los", "las", "del", "que", "mas", "otro", "otra", "app", "pantalla", "seccion", "bloque", "parte"]);
const palabras = (t: string) => normalizar(t).split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !VACIAS.has(w));
/** raíz sencilla para que «calendario» encaje con «Calendario del mes» y «tarjetas» con «tarjeta» */
const raiz = (w: string) => w.replace(/(es|s)$/, "");

function bloquePorFrase(frase: string, candidatos: CatalogoTinta["bloques"]): CatalogoTinta["bloques"][number] | null {
  const pedidas = new Set(palabras(frase).map(raiz));
  if (!pedidas.size) return null;
  let mejor: { b: CatalogoTinta["bloques"][number]; n: number } | null = null;
  for (const b of candidatos) {
    const n = palabras(b.nombre).map(raiz).filter((w) => pedidas.has(w)).length;
    if (n > 0 && (!mejor || n > mejor.n)) mejor = { b, n };
  }
  return mejor?.b ?? null;
}

const RE_NOMBRE =
  /(?:ll[aá]ma a (?:la|el|mi|tu) \S+|ll[aá]mal[ao]|que se llame|se llama|ponle(?: de nombre| el nombre(?: de)?| por nombre)?|cambia(?:le)? el nombre (?:a|por)|el nombre (?:es|sea|ser[aá])|nombre:)\s+[«"']?([^«»"'.,;\n]{2,40}?)[»"']?(?=$|[.,;\n]| y )/i;

/** Aplica lo que se entienda del pedido. null si no se entiende nada. */
export function cambioLocal(pedido: string, receta: RecetaTinta, cat: CatalogoTinta): CambioLocal | null {
  const pedidoTal = String(pedido ?? "");
  if (!normalizar(pedidoTal)) return null;
  // El nombre va primero y se aparta: «llámala Café Brisa» no es pedir la paleta café.
  const mNombre = RE_NOMBRE.exec(pedidoTal);
  const nombre = mNombre?.[1]?.trim();
  const t = normalizar(mNombre ? pedidoTal.replace(mNombre[0], " ") : pedidoTal);
  const r: RecetaTinta = { ...receta, blocks: receta.blocks.map((b) => ({ ...b })), ...(receta.texts ? { texts: { ...receta.texts } } : {}) };
  const hechos: string[] = [];
  const rol = (id: string) => cat.bloques.find((b) => b.id === id)?.rol ?? "";

  if (/\b(otra (version|propuesta|opcion|idea)|otro diseno|hazla de nuevo|de cero|cambia(la)? (todo|entera)|diferente)\b/.test(t)) {
    return { receta: r, hechos: ["otra propuesta del equipo"], rehacer: true };
  }

  // modo
  if (/\b(modo oscuro|oscur[oa]|noche|nocturn[oa]|dark)\b/.test(t)) {
    hechos.push("modo oscuro");
    r.mode = "dark";
  } else if (/\b(modo claro|clar[oa]|luminos[oa]|blanc[oa]|light|de dia)\b/.test(t)) {
    hechos.push("modo claro");
    r.mode = "light";
  }

  // paleta: por nombre, si no por color
  const pal = porNombre(t, cat.paletas) ?? paletaPorColor(t, cat, r.mode === "dark");
  if (pal && pal.id !== r.palette) {
    r.palette = pal.id;
    hechos.push(`paleta «${pal.nombre}»`);
  }

  // tipografía
  if (/\b(letra|tipografia|fuente|tipo de letra|texto)\b/.test(t) || cat.tipografias.some((f) => contiene(t, f.id))) {
    const f = porNombre(t, cat.tipografias);
    if (f && f.id !== r.font) {
      r.font = f.id;
      hechos.push(`letra «${f.nombre}»`);
    }
  }

  // fondo
  if (/\b(quita|sin|elimina|borra)( el)? fondo\b/.test(t) && r.background) {
    delete r.background;
    hechos.push("sin fondo decorado");
  } else if (/\bfondo\b/.test(t)) {
    const f = porNombre(t, cat.fondos);
    if (f && f.id !== r.background) {
      r.background = f.id;
      hechos.push(`fondo «${f.nombre}»`);
    }
  }

  // nombre de la app (va en la cabecera)
  if (nombre) {
    const cab = r.blocks.find((b) => rol(b.id) === "header");
    if (cab) {
      const prev = r.texts?.[cab.id] ?? [];
      r.texts = { ...(r.texts ?? {}), [cab.id]: [nombre, ...prev.slice(1)] };
      hechos.push(`nombre «${nombre}»`);
    }
  }

  // quitar piezas
  const quitar = /\b(?:quita|quitale|elimina|borra|saca|sin)\s+(?:el|la|los|las|un|una)?\s*([a-z0-9 ]{3,40})/.exec(t);
  if (quitar && !/\bfondo\b/.test(quitar[1])) {
    const actuales = r.blocks.map((b) => cat.bloques.find((x) => x.id === b.id)).filter((x): x is CatalogoTinta["bloques"][number] => !!x);
    const b = bloquePorFrase(quitar[1], actuales.filter((x) => x.rol !== "header" && x.rol !== "nav"));
    const tarjetas = r.blocks.filter((x) => rol(x.id) === "cards").length;
    if (b && !(b.rol === "cards" && tarjetas <= 1)) {
      r.blocks = r.blocks.filter((x) => x.id !== b.id);
      hechos.push(`fuera «${b.nombre}»`);
    }
  }

  // añadir piezas
  const anadir = /\b(?:anade|anadele|agrega|agregale|pon|ponle|mete|incluye|suma)\s+(?:un|una|el|la|unos|unas)?\s*([a-z0-9 ]{3,40})/.exec(t);
  if (anadir && r.blocks.length < MAX_BLOQUES) {
    const ya = new Set(r.blocks.map((b) => b.id));
    const b = bloquePorFrase(anadir[1], cat.bloques.filter((x) => !ya.has(x.id) && x.rol !== "header" && x.rol !== "nav"));
    if (b) {
      const nav = r.blocks.findIndex((x) => rol(x.id) === "nav");
      r.blocks.splice(nav >= 0 ? nav : r.blocks.length, 0, { id: b.id });
      hechos.push(`nueva pieza «${b.nombre}»`);
    }
  }

  // más o menos tarjetas
  const tarjeta = r.blocks.find((b) => rol(b.id) === "cards");
  if (tarjeta && /\b(mas|otra) (tarjetas?|productos?|opciones|elementos)\b/.test(t)) {
    const n = Math.min(6, (tarjeta.repeat ?? 1) + 1);
    if (n !== (tarjeta.repeat ?? 1)) {
      tarjeta.repeat = n;
      hechos.push(`${n} tarjetas`);
    }
  } else if (tarjeta && /\bmenos (tarjetas?|productos?|opciones|elementos)\b/.test(t)) {
    const n = Math.max(1, (tarjeta.repeat ?? 1) - 1);
    if (n === 1) delete tarjeta.repeat;
    else tarjeta.repeat = n;
    hechos.push(`${n} ${n === 1 ? "tarjeta" : "tarjetas"}`);
  }

  return hechos.length ? { receta: r, hechos } : null;
}

/** Plantilla que devuelve el equipo → receta (mismos campos). */
export function recetaDePlantilla(p: unknown, idea: string): RecetaTinta | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  if (!Array.isArray(o.blocks)) return null;
  const blocks = (o.blocks as unknown[])
    .map((b) => (b && typeof b === "object" ? (b as { id?: unknown; repeat?: unknown }) : null))
    .filter((b): b is { id: string; repeat?: number } => !!b && typeof b.id === "string")
    .map((b) => (typeof b.repeat === "number" && b.repeat > 1 ? { id: b.id, repeat: b.repeat } : { id: b.id }));
  if (!blocks.length) return null;
  const str = (k: string) => (typeof o[k] === "string" && o[k] ? (o[k] as string) : undefined);
  const r: RecetaTinta = { brief: str("brief") ?? idea.slice(0, 200), blocks };
  if (str("palette")) r.palette = str("palette");
  if (str("font")) r.font = str("font");
  if (str("background")) r.background = str("background");
  if (o.mode === "dark" || o.mode === "light") r.mode = o.mode;
  if (o.texts && typeof o.texts === "object") r.texts = o.texts as Record<string, string[]>;
  if (str("sector")) r.sector = str("sector");
  return r;
}

/** Lo que se le puede pedir sin IA, para cuando no se entendió el cambio. */
export const AYUDA_SIN_IA =
  "Sin IA conectada entiendo cambios como: «modo oscuro», «en azul», «paleta Lavanda», «letra elegante», «fondo aurora», «llámala Café Brisa», «quita el buscador», «añade un calendario», «más tarjetas» u «otra versión». Para pedir cualquier otra cosa con tus palabras, conecta una IA gratis en Ajustes ▸ Proveedores.";
