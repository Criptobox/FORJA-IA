/** Forja IA — Rutas de OpenCode Zen: todos los modelos gratis, con herramientas.
 *
 * Zen no sirve todos sus modelos por el mismo endpoint: los GPT van por
 * `/responses`, Claude y MiniMax por `/messages` (formato Anthropic) y el resto
 * por `/chat/completions`. Forja IA hablaba solo `/chat/completions` y apartaba
 * lo demás del selector.
 *
 * La idea de este módulo es no tocar el bucle del agente: el agente sigue
 * hablando OpenAI (assistant con `tool_calls`, mensajes `role: "tool"`), y aquí
 * se traduce SOLO el cable. La petición OpenAI ya construida se convierte al
 * cuerpo de la ruta, y lo que vuelve (cuerpo o eventos SSE) se convierte de
 * nuevo a trozos con forma OpenAI. Así razonamiento, herramientas, motivo de
 * parada y uso pasan por el mismo código de siempre.
 *
 * Todo lo de este archivo es puro: se prueba sin red. */

/** `gemini` se reconoce para apartarlo del selector, pero no se habla todavía. */
export type RutaZen = "chat" | "responses" | "messages" | "gemini";

/** Las rutas que Forja IA sabe hablar. */
export const RUTAS_HABLADAS: readonly RutaZen[] = ["chat", "responses", "messages"];

type Json = Record<string, unknown>;

/* ------------------------------------------------------------------ */
/* qué ruta usa cada modelo                                            */
/* ------------------------------------------------------------------ */

/** Ruta que Zen documenta para ese modelo, por su nombre. Es solo el punto de
 * partida: el sondeo prueba las demás si esa falla y recuerda la que funciona
 * (los nombres cambian más rápido que este archivo). */
export function rutaPorNombre(id: string): RutaZen {
  const m = id.trim().toLowerCase();
  if (/^gemini/.test(m)) return "gemini";
  if (/^(gpt-|o\d)/.test(m)) return "responses";
  if (/^(claude|minimax)/.test(m)) return "messages";
  return "chat";
}

/** ¿Sabe Forja IA hablar con este modelo? Hoy: todo menos Gemini. */
export function rutaSoportada(id: string): boolean {
  return rutaPorNombre(id) !== "gemini";
}

export interface AlmacenRutas {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

const CLAVE_ALMACEN = "forja-zen-rutas";

function almacenPorDefecto(): AlmacenRutas | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Rutas que el sondeo comprobó que funcionan: `{ "gpt-5-nano": "responses" }`. */
export function rutasAprendidas(almacen: AlmacenRutas | null = almacenPorDefecto()): Record<string, RutaZen> {
  if (!almacen) return {};
  try {
    const crudo = JSON.parse(almacen.getItem(CLAVE_ALMACEN) ?? "{}") as unknown;
    if (!crudo || typeof crudo !== "object") return {};
    const out: Record<string, RutaZen> = {};
    for (const [id, ruta] of Object.entries(crudo as Json)) {
      if (typeof ruta === "string" && (RUTAS_HABLADAS as readonly string[]).includes(ruta)) out[id] = ruta as RutaZen;
    }
    return out;
  } catch {
    return {};
  }
}

/** Anota la ruta que funcionó para ese modelo. */
export function recordarRuta(id: string, ruta: RutaZen, almacen: AlmacenRutas | null = almacenPorDefecto()): void {
  if (!almacen || !(RUTAS_HABLADAS as readonly string[]).includes(ruta)) return;
  try {
    const actual = rutasAprendidas(almacen);
    if (actual[id.trim()] === ruta) return;
    almacen.setItem(CLAVE_ALMACEN, JSON.stringify({ ...actual, [id.trim()]: ruta }));
  } catch {
    /* sin almacenamiento: se vuelve a probar la próxima vez */
  }
}

/** La ruta con la que se llama al modelo: la comprobada, o la del nombre. */
export function rutaZen(id: string, almacen: AlmacenRutas | null = almacenPorDefecto()): RutaZen {
  return rutasAprendidas(almacen)[id.trim()] ?? rutaPorNombre(id);
}

/** Orden en que probar las rutas de un modelo: la suya primero y luego las
 * otras que se hablan. */
export function ordenDeRutas(id: string, almacen: AlmacenRutas | null = almacenPorDefecto()): RutaZen[] {
  const primera = rutaZen(id, almacen);
  return [primera, ...RUTAS_HABLADAS.filter((r) => r !== primera)];
}

/** ¿Este fallo huele a «modelo en otra ruta» (y no a modelo retirado, falta de
 * clave o tope de uso)? Solo entonces merece la pena probar otra ruta. */
export function esErrorDeRuta(status: number, cuerpo: string): boolean {
  if (![400, 404, 405, 415, 422].includes(status)) return false;
  return !/model is unavailable|deprecated|no longer|free[\s_-]?tier|rate.?limit|usage.?limit/i.test(cuerpo);
}

export function pathDeRuta(ruta: RutaZen): string {
  if (ruta === "responses") return "/responses";
  if (ruta === "messages") return "/messages";
  return "/chat/completions";
}

/** Cabeceras de autenticación de la ruta. En `/messages` van las dos formas
 * (`x-api-key` y `Authorization`): se manda la clave de las dos maneras para no
 * depender de cuál lea la pasarela. */
export function cabecerasDeRuta(ruta: RutaZen, clave: string): Record<string, string> {
  if (ruta === "messages") {
    return {
      Authorization: `Bearer ${clave}`,
      "x-api-key": clave,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    };
  }
  return { Authorization: `Bearer ${clave}` };
}

/* ------------------------------------------------------------------ */
/* petición: de OpenAI al cuerpo de cada ruta                          */
/* ------------------------------------------------------------------ */

interface MensajeOpenAI {
  role?: string;
  content?: unknown;
  tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
  tool_call_id?: string;
}

interface CuerpoOpenAI {
  model?: string;
  messages?: MensajeOpenAI[];
  tools?: { function?: { name?: string; description?: string; parameters?: unknown } }[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

/** Texto de un contenido OpenAI (cadena o partes). */
function textoDe(contenido: unknown): string {
  if (typeof contenido === "string") return contenido;
  if (!Array.isArray(contenido)) return "";
  return contenido
    .map((p) => (p && typeof p === "object" && (p as Json).type === "text" ? String((p as Json).text ?? "") : ""))
    .join("");
}

function dataUrl(url: string): { tipo: string; datos: string } | null {
  const m = /^data:([^;,]+);base64,([\s\S]*)$/.exec(url);
  return m ? { tipo: m[1], datos: m[2] } : null;
}

function argumentosComoObjeto(texto: string | undefined): Json {
  if (!texto) return {};
  try {
    const j = JSON.parse(texto) as unknown;
    return j && typeof j === "object" && !Array.isArray(j) ? (j as Json) : {};
  } catch {
    return {};
  }
}

function partesDeUsuarioResponses(contenido: unknown): unknown[] {
  if (typeof contenido === "string") return [{ type: "input_text", text: contenido }];
  const partes: unknown[] = [];
  for (const p of Array.isArray(contenido) ? contenido : []) {
    const o = (p ?? {}) as Json;
    if (o.type === "text") partes.push({ type: "input_text", text: String(o.text ?? "") });
    if (o.type === "image_url") {
      const url = String(((o.image_url ?? {}) as Json).url ?? "");
      if (url) partes.push({ type: "input_image", image_url: url });
    }
  }
  return partes.length ? partes : [{ type: "input_text", text: "" }];
}

/** Cuerpo `/responses` a partir del cuerpo OpenAI ya construido. */
export function cuerpoResponses(cuerpo: CuerpoOpenAI): Json {
  const instrucciones: string[] = [];
  const entrada: unknown[] = [];
  for (const m of cuerpo.messages ?? []) {
    if (m.role === "system") {
      const t = textoDe(m.content);
      if (t) instrucciones.push(t);
      continue;
    }
    if (m.role === "tool") {
      entrada.push({ type: "function_call_output", call_id: m.tool_call_id ?? "", output: textoDe(m.content) });
      continue;
    }
    if (m.role === "assistant") {
      const t = textoDe(m.content);
      if (t) entrada.push({ role: "assistant", content: t });
      // Sin `id` de item: con `id` la API exige el item de razonamiento que lo
      // acompañó, y aquí no se guarda (store: false).
      for (const tc of m.tool_calls ?? []) {
        entrada.push({
          type: "function_call",
          call_id: tc.id ?? "",
          name: tc.function?.name ?? "",
          arguments: tc.function?.arguments ?? "{}",
        });
      }
      continue;
    }
    entrada.push({ role: "user", content: partesDeUsuarioResponses(m.content) });
  }
  const cuerpoFinal: Json = {
    model: cuerpo.model,
    input: entrada,
    stream: cuerpo.stream === true,
    store: false,
  };
  if (instrucciones.length) cuerpoFinal.instructions = instrucciones.join("\n\n");
  // Los modelos que razonan (gpt-5…) rechazan `temperature`: no se manda.
  if (cuerpo.max_tokens) cuerpoFinal.max_output_tokens = cuerpo.max_tokens;
  if (cuerpo.tools?.length) {
    cuerpoFinal.tools = cuerpo.tools.map((t) => ({
      type: "function",
      name: t.function?.name ?? "",
      description: t.function?.description ?? "",
      parameters: t.function?.parameters ?? { type: "object", properties: {} },
      // En Responses `strict` va activado por defecto y exige esquemas cerrados
      // (todos los campos obligatorios, sin extras): los de Forja no lo son.
      strict: false,
    }));
  }
  return cuerpoFinal;
}

function bloquesDeUsuarioMessages(contenido: unknown): unknown[] | string {
  if (typeof contenido === "string") return contenido;
  const bloques: unknown[] = [];
  for (const p of Array.isArray(contenido) ? contenido : []) {
    const o = (p ?? {}) as Json;
    if (o.type === "text") bloques.push({ type: "text", text: String(o.text ?? "") });
    if (o.type === "image_url") {
      const d = dataUrl(String(((o.image_url ?? {}) as Json).url ?? ""));
      if (d) bloques.push({ type: "image", source: { type: "base64", media_type: d.tipo, data: d.datos } });
    }
  }
  return bloques.length ? bloques : "";
}

/** Cuerpo `/messages` (formato Anthropic) a partir del cuerpo OpenAI. */
export function cuerpoMessages(cuerpo: CuerpoOpenAI): Json {
  const sistema: string[] = [];
  const mensajes: { role: "user" | "assistant"; content: unknown }[] = [];
  for (const m of cuerpo.messages ?? []) {
    if (m.role === "system") {
      const t = textoDe(m.content);
      if (t) sistema.push(t);
      continue;
    }
    if (m.role === "tool") {
      const resultado = { type: "tool_result", tool_use_id: m.tool_call_id ?? "", content: textoDe(m.content) };
      // Todos los resultados de una misma vuelta van juntos en UN mensaje de
      // usuario: la API exige que respondan al mensaje anterior de golpe.
      const ultimo = mensajes[mensajes.length - 1];
      const bloquesUltimo = ultimo?.role === "user" && Array.isArray(ultimo.content) ? (ultimo.content as Json[]) : null;
      if (bloquesUltimo && bloquesUltimo.every((b) => b.type === "tool_result")) bloquesUltimo.push(resultado);
      else mensajes.push({ role: "user", content: [resultado] });
      continue;
    }
    if (m.role === "assistant") {
      const bloques: unknown[] = [];
      const t = textoDe(m.content);
      if (t) bloques.push({ type: "text", text: t });
      for (const tc of m.tool_calls ?? []) {
        bloques.push({
          type: "tool_use",
          id: tc.id ?? "",
          name: tc.function?.name ?? "",
          input: argumentosComoObjeto(tc.function?.arguments),
        });
      }
      // Un mensaje de asistente vacío lo rechaza la API: se omite.
      if (bloques.length) mensajes.push({ role: "assistant", content: bloques });
      continue;
    }
    mensajes.push({ role: "user", content: bloquesDeUsuarioMessages(m.content) });
  }
  const cuerpoFinal: Json = {
    model: cuerpo.model,
    max_tokens: cuerpo.max_tokens ?? 8192,
    messages: mensajes,
    stream: cuerpo.stream === true,
  };
  if (sistema.length) cuerpoFinal.system = sistema.join("\n\n");
  if (typeof cuerpo.temperature === "number") cuerpoFinal.temperature = cuerpo.temperature;
  if (cuerpo.tools?.length) {
    cuerpoFinal.tools = cuerpo.tools.map((t) => ({
      name: t.function?.name ?? "",
      description: t.function?.description ?? "",
      input_schema: t.function?.parameters ?? { type: "object", properties: {} },
    }));
  }
  return cuerpoFinal;
}

/** Cuerpo de la ruta a partir del cuerpo OpenAI. En `chat` no cambia. */
export function cuerpoDeRuta(ruta: RutaZen, cuerpo: object): Json {
  if (ruta === "responses") return cuerpoResponses(cuerpo as CuerpoOpenAI);
  if (ruta === "messages") return cuerpoMessages(cuerpo as CuerpoOpenAI);
  return cuerpo as Json;
}

/** Cuerpo mínimo de prueba para una ruta: «hi», pocos tokens, sin streaming. */
export function cuerpoDePruebaZen(ruta: RutaZen, modelo: string, tools?: CuerpoOpenAI["tools"]): Json {
  const base: CuerpoOpenAI = {
    model: modelo,
    // 16 y no 1: los modelos que razonan rechazan o truncan un tope diminuto, y
    // /responses no admite menos de 16.
    max_tokens: 16,
    messages: [{ role: "user", content: "hi" }],
    ...(tools?.length ? { tools } : {}),
  };
  return cuerpoDeRuta(ruta, base);
}

/* ------------------------------------------------------------------ */
/* respuesta: de cada ruta a trozos con forma OpenAI                   */
/* ------------------------------------------------------------------ */

/** Un fallo que llegó DENTRO del stream (con HTTP 200). */
export interface FalloZen {
  __zenError: string;
}

export function esFalloZen(x: unknown): x is FalloZen {
  return !!x && typeof x === "object" && typeof (x as FalloZen).__zenError === "string";
}

type Trozo = Json | FalloZen;

const conDelta = (delta: Json): Json => ({ choices: [{ index: 0, delta, finish_reason: null }] });
const final = (motivo: string, usage?: Json): Json => ({
  choices: [{ index: 0, delta: {}, finish_reason: motivo }],
  ...(usage ? { usage } : {}),
});

function numero(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function usoOpenAI(entrada: unknown, salida: unknown, cacheLeido?: unknown): Json | undefined {
  const i = numero(entrada);
  const o = numero(salida);
  const c = numero(cacheLeido);
  if (i === undefined && o === undefined && c === undefined) return undefined;
  return {
    ...(i !== undefined ? { prompt_tokens: i } : {}),
    ...(o !== undefined ? { completion_tokens: o } : {}),
    ...(c !== undefined ? { prompt_tokens_details: { cached_tokens: c } } : {}),
  };
}

function mensajeDeError(ev: Json): string {
  const e = ev.error as Json | string | undefined;
  if (typeof e === "string") return e;
  const m = (e && typeof e === "object" ? e.message : undefined) ?? ev.message;
  return typeof m === "string" && m ? m.slice(0, 300) : "El proveedor devolvió un error en la respuesta.";
}

export type Traductor = (evento: unknown) => Trozo[];

/** Eventos SSE de `/responses` → trozos OpenAI. Con estado: lleva la cuenta de
 * qué llamada a herramienta es cada una. */
export function traductorResponses(): Traductor {
  const indices = new Map<string, number>();
  const conArgumentos = new Set<number>();
  let siguiente = 0;
  const clave = (ev: Json): string =>
    ev.item_id != null ? String(ev.item_id) : ev.output_index != null ? `o${String(ev.output_index)}` : "";
  return (evento) => {
    if (!evento || typeof evento !== "object") return [];
    const ev = evento as Json;
    switch (ev.type) {
      case "response.output_text.delta":
        return typeof ev.delta === "string" && ev.delta ? [conDelta({ content: ev.delta })] : [];
      case "response.reasoning_summary_text.delta":
      case "response.reasoning_text.delta":
        return typeof ev.delta === "string" && ev.delta ? [conDelta({ reasoning_content: ev.delta })] : [];
      case "response.output_item.added": {
        const item = (ev.item ?? {}) as Json;
        if (item.type !== "function_call") return [];
        const idx = siguiente++;
        if (item.id != null) indices.set(String(item.id), idx);
        if (ev.output_index != null) indices.set(`o${String(ev.output_index)}`, idx);
        return [
          conDelta({
            tool_calls: [
              { index: idx, id: String(item.call_id ?? item.id ?? `call_${idx}`), type: "function", function: { name: String(item.name ?? ""), arguments: "" } },
            ],
          }),
        ];
      }
      case "response.function_call_arguments.delta": {
        const idx = indices.get(clave(ev));
        if (idx === undefined || typeof ev.delta !== "string" || !ev.delta) return [];
        conArgumentos.add(idx);
        return [conDelta({ tool_calls: [{ index: idx, function: { arguments: ev.delta } }] })];
      }
      case "response.output_item.done": {
        const item = (ev.item ?? {}) as Json;
        if (item.type !== "function_call") return [];
        const idx = indices.get(item.id != null ? String(item.id) : `o${String(ev.output_index)}`) ?? indices.get(`o${String(ev.output_index)}`);
        // Si los argumentos no llegaron troceados, llegan enteros aquí.
        if (idx === undefined || conArgumentos.has(idx) || typeof item.arguments !== "string" || !item.arguments) return [];
        conArgumentos.add(idx);
        return [conDelta({ tool_calls: [{ index: idx, function: { arguments: item.arguments } }] })];
      }
      case "response.completed":
      case "response.incomplete": {
        const r = (ev.response ?? {}) as Json;
        const u = (r.usage ?? {}) as Json;
        const usage = usoOpenAI(u.input_tokens, u.output_tokens, ((u.input_tokens_details ?? {}) as Json).cached_tokens);
        const corta = ev.type === "response.incomplete" || r.status === "incomplete";
        return [final(corta ? "length" : siguiente > 0 ? "tool_calls" : "stop", usage)];
      }
      case "response.failed":
        return [{ __zenError: mensajeDeError((ev.response ?? {}) as Json) }];
      case "error":
        return [{ __zenError: mensajeDeError(ev) }];
      default:
        return [];
    }
  };
}

/** Eventos SSE de `/messages` → trozos OpenAI. */
export function traductorMessages(): Traductor {
  const indices = new Map<number, number>();
  let siguiente = 0;
  let entrada: number | undefined;
  let cacheLeido: number | undefined;
  return (evento) => {
    if (!evento || typeof evento !== "object") return [];
    const ev = evento as Json;
    switch (ev.type) {
      case "message_start": {
        const u = ((((ev.message ?? {}) as Json).usage ?? {}) as Json);
        entrada = numero(u.input_tokens);
        cacheLeido = numero(u.cache_read_input_tokens);
        return [];
      }
      case "content_block_start": {
        const b = (ev.content_block ?? {}) as Json;
        if (b.type !== "tool_use") return [];
        const idx = siguiente++;
        if (typeof ev.index === "number") indices.set(ev.index, idx);
        return [
          conDelta({
            tool_calls: [{ index: idx, id: String(b.id ?? `toolu_${idx}`), type: "function", function: { name: String(b.name ?? ""), arguments: "" } }],
          }),
        ];
      }
      case "content_block_delta": {
        const d = (ev.delta ?? {}) as Json;
        if (d.type === "text_delta" && typeof d.text === "string" && d.text) return [conDelta({ content: d.text })];
        if (d.type === "thinking_delta" && typeof d.thinking === "string" && d.thinking) return [conDelta({ reasoning_content: d.thinking })];
        if (d.type === "input_json_delta" && typeof d.partial_json === "string" && d.partial_json) {
          const idx = typeof ev.index === "number" ? indices.get(ev.index) : undefined;
          return idx === undefined ? [] : [conDelta({ tool_calls: [{ index: idx, function: { arguments: d.partial_json } }] })];
        }
        return [];
      }
      case "message_delta": {
        const d = (ev.delta ?? {}) as Json;
        const u = (ev.usage ?? {}) as Json;
        return [final(motivoOpenAI(d.stop_reason), usoOpenAI(entrada, u.output_tokens, cacheLeido))];
      }
      case "error":
        return [{ __zenError: mensajeDeError(ev) }];
      default:
        return [];
    }
  };
}

function motivoOpenAI(motivoAnthropic: unknown): string {
  switch (motivoAnthropic) {
    case "tool_use":
      return "tool_calls";
    case "max_tokens":
      return "length";
    case "refusal":
      return "content_filter";
    default:
      return "stop";
  }
}

/** Traductor de eventos SSE de la ruta, o `null` si no hace falta (`chat`). */
export function traductorDeRuta(ruta: RutaZen): Traductor | null {
  if (ruta === "responses") return traductorResponses();
  if (ruta === "messages") return traductorMessages();
  return null;
}

/** Cuerpo completo (sin streaming) de cada ruta → respuesta con forma OpenAI. */
export function completoDeRuta(ruta: RutaZen, cuerpo: unknown): Json {
  const j = (cuerpo && typeof cuerpo === "object" ? cuerpo : {}) as Json;
  if (ruta === "responses") {
    let texto = "";
    let razonamiento = "";
    const llamadas: unknown[] = [];
    for (const item of Array.isArray(j.output) ? (j.output as Json[]) : []) {
      if (item.type === "message") {
        for (const p of Array.isArray(item.content) ? (item.content as Json[]) : []) {
          if (p.type === "output_text" && typeof p.text === "string") texto += p.text;
        }
      } else if (item.type === "function_call") {
        llamadas.push({
          index: llamadas.length,
          id: String(item.call_id ?? item.id ?? `call_${llamadas.length}`),
          type: "function",
          function: { name: String(item.name ?? ""), arguments: String(item.arguments ?? "{}") },
        });
      } else if (item.type === "reasoning") {
        for (const p of Array.isArray(item.summary) ? (item.summary as Json[]) : []) {
          if (typeof p.text === "string") razonamiento += p.text;
        }
      }
    }
    const u = (j.usage ?? {}) as Json;
    const corta = j.status === "incomplete";
    return {
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: texto, ...(razonamiento ? { reasoning_content: razonamiento } : {}), ...(llamadas.length ? { tool_calls: llamadas } : {}) },
          finish_reason: corta ? "length" : llamadas.length ? "tool_calls" : "stop",
        },
      ],
      ...(usoOpenAI(u.input_tokens, u.output_tokens, ((u.input_tokens_details ?? {}) as Json).cached_tokens)
        ? { usage: usoOpenAI(u.input_tokens, u.output_tokens, ((u.input_tokens_details ?? {}) as Json).cached_tokens) }
        : {}),
    };
  }
  if (ruta === "messages") {
    let texto = "";
    let razonamiento = "";
    const llamadas: unknown[] = [];
    for (const b of Array.isArray(j.content) ? (j.content as Json[]) : []) {
      if (b.type === "text" && typeof b.text === "string") texto += b.text;
      else if (b.type === "thinking" && typeof b.thinking === "string") razonamiento += b.thinking;
      else if (b.type === "tool_use") {
        llamadas.push({
          index: llamadas.length,
          id: String(b.id ?? `toolu_${llamadas.length}`),
          type: "function",
          function: { name: String(b.name ?? ""), arguments: JSON.stringify(b.input ?? {}) },
        });
      }
    }
    const u = (j.usage ?? {}) as Json;
    const uso = usoOpenAI(u.input_tokens, u.output_tokens, u.cache_read_input_tokens);
    return {
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: texto, ...(razonamiento ? { reasoning_content: razonamiento } : {}), ...(llamadas.length ? { tool_calls: llamadas } : {}) },
          finish_reason: motivoOpenAI(j.stop_reason),
        },
      ],
      ...(uso ? { usage: uso } : {}),
    };
  }
  return j;
}
