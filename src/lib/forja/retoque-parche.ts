/** Forja IA — Retoques por parche en el chat (Plan Maestro 2026 §63, Sprint 5).
 *
 * «Cambia el color del botón» sobre una página de 20.000 caracteres hacía que
 * el modelo la REESCRIBIERA entera: 20.000 caracteres de salida —el token más
 * caro y el más lento en un modelo gratis— para cambiar una línea. Y cada
 * reescritura es una ocasión de que se cuele un cambio que nadie pidió.
 *
 * El agente ya editaba por parches (`apply_patch`). El chat no. Ahora, en un
 * RETOQUE (nivel L2, `nivel-contexto.ts`) sobre archivos que ya existen en la
 * conversación, se pide la respuesta en bloques SEARCH/REPLACE bajo el nombre
 * del archivo, y aquí se aplican sobre la última versión de cada archivo. El
 * archivo completo resultante se añade a la respuesta localmente —sin gastar
 * un token— para que la vista previa, el ZIP y el historial sigan viendo
 * archivos enteros como siempre.
 *
 * ——— Seguridad (§22: si falla, ROLLBACK) ———
 *
 * Un archivo solo se da por parcheado si TODOS sus bloques aplican limpio. Si
 * alguno falla, ese archivo no se toca (la versión anterior sigue siendo la
 * buena) y quien llama pide al modelo el archivo completo. Nunca se deja un
 * archivo a medio parchear.
 *
 * Funciones puras: se prueban sin navegador.
 */
import { aplicarParches, pareceParche, parsearParches, type FalloParche } from "./patch";
import { bloquesConNombre } from "./answer-files";

/** Por debajo de esto un archivo es tan corto que reescribirlo cuesta poco
 *  y el formato de parche no compensa el riesgo de que el modelo lo falle. */
export const MIN_CHARS_PARCHE = 1_500;

export const INSTRUCCION_PARCHE = `## RETOQUE POR PARCHE (obligatorio en este turno)
Esto es un cambio sobre archivos que YA existen. NO reescribas archivos completos. Para cada archivo que cambies, escribe su nombre en una línea y debajo uno o más bloques así:

**index.html**
<<<<<<< SEARCH
[fragmento EXACTO del archivo actual, copiado tal cual, con unas líneas de contexto para que sea único]
=======
[el mismo fragmento ya cambiado]
>>>>>>> REPLACE

Reglas: el SEARCH se copia literal de la última versión del archivo; tiene que aparecer una sola vez; solo el trozo que cambia más el contexto justo; varios bloques si hay varios cambios. Fuera de los bloques, una frase como mucho sobre qué cambiaste.`;

export interface EntradaUsaParches {
  /** nivel de contexto del turno (`nivel-contexto.ts`) */
  nivel: number;
  /** modo agente o FORJA WEB: el agente ya edita con sus herramientas
   *  (`edit_file`, `apply_patch`) y esta instrucción le haría competencia */
  agente: boolean;
  /** tamaño de la versión vigente de cada archivo del proyecto */
  archivos: ReadonlyMap<string, { text: string }>;
}

/** ¿Este turno se pide como parche? Solo retoques sobre archivos grandes. */
export function usaParches(e: EntradaUsaParches): boolean {
  if (e.nivel !== 2 || e.agente) return false;
  for (const a of e.archivos.values()) if (a.text.length >= MIN_CHARS_PARCHE) return true;
  return false;
}

export interface ArchivoParcheado {
  path: string;
  text: string;
  bloques: number;
}

export interface ResultadoRetoque {
  /** la respuesta traía bloques SEARCH/REPLACE */
  huboParches: boolean;
  /** archivos con TODOS sus bloques aplicados */
  parcheados: ArchivoParcheado[];
  /** archivos que no se pudieron parchear (no se tocan: rollback) */
  fallidos: Array<{ path: string; fallos: FalloParche[] }>;
  /** bloques que no se sabe a qué archivo van */
  sinArchivo: number;
}

const base = (p: string) => p.split("/").pop()?.toLowerCase() ?? p.toLowerCase();

/** ¿Esta línea (fuera de un bloque) nombra uno de los archivos conocidos? */
function archivoNombrado(linea: string, rutas: readonly string[]): string | null {
  const l = linea.trim();
  if (!l || l.length > 200) return null;
  const limpia = l.replace(/[*_`#>"'«»:]/g, " ").toLowerCase();
  // primero la ruta completa, después el nombre base (index.html ↔ src/index.html)
  const exacta = rutas.find((r) => new RegExp(`(^|\\s)${r.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(limpia));
  if (exacta) return exacta;
  const porBase = rutas.filter((r) => new RegExp(`(^|\\s|/)${base(r).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(limpia));
  return porBase.length === 1 ? porBase[0] : null;
}

/**
 * Aplica los parches de una respuesta sobre las versiones vigentes.
 * Los bloques se asignan al último archivo nombrado antes de ellos; si el
 * proyecto tiene un único archivo, a ese.
 */
export function aplicarRetoque(
  respuesta: string,
  vigentes: ReadonlyMap<string, { text: string }>
): ResultadoRetoque {
  const vacio: ResultadoRetoque = { huboParches: false, parcheados: [], fallidos: [], sinArchivo: 0 };
  if (!pareceParche(respuesta)) return vacio;

  const rutas = [...vigentes.keys()];
  const porArchivo = new Map<string, string[]>();
  const sueltas: string[] = [];
  let actual: string | null = rutas.length === 1 ? rutas[0] : null;
  let dentro = false;

  for (const linea of respuesta.split("\n")) {
    if (/^<{7,}\s*SEARCH\b/.test(linea)) dentro = true;
    if (!dentro) {
      const nombrado = archivoNombrado(linea, rutas);
      if (nombrado) actual = nombrado;
    }
    if (dentro) {
      if (!actual) sueltas.push(linea);
      else {
        const lista = porArchivo.get(actual) ?? [];
        lista.push(linea);
        porArchivo.set(actual, lista);
      }
    }
    if (/^>{7,}\s*REPLACE\b/.test(linea)) dentro = false;
  }

  const parcheados: ArchivoParcheado[] = [];
  const fallidos: ResultadoRetoque["fallidos"] = [];
  for (const [path, lineas] of porArchivo) {
    const parches = parsearParches(lineas.join("\n"));
    if (!parches.length) continue;
    const r = aplicarParches(vigentes.get(path)?.text ?? "", parches);
    if (r.ok) parcheados.push({ path, text: r.resultado, bloques: r.aplicados });
    else fallidos.push({ path, fallos: r.fallos });
  }
  return {
    huboParches: true,
    parcheados,
    fallidos,
    sinArchivo: parsearParches(sueltas.join("\n")).length,
  };
}

function lenguaje(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return { htm: "html", mjs: "js", cjs: "js" }[ext] ?? ext;
}

/** Lo que se añade a la respuesta guardada: el archivo completo ya
 *  parcheado, con su nombre, para que la vista previa y el ZIP lo lean. */
export function bloqueResultado(a: ArchivoParcheado): string {
  return `**${a.path}** (resultado del parche, ${a.bloques} ${a.bloques === 1 ? "cambio" : "cambios"})\n\n\`\`\`${lenguaje(a.path)}\n${a.text}\n\`\`\``;
}

/** La petición de repuesto cuando algún archivo no se pudo parchear. */
export function pedirArchivoCompleto(fallidos: ResultadoRetoque["fallidos"]): string {
  const lista = fallidos
    .map((f) => `- ${f.path}: ${f.fallos.map((x) => `bloque ${x.indice}: ${x.motivo}`).join(" ")}`)
    .join("\n");
  return `Tu parche no se pudo aplicar y el archivo se ha dejado como estaba:\n${lista}\nEntrega ahora esos archivos COMPLETOS, con el cambio hecho.`;
}

/* ------------------------------------------------------------------ */
/* Quality Gate: archivos entregados con partes omitidas (§62)         */
/* ------------------------------------------------------------------ */

/** Marcas con las que un modelo se salta partes del archivo («el resto
 *  igual»). Dentro de un archivo completo significan que esas partes se
 *  PERDERÍAN al usarlo. */
const ELISION =
  /(?:\/\/|\/\*|<!--|#|\{\/\*)\s*(?:\.{3}|…)?\s*(?:resto|el resto|lo dem[aá]s|todo lo dem[aá]s|mismo c[oó]digo|c[oó]digo (?:anterior|existente|igual)|sin cambios|igual que antes|existing code|rest of (?:the )?(?:code|file)|unchanged|same as before)\b|(?:\/\/|\/\*|<!--)\s*(?:\.{3}|…)\s*(?:\*\/|-->)?\s*$/im;

export interface ArchivoRecortado {
  path: string;
  antes: number;
  ahora: number;
}

/**
 * Archivos de la respuesta que vienen con partes omitidas: tienen una marca
 * de «resto igual» y miden mucho menos que su versión anterior. Usarlos
 * borraría lo omitido. Solo se mira lo que tiene versión anterior: un
 * archivo nuevo no puede haber perdido nada.
 */
export function archivosRecortados(
  bloques: ReadonlyArray<{ path: string; text: string }>,
  vigentes: ReadonlyMap<string, { text: string }>
): ArchivoRecortado[] {
  const out: ArchivoRecortado[] = [];
  for (const b of bloques) {
    const antes = vigentes.get(b.path)?.text;
    if (!antes || antes.length < MIN_CHARS_PARCHE) continue;
    if (b.text.length >= antes.length * 0.7) continue;
    if (!ELISION.test(b.text)) continue;
    out.push({ path: b.path, antes: antes.length, ahora: b.text.length });
  }
  return out;
}

export function pedirSinOmitir(recortados: readonly ArchivoRecortado[]): string {
  const lista = recortados
    .map((r) => `- ${r.path}: ${r.ahora.toLocaleString("es")} caracteres frente a ${r.antes.toLocaleString("es")} antes`)
    .join("\n");
  return `Entregaste archivos con partes omitidas («el resto igual»). Usarlos borraría lo omitido, así que no se han aplicado:\n${lista}\nRepite el cambio con bloques SEARCH/REPLACE (solo lo que cambia) o entrega esos archivos COMPLETOS, sin omitir nada.`;
}

/** Sustituye en la respuesta los bloques recortados por una nota, para que
 *  la vista previa y el ZIP no tomen como buena una versión a la que le
 *  faltan partes. La versión anterior sigue siendo la vigente. */
export function neutralizarRecortados(respuesta: string, recortados: readonly ArchivoRecortado[]): string {
  const rutas = new Set(recortados.map((r) => r.path));
  let texto = respuesta;
  for (const b of [...bloquesConNombre(respuesta)].sort((x, y) => y.inicio - x.inicio)) {
    if (!rutas.has(b.path)) continue;
    texto =
      texto.slice(0, b.inicio) +
      `[«${b.path}» llegó con partes omitidas y no se ha aplicado: sigue valiendo la versión anterior]` +
      texto.slice(b.fin);
  }
  return texto;
}
