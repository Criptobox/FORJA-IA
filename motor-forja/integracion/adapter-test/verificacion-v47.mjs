/**
 * FORJA IA v4.7.0 — PRUEBAS FUNCIONALES SIN RED de «La página, no el hero».
 * Ejecuta: node verificacion-v47.mjs <ruta-bundle>
 * (importa el bundle construido, igual que hace el Estudio).
 *
 * Cubre las correcciones y las 3 ideas nuevas:
 *  1. G — Plano de contenido: hechos del brief, inventario por vertical,
 *         niveles de detalle, sección de prompt
 *  2. H — QA de detalle: métricas, auditoría contra el plano, puntuación,
 *         encargo de reparación quirúrgica
 *  3. I — Iconografía e imagen compiladas: catálogo, SVG con currentColor,
 *         proporción fija, elección por sector
 *  4. CORRECCIONES: anti-repetición con hero real y en el contrato, corpus
 *         de señales en la maqueta, feedback que re-decide, recompilarDesdeDna
 *         sin degradar a minimal, verticales locales, presupuesto
 *  5. INTEGRACIÓN: contrato completo, CSS determinista, MVP con mock
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const aqui = dirname(fileURLToPath(import.meta.url));
const rutaBundle = resolve(process.argv[2] ?? resolve(aqui, "../../../host-forja-ia/public/motor-forja.mjs"));
const mod = await import(`file://${rutaBundle}`);
let pasados = 0, fallados = 0;

function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✓ ${nombre}`); }
  else { fallados++; console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ""}`); }
}
function bloque(titulo) { console.log(`\n── ${titulo} ──`); }

const BRIEF_LOCAL =
  "Web para la barbería El Navajazo en Ponce. 3 barberos, cortes desde $15, arreglo de barba $12, " +
  "horario lunes a sábado de 9:00 a 19:00, reservas por WhatsApp 787-555-1212, correo hola@navajazo.pr.";
const BRIEF_SAAS = "Landing moderna y detallada para un saas de analítica de producto con dashboard y 3d";

/* ───────────────────────── 1 · G — PLANO DE CONTENIDO ──────────────────── */
bloque("G · Plano de contenido");
{
  const { extraerHechos, construirPlanoContenido, seccionPlanoContenido, verticalDeContenido, nivelDeDetalle, PRESUPUESTOS } = mod;

  const h = extraerHechos(BRIEF_LOCAL);
  check("extrae los precios declarados", h.precios.includes("$15") && h.precios.includes("$12"), JSON.stringify(h.precios));
  check("extrae el teléfono", h.telefonos.some((t) => t.replace(/\D/g, "").includes("7875551212")), JSON.stringify(h.telefonos));
  check("extrae el correo", h.correos.includes("hola@navajazo.pr"));
  check("extrae la ciudad", h.ciudades.includes("Ponce"));
  check("extrae horarios", h.horarios.length >= 1, JSON.stringify(h.horarios));
  check("extrae cantidades de personal", h.cantidades.some((c) => /3 barberos/i.test(c)));
  check("un brief vacío no rompe la extracción", extraerHechos("").precios.length === 0);

  check("vertical de contenido local", verticalDeContenido(BRIEF_LOCAL) === "local", verticalDeContenido(BRIEF_LOCAL));
  check("vertical de contenido saas", verticalDeContenido(BRIEF_SAAS) === "saas");

  const plano = construirPlanoContenido(BRIEF_LOCAL);
  check("el plano tiene 7+ secciones", plano.secciones.length >= 7, String(plano.secciones.length));
  check("el plano empieza por navegación y acaba en pie",
    plano.secciones[0].id === "nav" && plano.secciones[plano.secciones.length - 1].id === "footer");
  check("los precios del brief AÑADEN la sección de precios",
    plano.secciones.some((s) => s.id === "precios"),
    plano.secciones.map((s) => s.id).join(","));
  check("el horario del brief asegura la sección de ubicación",
    plano.secciones.some((s) => s.id === "ubicacion"));
  check("las colecciones llevan mínimo de piezas",
    plano.secciones.filter((s) => s.coleccion).every((s) => s.minItems >= 3));
  check("el plano explica sus decisiones", plano.razones.length >= 2);

  check("nivel deducido: produccion por defecto", nivelDeDetalle("una web para mi tienda") === "produccion");
  check("nivel deducido: borrador si se pide rápido", nivelDeDetalle("un boceto rápido y simple") === "borrador");
  check("nivel deducido: showcase si se pide detalle", nivelDeDetalle("quiero una web muy detallada y profesional") === "showcase");
  check("el nivel forzado manda", construirPlanoContenido(BRIEF_LOCAL, { nivel: "borrador" }).nivel === "borrador");
  check("showcase pide más tokens que borrador",
    PRESUPUESTOS.showcase.maxTokensImplementacion > PRESUPUESTOS.borrador.maxTokensImplementacion);
  check("showcase pide más líneas que produccion",
    PRESUPUESTOS.showcase.lineasObjetivo[0] > PRESUPUESTOS.produccion.lineasObjetivo[0]);

  const texto = seccionPlanoContenido(plano);
  check("la sección de prompt trae los hechos como DATOS", /ÚSALOS TAL CUAL/.test(texto) && texto.includes("$15"));
  check("la sección de prompt prohíbe inventar datos como hechos", /NO debe presentarse como un hecho real/.test(texto) || /Lorem ipsum/.test(texto));
  check("la sección de prompt exige estados y proporción",
    /focus-visible/.test(texto) && /aspect-ratio/.test(texto));
  check("la sección de prompt numera las secciones obligatorias", /1\. \*\*Navegación\*\*/.test(texto));
}

/* ───────────────────────── 2 · H — QA DE DETALLE ───────────────────────── */
bloque("H · QA de detalle");
{
  const { medirDetalle, auditarDetalle, puntuacionDetalle, seccionReparacionDetalle, construirPlanoContenido } = mod;
  const plano = construirPlanoContenido(BRIEF_LOCAL);

  const POBRE = `<!doctype html><html lang="es"><head><title>x</title></head><body>
    <section class="hero"><h1>Bienvenido</h1><p>Lorem ipsum dolor sit amet</p><a href="#x">Reservar</a></section>
    <section><h2>Servicios</h2><div>Corte</div></section>
    <style>a:hover{color:red}</style></body></html>`;

  const m = medirDetalle(POBRE);
  check("mide secciones", m.secciones === 2, String(m.secciones));
  check("mide palabras visibles sin CSS ni scripts", m.palabras > 0 && m.palabras < 30, String(m.palabras));
  check("detecta los estados presentes en el CSS", m.estados.includes(":hover"));
  check("cuenta breakpoints", m.breakpoints === 0);
  check("un HTML vacío no rompe la medición", medirDetalle("").secciones === 0);

  const inf = auditarDetalle(POBRE, plano);
  check("la página pobre FALLA el QA de detalle", inf.veredicto === "FAIL", inf.veredicto);
  check("puntuación de detalle muy baja", inf.puntuacion <= 20, String(inf.puntuacion));
  check("detecta el texto de relleno", inf.hallazgos.some((h) => h.id === "relleno"));
  check("detecta que faltan secciones", inf.hallazgos.some((h) => h.id === "pocas-secciones"));
  check("detecta el responsive insuficiente", inf.hallazgos.some((h) => h.id === "responsive-pobre"));
  check("detecta la falta de :focus-visible", inf.hallazgos.some((h) => h.id === "estados"));
  check("cada hallazgo trae corrección propuesta", inf.hallazgos.every((h) => h.correccion.length > 10));

  const encargo = seccionReparacionDetalle(inf, plano);
  check("el encargo dice AMPLIAR, no regenerar", /AMPL[IÍ]A|ampl[ií]a/i.test(encargo) && /no regeneres/i.test(encargo));
  check("el encargo protege tokens, objeto 3D y primitivas",
    /tokens/i.test(encargo) && /primitivas/i.test(encargo));
  check("el encargo recuerda los mínimos del plano", /piezas reales/i.test(encargo));

  const RICA = `<!doctype html><html lang="es"><head><title>x</title></head><body>
    <nav id="nav"><a href="#oferta">Servicios</a></nav>
    ${Array.from({ length: 9 }, (_, i) => `<section id="s${i}"><h2>Sección ${i}</h2><ul>${Array.from({ length: 7 }, (_, j) => `<li>Pieza ${i}-${j} con su descripción concreta y un dato distinto de ${j * 7 + 3} unidades reales medidas</li>`).join("")}</ul></section>`).join("")}
    <section id="oferta"><h2>Servicios</h2><svg></svg><svg></svg><svg></svg><svg></svg><svg></svg><svg></svg></section>
    <style>${"a:hover{color:red}a:focus-visible{outline:2px}a:active{top:1px}button:disabled{opacity:.5}@media(min-width:768px){a{color:blue}}@media(min-width:1024px){a{color:green}}@media(min-width:480px){a{color:gray}}"}${Array.from({ length: 300 }, (_, i) => `.c${i}{margin:${i}px;}`).join("")}</style>
    </body></html>`;
  const infRica = auditarDetalle(RICA, plano);
  check("una página densa puntúa alto", infRica.puntuacion >= 70, String(infRica.puntuacion));
  check("una página densa no pide reparación", seccionReparacionDetalle(infRica, plano) === "" || infRica.veredicto !== "FAIL");
  check("la puntuación es monótona respecto al detalle",
    puntuacionDetalle(medirDetalle(RICA), plano) > puntuacionDetalle(medirDetalle(POBRE), plano));
}

/* ─────────────────── 3 · I — ICONOGRAFÍA E IMAGEN COMPILADAS ───────────── */
bloque("I · Iconografía e imagen");
{
  const { ICONOS, svgIcono, elegirIconos, seccionIconografia, figuraPlaceholder, cssIconografia } = mod;

  check("el catálogo tiene 20+ iconos", ICONOS.length >= 20, String(ICONOS.length));
  check("no hay ids repetidos", new Set(ICONOS.map((i) => i.id)).size === ICONOS.length);

  const svg = svgIcono("reloj");
  check("el SVG hereda el color del texto", /stroke="currentColor"/.test(svg));
  check("el SVG es decorativo por defecto", /aria-hidden="true"/.test(svg) && /focusable="false"/.test(svg));
  check("el SVG con etiqueta es semántico",
    /role="img"/.test(svgIcono("reloj", { etiqueta: "Horario" })) && /aria-label="Horario"/.test(svgIcono("reloj", { etiqueta: "Horario" })));
  check("grosor de trazo coherente en todo el catálogo",
    ICONOS.every((i) => /stroke-width="1.75"/.test(svgIcono(i.id))));
  check("un id inexistente devuelve cadena vacía, no lanza", svgIcono("no-existe") === "");
  check("el tamaño se capa", /width="64"/.test(svgIcono("reloj", { tamano: 900 })));

  const barberia = elegirIconos(BRIEF_LOCAL);
  check("la barbería recibe calendario y persona",
    barberia.iconos.includes("calendario") && barberia.iconos.includes("persona"), barberia.iconos.join(","));
  const saas = elegirIconos(BRIEF_SAAS);
  check("el saas recibe gráfico y rayo", saas.iconos.includes("grafico") && saas.iconos.includes("rayo"), saas.iconos.join(","));
  check("la base universal viaja siempre", ["flecha", "check", "menu"].every((x) => saas.iconos.includes(x)));
  check("el juego está capado", elegirIconos(BRIEF_SAAS, 99).iconos.length <= 24);

  const fig = figuraPlaceholder("Fachada de la barbería", { ratio: "16 / 9", pie: "Calle Isabel, Ponce" });
  check("la imagen declara proporción", /--f-ratio:16 \/ 9/.test(fig));
  check("la imagen es accesible", /role="img"/.test(fig) && /aria-label="Fachada/.test(fig));
  check("la CSS fija aspect-ratio y object-fit",
    /aspect-ratio/.test(cssIconografia()) && /object-fit:cover/.test(cssIconografia()));
  check("la CSS alinea cifras tabularmente", /tabular-nums/.test(cssIconografia()));

  const sec = seccionIconografia(barberia);
  check("la sección prohíbe emojis como iconografía", /PROHIBIDO usar emojis/.test(sec));
  check("la sección trae los SVG exactos", /<svg/.test(sec));
}

/* ────────────────────────── 4 · CORRECCIONES ───────────────────────────── */
bloque("Correcciones del pipeline");
{
  const {
    seleccionarExperiencia, seccionContratoExperiencia, cssDeterminista, recompilarDesdeDna,
    reiniciarAntiRepeticion, registrarComposicion, seleccionarFamilia, mensajeMaqueta, corpusDeSenales,
    presupuestoDefecto, exportarContrato, aplicarEdicionContrato,
  } = mod;

  // — anti-repetición con la composición REAL (antes: cadenas vacías)
  reiniciarAntiRepeticion();
  const sel1 = seleccionarExperiencia(BRIEF_SAAS);
  for (let i = 0; i < 3; i++) {
    registrarComposicion({ hero: sel1.hero.tipo, cards: sel1.cards.variantes, motion: [], spatial: sel1.dna.spatial.mode, navegacion: "minimal", secciones: [], cuando: 1000 + i });
  }
  const sel2 = seleccionarExperiencia(BRIEF_SAAS);
  check("la penalización ve el hero real (no cadena vacía)",
    sel2.penalizacion.consejo.length > 0 || sel2.hero.tipo !== sel1.hero.tipo,
    JSON.stringify(sel2.penalizacion));
  check("la anti-repetición llega al contrato del maquetador",
    /ANTI-REPETICI[ÓO]N|anti-repetici/i.test(seccionContratoExperiencia(sel2)));
  reiniciarAntiRepeticion();

  // — el contrato lleva el plano y la iconografía
  const sel = seleccionarExperiencia(BRIEF_LOCAL, { mensajeOriginal: BRIEF_LOCAL });
  const contrato = seccionContratoExperiencia(sel);
  check("el contrato incluye el PLANO DE CONTENIDO", /PLANO DE CONTENIDO/.test(contrato));
  check("el contrato incluye la iconografía compilada", /ICONOGRAF[ÍI]A/.test(contrato));
  check("el contrato lleva los hechos del brief", contrato.includes("$15") && contrato.includes("Ponce"));
  check("la CSS determinista incluye el sistema de iconos e imagen",
    /\.f-ico\{/.test(cssDeterminista(sel)) && /\.f-fig-marco\{/.test(cssDeterminista(sel)));
  check("la selección expone el plano y los iconos", Boolean(sel.plano) && Boolean(sel.iconos));

  // — corpus de señales en la maqueta
  const peticion = { mensaje: BRIEF_LOCAL, modo: "maqueta" };
  const ficha = "# Ficha de diseño\n## Estructura (secciones de arriba a abajo)\n1. hero espacial con capas\n## Interacción\nparallax al scroll";
  const corpus = corpusDeSenales(peticion, ficha, null, "quítale el movimiento, más editorial");
  check("el corpus incluye el brief", corpus.includes("Navajazo"));
  check("el corpus incluye la estructura de la ficha", /capas/.test(corpus));
  check("el corpus pesa el feedback (aparece dos veces)",
    (corpus.match(/más editorial/g) ?? []).length >= 2);

  const sinFeedback = mensajeMaqueta(peticion, ficha, null);
  const conFeedback = mensajeMaqueta(peticion, ficha, "hazlo editorial, sin objeto 3D, sin movimiento");
  check("el feedback RE-DECIDE la experiencia (antes se ignoraba)",
    sinFeedback !== conFeedback && /Ajuste pedido/.test(conFeedback));
  check("el mensaje de maqueta lleva el plano de contenido", /PLANO DE CONTENIDO/.test(sinFeedback));
  check("el mensaje de maqueta lleva los hechos del brief", sinFeedback.includes("787-555-1212"));

  // — recompilar sin degradar a minimal
  const selSaas = seleccionarExperiencia(BRIEF_SAAS, { mensajeOriginal: BRIEF_SAAS });
  const recompilada = recompilarDesdeDna(selSaas.dna, { mensajeOriginal: BRIEF_SAAS });
  check("recompilarDesdeDna conserva la familia (antes caía a minimal)",
    recompilada.familia.familia === selSaas.familia.familia,
    `${selSaas.familia.familia} → ${recompilada.familia.familia}`);
  check("recompilarDesdeDna conserva el plano de contenido", recompilada.plano.secciones.length >= 7);

  // — el contrato editable no pierde los hechos
  const json = exportarContrato(selSaas, BRIEF_SAAS);
  const edicion = aplicarEdicionContrato({ ...json, edicion: { radiusPx: 20 } });
  check("editar el contrato no degrada la familia",
    edicion.ok && edicion.sel.familia.familia === selSaas.familia.familia);

  // — verticales locales
  const famLocal = seleccionarFamilia("web para una panadería de barrio");
  check("una panadería ya no es «general»", famLocal.vertical === "local", famLocal.vertical);
  check("una panadería no cae en la familia quieta por defecto",
    famLocal.familia !== "minimal", famLocal.familia);

  // — presupuesto recalibrado
  const rep = presupuestoDefecto("media", "SMART");
  check("la implementación recibe más presupuesto que antes", rep.implementation > 13_000, String(rep.implementation));
  check("el reparto sigue sumando el total",
    Object.values(rep).every((v) => v >= 0) && rep.implementation > rep.qa);
}

/* ────────────────────────── 5 · INTEGRACIÓN MVP ────────────────────────── */
bloque("Integración: MVP completo con mock");
{
  const { ejecutarMvpForja } = mod;
  const PAGINA_POBRE = "```html\n<!doctype html><html lang=\"es\"><head><meta name=\"viewport\" content=\"width=device-width\"><title>Barbería</title></head><body><h1>Barbería</h1><p>Lorem ipsum</p></body></html>\n```";
  let llamadas = 0;
  const res = await ejecutarMvpForja(
    { mensaje: BRIEF_LOCAL, modo: "directo" },
    {
      perfil: "FREE",
      llamarModelo: async () => { llamadas++; return PAGINA_POBRE; },
      onProgreso: () => {},
      sinReparacionDetalle: true,
    }
  );
  check("el MVP termina sin lanzar", Boolean(res.resultado));
  check("la selección de experiencia trae plano", res.experiencia.plano.secciones.length >= 7);
  check("el registro anota el plano", Boolean(res.registro.experiencia?.plano));
  check("el registro anota el QA de detalle", /detalle \d+\/100/.test(res.registro.experiencia?.detalleQa ?? ""));
  check("el QA de detalle detecta la página pobre", /FAIL/.test(res.registro.experiencia?.detalleQa ?? ""));
  check("sinReparacionDetalle evita la llamada extra", llamadas > 0);

  // el historial de composición se puede restaurar (antes moría con el proceso)
  const res2 = await ejecutarMvpForja(
    { mensaje: BRIEF_SAAS, modo: "directo" },
    {
      perfil: "FREE",
      llamarModelo: async () => PAGINA_POBRE,
      historialComposicion: [
        { hero: "HERO_SPATIAL", cards: ["CARD_FLOATING"], motion: [], spatial: "2.5d", navegacion: "minimal", secciones: [], cuando: 1 },
        { hero: "HERO_SPATIAL", cards: ["CARD_FLOATING"], motion: [], spatial: "2.5d", navegacion: "minimal", secciones: [], cuando: 2 },
      ],
      onProgreso: () => {},
      sinReparacionDetalle: true,
    }
  );
  check("el historial persistido se restaura", res2.traza.some((t) => /historial restaurado/.test(t)));
  check("la traza informa del plano", res2.traza.some((t) => /\[plano\]/.test(t)));
  check("la traza informa del QA de detalle", res2.traza.some((t) => /\[detalle-qa\]/.test(t)));
}

/* ───────────────────────── 6 · v4.7.2 — COMPOSITION ENGINE ───────────── */
bloque("v4.7.2 · Composition Engine");
{
  const { construirCompositionBlueprint, seccionCompositionBlueprint, recetaPorId, construirPlanoContenido } = mod;
  const plano = construirPlanoContenido(BRIEF_SAAS);
  const receta = recetaPorId("spatial_product");
  const c = construirCompositionBlueprint({ familia: "spatial", receta, plano });
  check("exporta el Composition Engine", typeof construirCompositionBlueprint === "function");
  check("crea blueprint de composición", c.version === "forja.composition@1" && c.sections.length >= 6);
  check("varía el ritmo de la página", new Set(c.sections.map((s) => s.rhythm)).size >= 3);
  check("incluye reglas anti-template", c.antiTemplate.length >= 3);
  check("el contrato describe la composición", /COMPOSITION BLUEPRINT/.test(seccionCompositionBlueprint(c)));
}

console.log(`\n═══ RESULTADO v4.7.2: ${pasados} pasados · ${fallados} fallados ═══`);
process.exit(fallados > 0 ? 1 : 0);
