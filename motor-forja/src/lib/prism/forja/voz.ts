/** FORJA IA — VOZ SEMÁNTICA de FORJA IA (v4.0.0, sección 22 del plan).
 *
 * De Stitch se toma la IDEA de dirección natural por voz, pero con la
 * regla del plan: «la voz debe convertirse en comandos semánticos». El
 * usuario nunca necesita conocer tokens CSS:
 *
 *   «Haz la página más elegante pero no quiero que se vuelva aburrida.»
 *
 *   FORJA interpreta:
 *     elegancia ↑
 *     densidad ↓
 *     espacio ↑
 *     decoración ↓
 *     personalidad → (se mantiene)
 *
 * Este módulo es el intérprete DETERMINISTA (léxico ES, funciona sin
 * modelo y sin red, instantáneo) + el contrato opcional de refinamiento
 * con modelo. Cada comando lleva su motivo (la frase que lo originó) para
 * trazabilidad total: el usuario puede ver POR QUÉ cambió cada eje.
 */

import type { ComandoSemantico, AdnVisual2 } from "./tipos-v4";
import { sanearAdn2 } from "./adn2";

/* ------------------------------- léxico ------------------------------------ */

/** Diccionario del intérprete: cada entrada mapea expresiones del usuario
 * a comandos semánticos. Escala de intensidad: «más»=2, «mucho más»=3,
 * «un poco más»=1, y sus negativos. */
interface EntradaLexico {
  /** variantes reconocidas (regex, ES, sin acentos obligatorios) */
  patron: RegExp;
  comandos: { dimension: string; direccion: "subir" | "bajar" | "fijar" | "mantener"; valor?: number }[];
}

const NEGADOR = /\b(sin|menos|nada de|no quiero|no la quiero|sin que)\b/i;
const MUCHO = /\b(mucho|much[oa]s|muy|super|súper|mucho m[aá]s|much[ií]sim)\b/i;
const POCO = /\b(un poco|ligera?mente|algo|sutil(?:mente)?)\b/i;

const ENTRADAS: EntradaLexico[] = [
  // Elegancia / lujo (ejemplo canónico del plan: elegancia ↑, densidad ↓,
  // espacio ↑, decoración ↓, personalidad →)
  { patron: /\belegan\w*|\bluj\w*|\brefinad\w*|\bpremium\b/i, comandos: [{ dimension: "elegancia", direccion: "subir" }, { dimension: "densidad", direccion: "bajar" }, { dimension: "espacio", direccion: "subir" }, { dimension: "decoracion", direccion: "bajar" }, { dimension: "personalidad", direccion: "mantener" }] },
  // Exclusividad (el ejemplo del plan)
  { patron: /\bexclusiv\w*|\búnico\w*|\bunic\w*|\bdiferente\b|\bdistinto\b/i, comandos: [{ dimension: "densidad", direccion: "bajar" }, { dimension: "espacio", direccion: "subir" }, { dimension: "jerarquia", direccion: "subir" }, { dimension: "repetitivos", direccion: "bajar" }, { dimension: "diferenciacion tipografica", direccion: "subir" }] },
  // Simple / limpio
  { patron: /\bsimple\b|\blimpio\w*|\bminimal\w*|\baire\b|\bdescargado\b/i, comandos: [{ dimension: "densidad", direccion: "bajar" }, { dimension: "espacio", direccion: "subir" }, { dimension: "decoracion", direccion: "bajar" }] },
  // Vivaz / divertido
  { patron: /\bvivaz\w*|\bdivertid\w*|\bjuguet[óo]n\w*|\benerg\w*|\bfresco\w*/i, comandos: [{ dimension: "energia", direccion: "subir" }, { dimension: "personalidad", direccion: "subir" }, { dimension: "movimiento", direccion: "subir" }] },
  // Serio / serio pero no aburrido
  { patron: /\bserio\w*|\bprofesional\b|\bcorporativ\w*|\bsobrio\w*/i, comandos: [{ dimension: "elegancia", direccion: "subir" }, { dimension: "energia", direccion: "bajar" }, { dimension: "confianza", direccion: "subir" }] },
  // Aburrido (señal de alerta: bajar elegancia excesiva, subir personalidad)
  { patron: /\baburrid\w*|\bsoso\w*|\bgen[ée]ric\w*|\bplantilla\b/i, comandos: [{ dimension: "personalidad", direccion: "subir" }, { dimension: "decoracion", direccion: "bajar" }] },
  // Tecnológico
  { patron: /\btecnol[óo]gic\w*|\bfuturista\b|\bmoderno\b|\bnuevo\b/i, comandos: [{ dimension: "innovacion", direccion: "subir" }, { dimension: "densidad", direccion: "bajar" }] },
  // Cálido / cercano
  { patron: /\bc[áa]lid\w*|\bcercan\w*|\bhumano\b|\bamigable\b/i, comandos: [{ dimension: "cercania", direccion: "subir" }, { dimension: "agresividad", direccion: "bajar" }] },
  // Oscuro / claro (tema)
  { patron: /\boscuro\b|\bdark\b/i, comandos: [{ dimension: "tema", direccion: "fijar", valor: 8 }] },
  { patron: /\bclaro\b|\bwhite\b|\blight\b/i, comandos: [{ dimension: "tema", direccion: "fijar", valor: 2 }] },
  // Tipografía protagonista
  { patron: /\btipograf[ií]a\s+(protagonista|m[aá]s grande|más protagon)/i, comandos: [{ dimension: "diferenciacion tipografica", direccion: "subir" }] },
  // Color
  { patron: /\bcolores?\b/i, comandos: [{ dimension: "expresion color", direccion: "subir" }] },
  // Velocidad / peso
  { patron: /\br[áa]pid\w*|\bligero\b|\bvelocidad\b/i, comandos: [{ dimension: "movimiento", direccion: "bajar" }, { dimension: "densidad", direccion: "bajar" }] },
];

/* ------------------------------ intérprete --------------------------------- */

/** Interpreta una frase (texto u homólogo de voz) en comandos semánticos.
 * Determinista: sin modelo, sin red, instantáneo. Cada comando lleva la
 * frase que lo motivó. */
export function interpretarVoz(frase: string): ComandoSemantico[] {
  const texto = (frase || "").trim();
  if (!texto) return [];
  const comandos: ComandoSemantico[] = [];
  const negativo = NEGADOR.test(texto);
  const mucho = MUCHO.test(texto);
  const poco = POCO.test(texto);
  const intensidad: 1 | 2 | 3 = mucho ? 3 : poco ? 1 : 2;

  for (const entrada of ENTRADAS) {
    const m = texto.match(entrada.patron);
    if (!m) continue;
    for (const c of entrada.comandos) {
      let direccion = c.direccion;
      // «sin decoración», «no quiero que se vuelva aburrida» — el negador
      // invierte las subidas de expresión (no las de limpieza)
      if (negativo && direccion === "subir" && /decoracion|energia|expresion|agresividad/i.test(c.dimension)) {
        direccion = "bajar";
      }
      comandos.push({
        dimension: c.dimension,
        direccion,
        valor: c.valor,
        intensidad,
        motivo: texto,
      });
    }
  }
  return dedupeComandos(comandos);
}

/** Dedupe conservando el primer comando por dimensión+dirección. */
function dedupeComandos(cs: ComandoSemantico[]): ComandoSemantico[] {
  const vistos = new Set<string>();
  const out: ComandoSemantico[] = [];
  for (const c of cs) {
    const clave = `${c.dimension}:${c.direccion}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(c);
  }
  return out;
}

/** Texto legible de los comandos (para el chat: «esto entendí»). */
export function textoComandos(cs: ComandoSemantico[]): string {
  if (!cs.length) return "(no entendí ningún ajuste concreto)";
  const flecha = { subir: "↑", bajar: "↓", fijar: "=", mantener: "→" } as const;
  return cs.map((c) => `${c.dimension} ${flecha[c.direccion]}${c.valor != null ? ` ${c.valor}` : ""} (x${c.intensidad})`).join("\n");
}

/* ------------------------- aplicación al ADN 2.0 ---------------------------- */

/** Aplica comandos semánticos a un ADN 2.0. No reescribe el ADN: lo AJUSTA
 * (ejes de sensación + listas afectadas), respetando prohibiciones duras. */
export function aplicarComandos(adn: AdnVisual2, comandos: ComandoSemantico[]): AdnVisual2 {
  let a = sanearAdn2({ ...adn });
  const deltaPorDimension = new Map<string, number>();
  for (const c of comandos) {
    const peso = c.direccion === "subir" ? c.intensidad : c.direccion === "bajar" ? -c.intensidad : 0;
    deltaPorDimension.set(c.dimension, (deltaPorDimension.get(c.dimension) ?? 0) + peso);
  }

  // 1. Ejes de sensación
  const sensacion = a.sensacion.map((e) => {
    const d = deltaPorDimension.get(e.eje) ?? 0;
    return d ? { eje: e.eje, valor: Math.max(0, Math.min(10, e.valor + d)) } : e;
  });
  // ejes nuevos que el ADN no tenía (p.ej. «elegancia ↑» sin eje elegancia)
  for (const [dim, delta] of deltaPorDimension) {
    if (sensacion.some((e) => e.eje === dim) || !/^[a-z ]{3,20}$/.test(dim) || delta === 0) continue;
    if (sensacion.length >= 6) break;
    sensacion.push({ eje: dim, valor: Math.max(0, Math.min(10, 5 + delta)) });
  }

  // 2. Lenguaje visual según los ajustes (el delta de cada eje ya está en
  // deltaPorDimension; apunta() lo consulta directamente)
  const lenguaje = [...a.lenguaje];
  const apunta = (dim: string, _delta: number, fraseSube: string, fraseBaja: string): void => {
    const d = deltaPorDimension.get(dim) ?? 0;
    if (d > 0 && !lenguaje.includes(fraseSube) && lenguaje.length < 8) lenguaje.push(fraseSube);
    if (d < 0 && !lenguaje.includes(fraseBaja) && lenguaje.length < 8) lenguaje.push(fraseBaja);
  };
  apunta("espacio", 1, "espacio negativo generoso", "composición compacta y contenida");
  apunta("densidad", -1, "pocos elementos por pantalla, solo lo esencial", "");
  apunta("decoracion", -1, "cero adorno sin función", "");
  apunta("personalidad", 1, "decisiones con carácter propio", "");
  apunta("movimiento", 1, "movimiento con propósito y breve", "estática deliberada");

  // 3. Interacción/identidad si pidió exclusividad
  const exclusivo = comandos.some((c) => /exclusiv|jerarquia|repetitivos/i.test(c.dimension) && c.direccion !== "mantener");
  const composicion = exclusivo && !a.composicion.some((c) => /asim|rompim|foco/i.test(c))
    ? [...a.composicion, "rompimiento de retícula en la sección clave, foco único"]
    : a.composicion;

  const resultado: AdnVisual2 = {
    ...a,
    sensacion,
    lenguaje,
    composicion,
  };
  return sanearAdn2(resultado);
}
/** Prompt opcional de refinamiento con modelo (cuando el léxico no llega).
 * Devuelve comandos <comandos> que se parsean con parseComandosModelo. */
export function promptRefinarVoz(frase: string, adn: AdnVisual2): string {
  return [
    `## Interpreta esta dirección del usuario`,
    `Frase: «${frase}»`,
    `ADN actual: ${adn.personalidad.join(", ")} · prohibiciones: ${adn.prohibiciones.join("; ")}`,
    ``,
    `Traduce a AJUSTES SEMÁNTICOS (no tokens CSS). Responde EXACTAMENTE:`,
    `<comandos>`,
    `dimension: subir|bajar|fijar N (x1-3)`,
    `...`,
    `</comandos>`,
    `Prohibido: gradientes automáticos, glassmorphism automático, efectos sin función.`,
  ].join("\n");
}

/** Parser del refinamiento con modelo. */
export function parseComandosModelo(texto: string, fraseOriginal: string): ComandoSemantico[] {
  const bloque = texto.match(/<comandos>([\s\S]*?)<\/comandos>/i)?.[1] ?? "";
  const out: ComandoSemantico[] = [];
  for (const m of bloque.matchAll(/^\s*([a-z á-ú]{3,30})\s*:\s*(subir|bajar|fijar)\s*(\d{1,2})?\s*(?:\(x([1-3])\))?/gim)) {
    out.push({
      dimension: m[1].trim(),
      direccion: m[2] as ComandoSemantico["direccion"],
      valor: m[3] != null ? Math.max(0, Math.min(10, Number(m[3]))) : undefined,
      intensidad: (Number(m[4]) || 2) as 1 | 2 | 3,
      motivo: fraseOriginal,
    });
  }
  return dedupeComandos(out);
}
