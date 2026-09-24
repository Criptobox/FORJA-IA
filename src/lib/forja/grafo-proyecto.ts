/** Forja IA — Qué archivos importan para ESTE turno (Plan Maestro 2026 §6).
 *
 * «El menú móvil no funciona» no necesita que el modelo relea las doce vistas
 * del proyecto: necesita el archivo del menú, lo que lo importa y lo que él
 * importa. El plan lo dice como regla fundamental: «FORJA debe enviar al modelo
 * solamente el contexto necesario para la tarea».
 *
 * Aquí se hacen tres cosas, todas deterministas y sin modelo:
 *
 *  1. `archivosVigentes`: la última versión de cada archivo que aparece en la
 *     conversación (la misma lectura de nombres que la vista previa y el ZIP).
 *  2. `grafoDeArchivos`: quién depende de quién: `<script src>`, `<link href>`,
 *     `import … from`, `import()`, `require()`, `@import` y `url()` de CSS.
 *  3. `archivosRelevantes`: los que nombra la petición o cuyo contenido casa
 *     con sus palabras, más sus vecinos directos en el grafo.
 *
 * Y con eso, `podarIrrelevantes` quita del historial los archivos que no
 * tienen que ver, solo en preguntas y retoques (L1/L2, `nivel-contexto.ts`).
 *
 * ——— La regla de esta casa ———
 *
 * Quitar de más es peor que mandar de más: un archivo que falta hace que el
 * modelo lo adivine. Así que:
 *  · Si la petición no da ninguna pista, no se quita NADA.
 *  · Los vecinos del grafo se quedan, y también la página de entrada y las
 *    hojas de estilo (son globales).
 *  · Proyectos de menos de `MIN_ARCHIVOS` archivos no se tocan: con tres
 *    archivos todo está relacionado con todo.
 *  · Cada archivo quitado deja un marcador con su nombre: el modelo sabe
 *    que existe y puede pedirlo.
 *
 * Funciones puras: se prueban sin navegador.
 */
import { bloquesConNombre } from "./answer-files";
import { normalizar } from "./turno-trivial";

/** Por debajo de esto el proyecto es tan pequeño que todo es relevante. */
export const MIN_ARCHIVOS = 4;
/** Un bloque más corto que esto no merece quitarse. */
export const MIN_CHARS_PODA = 600;

export interface ArchivoVigente {
  path: string;
  text: string;
  /** índice del mensaje donde está esta versión */
  mensaje: number;
}

interface MensajeLeible {
  role: string;
  content: string;
}

/** Última versión de cada archivo en la conversación, por ruta. */
export function archivosVigentes(mensajes: readonly MensajeLeible[]): Map<string, ArchivoVigente> {
  const out = new Map<string, ArchivoVigente>();
  mensajes.forEach((m, i) => {
    for (const b of bloquesConNombre(m.content)) {
      out.set(b.path, { path: b.path, text: b.text, mensaje: i });
    }
  });
  return out;
}

const base = (p: string) => (p.split(/[?#]/)[0].split("/").pop() ?? p).toLowerCase();
const sinExt = (p: string) => base(p).replace(/\.[^.]+$/, "");

/** Rutas locales que un archivo referencia, tal como las escribe. */
export function referenciasDe(path: string, text: string): string[] {
  const refs = new Set<string>();
  const add = (r: string | undefined) => {
    const v = (r ?? "").trim();
    if (!v || /^(?:[a-z]+:)?\/\//i.test(v) || /^(data|mailto|tel|blob|javascript):/i.test(v) || v.startsWith("#")) return;
    refs.add(v.replace(/^\.\//, ""));
  };
  const ext = base(path).split(".").pop() ?? "";
  if (/^html?$/.test(ext) || /<(script|link|a|img)\b/i.test(text)) {
    for (const m of text.matchAll(/<(?:script|img|source|iframe)\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) add(m[1]);
    for (const m of text.matchAll(/<(?:link|a)\b[^>]*?\bhref\s*=\s*["']([^"']+)["']/gi)) add(m[1]);
  }
  // módulos: import x from "./a.js", import "./b.js", export … from, import(), require()
  for (const m of text.matchAll(/\b(?:import|export)\b[^'"`;]*?\bfrom\s*["']([^"']+)["']/g)) add(m[1]);
  for (const m of text.matchAll(/\bimport\s*["']([^"']+)["']/g)) add(m[1]);
  for (const m of text.matchAll(/\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g)) add(m[1]);
  // CSS
  for (const m of text.matchAll(/@import\s+(?:url\()?\s*["']?([^"')\s;]+)/g)) add(m[1]);
  for (const m of text.matchAll(/url\(\s*["']?([^"')]+?)["']?\s*\)/g)) if (/\.(css|svg|png|jpe?g|webp|gif|woff2?)$/i.test(m[1])) add(m[1]);
  return [...refs];
}

/** Grafo no dirigido de dependencias entre los archivos vigentes. */
export function grafoDeArchivos(archivos: ReadonlyMap<string, { text: string }>): Map<string, Set<string>> {
  const rutas = [...archivos.keys()];
  const porBase = new Map<string, string[]>();
  for (const r of rutas) porBase.set(base(r), [...(porBase.get(base(r)) ?? []), r]);
  const resolver = (ref: string): string | null => {
    const limpio = ref.replace(/^\/+/, "");
    if (archivos.has(limpio)) return limpio;
    // import "./store" sin extensión, o una ruta relativa desde otra carpeta
    const exacta = porBase.get(base(limpio));
    if (exacta?.length === 1) return exacta[0];
    const sinExtension = rutas.filter((r) => sinExt(r) === base(limpio));
    return sinExtension.length === 1 ? sinExtension[0] : null;
  };

  const g = new Map<string, Set<string>>();
  for (const r of rutas) g.set(r, new Set());
  for (const [r, a] of archivos) {
    for (const ref of referenciasDe(r, a.text)) {
      const destino = resolver(ref);
      if (!destino || destino === r) continue;
      g.get(r)?.add(destino);
      g.get(destino)?.add(r);
    }
  }
  return g;
}

/** Palabras que no dicen nada sobre QUÉ archivo tocar. */
const VACIAS = new Set(
  "que como para pero porque cuando donde esta este esto estos estas eso esa ese sobre todo toda todos todas algo nada mucho poco mas menos muy tambien ahora luego antes despues aqui alli hace hacer haz pon ponle quita cambia cambiar arregla arreglar corrige ajusta mueve sube baja funciona falla pagina web archivo archivos codigo parte cosa cosas favor gracias quiero puedes podrias explica explicame dime tiene tienen tengo hay pasa deberia seria mejor color colores grande pequeno nuevo nueva".split(
    " "
  )
);

function palabrasClave(texto: string): string[] {
  return [...new Set(normalizar(texto).split(" "))].filter((w) => w.length >= 4 && !VACIAS.has(w));
}

/** El HTML de entrada, que se queda siempre: es el esqueleto de todo. */
function entrada(rutas: readonly string[]): string | null {
  return rutas.find((r) => base(r) === "index.html") ?? rutas.find((r) => /\.html?$/i.test(r)) ?? null;
}

/**
 * Los archivos que importan para la petición, o `null` si no se puede saber
 * (proyecto pequeño o petición sin pistas): `null` significa «no quites nada».
 */
export function archivosRelevantes(
  peticion: string,
  archivos: ReadonlyMap<string, { text: string }>,
  grafo: ReadonlyMap<string, ReadonlySet<string>> = grafoDeArchivos(archivos)
): Set<string> | null {
  const rutas = [...archivos.keys()];
  if (rutas.length < MIN_ARCHIVOS) return null;

  const n = normalizar(peticion);
  const directos = new Set<string>();
  // 1) nombrados: «store.js», «el archivo store», «views/lista»
  for (const r of rutas) {
    const b = normalizar(base(r));
    const s = normalizar(sinExt(r));
    if ((b && n.includes(b)) || (s.length >= 4 && new RegExp(`\\b${s}\\b`).test(n))) directos.add(r);
  }
  // 2) si no nombra ninguno, por contenido: la palabra aparece en el archivo
  if (!directos.size) {
    const claves = palabrasClave(peticion);
    if (!claves.length) return null;
    for (const [r, a] of archivos) {
      const t = normalizar(a.text);
      if (claves.some((k) => t.includes(k) || normalizar(r).includes(k))) directos.add(r);
    }
  }
  if (!directos.size) return null;
  // Si casi todo casa, la petición no discrimina: mejor no quitar nada.
  if (directos.size >= rutas.length - 1) return null;

  const out = new Set(directos);
  for (const r of directos) for (const v of grafo.get(r) ?? []) out.add(v);
  const e = entrada(rutas);
  if (e) out.add(e);
  // Las hojas de estilo son globales: afectan a todo, y «cambia el color del
  // botón» de la vista X se arregla casi siempre en el CSS, no en la vista.
  for (const r of rutas) if (/\.(css|scss)$/i.test(r)) out.add(r);
  return out.size >= rutas.length ? null : out;
}

export interface PodaIrrelevantes<T extends MensajeLeible> {
  mensajes: T[];
  /** rutas quitadas del historial en este turno */
  omitidos: string[];
  ahorrados: number;
}

export function marcadorIrrelevante(ruta: string, chars: number): string {
  return `[«${ruta}» (${chars.toLocaleString("es")} caracteres) no se envía en este turno: no parece relacionado con lo que se pide. Existe en el proyecto; si lo necesitas, léelo o pídelo.]`;
}

/**
 * Quita del historial los bloques de archivos que no están en `relevantes`.
 * `protegido` (la pregunta viva) no se toca nunca.
 */
export function podarIrrelevantes<T extends MensajeLeible>(
  mensajes: readonly T[],
  relevantes: ReadonlySet<string> | null,
  protegido = -1
): PodaIrrelevantes<T> {
  if (!relevantes) return { mensajes: [...mensajes], omitidos: [], ahorrados: 0 };
  const omitidos = new Set<string>();
  let ahorrados = 0;
  const out = mensajes.map((m, i) => {
    if (i === protegido) return m;
    const quitar = bloquesConNombre(m.content).filter(
      (b) => !relevantes.has(b.path) && b.text.length >= MIN_CHARS_PODA
    );
    if (!quitar.length) return m;
    let texto = m.content;
    for (const b of [...quitar].sort((x, y) => y.inicio - x.inicio)) {
      const nuevo = marcadorIrrelevante(b.path, b.text.length);
      ahorrados += b.fin - b.inicio - nuevo.length;
      omitidos.add(b.path);
      texto = texto.slice(0, b.inicio) + nuevo + texto.slice(b.fin);
    }
    return { ...m, content: texto };
  });
  return { mensajes: out, omitidos: [...omitidos], ahorrados: Math.max(0, ahorrados) };
}
