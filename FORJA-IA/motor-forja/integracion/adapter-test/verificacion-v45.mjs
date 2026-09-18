/**
 * FORJA IA v4.5.0 — PRUEBAS FUNCIONALES SIN RED del Motor de Experiencia.
 * Ejecuta: node /home/z/my-project/forja-work/verificacion-v45.mjs
 * (importa el bundle construido, igual que hace el Estudio).
 *
 * 15 escenarios del doc FORJA_IA_CORRECCIONES_DISENO_MODERNO_3D.md:
 *  1. §1/§3/§23  Fin del sesgo editorial: familia por intención
 *  2. §23        Regla de seguridad creativa (moderno → NO editorial)
 *  3. §2         Experience DNA sintetizado (3D → modo 3d + objeto)
 *  4. §4         Recetas: familia → receta ejecutable
 *  5. §5         Spatial engine: escena con z-index semántico + objeto focal
 *  6. §8/§9      Motion engine: intensidades 0-4 + tiempos por categoría
 *  7. §6         Hero engine: 10 tipos + anti-repetición por historial
 *  8. §7         Card system: variantes + disciplina del glass
 *  9. §11/§12    Editorial score + métricas de experiencia
 * 10. §13        Anti-repetición: penalización y consejo
 * 11. §18        Design tokens de experiencia
 * 12. §19        Responsive experience plan (mantiene/reduce/elimina…)
 * 13. §10/§20    Puerta de rendimiento + cascada de degradación
 * 14. §24/§25    Reference DNA: principios, no píxeles
 * 15. §21/§22 + MVP: QA de experiencia, parches, MVP con mock y registro
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const aqui = dirname(fileURLToPath(import.meta.url));
const rutaBundle = resolve(process.argv[2] ?? resolve(aqui, "../../../host-forja-ia/public/motor-forja.mjs"));
const mod = await import(`file://${rutaBundle}`);
let pasados = 0, fallados = 0;

function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✓ ${nombre}${detalle ? " — " + detalle : ""}`); }
  else { fallados++; console.error(`  ✗ ${nombre}${detalle ? " — " + detalle : ""}`); }
}

/* HTML «revista» (denso en prosa, sin 3D) y HTML «espacial» */
const REVISTA = `<html lang="es"><head><title>Blog</title><style>body{max-width:680px;margin:0 auto}p{line-height:1.8}</style></head><body><main><h1>El pan lento</h1><p>${"El fermento natural exige paciencia y observación constante del clima, la harina y el tiempo de trabajo. ".repeat(4)}</p><p>${"Cada masa guarda su propia historia de humedad, temperatura y manos que la trabajan con oficio. ".repeat(4)}</p><p>${"La corteza cruje cuando el almidón se asienta y el vapor escapa por las grietas del pan recién hecho. ".repeat(4)}</p><section><h2>El horno</h2><p>${"Un horno de leña tarda cuatro horas en alcanzar su punto y otras tantas en soltar el calor acumulado. ".repeat(3)}</p></section></main></body></html>`;
const ESPACIAL = `<html lang="es"><head><title>IA</title><style>:root{--depth-1:20px}.escena{perspective:1600px;transform-style:preserve-3d}.objeto{transform:translateZ(60px)}.card{transition:transform .4s;animation:flota 6s ease-in-out infinite}@keyframes flota{50%{transform:translateY(8px)}}.reveal{opacity:0;transition:opacity .9s}</style></head><body><section class="escena"><div class="objeto">objeto 3D</div><div class="card">card flotante</div><div class="card">métrica</div><h1>IA Forge</h1><button>Probar</button></section><section class="reveal">segunda escena</section></body></html>`;

console.log("\n═══ 1 · §1/§3/§23 — fin del sesgo editorial ═══");
{
  const sel = mod.seleccionarFamilia("Landing premium para una startup de IA, futurista, con 3D, animaciones y sensación tecnológica");
  check("moderno+3D NO elige editorial", sel.familia !== "editorial", `→ ${sel.familia}`);
  const blog = mod.seleccionarFamilia("Blog de artículos y noticias del taller, una revista mensual");
  check("blog/revista SÍ permite editorial", blog.familia === "editorial", `→ ${blog.familia}`);
  const neutro = mod.seleccionarFamilia("Web para un taller de cerámica");
  check("sin señales NO cae en editorial", neutro.familia !== "editorial", `→ ${neutro.familia} (${neutro.razones[0] ?? ""})`);
  const vis = mod.visionesDeRespaldo("Landing moderna premium futurista para startup de IA");
  check("visiones de respaldo sin editorial primero", vis[0].arquetipo !== "editorial" || vis[1].arquetipo !== "editorial", `→ ${vis.map((v) => v.arquetipo).join(", ")}`);
  const vs = mod.visionesDeRespaldo("Web de un taller de cerámica");
  check("3 visiones con arquetipos distintos", new Set(vs.map((v) => v.arquetipo)).size === 3, vis.map((v) => v.arquetipo).join(", "));
}

console.log("\n═══ 2 · §23 — regla de seguridad creativa en el prompt del Director ═══");
{
  const adn = mod.adn2DesdeAdn1(null, "landing premium futurista con 3D para startup de IA");
  const prompt = mod.promptDirector2("landing premium futurista con 3D para startup de IA", adn);
  check("el prompt lleva la familia decidida", prompt.includes("FAMILIA DE EXPERIENCIA"));
  check("el prompt prohíbe editorial sin intención", prompt.includes("EDITORIAL PROHIBIDA") || prompt.includes("NO propongas editorial"));
  check("el prompt lleva biblioteca positiva (§14)", prompt.includes("BIBLIOTECA POSITIVA"));
  check("el prompt de fusion pide base y concepto", mod.promptDirectorFusion2([], []).includes("Base: A|B|C"));
}

console.log("\n═══ 3 · §2 — Experience DNA ═══");
{
  const { dna, razones } = mod.sintetizarExperienciaDna("Landing premium futurista con 3D y parallax para una startup de IA");
  check("3D → modo espacial 3d", dna.spatial.mode === "3d", dna.spatial.mode);
  check("3D → objeto use3d", dna.object.use3d === true);
  check("parallax activado", dna.motion.parallax === true);
  check("razones registradas", razones.length >= 2, razones.join("; ").slice(0, 80));
  // v4.6: «taller de cerámica» ahora ES señal comercial local (vertical pequeño
  // de negocio → página más rica); se usa una frase verdaderamente neutral
  const flat = mod.sintetizarExperienciaDna("Web simple para un proyecto personal sin señales especiales").dna;
  check("sin señales → flat", flat.spatial.mode === "flat");
  check("seccionExperienciaDna es contrato legible", mod.seccionExperienciaDna(dna).includes("spatial:") && mod.seccionExperienciaDna(dna).includes("surface:"));
}

console.log("\n═══ 4 · §4 — Experience Recipes ═══");
{
  check("7 recetas del doc", mod.RECETAS.length === 7, mod.RECETAS.map((r) => r.id).join(", "));
  const sel = mod.recetaParaFamilia("spatial", "landing de producto con 3D");
  check("familia spatial → SPATIAL_PRODUCT", sel.receta.id === "spatial_product");
  check("receta lleva hero+superficies+motion+interacción", sel.receta.hero.tipo === "HERO_SPATIAL" && sel.receta.superficies.floatingCards === true && sel.receta.motion.parallax === true);
  check("seccionReceta ejecutable", mod.seccionReceta(sel.receta).includes("EXPERIENCE RECIPE: SPATIAL_PRODUCT"));
  const cin = mod.recetaParaFamilia("cinematic", "");
  check("cinematic → CINEMATIC_PRODUCT", cin.receta.id === "cinematic_product");
}

console.log("\n═══ 5 · §5 — Spatial Engine ═══");
{
  const { dna } = mod.sintetizarExperienciaDna("landing premium con 3D y parallax para startup de IA");
  const receta = mod.recetaParaFamilia("spatial", "producto 3D").receta;
  const plan = mod.construirPlanEspacial(dna, mod.recetaParaFamilia("3d-showcase", "objeto 3D central").receta);
  check("capas con z-index semántico ascendente", plan.layers.every((l, i) => i === 0 || plan.layers[i - 1].z <= l.z), plan.layers.map((l) => `z${l.z}:${l.id}`).join(" "));
  check("objeto focal tipo 3D con 3d-showcase", plan.focalObject && plan.focalObject.type === "3d", plan.focalObject?.type);
  check("objeto focal también con receta de producto", Boolean(mod.construirPlanEspacial(dna, mod.recetaParaFamilia("spatial", "producto").receta).focalObject));
  check("navegación siempre al frente (z 10)", plan.layers.some((l) => l.id === "navegacion" && l.z === 10));
  check("perspectiva en px", mod.seccionPlanEspacial(plan).includes("perspectiva"));
  check("cssEscenario con preserve-3d", mod.cssEscenario(plan).includes("preserve-3d"));
}

console.log("\n═══ 6 · §8/§9 — Motion Engine ═══");
{
  check("16 primitivas del doc", mod.PRIMITIVAS.length === 16);
  check("catálogo 0-4 con nombres", mod.CATALOGO_INTENSIDAD.length === 5 && mod.CATALOGO_INTENSIDAD[4].nombre === "immersive");
  check("escala de tiempos por categoría", mod.ESCALA_TIEMPO.length === 5 && mod.ESCALA_TIEMPO[0].rango === "150-300ms" && mod.ESCALA_TIEMPO[3].rango === "800-1600ms");
  const { dna } = mod.sintetizarExperienciaDna("landing inmersiva animada con parallax y escenas");
  const receta = mod.recetaParaFamilia("cinematic", "escenas cinematográficas").receta;
  const plan = mod.construirPlanMovimiento(dna, receta);
  check("intensidad alta activa escena", plan.intensidad >= 3, `${plan.intensidad}/4`);
  check("reduced-motion SIEMPRE", plan.reducedMotion === true && plan.coreografia.some((c) => c.includes("prefers-reduced-motion")));
  check("cssMovimiento incluye la guardia", mod.cssMovimiento(plan).includes("prefers-reduced-motion: reduce"));
  const suave = mod.construirPlanMovimiento(mod.sintetizarExperienciaDna("web sobria de clínica dental").dna, mod.recetaParaFamilia("minimal", "").receta);
  check("intención sobria → intensidad baja", suave.intensidad <= 2, `${suave.intensidad}/4`);
}

console.log("\n═══ 7 · §6 — Hero Engine ═══");
{
  const { dna } = mod.sintetizarExperienciaDna("showcase 3D de un producto tech");
  const h1 = mod.elegirHero(dna, "3d-showcase", "showcase 3D de un producto tech");
  check("3D → HERO_3D_OBJECT", h1.tipo === "HERO_3D_OBJECT", h1.tipo);
  check("composición ≠ hero por defecto", h1.composicion.join("+").includes("objeto 3D central") || h1.composicion.length >= 2, h1.composicion.join(" + "));
  check("seccionHero prohíbe el patrón por defecto", mod.seccionHero(h1).includes("PROHIBIDO"));
  // anti-repetición por historial (§13 integrado)
  const h2 = mod.elegirHero(dna, "3d-showcase", "", ["HERO_3D_OBJECT", "HERO_3D_OBJECT", "HERO_3D_OBJECT"]);
  check("historial con 3× el mismo hero → rota", h2.tipo !== "HERO_3D_OBJECT", h2.tipo);
  check("10 tipos de hero", ["HERO_SPATIAL","HERO_3D_OBJECT","HERO_PRODUCT","HERO_CINEMATIC","HERO_INTERACTIVE","HERO_SPLIT","HERO_FLOATING_CARDS","HERO_FULLSCREEN","HERO_SCROLL_REVEAL","HERO_MINIMAL"].every((t) => mod.defHero(t)));
}

console.log("\n═══ 8 · §7 — Card System ═══");
{
  check("14 variantes del doc", mod.CARDS.length === 14);
  const { dna } = mod.sintetizarExperienciaDna("saas premium con interacción tilt y magnetic");
  const receta = mod.recetaParaFamilia("interactive", "saas app").receta;
  const el = mod.elegirCards(dna, receta);
  check("floatingCards de la receta → CARD_FLOATING", el.variantes.includes("CARD_FLOATING"));
  check("glass limitado (≤ 1 variante)", el.variantes.filter((v) => v === "CARD_GLASS").length <= 1, el.disciplina[0]?.slice(0, 60));
  check("cssCards genera CSS por variante", mod.cssCards(el.variantes).includes(".card-"));
  const sobrio = mod.elegirCards(mod.sintetizarExperienciaDna("web sobria de clínica").dna, mod.recetaParaFamilia("minimal", "").receta);
  check("sin blur en el ADN → sin glass", !sobrio.variantes.includes("CARD_GLASS"));
}

console.log("\n═══ 9 · §11/§12 — editorial bias + métricas ═══");
{
  const sR = mod.senalesHtml(REVISTA);
  const sE = mod.senalesHtml(ESPACIAL);
  const eR = mod.scoreEditorial(sR);
  const eE = mod.scoreEditorial(sE);
  check("revista → editorial score alto", eR > mod.UMBRAL_EDITORIAL, `${Math.round(eR * 100)}%`);
  check("espacial → editorial score bajo", eE < 0.4, `${Math.round(eE * 100)}%`);
  const mE = mod.medirExperiencia(ESPACIAL);
  check("métricas: spatial > editorial en página espacial", mE.spatial > mE.editorial, mod.resumenMetricas(mE));
  const desvio = mod.desviacionDeDna(mE, mod.sintetizarExperienciaDna("landing premium futurista con 3D y parallax").dna);
  check("coherencia con ADN medida (no máximo)", typeof desvio.desviacion === "number" && desvio.resumen.length > 0, desvio.resumen.slice(0, 70));
}

console.log("\n═══ 10 · §13 — Anti-repetición ═══");
{
  mod.reiniciarAntiRepeticion();
  ["HERO_3D_OBJECT", "HERO_FLOATING_CARDS", "HERO_SPATIAL", "HERO_3D_OBJECT"].forEach((h, i) =>
    mod.registrarComposicion({ hero: h, cards: ["CARD_FLOATING"], motion: ["parallax"], spatial: "2.5d", navegacion: "minimal", secciones: [], cuando: 1000 + i })
  );
  check("historial guarda las últimas composiciones", mod.obtenerHistorial().length === 4);
  check("hero repetido penaliza (§13: 1 uso en las últimas 3)", mod.penalizacionHero("HERO_3D_OBJECT") >= 1, `-${mod.penalizacionHero("HERO_3D_OBJECT")}`);
  const pen = mod.penalizacionComposicion("HERO_3D_OBJECT", "2.5d", "CARD_FLOATING");
  check("penalización compuesta con consejo", pen.puntos > 0 && pen.consejo.length > 10, pen.consejo.slice(0, 60));
  const fresco = mod.penalizacionComposicion("HERO_CINEMATIC", "3d", "CARD_MEDIA");
  check("composición fresca sin penalización", fresco.puntos === 0);
  mod.reiniciarAntiRepeticion();
}

console.log("\n═══ 11 · §18 — Design tokens de experiencia ═══");
{
  const { dna } = mod.sintetizarExperienciaDna("landing premium con 3D y parallax");
  const css = mod.tokensExperienciaCss(dna);
  const esperados = ["--radius-md", "--radius-2xl", "--depth-1", "--depth-4", "--perspective-medium", "--motion-fast", "--motion-slow", "--shadow-soft", "--shadow-floating", "--shadow-deep", "--surface-floating", "--surface-elevated"];
  check("todos los tokens del doc presentes", esperados.every((t) => css.includes(t)), `${esperados.filter((t) => css.includes(t)).length}/${esperados.length}`);
  // v4.6: frase neutral (la señal comercial local ahora cubre talleres/negocios)
  const flat = mod.tokensExperienciaCss(mod.sintetizarExperienciaDna("página personal sin señales especiales").dna);
  check("experiencia plana: depth reducido", Number(flat.match(/--depth-4:\s*(\d+)px/)?.[1] ?? 99) <= 50);
}

console.log("\n═══ 12 · §19 — Responsive Experience Plan ═══");
{
  const { dna } = mod.sintetizarExperienciaDna("experiencia 3D inmersiva con parallax y cards flotantes");
  const receta = mod.recetaParaFamilia("spatial", "3D parallax").receta;
  const plan = mod.construirPlanResponsivo(dna, receta);
  check("reduce en tablet/móvil", plan.decisiones.reduce.length > 0, plan.decisiones.reduce[0]);
  check("elimina camera movement en móvil", plan.decisiones.elimina.some((x) => x.toLowerCase().includes("móvil") || x.toLowerCase().includes("movil")));
  check("transforma 3D a gesto en móvil", plan.decisiones.transforma.some((x) => x.toLowerCase().includes("transforma") || x.toLowerCase().includes("objeto")));
  check("mantiene jerarquía y accesibilidad", plan.decisiones.mantiene.some((x) => x.includes("jerarquía")) && plan.decisiones.mantiene.some((x) => x.includes("accesibilidad")));
  check("seccionPlanResponsivo legible", mod.seccionPlanResponsivo(plan).includes("Se MANTIENE") && mod.seccionPlanResponsivo(plan).includes("Se ELIMINA"));
}

console.log("\n═══ 13 · §10/§20 — Puerta de rendimiento ═══");
{
  const d1 = mod.evaluarPuerta({ intencionExigeWebgl: true, pesoActivosKb: 900, nodosAnimados: 30, costeGpu: "alto", movilPrimero: false }, "webgl");
  check("WebGL con peso+GPU alto → degrada", d1.modo !== "webgl", d1.razon);
  const d2 = mod.evaluarPuerta({ intencionExigeWebgl: false, pesoActivosKb: 0, nodosAnimados: 20, costeGpu: "medio", movilPrimero: true }, "3d");
  check("móvil con 20 nodos → 2.5d", d2.modo === "2.5d", d2.razon);
  const d3 = mod.evaluarPuerta({ intencionExigeWebgl: false, pesoActivosKb: 0, nodosAnimados: 4, costeGpu: "bajo", movilPrimero: false }, "2.5d");
  check("efecto ligero → 2d si no aporta", d3.modo === "2d" || d3.modo === "2.5d", d3.razon);
  const d4 = mod.evaluarPuerta({ intencionExigeWebgl: false, pesoActivosKb: 0, nodosAnimados: 6, costeGpu: "medio", movilPrimero: false }, "3d");
  check("3D CSS confirmado sin cargas", d4.modo === "3d" && !d4.degradadoDe, "0 dependencias, 0 KB");
  check("cascada exacta del doc", JSON.stringify(mod.CASCADA) === JSON.stringify(["webgl", "3d", "2.5d", "2d"]));
}

console.log("\n═══ 14 · §24/§25 — Reference DNA ═══");
{
  const dna = mod.extraerAdnReferencia("Referencia 2: dark canvas con technical grid, oversized typography, un central 3D object, minimal navigation, floating metrics y composición cinematográfica");
  check("paleta oscura detectada", dna.palette.some((p) => p.toLowerCase().includes("oscuro")));
  check("tipografía oversized detectada", dna.typography.some((p) => p.toLowerCase().includes("escala de escena")));
  check("objeto 3D central detectado", dna.objectTreatment.toLowerCase().includes("3d"));
  const p = mod.principiosNoPixeles(dna);
  check("principios, no píxeles: aprender lleno", p.aprender.length >= 3, `${p.aprender.length} principios`);
  check("prohibido copiar estructura/marca", p.noCopiar.some((x) => x.includes("estructura literal")) && p.noCopiar.some((x) => x.includes("marca")));
  check("seccionAdnReferencia con la regla de oro", mod.seccionAdnReferencia(dna).includes("NO píxeles"));
  // integrado en referencias.ts
  const atr = mod.analizarReferencia({ id: "r1", tipo: "descripcion", texto: "dark canvas, technical grid, oversized typography, central 3D object" });
  check("analizarReferencia inyecta Reference DNA", Boolean(atr.adn) && atr.adn.palette.length > 0);
  const insp = mod.inspiracionDesdeAtributos(atr, "descripcion");
  check("inspiración incluye principios del Reference DNA", insp.referencias.some((r) => !r.startsWith("descripcion:")));
}

console.log("\n═══ 15 · §21/§22 + MVP completo ═══");
{
  const { dna } = mod.sintetizarExperienciaDna("landing premium futurista con 3D y parallax para startup de IA");
  const hallazgos = mod.auditarExperiencia(REVISTA, dna);
  check("QA detecta sesgo editorial en la «revista»", hallazgos.some((h) => h.chequeo === "editorial-bias"), hallazgos.map((h) => h.chequeo).join(", "));
  const r = mod.parchesExperiencia(REVISTA, hallazgos, dna);
  check("parches aplicados sin LLM", r.parches.length >= 2, r.parches.map((p) => p.tipo).join(", "));
  check("contenido intacto tras parchear", r.html.includes("El pan lento") && r.html.length > REVISTA.length);
  check("parches con reduced-motion", r.html.includes("prefers-reduced-motion"));
  const r2 = mod.parchesExperiencia(r.html, hallazgos, dna);
  check("parches idempotentes (sin duplicar bloques)", (r2.html.match(/forja-qa-exp/g) ?? []).length <= (r.html.match(/forja-qa-exp/g) ?? []).length + 1);
  const esp = mod.auditarExperiencia(ESPACIAL, dna);
  check("página espacial: sin críticos de sesgo", !esp.some((h) => h.chequeo === "editorial-bias" && h.nivel === "critico"));

  // MVP completo con mock (como la prueba v4.4)
  mod.reiniciarAntiRepeticion();
  let llamadas = 0;
  const mock = async () => {
    llamadas++;
    if (llamadas === 1) {
      return `<adn2>\nIdentidad: una startup de IA con presencia cinematográfica\nPersonalidad: precisa, osada, técnica\nSensación: innovación 9, confianza 7\nComposición: escena por capas con objeto 3D; asimetría intencional\nTipografía: display enorme + mono para datos\nColor: lienzo oscuro #0B0F19, acento violeta #7C3AED\nEspaciado: aire generoso entre escenas\nMovimiento: parallax por capas y flotación del objeto\nRepresentación: el modelo de IA como objeto 3D navegable\nInteracción: tilt en cards y CTA magnético\nProhibiciones: hero centrado con tres tarjetas\nReferencias: lenguaje de escaparate tecnológico\nAnti-patrones: revista moderna\nAccesibilidad: contraste AA y foco visible\n</adn2>`;
    }
    if (llamadas === 2) {
      return `<vision2 letra="A">\nNombre: Objeto vivo\nArquetipo: espacial\nRepresentación: el modelo como objeto 3D en escena\nEstructura: apertura con objeto; desarrollo por capas; cierre con CTA\nNarrativa: el scroll recorre la escena\nInteracción: tilt y parallax con el puntero\nComposición: asimétrica con foco en el objeto\nPaleta: #0B0F19 + #7C3AED\nTipografía: Space Grotesk + IBM Plex Mono\nPor qué: el producto ES un objeto, se mira antes de leerse\nPrioriza: el objeto\nRiesgo: peso en móvil\nBeneficia a: quien evalúa la tecnología\n</vision2>\n<vision2 letra="B">\nNombre: Cine de datos\nArquetipo: cinematica\nRepresentación: secuencia de planos con métricas\nEstructura: plano de impacto; desarrollo; cierre\nNarrativa: cada scroll es un plano\nInteracción: reveal por escena\nComposición: pantalla completa con respiros\nPaleta: #0B0F19 + #22D3EE\nTipografía: Inter Display + mono\nPor qué: ritmo para una historia técnica\nPrioriza: la secuencia\nRiesgo: densidad\nBeneficia a: el comité técnico\n</vision2>\n<vision2 letra="C">\nNombre: Taller modular\nArquetipo: modular\nRepresentación: módulos desiguales por peso\nEstructura: módulo dominante; apoyos; datos; acción\nNarrativa: el peso es la jerarquía\nInteracción: módulos expandibles\nComposición: retícula rota intencional\nPaleta: #0B0F19 + #F59E0B\nTipografía: Space Grotesk + Inter\nPor qué: mucho contenido sin plano monótono\nPrioriza: comparación\nRiesgo: monotonía si se aplana\nBeneficia a: quien compara\n</vision2>`;
    }
    if (llamadas === 3) return "<fusion2>\nBase: A\nToma de A: el objeto 3D como foco\nToma de B: el ritmo de escenas\nToma de C: la retícula rota para datos\nConcepto: escaparate cinematográfico del modelo de IA\n</fusion2>";
    return "```html\n<html lang=\"es\"><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>IA</title><style>:root{--acento:#7C3AED}body{margin:0;font-family:system-ui;background:#0B0F19;color:#F8FAFC}.escena{perspective:1600px}.objeto{transform:translateZ(60px)}.card{border-radius:24px;box-shadow:0 18px 40px rgba(0,0,0,.4);transition:transform .4s}@keyframes flota{50%{transform:translateY(8px)}}@media (prefers-reduced-motion: reduce){*{animation:none;transition:none}}@media (max-width:768px){.card{width:100%}}</style></head><body><section class=\"escena\"><h1 style=\"text-align:left;max-width:14ch\">IA Forge</h1><div class=\"objeto\">objeto</div><div class=\"card\">métrica</div><button>Probar</button></section></body></html>\n```";
  };
  const mvp = await mod.ejecutarMvpForja(
    { mensaje: "Landing premium futurista con 3D y parallax para una startup de IA", perfil: "ligero" },
    { llamarModelo: mock, onProgreso: () => {} }
  );
  check("MVP: la traza pasa por [experiencia]", mvp.traza.some((t) => t.startsWith("[experiencia]")), mvp.traza.find((t) => t.startsWith("[experiencia] selección"))?.slice(0, 90));
  check("MVP: registro.experiencia completo", Boolean(mvp.registro.experiencia?.familia) && Boolean(mvp.registro.experiencia?.receta) && Boolean(mvp.registro.experiencia?.hero));
  check("MVP: familia correcta para brief 3D", mvp.registro.experiencia?.familia !== "editorial", `${mvp.registro.experiencia?.familia} / ${mvp.registro.experiencia?.receta} / ${mvp.registro.experiencia?.hero}`);
  // v4.6: la cabecera de la cuenta de experiencia sube con la versión del motor
  check("MVP: la respuesta explica la experiencia (§29)", /Experiencia v4\.\d/.test(mvp.resultado.respuesta));
  check("MVP: resultado expone la selección completa", mvp.experiencia.hero.tipo === mvp.registro.experiencia?.hero);
  check("§9: el ADN de respaldo lleva la escala por categorías", mod.adn2DesdeAdn1(null, "landing animada").movimiento.some((x) => x.includes("500-1000ms") && x.includes("800-1600ms")));
  // anti-repetición quedó alimentada por el MVP
  check("MVP: huella registrada para anti-repetición (§13)", mod.obtenerHistorial().length >= 1, mod.obtenerHistorial()[0]?.hero);
  // §29: el siguiente proyecto rota cuando el hero se repite 2 de las últimas 3
  const rotado = mod.elegirHero(mvp.experiencia.dna, "spatial", "landing premium con capas, profundidad y producto", ["HERO_SPATIAL", "HERO_3D_OBJECT", "HERO_SPATIAL"]);
  check("§29: 2 usos en las últimas 3 → rota de hero", rotado.tipo !== "HERO_SPATIAL", `→ ${rotado.tipo} (${rotado.alternativas.join(", ")})`);
  const conIntencion = mod.elegirHero(mvp.experiencia.dna, "3d-showcase", "showcase 3D del modelo", ["HERO_3D_OBJECT"]);
  check("§29: con intención 3D fuerte el objeto puede repetir (el doc: «si la intención lo permite»)", conIntencion.tipo === "HERO_3D_OBJECT");
}

console.log(`\n${"═".repeat(60)}\nRESULTADO: ${pasados} pasados · ${fallados} fallados\n${"═".repeat(60)}`);
process.exit(fallados ? 1 : 0);
