/** FORJA IA — NÚCLEO v4: el MVP del plan maestro (v4.0.0, secciones 31-32).
 *
 * El MVP EXACTO que el plan define:
 *
 *   PROMPT → FORJA ADN → 3 DIRECCIONES → 2-3 MAQUETAS → ARENA → FUSIÓN
 *          → OPENDESIGN (runtime real | RuntimeLocal) → HTML/CSS
 *          → PREVIEW → ANTI-GENERIC → REVISIÓN → EXPORT
 *
 * Sobre el MVP se apoyan (según perfil de coste): el bucle de mejora
 * (máx 3), las métricas, el benchmark y el registro de observabilidad.
 * Al terminar, las lecciones de la Arena alimentan el GENOMA VISUAL:
 * la próxima generación empieza más lista (evolución real).
 *
 * Como todo el módulo: las llamadas llegan inyectadas (LlamadaModelo), el
 * runtime se inyecta (RuntimeOpenDesign; por defecto RuntimeLocal), y cada
 * paso emite progreso para la UI. Sin red si no hay modelo: el MVP degrada
 * con dignidad (RuntimeLocal + herramientas deterministas).
 */

import type { PeticionForja, LlamadaModelo, ResultadoForja } from "./tipos";
import type { AdnVisual2, RegistroGeneracion } from "./tipos-v4";
import { idV4 } from "./tipos-v4";
import {
  parseAdn2,
  adn2DesdeAdn1,
  promptBloqueAdn2,
  seccionAdn2,
} from "./adn2";
import { designSystemCompleto } from "./bridge-design-system";
import {
  type RuntimeOpenDesign,
  type OpenDesignRequest,
  peticionARequest,
  ejecutarEnRuntime,
  artifactAEvaluacion,
  RuntimeLocal,
} from "./adapter-opendesign";
import {
  type ResultadoArena2,
  arena2Forja,
  textoArena2,
  type ModoArena2,
} from "./arena2";
import { type PerfilCosto } from "./perfiles";
import { perfilCostoSeguro, RECETAS_COSTO, perfilRecursosDesdeCosto } from "./perfiles";
import {
  ejecutarBucleMejora,
  MAX_ITERACIONES_MEJORA,
  type IteracionMejora,
} from "./bucle-mejora";
import { revisarVisual, textoRevisorVisual } from "./revisor-visual";
import { medir, type MedicionForja } from "./metricas";
import { crearRegistro, cerrarRegistro } from "./observabilidad";
import { type GenomaVisual, incorporarLeccionesGenoma } from "./genoma-visual";
import { evaluarExito, type VeredictoExito } from "./evaluador-exito";
import { extraerCodigo } from "./nucleo-extractos";
import {
  crearPresupuesto,
  presupuestoPara,
  type PresupuestoGlobal,
} from "./presupuesto-tokens";
import {
  crearCacheMultinivel,
  cacheMultinivelCompartido,
  NIVEL,
  claveArquitectura,
  type CacheMultinivel,
} from "./cache-multinivel";
import { crearLibroROI } from "./token-roi";
import { crearLlamadaEficiente } from "./eficiencia";
import { compilarContexto, resumenContexto } from "./compilador-contexto";
import {
  decidirSiguientePaso,
  resumenTemprana,
  type DecisionTemprana,
} from "./salida-temprana";
import { scoreDe } from "./bucle-mejora";
import type { CacheGeneracion } from "./cache-fichas";
import { seleccionarExperiencia, seccionContratoExperiencia, cssDeterminista, scriptDeterminista, type SeleccionExperiencia } from "./motor-creativo";
import { auditarExperiencia, parchesExperiencia, resumenQaExperiencia } from "./experience-qa";
import { medirExperiencia, desviacionDeDna, resumenMetricas } from "./experience-bias";
import { registrarComposicion, cargarHistorial, type HuellaComposicion } from "./anti-repetition";
import { resumenExperienciaDna } from "./experience-dna";
import { auditarYparchearMovimiento, resumenMovimiento } from "./motion-qa-medido";
import { auditarDetalle, seccionReparacionDetalle, resumenDetalle } from "./qa-detalle";
import { resumenPlano, type NivelDetalle } from "./plano-contenido";
import { asignarFamiliasArena, resumenAsignacionFamilias } from "./arena-familias";
import {
  registrarResultadoAprendizaje,
  cargarMemoriaAprendizaje,
  recomendacionesAprendidas,
  resumenAprendizaje,
  type EntradaAprendizaje,
} from "./aprendizaje-genoma";

/* -------------------------------- tipos ------------------------------------ */

/** Resultado completo del MVP. */
export interface ResultadoMvp {
  /** compatible con la UI de v3 (estado, código, respuesta, rondas…) */
  resultado: ResultadoForja;
  /** la Arena completa (si el perfil la corrió) */
  arena: ResultadoArena2 | null;
  /** el ADN 2.0 final (ajustado por steering/lecciones) */
  adn: AdnVisual2;
  /** v4.5 — la selección de experiencia completa (familia, receta, planes,
   * hero, cards, responsive, tokens): la decisión creativa expuesta */
  experiencia: SeleccionExperiencia;
  /** DESIGN.md y tokens.css generados */
  designMd: string;
  tokensCss: string;
  /** iteraciones del bucle de mejora */
  iteraciones: IteracionMejora[];
  /** métricas de la generación */
  metricas: MedicionForja | null;
  /** veredicto de éxito (10 criterios del plan) */
  exito: VeredictoExito | null;
  /** registro de observabilidad cerrado */
  registro: RegistroGeneracion;
  /** traza completa para depurar */
  traza: string[];
}

/** Deps del MVP. */
export interface DepsMvp {
  llamarModelo?: LlamadaModelo;
  /** modelo del codificador (por defecto el mismo que el resto) */
  modeloCodificador?: { providerId: string; modelId: string };
  runtime?: RuntimeOpenDesign;
  perfil?: string;
  modoArena?: ModoArena2;
  projectId?: string;
  /** genoma actual (opcional; las lecciones se acumulan) */
  genoma?: GenomaVisual;
  onProgreso?: (evento: string) => void;
  /** v4.4 — capa persistente opcional para la caché (el host decide el
   * store: localStorage, SQLite, redis). Se usa como capa trasera del
   * L1/L2 (cascada) igual que la caché de fichas v4.2. */
  cache?: CacheGeneracion;
  /** v4.4 — apaga la capa de eficiencia (presupuesto/caché/ROI). Parche
   * de escape para comparar en pruebas A/B: por defecto está ACTIVA. */
  sinEficiencia?: boolean;
  /** v4.6 B — memoria de aprendizaje persistida por el host (se restaura
   * al arrancar para que las recomendaciones sobrevivan al proceso). */
  memoriaAprendizaje?: EntradaAprendizaje[];
  /** v4.7 — historial de composiciones persistido por el host. Hasta v4.6
   * el historial vivía SOLO en memoria del proceso: en cualquier despliegue
   * serverless `obtenerHistorial()` devolvía [] en cada generación, así que
   * la anti-repetición §13 era decorativa y dos páginas seguidas podían
   * salir idénticas. Simétrico a `memoriaAprendizaje`: el host guarda
   * `resultado.experiencia` + la huella y la restaura aquí. */
  historialComposicion?: HuellaComposicion[];
  /** v4.7 — nivel de detalle forzado (perilla de la UI): borrador,
   * produccion o showcase. Sin él se deduce del brief. */
  nivelDetalle?: NivelDetalle;
  /** v4.7 — apaga la reparación de detalle con modelo (el QA sigue
   * midiendo y registrando, pero no gasta una llamada). */
  sinReparacionDetalle?: boolean;
}

/* ------------------------------- ejecución ---------------------------------- */

/** Ejecuta el MVP completo. NUNCA lanza: si algo falla, degrada al runtime
 * local y las herramientas deterministas (el usuario siempre recibe algo). */
export async function ejecutarMvpForja(p: PeticionForja, deps: DepsMvp = {}): Promise<ResultadoMvp> {
  const traza: string[] = [];
  const progreso = (e: string): void => {
    traza.push(e);
    deps.onProgreso?.(e);
  };
  const registro = crearRegistro(deps.projectId ?? "prisma");
  const perfil = perfilCostoSeguro(deps.perfil);
  const receta = RECETAS_COSTO[perfil];
  const modelo = deps.modeloCodificador ?? { providerId: "prism", modelId: "d1-diseno" };
  const runtime = deps.runtime ?? new RuntimeLocal();
  // v4.6 B — learning loop del Genoma: restaurar la memoria persistida
  if (deps.memoriaAprendizaje?.length) {
    cargarMemoriaAprendizaje(deps.memoriaAprendizaje);
    progreso(`[aprendizaje] memoria restaurada: ${deps.memoriaAprendizaje.length} resultado(s) previo(s)`);
  }
  // v4.7 — y el historial de composición, que hasta ahora moría con el proceso
  if (deps.historialComposicion?.length) {
    cargarHistorial(deps.historialComposicion);
    progreso(`[anti-repeticion] historial restaurado: ${deps.historialComposicion.length} composición(es) previa(s)`);
  }

  /* 0 · EFICIENCIA (v4.4): presupuesto global + caché multinivel + ROI.
   * El plan (§22/24/25/26/28) montado de una pieza ANTES del primer gasto. */
  const esEdicion = Boolean(p.codigoActual);
  const { complejidad, reparto } = presupuestoPara(p.mensaje, esEdicion, perfil);
  const presupuesto: PresupuestoGlobal = crearPresupuesto(reparto, perfil);
  const sinEficiencia = deps.sinEficiencia === true;
  // v4.4: el caché COMPARTIDO del proceso (L3/L4 solo rentan entre
  // generaciones); la capa persistente del host (deps.cache) se inyecta
  // en cascada de L1/L2 si llega. En modo sinEficiencia, caché aislada.
  const cacheMulti: CacheMultinivel = sinEficiencia
    ? crearCacheMultinivel({})
    : cacheMultinivelCompartido(deps.cache);
  const roi = crearLibroROI();
  let eficiente = deps.llamarModelo;
  if (eficiente && !sinEficiencia) {
    const envoltorio = crearLlamadaEficiente(eficiente, {
      presupuesto,
      cache: cacheMulti,
      roi,
      onDenegada: (rol, motivo) => progreso(`[eficiencia] llamada denegada (${rol}): ${motivo}`),
      onCacheHit: (nivel) => progreso(`[eficiencia] acierto de caché L${nivel}: 0 tokens`),
    });
    eficiente = envoltorio.llamarModelo;
  }
  const llamada = eficiente;
  progreso(
    `[mvp] perfil ${perfil} (${receta.llamadasEstimadas} llamadas estimadas) · runtime ${runtime.nombre} · complejidad ${complejidad} · presupuesto ${presupuesto.total} tok`
  );

  /* 1 · ADN 2.0 — con caché L3 de decisión arquitectónica: la misma petición
   * (misma memoria) no vuelve a pagar la definición del ADN (plan §24 L3). */
  progreso("[adn] definiendo el ADN visual 2.0");
  let adn: AdnVisual2 = adn2DesdeAdn1(null, p.mensaje);
  const claveL3 = claveArquitectura(p.mensaje, p.reglasAprendidas ?? []);
  const adnCacheado = sinEficiencia ? null : cacheMulti.obtenerJSON<AdnVisual2>(NIVEL.arquitectura, claveL3);
  if (adnCacheado) {
    adn = adnCacheado;
    progreso("[adn] decisión de ADN servida del caché L3 (0 tokens)");
  } else if (llamada) {
    try {
      const salidaAdn = await llamada({
        providerId: modelo.providerId,
        modelId: modelo.modelId,
        system: promptBloqueAdn2(p.mensaje),
        user: "Define el ADN visual 2.0 del proyecto.",
        temperatura: 0.4,
        rol: "disenador",
        maxTokens: 8_192,
      });
      adn = parseAdn2(salidaAdn) ?? adn;
      cacheMulti.guardarJSON(NIVEL.arquitectura, claveL3, adn);
    } catch {
      progreso("[adn] sin respuesta del modelo: ADN de respaldo anti-genérico");
    }
  }
  registro.adn = adn.identidad.slice(0, 120);

  /* 1b · MOTOR CREATIVO (v4.5, correcciones §1/§16/§26/§32): INTENCIÓN →
   * FAMILIA → RECETA → REPRESENTACIÓN → PLANES → HERO → CARDS → RESPONSIVE
   * → TOKENS. Todo DETERMINISTA y GRATIS: se decide aquí y viaja al
   * Codificador como contrato. Editorial ya no es el refugio (§23), la
   * puerta de rendimiento decide 2D/2.5D/3D/WebGL con cascada (§10/§20) y
   * la anti-repetición penaliza lo visto en las últimas generaciones (§13). */
  progreso("[experiencia] seleccionando familia, receta, planes, objeto y primitivas (motor creativo v4.6)");
  // v4.7 — CORREGIDO: la dirección creativa se decidía solo con el mensaje
  // crudo. El ADN 2.0 que se acaba de definir (identidad, lenguaje visual,
  // prohibiciones) es la señal más rica que hay en este punto y se estaba
  // tirando. El mensaje original viaja aparte para que el plano de
  // contenido extraiga de ÉL los hechos del brief.
  const senales = [
    p.mensaje,
    adn.identidad,
    ...(adn.personalidad ?? []),
    ...(adn.lenguaje ?? []),
    ...(adn.composicion ?? []),
    ...(adn.representacion ?? []),
    ...(adn.movimiento ?? []),
    ...(adn.prohibiciones ?? []),
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 6000);
  const seleccion = seleccionarExperiencia(senales, {
    mensajeOriginal: p.mensaje,
    nivelDetalle: deps.nivelDetalle,
  });
  progreso(`[experiencia] ${seleccion.resumen}`);
  progreso(`[plano] ${resumenPlano(seleccion.plano)}`);
  if (seleccion.razonesDna.length) progreso(`[experiencia] señales: ${seleccion.razonesDna.join("; ")}`);
  if (seleccion.representacion.degradadoDe) progreso(`[experiencia] ${seleccion.representacion.razon}`);
  if (seleccion.objeto) progreso(`[objeto-3d] forjado: ${seleccion.objeto.nombre} — ${seleccion.objeto.descripcion}`);
  if (seleccion.primitivas.primitivas.length) progreso(`[primitivas] compiladas: ${seleccion.primitivas.primitivas.join(", ")} (${seleccion.primitivas.kbTotales} KB, nacen auditadas)`);
  if (seleccion.aprendizaje.length) progreso(`[aprendizaje] ${seleccion.aprendizaje.map((r) => `${r.accion} ${r.dimension} ${r.valor}`).join(" · ")}`);
  registro.experiencia = {
    familia: seleccion.familia.familia,
    receta: seleccion.receta.receta.id,
    hero: seleccion.hero.tipo,
    representacion: seleccion.representacion.modo,
    dna: resumenExperienciaDna(seleccion.dna),
    metricas: "",
    qa: "",
    parches: 0,
    objeto: seleccion.objeto ? seleccion.objeto.id : "ninguno",
    primitivas: seleccion.primitivas.primitivas.join(",") || "ninguna",
    aprendizaje: seleccion.aprendizaje.length ? seleccion.aprendizaje.map((r) => `${r.accion}:${r.dimension}:${r.valor}`).join(" · ") : "",
    plano: resumenPlano(seleccion.plano),
    detalleQa: "",
  };


  /* 2 · Sistema de diseño (ADN → DESIGN.md → tokens.css) */
  const ds = designSystemCompleto(adn, registro.projectId);
  registro.designSystem = ds.nombre;
  progreso(`[sistema] design system «${ds.nombre}» con ${ds.colores.length} colores declarados`);

  /* 3 · Arena / direcciones */
  let arena: ResultadoArena2 | null = null;
  let nombreDireccion = "";
  let briefAdicional = "";
  if (receta.visiones > 1 && llamada) {
    progreso(`[arena] modo ${deps.modoArena ?? "profesional"} (${receta.visiones} visiones, ${receta.maquetas} maquetas)`);
    // v4.6 F — ARENA ENTRE FAMILIAS: cada visión corre EN una familia
    // distinta y la coherencia de familia se puntúa (aprendizaje medido).
    const asignacion = asignarFamiliasArena(p.mensaje);
    progreso(`[arena-familias] ${resumenAsignacionFamilias(asignacion)}`);
    arena = await arena2Forja(p.mensaje, adn, deps.modoArena ?? "profesional", perfil, {
      llamarModelo: llamada,
      modeloDirector: modelo,
      onProgreso: progreso,
      familiasArena: asignacion,
    });
    // v4.4 (C2): el nº REAL de llamadas lo mide el libro ROI (todas las
    // llamadas pasan por el envoltorio eficiente) — no se suman estimaciones.
    nombreDireccion = arena.fusion ? arena.fusion.concepto : (arena.visiones.find((v) => v.letra === arena?.mejor)?.nombre ?? "");
    registro.direccionesExploradas = arena.visiones.map((v) => v.nombre);
    // v4.6 F — la familia de la visión ganadora queda registrada
    if (registro.experiencia) {
      const asignacionFam = asignacion.porLetra[arena.mejor];
      registro.experiencia.arenaFamilia = `${asignacionFam} (visión ${arena.mejor})`;
    }
    briefAdicional = textoArena2(arena).slice(0, 2500);
  } else {
    progreso("[direcciones] perfil sin Arena: 1 dirección directa");
    nombreDireccion = "dirección directa del Diseñador";
  }
  registro.direccion = nombreDireccion.slice(0, 120);

  /* 4 · Generación del código (FORJA decide → runtime ejecuta) */
  progreso(`[codigo] ejecutando en ${runtime.nombre}`);
  const request: OpenDesignRequest = peticionARequest(p, adn, null, ds, registro.projectId);
  if (briefAdicional) {
    request.brief = `${request.brief}\n\n# Resultado de la Arena (visión ganadora y fusión)\n${briefAdicional}`;
  }
  registro.skills = request.skills;
  let artifact = await ejecutarEnRuntime(runtime, request);

  // si el runtime no generó (o es el local sin modelo suficiente) y HAY
  // modelo, el Codificador produce el HTML real
  if (llamada && (!artifact.ok || artifact.productor === "runtime-local")) {
    progreso("[codigo] Codificador con modelo");
    /* v4.4 · CONTEXTO COMPILADO (plan §23): el brief, las reglas aprendidas
     * y el conocimiento global se COMPILAN (dedupe + relevancia + techo)
     * antes de viajar. La misma calidad de instrucciones, menos tokens de
     * entrada en la llamada más cara del pipeline. */
    const ctxCod = compilarContexto({
      mensaje: p.mensaje,
      objetivo: "construir la página completa respetando ADN, sistema y CONTRATO DE EXPERIENCIA",
      techoCaracteres: 5_500,
      fuentes: [
        { tipo: "fallos-confirmados", prioridad: 0, lineas: p.reglasAprendidas ?? [] },
        { tipo: "conocimiento-global", prioridad: 2, lineas: p.conocimientoGlobal ?? [] },
        { tipo: "estado", prioridad: 1, lineas: request.brief.split(/\n+/) },
      ],
    });
    progreso(`[codigo] contexto compilado: ${resumenContexto(ctxCod.stats)}`);
    try {
      const salida = await llamada({
        providerId: modelo.providerId,
        modelId: modelo.modelId,
        system: [
          `Eres el Codificador de FORJA IA. Construye el HTML autocontenido completo.`,
          `Cumples el ADN 2.0, el design system y el CONTRATO DE EXPERIENCIA AL PIE DE LA LETRA.`,
          seccionAdn2(adn),
          seccionContratoExperiencia(seleccion),
          `La CSS determinista de la experiencia (tokens + escenario + objeto 3D + movimiento + cards + primitivas compiladas) viaja en el mensaje: INCLUYELA y añade la tuya ENCIMA, nunca en contra.`,
          `Si viaja un script capado de primitivas («scripts de primitivas compiladas»), pégalo al FINAL del <body> tal cual: es idempotente y respeta reduced-motion.`,
          `Prohibido: el catálogo genérico (hero centrado + título gigante + botón azul, 3 tarjetas gemelas, blobs, glassmorphism, dashboard de cajitas).`,
          `Salida: SOLO el código HTML completo.`,
        ].join("\n"),
        user: [
          ctxCod.texto || request.brief.slice(0, 4500),
          `# CSS determinista de la experiencia (incluir tal cual)\n${cssDeterminista(seleccion)}`,
          scriptDeterminista(seleccion)
            ? `# Scripts capados de las primitivas compiladas (pegar al final del body, tal cual)\n${scriptDeterminista(seleccion)}`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        temperatura: 0.5,
        onFragmento: undefined,
        rol: "codificador",
        // v4.7 — el techo lo fija el NIVEL DE DETALLE, no el defecto del
        // rol. Hasta v4.6 esta llamada —la que produce la página entera—
        // no pedía maxTokens y heredaba el defecto: el modelo entregaba lo
        // que cabía y recortaba contenido antes que CSS.
        maxTokens: seleccion.plano.presupuesto.maxTokensImplementacion,
      });
      const codigo = extraerCodigo(salida);
      if (codigo) {
        artifact = { ...artifact, html: codigo, ok: true, productor: `${modelo.providerId}:${modelo.modelId}` };
      }
    } catch {
      progreso("[codigo] el Codificador falló: se conserva el artefacto del runtime");
    }
  }
  registro.modelos.push(`${modelo.providerId}:${modelo.modelId}`);
  registro.agentes.push("director", "codificador");
  registro.artifact = `${artifact.productor} (${artifact.html.length} chars)`;

  /* 5 · Evaluación FORJA + ANTI-GENERIC + REVISIÓN */
  progreso("[revision] evaluando con inspector + anti-genérico + sistema");
  const evaluacion = artifactAEvaluacion(artifact, ds);
  registro.antiGeneric = `identidad ${evaluacion.genericidad.puntuacionIdentidad}/100 (${evaluacion.genericidad.nivel})`;
  registro.critic = evaluacion.resumen;
  progreso(`[revision] ${evaluacion.resumen}`);

  /* 6 · SALIDA TEMPRANA + BUCLE DE MEJORA (v4.4, plan §22/26):
   *   QA → ¿good enough? → SÍ: STOP (ahorro directo)
   *        └─ NO → ¿parche determinista? → SÍ: PATCH gratis y re-decidir
   *                 └─ NO → LLM (bucle de mejora, máx 3, con rollback) */
  let iteraciones: IteracionMejora[] = [];
  const decisionesTempranas: DecisionTemprana[] = [];
  let parchesGratis = 0;
  let htmlFinal = artifact.html;
  let informeActual = revisarVisual(htmlFinal, { ds });
  let decision = decidirSiguientePaso(informeActual, 0, MAX_ITERACIONES_MEJORA, htmlFinal);
  decisionesTempranas.push(decision);

  if (decision.tipo === "parche-determinista") {
    const scoreAntes = scoreDe(informeActual);
    htmlFinal = decision.html;
    parchesGratis += decision.parches.length;
    progreso(`[temprana] parche gratis: ${decision.motivo}`);
    informeActual = revisarVisual(htmlFinal, { ds });
    roi.registrar({
      operacion: "parche-det",
      rol: "-",
      modelo: "determinista",
      tokens: 0,
      llamadas: 0,
      scoreAntes,
      scoreDespues: scoreDe(informeActual),
    });
    // tras el parche gratis, ¿sigue haciendo falta el modelo?
    decision = decidirSiguientePaso(informeActual, 1, MAX_ITERACIONES_MEJORA, htmlFinal);
    decisionesTempranas.push(decision);
  }

  /* 6b · QA DE EXPERIENCIA + PATCH-FIRST (v4.5, correcciones §21/§22):
   * si el QA de experiencia detecta sesgo editorial alto o desviación del
   * ADN, NO se regenera la página: detect → classify → patch. Parches
   * deterministas, capados y con guard de reduced-motion (contenido intacto).
   * Lo que no se puede parchear sube al LLM con la corrección propuesta. */
  let parchesExp = 0;
  if (htmlFinal && artifact.ok) {
    const hallazgos = auditarExperiencia(htmlFinal, seleccion.dna);
    if (hallazgos.length) {
      const rExp = parchesExperiencia(htmlFinal, hallazgos, seleccion.dna, seleccion.planMovimiento, seleccion.planEspacial);
      parchesExp = rExp.parches.length;
      const metricasTras = medirExperiencia(rExp.html);
      const desvio = desviacionDeDna(metricasTras, seleccion.dna);
      if (registro.experiencia) {
        registro.experiencia.metricas = resumenMetricas(metricasTras);
        registro.experiencia.qa = resumenQaExperiencia(hallazgos, rExp.parches);
        registro.experiencia.parches = parchesExp;
      }
      if (parchesExp > 0) {
        const scoreAntesExp = scoreDe(informeActual);
        htmlFinal = rExp.html;
        parchesGratis += parchesExp;
        progreso(`[experiencia-qa] ${resumenQaExperiencia(hallazgos, rExp.parches)}`);
        progreso(`[experiencia-qa] ${desvio.resumen}`);
        informeActual = revisarVisual(htmlFinal, { ds });
        roi.registrar({
          operacion: "parche-experiencia",
          rol: "-",
          modelo: "determinista",
          tokens: 0,
          llamadas: 0,
          scoreAntes: scoreAntesExp,
          scoreDespues: scoreDe(informeActual),
        });
        // tras el parche de experiencia, ¿sigue haciendo falta el LLM?
        decision = decidirSiguientePaso(informeActual, iteraciones.length ? 1 : 0, MAX_ITERACIONES_MEJORA, htmlFinal);
        decisionesTempranas.push(decision);
      }
      if (rExp.sinParche.length) {
        progreso(`[experiencia-qa] sin parche: ${rExp.sinParche.map((h) => h.chequeo).join(", ")} → sube al bucle con corrección propuesta`);
      }
    } else if (registro.experiencia) {
      registro.experiencia.metricas = resumenMetricas(medirExperiencia(htmlFinal));
      registro.experiencia.qa = "sin hallazgos";
    }
  }

  /* 6c · MOTION QA MEDIDO (v4.6, idea D): el QA estático contaba
   * animaciones «en promedio»; aquí se PARSEA el CSS real y se verifica la
   * escala §9 POR DURACIÓN: nada fuera de 150-1600ms salvo ambiente,
   * stagger presente cuando el plan lo pide y reduced-motion que apague
   * de verdad. Lo que falla se parchea determinista (guard + overrides
   * capados + utilidad de stagger), append-only y sin tocar contenido. */
  if (htmlFinal && artifact.ok) {
    const rMov = auditarYparchearMovimiento(htmlFinal, seleccion.planMovimiento);
    if (registro.experiencia) registro.experiencia.motionQa = resumenMovimiento(rMov.informe);
    if (rMov.parches.length) {
      const scoreAntesMov = scoreDe(informeActual);
      htmlFinal = rMov.html;
      parchesGratis += rMov.parches.length;
      progreso(`[motion-qa] ${resumenMovimiento(rMov.informe)}`);
      progreso(`[motion-qa] parches: ${rMov.parches.map((p) => p.tipo).join(", ")}`);
      informeActual = revisarVisual(htmlFinal, { ds });
      roi.registrar({
        operacion: "parche-motion-qa",
        rol: "-",
        modelo: "determinista",
        tokens: 0,
        llamadas: 0,
        scoreAntes: scoreAntesMov,
        scoreDespues: scoreDe(informeActual),
      });
    } else if (rMov.informe.hallazgos.length === 0) {
      progreso(`[motion-qa] ${resumenMovimiento(rMov.informe)}`);
    }
  }

  /* 6d · v4.7 — QA DE DETALLE. El hueco que quedaba: revisarVisual() mide
   * bugs, a11y, genericidad y design system; auditarExperiencia() mide
   * desviación del ADN; motion-qa-medido mide duraciones. NINGUNO medía
   * DENSIDAD DE DETALLE, así que una página de cuatro secciones con tres
   * frases cada una sacaba PASS: no tenía defectos, simplemente no tenía
   * página. Aquí se mide contra el PLANO DE CONTENIDO.
   *
   * Lo que falta casi nunca se parchea con regex (falta CONTENIDO, y el
   * contenido lo escribe el modelo): por eso el hallazgo se convierte en un
   * ENCARGO QUIRÚRGICO de una sola llamada —«amplía, no regeneres»— en vez
   * de tirar la página y empezar de cero. */
  let informeDetalle = auditarDetalle(htmlFinal, seleccion.plano);
  if (registro.experiencia) registro.experiencia.detalleQa = resumenDetalle(informeDetalle);
  progreso(`[detalle-qa] ${resumenDetalle(informeDetalle)}`);
  if (
    htmlFinal &&
    artifact.ok &&
    llamada &&
    !deps.sinReparacionDetalle &&
    informeDetalle.veredicto === "FAIL"
  ) {
    const encargo = seccionReparacionDetalle(informeDetalle, seleccion.plano);
    if (encargo) {
      progreso(`[detalle-qa] reparación quirúrgica: ${informeDetalle.hallazgos.filter((h) => h.gravedad === "critico").length} crítico(s)`);
      const scoreAntesDet = scoreDe(informeActual);
      const puntosAntes = informeDetalle.puntuacion;
      const htmlPrevio = htmlFinal;
      try {
        const salidaDet = await llamada({
          providerId: modelo.providerId,
          modelId: modelo.modelId,
          system: [
            `Eres el Codificador de FORJA IA en modo AMPLIACIÓN.`,
            `NO regeneras la página: devuelves el MISMO documento con el contenido que falta añadido.`,
            `Conservas intactos: el bloque :root de tokens, la CSS determinista, el objeto 3D, las primitivas compiladas, sus scripts y todo el contenido que ya estaba bien.`,
            `Salida: SOLO el documento HTML completo.`,
          ].join("\n"),
          user: [encargo, `# Documento actual\n${htmlFinal}`].join("\n\n"),
          temperatura: 0.4,
          rol: "codificador",
          maxTokens: seleccion.plano.presupuesto.maxTokensImplementacion,
        });
        const ampliado = extraerCodigo(salidaDet);
        const informeAmpliado = ampliado ? auditarDetalle(ampliado, seleccion.plano) : null;
        // ROLLBACK honesto: la ampliación solo entra si de verdad mejora el
        // detalle Y no rompe la página (misma política que el bucle de mejora).
        if (ampliado && informeAmpliado && informeAmpliado.puntuacion > puntosAntes) {
          const informeVisualAmpliado = revisarVisual(ampliado, { ds });
          if (informeVisualAmpliado.veredicto !== "FAIL" || informeActual.veredicto === "FAIL") {
            htmlFinal = ampliado;
            informeActual = informeVisualAmpliado;
            informeDetalle = informeAmpliado;
            progreso(`[detalle-qa] ampliada: detalle ${puntosAntes} → ${informeAmpliado.puntuacion}/100`);
          } else {
            progreso(`[detalle-qa] ampliación descartada: mejoraba el detalle pero rompía la página (rollback)`);
          }
        } else {
          htmlFinal = htmlPrevio;
          progreso(`[detalle-qa] ampliación descartada: no mejoró el detalle (rollback)`);
        }
      } catch {
        progreso("[detalle-qa] la reparación falló: se conserva el documento anterior");
      }
      if (registro.experiencia) registro.experiencia.detalleQa = resumenDetalle(informeDetalle);
      roi.registrar({
        operacion: "reparacion-detalle",
        rol: "codificador",
        modelo: `${modelo.providerId}:${modelo.modelId}`,
        tokens: 0,
        llamadas: 0,
        scoreAntes: scoreAntesDet,
        scoreDespues: scoreDe(informeActual),
      });
    }
  }

  if (receta.bucleMejora && artifact.ok && decision.tipo === "llm") {
    progreso("[bucle] bucle de mejora autónomo (máx 3)");
    const bucle = await ejecutarBucleMejora(htmlFinal, {
      llamarModelo: llamada,
      modelo,
      ds,
      onProgreso: progreso,
    });
    const scoreFinalBucle = scoreDe(bucle.informeFinal);
    roi.registrar({
      operacion: "bucle-mejora",
      rol: "codificador",
      modelo: `${modelo.providerId}:${modelo.modelId}`,
      tokens: 0, // las llamadas del bucle ya se contaron por el envoltorio
      llamadas: 0,
      scoreAntes: scoreDe(informeActual),
      scoreDespues: scoreFinalBucle,
    });
    htmlFinal = bucle.html;
    iteraciones = bucle.iteraciones;
    informeActual = bucle.informeFinal;
    registro.iteraciones = bucle.iteracionesUsadas;
    progreso(`[bucle] fin tras ${bucle.iteracionesUsadas} iteración(es): ${bucle.informeFinal.veredicto}`);
  } else if (receta.bucleMejora && artifact.ok) {
    progreso(`[bucle] omitido — ${decision.motivo}`);
    registro.iteraciones = 0;
  } else if (decision.tipo === "parche-determinista") {
    progreso(`[temprana] ${decision.motivo}`);
  }

  /* 7 · Métricas */
  let metricas: MedicionForja | null = null;
  if (receta.benchmark) {
    progreso("[metricas] midiendo las 8 métricas del plan");
    metricas = medir(htmlFinal, { ds, iteraciones });
  }

  /* 8 · Registro + Genoma + Éxito + EFICIENCIA (v4.4) */
  const informeFinal = informeActual;
  // nº REAL de llamadas de modelo (el ROI cuenta todas: pasan por el envoltorio)
  const totalesRoi = roi.totales();
  registro.llamadas = totalesRoi.llamadas;
  const informePresupuesto = presupuesto.informe();
  const statsCache = cacheMulti.stats();
  const temprana = resumenTemprana(
    registro.iteraciones,
    receta.bucleMejora ? MAX_ITERACIONES_MEJORA : 0,
    decisionesTempranas
  );
  // ahorro estimado: llamadas de caché (≈ 1.500 tok de salida media evitada)
  // + iteraciones evitadas por salida temprana (≈ 4.500 tok por ronda Revisor+Codificador)
  const iteracionesEvitadas = Math.max(0, (receta.bucleMejora ? MAX_ITERACIONES_MEJORA : 0) - registro.iteraciones);
  const ahorroEstimado = totalesRoi.deCache * 1_500 + iteracionesEvitadas * 4_500 + parchesGratis * 6_000;
  registro.eficiencia = {
    complejidad,
    presupuesto: presupuesto.resumen(),
    fases: Object.entries(informePresupuesto.porFase).map(([fase, e]) => ({ fase, cupo: e.cupo, gastado: e.gastado })),
    cache: statsCache.resumen(),
    roi: roi.resumen(),
    temprana,
    contexto: "ver [codigo] en la traza (compilado por petición)",
    ahorroTokensEstimado: ahorroEstimado,
  };
  progreso(`[eficiencia] ${presupuesto.resumen()} · ${statsCache.resumen()} · ${roi.resumen()} · ${temprana}`);

  const registroCerrado = cerrarRegistro(registro, informeFinal.identidad, arena?.lecciones.map((l) => l.texto) ?? []);
  let genomaFinal: GenomaVisual | null = null;
  if (arena?.lecciones.length) {
    genomaFinal = incorporarLeccionesGenoma(deps.genoma ?? { generacion: 0, lecciones: [], patrones: [], antiPatrones: [], referencias: [] }, arena.lecciones);
    registroCerrado.lecciones = [...registroCerrado.lecciones, ...genomaFinal.patrones.map((x) => `patrón: ${x.texto}`)].slice(0, 12);
    progreso(`[genoma] generación ${genomaFinal.generacion} con ${genomaFinal.lecciones.length} lecciones`);
  }

  /* 8b · ANTI-REPETICIÓN + LEARNING LOOP (v4.5 corrección §13 + v4.6 B):
   * la huella de esta composición queda registrada — la próxima
   * generación ya la conoce y la penaliza si la intención lo permite —
   * y AHORA también el RESULTADO (score + veredicto): con 20-30
   * generaciones el Genoma pasa de «penalizar lo reciente» a «recomendar
   * lo que ganó con evidencia». */
  const huellaActual = {
    hero: seleccion.hero.tipo,
    cards: seleccion.cards.variantes,
    motion: seleccion.planMovimiento.primitivas,
    spatial: seleccion.dna.spatial.mode,
    navegacion: seleccion.receta.receta.navegacion.minimal ? "minimal" : "estándar",
    secciones: seleccion.familia.razones,
    cuando: Date.now(),
  };
  registrarComposicion(huellaActual);
  registrarResultadoAprendizaje({
    cuando: huellaActual.cuando,
    vertical: p.mensaje.slice(0, 80),
    familia: seleccion.familia.familia,
    huella: huellaActual,
    score: scoreDe(informeFinal),
    veredicto: informeFinal.veredicto === "PASS" ? "exito" : informeFinal.veredicto === "WARN" ? "regular" : "fallo",
    metricas: registro.experiencia?.metricas ?? "",
  });
  const recsAprendidas = recomendacionesAprendidas({ max: 4 });
  progreso(`[aprendizaje] ${resumenAprendizaje(recsAprendidas)}`);

  const exito = evaluarExito(montarResultado());
  progreso(`[fin] ${exito.resumen}`);

  return {
    resultado: montarResultado(),
    arena,
    adn,
    experiencia: seleccion,
    designMd: ds.designMd,
    tokensCss: ds.tokensCss,
    iteraciones,
    metricas,
    exito,
    registro: registroCerrado,
    traza,
  };

  /** monta el ResultadoForja compatible con la UI v3 */
  function montarResultado(): ResultadoForja {
    return {
      estado: "completo",
      codigo: htmlFinal,
      respuesta: [
        `**FORJA IA v4 (MVP ${perfil})**`,
        informado(),
        informadoExperiencia(),
        metricas ? metricas.resumen : "",
        informadoEficiencia(),
      ]
        .filter(Boolean)
        .join("\n\n"),
      ficha: null,
      fichaTexto: request.brief.slice(0, 2000),
      maqueta: null,
      rondas: [],
      veredicto: { aprobado: informeFinal.veredicto !== "FAIL", defectos: informeFinal.hallazgos.map((h) => `${h.titulo}: ${h.correccion}`).slice(0, 6), resumen: informeFinal.resumen },
      agotado: false,
      vision: informeFinal.hallazgos,
      adn: adn,
      genericidad: evaluacion.genericidad,
    };
  }
  /** v4.5/v4.6 — la cuenta de la experiencia, visible para el usuario (el doc
   * §29-31: el resultado debe PODER explicarse en términos de familia,
   * receta y QA de experiencia, no solo de score). */
  function informadoExperiencia(): string {
    const e = registro.experiencia;
    if (!e) return "";
    const partes = [
      `**Experiencia v4.6**: familia «${e.familia}» · receta ${e.receta} · hero ${e.hero} · representación ${e.representacion}${e.arenaFamilia ? ` · Arena de familias: ganó ${e.arenaFamilia}` : ""} — ${e.dna}`,
      e.objeto && e.objeto !== "ninguno" ? `Objeto 3D forjado (0 librerías): ${e.objeto}. Primitivas compiladas: ${e.primitivas}.` : "",
      e.aprendizaje ? `El Genoma recomendó con evidencia: ${e.aprendizaje}.` : "",
    ];
    if (e.metricas) partes.push(`Métricas del resultado: ${e.metricas}.`);
    if (e.qa && e.qa !== "sin hallazgos") partes.push(`QA de experiencia: ${e.qa}.`);
    if (e.motionQa) partes.push(`Motion QA medido: ${e.motionQa}.`);
    return partes.filter(Boolean).join("\n");
  }
  function informado(): string {
    const partes = [`Código producido por ${artifact.productor}.`, textoRevisorVisual(informeFinal)];
    if (iteraciones.length) partes.push(`Bucle de mejora: ${iteraciones.length} iteración(es), score ${iteraciones[0].scoreAntes} → ${iteraciones[iteraciones.length - 1].scoreDespues}.`);
    return partes.join("\n\n");
  }
  /** v4.4 — la cuenta del ahorro, visible para el usuario (el plan §48:
  * «eficiencia de tokens» es parte del posicionamiento del producto). */
  function informadoEficiencia(): string {
    const e = registro.eficiencia;
    if (!e) return "";
    const partes = [
      `**Eficiencia v4.4**: complejidad ${e.complejidad} · ${e.presupuesto} · ${e.cache}`,
      e.ahorroTokensEstimado > 0
        ? `Ahorro estimado de esta generación: ~${e.ahorroTokensEstimado.toLocaleString("es-ES")} tokens de salida (caché ${totalesRoi.deCache} · ${iteracionesEvitadas} iteración(es) evitada(s) · ${parchesGratis} parche(s) sin modelo).`
        : `Esta generación usó el presupuesto completo: la calidad pagó su precio.`,
      e.roi,
    ];
    return partes.filter(Boolean).join("\n");
  }
}

/** Re-export útil para integradores. */
export type { PerfilCosto, RuntimeOpenDesign, RegistroGeneracion };
export { perfilRecursosDesdeCosto, idV4 };
