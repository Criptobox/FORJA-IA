/** FORJA IA — BENCHMARK FORJA (v4.0.0, sección 29 del plan).
 *
 * Dataset interno de pruebas con las 10 categorías del plan: SaaS,
 * e-commerce, finanzas, tecnología, restaurantes, portfolios, agencias,
 * dashboards, landing pages y web apps.
 *
 * Cada caso trae: brief, características esperadas, patrones prohibidos,
 * requisitos de accesibilidad, requisitos responsive y criterios de
 * evaluación. El CORREDOR mide un HTML contra el caso con las herramientas
 * deterministas del módulo (inspector + anti-genérico + revisor visual) y
 * da veredicto con evidencia. El plan exige comparar: OpenDesign solo vs
 * FORJA IA vs FORJA+OpenDesign — el corredor es neutral: mide lo que le
 * pongan delante.
 */

import { chequeosEstaticos } from "./vision";
import { detectarGenericidad } from "./antigenerico";
import { analisisVisual } from "./antigenerico2";
import { revisarVisual } from "./revisor-visual";
import { scoreDe } from "./bucle-mejora";

/* -------------------------------- tipos ------------------------------------ */

export type CategoriaBenchmark =
  | "saas"
  | "ecommerce"
  | "finanzas"
  | "tecnologia"
  | "restaurantes"
  | "portfolio"
  | "agencias"
  | "dashboards"
  | "landing"
  | "webapp";

export interface CasoBenchmark {
  categoria: CategoriaBenchmark;
  /** el brief textual que alimentaría al Diseñador */
  brief: string;
  /** características que la página ESPERADA debe tener */
  esperado: string[];
  /** patrones prohibidos para ESTA categoría */
  prohibido: string[];
  /** requisitos de accesibilidad del caso */
  accesibilidad: string[];
  /** requisitos responsive del caso */
  responsive: string[];
  /** criterios concretos de evaluación (qué se mira primero) */
  criterios: string[];
}

/** Resultado de correr un caso contra un HTML. */
export interface ResultadoCaso {
  categoria: CategoriaBenchmark;
  /** 0..100 score global del caso */
  score: number;
  /** esperados cumplidos / totales */
  esperadosOk: string[];
  esperadosFaltan: string[];
  /** prohibidos detectados */
  prohibidosDetectados: string[];
  /** hallazgos graves */
  graves: number;
  /** identidad anti-genérica 0..100 */
  identidad: number;
  veredicto: "PASS" | "WARN" | "FAIL";
  evidencia: string[];
}

/* ------------------------------ el dataset --------------------------------- */

export const CASOS_BENCHMARK: ReadonlyArray<CasoBenchmark> = [
  {
    categoria: "saas",
    brief: "Landing de un SaaS B2B de facturación para pymes: demo, precios, confianza.",
    esperado: ["sección de precios legible", "prueba social real (no 3 logos genéricos)", "CTA principal claro", "explicación del producto en una frase"],
    prohibido: ["hero centrado con título gigante", "tres tarjetas gemelas de features", "botón azul por defecto"],
    accesibilidad: ["contraste AA", "labels en el formulario de demo"],
    responsive: ["precios legibles en móvil", "CTA accesible en pantallas pequeñas"],
    criterios: ["claridad de propuesta en 10s", "confianza visual", "cero plantilla"],
  },
  {
    categoria: "ecommerce",
    brief: "Tienda de café de especialidad: catálogo, notas de cata, suscripción.",
    esperado: ["ficha de producto con datos sensoriales", "proceso de suscripción claro", "carrito accesible"],
    prohibido: ["grid uniforme de tarjetas idénticas", "badges decorativos sin función"],
    accesibilidad: ["alt en imágenes de producto", "contraste AA en precios"],
    responsive: ["grilla adaptativa real (no shrink)", "botones de compra táctiles"],
    criterios: ["apetito visual", "jerarquía de producto", "cero plantilla"],
  },
  {
    categoria: "finanzas",
    brief: "Web de una gestora patrimonial: sobriedad, números, confianza regulatoria.",
    esperado: ["presentación de servicios con jerarquía sobria", "datos con tipografía tabular", "avisos legales visibles"],
    prohibido: ["gradientes vivos", "glassmorphism", "tono casual"],
    accesibilidad: ["contraste AA estricto", "tablas legibles por lectores"],
    responsive: ["tablas con scroll horizontal contenido", "números sin corte"],
    criterios: ["sobriedad", "precisión tipográfica", "cero plantilla"],
  },
  {
    categoria: "tecnologia",
    brief: "Producto dev (SDK): documentación viva, quickstart, changelog.",
    esperado: ["bloques de código con copiar", "quickstart en 3 pasos", "navegación de docs"],
    prohibido: ["dashboard de cajitas decorativas", "iconos sin función"],
    accesibilidad: ["foco visible", "código con contraste suficiente"],
    responsive: ["código sin desborde horizontal", "nav colapsable"],
    criterios: ["utilidad dev", "velocidad percibida", "cero plantilla"],
  },
  {
    categoria: "restaurantes",
    brief: "Restaurante de autor: menú, historia, reservas.",
    esperado: ["menú legible con platos y precios", "reserva visible", "historia con voz propia"],
    prohibido: ["carrusel de fotos infinito", "hero centrado genérico"],
    accesibilidad: ["alt en fotos de platos", "contraste AA en el menú"],
    responsive: ["menú usable en móvil", "botón de reserva flotante o visible"],
    criterios: ["apetito", "carácter", "cero plantilla"],
  },
  {
    categoria: "portfolio",
    brief: "Portfolio de fotógrafa: obra, series, contacto.",
    esperado: ["obra protagonista con espacio", "series navegables", "contacto directo"],
    prohibido: ["grid uniforme 3xN", "miniaturas idénticas sin ritmo"],
    accesibilidad: ["alt descriptivo en obra", "navegación por teclado"],
    responsive: ["obra a sangre o casi en móvil", "galería sin scroll doble"],
    criterios: ["protagonismo de la obra", "ritmo visual", "cero plantilla"],
  },
  {
    categoria: "agencias",
    brief: "Agencia creativa: servicios, casos, equipo, cultura.",
    esperado: ["casos con resultado (no solo estética)", "equipo con rostro real", "manifesto o cultura visible"],
    prohibido: ["blob background", "título gigante + subtítulo + botón (combo plantilla)"],
    accesibilidad: ["contraste AA", "textos alternativos en casos"],
    responsive: ["casos apilables con jerarquía", "equipo legible en móvil"],
    criterios: ["personalidad", "prueba de trabajo", "cero plantilla"],
  },
  {
    categoria: "dashboards",
    brief: "Panel de métricas de energía para una fábrica: consumo, alertas, histórico.",
    esperado: ["representación de datos con narrativa (no cajitas)", "alertas con estado claro", "histórico con contexto"],
    prohibido: ["dashboard de cajitas genéricas", "3 tarjetas gemelas de KPI", "gráficos sin etiquetas"],
    accesibilidad: ["datos con alternativa textual", "contraste AA en series"],
    responsive: ["priorización de KPIs en móvil", "tablas navegables"],
    criterios: ["narrativa de datos", "estado y acción", "cero plantilla"],
  },
  {
    categoria: "landing",
    brief: "Landing de un evento de música: lineup, entradas, lugar.",
    esperado: ["lineup con jerarquía real", "compra de entradas evidente", "lugar con contexto"],
    prohibido: ["gradientes de neón genéricos", "cuenta atrás decorativa sin compra"],
    accesibilidad: ["contraste AA sobre fondo vivo", "botones de compra etiquetados"],
    responsive: ["lineup apilable", "compra en 1 toque"],
    criterios: ["energía", "claridad de compra", "cero plantilla"],
  },
  {
    categoria: "webapp",
    brief: "App de gestión para clínicas: pacientes, citas, facturación.",
    esperado: ["navegación de módulos clara", "formularios con validación", "estados vacíos útiles"],
    prohibido: ["tablas sin orden ni búsqueda", "modales anidados sin foco"],
    accesibilidad: ["labels completos", "foco gestionado en diálogos"],
    responsive: ["tablas → tarjetas en móvil", "navegación accesible"],
    criterios: ["eficiencia clínica", "confianza", "cero plantilla"],
  },
];

export function casoPorCategoria(cat: string): CasoBenchmark | undefined {
  return CASOS_BENCHMARK.find((c) => c.categoria === cat);
}

/* ------------------------------- corredor ----------------------------------- */

/** Corre UN caso contra un HTML. Neutral: mide lo que le pongan delante. */
export function correrCaso(caso: CasoBenchmark, html: string): ResultadoCaso {
  const informe = revisarVisual(html);
  const gen1 = detectarGenericidad(html);
  const gen2 = analisisVisual(html);
  const inspector = chequeosEstaticos(html);
  const cuerpo = html.toLowerCase();

  // esperados: por palabras clave del propio caso
  const esperadosOk: string[] = [];
  const esperadosFaltan: string[] = [];
  for (const e of caso.esperado) {
    const pistas = e.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    const presente = pistas.some((p) => cuerpo.includes(p));
    (presente ? esperadosOk : esperadosFaltan).push(e);
  }

  // prohibidos: viajan en los síntomas detectados
  const nombresSintomas = [...gen1.sintomas.map((s) => s.nombre.toLowerCase()), ...gen2.sintomas.map((s) => s.nombre.toLowerCase())];
  const prohibidosDetectados = caso.prohibido.filter((p) => {
    const pistas = p.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    return pistas.some((pista) => nombresSintomas.some((n) => n.includes(pista)));
  });

  const graves = inspector.filter((h) => h.severidad === "critico").length + prohibidosDetectados.length;
  const identidad = Math.round(gen1.puntuacionIdentidad * 0.5 + gen2.puntuacion * 0.5);
  const score = Math.max(0, Math.min(100, scoreDe(informe) - prohibidosDetectados.length * 8));

  const veredicto: ResultadoCaso["veredicto"] = graves > 0 ? "FAIL" : prohibidosDetectados.length > 0 || informe.veredicto === "WARN" ? "WARN" : "PASS";

  return {
    categoria: caso.categoria,
    score,
    esperadosOk,
    esperadosFaltan,
    prohibidosDetectados,
    graves,
    identidad,
    veredicto,
    evidencia: [
      `Inspector: ${inspector.length} hallazgo(s) (${graves} graves).`,
      `Anti-genérico: saturación ${gen1.nivel} (identidad ${identidad}/100).`,
      esperadosFaltan.length ? `Esperados sin detectar: ${esperadosFaltan.join("; ")}.` : `Todos los esperados detectados.`,
      prohibidosDetectados.length ? `Prohibidos detectados: ${prohibidosDetectados.join("; ")}.` : `Ningún patrón prohibido de la categoría.`,
    ],
  };
}

/** Corre el benchmark completo (todas las categorías o un filtro) y resume. */
export function correrBenchmark(htmlPorCategoria: Record<string, string>): {
  resultados: ResultadoCaso[];
  scoreMedio: number;
  resumen: string;
} {
  const resultados: ResultadoCaso[] = [];
  for (const caso of CASOS_BENCHMARK) {
    const html = htmlPorCategoria[caso.categoria];
    if (html) resultados.push(correrCaso(caso, html));
  }
  const scoreMedio = resultados.length ? Math.round(resultados.reduce((s, r) => s + r.score, 0) / resultados.length) : 0;
  const passes = resultados.filter((r) => r.veredicto === "PASS").length;
  const warns = resultados.filter((r) => r.veredicto === "WARN").length;
  const fails = resultados.filter((r) => r.veredicto === "FAIL").length;
  return {
    resultados,
    scoreMedio,
    resumen: `Benchmark: ${resultados.length} caso(s), score medio ${scoreMedio}/100 — ${passes} PASS, ${warns} WARN, ${fails} FAIL.`,
  };
}
