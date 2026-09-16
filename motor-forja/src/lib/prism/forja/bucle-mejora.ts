/** FORJA IA — BUCLE AUTÓNOMO DE MEJORA (v4.0.0, fase 11 del plan maestro).
 *
 * El plan exige este ciclo, con tope y sin bucles infinitos:
 *
 *   GENERAR → INSPECCIONAR → CRITICAR → CORREGIR → RENDERIZAR
 *        → COMPARAR → ¿MEJORÓ? ── sí → continuar (hasta 3)
 *                          └── no → REVERTIR
 *
 * Máximo recomendado inicialmente: 3 iteraciones automáticas
 * (MAX_ITERACIONES_MEJORA). Nunca un bucle infinito.
 *
 * La comparación «¿mejoró?» es DETERMINISTA: score = f(hallazgos críticos,
 * avisos, identidad anti-genérica, auditoría de sistema). Si la versión
 * corregida no supera a la anterior, se REVIERTEN los cambios (rollback)
 * y el bucle termina: sin girar en falso.
 *
 * Correcciones: el Codificador (modelo inyectado) aplica las correcciones;
 * si no hay modelo, el bucle aplica su juego de correcciones deterministas
 * (las mecánicas y seguras: lang, alt-placeholder prohibido NO, viewport,
 * noopener) y deja las demás señaladas para el Revisor humano.
 */

import type { DesignSystemPrisma } from "./bridge-design-system";
import { revisarVisual, defectosCorregibles, type InformeRevisorVisual } from "./revisor-visual";
import type { LlamadaModelo } from "./tipos";
import {
  continuarSalidaTruncada,
  continuarConLlamada,
} from "./continuacion-nucleo";

/** Tope duro del plan: 3 iteraciones automáticas. */
export const MAX_ITERACIONES_MEJORA = 3;

/** Una iteración del bucle, para la traza de la UI. */
export interface IteracionMejora {
  n: number;
  /** qué se intentó corregir */
  objetivos: string[];
  /** nº de correcciones aplicadas al HTML */
  aplicadas: number;
  /** score antes y después (0..100) */
  scoreAntes: number;
  scoreDespues: number;
  /** ¿mejoró? si no, se revirtió */
  mejoro: boolean;
  veredicto: InformeRevisorVisual["veredicto"];
}

export interface ResultadoBucle {
  /** el HTML final: el MEJOR visto (revertido si una iteración empeoró) */
  html: string;
  informeFinal: InformeRevisorVisual;
  iteraciones: IteracionMejora[];
  /** nº real de iteraciones ejecutadas (0 = aprobó a la primera) */
  iteracionesUsadas: number;
  /** traza para observabilidad y UI */
  traza: string[];
}

export interface DepsBucle {
  llamarModelo?: LlamadaModelo;
  modelo?: { providerId: string; modelId: string };
  ds?: DesignSystemPrisma;
  onProgreso?: (evento: string) => void;
}

/* ------------------------------- score ------------------------------------- */

/** Score determinista de una entrega: 100 - 18xcrítico - 6xaviso - 2xmejora
 * - (100-identidad)*0.2. Cuanto más alto, mejor. Comparación estable. */
export function scoreDe(inf: InformeRevisorVisual): number {
  const penal = inf.criticos * 18 + inf.avisos * 6 + inf.mejoras * 2;
  const penalIdentidad = (100 - inf.identidad) * 0.2;
  return Math.max(0, Math.round(100 - penal - penalIdentidad));
}

/* --------------------------- correcciones mecánicas ------------------------ */

/** Correcciones deterministas SEGURAS (no cambian diseño, solo defectos
 * objetivos). Cada una: condición + parche. */
const CORRECCIONES_MECANICAS: { nombre: string; aplica: (h: string) => boolean; parche: (h: string) => string }[] = [
  {
    nombre: "lang en <html>",
    aplica: (h) => /<html(?![^>]*\slang=)/i.test(h),
    parche: (h) => h.replace(/<html/i, '<html lang="es"'),
  },
  {
    nombre: "meta viewport",
    aplica: (h) => !/<meta[^>]*name=["']?viewport/i.test(h) && /<head[^>]*>/i.test(h),
    parche: (h) => h.replace(/<head([^>]*)>/i, '<head$1>\n<meta name="viewport" content="width=device-width, initial-scale=1">'),
  },
  {
    nombre: "charset utf-8",
    aplica: (h) => !/<meta[^>]*charset/i.test(h) && /<head[^>]*>/i.test(h),
    parche: (h) => h.replace(/<head([^>]*)>/i, '<head$1>\n<meta charset="utf-8">'),
  },
  {
    nombre: "noopener en _blank",
    aplica: (h) => /target=["']?_blank/i.test(h) && !/noopener/i.test(h),
    parche: (h) => h.replace(/target=["']?_blank(["']?)/gi, 'target="_blank"$1 rel="noopener"'),
  },
  {
    nombre: "title del documento",
    aplica: (h) => !/<title>\s*\S/i.test(h) && /<head[^>]*>/i.test(h),
    parche: (h) => h.replace(/<head([^>]*)>/i, "<head$1>\n<title>Proyecto FORJA IA</title>"),
  },
];

function aplicarCorreccionesMecanicas(html: string): { html: string; aplicadas: string[] } {
  const aplicadas: string[] = [];
  let out = html;
  for (const c of CORRECCIONES_MECANICAS) {
    if (c.aplica(out)) {
      out = c.parche(out);
      aplicadas.push(c.nombre);
    }
  }
  return { html: out, aplicadas };
}

/* --------------------------------- bucle ------------------------------------ */

/** Ejecuta el bucle de mejora autónomo sobre un HTML. Sin modelo aplica
 * solo correcciones mecánicas; con modelo manda las correcciones al
 * Codificador. Nunca más de MAX_ITERACIONES_MEJORA vueltas. */
export async function ejecutarBucleMejora(htmlInicial: string, deps: DepsBucle = {}): Promise<ResultadoBucle> {
  const traza: string[] = [];
  const iteraciones: IteracionMejora[] = [];
  let mejorHtml = htmlInicial;
  let mejorScore = 0;
  let informe = revisarVisual(mejorHtml, { ds: deps.ds });
  mejorScore = scoreDe(informe);
  traza.push(`[bucle] score inicial ${mejorScore} (${informe.veredicto})`);

  let n = 0;
  while (n < MAX_ITERACIONES_MEJORA && informe.veredicto !== "PASS") {
    n += 1;
    const scoreAntes = mejorScore;
    const objetivos = defectosCorregibles(informe);
    if (!objetivos.length) {
      traza.push(`[bucle] iter ${n}: sin defectos corregibles, fin`);
      break;
    }
    traza.push(`[bucle] iter ${n}: ${objetivos.length} objetivo(s)`);

    // CORREGIR
    let htmlCandidato = "";
    let aplicadas: string[] = [];
    if (deps.llamarModelo && deps.modelo) {
      try {
        htmlCandidato = await deps.llamarModelo({
          providerId: deps.modelo.providerId,
          modelId: deps.modelo.modelId,
          system: [
            `Eres el Codificador de FORJA IA en modo CORRECCIÓN.`,
            `Te doy el HTML actual y la lista de defectos con su corrección propuesta.`,
            `Devuelve el HTML COMPLETO corregido. Solo corrige lo indicado: no rediseñes, no cambies el ADN, no añadas efectos.`,
            `Formato: solo el código HTML (sin explicaciones).`,
          ].join("\n"),
          user: [
            `# Defectos a corregir`,
            ...objetivos.map((o, i) => `${i + 1}. ${o.titulo} → ${o.correccion}`),
            ``,
            `# HTML actual`,
            mejorHtml.slice(0, 60000),
          ].join("\n"),
          temperatura: 0.2,
          rol: "codificador", // v4.1: corrección de página = salida larga garantizada
        });
        // v4.2 — segundo cinturón: la corrección devuelve la PÁGINA COMPLETA
        // y es candidata a cortarse; si quedó rota estructuralmente, se
        // continúa aquí en vez de descartarla y perder la iteración.
        const res = await continuarSalidaTruncada({
          salida: htmlCandidato,
          continuarCon: continuarConLlamada(deps.llamarModelo, {
            providerId: deps.modelo.providerId,
            modelId: deps.modelo.modelId,
            system: "Eres el Codificador de FORJA IA en modo CORRECCIÓN.",
            temperatura: 0.2,
            rol: "codificador",
          }),
        });
        htmlCandidato = res.texto;
        if (!/<html|<!doctype/i.test(htmlCandidato)) htmlCandidato = "";
      } catch {
        htmlCandidato = "";
      }
    }
    if (!htmlCandidato) {
      const mec = aplicarCorreccionesMecanicas(mejorHtml);
      htmlCandidato = mec.html;
      aplicadas = mec.aplicadas;
    } else {
      aplicadas = objetivos.map((o) => o.titulo);
    }

    // RENDERIZAR + COMPARAR
    const informeCandidato = revisarVisual(htmlCandidato, { ds: deps.ds });
    const scoreDespues = scoreDe(informeCandidato);
    const mejoro = scoreDespues > scoreAntes;
    iteraciones.push({
      n,
      objetivos: objetivos.map((o) => o.titulo),
      aplicadas: aplicadas.length,
      scoreAntes,
      scoreDespues,
      mejoro,
      veredicto: informeCandidato.veredicto,
    });
    traza.push(`[bucle] iter ${n}: ${scoreAntes} → ${scoreDespues} ${mejoro ? "MEJORÓ" : "sin mejora → REVERTIR"}`);

    if (mejoro) {
      mejorHtml = htmlCandidato;
      mejorScore = scoreDespues;
      informe = informeCandidato;
    } else {
      // REVERTIR: se conserva el mejor y el bucle termina (evitar girar en falso)
      break;
    }
  }

  return {
    html: mejorHtml,
    informeFinal: informe,
    iteraciones,
    iteracionesUsadas: n,
    traza,
  };
}
