/** FORJA IA — Definición de «éxito» (v4.0.0, sección 33 del plan).
 *
 * «Una generación se considera lista cuando»: los 10 criterios del plan,
 * verificados uno a uno de forma determinista sobre el resultado final.
 * exito = TODOS los checks en verde. El resultado viaja con el detalle de
 * cada check (el plan exige reproducibilidad y evidencia).
 */

import type { ResultadoForja } from "./tipos";
import { chequeosEstaticos } from "./vision";

/** Un check de éxito. */
export interface CheckExito {
  id: string;
  /** el criterio del plan, en su texto */
  criterio: string;
  ok: boolean;
  /** evidencia del veredicto */
  nota: string;
}

export interface VeredictoExito {
  exito: boolean;
  /** cuántos checks pasan */
  pasan: number;
  total: number;
  checks: CheckExito[];
  resumen: string;
}

/** Evalúa los 10 criterios de éxito sobre un ResultadoForja final. */
export function evaluarExito(r: ResultadoForja): VeredictoExito {
  const checks: CheckExito[] = [];
  const hayCodigo = r.codigo.length > 200;

  // 1. funciona — hay código completo y el Revisor lo aprobó (o mejor alcanzado sin críticos)
  const inspector = hayCodigo ? chequeosEstaticos(r.codigo) : [];
  const criticos = inspector.filter((h) => h.severidad === "critico").length;
  checks.push({
    id: "funciona",
    criterio: "funciona",
    ok: hayCodigo && criticos === 0,
    nota: hayCodigo ? `${criticos} hallazgo(s) crítico(s)` : "sin código final",
  });

  // 2. responsive — meta viewport + media queries
  const responsiveOk = /<meta[^>]*viewport/i.test(r.codigo) && /@media[^{]*\{/i.test(r.codigo);
  checks.push({ id: "responsive", criterio: "es responsive", ok: responsiveOk, nota: responsiveOk ? "viewport + media queries presentes" : "falta viewport o media queries" });

  // 3. jerarquía — un h1 y encabezados en orden
  const h1s = (r.codigo.match(/<h1[\s>]/gi) ?? []).length;
  checks.push({ id: "jerarquia", criterio: "tiene buena jerarquía", ok: h1s === 1 && !inspector.some((h) => /jerarqu/i.test(h.titulo)), nota: `${h1s} h1 y ${inspector.filter((h) => /jerarqu/i.test(h.titulo)).length} saltos de jerarquía` });

  // 4. respeta el ADN — hay ADN y el informe no marca prohibición grave
  const adnOk = !!r.adn && r.genericidad?.nivel !== "alto";
  checks.push({ id: "adn", criterio: "respeta el ADN", ok: adnOk, nota: r.adn ? `saturación anti-genérica: ${r.genericidad?.nivel ?? "baja"}` : "sin ADN registrado" });

  // 5. genericidad no alta
  checks.push({ id: "genericidad", criterio: "no presenta genericidad alta", ok: (r.genericidad?.nivel ?? "bajo") !== "alto", nota: `nivel ${r.genericidad?.nivel ?? "bajo"} (identidad ${r.genericidad?.puntuacionIdentidad ?? 100}/100)` });

  // 6. accesibilidad — sin hallazgos críticos de a11y
  const a11yCriticos = inspector.filter((h) => h.categoria === "accesibilidad" && h.severidad === "critico").length;
  checks.push({ id: "accesibilidad", criterio: "supera las verificaciones de accesibilidad definidas", ok: a11yCriticos === 0, nota: `${a11yCriticos} crítico(s) de accesibilidad` });

  // 7. código exportable — autocontenido (html completo)
  const exportable = /<!doctype html|<html/i.test(r.codigo) && r.codigo.includes("</html>");
  checks.push({ id: "exportable", criterio: "tiene código exportable", ok: exportable, nota: exportable ? "HTML autocontenido completo" : "el código no es un HTML completo" });

  // 8. editable — el código no llega minificado/obfuscado
  const editable = hayCodigo && r.codigo.length > 500 && /\n/.test(r.codigo);
  checks.push({ id: "editable", criterio: "puede continuar editándose", ok: editable, nota: editable ? "código legible con saltos" : "código ausente o ilegible" });

  // 9. reproducible — deja ADN + ficha (las decisiones viajan)
  const reproducible = !!r.adn && !!r.fichaTexto;
  checks.push({ id: "reproducible", criterio: "puede reproducirse", ok: reproducible, nota: reproducible ? "ADN + ficha de diseño guardados" : "faltan ADN o ficha" });

  // 10. evidencia — rondas registradas
  const evidencia = r.rondas.length > 0;
  checks.push({ id: "evidencia", criterio: "deja evidencia de cómo se produjo", ok: evidencia, nota: evidencia ? `${r.rondas.length} ronda(s) trazadas` : "sin rondas trazadas" });

  const pasan = checks.filter((c) => c.ok).length;
  return {
    exito: pasan === checks.length,
    pasan,
    total: checks.length,
    checks,
    resumen: pasan === checks.length
      ? `ÉXITO: los ${checks.length} criterios del plan se cumplen. La generación es «lista».`
      : `${pasan}/${checks.length} criterios cumplidos. Pendiente: ${checks.filter((c) => !c.ok).map((c) => c.criterio).join(", ")}.`,
  };
}

/** Texto del veredicto para el chat. */
export function textoExito(v: VeredictoExito): string {
  const lineas = v.checks.map((c) => `${c.ok ? "✔" : "✘"} ${c.criterio} — ${c.nota}`);
  return [v.exito ? "✅ GENERACIÓN LISTA" : "⏳ TODAVÍA NO", ...lineas, "", v.resumen].join("\n");
}
