/** FORJA IA — Conocimiento global de FORJA IA, estratificado en 6 CAPAS.
 *
 * Cuarto nivel de entrenamiento (1: prompts maestros, 2: habilidades,
 * 3: memoria del usuario): reglas DESTILADAS de fuentes web curadas
 * (fuentes.ts), del Apartado del usuario (fuentes-usuario.ts) y de la
 * ARENA (arena.ts → registrarLeccionesArena).
 *
 * v2.4.0 — «El Genoma Visual»: el dueño del proyecto señaló el problema del
 * modelo plano (un tope de 120 reglas mezcla todo y acaba acumulando
 * conocimiento estático contradictorio: «regla 37: usa 16px» y «regla 48:
 * usa 24px»). Solución: cada regla tiene CATEGORÍA (tema: color, tipo­grafía…)
 * y CAPA (clase de conocimiento), con política propia por capa:
 *
 *   1. preferencia  — lo que el dueño pide («este usuario odia X»). Manda
 *                     sobre todo lo demás y nunca se expulsa sola.
 *   2. fallo        — «esta combinación produjo un diseño mediocre». ORO:
 *                     no se expulsa automáticamente (solo por el tope).
 *   3. experimento  — «probamos X → puntuó 82». Llega de la Arena con su
 *                     puntuación y su generación.
 *   4. fundamento   — lo que casi nunca cambia (WCAG, responsive, semántica).
 *   5. patron       — «este tipo de SaaS funciona mejor con…».
 *   6. tendencia    — lo que caduca: lleva vigenciaHasta y se marca
 *                     «caducada» al pasar (fuera del prompt, fuera del almacén
 *                     pasados 30 días de gracia).
 *
 * CONFLICTOS: si dos reglas del mismo tema se contradicen con números
 * («16px» vs «24px»), gana la de capa con más autoridad y la otra queda
 * «superada» (auditable pero fuera del prompt). Las reglas de estilo de la
 * web ya no entran como fundamento estático: si miden algo concreto, el
 * extractor las marca como experimento/patrón.
 *
 * Persistencia: igual que el resto — el módulo no toca storage; el host
 * serializa con serializar()/deserializar(). Los datos viejos migran solos
 * (deserializar() infiere la capa de cada regla antigua).
 */

export type CategoriaReglaForja =
  | "color"
  | "tipografia"
  | "layout"
  | "movimiento"
  | "contenido"
  | "accesibilidad"
  | "patron"
  | "tendencia";

export const CATEGORIAS_FORJA: CategoriaReglaForja[] = [
  "color",
  "tipografia",
  "layout",
  "movimiento",
  "contenido",
  "accesibilidad",
  "patron",
  "tendencia",
];

/** Las 6 capas de conocimiento, ordenadas por AUTORIDAD (1 manda). */
export type CapaConocimiento =
  | "preferencia"
  | "fallo"
  | "experimento"
  | "fundamento"
  | "patron"
  | "tendencia";

/** Política por capa: etiqueta, autoridad y tope propio. */
export interface ConfigCapa {
  etiqueta: string;
  /** 1 = máxima autoridad (gana conflictos y entra primero al prompt) */
  autoridad: number;
  max: number;
}

export const CAPAS_CONOCIMIENTO: Record<CapaConocimiento, ConfigCapa> = {
  preferencia: { etiqueta: "preferencia", autoridad: 1, max: 20 },
  fallo: { etiqueta: "fallo", autoridad: 2, max: 30 },
  experimento: { etiqueta: "experimento", autoridad: 3, max: 30 },
  fundamento: { etiqueta: "fundamento", autoridad: 4, max: 40 },
  patron: { etiqueta: "patrón", autoridad: 5, max: 30 },
  tendencia: { etiqueta: "tendencia", autoridad: 6, max: 30 },
};

export const CAPAS_FORJA = Object.keys(CAPAS_CONOCIMIENTO) as CapaConocimiento[];

/** Una regla aprendida. Texto escrito PARA EL MODELO (imperativa, medible,
 * ≤220 chars), nunca una cita literal de la fuente. */
export interface ReglaGlobal {
  id: string;
  texto: string;
  categoria: CategoriaReglaForja;
  /** clase de conocimiento (v2.4); si falta, se infiere del texto */
  capa?: CapaConocimiento;
  /** para patrones: «saas b2b», «tienda móvil», «portfolio»… */
  contexto?: string;
  /** para tendencias: ISO hasta cuándo se considera vigente */
  vigenciaHasta?: string;
  /** para experimentos: puntuación 0..100 (Arena normalizada /50→/100) */
  puntuacion?: number;
  /** para experimentos/fallos: generación de la Arena que lo produjo */
  generacion?: number;
  /** true si perdió un conflicto: se conserva por auditoría pero NO viaja */
  superada?: boolean;
  /** tendencia vencida: fuera del prompt; se borra al limpiar */
  caducada?: boolean;
  /** id de la fuente de la que se destiló (fuentes.ts / "arena" / "usuario") */
  origen: string;
  /** 0..1: calidad de fuente (0.4/0.7/1) ajustada por validación y usos */
  peso: number;
  /** ISO de cuándo se aprendió (para decaimiento de tendencias) */
  alta: string;
  /** cuántas peticiones la usaron; sube cuando el Diseñador la aplicó */
  usos: number;
}

/** El almacén completo que persiste el host. */
export interface ConocimientoGlobal {
  reglas: ReglaGlobal[];
  /** última vez que cada fuente fue leída (ISO), para no releer siempre */
  ultimaLectura: Record<string, string>;
  /** ISO del último ciclo completo (informativo para la UI) */
  ultimoCiclo?: string;
  /** generación evolutiva: +1 por cada Arena que aportó lecciones */
  generacion?: number;
}

export const CONOCIMIENTO_GLOBAL_DEFECTO: ConocimientoGlobal = {
  reglas: [],
  ultimaLectura: {},
  generacion: 0,
};

/** Tope global de reglas (candado de seguridad; el reparto fino es por capa:
 * 20+30+30+40+30+30 = 180 teóricos, y por petición solo viajan 4-10). */
export const MAX_REGLAS_GLOBALES = 180;

export const CLAVE_CONOCIMIENTO_GLOBAL = "forja.conocimiento-global";

/** Peso base por calidad de fuente (1..3 → 0.4..1). */
export function pesoBase(calidad: 1 | 2 | 3): number {
  return calidad === 3 ? 1 : calidad === 2 ? 0.7 : 0.4;
}

/** Similitud entre dos textos como Jaccard de palabras (0..1). Barato,
 * determinista y suficiente para detectar duplicados de extracción. */
export function similitud(a: string, b: string): number {
  const norm = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9áéíóúñü\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );
  const A = norm(a);
  const B = norm(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

const UMBRAL_DUPLICADO = 0.55;

/** ¿Ya existe una regla esencialmente igual? */
export function reglaDuplicada(reglas: ReglaGlobal[], texto: string): boolean {
  return reglas.some((r) => similitud(r.texto, texto) >= UMBRAL_DUPLICADO);
}

/* ------------------------------ capas ----------------------------------- */

/** Palabras clave por capa, para inferir la capa de una regla vieja o de un
 * texto nuevo sin etiqueta. Es una heurística consciente: lo importante no
 * es acertar el 100% sino que cada capa tenga SU política. */
const PISTAS_CAPA: Array<{ capa: CapaConocimiento; re: RegExp }> = [
  {
    capa: "preferencia",
    re: /\b(el usuario|el dueño|odiat?|prefiere|prefiero|quiero que|no me gusta|no uses|nunca uses)\b/i,
  },
  {
    capa: "fallo",
    re: /\b(fallo|fall[óo]|error|mediocre|evitar|evita|nunca|prohibid|no repitas|produjo|fracas)\b/i,
  },
  {
    capa: "experimento",
    re: /\b(probamos|probado|arena|duelo|puntu[oó]|resultado|generaci[oó]n|gana(?:dor|ndo)?)\b/i,
  },
  {
    capa: "tendencia",
    re: /\b(20\d\d|este a[ñn]o|pr[oó]xima temporada|moda|trend|popularizado|est[aá] de moda|ahora)\b/i,
  },
  {
    capa: "patron",
    re: /\b(este tipo de|este tipo|tipo de (?:web|saas|sitio|proyecto)|funciona mejor|suele funcionar|conviene en)\b/i,
  },
  {
    capa: "fundamento",
    re: /\b(wcag|accesib|contraste|sem[aá]ntic|responsive|aria|foco|usabilidad|siempre|legibilidad)\b/i,
  },
];

/** Capa por defecto según la categoría histórica (reglas antiguas). */
function capaPorCategoria(categoria: CategoriaReglaForja): CapaConocimiento {
  if (categoria === "tendencia") return "tendencia";
  if (categoria === "patron") return "patron";
  if (categoria === "accesibilidad") return "fundamento";
  return "fundamento";
}

/** Infiere la capa de un texto (por pistas) y cae a la categoría histórica. */
export function inferirCapa(texto: string, categoria: CategoriaReglaForja): CapaConocimiento {
  for (const pista of PISTAS_CAPA) {
    if (pista.re.test(texto)) return pista.capa;
  }
  return capaPorCategoria(categoria);
}

/** Capa efectiva de una regla (la declarada o la inferida). */
export function capaDe(regla: ReglaGlobal): CapaConocimiento {
  return regla.capa && CAPAS_FORJA.includes(regla.capa)
    ? regla.capa
    : inferirCapa(regla.texto, regla.categoria);
}

/* ---------------------------- conflictos -------------------------------- */

/** Extrae los números «medibles» de un texto: 16px, 24px, 4.5:1, 30%, 1.25. */
function numerosDe(texto: string): number[] {
  const out: number[] = [];
  const re = /(\d+(?:[.,]\d+)?)\s*(px|%|:1|rem|em|fr|ms|s\b|x)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    const n = Number(m[1].replace(",", "."));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** ¿Dos reglas hablan del mismo tema y se contradicen con medidas distintas?
 * (el caso «regla 37: usa 16px» vs «regla 48: usa 24px»). Tema = similitud
 * alta O compartir alguna palabra clave de 4+ letras («cuerpo», «cta»…). */
export function conflictoEntre(a: ReglaGlobal, b: ReglaGlobal): boolean {
  if (a.categoria !== b.categoria) return false;
  const comparten = (() => {
    const norm = (s: string): Set<string> =>
      new Set(
        s
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length >= 4)
      );
    for (const w of norm(a.texto)) if (norm(b.texto).has(w)) return true;
    return false;
  })();
  if (!comparten && similitud(a.texto, b.texto) < 0.35) return false;
  const na = numerosDe(a.texto);
  const nb = numerosDe(b.texto);
  if (na.length === 0 || nb.length === 0) return false;
  // ¿algún par de medidas que difiera? (misma magnitud, valor distinto)
  return na.some((x) => nb.some((y) => x !== y));
}

/** Puntuación de autoridad de una regla: capa (peso grande; autoridad 1 =
 * preferencia = máxima) + calidad de uso como desempate fino. */
function autoridadDe(r: ReglaGlobal): number {
  const capa = CAPAS_CONOCIMIENTO[capaDe(r)];
  return (7 - capa.autoridad) * 1000 + r.peso * (r.usos + 1) * 10;
}

/* ------------------------------ fusión ---------------------------------- */

export interface InformeFusion {
  aceptadas: number;
  duplicadas: number;
  /** conflictos resueltos: la regla nueva ganó y una vieja quedó superada */
  conflictosGanados: number;
  /** la regla nueva perdió contra una regla de más autoridad */
  conflictosPerdidos: number;
}

/** Variante con informe: devuelve el almacén Y el recuento de lo ocurrido
 * (dedupes, conflictos ganados/perdidos). La usa el host para informes y la
 * UI; `fusionarReglas` es el atajo clásico. */
export function fusionarReglasConInforme(
  almacen: ConocimientoGlobal,
  nuevas: ReglaGlobal[]
): { almacen: ConocimientoGlobal; informe: InformeFusion } {
  let reglas = [...almacen.reglas];
  const informe: InformeFusion = {
    aceptadas: 0,
    duplicadas: 0,
    conflictosGanados: 0,
    conflictosPerdidos: 0,
  };

  for (const n of nuevas) {
    // PRIMERO conflictos: «usa 16px» y «usa 24px» son casi idénticas en
    // palabras (el dedupe las trataría como la misma regla y callaría el
    // conflicto), así que el arbitraje va antes del dedupe.
    const rivales = reglas.filter((r) => !r.superada && !r.caducada && conflictoEntre(r, n));
    if (rivales.length > 0) {
      const masFuerte = rivales.reduce((a, b) => (autoridadDe(b) > autoridadDe(a) ? b : a));
      if (autoridadDe(masFuerte) >= autoridadDe(n)) {
        informe.conflictosPerdidos++;
        continue;
      }
      reglas = reglas.map((r) => (r.id === masFuerte.id ? { ...r, superada: true } : r));
      informe.conflictosGanados++;
    }
    if (reglaDuplicada(reglas, n.texto)) {
      informe.duplicadas++;
      continue;
    }
    const igual = reglas.find((r) => r.id === n.id);
    if (igual) {
      reglas = reglas.map((r) => (r.id === n.id ? { ...r, peso: Math.max(r.peso, n.peso) } : r));
      informe.aceptadas++;
      continue;
    }
    reglas.push(n);
    informe.aceptadas++;
  }

  // topes por capa
  for (const capa of CAPAS_FORJA) {
    const max = CAPAS_CONOCIMIENTO[capa].max;
    const enCapa = reglas.filter((r) => capaDe(r) === capa && !r.superada);
    if (enCapa.length > max) {
      const aSalvar = new Set(
        [...enCapa]
          .sort((a, b) => b.peso * (b.usos + 1) - a.peso * (a.usos + 1))
          .slice(0, max)
          .map((r) => r.id)
      );
      reglas = reglas.map((r) =>
        capaDe(r) === capa && !r.superada && !aSalvar.has(r.id) ? { ...r, superada: true } : r
      );
    }
  }

  // candado global (solo expulsa de verdad si algo se desboca)
  if (reglas.filter((r) => !r.superada).length > MAX_REGLAS_GLOBALES) {
    const vivas = reglas
      .filter((r) => !r.superada)
      .sort((a, b) => b.peso * (b.usos + 1) - a.peso * (a.usos + 1))
      .slice(0, MAX_REGLAS_GLOBALES);
    const salvar = new Set(vivas.map((r) => r.id));
    reglas = reglas.filter((r) => !r.superada || salvar.has(r.id));
  }

  return { almacen: { ...almacen, reglas }, informe };
}

/** Fusiona reglas nuevas en el almacén:
 * 1. dedupe (similitud 0.55);
 * 2. conflicto numérico del mismo tema → gana la de más autoridad, la otra
 *    queda `superada` (auditada, fuera del prompt) o la nueva no entra;
 * 3. topes POR CAPA: si una capa se llena, cae la de menor peso·usos;
 * 4. tope global 180 como candado. */
export function fusionarReglas(
  almacen: ConocimientoGlobal,
  nuevas: ReglaGlobal[]
): ConocimientoGlobal {
  return fusionarReglasConInforme(almacen, nuevas).almacen;
}

/* ----------------------------- vigencia --------------------------------- */

/** Vigencia: las tendencias con `vigenciaHasta` vencido se marcan «caducada»
 * (fuera del prompt) y se BORRAN pasados 30 días de gracia. Las tendencias
 * sin fecha siguen con el decaimiento suave de siempre (6 meses → mitad). */
export function aplicarVigencia(
  almacen: ConocimientoGlobal,
  ahora = new Date()
): ConocimientoGlobal {
  const MESES = 1000 * 60 * 60 * 24 * 30.5;
  const GRACIA = 1000 * 60 * 60 * 24 * 30;
  const vivas: ReglaGlobal[] = [];
  for (const r of almacen.reglas) {
    if (r.categoria === "tendencia" && r.vigenciaHasta) {
      const fin = new Date(r.vigenciaHasta).getTime();
      if (Number.isFinite(fin) && ahora.getTime() > fin + GRACIA) continue; // borrada
      if (Number.isFinite(fin) && ahora.getTime() > fin) {
        vivas.push({ ...r, caducada: true });
        continue;
      }
    }
    if (r.categoria === "tendencia" && !r.vigenciaHasta) {
      const meses = Math.max(0, (ahora.getTime() - new Date(r.alta).getTime()) / MESES);
      vivas.push({ ...r, peso: Math.max(0.1, r.peso * Math.pow(0.89, meses)) });
      continue;
    }
    vivas.push(r);
  }
  return { ...almacen, reglas: vivas };
}

/* ---------------------------- para prompts ------------------------------ */

/** Etiqueta visible de capa para el prompt: el modelo sabe qué autoridad
 * tiene cada regla ([preferencia] manda, [fallo] no se repite…). */
function etiquetaDe(r: ReglaGlobal): string {
  const capa = capaDe(r);
  if (capa === "experimento" && typeof r.puntuacion === "number") {
    return `[experimento ${Math.round(r.puntuacion)}/100]`;
  }
  if (capa === "fallo" && typeof r.generacion === "number") {
    return `[fallo G${r.generacion}]`;
  }
  return `[${CAPAS_CONOCIMIENTO[capa].etiqueta}]`;
}

/** Cesta equilibrada por capa: se eligen reglas por ronda de autoridad
 * (1ª preferencia, 1er fallo, 1er experimento, 1er fundamento, 1er patrón,
 * 1ª tendencia, 2ª preferencia…), así ninguna capa acapara el presupuesto.
 * Excluye superadas y caducadas. */
export function conocimientoParaPrompt(
  almacen: ConocimientoGlobal,
  max: number,
  categorias?: CategoriaReglaForja[]
): string[] {
  const vivas = almacen.reglas.filter((r) => !r.superada && !r.caducada);
  const candidatas = categorias?.length
    ? vivas.filter((r) => categorias.includes(r.categoria))
    : vivas;
  const porCapa = new Map<CapaConocimiento, ReglaGlobal[]>();
  for (const capa of CAPAS_FORJA) {
    porCapa.set(
      capa,
      candidatas
        .filter((r) => capaDe(r) === capa)
        .sort((a, b) => b.peso * (b.usos + 1) - a.peso * (a.usos + 1))
    );
  }
  const salida: string[] = [];
  let indice = 0;
  while (salida.length < Math.max(0, max)) {
    let quedan = false;
    for (const capa of CAPAS_FORJA) {
      const lista = porCapa.get(capa) ?? [];
      if (indice < lista.length) {
        quedan = true;
        if (salida.length < max) salida.push(`${etiquetaDe(lista[indice])} ${lista[indice].texto}`);
      }
    }
    if (!quedan) break;
    indice++;
  }
  return salida;
}

/** Compatibilidad: nombre histórico. Ahora devuelve la cesta por capas. */
export function reglasGlobalesParaPrompt(
  almacen: ConocimientoGlobal,
  max: number,
  categorias?: CategoriaReglaForja[]
): string[] {
  return conocimientoParaPrompt(almacen, max, categorias);
}

/** Marca usos (el host lo llama tras una entrega aprobada con esas reglas). */
export function registrarUso(almacen: ConocimientoGlobal, textos: string[]): ConocimientoGlobal {
  const limpios = textos.map((t) => t.replace(/^\[[^\]]+\]\s*/, ""));
  const set = new Set(limpios);
  const setCrudo = new Set(textos);
  return {
    ...almacen,
    reglas: almacen.reglas.map((r) =>
      set.has(r.texto) || setCrudo.has(r.texto) ? { ...r, usos: r.usos + 1 } : r
    ),
  };
}

/* ------------------- lecciones de la Arena (evolución) ------------------- */

/** Una lección del juez de la Arena (v2.4: el juez no solo puntúa, enseña). */
export interface LeccionArena {
  /** destacar = funcionó muy bien; conservar = lo bueno del perdedor;
   * evitar = patrón que no debe repetirse */
  tipo: "destacar" | "conservar" | "evitar";
  texto: string;
  /** equipo al que se refiere, si el juez lo dijo */
  equipo?: "A" | "B";
}

/** Convierte lecciones del juez en conocimiento estratificado:
 *   destacar → experimento (con puntuación del ganador, normalizada 0..100)
 *   conservar → patrón («en este tipo de proyecto, esto funcionó»)
 *   evitar → fallo (ORO: no repetir)
 * Cada llamada avanza la generación evolutiva del almacén. Las lecciones
 * llegan del juez (modelo de confianza) pero se sanea igual que todo texto
 * que viaja a prompts futuros: una línea, sin controles, ≤220 chars. */
export function registrarLeccionesArena(
  almacen: ConocimientoGlobal,
  lecciones: LeccionArena[],
  opciones?: { puntuacionGanador?: number; contexto?: string }
): ConocimientoGlobal {
  const generacion = (almacen.generacion ?? 0) + 1;
  const nuevas: ReglaGlobal[] = [];
  for (const l of lecciones.slice(0, 6)) {
    const texto = l.texto.replace(/\s+/g, " ").trim().slice(0, 220);
    if (texto.length < 15) continue;
    const capa: CapaConocimiento =
      l.tipo === "destacar" ? "experimento" : l.tipo === "conservar" ? "patron" : "fallo";
    const categoria: CategoriaReglaForja =
      l.tipo === "evitar"
        ? "patron"
        : inferirCapa(texto, "patron") === "tendencia"
          ? "tendencia"
          : "patron";
    const prefijo = `[Arena G${generacion}] ${l.tipo === "evitar" ? "Evitar" : l.tipo === "conservar" ? "Conservar" : "Funcionó"}: `;
    const regla: ReglaGlobal = {
      id: `arena_g${generacion}_${Date.now().toString(36)}_${nuevas.length}`,
      texto: `${prefijo}${texto}`,
      categoria,
      capa,
      contexto: opciones?.contexto,
      generacion,
      puntuacion:
        capa === "experimento" && typeof opciones?.puntuacionGanador === "number"
          ? Math.max(0, Math.min(100, Math.round((opciones.puntuacionGanador / 50) * 100)))
          : undefined,
      origen: "arena",
      peso: 1,
      alta: new Date().toISOString(),
      usos: 0,
    };
    if (reglaDuplicada(nuevas, regla.texto)) continue;
    nuevas.push(regla);
  }
  const fusionado = fusionarReglas({ ...almacen, generacion }, nuevas);
  return fusionado;
}

/** Preferencia explícita del dueño («odio los carruseles»): capa preferencia,
 * peso 1, siempre primera de la cesta. La llama el host desde el panel o
 * desde una orden de chat aprobada. */
export function registrarPreferencia(almacen: ConocimientoGlobal, texto: string): ConocimientoGlobal {
  const limpio = texto.replace(/\s+/g, " ").trim().slice(0, 220);
  if (limpio.length < 8) return almacen;
  const regla: ReglaGlobal = {
    id: `pref_${Date.now().toString(36)}`,
    texto: limpio,
    categoria: inferirCapa(limpio, "layout") === "tendencia" ? "tendencia" : "layout",
    capa: "preferencia",
    origen: "usuario",
    peso: 1,
    alta: new Date().toISOString(),
    usos: 0,
  };
  return fusionarReglas(almacen, [regla]);
}

/** Cuentas por capa, para el panel de Ajustes y el informe del ciclo. */
export function estadisticasPorCapa(almacen: ConocimientoGlobal): Record<CapaConocimiento, number> {
  const out = { preferencia: 0, fallo: 0, experimento: 0, fundamento: 0, patron: 0, tendencia: 0 } as Record<
    CapaConocimiento,
    number
  >;
  for (const r of almacen.reglas) {
    if (r.superada || r.caducada) continue;
    out[capaDe(r)]++;
  }
  return out;
}

/* ------------------------- persistencia helpers ------------------------- */

export function serializarConocimiento(a: ConocimientoGlobal): string {
  return JSON.stringify(a);
}

/** Deserializa y MIGRA: las reglas antiguas (sin capa) la reciben inferida,
 * las capas desconocidas se corrigen y la generación arranca en 0. */
export function deserializarConocimiento(s: string | null | undefined): ConocimientoGlobal {
  if (!s) return CONOCIMIENTO_GLOBAL_DEFECTO;
  try {
    const p = JSON.parse(s) as Partial<ConocimientoGlobal>;
    if (!Array.isArray(p.reglas)) return CONOCIMIENTO_GLOBAL_DEFECTO;
    const reglas = p.reglas
      .filter(
        (r): r is ReglaGlobal =>
          typeof r?.texto === "string" &&
          typeof r?.categoria === "string" &&
          CATEGORIAS_FORJA.includes(r.categoria as CategoriaReglaForja)
      )
      .map((r) => ({ ...r, capa: capaDe(r) }));
    return {
      reglas,
      ultimaLectura: p.ultimaLectura ?? {},
      ultimoCiclo: p.ultimoCiclo,
      generacion: typeof p.generacion === "number" ? p.generacion : 0,
    };
  } catch {
    return CONOCIMIENTO_GLOBAL_DEFECTO;
  }
}
