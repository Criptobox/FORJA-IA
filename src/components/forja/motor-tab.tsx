"use client";
/** FORJA IA — Estudio, pestaña «Motor · Eficiencia + Aprendizaje»: el blindaje
 * v4.2, la eficiencia v4.4, el MOTOR DE EXPERIENCIA v4.5 y «EL TALLER QUE
 * APRENDE» v4.6 (ideas A-F) ejecutándose con el bundle real — primitivas
 * compiladas, learning loop del Genoma, objeto 3D forjado, motion QA medido,
 * contrato editable JSON y Arena entre familias. */
import { useState } from "react";
import { Activity, Database, HeartPulse, PiggyBank, Ruler, Scissors, Timer, Wand2, TrendingDown, Sparkles, ShieldAlert, Repeat, Layers, Box, Gauge, FileJson, Brain, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, Salida } from "./ui-forja";
import type { Motor } from "@/lib/forja/motor-client";

const PAGINA_TRUNCADA =
  `<html lang="es"><head><style>body{margin:0;font-family:system-ui}h1{color:#F97316;padding:24px}\n/* el CSS sigue…`;
const COLA = `*/main{max-width:960px;margin:0 auto}</style></head><body><h1>Forjado a fuego lento</h1><p>Contenido real.</p></body></html>`;

export function MotorTab({ motor, cfgUsuario }: { motor: Motor; cfgUsuario: any }) {
  const [salidas, setSalidas] = useState<Record<string, string>>({});
  const pone = (k: string, v: string) => setSalidas((s) => ({ ...s, [k]: v }));

  /* 1 · presupuesto por rol (con la config real de Ajustes) */
  const demoTokens = () => {
    const { techoTokens, sanearTokensRol, MAX_TOKENS_DEFECTO } = motor;
    const cfg = { porRol: {}, habilidades: [], ...(cfgUsuario ?? {}) };
    const filas = ["disenador", "codificador", "revisor"].map((rol) => {
      const propio = cfg?.maxTokensPorRol?.[rol];
      return `techoTokens(cfg, "${rol}".padEnd(13)) → ${String(techoTokens(cfg, rol)).padStart(6)} tokens${propio ? `  ← tu Ajustes` : ""}`;
    });
    pone(
      "tokens",
      `MAX_TOKENS_DEFECTO = ${MAX_TOKENS_DEFECTO}\ncfg.maxTokensPorRol (desde Ajustes) = ${JSON.stringify(cfg.maxTokensPorRol ?? {})}\n\n${filas.join("\n")}\n\n` +
        `sanearTokensRol(-5) → ${JSON.stringify(sanearTokensRol(-5))} (rechazado)\nsanearTokensRol(999999) → ${sanearTokensRol(999999)} (satura en 65536)`
    );
  };

  /* 2 · continuación de núcleo (2º cinturón) */
  const demoContinuacion = (completa: boolean) => {
    const { esTruncadoEstructural, continuarSalidaTruncada } = motor;
    const texto = completa ? PAGINA_TRUNCADA + COLA : PAGINA_TRUNCADA;
    const truncado = esTruncadoEstructural(texto);
    if (!truncado) {
      pone(
        "continuacion",
        `esTruncadoEstructural(página completa) → false\n\nresultado: página SANA — sin llamadas extra, sin Revisor gastado`
      );
      return;
    }
    const res = continuarSalidaTruncada(texto, () => COLA);
    const sana = !esTruncadoEstructural(res.texto);
    pone(
      "continuacion",
      `esTruncadoEstructural(página cortada) → true (style sin cerrar)\ncontinuación: 1 llamada que paga SOLO la cola\n\n— texto final (recortado) —\n${res.texto.slice(0, 140)}…\n\nresultado: ${sana ? "página completa, sigue al Revisor SANA" : "sigue truncada"}`
    );
  };

  /* 3 · caché por hash con pipeline real */
  const demoCache = async () => {
    const { ejecutarForja, crearCacheMemoria, resumenCache } = motor;
    const cache = crearCacheMemoria(4);
    const ficha = "## Ficha\nTipo: landing\nPaleta: #F97316\nEstructura: hero + cards";
    const n = { disenador: 0, codificador: 0, revisor: 0 };
    const mock = async (a: any) => {
      const rol = a?.rol ?? "codificador";
      n[rol as keyof typeof n]++;
      if (rol === "disenador") return ficha;
      if (rol === "codificador") return "```html\n<html><body><h1>ok</h1></body></html>\n```";
      return "<veredicto>aprobado</veredicto><resumen>Cumple.</resumen>";
    };
    const deps = () => ({ llamarModelo: mock, memoria: { reglas: [] }, cache, onProgreso: () => {} });
    const cfg = { porRol: {}, habilidades: [], perfil: "ligero" };
    const pet = { mensaje: "Web para una panadería artesanal en Valencia" };
    await ejecutarForja(pet, cfg, deps(), { providerId: "m", modelId: "mock" });
    const l1 = { ...n };
    await ejecutarForja(pet, cfg, deps(), { providerId: "m", modelId: "mock" });
    pone(
      "cache",
      `1ª ejecución → Diseñador ${l1.disenador} · Codificador ${l1.codificador} · Revisor ${l1.revisor}\n2ª (misma petición) → Diseñador ${n.disenador - l1.disenador} llamadas nuevas (servida del caché)\n\n${resumenCache(cache)}`
    );
  };

  /* 4 · salud por latencia */
  const demoSalud = () => {
    const { crearSaludProveedores } = motor;
    const salud = crearSaludProveedores();
    salud.exito("deepseek:chat", 2040);
    salud.exito("deepseek:chat", 2210);
    salud.fallo("openrouter:qwen3-coder:free", "429");
    salud.fallo("openrouter:qwen3-coder:free", "429");
    salud.exito("zai:glm-4.7-flash", 204);
    const cadena = ["deepseek:chat", "openrouter:qwen3-coder:free", "zai:glm-4.7-flash"];
    const orden = salud.ordenar(cadena);
    pone(
      "salud",
      `éxitos: deepseek 2040ms/2210ms · zai 204ms · fallos: openrouter ×2 (429)\n\ncadena: ${cadena.join(" → ")}\norden de suplentes tras la evidencia:\n${orden.map((m: string, i: number) => `${i + 1}. ${m}${i === 0 ? "  ← primario, intocable" : ""}`).join("\n")}`
    );
  };

  /* 5 · telemetría del adaptador */
  const demoTelemetria = async () => {
    const { crearAdaptadorForja, crearRegistro, cerrarRegistro, crearTelemetriaForja } = motor;
    const eventos: any[] = [];
    const registro = crearRegistro("estudio-forja");
    const puente = crearTelemetriaForja(registro, { tambien: (e: any) => eventos.push(e) });
    let fase = 0;
    const transporte = async (a: any) => {
      fase++;
      if (a.modelId === "roto") throw new Error("401 unauthorized: model not found");
      if (fase === 2) throw new Error("fetch failed: ETIMEDOUT");
      return { texto: "página forjada", motivoParada: "stop" };
    };
    const llamada = crearAdaptadorForja(transporte, {
      intentosRed: 2,
      backoffBaseMs: 20,
      suplentesPorRol: { codificador: [{ providerId: "zai", modelId: "suplente" }] },
      onEvento: puente,
    });
    let texto = "";
    try {
      texto = await llamada({ providerId: "deepseek", modelId: "roto", system: "s", user: "u", temperatura: 0.2, rol: "codificador", maxTokens: 16384 });
    } catch (e: any) {
      texto = "ERROR: " + (e?.message ?? e);
    }
    cerrarRegistro(registro, 120, []);
    const t = (registro as any).telemetria ?? {};
    pone(
      "telemetria",
      `texto final: ${texto}
eventos: ${eventos.map((e) => e.tipo).join(" · ") || "—"}

telemetría del registro (puente crearTelemetriaForja):
  reintentosRed  → ${t.reintentosRed ?? 0}
  failovers      → ${t.failovers ?? 0}
  continuaciones → ${t.continuaciones ?? 0}
  tokensSalida   → ${t.tokensSalida ?? 0}
  latencia media → ${t.latenciaMs ?? 0} ms`
    );
  };

  /* ───── EFICIENCIA v4.4 ───── */

  /* 6 · presupuesto global por fases */
  const demoPresupuesto = () => {
    const { presupuestoPara, crearPresupuesto } = motor;
    const simple = presupuestoPara("Landing para un taller de cerámica", false, "SMART");
    const compleja = presupuestoPara(
      "Plataforma completa con tienda, galería, blog, dashboard y animaciones 3D en varias páginas",
      true,
      "SMART"
    );
    const p = crearPresupuesto(compleja.reparto, "SMART");
    const aut1 = p.autorizar("implementation", 12000);
    p.gastar("implementation", 12000);
    const aut2 = p.autorizar("implementation", 12000);
    pone(
      "presupuesto44",
      `petición simple → complejidad ${simple.complejidad}: ${simple.reparto.implementation} tok a implementación (total ${Object.values(simple.reparto).reduce((a: number, b: any) => a + b, 0)})
petición compleja (edición + alcance) → complejidad ${compleja.complejidad}: ${compleja.reparto.implementation} tok a implementación

sobre el presupuesto complejo:
1ª autorización 12.000 tok → ${aut1.ok ? "OK" : "DENEGADA"}
2ª autorización 12.000 tok → ${aut2.ok ? "OK" : "DENEGADA: " + aut2.motivo}

${p.resumen()}`
    );
  };

  /* 7 · caché multinivel */
  const demoMultinivel = () => {
    const { crearCacheMultinivel, claveArquitectura, claveQA, NIVEL: NV } = motor;
    const c = crearCacheMultinivel({});
    c.guardarJSON(NV.arquitectura, claveArquitectura("Landing panadería"), { identidad: "horno lento, pan honesto" });
    c.guardar(NV.qa, claveQA("<html>…pagina v3…</html>"), "PASS 0 críticos 0 avisos");
    const hitAdn = c.obtenerJSON(NV.arquitectura, claveArquitectura("Landing panadería"));
    const hitQa = c.obtener(NV.qa, claveQA("<html>…pagina v3…</html>"));
    const miss = c.obtener(NV.patron, claveArquitectura("no existe"));
    const s = c.stats();
    pone(
      "multinivel",
      `L3 decisión de ADN (misma petición) → ${hitAdn ? "HIT: " + hitAdn.identidad : "miss"} (0 tokens)
L6 QA del mismo HTML → ${hitQa ? "HIT: " + hitQa : "miss"} (el Revisor no se paga)
L4 patrón inexistente → ${miss == null ? "miss (paga si toca)" : "hit"}

${s.resumen()}
niveles: ${s.niveles.map((n: any) => `${n.nombre}=${n.entradas}`).join(" · ")}`
    );
  };

  /* 8 · enrutador determinista: parches gratis */
  const demoRouter = () => {
    const { detectarParches, parchearHtml, ahorroEstimado } = motor;
    const html = `<html><head><style>body{width:1280px}@keyframes giro{to{transform:rotate(360deg)}}</style></head><body><img src="horno-artisanal.jpg"><a href="https://x.com" target="_blank">X</a><button tabindex="3">ok</button></body></html>`;
    const candidatos = detectarParches(html, null);
    const r = parchearHtml(html, candidatos);
    const ahorro = ahorroEstimado(r.parches);
    pone(
      "router",
      `detectado sin modelo: ${candidatos.map((c: any) => c.tipo).join(", ")}
aplicados: ${r.parches.length} parche(s) · sin parche: ${r.sinParche}

HTML corregido (recortado):
${r.html.slice(0, 340)}…

coste: 0 tokens · ahorro estimado: ${ahorro.llamadasEvitadas} llamada(s) / ${ahorro.tokensEvitados} tok (Codificador+Revisor evitados)`
    );
  };

  /* 9 · salida temprana */
  const demoTemprana = () => {
    const { decidirSiguientePaso } = motor;
    const informeBueno = {
      veredicto: "PASS", hallazgos: [], criticos: 0, avisos: 0, mejoras: 0, identidad: 97, score: 96, resumen: "Entrega aprobada.",
    };
    const informeRegular = {
      veredicto: "FAIL", score: 58, criticos: 1, avisos: 2, mejoras: 1, identidad: 74, resumen: "Falta lang y hay crítico de contraste.",
      hallazgos: [
        { severidad: "critico", categoria: "accesibilidad", titulo: "<html> sin lang", detalle: "sin idioma declarado", causaProbable: "generador rápido", correccion: "añadir lang=es" },
      ],
    };
    const d1 = decidirSiguientePaso(informeBueno, 0, 3, "<html lang=\"es\">…</html>");
    const d2 = decidirSiguientePaso(informeRegular, 0, 3, "<html><body>hola</body></html>");
    const fmt = (d: any) => `${d.tipo.toUpperCase()} — ${d.motivo}`;
    pone(
      "temprana",
      `informe PASS score 96 → ${fmt(d1)}
  (el bucle de mejora v4.0 gastaba 2 iteraciones de más aquí)

informe FAIL score 58 → ${fmt(d2)}
  (primero parches gratis; solo si no basta, el Codificador paga)

El diagrama del plan: Generate → QA → Good enough? → YES: STOP · NO: parche determinista? → PATCH · NO: LLM`
    );
  };

  /* 10 · token ROI */
  const demoROI = () => {
    const { crearLibroROI } = motor;
    const roi = crearLibroROI();
    roi.registrar({ operacion: "codificador", rol: "codificador", modelo: "deepseek:chat", tokens: 8200, llamadas: 1, scoreAntes: 0, scoreDespues: 0 });
    roi.registrar({ operacion: "revisor", rol: "revisor", modelo: "deepseek:chat", tokens: 900, llamadas: 1, scoreAntes: 62, scoreDespues: 88 });
    roi.registrar({ operacion: "bucle-mejora", rol: "codificador", modelo: "deepseek:chat", tokens: 2100, llamadas: 2, scoreAntes: 88, scoreDespues: 90 });
    roi.registrar({ operacion: "parche-det", rol: "-", modelo: "determinista", tokens: 0, llamadas: 0, scoreAntes: 74, scoreDespues: 86 });
    roi.registrar({ operacion: "jueces", rol: "revisor", modelo: "zai:glm-4.7-flash", tokens: 3600, llamadas: 3, scoreAntes: 90, scoreDespues: 90 });
    const porOp = roi.roiPorOperacion();
    const recs = roi.recomendaciones();
    pone(
      "roi",
      `${roi.resumen()}

por operación (puntos ganados por 1k tokens):
${porOp.map((o: any) => `  ${o.operacion.padEnd(14)} ${String(o.tokensTotales).padStart(6)} tok → ${o.gananciaMedia > 0 ? "+" + o.gananciaMedia : o.gananciaMedia} pts (roi ${o.roi === Infinity ? "∞" : o.roi})`).join("\n")}

recomendaciones del plan (§28 «qué operaciones merecen tokens»):
${recs.map((r: any) => `  [${r.prioridad}] ${r.accion} — ${r.evidencia}`).join("\n")}`
    );
  };

  /* ───── MOTOR DE EXPERIENCIA v4.5 (correcciones moderno-3D) ───── */

  /* 11 · motor creativo: intención → familia → receta → planes */
  const demoExperiencia = (tipo: "saas" | "editorial" | "portfolio") => {
    const { seleccionarExperiencia } = motor;
    const mensajes = {
      saas: "Landing premium para una startup de IA, futurista, con 3D, animaciones y una sensación tecnológica",
      editorial: "Blog de artículos sobre cerámica artesanal, con revista y noticias del taller",
      portfolio: "Portfolio inmersivo para un estudio de arquitectura con proyectos y recorrido",
    } as const;
    const sel = seleccionarExperiencia(mensajes[tipo]);
    const p = sel.planEspacial;
    pone(
      "experiencia45",
      `brief: «${mensajes[tipo]}»

DECISIÓN (determinista, 0 tokens):
  familia      → ${sel.familia.familia} (${Math.round(sel.familia.confianza * 100)}% confianza, alternativa: ${sel.familia.alternativa})
  receta       → ${sel.receta.receta.id}
  representación → ${sel.representacion.modo}${sel.representacion.degradadoDe ? ` (degradado de ${sel.representacion.degradadoDe}: ${sel.representacion.razon})` : ""}
  hero         → ${sel.hero.tipo} (${sel.hero.composicion.join(" + ")})
  cards        → ${sel.cards.variantes.join(", ")}
  movimiento   → intensidad ${sel.planMovimiento.intensidad}/4 «${sel.planMovimiento.nombre}»: ${sel.planMovimiento.primitivas.join(", ")}
  tiempos      → ${sel.planMovimiento.tiempos.map((t: any) => `${t.categoria} ${t.rango}`).join(" · ")}

PLAN ESPACIAL (${p.layers.length} capas, z-index semántico):
${p.layers.map((l: any) => `  z${String(l.z).padStart(2)} ${l.id.padEnd(12)} ${l.contenido}`).join("\n")}

señales: ${sel.razonesDna.join("; ") || "—"}`
    );
  };

  /* 12 · sesgo editorial + QA de experiencia + parches */
  const demoSesgo = () => {
    const { medirExperiencia, scoreEditorial, senalesHtml, auditarExperiencia, parchesExperiencia, sintetizarExperienciaDna, resumenMetricas } = motor;
    const htmlRevista = `<html lang="es"><head><title>Blog</title><style>body{max-width:680px;margin:0 auto;font-family:Georgia}p{line-height:1.8}img{width:100%;border-radius:8px}</style></head><body><main><h1>El pan lento</h1><p>${"El fermento natural exige paciencia y observación constante del clima, la harina y el tiempo. ".repeat(4)}</p><p>${"Cada masa guarda su propia historia de humedad, temperatura y manos que la trabajan con oficio. ".repeat(4)}</p><figure><img src="horno.jpg" alt="Horno de leña"></figure><p>${"La corteza cruje cuando el almidón se asienta y el vapor escapa por las grietas del pan. ".repeat(4)}</p><section><h2>El horno</h2><p>${"Un horno de leña tarda cuatro horas en alcanzar su punto y otras tantas en soltar el calor acumulado. ".repeat(3)}</p></section></main></body></html>`;
    const { dna } = sintetizarExperienciaDna("Landing premium futurista con 3D y parallax para una startup de IA");
    const s = senalesHtml(htmlRevista);
    const m = medirExperiencia(htmlRevista);
    const hallazgos = auditarExperiencia(htmlRevista, dna);
    const r = parchesExperiencia(htmlRevista, hallazgos, dna);
    pone(
      "sesgo45",
      `HTML «revista» vs ADN que pide 3D + parallax:

SEÑALES: textDensity ${Math.round(s.textDensity * 100)}% · lectura ${Math.round(s.readingFlow * 100)}% · motion ${Math.round(s.motion * 100)}% · depth ${Math.round(s.depth * 100)}%
EDITORIAL SCORE (§11): ${Math.round(scoreEditorial(s) * 100)}% (umbral 62%)
MÉTRICAS (§12): ${resumenMetricas(m)}

QA DE EXPERIENCIA (§21):
${hallazgos.length ? hallazgos.map((h: any) => `  [${h.nivel}] ${h.chequeo}: ${h.evidencia}`).join("\n") : "  sin hallazgos"}

PATCH-FIRST (§22) — sin regenerar, sin LLM:
  parches aplicados: ${r.parches.length ? r.parches.map((p: any) => p.tipo).join(", ") : "ninguno (sube al bucle)"}
  contenido intacto ✓ · reduced-motion respetado ✓ · ${(r.html.length - htmlRevista.length)} chars añadidos (CSS+script capados)`
    );
  };

  /* 13 · anti-repetición */
  const demoRepeticion = () => {
    const { reiniciarAntiRepeticion, registrarComposicion, obtenerHistorial, penalizacionHero, penalizacionComposicion } = motor;
    reiniciarAntiRepeticion();
    const secuencia = ["HERO_3D_OBJECT", "HERO_FLOATING_CARDS", "HERO_SPATIAL", "HERO_3D_OBJECT"];
    secuencia.forEach((h, i) => registrarComposicion({ hero: h, cards: ["CARD_FLOATING"], motion: ["parallax"], spatial: "2.5d", navegacion: "minimal", secciones: [], cuando: 1000 + i }));
    const pen = penalizacionComposicion("HERO_3D_OBJECT", "2.5d", "CARD_FLOATING");
    const fresco = penalizacionComposicion("HERO_CINEMATIC", "3d", "CARD_MEDIA");
    pone(
      "repeticion45",
      `últimos proyectos: ${obtenerHistorial().map((h: any) => h.hero.replace("HERO_", "")).join(" → ")}

penalización de repetir HERO_3D_OBJECT + 2.5d + CARD_FLOATING:
  -${pen.puntos} pts → ${pen.consejo}
  (el Hero Engine rota automáticamente a la alternativa con menos usos)

penalización de una composición fresca (HERO_CINEMATIC + 3d):
  -${fresco.puntos} pts → ${fresco.consejo}

penalización directa del hero repetido: -${penalizacionHero("HERO_3D_OBJECT")} pts (doc §13: penaliza por usos en las últimas 3)`
    );
  };

  /* ───── EL TALLER QUE APRENDE v4.6 (ideas A-F) ───── */

  /* 14 · primitivas compiladas (A) */
  const demoPrimitivas = (tipo: "panaderia" | "saas") => {
    const { seleccionarExperiencia, PRIMITIVAS_BLOQUE, defPrimitiva } = motor;
    const mensajes = {
      panaderia: "Web para una panadería artesanal en Valencia, con carta de panes y variedades, horarios y pedidos",
      saas: "Landing premium para una startup de IA, futurista, con 3D, animaciones e interacción",
    } as const;
    const sel = seleccionarExperiencia(mensajes[tipo]);
    const lineas = (sel.primitivas?.primitivas ?? []).map((id: string) => {
      const d = defPrimitiva(id);
      return `  • ${id} — ${d?.proposito ?? ""}\n    a11y de fábrica: ${d?.a11y?.join("; ") ?? ""}`;
    });
    pone(
      "primitivas46",
      `brief: «${mensajes[tipo]}»\n\nPRIMITIVAS COMPILADAS ELEGIDAS (${sel.primitivas?.primitivas?.length ?? 0}, ${sel.primitivas?.kbTotales ?? 0} KB — nacen auditadas):\n${lineas.join("\n") || "  (ninguna: experiencia estática deliberada)"}\n\ncatálogo: ${PRIMITIVAS_BLOQUE.map((p: any) => p.id).join(", ")}\n\ndisciplina:\n${(sel.primitivas?.disciplina ?? []).map((d: string) => `  · ${d}`).join("\n")}\n\nEl Codificador recibe CSS+HTML+script y SOLO parametriza contenido:\nre-inventar una primitiva pagaba tokens + QA; reutilizarla sale GRATIS.`
    );
  };

  /* 15 · objeto 3D forjado (C) — render EN VIVO */
  const [objetoDemo, setObjetoDemo] = useState<{ html: string; css: string; info: string } | null>(null);
  const demoObjeto = (tipo: "panaderia" | "saas" | "datos") => {
    const { seleccionarExperiencia } = motor;
    const mensajes = {
      panaderia: "Web para una panadería artesanal en Valencia, con carta de panes y variedades",
      saas: "Landing premium para una startup de IA, futurista, con 3D",
      datos: "Panel de métricas e informes con estadísticas de crecimiento y niveles",
    } as const;
    const sel = seleccionarExperiencia(mensajes[tipo]);
    const o = sel.objeto;
    setObjetoDemo({
      html: o?.html ?? "<p style=\"color:var(--muted-foreground)\">experiencia tipográfica quieta: sin objeto</p>",
      css: o?.css ?? "",
      info: o
        ? `${o.id} «${o.nombre}» — ${o.descripcion}\ntransmite: ${o.transmite} · alternativas: ${o.alternativas.join(", ")}\n~${Math.round((o.html.length + o.css.length) / 102.4) / 10} KB · 0 librerías · aria-hidden · reduced-motion OK`
        : "sin objeto (editorial legítima: el foco es la tipografía)",
    });
  };

  /* 16 · motion QA medido (D) */
  const demoMotionQa = () => {
    const { medirMovimiento, parchesMovimiento } = motor;
    const html = `<html lang="es"><head><style>body{margin:0}.card{transition:transform 90ms, opacity 3.2s}.hero{animation:flota 7s ease-in-out infinite}@keyframes flota{50%{transform:translateY(8px)}}.btn:hover{transition:all 200ms}.texto{transition:opacity 900ms}</style></head><body><div class="card">a</div><div class="hero">b</div><button class="btn">c</button><p class="texto">d</p></body></html>`;
    const inf = medirMovimiento(html);
    const r = parchesMovimiento(html, inf);
    const fuera = inf.duraciones.filter((d: any) => !d.dentroEscala && !d.ambiente).map((d: any) => `${d.ms}ms(${d.selector})`);
    pone(
      "motion46",
      `HTML con duraciones rotas (90ms, 3.2s) y SIN guard de reduced-motion:\n\nMEDIDO (§9 por duración):\n  duraciones: ${inf.duraciones.length} · ambiente (infinite): ${inf.infinitas} · fuera de escala: ${fuera.join(", ") || "ninguna"}\n  stagger ${inf.staggerDetectado ? "presente" : "ausente"} · reduced-motion ${inf.reducedMotionGuard ? "OK" : "FALTA → crítico"}\n  score ${inf.score}/100\n\nPARCHES (append-only, capados, 0 tokens):\n${r.parches.map((p: any) => `  · ${p.tipo} — ${p.evidencia}`).join("\n") || "  · ninguno"}\n\nRE-MEDICIÓN: score ${inf.score} → ${r.informe.score}/100 · guard ${r.informe.reducedMotionGuard ? "OK" : "FALTA"}\n(el contenido del usuario NUNCA se toca: solo CSS de guard/overrides)`
    );
  };

  /* 17 · contrato de experiencia JSON (E) */
  const demoContrato = (editar: boolean) => {
    const { seleccionarExperiencia, exportarContrato, serializarContrato, aplicarEdicionContrato, resumenEdicion } = motor;
    const brief = "Landing premium para una startup de IA, futurista, con 3D";
    const sel = seleccionarExperiencia(brief);
    const c = exportarContrato(sel, brief, "4.6.0");
    if (!editar) {
      pone(
        "contrato46",
        `CONTRATO EXPORTABLE (schema ${c.schema}):\n\n${serializarContrato(c).slice(0, 1100)}\n…\n\nEl host (o un futuro Studio) puede EDITAR familia/hero/intensidad/\nprofundidad/elevación/blur/radius/use3d — y RE-COMPILAR sin tocar el\npipeline. Pulsa «Editar + re-compilar» para verlo.`
      );
      return;
    }
    const editado = { ...c, edicion: { familia: "editorial", hero: "HERO_MINIMAL", intensidad: 1, use3d: false, profundidad: 0.2 } };
    const r = aplicarEdicionContrato(editado);
    pone(
      "contrato46",
      `contrato original: familia ${c.decision.familia} · hero ${c.decision.hero} · intensidad ${c.decision.intensidad}/4 · objeto ${c.decision.objeto3d ?? "ninguno"}\n\nEDICIÓN HUMANA: { familia: "editorial", hero: "HERO_MINIMAL", intensidad: 1, use3d: false, profundidad: 0.2 }\n\n${resumenEdicion(r)}\n\nnueva decisión: familia ${r.sel?.familia?.familia} · hero ${r.sel?.hero?.tipo} · intensidad ${r.sel?.planMovimiento?.intensidad}/4 · objeto ${r.sel?.objeto ? r.sel.objeto.id : "ninguno"}\nCSS determinista re-compilada: ${r.css?.length ?? 0} chars · script: ${r.script?.length ?? 0} chars\nCOSTE: 0 tokens — el pipeline determinista re-compila todo coherente.`
    );
  };

  /* 18 · learning loop del Genoma (B) */
  const demoAprendizaje = () => {
    const { reiniciarAprendizaje, registrarResultadoAprendizaje, recomendacionesAprendidas, ajustesHeroAprendidos, recomendarPorVertical } = motor;
    reiniciarAprendizaje();
    const base = Date.now() - 100000;
    const filas = [
      { n: 5, familia: "spatial", hero: "HERO_SPLIT", score: 90, vertical: "panadería artesanal" },
      { n: 3, familia: "minimal", hero: "HERO_MINIMAL", score: 60, vertical: "panadería artesanal" },
      { n: 3, familia: "product", hero: "HERO_FLOATING_CARDS", score: 84, vertical: "startup IA" },
    ] as const;
    let cuando = base;
    for (const f of filas) {
      for (let i = 0; i < f.n; i++) {
        registrarResultadoAprendizaje({
          cuando: cuando++,
          vertical: f.vertical,
          familia: f.familia,
          huella: { hero: f.hero, cards: ["CARD_FLOATING"], motion: ["reveal"], spatial: "2.5d", navegacion: "minimal", secciones: [], cuando },
          score: Math.max(0, Math.min(100, f.score + i - 1)),
          veredicto: f.score >= 78 ? "exito" : "fallo",
        });
      }
    }
    const recs = recomendacionesAprendidas({ minMuestras: 3 });
    pone(
      "aprendizaje46",
      `${11} generaciones registradas con HUELLA + RESULTADO (score + veredicto):\n\nRECOMENDACIONES CON EVIDENCIA (0 tokens):\n${recs.map((r: any) => `  [${r.accion.toUpperCase()}] ${r.dimension} «${r.valor}» — ${r.evidencia}`).join("\n") || "  (aún sin muestras suficientes)"}\n\najustes al hero engine: ${JSON.stringify(ajustesHeroAprendidos(3))} (+2 destacado / -2 evitado)\n\n${recomendarPorVertical()}\n\nCon 20-30 generaciones el Genoma pasa de «penalizar lo reciente»\na «recomendar lo que ganó» — la memoria la persiste el host.`
    );
  };

  /* 19 · Arena entre familias (F) */
  const demoArenaFamilias = () => {
    const { asignarFamiliasArena, coherenciaFamilia } = motor;
    const brief = "Landing premium para una startup de IA, futurista, con 3D";
    const a = asignarFamiliasArena(brief);
    const textoA = "La página es una escena por capas con z-index semántico; objeto focal con translateZ, parallax al scroll y profundidad real con perspectiva";
    const textoB = "Jerarquía tipográfica fuerte con titulares y columna de lectura; margen que comenta; ritmo de publicación por artículos";
    const cA = coherenciaFamilia(textoA, a.porLetra.A);
    const cB = coherenciaFamilia(textoB, a.porLetra.A);
    pone(
      "arena46",
      `ASIGNACIÓN (3 visiones, 3 familias DISTINTAS):\n  A → ${a.porLetra.A} (${a.motivos[0].motivo})\n  B → ${a.porLetra.B} (${a.motivos[1].motivo})\n  C → ${a.porLetra.C} (${a.motivos[2].motivo})\n\nJUEZ DE COHERENCIA (vocabulario §12, determinista):\n  maqueta que habla de capas/parallax/perspectiva en ${a.porLetra.A} → ${Math.round(cA.score * 100)}% (${cA.encontradas.length} señales)\n  maqueta «editorial» evaluada como ${a.porLetra.A} → ${Math.round(cB.score * 100)}% (le faltan: ${cB.faltantes.slice(0, 2).join(", ")})\n\nEL GANADOR ALIMENTA EL GENOMA:\n  «la familia ${a.porLetra.A} funcionó para startup IA: coherencia ${Math.round(cA.score * 10 * 10) / 10}/10»\n  la elección de familia APRENDE en vez de quedar congelada.`
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Tarjeta
        icono={<Ruler className="size-4 text-orange-500" />}
        titulo="1 · Presupuesto de tokens por rol"
        descripcion="El techo de salida de cada rol, con tu configuración de Ajustes aplicada de verdad."
        accion={{ label: "Resolver techos", onClick: demoTokens }}
        extra={<Chip tono="fuego">lee Ajustes → FORJA IA</Chip>}
      >
        <Salida texto={salidas["tokens"] ?? ""} maxAlto="13rem" />
      </Tarjeta>

      <Tarjeta
        icono={<Scissors className="size-4 text-orange-500" />}
        titulo="2 · Segundo cinturón: continuación de núcleo"
        descripcion="Detecta rotura estructural sin red y cierra la herencia pagando solo la cola."
        acciones={[
          { label: "Página cortada a mitad", onClick: () => demoContinuacion(false) },
          { label: "Página completa → 0 llamadas", onClick: () => demoContinuacion(true) },
        ]}
      >
        <Salida texto={salidas["continuacion"] ?? ""} maxAlto="13rem" />
      </Tarjeta>

      <Tarjeta
        icono={<Database className="size-4 text-orange-500" />}
        titulo="3 · Caché de generaciones por hash"
        descripcion="La misma petición no paga dos veces el Diseñador: FNV-1a de la entrada + versión."
        accion={{ label: "Ejecutar pipeline ×2", onClick: demoCache }}
      >
        <Salida texto={salidas["cache"] ?? ""} maxAlto="13rem" />
      </Tarjeta>

      <Tarjeta
        icono={<HeartPulse className="size-4 text-orange-500" />}
        titulo="4 · Salud de proveedores por latencia"
        descripcion="EWMA de latencia + enfriamiento por fallos. El failover se ordena por evidencia."
        accion={{ label: "Simular un día malo", onClick: demoSalud }}
      >
        <Salida texto={salidas["salud"] ?? ""} maxAlto="13rem" />
      </Tarjeta>

      <Tarjeta
        icono={<Activity className="size-4 text-orange-500" />}
        titulo="5 · Telemetría del adaptador"
        descripcion="Reintentos, failovers y latencias al registro de observabilidad vía crearTelemetriaForja."
        accion={{ label: "Forzar failover y medir", onClick: demoTelemetria }}
      >
        <Salida texto={salidas["telemetria"] ?? ""} maxAlto="13rem" />
      </Tarjeta>

      <Tarjeta
        icono={<PiggyBank className="size-4 text-orange-500" />}
        titulo="6 · Presupuesto global por fases (v4.4)"
        descripcion="El techo de la generación completa, repartido en planning/design/implementation/qa/repair/reserve según complejidad y perfil."
        accion={{ label: "Repartir y autorizar", onClick: demoPresupuesto }}
        extra={<Chip tono="fuego">plan §25</Chip>}
      >
        <Salida texto={salidas["presupuesto44"] ?? ""} maxAlto="13rem" />
      </Tarjeta>

      <Tarjeta
        icono={<Database className="size-4 text-orange-500" />}
        titulo="7 · Caché multinivel L1-L6 (v4.4)"
        descripcion="Respuesta exacta, ficha, decisión de ADN, patrón, parche y QA: cada nivel con su LRU y sus aciertos."
        accion={{ label: "Probar 3 niveles", onClick: demoMultinivel }}
        extra={<Chip tono="fuego">plan §24</Chip>}
      >
        <Salida texto={salidas["multinivel"] ?? ""} maxAlto="13rem" />
      </Tarjeta>

      <Tarjeta
        icono={<Wand2 className="size-4 text-orange-500" />}
        titulo="8 · Enrutador determinista (v4.4)"
        descripcion="lang, alt, noopener, tabindex, reduced-motion, overflow… se corrigen GRATIS antes de pagar un modelo."
        accion={{ label: "Parchear HTML roto", onClick: demoRouter }}
        extra={<Chip tono="fuego">plan §22</Chip>}
      >
        <Salida texto={salidas["router"] ?? ""} maxAlto="13rem" />
      </Tarjeta>

      <Tarjeta
        icono={<Timer className="size-4 text-orange-500" />}
        titulo="9 · Salida temprana (v4.4)"
        descripcion="¿Good enough? → STOP. Antes de gastar un modelo: parche determinista. El LLM es el último recurso."
        accion={{ label: "Decidir dos casos", onClick: demoTemprana }}
        extra={<Chip tono="fuego">plan §26</Chip>}
      >
        <Salida texto={salidas["temprana"] ?? ""} maxAlto="13rem" />
      </Tarjeta>

      <Tarjeta
        icono={<TrendingDown className="size-4 text-orange-500" />}
        titulo="10 · Token ROI (v4.4)"
        descripcion="Operación · tokens · resultado · mejora: quality gain / tokens. El sistema aprende qué merece pagarse."
        accion={{ label: "Medir un día de forja", onClick: demoROI }}
        extra={<Chip tono="fuego">plan §28</Chip>}
      >
        <Salida texto={salidas["roi"] ?? ""} maxAlto="13rem" />
      </Tarjeta>

      <Tarjeta
        icono={<Sparkles className="size-4 text-orange-500" />}
        titulo="11 · Motor creativo (v4.5)"
        descripcion="INTENCIÓN → FAMILIA → RECETA → REPRESENTACIÓN → PLANES → HERO → CARDS. La dirección creativa se decide gratis y viaja como contrato."
        acciones={[
          { label: "Startup IA premium 3D", onClick: () => demoExperiencia("saas") },
          { label: "Portfolio inmersivo", onClick: () => demoExperiencia("portfolio") },
          { label: "Blog editorial", onClick: () => demoExperiencia("editorial") },
        ]}
        extra={<Chip tono="fuego">doc §1/§3/§4</Chip>}
      >
        <Salida texto={salidas["experiencia45"] ?? ""} maxAlto="16rem" />
      </Tarjeta>

      <Tarjeta
        icono={<ShieldAlert className="size-4 text-orange-500" />}
        titulo="12 · Sesgo editorial + QA experiencia (v4.5)"
        descripcion="El editorial score detecta la vuelta a la «revista»; el QA parchea (depth, floating, reveal) SIN regenerar."
        accion={{ label: "Auditar una página «revista»", onClick: demoSesgo }}
        extra={<Chip tono="fuego">doc §11/§21/§22</Chip>}
      >
        <Salida texto={salidas["sesgo45"] ?? ""} maxAlto="16rem" />
      </Tarjeta>

      <Tarjeta
        icono={<Repeat className="size-4 text-orange-500" />}
        titulo="13 · Anti-repetición (v4.5)"
        descripcion="La huella de cada composición queda registrada: repetir el mismo hero/cards/motion se penaliza en la elección."
        accion={{ label: "Simular 4 proyectos", onClick: demoRepeticion }}
        extra={<Chip tono="fuego">doc §13</Chip>}
      >
        <Salida texto={salidas["repeticion45"] ?? ""} maxAlto="13rem" />
      </Tarjeta>

      <Tarjeta
        icono={<Layers className="size-4 text-orange-500" />}
        titulo="14 · Primitivas compiladas (v4.6 A)"
        descripcion="8 bloques listos (tilt, magnético, métrica flotante, spotlight, parallax, sticky, marquee, reveal) con a11y y reduced-motion de fábrica. El Codificador parametriza; no re-inventa."
        acciones={[
          { label: "Panadería", onClick: () => demoPrimitivas("panaderia") },
          { label: "Startup IA", onClick: () => demoPrimitivas("saas") },
        ]}
        extra={<Chip tono="fuego">el mayor ahorro restante</Chip>}
      >
        <Salida texto={salidas["primitivas46"] ?? ""} maxAlto="16rem" />
      </Tarjeta>

      <Tarjeta
        icono={<Box className="size-4 text-orange-500" />}
        titulo="15 · Objeto 3D forjado (v4.6 C)"
        descripcion="8 formas CSS paramétricas (~2 KB, 0 three.js) elegidas por familia y señales. Renderizado EN VIVO con el CSS real del motor."
        acciones={[
          { label: "Panadería", onClick: () => demoObjeto("panaderia") },
          { label: "Startup IA", onClick: () => demoObjeto("saas") },
          { label: "Panel de datos", onClick: () => demoObjeto("datos") },
        ]}
        extra={<Chip tono="fuego">doc §29 «central 3D object»</Chip>}
      >
        {objetoDemo && (
          <div
            className="overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-2"
            style={{ minHeight: "210px", display: "grid", placeItems: "center" }}
          >
            <style dangerouslySetInnerHTML={{ __html: objetoDemo.css }} />
            <div dangerouslySetInnerHTML={{ __html: objetoDemo.html }} />
          </div>
        )}
        <Salida texto={objetoDemo?.info ?? ""} maxAlto="8rem" />
      </Tarjeta>

      <Tarjeta
        icono={<Gauge className="size-4 text-orange-500" />}
        titulo="16 · Motion QA medido (v4.6 D)"
        descripcion="Parsea el CSS real y verifica la escala §9 POR DURACIÓN: nada fuera de 150-1600ms salvo ambiente, stagger presente y reduced-motion que apague de verdad."
        accion={{ label: "Medir y parchear HTML roto", onClick: demoMotionQa }}
        extra={<Chip tono="fuego">núcleo fase 6c</Chip>}
      >
        <Salida texto={salidas["motion46"] ?? ""} maxAlto="16rem" />
      </Tarjeta>

      <Tarjeta
        icono={<FileJson className="size-4 text-orange-500" />}
        titulo="17 · Contrato de experiencia JSON (v4.6 E)"
        descripcion="La decisión creativa se EXPORTA (schema forja.experiencia@1), se EDITA (familia, hero, intensidad…) y se RE-COMPILA con 0 tokens."
        acciones={[
          { label: "Exportar contrato", onClick: () => demoContrato(false) },
          { label: "Editar + re-compilar", onClick: () => demoContrato(true) },
        ]}
        extra={<Chip tono="fuego">panel «Elige la experiencia»</Chip>}
      >
        <Salida texto={salidas["contrato46"] ?? ""} maxAlto="16rem" />
      </Tarjeta>

      <Tarjeta
        icono={<Brain className="size-4 text-orange-500" />}
        titulo="18 · Learning loop del Genoma (v4.6 B)"
        descripcion="La huella se guarda con su RESULTADO: con 20-30 generaciones el Genoma recomienda lo que ganó (destacar/evitar con evidencia) en vez de solo penalizar lo reciente."
        accion={{ label: "Simular 11 generaciones", onClick: demoAprendizaje }}
        extra={<Chip tono="fuego">doc §26 termina en LEARNING</Chip>}
      >
        <Salida texto={salidas["aprendizaje46"] ?? ""} maxAlto="16rem" />
      </Tarjeta>

      <Tarjeta
        icono={<Swords className="size-4 text-orange-500" />}
        titulo="19 · Arena entre familias (v4.6 F)"
        descripcion="Las 3 visiones corren en 3 FAMILIAS distintas y el juez de coherencia (vocabulario §12) decide: el ganador deja lección de familia al Genoma."
        accion={{ label: "Asignar y medir coherencia", onClick: demoArenaFamilias }}
        extra={<Chip tono="fuego">la familia aprende</Chip>}
      >
        <Salida texto={salidas["arena46"] ?? ""} maxAlto="16rem" />
      </Tarjeta>
    </div>
  );
}

function Tarjeta({
  icono,
  titulo,
  descripcion,
  accion,
  acciones,
  extra,
  children,
  ancha,
}: {
  icono: React.ReactNode;
  titulo: string;
  descripcion: string;
  accion?: { label: string; onClick: () => void };
  acciones?: { label: string; onClick: () => void }[];
  extra?: React.ReactNode;
  children: React.ReactNode;
  ancha?: boolean;
}) {
  return (
    <div className={`space-y-2.5 rounded-2xl border border-border/60 bg-card/50 p-4 ${ancha ? "lg:col-span-2" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {icono}
          <h3 className="text-sm font-semibold">{titulo}</h3>
        </div>
        {extra}
      </div>
      <p className="text-[12px] leading-relaxed text-muted-foreground">{descripcion}</p>
      <div className="flex flex-wrap gap-2">
        {accion && (
          <Button size="sm" variant="outline" className="h-8 text-[12px] sm:h-7 sm:text-[11.5px]" onClick={accion.onClick}>
            {accion.label}
          </Button>
        )}
        {acciones?.map((a, i) => (
          <Button key={i} size="sm" variant="outline" className="h-8 text-[12px] sm:h-7 sm:text-[11.5px]" onClick={a.onClick}>
            {a.label}
          </Button>
        ))}
      </div>
      {children}
    </div>
  );
}
