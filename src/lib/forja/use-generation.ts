"use client";
/** Forja IA — La tubería de generación: lo que convierte un envío en respuesta.
 *
 * Tercer corte de `chat-app.tsx` (PLAN-V8 punto 1) y el grande: aquí vive
 * `runGeneration` (la cadena de candidatos, el failover con rescate de trabajo
 * a medias, la continuación de código cortado, el bucle del agente vía
 * `useAgentTools`, el checkpoint automático, la memoria de tareas), y con él
 * sus dos variantes de reparto (`runConsensus`, `runOrquesta`), el failover,
 * el relanzador y la generación de imágenes.
 *
 * Por qué un solo hook y no varios: los tres caminos COMPARTEN la misma
 * burbuja en curso (`streamingMsgId`), el mismo `AbortController` y el mismo
 * `runGenRef` para los reintentos. Partirlos sería re-crear el acoplamiento
 * que hoy está a la vista.
 *
 * Lo que NO vive aquí: todo lo que toca la pantalla (compositor, sugerencias,
 * modal de reglas, diálogos). Eso se queda en `chat-app.tsx` y entra por
 * `CtxGeneracion`. El hook lee el estado del store FRESCO (`useForja.getState()`)
 * dentro de cada corrida — igual que hacía el componente, que es lo que permite
 * que un failover que cambió el modelo en el store siga usándolo.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useForja, uid } from "./store";
import {
  splitModelKey,
  makeModelKey,
  isAutoKey,
  isForjaWebKey,
  type ProviderId,
} from "./types";
import { PROVIDER_MAP } from "./providers";
import { streamChat } from "./chat-client";
import { esSoloFiltroSeguridad, isFreeModel, isQuotaError, pickFailoverCandidate, sanearOrdenFallback } from "./free-models";
import {
  guardarLibro,
  iniciarTarea,
  leerLibro,
  normalizarLimites,
  resumenPresupuesto,
  veredictoDinero,
} from "./presupuesto-dinero";
import {
  buildTaskChain,
  classifyTask,
  lastUserPrompt,
  pickTaskFailover,
} from "./task-router";
import {
  useHealth,
  cooldownRemaining,
  providerCooldownRemaining,
  statusFromError,
  retryAfterFromError,
} from "./health";
import { useUsage } from "./usage";
import { estaRoto, useModelosRotos } from "./modelos-rotos";
import { cabe, useLimites } from "./limites-medidos";
import { avisoNoCabeNiRecortando, avisoRecorte, recortar, tokensDe } from "./recorte-contexto";
import { calcularHud, ventanaReferencia } from "./ctx-hud";
import type { FichaRespuesta, IntentoFallido } from "./ficha-respuesta";
import { costeDeModelo, PRECIOS_FECHA } from "./precios";
import {
  mereceResumen,
  notaDeResumen,
  promptDeResumen,
  resumenUtil,
  textoDelTramo,
} from "./resumen-recorte";
import { permitido } from "./vetados";
import {
  avisoPrevio,
  promptDeReparto,
  parseReparto,
  promptDeEjecutor,
  promptDeVeredicto,
  estadoOrquesta,
  repartoFallido,
  EJECUTORES_POR_DEFECTO,
  type Resultado,
} from "./orquesta";
import {
  estadoPanel,
  necesitaSintesis,
  pickPanel,
  pickSintetizador,
  synthesisPrompt,
  type Panelista,
  type RespuestaPanel,
} from "./consensus";
import type { EntradaPrompt } from "./presupuesto";
import { construirPrompt } from "./presupuesto";
import { estaCortadaPorLongitud, type MotivoParada } from "./finish-reason";
import {
  avisoIntentosAgotados as avisoBotonesAgotados,
  hayBotonesQueCorregir,
  promptDeBotones,
  reglaDeBotones,
  resumenBotones,
} from "./prueba-botones";
import {
  avisoIntentosAgotados as avisoRevisionAgotada,
  hayQueCorregir,
  promptDeCorreccion,
  proyectoDeLaRespuesta,
  quedanIntentos,
  reglaDeFallo,
  resumenRevision,
  MAX_REVISIONES,
} from "./auto-revision";
import { runProjectInMemory } from "./sandbox-runner";
import {
  avisoIntentosAgotados as avisoGenericoAgotado,
  MEDIDAS_VACIAS,
  promptDeGenerico,
  reglaDeGenerico,
  resumenGenerico,
  senasGenericas,
} from "./generico";
import { senasEfectosFueraDeDireccion } from "./efectos";
import { idPorNombre, senasComposicionFueraDeDireccion } from "./design-directions";
import {
  decidirTrasCuotaEnTexto,
  decidirTrasError,
  esDemasiadoGrande,
  esModeloMuerto,
  esPeticionInvalida,
  esLimiteLocal,
  limiteDelMensaje,
  decidirTrasVacio,
  motivoDelFallo,
  tituloFailover,
  tituloSinAlternativa,
  type MotivoFailover,
} from "./decisiones";
import {
  continuarCodigoPrompt,
  respuestaCortada,
  unirContinuacion,
  type CorteInfo,
} from "./continuar";
import { agentStalled, continuePrompt, parseAgentTrace } from "./agent-loop";
import { separarEtiquetasPensamiento } from "./razonamiento";
import { buildImageUrl, preloadImage } from "./images";
import { speak } from "./speech";
import { escudoHistorial, PII_LABELS } from "./pii";
import { soloAdjuntosDelTurno } from "./adjuntos-historial";
import { esTurnoTrivial } from "./turno-trivial";
import { useFailures } from "./failures";
import { compressHistory, savingsPercent, type CompressionMode } from "./compress";
import { podarVersionesSuperadas } from "./versiones-superadas";
import { archivosRelevantes, archivosVigentes, podarIrrelevantes } from "./grafo-proyecto";
import {
  aplicarRetoque,
  archivosRecortados,
  bloqueResultado,
  neutralizarRecortados,
  pedirArchivoCompleto,
  pedirSinOmitir,
  usaParches,
} from "./retoque-parche";
import { bloquesConNombre } from "./answer-files";
import { hallazgosQA, hayQueCorregirQA, promptDeQA, resumenQA } from "./qa-responsive";
import { reglaDeQA } from "./visual-qa";
import { nivelDeContexto } from "./nivel-contexto";
import { ordenarParaVision, useCapacidades } from "./capacidades";
import { esFalloDeImagen } from "./model-probe";
import { modoEfectivo, sumarUso, type UsoProveedor } from "./cache-prompt";
import { CONTEXTO_VACIO, hayContexto, type ContextoUsado } from "./contexto-usado";
import { checkpointAuto } from "./snapshots";
import {
  leerMemoria,
  guardarMemoria,
  addTarea as addTareaMemoria,
  addDecision as addDecisionMemoria,
  addDiseno as addDisenoMemoria,
} from "./memoria-proyecto";
import { useAgentTools } from "./use-agent-tools";
import { normalizarPermisos } from "./tool-permissions";
import type { AjustesGenerados } from "./use-system-prompt";
import type { SandboxSeed } from "./sandbox";
import { textoParaModelo } from "./senalar";
import { resumenRevisionDetalle, revisionDeDetalle } from "./motor-chat";


/** Cuántas veces puede saltar de modelo una MISMA respuesta.
 * Antes el salto se contaba siempre como el primero y los guardas de
 * `depth === 0` bloqueaban el segundo: bastaba con que el modelo de repuesto
 * también fallara —lo normal entre los gratis— para que todo se parara. */
const MAX_SALTOS = 4;

/** Cuántas veces se retoma SOLO un trabajo del agente que se quedó a medias.
 * Con tope, porque un modelo que no sabe cerrar el bucle seguiría dando
 * vueltas y gastando cuota. Agotado el tope queda el botón «Continuar». */
const MAX_CONTINUACIONES = 2;

/** Cuántas veces se pide la continuación de un código cortado por longitud.
 * Una web entera puede necesitar dos o tres trozos; más que eso ya es un
 * modelo con el techo de salida demasiado bajo para la tarea. */
const MAX_TROZOS = 3;

/** Lo que un modelo caído le pasa al que lo sustituye.
 *
 * `attemptFailover` borraba la respuesta a medias y el modelo nuevo empezaba
 * de cero. Con esto la recoge y sigue desde donde se quedó, en la MISMA
 * burbuja — que es lo que hace que el bloque de código no acabe partido. */
export interface SemillaFailover {
  /** la burbuja que se conserva, en vez de crear otra */
  assistantId: string;
  /** lo que llegó a escribir el modelo caído */
  previo: string;
  /** dónde se quedó, para pedir el empalme exacto */
  corte: CorteInfo;
}

/** Caracteres mínimos para que valga la pena rescatar un trabajo a medias.
 * Por debajo de esto (un saludo, media frase) reiniciar sale más limpio que
 * empalmar. */
const MIN_RESCATE = 200;

/** Cómo se llama cada forma de quedarse a medias en la memoria de fallos. */
const MOTIVO_PARADA: Record<string, string> = {
  "revision-pendiente": "revisión sin corregir",
  "sin-respuesta": "sin cerrar <answer>",
  cortado: "respuesta cortada a mitad de una etiqueta",
};

/** Lo que el hook necesita del componente y no puede conseguirse solo:
 * piezas que tocan la pantalla (avisos con botón, Sandbox abierto, refs cuyo
 * dueño es el marco). Todo lo demás se lo sirve el store. */
export interface CtxGeneracion {
  composeSettings: (sessionId?: string, opts?: { sinPlano?: boolean }) => AjustesGenerados;
  piezasDelPrompt: (sessionId?: string) => EntradaPrompt;
  updateProjectMap: (sessionId: string, content: string) => void;
  /** seed del Sandbox abierto: checkpoint y continuación lo leen FRESCO de ctx
   * (antes quedaba clavado en la clausura del useCallback y podía ser viejo) */
  sandboxInitial: SandboxSeed | null;
  stickToBottomRef: { current: boolean };
  aplicarArchivosAgenteRef: { current: (files: Record<string, string>) => void };
  reglasAutorizadasRef: { current: string[] };
  undoMapRef: { current: Record<string, string> };
  forzarUndoRender: (update: (n: number) => number) => void;
  setRadarOpen: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  setFocusProvider: (p: ProviderId | null) => void;
  /** tamaño del borrador al contar el contexto usado (se cuenta lo ENVIADO) */
  numDocs: number;
  numAdjuntos: number;
}

export function useGeneration(ctx: CtxGeneracion) {
  const {
    composeSettings,
    piezasDelPrompt,
    updateProjectMap,
    sandboxInitial,
    stickToBottomRef,
    aplicarArchivosAgenteRef,
    reglasAutorizadasRef,
    undoMapRef,
    forzarUndoRender,
    setRadarOpen,
    setSettingsOpen,
    setFocusProvider,
    numDocs,
    numAdjuntos,
  } = ctx;

  // mismo derivado que hacía el componente: clave del modelo en curso
  const sessions = useForja((s) => s.sessions);
  const activeId = useForja((s) => s.activeSessionId);
  const settings = useForja((s) => s.settings);
  const providers = useForja((s) => s.providers);
  const ensureSession = useForja((s) => s.ensureSession);
  const addMessage = useForja((s) => s.addMessage);
  const updateMessage = useForja((s) => s.updateMessage);
  const deleteMessage = useForja((s) => s.deleteMessage);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId]
  );
  const modelKey = activeSession?.modelKey ?? settings.defaultModelKey;

  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Bucle de tools del agente (PLAN-V4 punto 5): el probe + el bucle de
  // tool_calls + la reinyección, encapsulados. runGeneration lo llama igual
  // que lo hacía el componente.
  const { runWithTools } = useAgentTools();
  /** Los modelos que fallaron en ESTE turno, vivan donde vivan.
   *
   * Va en un ref y no en una variable del bucle porque un failover de
   * proveedor no es una vuelta más del bucle: borra la burbuja y **vuelve a
   * llamar** a `runGeneration` con otra cadena. Con la lista dentro, el
   * expediente de la respuesta buena decía «respondió el primero» justo cuando
   * habían fallado tres. Se vacía solo al empezar un turno nuevo de verdad. */
  const intentosRef = useRef<IntentoFallido[]>([]);
  /** referencia fresca a runGeneration para reintentos de failover (evita dependencia circular) */
  const runGenRef = useRef<
    | ((
        sessionId: string,
        depth?: number,
        continuaciones?: number,
        semilla?: SemillaFailover,
        revisiones?: number
      ) => Promise<void>)
    | null
  >(null);

  const setModelKey = useCallback((key: string | null) => {
    const state = useForja.getState();
    const current =
      (state.activeSessionId
        ? state.sessions.find((s) => s.id === state.activeSessionId)?.modelKey
        : undefined) ?? state.settings.defaultModelKey;
    const patch: { defaultModelKey: string | null; lastManualModelKey?: string | null } = {
      defaultModelKey: key,
    };
    if ((isAutoKey(key) || isForjaWebKey(key)) && current && !isAutoKey(current) && !isForjaWebKey(current)) {
      patch.lastManualModelKey = current;
    }
    if (state.activeSessionId) {
      const sid = state.activeSessionId;
      useForja.setState((st) => ({
        sessions: st.sessions.map((x) => (x.id === sid ? { ...x, modelKey: key } : x)),
      }));
    }
    state.setSettings(patch);
  }, []);

  /** Resuelve y valida el modelo actual (acepta clave fresca del store para reintentos) */
  const resolveModel = useCallback(
    (keyOverride?: string): {
      providerId: ProviderId;
      modelId: string;
    } | null => {
      const key = keyOverride ?? modelKey;
      if (!key) return null;
      const split = splitModelKey(key);
      if (!split) return null;
      const cfg = providers[split.providerId];
      const def = PROVIDER_MAP[split.providerId];
      if (!cfg || !def) return null;
      if (!cfg.apiKey.trim() && !def.keyless) {
        toast.error(`${def.name} necesita tu API key`, {
          description: "Ábrela en Ajustes → Proveedores.",
          action: {
            label: "Abrir",
            onClick: () => {
              setFocusProvider(split.providerId);
              setSettingsOpen(true);
            },
          },
        });
        return null;
      }
      return split;
    },
    [modelKey, providers, setFocusProvider, setSettingsOpen]
  );

  /** Arranca otra generación DESPUÉS de que la actual termine de recogerse.
   *
   * Lanzarla en el acto no valía: `runGeneration` marca el mensaje en curso de
   * forma síncrona y el `finally` del intento que acaba de fallar lo borraba
   * justo después, dejando la respuesta nueva sin indicador de escritura. Un
   * `setTimeout` la deja empezar cuando ese `finally` ya pasó. */
  const relanzar = useCallback(
    (
      sessionId: string,
      depth: number,
      continuaciones: number,
      semilla?: SemillaFailover,
      revisiones?: number
    ) => {
      setTimeout(() => {
        void runGenRef.current?.(sessionId, depth, continuaciones, semilla, revisiones);
      }, 0);
    },
    []
  );

  /** Failover gratis: si un proveedor agotó su cuota, reintenta con el siguiente
   * modelo más acorde a la tarea. Los que están en cooldown se saltan. */
  const attemptFailover = useCallback(
    (
      sessionId: string,
      failedProviderId: ProviderId,
      failedAssistantId: string,
      depth = 0,
      continuaciones = 0,
      /** lo que llegó a escribir el modelo caído: la burbuja ya no lo tiene,
       *  porque la rama de error la sobrescribe con el mensaje del fallo */
      parcial = "",
      /** por qué se salta: el aviso decía siempre «cuota gratis agotada»,
       *  también con un 503 del proveedor y con una clave de pago */
      motivo: MotivoFailover = "otro"
    ) => {
      const st = useForja.getState();
      const session = st.sessions.find((s) => s.id === sessionId);
      const task = classifyTask(lastUserPrompt(session?.messages ?? []));
      const rotos = useModelosRotos.getState().rotos;
      const limites = useLimites.getState().limites;
      const ahora = Date.now();
      // Tamaño del turno, con la misma regla del medidor de contexto
      // (caracteres ÷ 4). Aproximado y dicho: sirve para descartar lo que
      // seguro no cabe, no para prometer que lo demás sí.
      const tokensDelTurno = Math.round(
        (session?.messages ?? []).reduce((a, m) => a + m.content.length, 0) / 4
      );
      const vetados = st.settings.proveedoresVetados ?? [];
      const blocked = (pid: ProviderId, mid: string) => {
        const h = useHealth.getState();
        // Un proveedor vetado no recibe NADA, y el failover es el camino donde
        // más fácil se colaría: se salta solo, sin que nadie lo elija.
        if (!permitido(pid, vetados)) return true;
        // saltar a un modelo que ya sabemos que el proveedor no reconoce es
        // cambiar un error por otro
        if (estaRoto(rotos, makeModelKey(pid, mid))) return true;
        // Ni a uno que ya demostró que esta conversación no le cabe. Saltar a
        // él sería cambiar un error por el mismo error.
        if (!cabe(limites, makeModelKey(pid, mid), tokensDelTurno, ahora)) return true;
        // cuota a dos niveles: el modelo enfriado Y el proveedor entero (429/402)
        if (cooldownRemaining(h.entries[makeModelKey(pid, mid)]) > 0) return true;
        return providerCooldownRemaining(h.providerEntries[pid]) > 0;
      };
      const candidate =
        pickTaskFailover(task.kind, st.providers, failedProviderId, blocked) ??
        // el orden del usuario decide la preferencia global; se sanea AL LEERLO
        // para que un orden guardado hace versiones no deje fuera a nadie
        pickFailoverCandidate(
          st.providers,
          failedProviderId,
          blocked,
          sanearOrdenFallback(st.fallbackOrder)
        );
      const failedName = PROVIDER_MAP[failedProviderId]?.name ?? failedProviderId;
      if (!candidate) {
        toast.error(tituloSinAlternativa(motivo, failedName), {
          description: "No hay otro proveedor conectado. Conecta Gemini, Groq u OpenRouter (gratis) en Ajustes, o prueba el modelo Auto.",
          action: { label: "Ver radar", onClick: () => setRadarOpen(true) },
          duration: 12000,
        });
        return;
      }
      const targetName = PROVIDER_MAP[candidate.providerId]?.name ?? candidate.providerId;
      const corte = parcial.trim().length >= MIN_RESCATE ? respuestaCortada(parcial) : null;
      const seguira = !!corte?.cortada;
      toast.warning(tituloFailover(motivo, failedName), {
        description: seguira
          ? `${candidate.modelId} · ${targetName} sigue desde donde se quedó. El modelo quedó cambiado.`
          : `Reintentando automáticamente con ${candidate.modelId} · ${targetName}. El modelo quedó cambiado.`,
        duration: 10000,
      });
      // ¿Había trabajo hecho que merezca la pena conservar?
      //
      // Hasta ahora esto era `deleteMessage` a secas: el modelo nuevo
      // empezaba de cero y los minutos que llevaba escritos el anterior se
      // tiraban. Cambiaba de modelo, sí; *seguir con la tarea*, no. Con
      // modelos gratis lentos eso son minutos perdidos en cada salto.
      const semilla: SemillaFailover | undefined = corte?.cortada
        ? { assistantId: failedAssistantId, previo: parcial, corte }
        : undefined;

      if (semilla) {
        // se conserva la burbuja y se le devuelve lo escrito: el modelo nuevo
        // escribe A CONTINUACIÓN. Si se creara otra, el bloque de código
        // quedaría partido en dos y la vista previa se quedaría sin documento.
        updateMessage(sessionId, failedAssistantId, { content: parcial, error: false });
      } else {
        deleteMessage(sessionId, failedAssistantId);
      }
      setModelKey(makeModelKey(candidate.providerId, candidate.modelId));
      // `depth + 1`, no `1` fijo: el salto se contaba siempre como el primero,
      // así que los guardas de `depth === 0` cerraban la puerta al segundo. Si
      // el sustituto también fallaba, el trabajo se quedaba ahí parado.
      relanzar(sessionId, depth + 1, continuaciones, semilla);
    },
    [deleteMessage, updateMessage, setModelKey, relanzar, setRadarOpen]
  );

  const runGeneration = useCallback(
    async (
      sessionId: string,
      depth = 0,
      continuaciones = 0,
      semilla?: SemillaFailover,
      revisiones = 0
    ) => {
      const state = useForja.getState();
      const session = state.sessions.find((s) => s.id === sessionId);
      if (!session) return;

      // Turno nuevo de verdad (ni failover, ni continuación, ni revisión):
      // el expediente empieza en blanco.
      if (depth === 0 && continuaciones === 0 && revisiones === 0) {
        intentosRef.current = [];
        // …y el contador de gasto POR TAREA también (presupuesto-dinero.ts)
        guardarLibro(iniciarTarea(leerLibro(), `${sessionId}:${Date.now()}`));
      }

      // clave fresca del store (importante tras un failover que cambió el modelo)
      const freshKey = session.modelKey ?? state.settings.defaultModelKey ?? undefined;
      const auto = isAutoKey(freshKey);
      // FORJA WEB siempre trata el encargo como «web»: es el preset para
      // construir sitios, así que no hace falta adivinarlo del texto (y un
      // «arréglalo» de seguimiento no debe caer a «chat» y perder el encaje
      // de proveedor pensado para web).
      const forjaWeb = isForjaWebKey(freshKey);
      const task = forjaWeb
        ? ({ kind: "web", label: "sistema completo" } as const)
        : classifyTask(lastUserPrompt(session.messages));

      // Imágenes del turno, leídas del mensaje enviado (el borrador ya está
      // vacío a estas alturas): deciden si hace falta un modelo que vea.
      const imagenesTurno =
        [...session.messages].reverse().find((m) => m.role === "user")?.attachments?.length ?? 0;

      // ——— cadena de candidatos ———
      type Candidate = { providerId: ProviderId; modelId: string };
      let chain: Candidate[] = [];
      // Presupuesto en dinero agotado (mensual, diario o de esta tarea):
      // FORJA pasa a SOLO GRATIS. Los de pago salen de la cadena aquí, antes
      // de gastar un intento en ellos; `streamChat` los cortaría igualmente.
      const presupuesto = veredictoDinero(
        leerLibro(),
        normalizarLimites(state.settings.presupuestoUsd),
        Date.now()
      );
      const sinPresupuesto = !presupuesto.ok;
      const health = useHealth.getState();
      // el bloqueo mira modelo Y proveedor: si la cuota del proveedor está agotada,
      // no se dan tumbos entre sus modelos — se salta directo al siguiente proveedor
      // …y un modelo que «Probar modelos» confirmó que el proveedor no
      // reconoce no entra en la cadena: Auto lo elegía igual y fallaba en el
      // primer intento, gastando un salto para nada.
      const rotos = useModelosRotos.getState().rotos;
      const bloqueado = (pid: ProviderId, mid: string) =>
        (sinPresupuesto && !isFreeModel(pid, mid)) ||
        estaRoto(rotos, makeModelKey(pid, mid)) ||
        cooldownRemaining(health.entries[makeModelKey(pid, mid)]) > 0 ||
        providerCooldownRemaining(health.providerEntries[pid]) > 0;
      if (auto || forjaWeb) {
        chain = buildTaskChain(
          task.kind,
          state.providers,
          bloqueado,
          6,
          health.lastGood?.key ?? null,
          // Lo medido de verdad en este dispositivo. Hasta ahora Auto no
          // aprendía: recordaba el último acierto y nada más.
          useUsage.getState().byModel
        );
        // Con imágenes en el turno, primero los que ven (capacidades.ts): los
        // que ya dijeron «no admito imágenes» salen, los que lo parecen suben.
        if (imagenesTurno > 0) chain = ordenarParaVision(chain, useCapacidades.getState().sinVision);
        if (chain.length === 0) {
          toast.error(`${forjaWeb ? "FORJA WEB" : "Auto"} no tiene modelos disponibles`, {
            description: "Conecta al menos un proveedor gratis (Gemini, Groq, OpenRouter…) en Ajustes.",
            action: { label: "Abrir", onClick: () => { setFocusProvider("gemini"); setSettingsOpen(true); } },
          });
          return;
        }
        if (depth === 0) {
          toast.message(`${forjaWeb ? "FORJA WEB" : "Auto"} · ${task.label}`, {
            // FORJA WEB no nombra al proveedor real (Kimi, Groq, Gemini…): de
            // cara al usuario, quien responde es Forja IA. Auto sí lo dice —
            // ahí la transparencia es justo lo que se pidió al construirlo.
            description: forjaWeb
              ? "Forja IA: Research en tu Knowledge Base, diseño, código y QA en un solo bucle."
              : `${chain[0].modelId} · ${PROVIDER_MAP[chain[0].providerId]?.name ?? chain[0].providerId}. Si se acaba la cuota, pasa al siguiente.`,
            duration: 4500,
          });
        }
      } else {
        const resolved = resolveModel(freshKey);
        if (!resolved) return;
        chain = [resolved];
        // El modelo elegido a mano es de pago y no queda presupuesto: en vez
        // de un error seco, responde el mejor gratis para este encargo.
        if (sinPresupuesto && !isFreeModel(resolved.providerId, resolved.modelId)) {
          const gratis = buildTaskChain(task.kind, state.providers, bloqueado, 6, null, useUsage.getState().byModel);
          if (gratis.length) {
            chain = gratis;
            if (depth === 0) {
              toast.warning("Presupuesto alcanzado: responde un modelo gratis", {
                description: `${presupuesto.motivo ?? ""} Esta vez responde ${gratis[0].modelId}.`,
                duration: 8000,
              });
            }
          }
        }
      }
      if (depth === 0 && presupuesto.ok && presupuesto.avisar) {
        toast.message("Presupuesto casi agotado", {
          description: resumenPresupuesto(leerLibro(), normalizarLimites(state.settings.presupuestoUsd), Date.now()),
          duration: 6000,
        });
      }

      // Con semilla se escribe DENTRO de la burbuja del modelo caído: así el
      // bloque de código queda entero y la vista previa lo puede pintar.
      const assistantId = semilla?.assistantId ?? uid();
      if (semilla) {
        updateMessage(sessionId, assistantId, {
          model: `${chain[0].providerId}::${chain[0].modelId}`,
          viaForjaWeb: forjaWeb,
          error: false,
        });
      } else {
        addMessage(sessionId, {
          id: assistantId,
          role: "assistant",
          content: "",
          model: `${chain[0].providerId}::${chain[0].modelId}`,
          viaForjaWeb: forjaWeb,
          createdAt: Date.now(),
        });
      }
      setStreamingMsgId(assistantId);

      // ——— historial + escudo PII + compresión de contexto ———
      // la burbuja de la semilla se reinyecta aparte, con su instrucción de
      // continuar: si entrara aquí además, el modelo la vería dos veces
      const previos = session.messages.filter(
        (m) => m.role !== "system" && !m.error && m.id !== semilla?.assistantId && !m.propuestaDiseno
      );

      // Escudo PII (inspirado en OrcaRouter): enmascara correos/teléfonos/
      // tarjetas/IBAN/DNI en lo que ENVÍA — la burbuja que ves no cambia.
      //
      // Se aplica ANTES de pegar los adjuntos, y ese orden es el arreglo: al
      // hacerlo después, un correo dentro del HTML que subiste se enmascaraba
      // y el modelo te devolvía el archivo con el correo roto.
      const escudo = escudoHistorial(previos, useForja.getState().settings.piiShield);

      const history = soloAdjuntosDelTurno(
        previos.map((m, i) => ({
          role: m.role,
          // los documentos adjuntos viajan como texto de contexto del mensaje,
          // tal cual: son archivos que mandaste a propósito
          // …y los elementos señalados en la vista previa, con su HTML: es
          // lo que dice a qué se refiere «cambia esto» sin adivinar
          content: [
            escudo.contenidos[i],
            m.docTexts?.length ? m.docTexts.map((d) => `[Documento: ${d.name}]\n${d.text}`).join("\n\n") : "",
            m.senalados?.length ? textoParaModelo(m.senalados) : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
          ...(m.attachments?.length ? { attachments: m.attachments } : {}),
        }))
      );

      if (escudo.total > 0) {
        const tipos = escudo.tipos.map((t) => PII_LABELS[t]).join(", ");
        toast.info(
          `Escudo PII: ${escudo.total} ${escudo.total === 1 ? "dato enmascarado" : "datos enmascarados"}`,
          {
            // Decir DÓNDE: el aviso daba a entender que era en lo que acababas
            // de escribir aunque viniera de diez mensajes atrás, y con un
            // «hola» eso no hay quien lo entienda.
            description: escudo.enEsteMensaje
              ? `${tipos} en tu mensaje. Tu burbuja no cambia; solo lo que se envía.`
              : `${tipos} en mensajes anteriores de esta conversación, que viajan como contexto. Tu mensaje de ahora no tenía ninguno.`,
            duration: 6000,
          }
        );
      }
      const cw = useForja.getState().settings.contextWindow;
      const base = cw > 0 ? history.slice(-cw) : history;
      // La compresión y la caché del prompt no pueden convivir: comprimir
      // reescribe el historial y la caché exige que el prefijo no cambie. Donde
      // hay caché gana la caché —el descuento del prefijo entero es mucho mayor
      // que unos caracteres recortados—, y se decide por el PRIMER candidato de
      // la cadena, que es el que va a responder salvo caída.
      const modoPedido: CompressionMode = useForja.getState().settings.compression ?? "off";
      const protocoloDestino = PROVIDER_MAP[chain[0].providerId]?.protocol ?? "openai";
      const decision = modoEfectivo(modoPedido, protocoloDestino);
      const compMode: CompressionMode = decision.modo;
      // la pregunta viva (último mensaje user) no se comprime nunca
      let protectIdx = -1;
      for (let i = base.length - 1; i >= 0; i--) {
        if (base[i].role === "user") { protectIdx = i; break; }
      }
      // Las versiones viejas de un archivo que ya tiene otra más nueva no
      // viajan: es, con diferencia, lo que más pesa en una conversación de
      // Web Studio (ver `versiones-superadas.ts`). Va antes de comprimir y
      // es independiente de ella: no reescribe código, solo quita copias.
      const poda = podarVersionesSuperadas(base, protectIdx);
      // En preguntas y retoques (L1/L2) tampoco viajan los archivos que no
      // tienen que ver con lo que se pide: solo los nombrados o que casan
      // con sus palabras, sus vecinos en el grafo de imports, la entrada y
      // el CSS. Sin pistas claras no se quita nada (`grafo-proyecto.ts`).
      // el texto tal cual lo escribió el usuario, sin documentos ni señalados
      const pregunta = [...previos].reverse().find((m) => m.role === "user")?.content ?? "";
      const nivelTurno = nivelDeContexto({ texto: pregunta, trivial: esTurnoTrivial(pregunta) });
      // Retoque por parche: la MISMA decisión que puso la instrucción en el
      // prompt (`prompt-actual.ts`), con las versiones vigentes SIN el escudo
      // PII (el parche se aplica sobre el archivo real, no sobre el enmascarado).
      const vigentesTurno = archivosVigentes(previos);
      const turnoConParches = usaParches({
        nivel: nivelTurno,
        agente: !!useForja.getState().settings.agentMode || forjaWeb,
        archivos: vigentesTurno,
      });
      const foco =
        nivelTurno === 1 || nivelTurno === 2
          ? podarIrrelevantes(
              poda.mensajes,
              archivosRelevantes(pregunta, archivosVigentes(poda.mensajes)),
              protectIdx
            )
          : { mensajes: poda.mensajes, omitidos: [] as string[], ahorrados: 0 };
      const comp = compressHistory(foco.mensajes, compMode, protectIdx);

      // ——— Qué contexto viaja de verdad (PLAN-EVOLUCION §12, «Auto Context») ———
      // Las piezas del prompt ya vienen contadas de `entradaPromptActual`; aquí
      // se completa con lo que solo se sabe en este punto: cuántos mensajes
      // sobreviven al recorte y qué se adjuntó. Se cuenta lo que SE ENVÍA, no
      // lo que hay guardado: el historial puede tener cien mensajes y viajar
      // cuarenta.
      const piezas = piezasDelPrompt(sessionId);
      const contextoUsado: ContextoUsado = {
        ...(piezas.usado ?? CONTEXTO_VACIO),
        // sin contar el mensaje que el usuario acaba de escribir
        mensajes: Math.max(0, base.length - 1),
        documentos: numDocs,
        imagenes: numAdjuntos,
        chars: construirPrompt(piezas).prompt.length,
        ...(foco.omitidos.length ? { omitidos: foco.omitidos } : {}),
      };
      // Con semilla se añaden DESPUÉS de comprimir: lo que llevaba escrito el
      // modelo caído y la orden de empalmar son justo lo que no se puede
      // resumir sin perder el punto exacto del corte.
      const trimmed = semilla
        ? [
            ...comp.messages,
            { role: "assistant" as const, content: semilla.previo },
            { role: "user" as const, content: continuarCodigoPrompt(semilla.corte) },
          ]
        : comp.messages;
      const origChars = base.reduce((a, m) => a + m.content.length, 0);
      const ahorroTotal = comp.savedChars + poda.ahorrados + foco.ahorrados;
      const savedPct =
        ahorroTotal > 400 && origChars > 0 ? savingsPercent(origChars, ahorroTotal) : 0;

      const controller = new AbortController();
      abortRef.current = controller;
      const startedAt = Date.now();

      // Con semilla, lo que escriba el modelo nuevo se empalma detrás de lo
      // que había: `base` es el punto de partida, no la cadena vacía.
      const base0 = semilla?.previo ?? "";
      let content = base0;
      let motivoProveedor: MotivoParada | null = null;
      let reasoning = "";
      let lastPaint = 0;

      const paint = (force = false) => {
        const now = Date.now();
        if (!force && now - lastPaint < 60) return;
        lastPaint = now;
        // separa también los <think>…</think> que algunos modelos meten en el contenido
        const s = separarEtiquetasPensamiento(content, reasoning);
        updateMessage(sessionId, assistantId, {
          content: s.contenido,
          reasoning: s.razonamiento || undefined,
        });
      };

      // Lo que el proveedor dice que gastó en ESTE intento. Se reinicia por
      // candidato: si el primero falla y responde el segundo, la cuenta del
      // caído no puede acabar sumada al que respondió.
      let usoDelIntento: UsoProveedor | null = null;
      // Se lee por función a propósito: TypeScript no sigue las asignaciones
      // hechas dentro del callback `onUsage`, y leyendo la variable directa la
      // estrecha a `null` en el punto donde se arma la ficha.
      const usoActual = (): UsoProveedor | null => usoDelIntento;

      /** registra el resultado en métricas y salud */
      const settle = (candidate: Candidate, ok: boolean, ms: number) => {
        const key = makeModelKey(candidate.providerId, candidate.modelId);
        if (ok) {
          useHealth.getState().recordSuccess(key);
          useUsage.getState().record({
            modelKey: key,
            ok: true,
            ms,
            charsIn: origChars,
            charsOut: content.length,
            savedChars: comp.savedChars,
            uso: usoDelIntento,
            // el tipo de encargo viaja con la métrica: sin esto, el panel
            // puede decir cuánto gastó un modelo pero no EN QUÉ, que es lo
            // que se decide («esto lo hago con el gratis»)
            tarea: task.kind,
          });
        } else {
          useUsage
            .getState()
            .record({ modelKey: key, ok: false, charsIn: origChars, tarea: task.kind, uso: usoDelIntento });
        }
      };

      try {
        // Lo que se manda en el intento actual. Deja de ser `trimmed` fijo:
        // cuando un modelo dice que no le cabe, se recorta el historial y se
        // vuelve a probar CON ÉL antes de irse a otro. El modelo que elegiste
        // suele ser el que quieres; el que sobra es el historial viejo.
        let mensajesDelIntento: typeof trimmed = trimmed;
        let recortesHechos = 0;
        // ——— El expediente de esta respuesta ———
        // Se va llenando con lo que PASA de verdad; al final viaja con el
        // mensaje. Es lo que permite responder «¿por qué me contestó esto?»
        // sin tener que adivinarlo después.
        const intentosFallidos = intentosRef.current;
        let recortadosTotal = 0;
        let huboResumen = false;

        // ——— Recorte PROACTIVO: no esperar a que el proveedor se queje ———
        //
        // Hasta ahora solo se recortaba REACTIVAMENTE, cuando un proveedor
        // contestaba «no cabe» de forma explícita (esDemasiadoGrande, más
        // abajo). Pero un contexto casi lleno no siempre falla así: puede
        // devolver un 200 con el stream VACÍO, sin queja ninguna — el caso
        // real que destapó este hueco (nvidia/nemotron vía OpenRouter al
        // 92,5% de la ventana, 182s de espera y respuesta en blanco). El
        // camino reactivo nunca llega a dispararse ahí, porque no hay error
        // que lo dispare.
        //
        // En vez de adivinar la causa de una respuesta vacía (que podría
        // deberse a otra cosa), se actúa sobre un dato que la app YA calcula
        // y ya le enseña al usuario: el mismo umbral de «zona roja» del HUD
        // de contexto (ctx-hud.ts), la misma ventana de referencia
        // (`ventanaCtx`, Ajustes) y el mismo `recortar()` del camino
        // reactivo — sin la llamada de resumen aparte, que costaría una
        // petición extra en CADA turno con el contexto lleno, no solo en el
        // recorte ocasional de un modelo concreto.
        // Si ya sabemos de verdad el tope de ESTE modelo (limites-medidos.ts,
        // aprendido de un rechazo real del proveedor), se usa ese en vez de
        // la referencia genérica — nunca al revés, ver `ventanaReferencia()`.
        const ventanaRef = ventanaReferencia(
          useLimites.getState().limites,
          chain[0] ? makeModelKey(chain[0].providerId, chain[0].modelId) : null,
          useForja.getState().settings.ventanaCtx
        );
        const hudAntes = calcularHud(tokensDe(mensajesDelIntento), ventanaRef);
        if (hudAntes.nivel === "rojo") {
          const rProactivo = recortar(mensajesDelIntento, ventanaRef);
          if (rProactivo.quitados > 0) {
            mensajesDelIntento = rProactivo.mensajes;
            recortadosTotal += rProactivo.quitados;
            toast.warning("Historial recortado antes de enviar", {
              description: `El contexto estaba casi lleno (${hudAntes.pct}% de tu ventana de referencia): se quitaron ${rProactivo.quitados} mensaje${rProactivo.quitados === 1 ? "" : "s"} viejo${rProactivo.quitados === 1 ? "" : "s"} antes de mandar nada. Lo que acabas de escribir va entero.`,
              duration: 8000,
            });
          }
        }
        for (let ci = 0; ci < chain.length; ci++) {
          const candidate = chain[ci];
          const attemptStart = Date.now();
          content = base0;
          reasoning = "";
          usoDelIntento = null;
          if (ci > 0) {
            // reutiliza la misma burbuja con el nuevo modelo — y si hay
            // semilla, conservando lo que ya estaba escrito
            updateMessage(sessionId, assistantId, {
              content: base0,
              reasoning: undefined,
              model: `${candidate.providerId}::${candidate.modelId}`,
              viaForjaWeb: forjaWeb,
              error: false,
            });
          }
          try {
            // Bucle de tools del agente (PLAN-V4 punto 2 + 5): el hook
            // `useAgentTools` encapsula el probe de tools + el bucle de
            // tool_calls + la reinyección. Así `chat-app` no tiene que
            // saber de los tres protocolos ni del catálogo.
            // El modo agente NO se aplica a un saludo. Sin esto, «Hola» en
            // una conversación sobre una web se contestaba con el bucle
            // entero —plan, pasos y un «he actualizado index.html» que nadie
            // pidió—, porque el modelo recibía la plantilla y el catálogo de
            // herramientas igual que en un encargo. Aquí se le quitan las dos.
            const ultimoUsuario = [...(useForja.getState().sessions.find((x) => x.id === sessionId)?.messages ?? [])]
              .reverse()
              .find((m) => m.role === "user");
            // FORJA WEB fuerza el modo agente aunque el interruptor de
            // Ajustes esté apagado: seleccionarlo YA es la señal de que se
            // quiere el sistema completo (`prompt-actual.ts` aplica la misma
            // regla para el bloque de prompt del agente).
            const agentOn =
              (useForja.getState().settings.agentMode || forjaWeb) &&
              !esTurnoTrivial(ultimoUsuario?.content ?? "");
            const maxLoops = Math.max(1, Math.min(8, useForja.getState().settings.agentMaxLoops || 3));
            const cfg = useForja.getState().providers[candidate.providerId];
            // ——— Checkpoint automático (Pilar 1.3) ———
            // Antes de CADA tarea del agente (la primera, no sus reintentos),
            // se guarda un punto de restauración con los archivos actuales.
            // Sin esto, «deshacer lo que hizo el agente» era rehacerlo a mano.
            if (agentOn && depth === 0 && revisiones === 0 && continuaciones === 0 && sandboxInitial?.files?.length) {
              const filesActuales = Object.fromEntries(
                sandboxInitial.files.map((f) => [f.path, f.content])
              );
              const cp = checkpointAuto(
                filesActuales,
                `antes de: ${(ultimoUsuario?.content ?? "tarea").slice(0, 60)}`,
                sessionId
              );
              if (cp) {
                undoMapRef.current[assistantId] = cp.id;
                forzarUndoRender((n) => n + 1);
              }
            }
            await runWithTools(
              {
                providerId: candidate.providerId,
                config: cfg,
                modelId: candidate.modelId,
                messages: mensajesDelIntento,
                settings: composeSettings(sessionId),
                signal: controller.signal,
                onDelta: (text) => {
                  content = base0 ? unirContinuacion(base0, text) : text;
                  paint();
                },
                onReasoning: (r) => {
                  reasoning = r;
                  paint();
                },
                // Por qué paró, según el proveedor. Es la señal AUTORIZADA de
                // «te corté por longitud»; la forma del texto (una cerca sin
                // cerrar) es solo un indicio, y falla cuando el corte cae a
                // mitad de una frase sin código de por medio.
                onFinish: (m) => {
                  motivoProveedor = m;
                },
                // La cuenta del proveedor (tokens y aciertos de caché). Es lo
                // único que no es estimación nuestra, y es lo que se enseña
                // para saber si la caché del prompt está sirviendo de algo.
                onUsage: (u) => {
                  // Se SUMA: cada vuelta del bucle del agente es una llamada
                  // aparte, y quedarse con la última reportaría el gasto de
                  // una sola.
                  usoDelIntento = sumarUso(usoDelIntento, u);
                },
                onDone: () => {},
              },
              agentOn,
              maxLoops,
              sandboxInitial,
              cfg,
              // v3.32: lo que el agente escribe/edita/restaura en el bucle
              // llega al Sandbox como seed. Va por ref (mismo patrón que
              // runGenRef) para que runGeneration no se re-crear cada vez
              // que cambia el estado del Sandbox.
              aplicarArchivosAgenteRef.current,
              // Mapa de la sesión para `ask_memory`: se lee del store en este
              // momento (no de una captura vieja) para que el agente consulte
              // lo que hay AHORA, incluidas las notas del turno anterior.
              useForja.getState().sessions.find((x) => x.id === sessionId)?.projectMap ?? null,
              // Permisos del agente, también frescos del store: si el usuario
              // acaba de apagar «Salir a internet», este envío ya lo respeta.
              normalizarPermisos(useForja.getState().settings.permisosAgente),
              // Y lo que ha prohibido tocar, también del store en este momento:
              // una regla que acaba de crear tiene que valer para este envío.
              // …salvo las que el usuario AUTORIZÓ en el modal de este turno.
              useForja.getState().sessions.find((x) => x.id === sessionId)?.reglasNo ?? [],
              reglasAutorizadasRef.current
            );
          } catch (err) {
            const aborted = err instanceof DOMException && err.name === "AbortError";
            if (aborted) throw err;
            const status = statusFromError(err);
            const msg = err instanceof Error ? err.message : String(err);
            // Un límite tuyo (presupuesto, techo, veto) no es un fallo del
            // modelo: no lo manda al banquillo ni cuenta contra su historial.
            const limiteLocal = esLimiteLocal(msg);
            // «Este modelo no admite imágenes»: se apunta para que Auto no lo
            // vuelva a elegir en un turno con imágenes.
            if (imagenesTurno > 0 && esFalloDeImagen(msg)) {
              useCapacidades.getState().marcarSinVision(makeModelKey(candidate.providerId, candidate.modelId));
            }
            if (!limiteLocal) {
              useHealth.getState().recordFailure(
                makeModelKey(candidate.providerId, candidate.modelId),
                status,
                retryAfterFromError(err)
              );
              settle(candidate, false, 0);
            }
            // ¿El proveedor ha dicho que ese modelo ya no existe? Es una
            // categoría aparte de «falló»: la petición estaba bien y lo que
            // falta es el modelo. Antes caía en el mismo saco que una petición
            // inválida y la app se paraba con otros proveedores conectados.
            const muerto = esModeloMuerto(status, msg);
            // «No te cabe» es su propia categoría: el modelo está bien, la
            // clave está bien, y lo que sobra es la conversación. Se apunta lo
            // que el proveedor dijo para no volver a elegirlo con un mensaje
            // igual de grande — que era el caso de la captura de Groq.
            const grande = esDemasiadoGrande(status, msg);
            if (grande) {
              const nums = limiteDelMensaje(msg);
              useLimites.getState().anotar(makeModelKey(candidate.providerId, candidate.modelId), {
                limite: nums?.limite ?? null,
                rechazado: nums?.pedido ?? Math.max(1, Math.round(origChars / 4)),
                at: Date.now(),
              });

              // ——— Recortar y reintentar con el MISMO modelo ———
              //
              // Es lo que haría cualquiera a mano: quitar lo viejo y volver a
              // probar. Solo si el proveedor dijo su límite (si no, no hay a
              // qué recortar) y UNA vez por turno: reintentar en bucle contra
              // un tope que no se conoce bien es gastar peticiones.
              if (nums && recortesHechos === 0) {
                const r = recortar(mensajesDelIntento, nums.limite);
                recortesHechos++;
                if (r.cabe && r.quitados > 0) {
                  // ——— Resumir lo que se va, en vez de tirarlo ———
                  //
                  // Recortar a secas hace que la app «se olvide»: lo acordado
                  // en el turno 3 desaparece en el 40 y el modelo empieza a
                  // contradecirse. Una llamada más, con el MISMO modelo (que
                  // ahora sí traga porque solo se le manda el tramo), y el
                  // hueco lo ocupa un resumen marcado como tal.
                  const tramo = mensajesDelIntento.slice(0, r.quitados);
                  let nota: { role: "user"; content: string } | null = null;
                  if (mereceResumen(tramo)) {
                    try {
                      const texto = await streamChat({
                        providerId: candidate.providerId,
                        config: useForja.getState().providers[candidate.providerId],
                        modelId: candidate.modelId,
                        messages: [{ role: "user", content: promptDeResumen(textoDelTramo(tramo)) }],
                        settings: { ...composeSettings(sessionId), stream: false, systemPrompt: "" },
                        signal: controller.signal,
                        onDelta: () => {},
                        onDone: () => {},
                      });
                      if (resumenUtil(texto)) {
                        const n = notaDeResumen(texto, r.quitados);
                        nota = { role: "user", content: n.content };
                      }
                    } catch {
                      // Un resumen es una mejora, no un requisito: si el modelo
                      // no contesta, el recorte a secas ya funcionaba.
                    }
                  }
                  mensajesDelIntento = nota ? [nota, ...r.mensajes] : r.mensajes;
                  recortadosTotal += r.quitados;
                  huboResumen = huboResumen || nota != null;
                  // Se DICE lo que se quitó. Un recorte silencioso deja al
                  // modelo sin hilo, la respuesta sale rara y no hay forma de
                  // saber por qué.
                  toast.warning(`Historial recortado para ${candidate.modelId}`, {
                    description:
                      (avisoRecorte(r, candidate.modelId) ?? "") +
                      (nota ? " Lo apartado va como resumen." : ""),
                    duration: 8000,
                  });
                  ci--; // el mismo candidato, con menos historial
                  continue;
                }
                if (!r.cabe) {
                  toast.error("Ni recortando cabe", {
                    description: avisoNoCabeNiRecortando(candidate.modelId, nums.limite),
                    duration: 8000,
                  });
                }
              }
            }
            if (muerto) {
              // Que Auto deje de elegirlo. Hasta ahora esto solo lo marcaba
              // «Probar modelos» desde Ajustes, así que un modelo retirado
              // seguía saliendo elegido turno tras turno.
              useModelosRotos.getState().marcar(makeModelKey(candidate.providerId, candidate.modelId), {
                status,
                detail: msg.slice(0, 200),
                at: Date.now(),
              });
            }
            intentosFallidos.push({
              modelo: candidate.modelId,
              proveedor: PROVIDER_MAP[candidate.providerId]?.name ?? candidate.providerId,
              status,
              decision: "",
              motivo: msg.slice(0, 140),
            });
            // La decisión (¿otro modelo? ¿otro proveedor? ¿me rindo?) vive en
            // `decisiones.ts`, sin React de por medio y con sus propios tests.
            // Aquí solo queda ejecutarla y contarlo.
            const decision = decidirTrasError({
              status,
              mensajeCuota: isQuotaError(msg),
              modeloMuerto: muerto,
              peticionInvalida: esPeticionInvalida(status, msg),
              limiteLocal,
              esGratis: (c) => isFreeModel(c.providerId as ProviderId, c.modelId),
              auto: auto || forjaWeb,
              depth,
              maxSaltos: MAX_SALTOS,
              indice: ci,
              cadena: chain,
              parcial: content,
              rescatable:
                content.trim().length >= MIN_RESCATE && respuestaCortada(content).cortada,
            });

            const ultimo = intentosFallidos[intentosFallidos.length - 1];
            if (ultimo) ultimo.decision = decision.tipo;
            if (decision.tipo === "siguiente") {
              const sig = chain[decision.indice];
              // FORJA WEB nunca nombra la fuente real (ni la que falló ni la
              // siguiente): de cara al usuario, quien responde es Forja IA.
              toast.warning(
                forjaWeb
                  ? "Forja IA: buscando otra fuente disponible"
                  : limiteLocal
                    ? "Límite de gasto: sigue un modelo gratis"
                    : grande
                    ? `La conversación no le cabe a ${candidate.modelId}`
                    : muerto
                      ? `${candidate.modelId} ya no existe`
                      : auto
                        ? `Auto: ${candidate.modelId} falló`
                        : `${candidate.modelId} no respondió`,
                {
                  description: forjaWeb
                    ? "Reintentando con lo que tengas conectado."
                    : `Saltando a ${sig.modelId} · ${PROVIDER_MAP[sig.providerId]?.name ?? ""}`,
                  duration: 6000,
                }
              );
              ci = decision.indice - 1;
              continue;
            }

            updateMessage(sessionId, assistantId, {
              content: msg,
              error: true,
              elapsedMs: Date.now() - attemptStart,
            });
            if (decision.tipo === "failover") {
              attemptFailover(
                sessionId,
                candidate.providerId,
                assistantId,
                depth,
                continuaciones,
                content,
                motivoDelFallo(status, isQuotaError(msg), muerto, grande, limiteLocal)
              );
            }
            break;
          }

          // ——— éxito del stream ———
          paint(true);
          if (imagenesTurno > 0) {
            useCapacidades.getState().confirmarVision(makeModelKey(candidate.providerId, candidate.modelId));
          }
          const finalSplit = separarEtiquetasPensamiento(content, reasoning);
          content = finalSplit.contenido;
          reasoning = finalSplit.razonamiento;
          let elapsed = Date.now() - attemptStart;

          // Con semilla, `content` arranca con lo que ya había escrito el
          // modelo caído: para juzgar ESTE intento hay que mirar solo lo que
          // ha aportado él, no la burbuja entera.
          const aportado =
            base0 && content.startsWith(base0) ? content.slice(base0.length) : content;

          // Failover: algunos proveedores responden 200 con el aviso de cuota como texto
          const quotaInText =
            aportado.length > 0 && aportado.length < 600 && isQuotaError(aportado);
          if (quotaInText) {
            const key = makeModelKey(candidate.providerId, candidate.modelId);
            useHealth.getState().recordFailure(key, 402);
            settle(candidate, false, elapsed);
            const dCuota = decidirTrasCuotaEnTexto({
              status: 402,
              mensajeCuota: true,
              auto: auto || forjaWeb,
              depth,
              maxSaltos: MAX_SALTOS,
              indice: ci,
              cadena: chain,
              parcial: base0,
              rescatable: false,
            });
            if (dCuota.tipo === "siguiente") {
              updateMessage(sessionId, assistantId, { content: base0, reasoning: undefined });
              toast.warning(
                forjaWeb ? "Forja IA: cuota agotada" : `${auto ? "Auto" : candidate.modelId}: cuota agotada`,
                {
                  description: forjaWeb
                    ? "Saltando a otra fuente disponible."
                    : `Saltando a ${chain[dCuota.indice].modelId}.`,
                  duration: 6000,
                }
              );
              ci = dCuota.indice - 1;
              continue;
            }
            if (dCuota.tipo === "failover") {
              attemptFailover(
                sessionId,
                candidate.providerId,
                assistantId,
                depth,
                continuaciones,
                base0,
                "cuota"
              );
            }
            return;
          }

          // Respuesta vacía. Pasa con los modelos de razonamiento: gastan el
          // presupuesto de salida pensando y cierran el stream sin escribir
          // nada. Se contaba como ÉXITO, así que la burbuja se quedaba en
          // blanco y todo se paraba ahí sin decir por qué. Es un fallo, y como
          // fallo avanza en la cadena.
          //
          // Y un caso real distinto pero con la misma cura: el modelo
          // devuelve el preámbulo de un filtro de seguridad ("User Safety:
          // safe") EN VEZ de la respuesta — no está vacío, pero tampoco es
          // una respuesta a lo que se pidió. Visto con nemotron vía
          // OpenRouter en FORJA WEB: la burbuja mostraba "User Safety: safe"
          // como si fuera la web pedida.
          const soloFiltroSeguridad = !!aportado.trim() && esSoloFiltroSeguridad(aportado);
          if (!aportado.trim() || soloFiltroSeguridad) {
            const key = makeModelKey(candidate.providerId, candidate.modelId);
            useHealth.getState().recordFailure(key, 0);
            settle(candidate, false, elapsed);
            const soloPenso = !soloFiltroSeguridad && reasoning.trim().length > 0;
            const dVacio = decidirTrasVacio({
              status: 200,
              mensajeCuota: false,
              auto: auto || forjaWeb,
              depth,
              maxSaltos: MAX_SALTOS,
              indice: ci,
              cadena: chain,
              parcial: "",
              // El filtro de seguridad tampoco se rescata: no es progreso
              // real, es el mismo no-contenido que la respuesta vacía.
              rescatable: false,
            });
            const etiquetaFallo = soloFiltroSeguridad
              ? "solo devolvió el filtro de seguridad"
              : "no escribió respuesta";
            if (dVacio.tipo === "siguiente") {
              toast.warning(forjaWeb ? `Forja IA ${etiquetaFallo}` : `${candidate.modelId} ${etiquetaFallo}`, {
                description: forjaWeb
                  ? `${soloPenso ? "Se le fue el turno razonando. " : ""}Probando con otra fuente.`
                  : `${soloPenso ? "Se le fue el turno razonando. " : ""}Probando con ${chain[dVacio.indice].modelId}.`,
                duration: 6000,
              });
              ci = dVacio.indice - 1;
              continue;
            }
            const aviso = soloFiltroSeguridad
              ? "El modelo devolvió solo la comprobación de seguridad («User Safety: safe»), sin ninguna respuesta real detrás. Prueba otro modelo."
              : soloPenso
                ? "El modelo terminó de razonar pero cerró la respuesta sin escribir nada. Su razonamiento está aquí debajo. Suele pasar cuando el límite de salida se agota pensando: sube «Tokens máximos» en Ajustes o prueba otro modelo."
                : "El modelo cerró la respuesta sin escribir nada.";
            updateMessage(sessionId, assistantId, {
              // lo rescatado del modelo anterior no se tira por que el nuevo
              // no aportara: se conserva y se explica debajo
              content: base0 ? `${base0}\n\n_${aviso}_` : aviso,
              error: !base0,
              reasoning: reasoning || undefined,
              elapsedMs: elapsed,
            });
            if (dVacio.tipo === "failover") {
              attemptFailover(
                sessionId,
                candidate.providerId,
                assistantId,
                depth,
                continuaciones,
                base0,
                "otro"
              );
            }
            break;
          }

          // ——— la respuesta se cortó por longitud ———
          //
          // Pides una web larga, el modelo llega a su techo de tokens y el
          // stream acaba dentro del bloque de código. Se daba por respuesta
          // buena: la cerca quedaba sin cerrar, la vista previa recibía un
          // documento incompleto y no cargaba.
          //
          // Se cose EN LA MISMA burbuja a propósito. Si la continuación fuera
          // otro mensaje, el bloque de código quedaría partido en dos y la
          // vista previa seguiría sin tener un documento entero que enseñar.
          //
          // Con el modo agente esto lo lleva `agentStalled`, que entiende sus
          // etiquetas; aquí es para todo lo demás, que es como se pide una web
          // la mayoría de las veces.
          if (!useForja.getState().settings.agentMode && !forjaWeb) {
            // Dos señales: lo que dice el proveedor y la forma del texto.
            // Con cualquiera de las dos se continúa — el proveedor acierta
            // donde la forma no ve nada (un corte a media frase), y la forma
            // cubre a los proveedores que no mandan el campo.
            let corte = respuestaCortada(content);
            if (!corte.cortada && estaCortadaPorLongitud(motivoProveedor)) {
              corte = { cortada: true, motivo: "cerca-abierta", lang: "", cola: content.slice(-600) };
            }
            for (let trozo = 0; corte.cortada && trozo < MAX_TROZOS; trozo++) {
              if (controller.signal.aborted) break;
              const previo = content;
              toast.message("La respuesta se cortó por longitud", {
                description: `Pidiendo la continuación (${trozo + 1} de ${MAX_TROZOS}) y uniéndola al mismo bloque.`,
                duration: 5000,
              });
              let parcial = "";
              try {
                await runWithTools(
                  {
                    providerId: candidate.providerId,
                    config: useForja.getState().providers[candidate.providerId],
                    modelId: candidate.modelId,
                    messages: [
                      ...trimmed,
                      { role: "assistant" as const, content: previo },
                      { role: "user" as const, content: continuarCodigoPrompt(corte) },
                    ],
                    settings: composeSettings(sessionId),
                    signal: controller.signal,
                    onDelta: (t) => {
                      parcial = t;
                      content = unirContinuacion(previo, t);
                      paint();
                    },
                    onReasoning: () => {},
                    onFinish: (m) => {
                      motivoProveedor = m;
                    },
                    onDone: () => {},
                  },
                  // sin tools y con una sola vuelta: esto es empalmar texto,
                  // no otro bucle de agente
                  false,
                  1,
                  sandboxInitial,
                  useForja.getState().providers[candidate.providerId]
                );
              } catch {
                // Si la continuación falla, lo cortado vale más que nada: se
                // conserva lo que ya había y se sale del bucle.
                content = previo;
                break;
              }
              content = unirContinuacion(previo, parcial);
              // si no aportó nada, insistir solo gasta cuota
              if (content === previo) break;
              corte = respuestaCortada(content);
              if (!corte.cortada && estaCortadaPorLongitud(motivoProveedor)) {
                corte = { cortada: true, motivo: "cerca-abierta", lang: "", cola: content.slice(-600) };
              }
            }
            paint(true);
            elapsed = Date.now() - attemptStart;
            if (corte.cortada) {
              toast.warning("La respuesta sigue incompleta", {
                description: "El modelo no llegó a cerrar el código. Prueba con otro modelo o pídele solo la parte que falta.",
                duration: 8000,
              });
            }
          }

          // ——— Retoque por parche (retoque-parche.ts) ———
          // Los bloques SEARCH/REPLACE se aplican aquí sobre la última versión
          // de cada archivo, y el archivo completo se añade a la respuesta
          // (localmente, sin gastar un token) para que la vista previa, el ZIP
          // y el historial vean archivos enteros. Un archivo con algún bloque
          // que no casa NO se toca: se pide completo justo después.
          let retoqueFallido: ReturnType<typeof aplicarRetoque>["fallidos"] = [];
          if (turnoConParches) {
            const r = aplicarRetoque(content, vigentesTurno);
            if (r.parcheados.length) {
              content = `${content}\n\n${r.parcheados.map(bloqueResultado).join("\n\n")}`;
              paint(true);
            }
            retoqueFallido = r.fallidos;
          }
          // Quality Gate (§62): un archivo entregado «con el resto igual» no
          // se acepta — usarlo borraría lo omitido. Se neutraliza en la
          // respuesta (la versión anterior sigue valiendo) y se pide bien.
          const recortados = !useForja.getState().settings.agentMode && !forjaWeb
            ? archivosRecortados(bloquesConNombre(content), vigentesTurno)
            : [];
          if (recortados.length) {
            content = neutralizarRecortados(content, recortados);
            paint(true);
          }

          settle(candidate, true, elapsed);
          const uso = usoActual();
          // Las dos mitades del dinero: tokens dichos por el proveedor y
          // precio fechado del catálogo. Si falta cualquiera, se guarda el
          // motivo en vez de un número inventado.
          const dinero = costeDeModelo(candidate.providerId, candidate.modelId, uso);
          updateMessage(sessionId, assistantId, {
            content,
            reasoning: reasoning || undefined,
            elapsedMs: elapsed,
            ...(savedPct >= 5 ? { ctxSaved: savedPct } : {}),
            ...(escudo.total > 0 ? { piiMasked: escudo.total } : {}),
            ...(hayContexto(contextoUsado) ? { contexto: contextoUsado } : {}),
            ficha: {
              modelo: `${PROVIDER_MAP[candidate.providerId]?.name ?? candidate.providerId} · ${candidate.modelId}`,
              ...(intentosFallidos.length ? { intentos: [...intentosFallidos] } : {}),
              ...(hayContexto(contextoUsado) ? { contexto: contextoUsado } : {}),
              charsSistema: contextoUsado.chars,
              mensajesEnviados: mensajesDelIntento.length,
              ...(recortadosTotal ? { recortados: recortadosTotal, resumido: huboResumen } : {}),
              ...(uso?.entrada != null ? { tokensEntrada: uso.entrada } : {}),
              ...(uso?.salida != null ? { tokensSalida: uso.salida } : {}),
              ...(uso?.cacheLeido ? { tokensCache: uso.cacheLeido } : {}),
              ...(dinero.coste
                ? { coste: dinero.coste.total, precioDe: PRECIOS_FECHA }
                : { sinCoste: dinero.motivo ?? "sin dato" }),
              ms: elapsed,
            } satisfies FichaRespuesta,
          });
          updateProjectMap(sessionId, content);
          if (recortados.length && quedanIntentos(revisiones)) {
            addMessage(sessionId, {
              id: uid(),
              role: "user",
              content: pedirSinOmitir(recortados),
              createdAt: Date.now(),
              instruction: true,
            });
            toast.warning("Archivo con partes omitidas", {
              description: `${recortados.map((r) => r.path).join(", ")} llegó recortado («el resto igual»): no se aplica y se pide completo.`,
              duration: 7000,
            });
            relanzar(sessionId, depth, continuaciones, undefined, revisiones + 1);
            return;
          }
          if (retoqueFallido.length && quedanIntentos(revisiones)) {
            addMessage(sessionId, {
              id: uid(),
              role: "user",
              content: pedirArchivoCompleto(retoqueFallido),
              createdAt: Date.now(),
              instruction: true,
            });
            toast.warning("El parche no casó", {
              description: `${retoqueFallido.map((f) => f.path).join(", ")} se deja como estaba y se pide completo.`,
              duration: 7000,
            });
            relanzar(sessionId, depth, continuaciones, undefined, revisiones + 1);
            return;
          }
          // ——— Task DNA + memoria del proyecto (plan técnico §4, Pilar 3) ———
          // Cada encargo terminado se guarda como tarea estructurada: objetivo,
          // modelo, reintentos y archivos. Es lo que alimenta la recomendación
          // de modelo y lo que viaja a `.forja/tasks.json` al subir a GitHub.
          {
            const objetivo = lastUserPrompt(session.messages) || "(continuación)";
            const respuesta = parseAgentTrace(content);
            const infoAdelantada = agentStalled(respuesta, true);
            const archivosTocados = Array.from(
              new Set(
                [...respuesta.blocks.flatMap((b) => ("body" in b ? [b.body] : []))]
                  .join("\n")
                  .match(/[\w./-]+\.(html?|css|js|jsx|ts|tsx|json|md|svg|py|mjs|cjs)/g) ?? []
              )
            ).slice(0, 8);
            const mem = leerMemoria(sessionId);
            let memNueva = addTareaMemoria(mem, objetivo, {
              modelo: `${candidate.providerId}::${candidate.modelId}`,
              estado: infoAdelantada.stalled ? "failed" : "done",
              reintentos: revisiones,
              ...(archivosTocados.length ? { archivos: archivosTocados } : {}),
            });
            // Las decisiones del modelo (notas del <project-map>) entran en la
            // memoria: sin esto, «tema principal: azul» vivía solo en el mapa.
            if (respuesta.mapJson) {
              try {
                const parsed = JSON.parse(respuesta.mapJson) as { notes?: string[] };
                for (const nota of (parsed.notes ?? []).slice(0, 3)) {
                  memNueva = addDecisionMemoria(memNueva, nota, "modelo", "global");
                }
              } catch {
                /* mapa corrupto: la tarea ya quedó guardada, no rompe nada */
              }
            }
            // Y la dirección de diseño usada, si el turno era de UI nueva
            // (variación forzada: la próxima web no repetirá esta).
            const dirUsada = contextoUsado.diseno;
            if (dirUsada) {
              memNueva = addDisenoMemoria(
                memNueva,
                dirUsada,
                `usada en: ${objetivo.slice(0, 40)}`
              );
            }
            guardarMemoria(sessionId, memNueva);
          }
          // Memoria de fallos: un trabajo del agente que se quedó a medias es un
          // fallo verificable (hay traza, no hay <answer>). Se apunta la regla para
          // la próxima vez — y caduca sola para no envenenar el contexto.
          // Si se ha relanzado para retomar un trabajo a medias, lo escrito
          // todavía no es la entrega: revisarlo ahora sería corregir un
          // borrador y gastar una de las dos vueltas que hay.
          let retomando = false;
          if (useForja.getState().settings.agentMode || forjaWeb) {
            // `true`: el stream ya acabó, así que una etiqueta abierta no es
            // que esté escribiendo — es que se cortó a mitad.
            const info = agentStalled(parseAgentTrace(content), true);
            if (info.stalled) {
              useFailures.getState().record(
                "agente",
                `Trabajo a medias: ${MOTIVO_PARADA[info.reason ?? "sin-respuesta"]} tras ${info.iterations} ${info.iterations === 1 ? "iteración" : "iteraciones"}`,
                "Cierra SIEMPRE el bucle del agente con <answer> tras la revisión final. Si el techo de iteraciones se acerca, prioriza terminar lo esencial y cerrar en vez de dejar pasos abiertos.",
                "warn"
              );
              // Y se retoma solo. Hasta ahora solo aparecía el botón
              // «Continuar»: el agente se paraba y, si nadie lo pulsaba, el
              // trabajo moría ahí. Con tope, y el botón sigue estando para
              // cuando se agote.
              if (continuaciones < MAX_CONTINUACIONES) {
                addMessage(sessionId, {
                  id: uid(),
                  role: "user",
                  content: continuePrompt(info),
                  createdAt: Date.now(),
                  instruction: true,
                });
                toast.message("El agente se quedó a medias", {
                  description: `Retomando el trabajo solo (${continuaciones + 1} de ${MAX_CONTINUACIONES}).`,
                  duration: 5000,
                });
                relanzar(sessionId, depth, continuaciones + 1);
                retomando = true;
              }
            }
          }
          // ——— el código se ejecuta ANTES de dárselo por bueno ———
          //
          // PLAN-V4 §3: «hoy el agente escribe código y te pregunta a TI
          // si funciona». Se arregló solo para los modelos que soportan
          // `tools` y llaman a `run_project`; la mayoría de los gratis van
          // por el camino XML, o sea que el arreglo llegaba justo a los
          // modelos para los que Forja NO existe.
          //
          // Y quedaba una puerta más: esto vivía DENTRO del modo agente.
          // Con el modo agente apagado —que es como se pide «hazme una web
          // de recetas», el caso más común— el código salía sin ejecutarse
          // ni una vez, y el fallo lo descubrías tú al abrirlo.
          //
          // Ejecutar es local y gratis: solo cuesta una llamada al modelo
          // si de verdad hay errores que corregir.
          const proyecto = proyectoDeLaRespuesta(content);
          // `revisiones < MAX_REVISIONES` decidía si esto se comprobaba EN
          // ABSOLUTO. En la última pasada permitida (revisiones ya al tope)
          // la condición era falsa y el bloque entero se saltaba: la
          // respuesta que salió del último intento de corrección nunca se
          // llegaba a mirar. Si seguía genérica, o con un botón roto, o con
          // un error de consola, Forja se quedaba callado — parecía que
          // había terminado bien cuando en realidad se había rendido sin
          // decirlo. Ahora SIEMPRE se comprueba; lo que cambia con el
          // presupuesto agotado es que ya no se relanza más, solo se avisa.
          if (!retomando && proyecto) {
            void (async () => {
              // `botones: true`: además de cargar la página, se pulsan
              // sus botones. La revisión de carga solo caza lo que revienta
              // al abrir, y en una web generada la mayoría de los fallos
              // están detrás de un clic.
              // `qa: true` faltaba. El medidor visual se inyectaba, medía y
              // mandaba su resultado… y aquí no se pedía, así que nada de lo
              // que medía llegaba nunca al modelo. Es también por donde vienen
              // las señas de página genérica.
              const salida = await runProjectInMemory(proyecto.files, { botones: true, qa: true });
              const inf = salida.botones;
              const medidas = salida.qa?.generico ?? MEDIDAS_VACIAS;
              // La dirección que se usó de VERDAD este turno (no la que se
              // pidió inicialmente: un turno de retoque no elige dirección
              // nueva). `contextoUsado.diseno` guarda el nombre legible
              // ("Editorial de revista"), y la lista de qué tiene prohibido
              // cada dirección vive por `id` ("editorial") — de ahí el mapeo.
              const direccionUsada = idPorNombre(contextoUsado.diseno ?? "");
              // Dos comprobaciones distintas —"parece hecha por una IA" y
              // "usa un efecto (2D o 3D) fuera de lo que permite la
              // dirección elegida"— pero comparten exactamente la misma
              // forma (`SenaGenerica`) y el mismo aviso/reintento de abajo,
              // así que se juntan en una sola lista en vez de triplicar esa
              // fontanería.
              const senas = [
                ...senasGenericas(medidas),
                ...senasEfectosFueraDeDireccion(medidas, direccionUsada),
                ...senasComposicionFueraDeDireccion(medidas, direccionUsada),
              ];
              const quedan = quedanIntentos(revisiones);

              if (!hayQueCorregir(salida)) {
                // La carga fue limpia, pero puede haber botones que revienten.
                if (inf && hayBotonesQueCorregir(inf)) {
                  const reglaB = reglaDeBotones(inf);
                  if (reglaB) {
                    useFailures.getState().record("sandbox", reglaB.titulo, reglaB.regla, "error");
                  }
                  if (!quedan) {
                    toast.warning("Botones que siguen fallando", {
                      description: avisoBotonesAgotados(inf),
                      duration: 9000,
                    });
                    return;
                  }
                  addMessage(sessionId, {
                    id: uid(),
                    role: "user",
                    content: promptDeBotones(inf, proyecto.entry),
                    createdAt: Date.now(),
                    instruction: true,
                  });
                  toast.warning("Botones que fallan", {
                    description: `${resumenBotones(inf)} Corrigiéndolo solo (${revisiones + 1} de ${MAX_REVISIONES}).`,
                    duration: 7000,
                  });
                  relanzar(sessionId, depth, continuaciones, undefined, revisiones + 1);
                  return;
                }
                // ——— Y si funciona pero se rompe en el MÓVIL ———
                //
                // El medidor de `visual-qa.ts` ya corría a 390 px en esta misma
                // ejecución, pero de lo que medía solo se usaban las señas de
                // «genérica». Scroll horizontal, botones fuera de pantalla o sin
                // nombre y contraste ilegible se medían y se tiraban. Ahora los
                // graves vuelven al modelo (`qa-responsive.ts`).
                const qaMovil = hallazgosQA(salida.qa);
                if (hayQueCorregirQA(qaMovil)) {
                  for (const h of qaMovil.filter((x) => x.severidad !== "baja").slice(0, 3)) {
                    useFailures.getState().record("sandbox", `Móvil: ${h.etiqueta}`, reglaDeQA(h.tipo), "warn");
                  }
                  if (!quedan) {
                    toast.warning("La página sigue fallando en el móvil", {
                      description: resumenQA(qaMovil),
                      duration: 9000,
                    });
                    return;
                  }
                  addMessage(sessionId, {
                    id: uid(),
                    role: "user",
                    content: promptDeQA(qaMovil, salida.qa?.width ?? 390, proyecto.entry),
                    createdAt: Date.now(),
                    instruction: true,
                  });
                  toast.warning("Falla en el móvil", {
                    description: `${resumenQA(qaMovil)}. Corrigiéndolo solo (${revisiones + 1} de ${MAX_REVISIONES}).`,
                    duration: 8000,
                  });
                  relanzar(sessionId, depth, continuaciones, undefined, revisiones + 1);
                  return;
                }
                // ——— Y si funciona pero parece hecha por una IA, o usa el
                //     motor 3D fuera de la dirección experimental ———
                //
                // La checklist anti-slop se la autoevaluaba el modelo, así que
                // la nota siempre era buena. Esto lo MIDE en la página ya
                // pintada y se lo devuelve por el mismo camino que los errores
                // de consola, que es el bucle que sí funciona. Y lo mismo para
                // el motor 3D: el prompt lo prohíbe fuera de "experimental",
                // pero eso solo se lo dice al modelo — nadie comprobaba si le
                // hacía caso.
                if (senas.length) {
                  for (const sn of senas.slice(0, 3)) {
                    const r = reglaDeGenerico(sn);
                    useFailures.getState().record("sandbox", r.titulo, r.regla, "warn");
                  }
                  if (!quedan) {
                    toast.warning("Hay algo que corregir", {
                      description: avisoGenericoAgotado(senas),
                      duration: 9000,
                    });
                    return;
                  }
                  addMessage(sessionId, {
                    id: uid(),
                    role: "user",
                    content: promptDeGenerico(senas, proyecto.entry),
                    createdAt: Date.now(),
                    instruction: true,
                  });
                  toast.warning("Hay algo que corregir", {
                    description: `${resumenGenerico(senas)} Corrigiéndolo solo (${revisiones + 1} de ${MAX_REVISIONES}).`,
                    duration: 8000,
                  });
                  relanzar(sessionId, depth, continuaciones, undefined, revisiones + 1);
                  return;
                }
                // ——— Y si funciona y no es genérica, pero le falta CONTENIDO
                //     respecto al plano que el motor le dio al crearla ———
                //
                // El plano viajó en el prompt (motor-chat.ts); aquí se
                // comprueba que se cumplió, con el MISMO plano (se recalcula
                // del mismo encargo: es determinista). Solo lo crítico gasta
                // una vuelta; los avisos no.
                const sesionAhora = useForja.getState().sessions.find((x) => x.id === sessionId);
                const encargo =
                  [...(sesionAhora?.messages ?? [])].reverse().find((m) => m.role === "user" && !m.instruction)?.content ?? "";
                const cssProyecto = Object.entries(proyecto.files)
                  .filter(([ruta]) => /\.css$/i.test(ruta))
                  .map(([, css]) => `<style>${css}</style>`)
                  .join("\n");
                const detalle = revisionDeDetalle(`${proyecto.files[proyecto.entry] ?? ""}\n${cssProyecto}`, encargo);
                if (detalle?.reparacion) {
                  const criticos = detalle.informe.hallazgos.filter((h) => h.gravedad === "critico");
                  for (const h of criticos.slice(0, 2)) {
                    useFailures.getState().record("sandbox", `Detalle: ${h.titulo}`, h.correccion, "warn");
                  }
                  if (!quedan) {
                    toast.warning("A la página le falta contenido", {
                      description: resumenRevisionDetalle(detalle.informe),
                      duration: 9000,
                    });
                    return;
                  }
                  addMessage(sessionId, {
                    id: uid(),
                    role: "user",
                    content: detalle.reparacion,
                    createdAt: Date.now(),
                    instruction: true,
                  });
                  toast.warning("A la página le falta contenido", {
                    description: `${resumenRevisionDetalle(detalle.informe)} Ampliándola (${revisiones + 1} de ${MAX_REVISIONES}).`,
                    duration: 8000,
                  });
                  relanzar(sessionId, depth, continuaciones, undefined, revisiones + 1);
                  return;
                }
                if (salida.ejecutado) {
                  toast.success("El agente probó su código", {
                    description: `${resumenRevision(salida)}${inf?.hecho ? ` ${resumenBotones(inf)}` : ""}`,
                    duration: 6000,
                  });
                }
                return;
              }
              // Memoria de fallos: esto ha salido de EJECUTAR el código,
              // no de una impresión. Es exactamente lo que esa memoria
              // debe guardar.
              const regla = reglaDeFallo(salida);
              if (regla) {
                useFailures.getState().record("sandbox", regla.titulo, regla.regla, "error");
              }
              if (!quedan) {
                toast.error("El código sigue fallando", {
                  description: avisoRevisionAgotada(salida),
                  duration: 9000,
                });
                return;
              }
              addMessage(sessionId, {
                id: uid(),
                role: "user",
                content: promptDeCorreccion(salida, proyecto.entry),
                createdAt: Date.now(),
                instruction: true,
              });
              toast.warning("El agente encontró errores en su código", {
                description: `${resumenRevision(salida)} Corrigiéndolo solo (${revisiones + 1} de ${MAX_REVISIONES}).`,
                duration: 7000,
              });
              relanzar(sessionId, depth, continuaciones, undefined, revisiones + 1);
            })();
          }
          // Lectura automática de la respuesta (Ajustes → Chat)
          if (useForja.getState().settings.autoSpeak && content.trim()) {
            speak({ text: content });
          }
          break;
        }
      } catch (err) {
        paint(true);
        const aborted = err instanceof DOMException && err.name === "AbortError";
        if (aborted) {
          if (content) {
            const s = separarEtiquetasPensamiento(content, reasoning);
            updateMessage(sessionId, assistantId, {
              content: s.contenido + "\n\n_(detenido)_",
              reasoning: s.razonamiento || undefined,
              elapsedMs: Date.now() - startedAt,
            });
          } else {
            deleteMessage(sessionId, assistantId);
          }
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          updateMessage(sessionId, assistantId, {
            content: content ? content : msg,
            error: !content,
            elapsedMs: Date.now() - startedAt,
          });
          if (content) toast.error("Error a mitad de la respuesta", { description: msg });
        }
      } finally {
        abortRef.current = null;
        setStreamingMsgId(null);
      }
    },
    [addMessage, updateMessage, deleteMessage, resolveModel, composeSettings, piezasDelPrompt, updateProjectMap, attemptFailover, relanzar, sandboxInitial, numDocs, numAdjuntos, setFocusProvider, setSettingsOpen, aplicarArchivosAgenteRef, reglasAutorizadasRef, undoMapRef, forzarUndoRender, runWithTools]
  );

  // mantener la referencia fresca para los reintentos del failover
  runGenRef.current = runGeneration;

  /** Genera una imagen gratis (Pollinations) y la añade como mensaje del asistente */
  const sendImage = useCallback(
    async (prompt: string) => {
      const sessionId = ensureSession();
      addMessage(sessionId, {
        id: uid(),
        role: "user",
        content: prompt,
        createdAt: Date.now(),
      });
      const assistantId = uid();
      addMessage(sessionId, {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      });
      setStreamingMsgId(assistantId);
      stickToBottomRef.current = true;
      try {
        const url = buildImageUrl(prompt);
        await preloadImage(url);
        updateMessage(sessionId, assistantId, {
          content: `🖼️ Imagen generada para: ${prompt}`,
          generatedImage: { url, prompt },
          elapsedMs: undefined,
        });
      } catch (e) {
        updateMessage(sessionId, assistantId, {
          content: e instanceof Error ? e.message : "No se pudo generar la imagen",
          error: true,
        });
      } finally {
        setStreamingMsgId(null);
      }
    },
    [ensureSession, addMessage, updateMessage, stickToBottomRef]
  );

  /**
   * Modo consenso: la misma petición a varios modelos a la vez y una pasada
   * final que combina lo mejor de todas.
   *
   * No es un debate de varias rondas: eso multiplica el coste por el número de
   * modelos EN CADA RONDA y con capas gratuitas los 429 lo cortarían a medias.
   * Aquí son N llamadas en paralelo más UNA de síntesis.
   */
  const runConsensus = useCallback(
    async (sessionId: string, pregunta: string) => {
      const st = useForja.getState();
      const _health = useHealth.getState();
      const panel = pickPanel(st.providers, {
        vetados: st.settings.proveedoresVetados ?? [],
        soloGratis: st.settings.onlyFree,
        favoritos: st.favorites,
        enCooldown: (k) => {
          const h = useHealth.getState();
          const split = splitModelKey(k);
          if (cooldownRemaining(h.entries[k]) > 0) return true;
          return split ? providerCooldownRemaining(h.providerEntries[split.providerId]) > 0 : false;
        },
      });

      if (panel.length < 2) {
        toast.warning("El consenso necesita al menos dos proveedores", {
          description:
            "Conecta otro en Ajustes → Proveedores (Gemini, Groq y OpenRouter tienen capa gratis). Mientras tanto se responde de la forma normal.",
          duration: 10_000,
        });
        void runGeneration(sessionId);
        return;
      }

      const assistantId = uid();
      addMessage(sessionId, {
        id: assistantId,
        role: "assistant",
        content: "",
        model: makeModelKey(panel[0].providerId, panel[0].modelId),
        createdAt: Date.now(),
      });
      setStreamingMsgId(assistantId);
      stickToBottomRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;
      const empezó = Date.now();
      let hechos = 0;
      const marcar = () =>
        updateMessage(sessionId, assistantId, {
          content: `_${estadoPanel(hechos, panel.length)}_`,
        });
      marcar();

      const mensajes = [{ role: "user" as const, content: pregunta }];
      const ajustes = { ...composeSettings(sessionId), stream: false };

      /** Cada panelista responde entero; el fallo de uno no tumba la tanda. */
      const preguntar = async (p: Panelista): Promise<RespuestaPanel | null> => {
        try {
          const texto = await streamChat({
            providerId: p.providerId,
            config: useForja.getState().providers[p.providerId],
            modelId: p.modelId,
            messages: mensajes,
            settings: ajustes,
            signal: controller.signal,
            onDelta: () => {},
            onDone: () => {},
          });
          useHealth.getState().recordSuccess(makeModelKey(p.providerId, p.modelId));
          return texto.trim() ? { panelista: p, texto } : null;
        } catch (err) {
          useHealth
            .getState()
            .recordFailure(makeModelKey(p.providerId, p.modelId), statusFromError(err));
          return null;
        } finally {
          hechos++;
          marcar();
        }
      };

      try {
        const crudas = await Promise.all(panel.map(preguntar));
        const respuestas = crudas.filter((r): r is RespuestaPanel => !!r);

        if (!respuestas.length) {
          updateMessage(sessionId, assistantId, {
            content: "Ningún modelo del panel respondió. Revisa tus claves en Ajustes.",
            error: true,
          });
          return;
        }

        // Con una sola respuesta no hay nada que combinar: se entrega tal cual.
        if (!necesitaSintesis(respuestas)) {
          const sola = respuestas[0];
          updateMessage(sessionId, assistantId, {
            content: sola.texto,
            model: makeModelKey(sola.panelista.providerId, sola.panelista.modelId),
            elapsedMs: Date.now() - empezó,
          });
          return;
        }

        const juez = pickSintetizador(panel, respuestas.map((r) => r.panelista));
        if (!juez) return;

        updateMessage(sessionId, assistantId, {
          content: `_${estadoPanel(panel.length, panel.length)}_`,
          model: makeModelKey(juez.providerId, juez.modelId),
        });

        let salida = "";
        await streamChat({
          providerId: juez.providerId,
          config: useForja.getState().providers[juez.providerId],
          modelId: juez.modelId,
          messages: [{ role: "user", content: synthesisPrompt(pregunta, respuestas) }],
          settings: composeSettings(sessionId),
          signal: controller.signal,
          onDelta: (t) => {
            salida = t;
            updateMessage(sessionId, assistantId, { content: t });
          },
          onDone: (full) => {
            salida = full;
          },
        });

        updateMessage(sessionId, assistantId, {
          content: salida,
          elapsedMs: Date.now() - empezó,
          consensusOf: respuestas.length,
        });
      } catch (err) {
        const abortada = err instanceof DOMException && err.name === "AbortError";
        if (!abortada) {
          updateMessage(sessionId, assistantId, {
            content: err instanceof Error ? err.message : "Falló el consenso",
            error: true,
          });
        }
      } finally {
        setStreamingMsgId(null);
        abortRef.current = null;
      }
    },
    [addMessage, updateMessage, composeSettings, runGeneration, stickToBottomRef]
  );

  /**
   * Un director reparte, varios ejecutan, el director da el veredicto.
   *
   * El director es TU modelo actual —el que hayas elegido, típicamente el
   * bueno— y los ejecutores salen del panel de gratis. Esa es la gracia: el
   * que razona y verifica es el que pagas; los baratos hacen trabajo acotado.
   *
   * El coste está acotado por diseño y no por suerte: `2 + n` llamadas y se
   * acabó. No hay bucle, no hay «una ronda más», y el número se dice ANTES de
   * arrancar (ver `orquesta.ts`).
   */
  const runOrquesta = useCallback(
    async (sessionId: string, encargo: string) => {
      const director = resolveModel();
      if (!director) {
        toast.error("Elige primero el modelo que va a dirigir", {
          description: "El director es el modelo que tengas seleccionado: normalmente, el mejor que tengas.",
        });
        return;
      }

      // Ejecutores: gratis y de OTROS proveedores. Repetir el del director
      // sería pagarle dos veces por el mismo sesgo.
      const h = useHealth.getState();
      const ejecutores = pickPanel(useForja.getState().providers, {
        vetados: useForja.getState().settings.proveedoresVetados ?? [],
        max: EJECUTORES_POR_DEFECTO,
        soloGratis: true,
        favoritos: useForja.getState().favorites,
        enCooldown: (k) => {
          if (cooldownRemaining(h.entries[k]) > 0) return true;
          const split = splitModelKey(k);
          return split ? providerCooldownRemaining(h.providerEntries[split.providerId]) > 0 : false;
        },
      }).filter((e) => e.providerId !== director.providerId);

      if (!ejecutores.length) {
        toast.warning("No hay ejecutores disponibles", {
          description:
            "Hacen falta modelos gratis de OTRO proveedor distinto al del director. Conecta uno en Ajustes → Proveedores. Mientras tanto se responde de la forma normal.",
          duration: 10_000,
        });
        void runGeneration(sessionId);
        return;
      }

      const aviso = avisoPrevio(ejecutores.length, encargo);
      const assistantId = uid();
      addMessage(sessionId, {
        id: assistantId,
        role: "assistant",
        content: "",
        model: makeModelKey(director.providerId, director.modelId),
        createdAt: Date.now(),
      });
      setStreamingMsgId(assistantId);
      stickToBottomRef.current = true;
      // El número de llamadas se dice ANTES, no después: es lo que convierte
      // esto en una herramienta y no en una ruleta.
      toast.info(`Dirigiendo a ${ejecutores.length} modelos`, { description: aviso.texto });

      const controller = new AbortController();
      abortRef.current = controller;
      const empezó = Date.now();
      const pintar = (t: string) => updateMessage(sessionId, assistantId, { content: `_${t}_` });

      /** Una llamada suelta, sin streaming: aquí solo interesa el texto final. */
      const preguntar = async (
        quien: { providerId: ProviderId; modelId: string },
        prompt: string,
        /** los ejecutores ven SOLO su trozo: tampoco el plano del encargo */
        soloSuTrozo = false
      ): Promise<string> =>
        streamChat({
          providerId: quien.providerId,
          config: useForja.getState().providers[quien.providerId],
          modelId: quien.modelId,
          messages: [{ role: "user", content: prompt }],
          settings: { ...composeSettings(sessionId, { sinPlano: soloSuTrozo }), stream: false },
          signal: controller.signal,
          onDelta: () => {},
          onDone: () => {},
        });

      try {
        // ——— 1. El director reparte ———
        pintar(estadoOrquesta("repartiendo"));
        const repartoTexto = await preguntar(director, promptDeReparto(encargo, ejecutores.length));
        const subs = parseReparto(repartoTexto, ejecutores.length);

        // Un reparto ilegible no para el trabajo: se hace del tirón. Gastar la
        // llamada del director para acabar sin respuesta sería lo peor de los
        // dos mundos.
        if (repartoFallido(subs)) {
          toast.info("El director no pudo repartir el trabajo", {
            description: "Se responde de la forma normal, sin equipo.",
          });
          deleteMessage(sessionId, assistantId);
          setStreamingMsgId(null);
          abortRef.current = null;
          void runGeneration(sessionId);
          return;
        }

        // ——— 2. Los ejecutores, en paralelo ———
        let hechos = 0;
        pintar(estadoOrquesta("ejecutando", 0, subs.length));
        const resultados: Resultado[] = await Promise.all(
          subs.map(async (sub, i) => {
            const quien = ejecutores[i % ejecutores.length];
            const t0 = Date.now();
            try {
              // El ejecutor recibe SU trozo y nada más: ni la conversación, ni
              // lo de los demás. Más barato y menos superficie.
              const texto = await preguntar(quien, promptDeEjecutor(sub), true);
              useHealth.getState().recordSuccess(makeModelKey(quien.providerId, quien.modelId));
              return { sub, quien, texto, ms: Date.now() - t0 };
            } catch (err) {
              useHealth
                .getState()
                .recordFailure(makeModelKey(quien.providerId, quien.modelId), statusFromError(err));
              return {
                sub,
                quien,
                texto: "",
                error: err instanceof Error ? err.message : "no respondió",
                ms: Date.now() - t0,
              };
            } finally {
              hechos++;
              pintar(estadoOrquesta("ejecutando", hechos, subs.length));
            }
          })
        );

        // ——— 3. El director revisa y cierra ———
        pintar(estadoOrquesta("veredicto"));
        let salida = "";
        await streamChat({
          providerId: director.providerId,
          config: useForja.getState().providers[director.providerId],
          modelId: director.modelId,
          messages: [{ role: "user", content: promptDeVeredicto(encargo, resultados) }],
          settings: composeSettings(sessionId),
          signal: controller.signal,
          onDelta: (t) => {
            salida = t;
            updateMessage(sessionId, assistantId, { content: t });
          },
          onDone: (full) => {
            salida = full;
          },
        });

        const entregaron = resultados.filter((r) => !r.error && r.texto.trim()).length;
        updateMessage(sessionId, assistantId, {
          content: salida,
          elapsedMs: Date.now() - empezó,
          orquesta: { ejecutores: subs.length, entregaron, llamadas: aviso.llamadas },
        });
        updateProjectMap(sessionId, salida);
      } catch (err) {
        const abortada = err instanceof DOMException && err.name === "AbortError";
        if (!abortada) {
          updateMessage(sessionId, assistantId, {
            content: err instanceof Error ? err.message : "Falló la dirección del equipo",
            error: true,
          });
        }
      } finally {
        setStreamingMsgId(null);
        abortRef.current = null;
      }
    },
    [addMessage, updateMessage, deleteMessage, composeSettings, resolveModel, runGeneration, updateProjectMap, stickToBottomRef]
  );

  return {
    runGeneration,
    runConsensus,
    runOrquesta,
    sendImage,
    setModelKey,
    streamingMsgId,
    setStreamingMsgId,
    abortRef,
  };
}
