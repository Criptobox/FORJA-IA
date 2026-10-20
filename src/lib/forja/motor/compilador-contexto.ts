/** FORJA IA — COMPILADOR DE CONTEXTO (v4.4, sección 23 del plan maestro).
 *
 * ─── El problema ───
 * Enviar TODO el proyecto al modelo cuando solo necesita un componente es
 * el mayor desperdicio de tokens del pipeline: reglas repetidas, historial
 * redundante, conocimiento duplicado y secciones que el paso actual ni
 * siquiera usa. Cada token de entrada se paga en TODAS las llamadas.
 *
 * ─── La solución ───
 * Un compilador DETERMINISTA (cero LLM, cero coste) que recibe todas las
 * fuentes de contexto y produce un FORJA_CONTEXT:
 *
 *   Project · Memory · Experience DNA · Design System · History ·
 *   Known Errors · Current State · Objective · User Intent
 *        ↓
 *   compacto · relevante · estructurado · deduplicado · priorizado
 *
 * Cómo decide qué entra (reglas del plan, en orden):
 *   1. DEDUPLICACIÓN — dos líneas con el mismo hash normalizado son la
 *      misma regla: solo pasa la primera (se conserva la más corta).
 *   2. RELEVANCIA — cada línea puntúa por solapamiento de palabras clave
 *      con la intención del usuario (mensaje + objetivo). Una regla de
 *      «hovers animados» no viaja si la petición es de tipografía.
 *   3. PRIORIDAD FIJA — los fallos confirmados (memoria de fallos) SIEMPRE
 *      viajan (son prohibiciones duras del plan); el ADN y el design
 *      system siempre; el historial solo lo relevante y recortado.
 *   4. PRESUPUESTO — un techo de caracteres por compilación: si sobra,
 *      entra en orden de puntuación; si no cabe, se recorta la cola y el
 *      informe dice CUÁNTO se ahorró.
 *
 * El módulo no sabe de prompts de roles: quien llama le pasa las líneas y
 * recibe el texto listo + estadísticas de ahorro para observabilidad.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

/* -------------------------------- tipos ------------------------------------ */

/** Una fuente de contexto: líneas que quieren viajar al modelo. */
export interface FuenteContexto {
  /** de dónde viene (para el informe y la prioridad fija) */
  tipo: TipoContexto;
  /** las líneas crudas (una regla/frase por línea) */
  lineas: string[];
  /** prioridad fija: 0 = debe viajar siempre (fallos confirmados, ADN) */
  prioridad: number;
}

export type TipoContexto =
  | "fallos-confirmados"   // memoria de fallos: prohibiciones duras, SIEMPRE
  | "reglas-proyecto"      // memoria del proyecto
  | "reglas-usuario"       // memoria del usuario
  | "conocimiento-global"  // reglas destiladas de internet
  | "adn"                  // Experience DNA resumido
  | "design-system"        // tokens/reglas del sistema
  | "historial"            // decisiones y resultados previos
  | "estado"               // estado actual (código existente, fase…)
  | "objetivo";            // qué se pide en esta pasada

/** Entrada completa del compilador. */
export interface EntradaContexto {
  /** la petición del usuario, tal cual (define la relevancia) */
  mensaje: string;
  /** objetivo concreto de ESTA llamada (p. ej. «corregir hover», «ficha») */
  objetivo?: string;
  /** las fuentes, ya etiquetadas */
  fuentes: FuenteContexto[];
  /** techo de caracteres del contexto final (defecto 6.000) */
  techoCaracteres?: number;
}

/** Un bloque ya puntuado y seleccionado. */
export interface BloqueContexto {
  tipo: TipoContexto;
  linea: string;
  /** puntuación de relevancia (0 = de oficio, por prioridad fija) */
  score: number;
}

/** Resultado: el texto listo para viajar + el ahorro medido. */
export interface ContextoCompilado {
  /** texto final listo para incrustar en el prompt del rol */
  texto: string;
  bloques: BloqueContexto[];
  stats: StatsContexto;
}

export interface StatsContexto {
  /** líneas que entraron por las puertas */
  lineasEntrada: number;
  /** líneas eliminadas por duplicación (hash normalizado igual) */
  duplicadas: number;
  /** líneas descartadas por baja relevancia o techo */
  descartadas: number;
  /** líneas del bloque final */
  lineasFinales: number;
  /** caracteres que tenía el contexto SIN compilar (todas las fuentes) */
  caracteresSinCompilar: number;
  /** caracteres del contexto final */
  caracteresFinal: number;
}

/* ------------------------------ normalización ------------------------------ */

/** Normaliza una línea para comparar: minúsculas, sin signos, espacios
 * colapsados. Dos formulaciones distintas de la MISMA regla deduplican. */
export function normalizarLinea(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // acentos fuera: «código» = «codigo»
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** FNV-1a (misma rutina que cache-fichas.ts, sin dependencias). */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/* ------------------------------- vocabulario ------------------------------- */

/** Stopwords ES+EN mínimas: no puntúan relevancia (todo el mundo las usa). */
const STOPWORDS = new Set([
  "de","la","el","los","las","un","una","unos","unas","y","o","que","en","a",
  "del","se","por","con","para","es","al","lo","como","mas","más","pero","sus",
  "le","ya","fue","this","that","with","from","have","has","the","and","for",
  "are","not","you","all","can","her","was","one","our","out","day","get",
  "uso","usar","usese","úsese","debe","deben","siempre","nunca","todo","toda",
]);

/** Palabras clave de la línea (sin stopwords, únicas, ya normalizadas). */
function clavesDe(s: string): string[] {
  const out: string[] = [];
  for (const w of normalizarLinea(s).split(" ")) {
    if (w.length < 3 || STOPWORDS.has(w)) continue;
    if (!out.includes(w)) out.push(w);
  }
  return out.slice(0, 12);
}

/** Solapamiento Jaccard suave entre la línea y la intención:
 * claves compartidas / claves de la línea (las de la intención pesan menos
 * porque suelen ser muchas). 0..1. */
function relevancia(clavesLinea: string[], clavesIntento: Set<string>): number {
  if (!clavesLinea.length) return 0;
  let compartidas = 0;
  for (const c of clavesLinea) if (clavesIntento.has(c)) compartidas++;
  return compartidas / clavesLinea.length;
}

/* ------------------------------- compilación ------------------------------- */

const TECHO_DEFECTO = 6_000;

/** Compila el contexto: deduplica → puntúa → prioriza → recorta a techo.
 * NUNCA lanza: si algo raro llega, se degrada a incluirlo tal cual. */
export function compilarContexto(e: EntradaContexto): ContextoCompilado {
  const techo = Math.max(600, e.techoCaracteres ?? TECHO_DEFECTO);
  const clavesIntento = new Set(
    clavesDe(`${e.mensaje ?? ""} ${e.objetivo ?? ""}`)
  );

  /* 1 · recolectar con deduplicación por hash normalizado */
  const vistas = new Map<string, { linea: string; tipo: TipoContexto; prioridad: number; score: number; largo: number }>();
  let lineasEntrada = 0;
  let duplicadas = 0;
  let caracteresSinCompilar = 0;

  // orden de fuentes: prioridad fija primero (a igual hash gana la más
  // importante); dentro, el orden de llegada.
  const fuentes = [...e.fuentes].sort((a, b) => a.prioridad - b.prioridad);
  for (const f of fuentes) {
    for (const raw of f.lineas ?? []) {
      const linea = String(raw ?? "").replace(/\s+/g, " ").trim();
      if (!linea) continue;
      lineasEntrada++;
      caracteresSinCompilar += linea.length;
      const clave = hash(normalizarLinea(linea));
      const previa = vistas.get(clave);
      if (previa) {
        duplicadas++;
        // conservar la versión más corta de la misma regla
        if (linea.length < previa.largo) {
          previa.linea = linea;
          previa.largo = linea.length;
          previa.tipo = f.tipo;
        }
        continue;
      }
      vistas.set(clave, {
        linea,
        tipo: f.tipo,
        prioridad: f.prioridad,
        score: relevancia(clavesDe(linea), clavesIntento),
        largo: linea.length,
      });
    }
  }

  /* 2 · ordenar: prioridad fija (fallos confirmados = prohibiciones duras)
   * primero; dentro de cada prioridad, relevancia y brevedad */
  const orden = [...vistas.values()].sort((a, b) => {
    if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;
    if (Math.abs(a.score - b.score) > 0.001) return b.score - a.score;
    return a.largo - b.largo;
  });

  /* 3 · seleccionar hasta el techo; lo relevante gana, la cola se recorta */
  const bloques: BloqueContexto[] = [];
  let usados = 0;
  let descartadas = 0;
  for (const c of orden) {
    const coste = c.linea.length + 3; // + «- »
    const esFija = c.prioridad === 0;
    if (!esFija && usados + coste > techo) {
      descartadas++;
      continue;
    }
    usados += coste;
    bloques.push({ tipo: c.tipo, linea: c.linea, score: Math.round(c.score * 100) / 100 });
  }

  /* 4 · render agrupado por tipo (el modelo lee secciones, no sopa) */
  const texto = render(bloques);
  return {
    texto,
    bloques,
    stats: {
      lineasEntrada,
      duplicadas,
      descartadas: descartadas + (duplicadas ? 0 : 0),
      lineasFinales: bloques.length,
      caracteresSinCompilar,
      caracteresFinal: texto.length,
    },
  };
}

const ORDEN_TIPOS: TipoContexto[] = [
  "fallos-confirmados",
  "objetivo",
  "adn",
  "design-system",
  "reglas-proyecto",
  "reglas-usuario",
  "conocimiento-global",
  "estado",
  "historial",
];

const TITULOS: Record<TipoContexto, string> = {
  "fallos-confirmados": "PROHIBICIONES DURAS (fallos confirmados — incumplir esto rompe la entrega)",
  objetivo: "OBJETIVO DE ESTA PASADA",
  adn: "ADN VISUAL",
  "design-system": "SISTEMA DE DISEÑO",
  "reglas-proyecto": "REGLAS DEL PROYECTO",
  "reglas-usuario": "PREFERENCIAS DEL USUARIO",
  "conocimiento-global": "BUENAS PRÁCTICAS",
  estado: "ESTADO ACTUAL",
  historial: "DECISIONES PREVIAS",
};

/** Render agrupado: cada tipo en su sección, una línea por regla. */
export function render(bloques: BloqueContexto[]): string {
  const grupos = new Map<TipoContexto, string[]>();
  for (const b of bloques) {
    const g = grupos.get(b.tipo) ?? [];
    g.push(`- ${b.linea}`);
    grupos.set(b.tipo, g);
  }
  const partes: string[] = [];
  for (const t of ORDEN_TIPOS) {
    const g = grupos.get(t);
    if (!g?.length) continue;
    partes.push(`# ${TITULOS[t]}\n${g.join("\n")}`);
  }
  return partes.join("\n\n");
}

/** Línea de informe para observabilidad: «contexto 38→21 líneas · 4.120→2.860 car (31% menos)». */
export function resumenContexto(s: StatsContexto): string {
  const pct = s.caracteresSinCompilar
    ? Math.round((1 - s.caracteresFinal / s.caracteresSinCompilar) * 100)
    : 0;
  return `contexto ${s.lineasEntrada}→${s.lineasFinales} líneas (${s.duplicadas} dup) · ${s.caracteresSinCompilar}→${s.caracteresFinal} car` +
    (pct > 0 ? ` · ${pct}% menos` : "");
}
