import { describe, expect, it } from "vitest";
import {
  cabecerasDeRuta,
  completoDeRuta,
  cuerpoDePruebaZen,
  cuerpoMessages,
  cuerpoResponses,
  esErrorDeRuta,
  esFalloZen,
  ordenDeRutas,
  pathDeRuta,
  recordarRuta,
  rutaPorNombre,
  rutaSoportada,
  rutaZen,
  rutasAprendidas,
  traductorMessages,
  traductorResponses,
  type AlmacenRutas,
} from "@/lib/forja/zen-rutas";

function almacen(): AlmacenRutas & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return { datos, getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => void datos.set(k, v) };
}

const TOOLS = [
  { type: "function", function: { name: "write_file", description: "Escribe un archivo", parameters: { type: "object", properties: { path: { type: "string" } } } } },
];

// Una vuelta del agente, tal como la deja el bucle: assistant con tool_calls y
// los resultados como mensajes `tool`.
const CONVERSACION = [
  { role: "system", content: "Eres Forja." },
  { role: "user", content: "crea index.html" },
  {
    role: "assistant",
    content: "Voy.",
    tool_calls: [
      { id: "call_1", type: "function", function: { name: "write_file", arguments: '{"path":"index.html"}' } },
      { id: "call_2", type: "function", function: { name: "verify_project", arguments: "{}" } },
    ],
  },
  { role: "tool", tool_call_id: "call_1", content: "ok" },
  { role: "tool", tool_call_id: "call_2", content: "sin errores" },
];

describe("rutaPorNombre", () => {
  it("reparte los modelos por su endpoint documentado", () => {
    expect(rutaPorNombre("gpt-5-nano")).toBe("responses");
    expect(rutaPorNombre("claude-haiku-4-5")).toBe("messages");
    expect(rutaPorNombre("minimax-m2.1-free")).toBe("messages");
    expect(rutaPorNombre("gemini-3-flash")).toBe("gemini");
    for (const id of ["big-pickle", "glm-4.7-free", "kimi-k2", "qwen3-coder", "grok-code"]) expect(rutaPorNombre(id)).toBe("chat");
  });
  it("solo Gemini queda sin hablar", () => {
    expect(rutaSoportada("gemini-3-flash")).toBe(false);
    expect(rutaSoportada("gpt-5-nano")).toBe(true);
  });
});

describe("rutas aprendidas", () => {
  it("la ruta comprobada manda sobre la del nombre", () => {
    const a = almacen();
    expect(rutaZen("qwen3-coder", a)).toBe("chat");
    recordarRuta("qwen3-coder", "messages", a);
    expect(rutaZen("qwen3-coder", a)).toBe("messages");
    expect(rutasAprendidas(a)).toEqual({ "qwen3-coder": "messages" });
  });
  it("ignora basura guardada y rutas que no se hablan", () => {
    const a = almacen();
    a.setItem("forja-zen-rutas", JSON.stringify({ a: "chat", b: "gemini", c: 3 }));
    expect(rutasAprendidas(a)).toEqual({ a: "chat" });
    a.setItem("forja-zen-rutas", "no es json");
    expect(rutasAprendidas(a)).toEqual({});
    recordarRuta("x", "gemini", a);
    expect(rutasAprendidas(a)).toEqual({});
  });
  it("sin almacenamiento no falla", () => {
    expect(rutasAprendidas(null)).toEqual({});
    recordarRuta("x", "chat", null);
    expect(rutaZen("gpt-5", null)).toBe("responses");
  });
  it("el orden de prueba empieza por la suya y sigue con las otras", () => {
    expect(ordenDeRutas("gpt-5-nano", almacen())).toEqual(["responses", "chat", "messages"]);
    expect(ordenDeRutas("big-pickle", almacen())).toEqual(["chat", "responses", "messages"]);
  });
});

describe("esErrorDeRuta", () => {
  it("un 404/400 de endpoint equivocado invita a probar otra ruta", () => {
    expect(esErrorDeRuta(404, "Not Found")).toBe(true);
    expect(esErrorDeRuta(400, "model not supported by this endpoint")).toBe(true);
  });
  it("retirado, sin clave, tope o red no son de ruta", () => {
    expect(esErrorDeRuta(400, "Upstream request failed: Model is unavailable")).toBe(false);
    expect(esErrorDeRuta(403, "FreeTierError")).toBe(false);
    expect(esErrorDeRuta(429, "")).toBe(false);
    expect(esErrorDeRuta(500, "")).toBe(false);
  });
});

describe("pathDeRuta y cabeceras", () => {
  it("cada ruta tiene su path", () => {
    expect(pathDeRuta("chat")).toBe("/chat/completions");
    expect(pathDeRuta("responses")).toBe("/responses");
    expect(pathDeRuta("messages")).toBe("/messages");
  });
  it("/messages manda la clave de las dos maneras", () => {
    const h = cabecerasDeRuta("messages", "public");
    expect(h.Authorization).toBe("Bearer public");
    expect(h["x-api-key"]).toBe("public");
    expect(h["anthropic-version"]).toBeTruthy();
    expect(cabecerasDeRuta("responses", "k")).toEqual({ Authorization: "Bearer k" });
  });
});

describe("cuerpoResponses", () => {
  const c = cuerpoResponses({ model: "gpt-5-nano", messages: CONVERSACION, tools: TOOLS, temperature: 0.7, max_tokens: 4096, stream: true }) as Record<string, unknown>;
  const entrada = c.input as Record<string, unknown>[];
  it("el sistema va a instructions y no se manda temperature", () => {
    expect(c.instructions).toBe("Eres Forja.");
    expect(c.temperature).toBeUndefined();
    expect(c.store).toBe(false);
    expect(c.stream).toBe(true);
    expect(c.max_output_tokens).toBe(4096);
  });
  it("las llamadas y sus resultados casan por call_id, sin id de item", () => {
    expect(entrada[0]).toEqual({ role: "user", content: [{ type: "input_text", text: "crea index.html" }] });
    expect(entrada[1]).toEqual({ role: "assistant", content: "Voy." });
    expect(entrada[2]).toEqual({ type: "function_call", call_id: "call_1", name: "write_file", arguments: '{"path":"index.html"}' });
    expect(entrada[3].call_id).toBe("call_2");
    expect(entrada[4]).toEqual({ type: "function_call_output", call_id: "call_1", output: "ok" });
    expect(entrada[5]).toEqual({ type: "function_call_output", call_id: "call_2", output: "sin errores" });
    expect(entrada.every((e) => e.id === undefined)).toBe(true);
  });
  it("las herramientas van planas y sin strict", () => {
    expect(c.tools).toEqual([{ type: "function", name: "write_file", description: "Escribe un archivo", parameters: TOOLS[0].function.parameters, strict: false }]);
  });
  it("las imágenes pasan como input_image", () => {
    const r = cuerpoResponses({ model: "m", messages: [{ role: "user", content: [{ type: "text", text: "mira" }, { type: "image_url", image_url: { url: "data:image/png;base64,AAA" } }] }] }) as { input: { content: unknown[] }[] };
    expect(r.input[0].content).toEqual([{ type: "input_text", text: "mira" }, { type: "input_image", image_url: "data:image/png;base64,AAA" }]);
  });
});

describe("cuerpoMessages", () => {
  const c = cuerpoMessages({ model: "minimax-m2.1-free", messages: CONVERSACION, tools: TOOLS, temperature: 0.2, stream: true }) as Record<string, unknown>;
  const mensajes = c.messages as { role: string; content: unknown }[];
  it("el sistema va a system y max_tokens tiene valor por defecto", () => {
    expect(c.system).toBe("Eres Forja.");
    expect(c.max_tokens).toBe(8192);
    expect(c.temperature).toBe(0.2);
  });
  it("el asistente lleva tool_use con la entrada ya como objeto", () => {
    expect(mensajes[1].role).toBe("assistant");
    expect(mensajes[1].content).toEqual([
      { type: "text", text: "Voy." },
      { type: "tool_use", id: "call_1", name: "write_file", input: { path: "index.html" } },
      { type: "tool_use", id: "call_2", name: "verify_project", input: {} },
    ]);
  });
  it("los resultados de una vuelta van JUNTOS en un solo mensaje de usuario", () => {
    expect(mensajes).toHaveLength(3);
    expect(mensajes[2]).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "call_1", content: "ok" },
        { type: "tool_result", tool_use_id: "call_2", content: "sin errores" },
      ],
    });
  });
  it("las herramientas usan input_schema", () => {
    expect(c.tools).toEqual([{ name: "write_file", description: "Escribe un archivo", input_schema: TOOLS[0].function.parameters }]);
  });
  it("argumentos rotos no tumban la petición y un asistente vacío se omite", () => {
    const r = cuerpoMessages({ model: "m", messages: [{ role: "user", content: "a" }, { role: "assistant", content: "", tool_calls: [{ id: "x", function: { name: "t", arguments: "{roto" } }] }, { role: "assistant", content: "" }] }) as { messages: { content: unknown }[] };
    expect(r.messages).toHaveLength(2);
    expect(r.messages[1].content).toEqual([{ type: "tool_use", id: "x", name: "t", input: {} }]);
  });
});

describe("cuerpoDePruebaZen", () => {
  it("pide 16 tokens (el mínimo de /responses) en cada ruta", () => {
    expect(cuerpoDePruebaZen("chat", "m").max_tokens).toBe(16);
    expect(cuerpoDePruebaZen("responses", "m").max_output_tokens).toBe(16);
    expect(cuerpoDePruebaZen("messages", "m").max_tokens).toBe(16);
  });
});

function pasar(t: (e: unknown) => unknown[], eventos: unknown[]): Record<string, unknown>[] {
  return eventos.flatMap((e) => t(e)) as Record<string, unknown>[];
}
const choice = (x: Record<string, unknown>) => (x.choices as { delta?: Record<string, unknown>; finish_reason?: string }[])[0];

describe("traductorResponses (stream)", () => {
  it("texto, razonamiento, llamada troceada, parada y uso", () => {
    const out = pasar(traductorResponses(), [
      { type: "response.reasoning_summary_text.delta", delta: "pienso" },
      { type: "response.output_text.delta", delta: "Hola" },
      { type: "response.output_item.added", output_index: 1, item: { type: "function_call", id: "fc_1", call_id: "call_a", name: "write_file", arguments: "" } },
      { type: "response.function_call_arguments.delta", item_id: "fc_1", delta: '{"path":' },
      { type: "response.function_call_arguments.delta", item_id: "fc_1", delta: '"i.html"}' },
      { type: "response.output_item.done", output_index: 1, item: { type: "function_call", id: "fc_1", arguments: '{"path":"i.html"}' } },
      { type: "response.completed", response: { status: "completed", usage: { input_tokens: 10, output_tokens: 5, input_tokens_details: { cached_tokens: 4 } } } },
    ]);
    expect(choice(out[0]).delta).toEqual({ reasoning_content: "pienso" });
    expect(choice(out[1]).delta).toEqual({ content: "Hola" });
    expect(choice(out[2]).delta).toEqual({ tool_calls: [{ index: 0, id: "call_a", type: "function", function: { name: "write_file", arguments: "" } }] });
    expect(choice(out[3]).delta).toEqual({ tool_calls: [{ index: 0, function: { arguments: '{"path":' } }] });
    // `done` no repite lo que ya llegó troceado
    expect(out).toHaveLength(6);
    const fin = out[5];
    expect(choice(fin).finish_reason).toBe("tool_calls");
    expect(fin.usage).toEqual({ prompt_tokens: 10, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 4 } });
  });
  it("si los argumentos solo llegan en `done`, los entrega ahí", () => {
    const out = pasar(traductorResponses(), [
      { type: "response.output_item.added", output_index: 0, item: { type: "function_call", id: "fc_9", call_id: "c9", name: "t" } },
      { type: "response.output_item.done", output_index: 0, item: { type: "function_call", id: "fc_9", arguments: '{"a":1}' } },
    ]);
    expect(choice(out[1]).delta).toEqual({ tool_calls: [{ index: 0, function: { arguments: '{"a":1}' } }] });
  });
  it("sin llamadas termina en stop y cortado por longitud en length", () => {
    expect(choice(pasar(traductorResponses(), [{ type: "response.completed", response: {} }])[0]).finish_reason).toBe("stop");
    expect(choice(pasar(traductorResponses(), [{ type: "response.incomplete", response: { status: "incomplete" } }])[0]).finish_reason).toBe("length");
  });
  it("los errores del stream salen como fallo", () => {
    const f = traductorResponses()({ type: "error", message: "se acabó" })[0];
    expect(esFalloZen(f) && f.__zenError).toBe("se acabó");
    const g = traductorResponses()({ type: "response.failed", response: { error: { message: "boom" } } })[0];
    expect(esFalloZen(g) && g.__zenError).toBe("boom");
  });
  it("ignora eventos que no conoce y basura", () => {
    expect(pasar(traductorResponses(), [null, 3, { type: "response.created" }, { type: "response.in_progress" }])).toEqual([]);
  });
});

describe("traductorMessages (stream)", () => {
  it("texto, pensamiento, tool_use troceado, parada y uso", () => {
    const out = pasar(traductorMessages(), [
      { type: "message_start", message: { usage: { input_tokens: 12, cache_read_input_tokens: 3 } } },
      { type: "content_block_start", index: 0, content_block: { type: "thinking" } },
      { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "mmm" } },
      { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Hola" } },
      { type: "content_block_start", index: 2, content_block: { type: "tool_use", id: "toolu_1", name: "write_file" } },
      { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: '{"a":' } },
      { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: "1}" } },
      { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 7 } },
    ]);
    expect(choice(out[0]).delta).toEqual({ reasoning_content: "mmm" });
    expect(choice(out[1]).delta).toEqual({ content: "Hola" });
    expect(choice(out[2]).delta).toEqual({ tool_calls: [{ index: 0, id: "toolu_1", type: "function", function: { name: "write_file", arguments: "" } }] });
    expect(choice(out[3]).delta).toEqual({ tool_calls: [{ index: 0, function: { arguments: '{"a":' } }] });
    expect(choice(out[5]).finish_reason).toBe("tool_calls");
    expect(out[5].usage).toEqual({ prompt_tokens: 12, completion_tokens: 7, prompt_tokens_details: { cached_tokens: 3 } });
  });
  it("end_turn es stop y max_tokens es length", () => {
    expect(choice(pasar(traductorMessages(), [{ type: "message_delta", delta: { stop_reason: "end_turn" } }])[0]).finish_reason).toBe("stop");
    expect(choice(pasar(traductorMessages(), [{ type: "message_delta", delta: { stop_reason: "max_tokens" } }])[0]).finish_reason).toBe("length");
  });
  it("un error del stream sale como fallo", () => {
    const f = traductorMessages()({ type: "error", error: { type: "overloaded_error", message: "saturado" } })[0];
    expect(esFalloZen(f) && f.__zenError).toBe("saturado");
  });
});

describe("completoDeRuta (sin streaming)", () => {
  it("/responses: texto, llamadas y uso con forma OpenAI", () => {
    const j = completoDeRuta("responses", {
      status: "completed",
      output: [
        { type: "reasoning", summary: [{ text: "pensé" }] },
        { type: "message", content: [{ type: "output_text", text: "Listo" }] },
        { type: "function_call", call_id: "c1", name: "write_file", arguments: '{"a":1}' },
      ],
      usage: { input_tokens: 3, output_tokens: 2 },
    }) as { choices: { message: Record<string, unknown>; finish_reason: string }[]; usage: unknown };
    expect(j.choices[0].message.content).toBe("Listo");
    expect(j.choices[0].message.reasoning_content).toBe("pensé");
    expect(j.choices[0].message.tool_calls).toEqual([{ index: 0, id: "c1", type: "function", function: { name: "write_file", arguments: '{"a":1}' } }]);
    expect(j.choices[0].finish_reason).toBe("tool_calls");
    expect(j.usage).toEqual({ prompt_tokens: 3, completion_tokens: 2 });
  });
  it("/messages: bloques text, thinking y tool_use", () => {
    const j = completoDeRuta("messages", {
      stop_reason: "tool_use",
      content: [
        { type: "thinking", thinking: "hm" },
        { type: "text", text: "ok" },
        { type: "tool_use", id: "t1", name: "write_file", input: { a: 1 } },
      ],
      usage: { input_tokens: 1, output_tokens: 1 },
    }) as { choices: { message: Record<string, unknown>; finish_reason: string }[] };
    expect(j.choices[0].message.content).toBe("ok");
    expect(j.choices[0].message.tool_calls).toEqual([{ index: 0, id: "t1", type: "function", function: { name: "write_file", arguments: '{"a":1}' } }]);
    expect(j.choices[0].finish_reason).toBe("tool_calls");
  });
  it("tolera cuerpos raros", () => {
    expect(() => completoDeRuta("responses", null)).not.toThrow();
    expect(() => completoDeRuta("messages", "x")).not.toThrow();
  });
});
