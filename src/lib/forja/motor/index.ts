/** FORJA IA — Motor creativo: superficie pública.
 *
 * Es la misma lista de exportaciones que tenía la entrada del paquete
 * precompilado (`motor-forja/integracion/adapter-test/entrada.mjs`), que la
 * app cargaba en runtime desde `public/motor-forja.mjs` sin tipos. Ahora el
 * motor vive aquí, lo compila Next con el resto de la app, lo comprueba
 * TypeScript y lo usan tanto el Estudio (`/forja`) como el chat.
 *
 * Reglas del motor (sin cambios): sin red, sin React, sin Node builtins,
 * determinista y nunca lanza.
 */
/* ─── núcleo y blindaje (v3 + v4.0 + v4.1 + v4.2) ─────────────────────── */
export * from "./tipos";
export * from "./tipos-v4";
export * from "./version";
export * from "./equipo";
export * from "./modelo";
export * from "./habilidades";
export * from "./representacion";
export * from "./nucleo";
export * from "./nucleo-v4";
export * from "./nucleo-extractos";
export * from "./maqueta";
export * from "./cache-fichas";
export * from "./continuacion-nucleo";
export * from "./motivo-parada";
export * from "./adaptador-resiliente";
export * from "./salud-proveedores";
export * from "./observabilidad";
export * from "./metricas";
export * from "./benchmark";
export * from "./director";
export * from "./arena";

/* ─── conocimiento, memoria y fuentes (v3) — faltaban en el bundle:
 * el Catálogo del Estudio lee FUENTES_SEMILLA y se quedaba siempre en 0 ─── */
export * from "./conocimiento-global";
export * from "./conocimiento-usuario";
export * from "./fuentes";
export * from "./fuentes-usuario";

/* ─── ADN, direcciones, jueces, anti-genérico (v4.0) ──────────────────── */
export * from "./adn-visual";
export * from "./adn2";
export * from "./exportadores-adn";
export * from "./antigenerico";
export * from "./antigenerico2";
export * from "./jueces2";
export * from "./revisor-visual";
export * from "./evaluador-exito";
export * from "./bucle-mejora";
export * from "./perfiles";
export * from "./director2";
export * from "./arena2";
export * from "./genoma-visual";
export * from "./memoria2";
export * from "./seguridad-web";
export * from "./bridge-design-system";
export * from "./vision";
export * from "./adapter-opendesign";
export * from "./voz";
export * from "./canvas";
export * from "./mejora-pagina";

/* ─── EFICIENCIA (v4.4 — plan §22/23/24/25/26/28) ─────────────────────── */
export * from "./presupuesto-tokens";
export * from "./cache-multinivel";
export * from "./compilador-contexto";
export * from "./enrutador-determinista";
export * from "./salida-temprana";
export * from "./token-roi";
export * from "./eficiencia";

/* ─── MOTOR DE EXPERIENCIA (v4.5 — correcciones moderno-3D §1-§35) ────── */
export * from "./experience-dna";
export * from "./familias-experiencia";
export * from "./experience-recipes";
export * from "./spatial-engine";
export * from "./motion-engine";
export * from "./hero-engine";
export * from "./card-system";
export * from "./experience-bias";
export * from "./anti-repetition";
export * from "./patrones-positivos";
export * from "./reference-dna";
export * from "./experience-qa";
export * from "./tokens-experiencia";
export * from "./plan-responsivo-experiencia";
export * from "./performance-gate";
export * from "./motor-creativo";
export * from "./referencias";

/* ─── EL TALLER QUE APRENDE (v4.6 — ideas A-F) ─────────────────────────── */
export * from "./primitivas";            // A: primitivas compiladas
export * from "./aprendizaje-genoma";    // B: learning loop del Genoma
export * from "./objeto-3d";             // C: objeto 3D CSS paramétrico
export * from "./motion-qa-medido";      // D: motion QA medido
export * from "./contrato-experiencia";  // E: contrato JSON exportable/editable
export * from "./arena-familias";        // F: Arena entre familias

/* ─── LA PÁGINA, NO EL HERO (v4.7 — ideas G-I) ─────────────────────────── */
export * from "./plano-contenido";       // G: plano de contenido + hechos del brief
export * from "./qa-detalle";            // H: QA de densidad de detalle
export * from "./iconos";                // I: iconografía e imagen compiladas

/* ─── EXPERIENCE COMPOSITION (v4.7.2) ─────────────────────────────────── */
export * from "./composition-engine";

export * from "./experience-manifest";

/* ─── autoaprendizaje (lo usa la ruta del Lab; no estaba en el paquete) ── */
export * from "./autoaprendizaje";
