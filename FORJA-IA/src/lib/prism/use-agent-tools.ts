"use client";
/** Forja IA — Bucle de tools del agente (PLAN-V4 punto 5).
 *
 * El bloque de `runGeneration` que maneja `probeTools` + el bucle de
 * `tool_calls` vivía dentro de `chat-app.tsx` (unas 130 líneas). Aquí
 * se extrae para:
 *   - Reducir `chat-app.tsx` (que ya tiene 2200+ líneas).
 *   - Aislar la lógica de tools para poder testearla sin React.
 *   - Dejar claro que el bucle es una pieza intercambiable: cuando se
 *     añadan más herramientas, solo se toca este archivo.
 *
 * La lógica vive en `ejecutarConTools`, una función normal: estaba dentro
 * del `useCallback` y por eso NO se podía probar sin React, justo lo que
 * este archivo decía perseguir. El hook es ahora una envoltura fina.
 */
import { useCallback, useRef } from "react";
import { streamChat, type StreamOptions, type StreamMessage } from "./chat-client";
import { TOOL_CATALOG, type ToolCall, type ToolResult } from "./tools-catalog";
import { runTools, type ToolContext, type VisionOutcome } from "./tool-runner";
import { probeTools, supportsTools, type ToolsSupport } from "./tools-probe";
import { buildToolResultMessage } from "./tools-translate";
import { runProjectInMemory } from "./sandbox-runner";
import { runJsInMemory } from "./js-repl";
import { promptCritica } from "./screenshot";
import { parseLlamadasEnTexto, pareceLlamadaEnTexto, quitarLlamadasEnTexto } from "./tool-calls-texto";
import { useLlamadasTexto } from "./llamadas-texto-medidas";
import { makeModelKey, type ProviderId, type ProjectMap, type ProviderConfig, type AppSettings, type Attachment } from "./types";
import { PROVIDER_MAP } from "./providers";
import type { SandboxSeed } from "./sandbox";
import type { ReglaNo } from "./reglas-no";
import {
  PERMISOS_POR_DEFECTO,
  filtrarCatalogo,
  type PermisosConcedidos,
} from "./tool-permissions";

/** Lo que `visual_review` necesita para llamar a un modelo con visión: el
 * MISMO proveedor/modelo/clave de la conversación en curso (decisión: no
 * hay un modelo de visión aparte, si el activo no admite imágenes la
 * herramienta lo dice y no se ejecuta). `stream` es inyectable para poder
 * testear sin red, igual que `DepsTools.stream`. */
export interface VisionDeps {
  providerId: ProviderId;
  modelId: string;
  config: ProviderConfig;
  settings: AppSettings;
  signal: AbortSignal;
  stream: typeof streamChat;
}

export interface AgentToolsState {
  /** Último resultado del probe de tools (para UI: chip «Soporta tools»). */
  lastSupport: ToolsSupport | null;
}

/** Instrucción de cierre cuando se agotan las vueltas de herramientas.
 * Se exporta porque los tests comprueban que este mensaje SE ENVÍA: antes
 * se construía y se tiraba (ver `ejecutarConTools`). */
export const CIERRE_TOOLS =
  "Has llegado al límite de iteraciones con herramientas. Entrega AHORA la respuesta final al usuario, con lo que ya tienes y sin llamar a más herramientas. Si la última verificación contiene FAIL o evidencia incompleta, NO afirmes que el proyecto está correcto: declara exactamente qué quedó sin verificar o qué fallo persiste.";

/** Construye el contexto de herramientas a partir del estado del Sandbox.
 * Si no hay proyecto, los archivos están vacíos y `run_project` devuelve
 * un mensaje claro ("no tiene archivos").
 *
 * Exportada desde la v3.32: los tests del bucle la usan para comprobar
 * que los archivos escritos por una vuelta sobreviven a la siguiente. */
export function buildToolContext(
  sandboxInitial: SandboxSeed | null,
  projectMap: ProjectMap | null = null,
  permisos: PermisosConcedidos = PERMISOS_POR_DEFECTO,
  reglasNo: readonly ReglaNo[] = [],
  reglasAutorizadas: readonly string[] = [],
  vision?: VisionDeps
): ToolContext {
  const files = sandboxInitial?.files
    ? Object.fromEntries(sandboxInitial.files.map((f) => [f.path, f.content]))
    : {};
  return {
    projectFiles: files,
    runProject: async (opts) => runProjectInMemory(files, opts ?? {}),
    getQuota: () => null,
    // REPL aislado para run_js (iframe oculto, sin acceso a las claves)
    runJs: (code) => runJsInMemory(code),
    // Mapa de la sesión para `ask_memory`. Es una lectura: la herramienta no
    // lo modifica, así que se pasa tal cual y no hay nada que devolver.
    projectMap,
    // Lo que el usuario permite. El runner lo comprueba antes de cada llamada.
    permisos,
    // Y lo que ha prohibido tocar: se comprueba antes de cada escritura.
    reglasNo,
    // …salvo lo que autorizó para ESTE envío (modal «Autorizar una vez»).
    reglasAutorizadas,
    // `visual_review`: una llamada aparte de `streamChat` con la captura
    // como adjunto, contra el MISMO modelo de la conversación. Sin `vision`
    // (test, o llamador que no lo necesita) la herramienta lo dice en vez
    // de fingir una crítica.
    visionCritique: vision ? (dataUrl, foco) => pedirCritica(vision, dataUrl, foco) : undefined,
  };
}

/** La llamada de visión propiamente dicha: un `streamChat` de un solo turno,
 * con la captura como adjunto. Si el proveedor rechaza la imagen,
 * `streamChat` ya lanza con el aviso «no admite imágenes» incluido en el
 * mensaje (`chat-client.ts`, `assertOk`) — aquí solo se reconoce ESE texto
 * para no reinventar la detección de `esFalloDeImagen`. */
async function pedirCritica(
  vision: VisionDeps,
  dataUrl: string,
  foco?: string
): Promise<VisionOutcome> {
  const captura: Attachment = {
    id: "captura-visual",
    name: "captura.jpg",
    mediaType: "image/jpeg",
    dataUrl,
    size: dataUrl.length,
  };
  try {
    const texto = await vision.stream({
      providerId: vision.providerId,
      config: vision.config,
      modelId: vision.modelId,
      messages: [{ role: "user", content: promptCritica(foco), attachments: [captura] }] as StreamMessage[],
      settings: vision.settings,
      signal: vision.signal,
      onDelta: () => {},
      onDone: () => {},
    });
    return { ok: true, texto };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no admite imágenes")) {
      return {
        ok: false,
        texto: "El modelo activo no admite imágenes. Elige un modelo con visión para usar «visual_review».",
      };
    }
    return { ok: false, texto: `No se pudo obtener la crítica visual: ${msg}` };
  }
}

/** Inyectable en tests: por defecto el cliente real. */
export interface DepsTools {
  stream: typeof streamChat;
  probe: typeof probeTools;
}

const DEPS_REALES: DepsTools = { stream: streamChat, probe: probeTools };

/** Ejecuta una llamada al modelo con soporte de tools. Si el modelo
 * soporta tools Y el modo agente está activo, hace el bucle:
 * streamChat → si hay tool_calls → ejecuta localmente → reinyecta →
 * siguiente vuelta. Si no soporta tools, una sola llamada.
 *
 * @param baseOpts Opciones base de `streamChat` (providerId, modelId,
 *   messages, settings, signal, callbacks). Se añade `tools` si
 *   corresponde y el bucle se maneja aquí dentro.
 * @param agentOn Si el modo agente está activo (sin él, no se pasa el
 *   catálogo).
 * @param maxLoops Máximo de vueltas con herramientas (mismo techo que el
 *   bucle XML). Al agotarlas se hace UNA llamada más, ya sin tools, para
 *   que el modelo cierre: sin ella el agente se quedaba mudo.
 * @param sandboxInitial Proyecto activo del Sandbox (para `run_project`).
 * @param config Config del proveedor (clave fresca).
 * @param onSupport Callback con el resultado del probe.
 * @param deps Inyectable en tests.
 * @param onProjectFiles Se llama tras cada tanda de tools con el mapa de
 *   archivos ACTUAL del proyecto. Hasta la v3.31 el contexto se
 *   reconstruía en cada vuelta desde el seed: un write_file de la
 *   iteración 1 desaparecía en la iteración 2, y nada de lo que el
 *   agente escribió llegaba a verse en el Sandbox. Ahora el contexto
 *   es UNO para todo el bucle y este callback deja que la UI recoja
 *   el resultado (seed al Sandbox) cuando el agente lo cambia.
 * @param projectMap Mapa del proyecto de la sesión, para `ask_memory`. Es
 *   solo de lectura: la herramienta consulta, no reescribe la memoria.
 * @param permisos Lo que el usuario permite hacer al agente. Recorta el
 *   catálogo que se le ofrece al modelo Y viaja en el contexto para que el
 *   runner lo compruebe antes de cada llamada.
 * @param reglasNo Memoria negativa: archivos que no se pueden tocar. El runner
 *   rechaza la escritura; el prompt ya se lo había dicho al modelo.
 * @param reglasAutorizadas Ids de reglas que el usuario autorizó para ESTE
 *   envío (modal de memoria negativa). Solo afecta a este turno.
 * @returns El texto final del modelo.
 */
export async function ejecutarConTools(
  baseOpts: Omit<StreamOptions, "tools">,
  agentOn: boolean,
  maxLoops: number,
  sandboxInitial: SandboxSeed | null,
  config: { apiKey: string; baseUrl?: string },
  onSupport?: (s: ToolsSupport) => void,
  deps: DepsTools = DEPS_REALES,
  onProjectFiles?: (files: Record<string, string>) => void,
  projectMap: ProjectMap | null = null,
  permisos: PermisosConcedidos = PERMISOS_POR_DEFECTO,
  reglasNo: readonly ReglaNo[] = [],
  reglasAutorizadas: readonly string[] = []
): Promise<string> {
  const providerId = baseOpts.providerId as ProviderId;

  // Catálogo recortado a lo que el usuario permite. Es la PRIMERA capa: al
  // modelo ni se le describen las herramientas que se le van a rechazar, así
  // no gasta contexto en ellas ni se queda reintentando. La segunda capa —la
  // que de verdad manda— está en `tool-runner.ts`.
  const catalogo = filtrarCatalogo(TOOL_CATALOG, permisos);

  // ——— ¿El modelo soporta tools? ———
  // La prueba es cara (un round-trip) y se cachea por modelo+clave.
  // Si soporta tools Y el modo agente está activo, se le pasa el
  // catálogo. Si no soporta tools, se cae al camino XML.
  let toolSupport: ToolsSupport = "desconocido";
  if (agentOn && catalogo.length) {
    try {
      // El probe lleva el catálogo YA filtrado: solo comprueba si el modelo
      // entiende `tools`, y no hay razón para describirle al proveedor
      // herramientas que el usuario apagó.
      const probe = await deps.probe(
        providerId,
        config as never,
        baseOpts.modelId,
        baseOpts.signal,
        catalogo
      );
      toolSupport = probe.support;
    } catch {
      toolSupport = "desconocido";
    }
  }
  onSupport?.(toolSupport);
  const useToolPath = supportsTools(toolSupport) && agentOn;

  // Historial que se va ampliando con cada vuelta.
  let convo: StreamMessage[] = [...baseOpts.messages];
  let content = "";
  const loops = Math.max(1, Math.min(8, maxLoops));

  // UN contexto para todo el bucle (v3.32): los archivos que el agente
  // escribe o restaura en una vuelta existen en la siguiente. Antes se
  // reconstruía por vuelta desde el seed y el agente perdía su propio
  // trabajo entre iteraciones.
  const tctx = buildToolContext(sandboxInitial, projectMap, permisos, reglasNo, reglasAutorizadas, {
    providerId,
    modelId: baseOpts.modelId,
    config: baseOpts.config,
    settings: baseOpts.settings,
    signal: baseOpts.signal,
    stream: deps.stream,
  });

  /** Una vuelta de stream. Devuelve las tools que pidió el modelo.
   * El texto se guarda en `content`: antes se declaraba la variable y
   * NUNCA se le asignaba el retorno de `streamChat`, así que los turnos
   * que se reinyectaban al modelo iban con el contenido vacío y el
   * agente perdía su propio trabajo entre vueltas. */
  const vuelta = async (conTools: boolean, primera: boolean): Promise<ToolCall[]> => {
    if (!primera) {
      // limpiar lo pintado de la vuelta anterior para que el llamador
      // repinte el texto nuevo y no lo concatene
      content = "";
      baseOpts.onDelta("");
      baseOpts.onReasoning?.("");
    }
    const pedidas: ToolCall[] = [];
    content = await deps.stream({
      ...baseOpts,
      messages: convo,
      ...(conTools ? { tools: catalogo } : {}),
      onToolCalls: (calls) => {
        pedidas.push(...calls);
      },
    });
    return pedidas;
  };

  for (let loop = 0; loop < loops; loop++) {
    if (baseOpts.signal.aborted) break;

    let pendingToolCalls = await vuelta(useToolPath, loop === 0);

    // Fallback: el modelo pidió la herramienta como TEXTO plano, con SU
    // PROPIA plantilla de function-calling (`<function=…><parameter=…>`),
    // en vez de rellenar `tool_calls` de la API — confirmado con
    // nvidia/nemotron vía OpenRouter, que la sirve así aunque haya pasado
    // el probe de soporte. Sin esto, esa plantilla se enseñaba literal en
    // la burbuja y la herramienta nunca se ejecutaba.
    if (useToolPath && !pendingToolCalls.length && pareceLlamadaEnTexto(content)) {
      const llamadasTexto = parseLlamadasEnTexto(content);
      if (llamadasTexto.length) {
        pendingToolCalls = llamadasTexto;
        // lo que sobre de texto (normalmente nada) sí se enseña; la
        // plantilla de la llamada, no.
        content = quitarLlamadasEnTexto(content);
        baseOpts.onDelta(content);
        // El probe decía "sí soporta tools" y aun así llegó como texto: se
        // queda anotado para este modelo (llamadas-texto-medidas.ts). El
        // probe por sí solo nunca lo habría sabido — esto SÍ lo vio pasar.
        useLlamadasTexto.getState().anotar(makeModelKey(providerId, baseOpts.modelId));
      }
    }

    // Si no pidió tools, el bucle termina aquí.
    if (!pendingToolCalls.length || !useToolPath) return content;

    // Ejecutar tools localmente y reinyectar los resultados.
    const results: ToolResult[] = await runTools(pendingToolCalls, tctx);

    // Verificación automática después de CUALQUIER escritura. El agente no
    // debe tener que acordarse de pedir verify_project: si acaba de cambiar
    // el proyecto, Forja vuelve a ejecutarlo y le entrega evidencia objetiva
    // en la misma conversación — editar → ejecutar → verificar → corregir,
    // en vez de depender de una promesa textual del modelo. No se duplica
    // si el modelo ya llamó verify_project en esta misma tanda.
    //
    // La llamada sintética se añade TAMBIÉN a `pendingToolCalls` (no solo a
    // `results`): un mensaje `tool` cuyo `tool_call_id` el turno assistant
    // anterior nunca anunció es un body inválido para la API real de
    // OpenAI/Anthropic — las dos exigen que cada tool_result case con un
    // tool_call/tool_use del turno previo, o responden 400. El mock de
    // pruebas no lo exige, así que este desajuste no se habría visto aquí.
    const mutatingTools = new Set(["write_file", "edit_file", "apply_patch"]);
    const cambioProyecto = pendingToolCalls.some((tc) => mutatingTools.has(tc.name));
    const yaVerifico = pendingToolCalls.some((tc) => tc.name === "verify_project");
    if (cambioProyecto && !yaVerifico && Object.keys(tctx.projectFiles).length) {
      // `silencioso`: no deja esta ejecución como referencia para
      // `run_regression` (ver el comentario en `runVerifyProject`,
      // tool-runner.ts) — el modelo no pidió esta comprobación, así que no
      // debe cambiarle en silencio el «antes» de una medida futura.
      const autoVerifyCall: ToolCall = { id: `auto-verify-${loop + 1}`, name: "verify_project", args: { silencioso: true } };
      const [autoResult] = await runTools([autoVerifyCall], tctx);
      pendingToolCalls = [...pendingToolCalls, autoVerifyCall];
      results.push(autoResult);
    }

    // La UI (chat-app) recoge el estado actual del proyecto: lo que el
    // agente acaba de escribir/editar/restaurar llega al Sandbox.
    onProjectFiles?.({ ...tctx.projectFiles });
    const def = PROVIDER_MAP[providerId];
    convo = [
      ...convo,
      {
        role: "assistant" as const,
        content,
        tool_calls: pendingToolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        })),
      } as StreamMessage,
      ...results.map((r) => buildToolResultMessage(def.protocol, r) as StreamMessage),
    ];
  }

  // Se agotaron las vueltas y el modelo seguía pidiendo herramientas.
  //
  // Aquí estaba el fallo que dejaba al agente mudo: se construía este
  // mensaje de cierre y se hacía `continue`, que salía del bucle sin
  // enviarlo nunca. El usuario veía la burbuja vacía y el trabajo parado.
  // Ahora se manda de verdad, y sin tools para que no pueda pedir más.
  if (useToolPath && !baseOpts.signal.aborted) {
    convo = [...convo, { role: "user" as const, content: CIERRE_TOOLS } as StreamMessage];
    await vuelta(false, false);
  }

  return content;
}

export function useAgentTools() {
  const stateRef = useRef<AgentToolsState>({ lastSupport: null });

  const runWithTools = useCallback(
    (
      baseOpts: Omit<StreamOptions, "tools">,
      agentOn: boolean,
      maxLoops: number,
      sandboxInitial: SandboxSeed | null,
      config: { apiKey: string; baseUrl?: string },
      onProjectFiles?: (files: Record<string, string>) => void,
      projectMap?: ProjectMap | null,
      permisos?: PermisosConcedidos,
      reglasNo?: readonly ReglaNo[],
      reglasAutorizadas?: readonly string[]
    ): Promise<string> =>
      ejecutarConTools(
        baseOpts,
        agentOn,
        maxLoops,
        sandboxInitial,
        config,
        (s) => {
          stateRef.current.lastSupport = s;
        },
        undefined,
        onProjectFiles,
        projectMap ?? null,
        permisos ?? PERMISOS_POR_DEFECTO,
        reglasNo ?? [],
        reglasAutorizadas ?? []
      ),
    []
  );

  return { runWithTools, stateRef };
}
