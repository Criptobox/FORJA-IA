/**
 * FORJA IA — ENTRADA DEL BUNDLE DEL MOTOR (motor-forja.mjs).
 *
 * Fichero referido por la documentación desde v4.3 («entrada del bundle:
 * adapter-test/entrada.mjs (esbuild, ESM único)») pero que faltaba en el
 * ZIP — v4.4 lo incluye. Es la superficie pública que el Estudio del host
 * importa en runtime (new Function + import, fuera del bundler de Next).
 *
 * Construir el bundle (desde la carpeta del MÓDULO):
 *
 *   node integracion/adapter-test/construir-bundle.mjs <salida.mjs>
 *
 * o con esbuild a mano:
 *
 *   npx esbuild integracion/adapter-test/entrada.mjs \
 *     --bundle --format=esm --platform=browser --target=es2020 \
 *     --outfile=public/motor-forja.mjs
 *
 * Reglas: ESM único, sin Node builtins, sin red — el Estudio lo ejecuta
 * en el navegador y el Lab en el servidor con el mismo fichero.
 */

/* ─── núcleo y blindaje (v3 + v4.0 + v4.1 + v4.2) ─────────────────────── */
export * from "../../src/lib/prism/forja/tipos";
export * from "../../src/lib/prism/forja/tipos-v4";
export * from "../../src/lib/prism/forja/version";
export * from "../../src/lib/prism/forja/equipo";
export * from "../../src/lib/prism/forja/modelo";
export * from "../../src/lib/prism/forja/habilidades";
export * from "../../src/lib/prism/forja/representacion";
export * from "../../src/lib/prism/forja/nucleo";
export * from "../../src/lib/prism/forja/nucleo-v4";
export * from "../../src/lib/prism/forja/nucleo-extractos";
export * from "../../src/lib/prism/forja/maqueta";
export * from "../../src/lib/prism/forja/cache-fichas";
export * from "../../src/lib/prism/forja/continuacion-nucleo";
export * from "../../src/lib/prism/forja/motivo-parada";
export * from "../../src/lib/prism/forja/adaptador-resiliente";
export * from "../../src/lib/prism/forja/salud-proveedores";
export * from "../../src/lib/prism/forja/observabilidad";
export * from "../../src/lib/prism/forja/metricas";
export * from "../../src/lib/prism/forja/benchmark";
export * from "../../src/lib/prism/forja/director";
export * from "../../src/lib/prism/forja/arena";

/* ─── conocimiento, memoria y fuentes (v3) — faltaban en el bundle:
 * el Catálogo del Estudio lee FUENTES_SEMILLA y se quedaba siempre en 0 ─── */
export * from "../../src/lib/prism/forja/conocimiento-global";
export * from "../../src/lib/prism/forja/conocimiento-usuario";
export * from "../../src/lib/prism/forja/fuentes";
export * from "../../src/lib/prism/forja/fuentes-usuario";

/* ─── ADN, direcciones, jueces, anti-genérico (v4.0) ──────────────────── */
export * from "../../src/lib/prism/forja/adn-visual";
export * from "../../src/lib/prism/forja/adn2";
export * from "../../src/lib/prism/forja/exportadores-adn";
export * from "../../src/lib/prism/forja/antigenerico";
export * from "../../src/lib/prism/forja/antigenerico2";
export * from "../../src/lib/prism/forja/jueces2";
export * from "../../src/lib/prism/forja/revisor-visual";
export * from "../../src/lib/prism/forja/evaluador-exito";
export * from "../../src/lib/prism/forja/bucle-mejora";
export * from "../../src/lib/prism/forja/perfiles";
export * from "../../src/lib/prism/forja/director2";
export * from "../../src/lib/prism/forja/arena2";
export * from "../../src/lib/prism/forja/genoma-visual";
export * from "../../src/lib/prism/forja/memoria2";
export * from "../../src/lib/prism/forja/seguridad-web";
export * from "../../src/lib/prism/forja/bridge-design-system";
export * from "../../src/lib/prism/forja/vision";
export * from "../../src/lib/prism/forja/adapter-opendesign";
export * from "../../src/lib/prism/forja/voz";
export * from "../../src/lib/prism/forja/canvas";
export * from "../../src/lib/prism/forja/mejora-pagina";

/* ─── EFICIENCIA (v4.4 — plan §22/23/24/25/26/28) ─────────────────────── */
export * from "../../src/lib/prism/forja/presupuesto-tokens";
export * from "../../src/lib/prism/forja/cache-multinivel";
export * from "../../src/lib/prism/forja/compilador-contexto";
export * from "../../src/lib/prism/forja/enrutador-determinista";
export * from "../../src/lib/prism/forja/salida-temprana";
export * from "../../src/lib/prism/forja/token-roi";
export * from "../../src/lib/prism/forja/eficiencia";

/* ─── MOTOR DE EXPERIENCIA (v4.5 — correcciones moderno-3D §1-§35) ────── */
export * from "../../src/lib/prism/forja/experience-dna";
export * from "../../src/lib/prism/forja/familias-experiencia";
export * from "../../src/lib/prism/forja/experience-recipes";
export * from "../../src/lib/prism/forja/spatial-engine";
export * from "../../src/lib/prism/forja/motion-engine";
export * from "../../src/lib/prism/forja/hero-engine";
export * from "../../src/lib/prism/forja/card-system";
export * from "../../src/lib/prism/forja/experience-bias";
export * from "../../src/lib/prism/forja/anti-repetition";
export * from "../../src/lib/prism/forja/patrones-positivos";
export * from "../../src/lib/prism/forja/reference-dna";
export * from "../../src/lib/prism/forja/experience-qa";
export * from "../../src/lib/prism/forja/tokens-experiencia";
export * from "../../src/lib/prism/forja/plan-responsivo-experiencia";
export * from "../../src/lib/prism/forja/performance-gate";
export * from "../../src/lib/prism/forja/motor-creativo";
export * from "../../src/lib/prism/forja/referencias";

/* ─── EL TALLER QUE APRENDE (v4.6 — ideas A-F) ─────────────────────────── */
export * from "../../src/lib/prism/forja/primitivas";            // A: primitivas compiladas
export * from "../../src/lib/prism/forja/aprendizaje-genoma";    // B: learning loop del Genoma
export * from "../../src/lib/prism/forja/objeto-3d";             // C: objeto 3D CSS paramétrico
export * from "../../src/lib/prism/forja/motion-qa-medido";      // D: motion QA medido
export * from "../../src/lib/prism/forja/contrato-experiencia";  // E: contrato JSON exportable/editable
export * from "../../src/lib/prism/forja/arena-familias";        // F: Arena entre familias

/* ─── LA PÁGINA, NO EL HERO (v4.7 — ideas G-I) ─────────────────────────── */
export * from "../../src/lib/prism/forja/plano-contenido";       // G: plano de contenido + hechos del brief
export * from "../../src/lib/prism/forja/qa-detalle";            // H: QA de densidad de detalle
export * from "../../src/lib/prism/forja/iconos";                // I: iconografía e imagen compiladas

/* ─── EXPERIENCE COMPOSITION (v4.7.2) ─────────────────────────────────── */
export * from "../../src/lib/prism/forja/composition-engine";

export * from "../../src/lib/prism/forja/experience-manifest";
