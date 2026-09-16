/** FORJA IA — MOTOR CREATIVO / ORQUESTADOR DE EXPERIENCIA (v4.6.0,
 * correcciones §1, §16, §26 y §32 + ideas A/B/C/E de v4.6).
 *
 * ─── El pipeline EXACTO del doc ───
 *
 *   prompt → Intent → Experience DNA → Reference DNA → Experience Family
 *          → Experience Recipe → Representation Engine → Spatial Plan
 *          → Motion Plan → Component Blueprint → Design Tokens
 *          → PRIMITIVAS COMPILADAS (v4.6 A) → OBJETO 3D FORJADO (v4.6 C)
 *          → APRENDIZAJE DEL GENOMA (v4.6 B)
 *          → Code Generator → Live Page → Visual QA → Motion QA (v4.6 D)
 *          → Editorial Bias Detector → Anti-Repetition → Patch → Learning
 *
 * ─── §32: integración con el sistema de tokens ───
 * La eficiencia v4.4 (Context Compiler, caché L1-L6, presupuesto, early
 * exit, router determinista, ROI, patch-first) NO se reemplaza. El motor
 * creativo se monta ENCIMA:
 *
 *   EFICIENCIA + CREATIVE ENGINE + DESIGN COMPILER + VISUAL QA
 *
 * Todo lo que decide este módulo es DETERMINISTA y GRATIS (señales léxicas
 * + datos estructurados): el LLM recibe la dirección creativa hecha y solo
 * la ejecuta. Eso abarata cada generación Y la hace consistente — el
 * objetivo del dueño del proyecto («ultra profesional, lo más barato
 * posible») hecho arquitectura.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import { sintetizarExperienciaDna, resumenExperienciaDna, seccionExperienciaDna, clonarExperiencia, type ExperienciaDna } from "./experience-dna";
import { seleccionarFamilia, seccionFamilias, type SeleccionFamilia, type FamiliaExperiencia } from "./familias-experiencia";
import { recetaParaFamilia, seccionReceta, type RecetaExperiencia, type SeleccionReceta } from "./experience-recipes";
import { construirExperienceManifest, seccionExperienceManifest, type ExperienceManifest } from "./experience-manifest";
import { construirCompositionBlueprint, seccionCompositionBlueprint, type CompositionBlueprint } from "./composition-engine";
import { modoDeseado, evaluarPuerta, seccionPuerta, type DecisionPuerta } from "./performance-gate";
import { construirPlanEspacial, seccionPlanEspacial, cssEscenario, type PlanEspacial } from "./spatial-engine";
import { construirPlanMovimiento, seccionPlanMovimiento, cssMovimiento, type PlanMovimiento } from "./motion-engine";
import { elegirHero, seccionHero, defHero, type HeroElegido } from "./hero-engine";
import { elegirCards, seccionCards, cssCards, type EleccionCards } from "./card-system";
import { construirPlanResponsivo, seccionPlanResponsivo, type PlanResponsivo } from "./plan-responsivo-experiencia";
import { tokensExperienciaCss, resumenTokens } from "./tokens-experiencia";
import { obtenerHistorial, penalizacionComposicion, resumenAntiRepeticion, seccionAntiRepeticion, type Penalizacion } from "./anti-repetition";
import { seccionPatronesPositivos } from "./patrones-positivos";
import { elegirIconos, seccionIconografia, cssIconografia, resumenIconografia, type EleccionIconos } from "./iconos";
import {
  construirPlanoContenido,
  seccionPlanoContenido,
  resumenPlano,
  type PlanoContenido,
  type NivelDetalle,
} from "./plano-contenido";
import { elegirObjeto3d, seccionObjeto3d, resumenObjeto3d, cssObjeto3d, type ObjetoElegido } from "./objeto-3d";
import { elegirPrimitivas, seccionPrimitivas, resumenPrimitivas, cssPrimitivas, scriptPrimitivas, type EleccionPrimitivas } from "./primitivas";
import {
  recomendacionesAprendidas,
  ajustesHeroAprendidos,
  seccionAprendizaje,
  resumenAprendizaje,
  type RecomendacionAprendida,
} from "./aprendizaje-genoma";

/* -------------------------------- tipos ------------------------------------ */

/** La selección completa de experiencia de UNA generación. Todo
 * serializable (el host la muestra y la persiste). */
export interface SeleccionExperiencia {
  dna: ExperienciaDna;
  /** por qué el ADN de experiencia es así (señales detectadas) */
  razonesDna: string[];
  familia: SeleccionFamilia;
  receta: SeleccionReceta;
  representacion: DecisionPuerta;
  planEspacial: PlanEspacial;
  planMovimiento: PlanMovimiento;
  hero: HeroElegido;
  cards: EleccionCards;
  responsive: PlanResponsivo;
  /** penalización por repetición aplicada a la elección del hero */
  penalizacion: Penalizacion;
  /** v4.6 A — primitivas compiladas elegidas (nacen auditadas) */
  primitivas: EleccionPrimitivas;
  /** v4.6 C — objeto 3D forjado (null cuando la escena es plana/tipográfica) */
  objeto: ObjetoElegido | null;
  /** v4.6 B — recomendaciones con evidencia del learning loop del Genoma */
  aprendizaje: RecomendacionAprendida[];
  /** v4.7 — PLANO DE CONTENIDO: qué secciones, cuántas piezas y con qué
   * datos del brief. El contrato de experiencia decía CÓMO se ve la
   * página; el plano dice QUÉ lleva dentro. */
  plano: PlanoContenido;
  /** v4.7.1 — manifest compilado: fuente única de verdad de la experiencia */
  manifest: ExperienceManifest;
  /** v4.7.2 — composición compilada de página completa */
  composition: CompositionBlueprint;
  /** v4.7 G — juego de iconos e imagen compilados (0 tokens, nacen
   * auditados: currentColor, trazo coherente, aria-hidden, proporción fija) */
  iconos: EleccionIconos;
  tokensCss: string;
  resumen: string;
}

export interface OpcionesExperiencia {
  /** móvil primero (el plan responsivo ajusta más agresivo) */
  movilPrimero?: boolean;
  /** presupuesto de peso de activos en KB (por defecto 0: sin librerías) */
  pesoActivosKb?: number;
  /** v4.6 — familia forzada (por Arena de familias o contrato editado) */
  familiaForzada?: FamiliaExperiencia;
  /** v4.6 — hero forzado (por contrato editado) */
  heroForzado?: string;
  /** v4.6 — DNA ya decidido (por contrato editado): se compila tal cual */
  dnaForzado?: ExperienciaDna;
  /** v4.7 — el mensaje ORIGINAL del usuario. Necesario cuando `mensaje` es
   * un corpus de señales compuesto (ficha + ADN + feedback) o cuando se
   * re-compila desde un DNA editado: sin esto, recompilarDesdeDna() perdía
   * la familia y degradaba la página a «minimal» sin avisar. */
  mensajeOriginal?: string;
  /** v4.7 — nivel de detalle forzado (perilla de la UI). Sin él se deduce
   * del brief. Mueve secciones, piezas, líneas objetivo y techo de tokens. */
  nivelDetalle?: NivelDetalle;
}

/** Ejecuta el pipeline creativo completo. Determinista, gratis, nunca lanza. */
export function seleccionarExperiencia(mensaje: string, opts: OpcionesExperiencia = {}): SeleccionExperiencia {
  // 1 · INTENCIÓN → EXPERIENCE DNA (señales + decisiones)
  const base = opts.dnaForzado
    ? { dna: clonarExperiencia(opts.dnaForzado), razones: ["ADN fijado por el contrato de experiencia editado"] }
    : sintetizarExperienciaDna(mensaje);
  const dna = base.dna;
  const razones = base.razones;

  // 2 · FAMILIA DE EXPERIENCIA (editorial ya no es el refugio)
  const familia = opts.familiaForzada
    ? { ...seleccionarFamilia(mensaje), familia: opts.familiaForzada, confianza: 1, motivo: `familia fijada por edición/Arena: ${opts.familiaForzada}` }
    : seleccionarFamilia(mensaje);

  // 3 · RECETA (la composición probada que el LLM ejecuta)
  const receta = recetaParaFamilia(familia.familia, mensaje);

  // 4 · REPRESENTACIÓN + PUERTA DE RENDIMIENTO (2D/2.5D/3D/WebGL + cascada)
  const deseadoBrief = modoDeseado(mensaje);
  const minimoPorReceta: Record<RecetaExperiencia["id"], "2d" | "2.5d" | "3d" | "webgl"> = {
    spatial_product: "2.5d", cinematic_product: "2.5d", immersive_portfolio: "2.5d",
    interactive_saas: "2.5d", "3d_showcase": "3d", creative_studio: "2.5d", modern_minimal: "2d",
  };
  const minimoExperiencia = minimoPorReceta[receta.receta.id];
  const ordenModo: Record<"2d" | "2.5d" | "3d" | "webgl", number> = { "2d": 3, "2.5d": 2, "3d": 1, webgl: 0 };
  const deseado = ordenModo[deseadoBrief] <= ordenModo[minimoExperiencia] ? deseadoBrief : minimoExperiencia;
  const representacion = evaluarPuerta(
    {
      intencionExigeWebgl: deseado === "webgl",
      pesoActivosKb: opts.pesoActivosKb ?? 0,
      nodosAnimados: dna.spatial.layers + (dna.surface.elevation >= 0.5 ? 4 : 0),
      costeGpu: dna.motion.intensity >= 0.8 ? "alto" : dna.motion.intensity >= 0.5 ? "medio" : "bajo",
      movilPrimero: opts.movilPrimero ?? false,
      modoMinimo: minimoExperiencia,
    },
    deseado
  );
  // la puerta puede degradar el modo: el ADN obedece a la decisión
  if (representacion.modo === "2d") {
    dna.spatial.mode = "flat";
    dna.spatial.depth = Math.min(dna.spatial.depth, 0.3);
    dna.object.use3d = false;
  } else if (representacion.modo === "2.5d") {
    dna.spatial.mode = "2.5d";
    dna.object.use3d = false;
  } else if (representacion.modo === "3d") {
    dna.spatial.mode = "3d";
    dna.object.use3d = true;
  }

  // 5 · APRENDIZAJE (v4.6 B): el Genoma recomienda con evidencia antes de elegir
  const aprendizaje = recomendacionesAprendidas({ max: 4 });
  const ajustesHero = ajustesHeroAprendidos();

  // 6 · HERO + CARDS (component blueprint, con historial + aprendizaje)
  const hero = elegirHero(dna, familia.familia, mensaje, obtenerHistorial().map((h) => h.hero), ajustesHero);
  const heroFinal = opts.heroForzado && defHero(opts.heroForzado)
    ? ({ ...hero, ...defHero(opts.heroForzado)!, motivo: `hero fijado por edición del contrato: ${opts.heroForzado}` } as HeroElegido)
    : hero;
  const cards = elegirCards(dna, receta.receta);

  // 7 · ANTI-REPETICIÓN (v4.7 — CORREGIDO). Hasta v4.6 se calculaba en el
  // paso 5, ANTES de elegir hero y cards, y con las cadenas vacías:
  // `penalizacionComposicion("", dna.spatial.mode, "")`. La penalización
  // no veía nunca la composición real, así que su consejo era inerte.
  // Ahora corre DETRÁS de la decisión y con los valores de verdad.
  const penalizacion = penalizacionComposicion(
    heroFinal.tipo,
    dna.spatial.mode,
    cards.variantes[0] ?? ""
  );

  // 8 · PLANES ESPACIAL Y DE MOVIMIENTO
  const planEspacial = construirPlanEspacial(dna, receta.receta);
  const planMovimiento = construirPlanMovimiento(dna, receta.receta);

  // 9 · v4.6 C — OBJETO 3D FORJADO. Regla v4.6: el objeto es decorativo,
  // ~2 KB, aria-hidden y reduced-motion-safe — CUALQUIER página lo tolera y
  // gana el «central 3D object» del doc §29 (la queja «solo genera un hero
  // con degradado» muere aquí). Solo se omite en la experiencia realmente
  // tipográfica y quieta (editorial legítima §23 o minimal sin objeto):
  const quietoTipografico = dna.object.heroType === "tipografico" && !dna.object.use3d && dna.object.visualWeight < 0.6;
  const objeto: ObjetoElegido | null = quietoTipografico
    ? null
    : elegirObjeto3d(dna, familia.familia, mensaje, obtenerHistorial().map((h) => h.hero).slice(-2));

  // 10 · v4.6 A — PRIMITIVAS COMPILADAS (selección gratis, nacen auditadas)
  const primitivas = elegirPrimitivas(dna, receta.receta, heroFinal, mensaje);

  // 11 · RESPONSIVE EXPERIENCE + DESIGN TOKENS
  const responsive = construirPlanResponsivo(dna, receta.receta);
  const tokensCss = tokensExperienciaCss(dna);

  // 12 · v4.7 — PLANO DE CONTENIDO. Se construye con el mensaje ORIGINAL
  // (los hechos del brief están ahí, no en el corpus de señales).
  const plano = construirPlanoContenido(opts.mensajeOriginal ?? mensaje, {
    nivel: opts.nivelDetalle,
  });

  // 13 · v4.7 G — ICONOGRAFÍA E IMAGEN COMPILADAS
  const iconos = elegirIconos(opts.mensajeOriginal ?? mensaje, 10);

  // v4.7.2 — COMPOSITION ENGINE: el ritmo de toda la página se compila
  // antes del Codificador; 3D/motion ya no pueden quedarse confinados al hero.
  const composition = construirCompositionBlueprint({ familia: familia.familia, receta: receta.receta, plano });

  // v4.7.1 — Experience Manifest: una sola fuente de verdad que el Codificador
  // debe implementar y que QA puede contrastar contra el DOM real.
  const manifest = construirExperienceManifest({
    familia: familia.familia, receta: receta.receta, dna, representacion,
    planEspacial, planMovimiento, hero: heroFinal, cards, plano, composition, primitivas: { ids: primitivas.primitivas },
  });

  const resumen = [
    `familia=${familia.familia}(${Math.round(familia.confianza * 100)}%)`,
    `receta=${receta.receta.id}`,
    `compatible=${receta.compatible}`,
    `representacion=${representacion.modo}`,
    `manifest=${manifest.version}`,
    `composition=${composition.version}/${composition.sections.length}secciones`,
    resumenExperienciaDna(dna),
    `hero=${heroFinal.tipo}`,
    resumenObjeto3d(objeto),
    resumenPrimitivas(primitivas),
    resumenAprendizaje(aprendizaje),
    resumenTokens(dna),
    resumenAntiRepeticion(penalizacion),
    resumenPlano(plano),
    resumenIconografia(iconos),
  ].join(" · ");

  return {
    dna,
    razonesDna: razones,
    familia,
    receta,
    representacion,
    planEspacial,
    planMovimiento,
    hero: heroFinal,
    cards,
    responsive,
    penalizacion,
    primitivas,
    objeto,
    aprendizaje,
    plano,
    manifest,
    composition,
    iconos,
    tokensCss,
    resumen,
  };
}

/* ------------------------------ contrato ----------------------------------- */

/** El CONTRATO COMPLETO que viaja al maquetador/Codificador (corrección
 * §15): experience + recipe + spatial plan + motion plan + hero type +
 * surface system + interaction system + responsive experience + OBJETO 3D
 * (v4.6 C) + PRIMITIVAS (v4.6 A) + APRENDIZAJE (v4.6 B). El LLM ya no
 * inventa la dirección creativa: la recibe — y ahora también recibe los
 * componentes compilados que NO debe re-inventar. */
export function seccionContratoExperiencia(sel: SeleccionExperiencia): string {
  return [
    seccionFamilias(sel.familia),
    "",
    seccionReceta(sel.receta.receta),
    "",
    seccionExperienciaDna(sel.dna),
    "",
    seccionPuerta(sel.representacion),
    "",
    seccionPlanEspacial(sel.planEspacial),
    "",
    seccionObjeto3d(sel.objeto),
    "",
    seccionPlanMovimiento(sel.planMovimiento),
    "",
    seccionHero(sel.hero),
    "",
    seccionCards(sel.cards),
    "",
    seccionPrimitivas(sel.primitivas),
    "",
    seccionPlanResponsivo(sel.responsive),
    "",
    seccionAprendizaje(sel.aprendizaje),
    "",
    seccionExperienceManifest(sel.manifest),
    "",
    seccionCompositionBlueprint(sel.composition),
    "",
    // v4.7 — la anti-repetición llega POR FIN a quien escribe el HTML.
    // Hasta v4.6 su sección solo la veía director2.ts.
    seccionAntiRepeticion(sel.penalizacion),
    "",
    seccionPatronesPositivos("", 6),
    "",
    `# DESIGN TOKENS (pegar este :root y usar sus variables)`,
    sel.tokensCss,
    "",
    "",
    seccionIconografia(sel.iconos),
    "",
    // v4.7 — el QUÉ, después del CÓMO.
    seccionPlanoContenido(sel.plano),
  ].join("\n");
}

/** La CSS determinista completa (tokens + escenario + objeto 3D + movimiento
 * + cards + primitivas): §17 — construir determinísticamente lo repetible.
 * El Codificador la incluye y añade la suya ENCIMA, nunca en contra. */
export function cssDeterminista(sel: SeleccionExperiencia): string {
  return [
    sel.tokensCss,
    cssEscenario(sel.planEspacial),
    sel.objeto ? cssObjeto3d(sel.objeto.id) : "",
    cssMovimiento(sel.planMovimiento),
    cssCards(sel.cards.variantes),
    cssPrimitivas(sel.primitivas.primitivas),
    sel.composition.css,
    cssIconografia(),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** v4.6 A — el script capado de las primitivas elegidas (vacío si ninguna
 * lo necesita). Viaja SEPARADO de la CSS: el Codificador lo pega al final
 * del <body>, nunca inline en el head. */
export function scriptDeterminista(sel: SeleccionExperiencia): string {
  return scriptPrimitivas(sel.primitivas.primitivas);
}

/** v4.6 E — re-compila la selección desde un DNA/decisiones dadas (el
 * contrato editable llama a esto). Sin tokens, determinista. */
export function recompilarDesdeDna(dna: ExperienciaDna, opts: OpcionesExperiencia = {}): SeleccionExperiencia {
  // v4.7 — CORREGIDO: hasta v4.6 esto llamaba `seleccionarExperiencia("")`.
  // Sin señales, seleccionarFamilia() caía a «minimal» y la receta a
  // «modern_minimal»: tocar un radius en el panel podía borrar la familia
  // spatial de la página. Ahora el mensaje original viaja y manda.
  const mensaje = opts.mensajeOriginal ?? "";
  return seleccionarExperiencia(mensaje, { ...opts, dnaForzado: dna, mensajeOriginal: mensaje });
}
