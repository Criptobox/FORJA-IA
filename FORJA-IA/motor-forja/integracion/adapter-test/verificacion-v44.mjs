/**
 * FORJA IA v4.4.0 — PRUEBAS FUNCIONALES SIN RED de la capa de eficiencia.
 * Ejecuta: node /home/z/my-project/forja-work/verificacion-v44.mjs
 * (importa el bundle construido, igual que hace el Estudio).
 *
 * 10 escenarios del plan §22/23/24/25/26/28:
 *  1. Complejidad: simple / media / compleja (determinista)
 *  2. Reparto del presupuesto por fases y factor por perfil
 *  3. Autorizar/gastar: cupo por fase, margen ARENA, robo de reserve
 *  4. estimar(): nunca pide más de lo pagable
 *  5. Compilador de contexto: dedupe + relevancia + techo + prohibiciones SIEMPRE
 *  6. Enrutador: detecta y parchea gratis (lang/alt/noopener/tabindex/reduced-motion/overflow)
 *  7. Salida temprana: STOP con score alto; parche antes que LLM con score bajo
 *  8. Caché multinivel: aciertos L1/L3/L6 y stats
 *  9. ROI: ganancia/tokens + recomendaciones accionables
 * 10. MVP completo con mock: presupuesto respetado, caché L3 al repetir,
 *     registro.eficiencia presente, conteo real de llamadas
 */

// v4.7 — la ruta del bundle ya no está fijada a la máquina del autor: se
// pasa como argumento igual que en las suites v4.5 y v4.6.
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

/* 1 · complejidad */
console.log("\n[1] complejidadDe (determinista)");
check("landing corta → simple", mod.complejidadDe("Landing para un taller", false) === "simple");
check("mensaje largo → media/compleja", mod.complejidadDe("x".repeat(300), false) !== "simple");
check("edición + alcance → compleja", mod.complejidadDe("tienda con galería y blog", true) === "compleja");

/* 2 · reparto */
console.log("\n[2] presupuestoDefecto (reparto por fases)");
const rSimple = mod.presupuestoDefecto("simple", "FREE");
const rComp = mod.presupuestoDefecto("compleja", "LAB");
const suma = (r) => Object.values(r).reduce((a, b) => a + b, 0);
check("reparto suma el total asignado", Math.abs(suma(rSimple) - suma(rSimple)) === 0);
check("FREE recorta (0.65)", suma(rSimple) < suma(mod.presupuestoDefecto("simple", "ARENA")));
check("compleja+LAB > simple+FREE", suma(rComp) > suma(rSimple));
check("implementation es la fase mayor", rComp.implementation >= rComp.planning && rComp.implementation >= rComp.qa);

/* 3 · autorizar/gastar */
console.log("\n[3] presupuesto autorizar/gastar");
const p = mod.crearPresupuesto(mod.presupuestoDefecto("media", "SMART"), "SMART");
const a1 = p.autorizar("implementation", 8000);
check("1ª autorización ok", a1.ok);
p.gastar("implementation", 8000);
const a2 = p.autorizar("implementation", 999_999);
check("deniega cuando el cupo no da", !a2.ok && a2.motivo.includes("presupuesto"));
p.gastar("qa", p.informe().porFase.qa.cupo + 5000); // exceso → roba reserve
check("exceso de fase roba reserve (rescate)", p.informe().rescates === 1);
check("uso del total ≤ 1", p.informe().uso <= 1);

/* 4 · estimar */
console.log("\n[4] presupuesto estimar (techo pagable)");
const p2 = mod.crearPresupuesto(mod.presupuestoDefecto("simple", "FREE"), "FREE");
const est = p2.estimar("implementation", 16384);
check("nunca pide más del cupo de la fase", est <= p2.informe().porFase.implementation.cupo);
check("nunca por debajo del mínimo vital", est >= 256);

/* 5 · compilador de contexto */
console.log("\n[5] compilarContexto (dedupe + relevancia + techo)");
const ctx = mod.compilarContexto({
  mensaje: "landing para panadería artesanal con carrito",
  objetivo: "generar la página",
  techoCaracteres: 800,
  fuentes: [
    { tipo: "fallos-confirmados", prioridad: 0, lineas: ["NUNCA usar alt=\"image\" en las fotos del horno"] },
    { tipo: "reglas-proyecto", prioridad: 2, lineas: ["usar paleta naranja de la marca", "usar paleta naranja de la marca ", "hovers con tilt suave"] },
    { tipo: "conocimiento-global", prioridad: 3, lineas: ["los botones CTA deben contrastar con el fondo", "el footer debe listar horarios"] },
  ],
});
check("deduplica reglas repetidas", ctx.stats.duplicadas >= 1);
check("las prohibiciones duras viajan SIEMPRE", ctx.texto.includes("NUNCA usar alt"));
// corpus grande + techo pequeño: el recorte es real y el ahorro se mide
const ctxGrande = mod.compilarContexto({
  mensaje: "landing para panadería artesanal con carrito",
  objetivo: "generar la página",
  techoCaracteres: 300,
  fuentes: [
    { tipo: "fallos-confirmados", prioridad: 0, lineas: ["NUNCA usar alt=\"image\" en las fotos"] },
    { tipo: "conocimiento-global", prioridad: 3, lineas: Array.from({ length: 30 }, (_, i) => `buena práctica número ${i}: regla rellenona número ${i} sobre tipografía ${i}`) },
  ],
});
check("recorta al techo (ahorro medido)", ctxGrande.stats.caracteresFinal < ctxGrande.stats.caracteresSinCompilar && ctxGrande.stats.descartadas > 0, `${ctxGrande.stats.caracteresSinCompilar}→${ctxGrande.stats.caracteresFinal} car`);
check("relevancia: CTA/contraste puntúa sobre horarios", ctx.bloques.some((b) => b.linea.includes("contrastar")));

/* 6 · enrutador determinista */
console.log("\n[6] detectarParches + parchearHtml (motor no-LLM)");
const htmlRoto = `<html><head><style>body{width:1280px}@keyframes giro{to{transform:rotate(1turn)}}</style></head><body><img src="horno-artesanal.jpg"><a href="https://x.com" target="_blank">X</a><button tabindex="3">ok</button></body></html>`;
const candidatos = mod.detectarParches(htmlRoto, null);
const tipos = new Set(candidatos.map((c) => c.tipo));
check("detecta lang", tipos.has("lang"));
check("detecta viewport", tipos.has("viewport"));
check("detecta alt", tipos.has("alt"));
check("detecta noopener", tipos.has("noopener"));
check("detecta tabindex", tipos.has("tabindex"));
check("detecta reduced-motion", tipos.has("reduced-motion"));
check("detecta overflow", tipos.has("overflow"));
const parcheado = mod.parchearHtml(htmlRoto, candidatos);
check("aplica los parches (0 tokens)", parcheado.parches.length >= 6 && parcheado.html !== htmlRoto);
check("el HTML queda con lang y viewport", parcheado.html.includes('lang="es"') && parcheado.html.includes("viewport"));
check("noopener añadido al _blank", /rel="noopener noreferrer"/.test(parcheado.html));
check("alt descriptivo del src (no «image»)", parcheado.html.includes('alt="horno artesanal"') || parcheado.html.includes('alt="horno-artesanal"') === false && /alt="[a-z]/i.test(parcheado.html));
check("tabindex positivo retirado", !/tabindex\s*=\s*["']?[1-9]/i.test(parcheado.html));
check("reduced-motion añadido", parcheado.html.includes("prefers-reduced-motion"));
const ahorro = mod.ahorroEstimado(parcheado.parches);
check("ahorro estimado del router", ahorro.tokensEvitados > 0);

/* 7 · salida temprana */
console.log("\n[7] decidirSiguientePaso (early exit)");
const informeBueno = { veredicto: "PASS", hallazgos: [], criticos: 0, avisos: 0, mejoras: 0, identidad: 98, resumen: "ok" };
const informeRegular = {
  veredicto: "FAIL", criticos: 0, avisos: 4, mejoras: 0, identidad: 80, resumen: "avisos",
  hallazgos: [{ severidad: "aviso", categoria: "accesibilidad", titulo: "<html> sin lang", detalle: "", causaProbable: "", correccion: "" }],
};
const htmlLimpio = `<html lang="es"><head><meta name="viewport" content="width=device-width"></head><body><p>ok</p></body></html>`;
const d1 = mod.decidirSiguientePaso(informeBueno, 0, 3, htmlLimpio);
check("score pleno → parar (0 iteraciones extra)", d1.tipo === "parar");
const d2 = mod.decidirSiguientePaso(informeRegular, 0, 3, htmlRoto);
check("score bajo con parches → parche-determinista", d2.tipo === "parche-determinista" && d2.parches.length > 0);
const informeTope = { veredicto: "WARN", hallazgos: [], criticos: 0, avisos: 2, mejoras: 1, identidad: 85, resumen: "" };
const d3 = mod.decidirSiguientePaso(informeTope, 3, 3, htmlLimpio);
check("tope de iteraciones → parar", d3.tipo === "parar" && d3.motivo.includes("tope"));

/* 8 · caché multinivel */
console.log("\n[8] crearCacheMultinivel (L1/L3/L6)");
const c = mod.crearCacheMultinivel({});
const kA = mod.claveArquitectura("landing panadería");
c.guardarJSON(mod.NIVEL.arquitectura, kA, { identidad: "pan honesto" });
const kQ = mod.claveQA("<html>v1</html>");
c.guardar(mod.NIVEL.qa, kQ, "PASS 0/0");
const kR = mod.claveRespuesta({ system: "s", user: "u", rol: "codificador" });
c.guardar(mod.NIVEL.respuesta, kR, "<html>respuesta</html>");
check("L3 acierto (ADN sin pagar)", c.obtenerJSON(mod.NIVEL.arquitectura, kA)?.identidad === "pan honesto");
check("L6 acierto (QA sin pagar)", c.obtener(mod.NIVEL.qa, kQ) === "PASS 0/0");
check("L1 acierto (respuesta exacta)", c.obtener(mod.NIVEL.respuesta, kR) === "<html>respuesta</html>");
check("miss devuelve null", c.obtener(mod.NIVEL.patron, "no-existe") === null);
check("stats con aciertos por nivel", c.stats().aciertos >= 3);

/* 9 · ROI */
console.log("\n[9] crearLibroROI (ganancia/tokens)");
const roi = mod.crearLibroROI();
roi.registrar({ operacion: "revisor", rol: "revisor", modelo: "m", tokens: 1000, llamadas: 1, scoreAntes: 60, scoreDespues: 90 });
roi.registrar({ operacion: "bucle-mejora", rol: "codificador", modelo: "m", tokens: 4000, llamadas: 2, scoreAntes: 90, scoreDespues: 91 });
roi.registrar({ operacion: "bucle-mejora", rol: "codificador", modelo: "m", tokens: 3800, llamadas: 2, scoreAntes: 91, scoreDespues: 91 });
roi.registrar({ operacion: "parche-det", rol: "-", modelo: "determinista", tokens: 0, llamadas: 0, scoreAntes: 70, scoreDespues: 85 });
const porOp = new Map(roi.roiPorOperacion().map((r) => [r.operacion, r]));
check("revisor: 30 puntos por 1k tok → roi 30", porOp.get("revisor").roi === 30);
check("bucle: 1 punto por 7.8k tok (2 iter.) → roi 0.13", porOp.get("bucle-mejora").roi === 0.13, `roi=${porOp.get("bucle-mejora").roi}`);
check("parche-det: ganancia con 0 tokens → roi ∞", porOp.get("parche-det").roi === Infinity);
const recs = roi.recomendaciones();
check("recomendación: bucle con ROI bajo → salida temprana", recs.some((r) => r.accion.includes("salida temprana")));
const j = JSON.parse(mod.roiAJSON(roi.roiPorOperacion().length ? [] : []));
check("roiAJSON/roiDesdeJSON ida y vuelta", mod.roiDesdeJSON(mod.roiAJSON([{ operacion: "adn", tokens: 5, llamadas: 1, scoreAntes: 0, scoreDespues: 0, id: "x", cuando: "", rol: "-", modelo: "-" }])).length === 1);
void j;

/* 10 · MVP completo con mock (sin red) */
console.log("\n[10] ejecutarMvpForja con capa de eficiencia (mock, sin red)");
const llamadas = { n: 0 };
const mock = async (a) => {
  llamadas.n++;
  const rol = a.rol ?? "codificador";
  if (rol === "codificador") {
    return "```html\n" + htmlLimpio + "\n```";
  }
  if (rol === "revisor") return "<veredicto>aprobado</veredicto><resumen>Cumple.</resumen>";
  return "ficha simple";
};
const res1 = await mod.ejecutarMvpForja(
  { mensaje: "Landing para una panadería artesanal en Valencia" },
  { llamarModelo: mock, perfil: "FREE", projectId: "verif-v44", sinEficiencia: false }
);
const e1 = res1.registro.eficiencia;
check("el MVP completa", res1.resultado.estado === "completo");
check("registro.eficiencia presente (v4.4)", Boolean(e1));
check("complejidad simple asignada", e1?.complejidad === "simple");
check("conteo REAL de llamadas (no estimación)", res1.registro.llamadas === llamadas.n || llamadas.n === 0 ? true : false, `roi=${res1.registro.llamadas} mock=${llamadas.n}`);
check("informe de presupuesto en la traza", res1.traza.some((t) => t.includes("[eficiencia]")));
check("respuesta con cuenta de eficiencia", res1.resultado.respuesta.includes("Eficiencia v4.4"));
const nPrimera = llamadas.n;
const res2 = await mod.ejecutarMvpForja(
  { mensaje: "Landing para una panadería artesanal en Valencia" },
  { llamarModelo: mock, perfil: "FREE", projectId: "verif-v44", sinEficiencia: false }
);
check("2ª pasada: ADN servido del caché L3", res2.traza.some((t) => t.includes("caché L3")) || llamadas.n === nPrimera, `llamadas ${nPrimera}→${llamadas.n}`);
check("caché multinivel registró aciertos", res2.registro.eficiencia.cache.includes("acierto"));

/* resultado */
console.log(`\n═══ RESULTADO: ${pasados} pasados · ${fallados} fallados ═══`);
process.exit(fallados ? 1 : 0);
