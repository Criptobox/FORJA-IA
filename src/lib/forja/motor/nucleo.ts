/** FORJA IA — Núcleo FORJA IA: el motor del pipeline iterativo.
 *
 * Cuando el usuario selecciona FORJA IA en la lista de modelos, cada
 * petición pasa por aquí. El núcleo (v2):
 *
 *   1. Compone los prompts de cada rol (base + habilidades + memorias).
 *   2. Decide si hay fase de maqueta (debeMaquetar(): perfil + modo).
 *   3. Llama al Diseñador → ficha de diseño (+ 3 direcciones si hay maqueta).
 *   4a. CON maqueta: el Codificador construye la maqueta navegable y el
 *       núcleo DEVUELVE el control con estado «esperando-aprobacion».
 *       El usuario aprueba (continuarForja), ajusta (ajustarMaquetaForja) o pide
 *       «directo» (continuarForja igualmente, con la ficha como guía).
 *   4b. SIN maqueta: directo al bucle Codificador → Revisor.
 *   5. Bucle de corrección: el Revisor rechaza → defectos al Codificador,
 *      hasta rondas del perfil. Nunca reintenta el Diseñador.
 *   6. Aprende de los éxitos y entrega el mejor resultado.
 *
 * El núcleo NO conoce proveedores ni storage ni red: recibe `llamarModelo` y
 * `memoria` por parámetro (y las reglas globales ya cargadas). Así se prueba
 * con mocks y se conecta al chat-client real de FORJA IA en una línea
 * (ver LEEME-INTEGRACION.md).
 */

import type {
  ArtefactoForja,
  ConfigForja,
  FichaDiseno,
  LlamadaModelo,
  ModeloDeRol,
  PeticionForja,
  PropuestaMaqueta,
  ResultadoForja,
  RolForja,
  RondaForja,
} from "./tipos";
import {
  debeMaquetar,
  parseVeredicto,
  PERFIL_DEFECTO,
  PERFILES,
  rondasDePerfil,
} from "./tipos";
import { EQUIPO_FORJA, ORDEN_PIPELINE } from "./equipo";
import { promptDisenador } from "./conocimiento/disenador";
import { promptCodificador } from "./conocimiento/codificador";
import { promptRevisor } from "./conocimiento/revisor";
import { bloquesDeHabilidades, habilidadesSugeridas } from "./habilidades";
import {
  aprenderDeExito,
  esReglaDeCalidad,
  reglasParaPrompt,
  type MemoriaForja,
} from "./conocimiento-usuario";
import { extraerCodigo, extraerDecisiones } from "./nucleo-extractos";
import {
  ajustarPropuesta,
  construirPropuesta,
  respuestaDePropuesta,
  type DependenciasMaqueta,
} from "./maqueta";
import {
  chequeosEstaticos,
  informeInspector,
  type HallazgoVision,
} from "./vision";
import {
  adnDesdePeticion,
  parseAdn,
  sanearAdn,
  seccionAdn,
  textoAdn,
  type AdnVisual,
} from "./adn-visual";
import { detectarGenericidad, resumenAntiGenerico, textoInformeAntiGenerico } from "./antigenerico";
import { seccionRepresentacion } from "./representacion";
import { techoTokens } from "./tipos";
import { claveFicha } from "./cache-fichas";
import {
  continuarSalidaTruncada,
  continuarConLlamada,
} from "./continuacion-nucleo";
import type { CacheGeneracion } from "./cache-fichas";

/** Re-exportados para compatibilidad con quien los importaba del núcleo. */
export { extraerCodigo, extraerDecisiones } from "./nucleo-extractos";

/** Memoria en mano para esta petición (ya cargada por el llamador). */
export interface DependenciasForja {
  llamarModelo: LlamadaModelo;
  memoria: MemoriaForja;
  /** al terminar, si hubo éxito, el llamador persiste lo que devuelva aquí */
  onMemoriaNueva?: (memoria: MemoriaForja) => void;
  /** progreso para la UI en vivo: rol, ronda y fragmentos de streaming */
  onProgreso?: (evento: EventoForja) => void;
  /** v4.2 — caché de generaciones por hash (cache-fichas.ts). Opcional:
   * sin caché, el pipeline funciona exactamente igual que en v4.1. Con
   * caché, la ficha del Diseñador y la maqueta inicial se reusan si la
   * entrada es idéntica — la misma petición no se paga dos veces. */
  cache?: CacheGeneracion;
}

export type EventoForja =
  | { tipo: "rol-inicio"; rol: RolForja; ronda: number; modelo: string }
  | { tipo: "fragmento"; rol: RolForja; texto: string }
  | { tipo: "rol-fin"; rol: RolForja; ronda: number; ok: boolean }
  | { tipo: "maqueta"; fase: "inicio" | "fin"; ok?: boolean }
  | { tipo: "bucle"; ronda: number; defectos: string[] }
  | { tipo: "vision"; ronda: number; total: number; criticos: number }
  /** v4.2 — el núcleo cerró una salida truncada (segundo cinturón de
   * continuacion-nucleo.ts): n es la pieza 1-based */
  | { tipo: "continuacion-nucleo"; rol: RolForja; ronda: number; n: number }
  /** v4.2 — acierto de caché: la entrada era idéntica y no se pagó la
   * llamada (que: ficha del Diseñador o maqueta inicial) */
  | { tipo: "cache"; que: "ficha" | "maqueta" }
  | { tipo: "fin"; agotado: boolean }
  | { tipo: "arena"; equipo: "A" | "B"; evento: EventoForja }
  /** Estudio (v3.0): el pipeline jerárquico del Director Creativo. */
  | {
      tipo: "estudio";
      fase: "director" | "maquetas" | "jueces" | "fusion" | "fallback" | "fin";
      detalle?: string;
      hecho?: number;
      total?: number;
      ok?: boolean;
    };

/** Modelo a usar para un rol: el configurado, o el activo del chat como
 * red de seguridad. Nunca lanza: FORJA IA funciona incluso sin ajustar. */
function modeloDeRol(cfg: ConfigForja, rol: RolForja, fallback: ModeloDeRol): ModeloDeRol {
  return cfg.porRol[rol] ?? fallback;
}

/** Fábrica de la llamadora central: unifica traza (rondas), progreso y
 * elección de modelo por rol. El `artefacto` se puede precisar (maqueta).
 *
 * v4.2 — cada llamada sale con: techo de salida resuelto de la config
 * (techoTokens), y AL VOLVER se somete al segundo cinturón anti-truncamiento
 * (continuacion-nucleo.ts): si la salida quedó estructuralmente rota y el
 * adaptador no pudo cerrarla, el núcleo la continúa con la MISMA llamada
 * (mismo modelo, rol, temperatura y techo) antes de gastar un Revisor o
 * una ronda entera de regeneración. */
function crearLlamadora(
  cfg: ConfigForja,
  deps: DependenciasForja,
  rondas: RondaForja[],
  fallback: ModeloDeRol
) {
  const temp = (rol: RolForja) =>
    cfg.temperaturaPorRol?.[rol] ?? EQUIPO_FORJA[rol].temperatura;
  return async (
    rol: RolForja,
    system: string,
    user: string,
    ronda: number,
    artefacto: ArtefactoForja =
      rol === "disenador" ? "ficha-diseno" : rol === "codificador" ? "codigo" : "veredicto"
  ): Promise<string> => {
    const modelo = modeloDeRol(cfg, rol, fallback);
    const clave = `${modelo.providerId}:${modelo.modelId}`;
    deps.onProgreso?.({ tipo: "rol-inicio", rol, ronda, modelo: clave });
    const t0 = Date.now();
    let salida = "";
    try {
      salida = await deps.llamarModelo({
        providerId: modelo.providerId,
        modelId: modelo.modelId,
        system,
        user,
        temperatura: temp(rol),
        onFragmento: (t) => deps.onProgreso?.({ tipo: "fragmento", rol, texto: t }),
        // v4.1: el rol viaja con la llamada — el adaptador-resiliente lo usa
        // para pedir el techo de salida correcto (16k+ en el Codificador)
        // y elegir la cadena de suplentes si el proveedor cae.
        rol,
        // v4.2: presupuesto de salida POR ROL desde la config — el
        // adaptador lo aplica al transporte tal cual.
        maxTokens: techoTokens(cfg, rol),
      });

      // v4.2 — SEGUNDO CINTURÓN: si la salida quedó estructuralmente rota
      // (cercados impares, <html> sin cerrar…) y el adaptador no pudo
      // cerrarla con su continuación por finish_reason, el núcleo la
      // cierra AQUÍ: ahorra el Revisor de una mediana página y la ronda
      // entera de regeneración (la llamada más cara del pipeline).
      const res = await continuarSalidaTruncada({
        salida,
        continuarCon: continuarConLlamada(deps.llamarModelo, {
          providerId: modelo.providerId,
          modelId: modelo.modelId,
          system,
          temperatura: temp(rol),
          rol,
          maxTokens: techoTokens(cfg, rol),
          onFragmento: (t) => deps.onProgreso?.({ tipo: "fragmento", rol, texto: t }),
        }),
        onContinuacion: (n) =>
          deps.onProgreso?.({ tipo: "continuacion-nucleo", rol, ronda, n }),
      });
      salida = res.texto;
    } finally {
      rondas.push({
        n: ronda,
        rol,
        artefacto,
        salida,
        modeloUsado: clave,
        duracionMs: Date.now() - t0,
      });
      deps.onProgreso?.({ tipo: "rol-fin", rol, ronda, ok: salida.length > 0 });
    }
    return salida;
  };
}

/** Compone el mensaje de usuario para el Diseñador. Exportado: el Estudio
 * (director.ts) reutiliza la misma forma de presentar la petición. */
export function mensajeDisenador(p: PeticionForja): string {
  return p.codigoActual
    ? `Proyecto existente que hay que rediseñar o ampliar (código actual entre marcadores):\n---CODIGO-ACTUAL---\n${p.codigoActual.slice(0, 8000)}\n---FIN---\n\nPetición del usuario: ${p.mensaje}`
    : `Petición del usuario: ${p.mensaje}`;
}

function mensajeCodificador(
  p: PeticionForja,
  ficha: string,
  defectos: string[] | null,
  adnSeccion: string
): string {
  const correccion = defectos
    ? `\n\n## Ronda de corrección\nEl Revisor rechazó la versión anterior por estos defectos CONCRETOS. Corrígelos TODOS sin rehacer lo que ya estaba bien:\n${defectos
        .map((d, i) => `${i + 1}. ${d}`)
        .join("\n")}`
    : "";
  return `# Ficha de diseño (cumple esto al detalle)\n${ficha}\n\n${adnSeccion}${correccion}\n\n# Petición original del usuario\n${p.mensaje}${
    p.codigoActual ? `\n\n# Código actual del proyecto (módulo a editar, no borrar)\n${p.codigoActual.slice(0, 12000)}` : ""
  }`;
}

function mensajeRevisor(
  p: PeticionForja,
  ficha: string,
  codigo: string,
  inspector: string,
  adnSeccion: string,
  antiGenerico: string
): string {
  const bloque = inspector ? `\n\n# ${inspector}` : "";
  return `# Petición del usuario\n${p.mensaje}\n\n# Ficha de diseño aprobada\n${ficha}\n\n${adnSeccion}\n\nAudita también contra las PROHIBICIONES del ADN: si el código incumple una, es un defecto.\n\n# Código a auditar\n${codigo.slice(0, 14000)}${bloque}${antiGenerico}`;
}

/** Preparación común: habilidades + reglas de memoria + reglas globales. */
function preparacion(peticion: PeticionForja, cfg: ConfigForja, deps: DependenciasForja) {
  const todasLasReglas = reglasParaPrompt(deps.memoria);
  const perfil = cfg.perfil ?? PERFIL_DEFECTO;
  const reglasGlobales = (peticion.conocimientoGlobal ?? []).slice(
    0,
    PERFILES[perfil].reglasGlobales
  );
  const sugeridas = new Set([
    ...cfg.habilidades,
    ...habilidadesSugeridas(peticion.mensaje),
  ]);
  return {
    bloques: bloquesDeHabilidades([...sugeridas]),
    reglasDiseno: todasLasReglas,
    reglasCalidad: todasLasReglas.filter(esReglaDeCalidad),
    reglasGlobales,
  };
}

/** ADN efectivo de esta petición: el que emitió el Diseñador (parseado de su
 * respuesta) o, si no lo emitió, el de respaldo anti-genérico. Nunca null. */
function adnEfectivo(fichaTexto: string, peticion: PeticionForja): AdnVisual {
  return sanearAdn(parseAdn(fichaTexto) ?? adnDesdePeticion(peticion.mensaje));
}

/** Ejecuta el pipeline completo. Es la función que el chat-client invoca
 * cuando el modelo seleccionado es FORJA IA.
 *
 * Si el resultado llega con estado «esperando-aprobacion», la UI debe:
 *   · mostrar `maqueta.html` en la vista previa y `respuesta` en el chat;
 *   · «Aprobado» → continuarForja(…)
 *   · «Ajusta: …» → ajustarMaquetaForja(…)
 *   · «Directo» → continuarForja(…) igualmente (la ficha guía al equipo). */
export async function ejecutarForja(
  peticion: PeticionForja,
  cfg: ConfigForja,
  deps: DependenciasForja,
  fallback: ModeloDeRol
): Promise<ResultadoForja> {
  const rondas: RondaForja[] = [];
  const llamada = crearLlamadora(cfg, deps, rondas, fallback);
  const { bloques, reglasDiseno, reglasGlobales } = preparacion(peticion, cfg, deps);
  const conMaqueta = debeMaquetar(peticion, cfg);

  // --- fase 1: Diseñador (ADN + ficha + direcciones/visiones) ----------
  // v4.2 — CACHÉ POR HASH: si esta petición (mensaje + código + reglas +
  // config, incluyendo VERSION_FORJA) ya se forjó, la ficha se reusa y la
  // llamada del Diseñador no se paga. Cambia una coma → hash nuevo → llamada.
  let fichaTexto: string;
  const cache = deps.cache;
  const claveCache = cache ? claveFicha(peticion, cfg) : "";
  const cacheada = claveCache && cache ? (cache.obtener(claveCache) ?? null) : null;
  if (cacheada) {
    deps.onProgreso?.({ tipo: "cache", que: "ficha" });
    fichaTexto = cacheada;
  } else {
    fichaTexto = await llamada(
      "disenador",
      promptDisenador(
        bloques,
        reglasDiseno,
        reglasGlobales,
        conMaqueta,
        false,
        seccionRepresentacion(peticion.mensaje)
      ),
      mensajeDisenador(peticion),
      1
    );
    // solo se cachea una ficha con sustancia: ni vacías ni errores de cuota
    if (claveCache && cache && fichaTexto.trim().length > 80) {
      cache.guardar(claveCache, fichaTexto);
    }
  }
  const adn = adnEfectivo(fichaTexto, peticion);

  // --- fase 2 (opcional): propuesta visual y PAUSA para aprobación -----
  if (conMaqueta) {
    deps.onProgreso?.({ tipo: "maqueta", fase: "inicio" });
    const depsMaqueta: DependenciasMaqueta = {
      llamarModelo: deps.llamarModelo,
      fallback,
      cfg,
      cache: deps.cache, // v4.2: la maqueta inicial también se cachea
    };
    const propuesta = await construirPropuesta(peticion, fichaTexto, depsMaqueta, async (rol, system, user, ronda) =>
      llamada(rol, system, user, ronda, "maqueta")
    );
    deps.onProgreso?.({ tipo: "maqueta", fase: "fin", ok: propuesta.html.length > 0 });
    deps.onProgreso?.({ tipo: "fin", agotado: false });
    return {
      estado: "esperando-aprobacion",
      codigo: "",
      respuesta: respuestaDePropuesta(propuesta),
      ficha: fichaFDesdeTexto(fichaTexto),
      fichaTexto,
      maqueta: propuesta,
      rondas,
      veredicto: null,
      agotado: false,
      adn,
    };
  }

  // --- sin maqueta: bucle de código directo ----------------------------
  return continuarForja(peticion, fichaTexto, cfg, deps, fallback, adn);
}

/** Continúa (o empieza) la producción de código con la ficha como contrato.
 * Es el paso que la UI llama cuando el usuario APRUEBA la maqueta, y el que
 * ejecuta el núcleo directamente cuando no hubo fase de maqueta. */
export async function continuarForja(
  peticion: PeticionForja,
  fichaTexto: string,
  cfg: ConfigForja,
  deps: DependenciasForja,
  fallback: ModeloDeRol,
  adnPrecomputado?: AdnVisual
): Promise<ResultadoForja> {
  const rondas: RondaForja[] = [];
  const llamada = crearLlamadora(cfg, deps, rondas, fallback);
  const { reglasCalidad } = preparacion(peticion, cfg, deps);
  const maxRondas = rondasDePerfil(cfg);
  const adn = adnPrecomputado ?? adnEfectivo(fichaTexto, peticion);
  const adnSeccion = seccionAdn(adn);

  // --- bucle Codificador → Inspector → Revisor --------------------------
  let codigo = "";
  let veredicto = parseVeredicto("");
  let codificadorTexto = "";
  let hallazgosFinales: HallazgoVision[] = [];

  for (let ronda = 1; ronda <= maxRondas; ronda++) {
    codificadorTexto = await llamada(
      "codificador",
      promptCodificador(reglasCalidad),
      mensajeCodificador(peticion, fichaTexto, ronda > 1 ? veredicto.defectos : null, adnSeccion),
      ronda
    );
    codigo = extraerCodigo(codificadorTexto);

    // Inspector visual (v2.3): chequeo estático GRATIS en cada ronda. Sus
    // hallazgos viajan al Revisor, que confirma o descarta con contexto.
    const hallazgos = chequeosEstaticos(codigo);
    hallazgosFinales = hallazgos;
    deps.onProgreso?.({
      tipo: "vision",
      ronda,
      total: hallazgos.length,
      criticos: hallazgos.filter((h) => h.severidad === "critico").length,
    });

    const informe = detectarGenericidad(codigo);

    const revisorTexto = await llamada(
      "revisor",
      promptRevisor(),
      mensajeRevisor(
        peticion,
        fichaTexto,
        codigo,
        informeInspector(hallazgos),
        adnSeccion,
        informeAntiGenericoParaRevisor(informe)
      ),
      ronda
    );
    veredicto = parseVeredicto(revisorTexto);

    if (veredicto.aprobado) break;
    if (ronda < maxRondas) {
      deps.onProgreso?.({ tipo: "bucle", ronda, defectos: veredicto.defectos });
    }
  }

  const agotado = !veredicto.aprobado;
  const informeFinal = detectarGenericidad(codigo);

  // --- aprendizaje (solo éxitos; los fracasos no enseñan bien todavía) --
  if (!agotado) {
    const decisiones = extraerDecisiones(codificadorTexto);
    if (decisiones.length) {
      const nueva = aprenderDeExito(deps.memoria, decisiones);
      deps.onMemoriaNueva?.(nueva);
    }
  }

  deps.onProgreso?.({ tipo: "fin", agotado });

  const respuesta = construirRespuesta({
    peticion,
    fichaTexto,
    veredicto,
    rondas,
    agotado,
    maxRondas,
    hallazgos: hallazgosFinales,
    adn,
    informe: informeFinal,
  });

  return {
    estado: "completo",
    codigo,
    respuesta,
    ficha: fichaFDesdeTexto(fichaTexto),
    fichaTexto,
    maqueta: null,
    rondas,
    veredicto,
    agotado,
    vision: hallazgosFinales,
    adn,
    genericidad: informeFinal,
  };
}

/** Aplica feedback del usuario a la maqueta (ajuste o cambio de dirección).
 * Devuelve de nuevo «esperando-aprobacion» con la propuesta actualizada. */
export async function ajustarMaquetaForja(
  peticion: PeticionForja,
  fichaTexto: string,
  propuesta: PropuestaMaqueta,
  feedback: string,
  cfg: ConfigForja,
  deps: DependenciasForja,
  fallback: ModeloDeRol
): Promise<ResultadoForja> {
  const rondas: RondaForja[] = [];
  const llamada = crearLlamadora(cfg, deps, rondas, fallback);
  const depsMaqueta: DependenciasMaqueta = {
    llamarModelo: deps.llamarModelo,
    fallback,
    cfg,
    cache: deps.cache, // v4.2: los ajustes de maqueta NO se cachean, pero la
    // clave queda lista por si DependenciasMaqueta la reusa en el futuro
  };
  const nueva = await ajustarPropuesta(peticion, fichaTexto, propuesta, feedback, depsMaqueta, async (rol, system, user, ronda) =>
    llamada(rol, system, user, ronda, "maqueta")
  );
  deps.onProgreso?.({ tipo: "fin", agotado: false });
  return {
    estado: "esperando-aprobacion",
    codigo: "",
    respuesta: respuestaDePropuesta(nueva),
    ficha: fichaFDesdeTexto(fichaTexto),
    fichaTexto,
    maqueta: nueva,
    rondas,
    veredicto: null,
    agotado: false,
    adn: adnEfectivo(fichaTexto, peticion),
  };
}

/** Bloque ---INFORME ANTI-GENÉRICO--- para el mensaje del Revisor: solo si
 * hay algo que mirar (con HTML vacío el informe sería ruido). */
function informeAntiGenericoParaRevisor(informe: ReturnType<typeof detectarGenericidad>): string {
  if (informe.sintomas.length === 0) return "";
  return `\n\n---INFORME ANTI-GENÉRICO---\n${resumenAntiGenerico(informe)}\n${informe.sintomas
    .map((s) => `- ${s.nombre}: ${s.motivo}. ALTERNATIVA: ${s.alternativa}`)
    .join("\n")}\n---FIN INFORME---`;
}

/** Texto final que la UI muestra como respuesta del «modelo» FORJA IA. */
function construirRespuesta(ctx: {
  peticion: PeticionForja;
  fichaTexto: string;
  veredicto: ReturnType<typeof parseVeredicto>;
  rondas: RondaForja[];
  agotado: boolean;
  maxRondas: number;
  hallazgos: HallazgoVision[];
  adn: AdnVisual;
  informe: ReturnType<typeof detectarGenericidad>;
}): string {
  const { fichaTexto, veredicto, rondas, agotado, maxRondas, hallazgos, adn, informe } = ctx;
  const rondasCodigo = rondas.filter((r) => r.rol === "codificador" && r.artefacto === "codigo").length;
  const participacion = ORDEN_PIPELINE.map((rol) => {
    const usos = rondas.filter((r) => r.rol === rol && r.artefacto !== "maqueta").length;
    const nombre = EQUIPO_FORJA[rol].nombre;
    return `- **${nombre}** (${usos} pasada${usos === 1 ? "" : "s"}): ${EQUIPO_FORJA[rol].resumen}`;
  }).join("\n");

  const estado = agotado
    ? `El Revisor siguió encontrando defectos tras ${maxRondas} rondas, así que recibes la mejor versión alcanzada junto a los puntos pendientes.`
    : `El Revisor aprobó la entrega tras ${rondasCodigo} ronda${rondasCodigo === 1 ? "" : "s"} de código.`;

  const defectos = agotado && veredicto.defectos.length
    ? `\n\n**Pendientes que el Revisor señala:**\n${veredicto.defectos.map((d) => `- ${d}`).join("\n")}`
    : "";

  const vision = seccionVision(hallazgos);
  const seccionAdnTexto = `\n\n### ADN visual del proyecto\n${textoAdn(adn)}`;
  const seccionAnti = `\n\n### Anti-genérico\n${textoInformeAntiGenerico(informe)}`;

  return `## Entrega de FORJA IA

${estado}

### Cómo trabajó el equipo
${participacion}

### Decisiones de diseño
${resumenFicha(fichaTexto)}${seccionAdnTexto}${vision}${seccionAnti}${defectos}

¿Quieres que ajuste algo? Puedo cambiar una sección concreta, aplicar otra paleta o convertir el proyecto a React.`;
}

/** Sección «Inspector visual» de la respuesta final: los hallazgos que el
 * Revisor evaluó en la última ronda (y que la UI repite en su pestaña). */
function seccionVision(hallazgos: HallazgoVision[]): string {
  if (hallazgos.length === 0) {
    return "\n\n### Inspector visual\nSin hallazgos: viewport, alt, etiquetas, jerarquía y contraste básicos, correctos.";
  }
  const criticos = hallazgos.filter((h) => h.severidad === "critico").length;
  const lista = hallazgos
    .slice(0, 6)
    .map((h) => `- **[${h.severidad}]** ${h.titulo}`)
    .join("\n");
  const resto = hallazgos.length > 6 ? `\n- …y ${hallazgos.length - 6} hallazgo(s) más en la pestaña Inspector.` : "";
  return `\n\n### Inspector visual\n${criticos > 0 ? `⚠ ${criticos} hallazgo(s) crítico(s) — el Revisor los tuvo en cuenta.\n\n` : ""}${lista}${resto}`;
}

function resumenFicha(fichaTexto: string): string {
  const lineas = fichaTexto
    .split(/\n/)
    .filter((l) => /^(Tipo de web|Público|Mensaje principal):/i.test(l.trim()))
    .map((l) => `- ${l.trim()}`);
  return lineas.length ? lineas.join("\n") : "- Ver ficha completa arriba.";
}

/** Parse ligero de la ficha para tipar el resultado (la ficha en TEXTO sigue
 * siendo la fuente de verdad entre roles; esto es solo para la UI). */
function fichaFDesdeTexto(texto: string): FichaDiseno {
  const campo = (nombre: string): string => {
    const m = texto.match(new RegExp(`${nombre}:\\s*(.+)`, "i"));
    return m ? m[1].trim() : "";
  };
  const lista = (encabezado: string): string[] => {
    const m = texto.match(
      new RegExp(`## ${encabezado}[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`, "i")
    );
    if (!m) return [];
    return m[1]
      .split(/\n/)
      .map((l) => l.trim().replace(/^\d+\.\s*/, "").replace(/^[-*]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 12);
  };
  return {
    tipoWeb: campo("Tipo de web"),
    publico: campo("Público"),
    mensajePrincipal: campo("Mensaje principal"),
    paleta: lista("Paleta").join(" · "),
    tipografia: lista("Tipografía").join(" · "),
    estructura: lista("Estructura"),
    interaccion: lista("Interacción"),
    restricciones: lista("Restricciones"),
  };
}
