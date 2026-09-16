/** FORJA IA — DIRECTOR CREATIVO 2.0 (v4.0.0, fase 5 del plan maestro).
 *
 * El Director de v3 (director.ts, «El Estudio») ya generaba 3 visiones
 * divergentes, pero el plan exige un paso más: las visiones deben
 * diferenciarse por REPRESENTACIÓN, ESTRUCTURA, NARRATIVA, INTERACCIÓN y
 * COMPOSICIÓN — no solamente por color, fuente o gradiente. Tres paletas
 * distintas con la misma estructura son tres plantillas, no tres ideas.
 *
 * v4.5.0 — CORRECCIÓN §1/§3/§23 (fin del sesgo editorial): el orden de las
 * visiones de respaldo YA NO empieza por editorial. La secuencia
 * ["editorial", "espacial", "cinematica"] era una preferencia creativa
 * implícita. Ahora: INTENCIÓN → FAMILIA DE EXPERIENCIA → RECETA →
 * COMPOSICIÓN (familias-experiencia.ts), y editorial solo cuando la
 * intención real es editorial (blog/revista/artículo/noticias).
 *
 * Arquetipos canónicos del plan (ejemplo):
 *
 *   A — Editorial      (estructura de revista, narrativa de texto)
 *   B — Spatial        (estructura espacial, navegación como lugar)
 *   C — Cinematic      (estructura de secuencias, ritmo de plano)
 *
 * Cada visión EXPLICA: qué representa, por qué, qué información prioriza,
 * qué interacción propone, qué riesgo tiene y a qué usuario beneficia.
 * El ADN 2.0 manda: las tres visiones son variaciones del MISMO ADN.
 *
 * Todo el módulo sigue la disciplina del resto: parse por etiquetas
 * (los modelos gratis fallan con JSON), topes y fallbacks, funciones puras.
 */

import type { AdnVisual2, EvidenciaJuez } from "./tipos-v4";
import { seccionAdn2 } from "./adn2";
import { listaLimpia } from "./tipos-v4";
import { seleccionarFamilia, seccionFamilias, FAMILIAS, type FamiliaExperiencia } from "./familias-experiencia";
import { seccionPatronesPositivos } from "./patrones-positivos";
import { seccionAntiRepeticion, obtenerHistorial } from "./anti-repetition";

/* -------------------------------- tipos ----------------------------------- */

/** Arquetipo de visión. No son «colores»: son formas de PENSAR la página. */
export type ArquetipoVision =
  | "editorial"
  | "espacial"
  | "cinematica"
  | "cartografica"
  | "conversacional"
  | "modular";

/** Una visión creativa 2.0. Campos del plan: representación, estructura,
 * narrativa, interacción y composición + la explicación completa. */
export interface Vision2 {
  /** A / B / C */
  letra: "A" | "B" | "C";
  nombre: string;
  arquetipo: ArquetipoVision;
  /** cómo se representa la información de ESTE negocio (de representacion.ts) */
  representacion: string;
  /** estructura de la página, por secciones con intención */
  estructura: string[];
  /** la narrativa: qué historia cuenta el scroll */
  narrativa: string;
  /** la interacción propuesta (no el hover genérico) */
  interaccion: string;
  /** composición: retícula, foco, densidad */
  composicion: string;
  /** paleta y tipografía: sirven a lo anterior, no lo sustituyen */
  paleta: string;
  tipografia: string;
  /** explicación completa (plan: qué representa, por qué, qué prioriza,
   * qué interacción, qué riesgo, qué usuario beneficia) */
  porQue: string;
  quePrioriza: string;
  riesgo: string;
  usuarioBeneficiado: string;
}

/** El panel de jueces opina con EVIDENCIA sobre cada visión (jueces2.ts);
 * aquí solo el tipo de nota simplificado para el flujo del Director. */
export interface NotaVision2 {
  letra: "A" | "B" | "C";
  nota: number;
  evidencia: EvidenciaJuez;
}

/** La fusión del Director Final: parte de una base y qué toma de cada una. */
export interface Fusion2 {
  base: "A" | "B" | "C";
  /** qué toma de cada visión (incluida la base) */
  tomaDe: { de: "A" | "B" | "C"; que: string }[];
  /** el concepto fusionado en una frase */
  concepto: string;
}

/* ------------------- familias → arquetipos (v4.5, §3) ---------------------- */

/** Mapping familia de experiencia → arquetipo de visión: las familias del
 * doc (spatial/immersive/product/…) viven en el vocabulario del Director. */
export function arquetipoDeFamilia(f: FamiliaExperiencia): ArquetipoVision {
  const mapa: Record<FamiliaExperiencia, ArquetipoVision> = {
    spatial: "espacial",
    immersive: "espacial",
    product: "modular",
    cinematic: "cinematica",
    interactive: "conversacional",
    "3d-showcase": "espacial",
    modular: "modular",
    editorial: "editorial",
    minimal: "modular",
    dashboard: "cartografica",
  };
  return mapa[f] ?? "modular";
}

/** Las tres familias a explorar: la elegida por intención + dos de
 * contraste, GARANTIZANDO tres arquetipos distintos (divergencia
 * estructural real: tres visiones con la misma estructura son tres
 * plantillas). Editorial solo entra con intención editorial (§23). */
function tresFamilias(mensaje: string): FamiliaExperiencia[] {
  const sel = seleccionarFamilia(mensaje);
  const out: FamiliaExperiencia[] = [sel.familia];
  const usadas = new Set<FamiliaExperiencia>([sel.familia]);
  const arqUsados = new Set<ArquetipoVision>([arquetipoDeFamilia(sel.familia)]);
  const pideEditorial = /\b(blog|revista|magazine|art[ií]culo|noticias?|publicaci[óo]n|editorial)\b/i.test(mensaje);
  const candidatas: FamiliaExperiencia[] = [sel.alternativa, ...FAMILIAS.map((f) => f.id)];
  for (const f of candidatas) {
    if (out.length >= 3) break;
    if (usadas.has(f)) continue;
    if (f === "editorial" && !pideEditorial) continue; // §23
    const a = arquetipoDeFamilia(f);
    if (arqUsados.has(a)) continue;
    out.push(f);
    usadas.add(f);
    arqUsados.add(a);
  }
  while (out.length < 3) out.push("dashboard");
  return out.slice(0, 3);
}

/* ------------------------- arquetipos y respaldo --------------------------- */

/** Definición de cada arquetipo: la diferencia ESTRUCTURAL que el plan exige. */
export const ARQUETIPOS: ReadonlyArray<{
  id: ArquetipoVision;
  nombre: string;
  representacionTipica: string;
  estructuraTipica: string[];
  narrativaTipica: string;
  interaccionTipica: string;
  composicionTipica: string;
}> = [
  {
    id: "editorial",
    nombre: "Editorial",
    representacionTipica: "texto protagonista con jerarquía de revista",
    estructuraTipica: ["portada de titular", "sumario navegado", "artículos asimétricos", "cierre con firma"],
    narrativaTipica: "leer con orden, como una publicación",
    interaccionTipica: "lectura continua con anclas y progreso",
    composicionTipica: "retícula editorial asimétrica, mucho aire, foco en el titular",
  },
  {
    id: "espacial",
    nombre: "Espacial",
    representacionTipica: "mapa o plano navegable",
    estructuraTipica: ["vista general", "zonas navegables", "detalle al entrar", "retorno claro"],
    narrativaTipica: "explorar un lugar, no deslizar una lista",
    interaccionTipica: "navegación espacial con zoom/paneo o scroll por zonas",
    composicionTipica: "composición por capas con foco móvil",
  },
  {
    id: "cinematica",
    nombre: "Cinematográfica",
    representacionTipica: "secuencia de planos con ritmo",
    estructuraTipica: ["plano de impacto", "desarrollo en actos", "detalle íntimo", "cierre con acción"],
    narrativaTipica: "paso de página = cambio de plano",
    interaccionTipica: "scroll orquestado con entradas y salidas",
    composicionTipica: "planos de pantalla completa con respiros",
  },
  {
    id: "cartografica",
    nombre: "Cartográfica",
    representacionTipica: "línea de tiempo o recorrido",
    estructuraTipica: ["origen", "hito a hito", "presente", "próximo paso"],
    narrativaTipica: "progreso visible hacia un objetivo",
    interaccionTipica: "avance marcado con estado y retroceso seguro",
    composicionTipica: "eje dominante con hitos fuertes",
  },
  {
    id: "conversacional",
    nombre: "Conversacional",
    representacionTipica: "diálogo guiado por preguntas",
    estructuraTipica: ["pregunta inicial", "respuestas ramificadas", "resumen vivo", "acción"],
    narrativaTipica: "el contenido responde al usuario",
    interaccionTipica: "elección, feedback inmediato, ajuste",
    composicionTipica: "un foco único, sin distracciones laterales",
  },
  {
    id: "modular",
    nombre: "Modular",
    representacionTipica: "módulos asimétricos de distinto peso",
    estructuraTipica: ["módulo dominante", "módulos de apoyo desiguales", "módulo de datos", "módulo de acción"],
    narrativaTipica: "el peso de cada módulo ES la jerarquía",
    interaccionTipica: "módulos expandibles con contenido real",
    composicionTipica: "retícula rota con intencionalidad, densidad variable",
  },
];

export function arquetipoPorId(id: string): (typeof ARQUETIPOS)[number] | undefined {
  return ARQUETIPOS.find((a) => a.id === id);
}

/** Visiones de respaldo deterministas (sin modelo): tres FAMILIAS DE
 * EXPERIENCIA con su estructura — la elegida por intención primero, luego
 * alternativas de contraste. EDITORIAL ya no encabeza por defecto (v4.5,
 * corrección §1/§23). Nunca bloquea el flujo. */
export function visionesDeRespaldo(mensaje: string): Vision2[] {
  const m = (mensaje || "").toLowerCase();
  const Datos = /\b(dato|estad|m[eé]tric|analitic|report|financ)/.test(m);
  const familias: FamiliaExperiencia[] = Datos ? ["dashboard", "modular", "spatial"] : tresFamilias(m);
  return familias.map((id, i) => {
    const arq = arquetipoDeFamilia(id);
    const a = arquetipoPorId(arq)!;
    const def = FAMILIAS.find((f) => f.id === id);
    return {
      letra: (["A", "B", "C"] as const)[i],
      nombre: `${def?.nombre ?? a.nombre} ${Datos ? "de datos" : "prisma"}`,
      arquetipo: a.id,
      representacion: def ? def.descripcion : a.representacionTipica,
      estructura: a.estructuraTipica,
      narrativa: a.narrativaTipica,
      interaccion: a.interaccionTipica,
      composicion: a.composicionTipica,
      paleta: "según ADN 2.0 (dominante + un acento)",
      tipografia: "según ADN 2.0 (display + texto)",
      porQue: `La familia «${def?.nombre ?? id}» encaja porque ${def ? `produce una experiencia donde ${def.paraQue}` : `su ${a.representacionTipica} ordena la información`} sin recurrir a tarjetas genéricas.`,
      quePrioriza: "lo esencial primero; el resto se gana su sitio",
      riesgo: def?.riesgo ?? (a.id === "cinematica" ? "el ritmo puede sacrificar densidad de contenido" : "el orden no convencional exige una navegación impecable"),
      usuarioBeneficiado: "quien decide rápido y necesita entender sin leer todo",
    };
  });
}

/* -------------------------------- prompt ----------------------------------- */

/** Prompt del Director Creativo 2.0. Pide EXACTAMENTE el formato que el
 * parser entiende: un bloque <vision2> por dirección con campos fijos.
 * v4.5: añade la FAMILIA DE EXPERIENCIA decidida por intención (§1/§3),
 * la regla de seguridad creativa §23, la biblioteca positiva §14 y la
 * advertencia de anti-repetición §13 — el Director recibe dirección, no
 * la improvisa. */
export function promptDirector2(mensaje: string, adn2: AdnVisual2, familiasForzadas?: string[]): string {
  const sel = seleccionarFamilia(mensaje);
  const antRep = seccionAntiRepeticion(
    (() => {
      const h = obtenerHistorial();
      return {
        puntos: h.length,
        repeticiones: [],
        consejo: h.length ? "no repitas el hero de las últimas generaciones" : "",
      };
    })()
  );
  // v4.6 F — Arena de familias: cada visión corre EN una familia distinta
  const bloqueFamilias =
    familiasForzadas && familiasForzadas.length
      ? [
          `## FAMILIAS ASIGNADAS POR LA ARENA (v4.6, diferencia ESTRUCTURAL)`,
          ...familiasForzadas.map((f, i) => `- VISIÓN ${(["A", "B", "C"] as const)[i]}: sigue la familia «${f}» — su definición abajo en el bloque de familias de experiencia.`),
          `La diferencia entre visiones debe NOTARSE en los primeros 3 segundos: estructuras, profundidad y movimiento distintos, no paletas.`,
        ].join("\n")
      : "";
  return [
    `## Tu papel: DIRECTOR CREATIVO de FORJA IA`,
    `Proyecto: «${mensaje.slice(0, 300)}»`,
    ``,
    bloqueFamilias,
    bloqueFamilias ? `` : ``,
    seccionFamilias(sel),
    ``,
    seccionPatronesPositivos(mensaje, 6),
    ``,
    seccionAdn2(adn2),
    ``,
    antRep,
    ``,
    `## Cómo trabajas (REGLAS)`,
    `1. Las tres visiones son variaciones del MISMO ADN: jamás tres webs distintas.`,
    `2. Difieren por REPRESENTACIÓN, ESTRUCTURA, NARRATIVA, INTERACCIÓN y COMPOSICIÓN. Dos paletas con la misma estructura = SUSPENDIDO.`,
    `3. ${
      familiasForzadas && familiasForzadas.length
        ? `La ARENA ya asignó una familia a cada visión (arriba): cada visión ES su familia, con su vocabulario de espacio/movimiento/superficie.`
        : `La primera visión TRABAJA DENTRO de la familia decidida; las otras dos exploran familias vecinas (ver arriba).`
    }`,
    `4. Cada visión explica: qué representa, por qué, qué prioriza, qué interacción propone, qué riesgo tiene y qué usuario beneficia.`,
    `5. Prohibido proponer: hero centrado, tres tarjetas gemelas, gradientes decorativos, glassmorphism, dashboard de cajitas.`,
    `6. Si el brief pide moderno/premium/futurista/3D/inmersivo/interactivo: EDITORIAL PROHIBIDA salvo intención editorial real (§23).`,
    ``,
    `## Formato de salida (EXACTO, tres bloques)`,
    `<vision2 letra="A">`,
    `Nombre: ...`,
    `Arquetipo: editorial|espacial|cinematica|cartografica|conversacional|modular`,
    `Representación: (cómo se representa la información de este negocio)`,
    `Estructura: (3-4 secciones separadas por ;)`,
    `Narrativa: (qué historia cuenta el scroll)`,
    `Interacción: (la propuesta concreta, no «hover»)`,
    `Composición: (retícula, foco, densidad)`,
    `Paleta: (hex + intención)`,
    `Tipografía: (pareja + escala)`,
    `Por qué: (por qué sirve para ESTE proyecto)`,
    `Prioriza: (qué información va primero)`,
    `Riesgo: (qué puede salir mal)`,
    `Beneficia a: (qué usuario)`,
    `</vision2>`,
    `... (letra="B" con otro arquetipo, letra="C" con el tercero)`,
  ].join("\n");
}

/** Prompt del Director Final para la FUSIÓN (Diseño Fusión del plan). */
export function promptDirectorFusion2(
  visiones: Vision2[],
  notas: NotaVision2[]
): string {
  const resumen = visiones
    .map((v) => {
      const nota = notas.find((n) => n.letra === v.letra);
      return `- ${v.letra} «${v.nombre}» (${v.arquetipo}, nota ${nota?.nota ?? "—"}): ${v.representacion}. Riesgo: ${v.riesgo}.`;
    })
    .join("\n");
  return [
    `## DIRECTOR FINAL: Diseño Fusión`,
    `Visiones y notas del panel:`,
    resumen,
    ``,
    `Elige la BASE (la que mejor cumple el ADN) y construye la fusión: toma lo mejor de las demás. La fusión debe ser UNA página concreta, no un promedio difuso.`,
    ``,
    `<fusion2>`,
    `Base: A|B|C`,
    `Toma de A: (qué y por qué)`,
    `Toma de B: (qué y por qué)`,
    `Toma de C: (qué y por qué)`,
    `Concepto: (la fusión en una frase)`,
    `</fusion2>`,
  ].join("\n");
}

/* -------------------------------- parser ----------------------------------- */

function letraValida(l: string): "A" | "B" | "C" | null {
  const u = l.trim().toUpperCase();
  return u === "A" || u === "B" || u === "C" ? u : null;
}

function campo(bloque: string, nombres: string): string {
  const re = new RegExp(`^\\s*${nombres}\\s*:\\s*(.+)$`, "im");
  return (bloque.match(re)?.[1] ?? "").replace(/\s+/g, " ").trim();
}

/** Parser tolerante de <vision2 letra="A">…</vision2>. Tole de 3 visiones. */
export function parseVisiones2(texto: string): Vision2[] {
  if (!texto) return [];
  const out: Vision2[] = [];
  const re = /<vision2\s+letra\s*=\s*"?([abcABC])"?[^>]*>([\s\S]*?)<\/vision2>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null && out.length < 3) {
    const letra = letraValida(m[1]);
    const cuerpo = m[2];
    if (!letra) continue;
    const estructura = listaLimpia(campo(cuerpo, "Estructura").split(";"), 5, 90);
    const arquetipoRaw = campo(cuerpo, "Arquetipo").toLowerCase();
    const arquetipo: ArquetipoVision =
      arquetipoPorId(arquetipoRaw)?.id ?? ARQUETIPOS[out.length % ARQUETIPOS.length].id;
    out.push({
      letra,
      nombre: campo(cuerpo, "Nombre").slice(0, 48) || `Visión ${letra}`,
      arquetipo,
      representacion: campo(cuerpo, "Representaci[óo]n").slice(0, 140),
      estructura: estructura.length ? estructura : ["apertura", "desarrollo", "cierre"],
      narrativa: campo(cuerpo, "Narrativa").slice(0, 160),
      interaccion: campo(cuerpo, "Interacci[óo]n").slice(0, 160),
      composicion: campo(cuerpo, "Composici[óo]n").slice(0, 160),
      paleta: campo(cuerpo, "Paleta").slice(0, 160),
      tipografia: campo(cuerpo, "Tipograf[ií]a").slice(0, 120),
      porQue: campo(cuerpo, "Por qu[eé]").slice(0, 220),
      quePrioriza: campo(cuerpo, "Prioriza").slice(0, 160),
      riesgo: campo(cuerpo, "Riesgo").slice(0, 160),
      usuarioBeneficiado: campo(cuerpo, "Beneficia a").slice(0, 140),
    });
  }
  return out;
}

/** Parser tolerante de <fusion2>. Si falta todo, base = la de mejor nota. */
export function parseFusion2(texto: string, mejorNota: "A" | "B" | "C"): Fusion2 {
  const bloque = texto.match(/<fusion2>([\s\S]*?)<\/fusion2>/i)?.[1] ?? "";
  const base = letraValida(campo(bloque, "Base") || mejorNota) ?? mejorNota;
  const tomaDe: Fusion2["tomaDe"] = [];
  for (const l of ["A", "B", "C"] as const) {
    const que = campo(bloque, `Toma de ${l}`);
    if (que) tomaDe.push({ de: l, que: que.slice(0, 160) });
  }
  return {
    base,
    tomaDe,
    concepto: campo(bloque, "Concepto").slice(0, 200) || "fusión de las visiones mejor valoradas",
  };
}

/* ------------------------------ salidas texto ------------------------------ */

/** Explicación de una visión para el chat (lo que el plan pide que diga). */
export function explicarVision2(v: Vision2): string {
  return [
    `**${v.letra} — ${v.nombre}** (arquetipo ${v.arquetipo})`,
    `Representa: ${v.representacion}`,
    `Estructura: ${v.estructura.join(" → ")}`,
    `Narrativa: ${v.narrativa}`,
    `Interacción: ${v.interaccion}`,
    `Composición: ${v.composicion}`,
    `Por qué: ${v.porQue}`,
    `Prioriza: ${v.quePrioriza}`,
    `Riesgo: ${v.riesgo}`,
    `Beneficia a: ${v.usuarioBeneficiado}`,
  ].join("\n");
}

/** Bloque que viaja al maquetador para convertir una visión en maqueta. */
export function seccionVisionParaMaqueta(v: Vision2, adn2: AdnVisual2): string {
  return [
    `# Visión a maquetar: ${v.nombre} (arquetipo ${v.arquetipo})`,
    `Representación: ${v.representacion}`,
    `Estructura obligatoria: ${v.estructura.join(" → ")}`,
    `Narrativa: ${v.narrativa}`,
    `Interacción: ${v.interaccion}`,
    `Composición: ${v.composicion}`,
    seccionAdn2(adn2),
  ].join("\n");
}
