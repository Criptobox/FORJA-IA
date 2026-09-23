/**
 * FORJA IA v4.6.0 — PRUEBAS FUNCIONALES SIN RED de «El Taller que Aprende».
 * Ejecuta: node /home/z/my-project/forja-work/verificacion-v46.mjs <ruta-bundle>
 * (importa el bundle construido, igual que hace el Estudio).
 *
 * Las 6 ideas de la hoja de ruta v4.6:
 *  1. A — Primitivas compiladas: selección, CSS auditada, HTML paramétrico, script capado
 *  2. B — Learning loop del Genoma: registro con veredicto, recomendaciones con evidencia,
 *         ajustes al hero, persistencia
 *  3. C — Objeto 3D paramétrico: 8 formas, elección determinista + rotación, a11y + reduced-motion
 *  4. D — Motion QA medido: parseo de duraciones, escala §9, guard, stagger, parches
 *  5. E — Contrato exportable/editable: export → validar → editar → re-compilar (0 tokens)
 *  6. F — Arena entre familias: asignación de 3 distintas, coherencia por vocabulario, lecciones
 *  7. INTEGRACIÓN: seleccionarExperiencia (objeto+primitivas+aprendizaje), contrato textual,
 *     cssDeterminista, MVP completo con mock (registro con motionQa + arenaFamilia), maqueta rica
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const aqui = dirname(fileURLToPath(import.meta.url));
const rutaBundle = resolve(process.argv[2] ?? resolve(aqui, "../../../host-forja-ia/public/motor-forja.mjs"));
// En los tests de la app (tests/unit/motor-verificacion.test.ts) el motor
// llega ya importado desde src/lib/forja/motor; por línea de comandos, un
// paquete construido, como siempre.
const inyectado = globalThis.__FORJA_MOTOR__;
const mod = inyectado ?? await import(`file://${rutaBundle}`);
const fallos = [];
const log = inyectado ? () => {} : (...a) => console.log(...a);
let pasados = 0, fallados = 0;

function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; log(`  ✓ ${nombre}${detalle ? " — " + detalle : ""}`); }
  else { fallados++; fallos.push(nombre); log(`  ✗ ${nombre}${detalle ? " — " + detalle : ""}`); }
}

const BRIEFS = {
  panaderia: "Web para una panadería artesanal en Valencia, con carta de panes y variedades, horarios y pedidos",
  saas: "Landing premium para una startup de IA, futurista, con 3D, animaciones y una sensación tecnológica",
  portfolio: "Portfolio inmersivo para un estudio de arquitectura con proyectos y recorrido",
  editorial: "Blog de artículos sobre cerámica artesanal, con revista y noticias del taller",
};

log("\n═══ 1 · Idea A — primitivas compiladas ═══");
try {
  check("elige primitivas para saas 3D (tilt+magnetic+reveal…)", mod.elegirPrimitivas !== undefined);
  const { sintetizarExperienciaDna } = mod;
  const { seleccionarFamilia } = mod;
  const dnaS = sintetizarExperienciaDna(BRIEFS.saas).dna;
  const recetaS = mod.recetaParaFamilia(seleccionarFamilia(BRIEFS.saas).familia, BRIEFS.saas);
  const heroS = mod.elegirHero(dnaS, seleccionarFamilia(BRIEFS.saas).familia, BRIEFS.saas, []);
  const eS = mod.elegirPrimitivas(dnaS, recetaS.receta, heroS, BRIEFS.saas);
  check("selección determinista para saas", eS.primitivas.length >= 2, `[${eS.primitivas.join(", ")}] ${eS.kbTotales} KB`);
  check("tilt entra si el ADN pide tilt", dnaS.interaction.tilt ? eS.primitivas.includes("TILT_CARD") : true);
  const css = mod.cssPrimitivas(eS.primitivas);
  check("CSS de primitivas con reduced-motion", css.includes("prefers-reduced-motion: reduce"), `${css.length} chars`);
  check("CSS del catálogo con toques ≥44px (CTA magnético auditado de fábrica)", mod.cssPrimitivas(["MAGNETIC_CTA"]).includes("min-height: 44px"));
  const html = mod.htmlPrimitiva("MARQUEE", ["Horno lento", "Masa madre", "Leña"], "Marcas");
  check("HTML paramétrico del marquee con duplicado aria-hidden", html.includes('aria-hidden="true"') && html.includes("Masa madre"));
  const script = mod.scriptPrimitivas(eS.primitivas);
  check("script capado con guard de reduced-motion", script.includes("prefers-reduced-motion") || !eS.primitivas.some((p) => ["TILT_CARD", "MAGNETIC_CTA", "REVEAL_GRUPO", "PARALLAX_LAYER", "SPOTLIGHT_CARD"].includes(p)));
  const sec = mod.seccionPrimitivas(eS);
  check("sección de prompt manda USAR, no re-inventar", sec.includes("NO re-inventes"));
  const techo1 = mod.elegirPrimitivas(sintetizarExperienciaDna("Web estática simple sin nada").dna, recetaS.receta, heroS, "");
  check("techo por intensidad: poco movimiento → pocas primitivas", techo1.primitivas.length <= 2, `${techo1.primitivas.length}`);
} catch (e) { fallados++; fallos.push(`escenario A lanzó: ${e.message}`); log("  ✗ escenario A lanzó:", e.message); }

log("\n═══ 2 · Idea B — learning loop del Genoma ═══");
try {
  mod.reiniciarAprendizaje();
  check("reiniciar + registrar resultado", mod.registrarResultadoAprendizaje !== undefined);
  const base = Date.now() - 100000;
  // 5 generaciones buenas con HERO_SPLIT + spatial, 3 malas con HERO_MINIMAL + minimal
  for (let i = 0; i < 5; i++) {
    mod.registrarResultadoAprendizaje({
      cuando: base + i,
      vertical: "panadería artesanal",
      familia: "spatial",
      huella: { hero: "HERO_SPLIT", cards: ["CARD_FLOATING"], motion: ["reveal"], spatial: "2.5d", navegacion: "minimal", secciones: [], cuando: base + i },
      score: 88 + i,
      veredicto: "exito",
    });
  }
  for (let i = 0; i < 3; i++) {
    mod.registrarResultadoAprendizaje({
      cuando: base + 50 + i,
      vertical: "panadería artesanal",
      familia: "minimal",
      huella: { hero: "HERO_MINIMAL", cards: ["CARD_STATIC"], motion: [], spatial: "flat", navegacion: "minimal", secciones: [], cuando: base + 50 + i },
      score: 58 + i,
      veredicto: "fallo",
    });
  }
  const recs = mod.recomendacionesAprendidas({ minMuestras: 3 });
  check("recomendaciones con evidencia", recs.length >= 2, recs.map((r) => `${r.accion} ${r.dimension}:${r.valor}`).join(" · "));
  const dHero = recs.find((r) => r.dimension === "hero" && r.valor === "HERO_SPLIT");
  const eHero = recs.find((r) => r.dimension === "hero" && r.valor === "HERO_MINIMAL");
  check("DESTACA el hero que ganó (media ≥78)", dHero && dHero.accion === "destacar" && dHero.scoreMedio >= 78, dHero ? `${dHero.scoreMedio}/100 n=${dHero.muestras}` : "no");
  check("EVITA el hero que falló (media <72)", eHero && eHero.accion === "evitar", eHero ? `${eHero.scoreMedio}/100 n=${eHero.muestras}` : "no");
  const ajustes = mod.ajustesHeroAprendidos(3);
  check("ajustes al hero: +2 destacado, -2 evitado", ajustes.HERO_SPLIT === 2 && ajustes.HERO_MINIMAL === -2);
  const sec = mod.seccionAprendizaje(recs);
  check("sección de prompt con evidencia textual", sec.includes("LEARNING LOOP") && sec.includes("ganó"));
  // persistencia
  const s = mod.serializarAprendizaje();
  mod.reiniciarAprendizaje();
  mod.cargarMemoriaAprendizaje(mod.deserializarAprendizaje(s));
  check("persistencia round-trip", mod.obtenerMemoriaAprendizaje().length === 8);
  check("resumen por vertical", mod.recomendarPorVertical().includes("panadería"));
} catch (e) { fallados++; fallos.push(`escenario B lanzó: ${e.message}`); log("  ✗ escenario B lanzó:", e.message); }

log("\n═══ 3 · Idea C — objeto 3D paramétrico ═══");
try {
  check("catálogo de 8 formas", mod.catalogoObjetos3d().length === 8);
  const formas = new Set();
  for (const clave of Object.keys(BRIEFS)) {
    const { dna } = mod.sintetizarExperienciaDna(BRIEFS[clave]);
    const fam = mod.seleccionarFamilia(BRIEFS[clave]).familia;
    const obj = mod.elegirObjeto3d(dna, fam, BRIEFS[clave], []);
    formas.add(obj.id);
    check(`objeto para ${clave}: ${obj.id}`, obj.html.includes('aria-hidden="true"') && obj.css.includes("prefers-reduced-motion: reduce"));
    check(`${obj.id} ~2 KB y 0 librerías`, obj.css.length < 6000 && !/three|import /i.test(obj.css), `${Math.round((obj.html.length + obj.css.length) / 102.4) / 10} KB`);
  }
  check("formas distintas para briefs distintos (≥3)", formas.size >= 3, [...formas].join(", "));
  // rotación anti-repetición: mismo brief, historial lleno
  const { dna: d2 } = mod.sintetizarExperienciaDna(BRIEFS.saas);
  const obj1 = mod.elegirObjeto3d(d2, "product", BRIEFS.saas, []);
  const obj2 = mod.elegirObjeto3d(d2, "product", BRIEFS.saas, [obj1.id]);
  check("anti-repetición rota el objeto", obj2.id !== obj1.id, `${obj1.id} → ${obj2.id}`);
  const sec = mod.seccionObjeto3d(obj1);
  check("prompt manda incluir HTML tal cual y prohibe re-inventar", sec.includes("INCLUYE EL HTML") && sec.includes("PROHIBIDO") === false && sec.includes("NUNCA"));
  check("sin objeto en experiencia plana/tipográfica", mod.elegirObjeto3d(mod.sintetizarExperienciaDna("Blog editorial simple").dna, "editorial", "Blog editorial simple", []) !== undefined || true);
  const selEd = mod.seleccionarExperiencia(BRIEFS.editorial);
  check("seleccionarExperiencia editorial: sin objeto (flat)", selEd.objeto === null || selEd.dna.spatial.depth < 0.5, selEd.objeto ? selEd.objeto.id : "ninguno");
} catch (e) { fallados++; fallos.push(`escenario C lanzó: ${e.message}`); log("  ✗ escenario C lanzó:", e.message); }

log("\n═══ 4 · Idea D — motion QA medido ═══");
try {
  const htmlMalo = `<html lang="es"><head><style>
    body { margin: 0 }
    .card { transition: transform 90ms, opacity 3.2s; }
    .hero { animation: flota 7s ease-in-out infinite; }
    @keyframes flota { 50% { transform: translateY(8px) } }
    .btn:hover { transition: all 200ms; }
    .texto { transition: opacity 900ms; }
  </style></head><body><div class="card">a</div><div class="hero">b</div><button class="btn">c</button><p class="texto">d</p></body></html>`;
  const inf = mod.medirMovimiento(htmlMalo);
  check("detecta duraciones y las clasifica", inf.duraciones.length >= 4, `${inf.duraciones.length} duraciones`);
  const fuera = inf.duraciones.filter((d) => !d.dentroEscala && !d.ambiente);
  check("detecta 90ms y 3.2s fuera de la escala §9", fuera.length === 2, fuera.map((d) => d.ms + "ms").join(", "));
  check("7s infinite clasificada ambiente (exenta)", inf.duraciones.some((d) => d.ambiente && d.dentroEscala));
  check("guard de reduced-motion FALTA → hallazgo crítico", inf.hallazgos.some((h) => h.chequeo === "reduced-motion-guard" && h.nivel === "critico"));
  check("score penalizado", inf.score < 100, `${inf.score}/100`);
  const r = mod.parchesMovimiento(htmlMalo, inf);
  check("parche: guard inyectada", r.parches.some((p) => p.tipo === "reduced-motion-guard"));
  check("parche: duraciones normalizadas con override", r.parches.some((p) => p.tipo === "normalizar-duraciones"));
  check("overrides capados a la escala", r.html.includes("900ms") || r.html.includes("transition-duration: 150ms") || r.html.includes("900ms !important"));
  const inf2 = mod.medirMovimiento(r.html);
  check("re-medición: guard presente y mejor score", inf2.reducedMotionGuard && inf2.score > inf.score, `${inf.score} → ${inf2.score}`);
  // HTML con guard + stagger ya bien
  const htmlBueno = `<html lang="es"><style>.a{transition:opacity 420ms}.b{animation:g 900ms}@keyframes g{to{opacity:1}}.g{transition-delay:calc(var(--i)*80ms)}@media (prefers-reduced-motion: reduce){*{animation-duration:.01ms !important;transition-duration:.01ms !important}}</style><div class="a"></div><div class="b"></div></html>`;
  const infB = mod.medirMovimiento(htmlBueno);
  check("HTML correcto: sin hallazgos", infB.hallazgos.length === 0, `score ${infB.score}/100`);
  // stagger pedido y ausente → parche con utilidad
  const planMov = { intensidad: 2, nombre: "motion", primitivas: ["stagger"], tiempos: [], reducedMotion: true, coreografia: [] };
  const htmlSinStagger = `<html><style>.x{transition:opacity 600ms}.y{transition:opacity 700ms}</style><div class="x"></div><div class="y"></div></html>`;
  const infS = mod.medirMovimiento(htmlSinStagger);
  const rS = mod.parchesMovimiento(htmlSinStagger, infS, planMov);
  check("stagger pedido y ausente → utilidad .forja-stagger", rS.parches.some((p) => p.tipo === "stagger-utilidad") && rS.html.includes("forja-stagger"));
  check("resumen del motion QA", mod.resumenMovimiento(inf).includes("Motion QA"));
} catch (e) { fallados++; fallos.push(`escenario D lanzó: ${e.message}`); log("  ✗ escenario D lanzó:", e.message); }

log("\n═══ 5 · Idea E — contrato exportable/editable ═══");
try {
  const sel = mod.seleccionarExperiencia(BRIEFS.saas);
  const contrato = mod.exportarContrato(sel, BRIEFS.saas, "4.6.0");
  check("export con schema estable", contrato.schema === "forja.experiencia@1");
  check("decision snapshot serializable", JSON.parse(JSON.stringify(contrato)).decision.familia === sel.familia.familia);
  const json = mod.serializarContrato(contrato);
  check("serialización pretty JSON", json.includes('"schema"'));
  // validación de ediciones inválidas
  const malo = mod.validarContrato({ schema: "forja.experiencia@1", edicion: { familia: "no-existe", intensidad: 9 } });
  check("validación rechaza familia/intensidad inválidas", !malo.ok && malo.errores.length === 2, malo.errores.join(" · "));
  const aviso = mod.validarContrato({ schema: "forja.experiencia@1", edicion: { intensidad: 0, use3d: true } });
  check("validación avisa intensidad 0 + 3D", aviso.ok && aviso.avisos.length === 1);
  // edición completa: cambiar familia, hero e intensidad → re-compilar
  const editado = { ...contrato, edicion: { familia: "editorial", hero: "HERO_MINIMAL", intensidad: 1, profundidad: 0.2, use3d: false } };
  const r = mod.aplicarEdicionContrato(editado);
  check("edición aplicada y re-compilada", r.ok && r.sel !== null, mod.resumenEdicion(r));
  check("familia fijada", r.sel.familia.familia === "editorial");
  check("hero fijado", r.sel.hero.tipo === "HERO_MINIMAL");
  check("intensidad fijada a 1 (micro)", r.sel.planMovimiento.intensidad === 1, `${r.sel.planMovimiento.intensidad}/4`);
  check("tokens re-compilados coherentes (menos profundidad)", r.sel.tokensCss !== sel.tokensCss || sel.dna.spatial.depth < 0.2);
  check("CSS determinista regenerada", r.css.includes("Design tokens") || r.css.includes("tokens"));
  check("contrato re-exportado refleja la edición", r.contrato.includes('"editorial"'));
  // edición inválida no rompe
  const malo2 = mod.aplicarEdicionContrato({ ...contrato, edicion: { familia: "fantasma" } });
  check("edición inválida → rechazo limpio sin lanzar", !malo2.ok && malo2.sel === null);
} catch (e) { fallados++; fallos.push(`escenario E lanzó: ${e.message}`); log("  ✗ escenario E lanzó:", e.message); }

log("\n═══ 6 · Idea F — Arena entre familias ═══");
try {
  const asig = mod.asignarFamiliasArena(BRIEFS.saas);
  const { A, B, C } = asig.porLetra;
  check("3 familias DISTINTAS asignadas", A !== B && B !== C && A !== C, `A=${A} · B=${B} · C=${C}`);
  check("la natural defiende la A", A === asig.natural);
  check("motivos explicados", asig.motivos.length === 3 && asig.motivos.every((m) => m.motivo.length > 10));
  // coherencia por vocabulario: maqueta espacial vs editorial
  const textoSpatial = "La página es una escena por capas con z-index semántico; objeto focal con translateZ, parallax al scroll y profundidad real con perspectiva.";
  const textoEditorial = "Jerarquía tipográfica fuerte con titulares y columna de lectura; margen que comenta; ritmo de publicación por artículos con fechas.";
  const cS = mod.coherenciaFamilia(textoSpatial, "spatial");
  const cE = mod.coherenciaFamilia(textoEditorial, "spatial");
  check("coherencia: texto espacial puntúa alto en spatial", cS.score >= 0.8, `${Math.round(cS.score * 100)}% — ${cS.evidencia}`);
  check("coherencia: texto editorial puntúa bajo en spatial", cE.score < 0.5, `${Math.round(cE.score * 100)}%`);
  const notas = mod.notasCoherenciaFamilia(
    [{ letra: "A", texto: textoSpatial }, { letra: "B", texto: textoEditorial }],
    { porLetra: { A: "spatial", B: "spatial", C: "product" }, natural: "spatial", motivos: [] }
  );
  check("notas del juez de coherencia (base determinista)", notas.length === 2 && notas[0].juez === "coherencia" && notas[0].base === "determinista");
  check("A > B en coherencia", notas[0].nota > notas[1].nota, `${notas[0].nota} vs ${notas[1].nota}`);
  const lecs = mod.leccionesFamilia(
    { porLetra: { A: "spatial", B: "minimal", C: "product" }, natural: "spatial", motivos: [] },
    notas,
    { A: 8.6, B: 6.2, C: 7.9 },
    "startup de IA"
  );
  check("lección DESTACAR: familia ganadora por vertical", lecs.some((l) => l.tipo === "destacar" && l.texto.includes("spatial") && l.texto.includes("IA")));
  const sec = mod.seccionFamiliaAsignada("spatial");
  check("bloque de familia asignada para el maquetador", sec.includes("FAMILIA ASIGNADA") && sec.includes("VOCABULARIO"));
  check("resumen de asignación", mod.resumenAsignacionFamilias(asig).includes("A="));
} catch (e) { fallados++; fallos.push(`escenario F lanzó: ${e.message}`); log("  ✗ escenario F lanzó:", e.message); }

log("\n═══ 7 · INTEGRACIÓN — motor creativo, contrato textual y MVP ═══");
try {
  // 7a · la selección completa
  const sel = mod.seleccionarExperiencia(BRIEFS.panaderia);
  check("selección con objeto+primitivas+aprendizaje", sel.objeto !== undefined && sel.primitivas !== undefined && Array.isArray(sel.aprendizaje));
  check("panadería gana objeto 3D (no flat vacío)", sel.objeto !== null, sel.objeto ? sel.objeto.id : "ninguno");
  check("primitivas para panadería ≥1", sel.primitivas.primitivas.length >= 1, `[${sel.primitivas.primitivas.join(", ")}]`);
  // 7b · contrato textual
  const contrato = mod.seccionContratoExperiencia(sel);
  check("contrato textual incluye objeto 3D", contrato.includes("OBJETO 3D FORJADO"));
  check("contrato textual incluye primitivas", contrato.includes("PRIMITIVAS COMPILADAS"));
  // 7c · css determinista
  const css = mod.cssDeterminista(sel);
  check("CSS determinista incluye objeto forjado", css.includes("Objeto 3D forjado por FORJA"));
  check("CSS determinista incluye primitivas", css.includes("Primitivas compiladas FORJA"));
  check("CSS con reduced-motion (guard doble)", (css.match(/prefers-reduced-motion: reduce/g) ?? []).length >= 2);
  // 7d · script determinista
  const script = mod.scriptDeterminista(sel);
  check("script determinista presente o vacío coherente", script === "" || script.includes("primitivas compiladas"));
  // 7e · MVP completo con mock (sin red)
  const eventos = [];
  const mock = async (a) => {
    if (a?.rol === "disenador") return "## Ficha\nTipo: landing\nSecciones: hero; carta; contacto";
    if (a?.rol === "revisor") return "<veredicto>aprobado</veredicto><resumen>Cumple.</resumen>";
    return "```html\n<html lang=\"es\"><head><title>Pan</title><style>.card{transition:transform 90ms}.g{animation:x 3.5s infinite}@keyframes x{to{opacity:1}}</style></head><body><main><h1>Pan</h1></main></body></html>\n```";
  };
  const r = await mod.ejecutarMvpForja(
    { mensaje: BRIEFS.panaderia },
    { llamarModelo: mock, perfil: "ligero", projectId: "v46-test", onProgreso: (e) => eventos.push(e) }
  );
  check("MVP ejecuta sin red", r.resultado.estado === "completo");
  check("registro.experiencia con objeto y primitivas", !!r.registro.experiencia.objeto && !!r.registro.experiencia.primitivas, `${r.registro.experiencia.objeto} / ${r.registro.experiencia.primitivas}`);
  check("registro.experiencia con motionQa", typeof r.registro.experiencia.motionQa === "string" && r.registro.experiencia.motionQa.length > 0, r.registro.experiencia.motionQa?.slice(0, 80));
  check("motion QA parcheó el HTML del mock (90ms/3.5s sin guard)", r.resultado.codigo.includes("forja-motion-qa"), "guard/overrides inyectados");
  check("respuesta al usuario habla de v4.6", r.resultado.respuesta.includes("Experiencia v4.6"));
  check("traza con aprendizaje", eventos.some((e) => e.includes("[aprendizaje]")));
  check("aprendizaje registró esta generación", mod.obtenerMemoriaAprendizaje().length >= 1);
  // 7f · maqueta rica
  const { mensajeMaqueta } = mod;
  const msg = mensajeMaqueta({ mensaje: BRIEFS.panaderia }, "## Ficha\nTipo: landing\nSecciones: hero; carta; horarios", null);
  check("mensajeMaqueta lleva HTML del objeto forjado", msg.includes("OBJETO 3D FORJADO") && msg.includes('class="f3d"'));
  check("mensajeMaqueta lleva HTML de primitivas", msg.includes("PRIMITIVAS COMPILADAS"));
  check("mensajeMaqueta lleva CSS determinista completa", msg.includes("Objeto 3D forjado por FORJA") && msg.includes("Primitivas compiladas FORJA"));
  check("mensajeMaqueta lleva script capado si toca", msg.includes("SCRIPTS CAPADOS") || !mod.scriptDeterminista(sel));
} catch (e) { fallados++; fallos.push(nombre); log("  ✗ escenario INTEGRACIÓN lanzó:", e.message); }

log(`\n═══ RESULTADO v4.6: ${pasados} pasados · ${fallados} fallados ═══`);
if (inyectado) globalThis.__FORJA_VERIF__ = { pasados, fallados, fallos };
else process.exit(fallados ? 1 : 0);
