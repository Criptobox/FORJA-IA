/** FORJA IA — SALIDA TEMPRANA / EARLY EXIT (v4.4, sección 26 del plan).
 *
 * ─── El problema ───
 * El bucle de mejora (v4.0) hace SIEMPRE hasta 3 iteraciones aunque la
 * primera ya apruebe con score alto. Cada iteración de más paga:
 * Revisor + Codificador + Revisor otra vez… por puntos que no se ven.
 * Lo mismo con las rondas de corrección del núcleo v3: si el Revisor ya
 * aprobó, ¿para qué otra ronda?
 *
 * ─── La solución ───
 * El diagrama EXACTO del plan:
 *
 *   Generate → QA → Good enough? ── YES → STOP
 *                    └── NO
 *                        → Deterministic patch? ── YES → PATCH
 *                          └── NO → LLM
 *
 * La suficiencia NO es «bonito»: es un umbral TÉCNICO sobre el score
 * determinista que ya existe (bucle-mejora.ts `scoreDe`: críticos×18 +
 * avisos×6 + mejoras×2 + identidad). Los umbrales son conservadores:
 *  · pleno (92): PASS sin críticos ni avisos → STOP inmediato.
 *  · suficiente (84): con 0 críticos y ≥1 iteración ya hecha → STOP.
 *  · el tope duro del plan sigue mandando: nunca ciclos infinitos.
 *
 * Y la regla de ORO del ahorro: antes de gastar un LLM en corregir, se
 * pregunta si un parche determinista lo arregla GRATIS
 * (enrutador-determinista.ts). El LLM es el ÚLTIMO recurso mecánico.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import type { InformeRevisorVisual } from "./revisor-visual";
import { scoreDe } from "./bucle-mejora";
import type { ParcheDeterminista } from "./enrutador-determinista";
import { detectarParches, parchearHtml } from "./enrutador-determinista";

/* -------------------------------- tipos ------------------------------------ */

/** Qué hacer tras un QA (la decisión del plan). */
export type DecisionTemprana =
  | { tipo: "parar"; motivo: string }
  | { tipo: "parche-determinista"; parches: ParcheDeterminista[]; html: string; motivo: string }
  | { tipo: "llm"; motivo: string };

export interface UmbralesSuficiencia {
  /** score que da parada inmediata (defecto 92) */
  pleno: number;
  /** score suficiente con ≥1 iteración ya hecha (defecto 84) */
  suficiente: number;
  /** score mínimo por debajo del cual SIEMPRE se intenta mejorar (70) */
  minimo: number;
}

export const UMBRALES_DEFECTO: UmbralesSuficiencia = {
  pleno: 92,
  suficiente: 84,
  minimo: 70,
};

/** ¿El informe es ya suficientemente bueno? La pregunta del plan. */
export function esSuficientementeBueno(
  informe: InformeRevisorVisual,
  iteracionesUsadas: number,
  u: UmbralesSuficiencia = UMBRALES_DEFECTO
): boolean {
  const score = scoreDe(informe);
  if (informe.veredicto === "PASS" && informe.criticos === 0 && informe.avisos === 0 && score >= u.pleno) return true;
  if (iteracionesUsadas >= 1 && informe.criticos === 0 && score >= u.suficiente) return true;
  return false;
}

/** La decisión completa del plan para un informe dado. Orden:
 * 1. ¿good enough? → parar. 2. ¿hay parches deterministas? → aplicarlos
 * gratis. 3. score alto sin críticos: regenerar arriesga más de lo que
 * gana → parar conservador. 4. si nada de lo anterior → LLM. */
export function decidirSiguientePaso(
  informe: InformeRevisorVisual,
  iteracionesUsadas: number,
  maxIteraciones: number,
  html: string,
  u: UmbralesSuficiencia = UMBRALES_DEFECTO
): DecisionTemprana {
  const score = scoreDe(informe);

  /* 1 · good enough? → STOP (el ahorro principal) */
  if (esSuficientementeBueno(informe, iteracionesUsadas, u)) {
    return { tipo: "parar", motivo: `score ${score} ≥ umbral con ${iteracionesUsadas} iter.: suficiente` };
  }
  /* tope duro del plan: no hay más rondas → parar con lo mejor visto */
  if (iteracionesUsadas >= maxIteraciones) {
    return { tipo: "parar", motivo: `tope de ${maxIteraciones} iteraciones alcanzado` };
  }

  /* 2 · ¿parche determinista? (gratis, antes del LLM) */
  const candidatos = detectarParches(html, informe);
  if (candidatos.length > 0) {
    const r = parchearHtml(html, candidatos);
    if (r.parches.length > 0) {
      return {
        tipo: "parche-determinista",
        parches: r.parches,
        html: r.html,
        motivo: `${r.parches.length} parche(s) sin LLM: ${r.parches.map((p) => p.tipo).join(", ")}`,
      };
    }
  }

  /* 3 · score ≥ mínimo sin críticos: solo quedan avisos cosméticos; una
   * regeneración con modelo puede EMPEORAR el diseño (el plan: «evitar
   * ciclos infinitos de mejora»). Conservador: parar. */
  if (score >= u.minimo && informe.criticos === 0) {
    return { tipo: "parar", motivo: `score ${score} con 0 críticos: regenerar arriesga más de lo que gana` };
  }

  return { tipo: "llm", motivo: `score ${score} (< ${u.minimo}) o con críticos: corrección con modelo` };
}

/* ------------------------------- informe ---------------------------------- */

/** Resumen de ahorro para la traza/UI: qué ganó la salida temprana. */
export function resumenTemprana(
  iteracionesUsadas: number,
  maxIteraciones: number,
  decisiones: DecisionTemprana[]
): string {
  const evitadas = Math.max(0, maxIteraciones - iteracionesUsadas);
  const parches = decisiones.filter((d) => d.tipo === "parche-determinista").length;
  const partes: string[] = [];
  if (evitadas > 0) partes.push(`${evitadas} iteración(es) ahorrada(s) de ${maxIteraciones}`);
  if (parches) partes.push(`${parches} corrección(es) sin LLM`);
  return partes.length ? `salida temprana: ${partes.join(" · ")}` : "salida temprana: sin ahorro esta vez";
}
