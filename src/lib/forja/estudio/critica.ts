/** FORJA IA — Estudio de diseño: la crítica de una pantalla.
 *
 * No inventa criterios: junta lo que FORJA ya mide (anti-genérico del motor
 * y auditoría web) en una ficha corta para el panel derecho, y prepara la
 * lista de problemas que se le devuelven al modelo al pulsar «Corregir». */

import { detectarGenericidad } from "../motor/antigenerico";
import { auditarWeb } from "../web-audit";
import { comprobarSkills } from "./skills";
import type { TipoProyecto } from "./tipos";

export interface CriticaPantalla {
  /** 0..100: cuánta identidad propia tiene (del anti-genérico) */
  identidad: number;
  nivelGenerico: "bajo" | "medio" | "alto";
  motivo: string;
  /** síntomas de plantilla, con qué hacer en su lugar */
  sintomas: { nombre: string; alternativa: string }[];
  /** hallazgos técnicos (accesibilidad, SEO, rendimiento) */
  avisos: string[];
  /** lo que piden las skills de patrón de la pantalla y no se cumple */
  patrones: string[];
}

/** `skills`: las de la pantalla (`skillsDePantalla`), para medir sus
 * autocomprobaciones; sin ellas la crítica es la de siempre. */
export function criticar(html: string, skills: readonly string[] = [], tipo: TipoProyecto = "web"): CriticaPantalla {
  const g = detectarGenericidad(html);
  const a = auditarWeb(html);
  return {
    identidad: g.puntuacionIdentidad,
    nivelGenerico: g.nivel,
    motivo: g.motivo,
    sintomas: g.sintomas.slice(0, 5).map((s) => ({ nombre: s.nombre, alternativa: s.alternativa })),
    avisos: a.hallazgos.slice(0, 6).map((h) => `${h.mensaje} — ${h.arreglo}`),
    patrones: comprobarSkills(html, skills, tipo).slice(0, 4),
  };
}

/** Lo que se le pide arreglar al modelo (vacío si no hay nada que corregir). */
export function problemasParaCorregir(c: CriticaPantalla): string[] {
  // los del patrón primero: son los más concretos de esta pantalla
  return [
    ...c.patrones,
    ...c.sintomas.map((s) => `${s.nombre}: ${s.alternativa}`),
    ...c.avisos,
  ].slice(0, 8);
}
