/** El fallo que motivó estas pruebas: en el móvil, Gemini devolvía «Failed to
 * fetch» en 0,4 s. La causa era que el registro de peticiones guarda la URL del
 * PROVEEDOR (que es la útil para «Copiar como cURL») y `loggedFetch` hacía el
 * fetch a esa misma URL, ignorando la del proxy que ya se había calculado. El
 * navegador salía entonces contra el proveedor llevando `x-target-url`, una
 * cabecera que ningún proveedor autoriza en CORS, y el preflight lo cortaba.
 *
 * Por eso lo que se comprueba aquí no son las cabeceras: es a DÓNDE va el fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const settingsMock = { accessCode: "" as string | undefined };
vi.mock("../../src/lib/prism/store", () => ({
  usePrism: { getState: () => ({ settings: settingsMock }) },
}));

import {
  ABORTED,
  buildRequest,
  streamChat,
  fetchModels,
  INACTIVIDAD_STREAM_MS,
} from "../../src/lib/prism/chat-client";
import { getRecentRequests, clearRecentRequests } from "../../src/lib/prism/request-log";
import type { ProviderConfig, ProviderId } from "../../src/lib/prism/types";
import { DEFAULT_SETTINGS } from "../../src/lib/prism/types";

const cfg = (extra: Partial<ProviderConfig> = {}): ProviderConfig =>
  ({ apiKey: "sk-secreta", enabled: true, models: [], ...extra }) as ProviderConfig;

/** fetch de mentira: recuerda las URLs pedidas y responde JSON vacío. */
function fakeFetch(body: unknown = {}) {
  const llamadas: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    llamadas.push({ url: String(url), init });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  return { llamadas, fn };
}

beforeEach(() => {
  settingsMock.accessCode = "";
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildRequest", () => {
  it("por defecto apunta al proxy y guarda aparte la URL del proveedor", () => {
    const r = buildRequest("https://api.openai.com/v1/chat/completions", {
      config: cfg(),
      providerId: "openai",
    });
    expect(r.direct).toBe(false);
    expect(r.target).toBe("/api/proxy?t=openai");
    expect(r.upstream).toBe("https://api.openai.com/v1/chat/completions");
    expect(r.headers["x-target-url"]).toBe(r.upstream);
  });

  it("en conexión directa el destino ES el proveedor y no se cuela x-target-url", () => {
    const r = buildRequest("http://localhost:11434/v1/chat/completions", {
      config: cfg({ useProxy: false }),
      providerId: "ollama",
    });
    expect(r.direct).toBe(true);
    expect(r.target).toBe("http://localhost:11434/v1/chat/completions");
    expect(r.headers["x-target-url"]).toBeUndefined();
  });

  it("las cabeceras internas del proxy no llegan al registro", () => {
    settingsMock.accessCode = "codigo";
    const r = buildRequest("https://api.openai.com/v1/chat/completions", {
      config: cfg(),
      providerId: "openai",
    });
    expect(r.headers["x-prism-code"]).toBe("codigo");
    expect(r.logHeaders["x-prism-code"]).toBeUndefined();
    expect(r.logHeaders["x-target-url"]).toBeUndefined();
    // lo del proveedor sí se conserva: el cURL tiene que ser reproducible
    expect(r.logHeaders["Content-Type"]).toBe("application/json");
  });
});

describe("streamChat sale por el proxy, no contra el proveedor", () => {
  const casos: { id: ProviderId; nombre: string; host: string }[] = [
    { id: "gemini", nombre: "Google Gemini", host: "generativelanguage.googleapis.com" },
    { id: "anthropic", nombre: "Anthropic", host: "api.anthropic.com" },
    { id: "openai", nombre: "OpenAI", host: "api.openai.com" },
  ];

  for (const caso of casos) {
    it(`${caso.nombre}: el navegador pide /api/proxy y nunca ${caso.host}`, async () => {
      const { llamadas, fn } = fakeFetch();
      vi.stubGlobal("fetch", fn);

      await streamChat({
        providerId: caso.id,
        config: cfg(),
        modelId: "modelo-x",
        messages: [{ role: "user", content: "hola" }],
        settings: { ...DEFAULT_SETTINGS, stream: false },
        signal: new AbortController().signal,
        onDelta: () => {},
        onDone: () => {},
      });

      expect(llamadas).toHaveLength(1);
      expect(llamadas[0].url).toBe(`/api/proxy?t=${caso.id}`);
      expect(llamadas[0].url).not.toContain(caso.host);
      // y el proxy sí recibe a dónde tiene que ir
      const enviadas = llamadas[0].init?.headers as Record<string, string>;
      expect(enviadas["x-target-url"]).toContain(caso.host);
    });
  }

  it("con conexión directa sí va al proveedor", async () => {
    const { llamadas, fn } = fakeFetch();
    vi.stubGlobal("fetch", fn);

    await streamChat({
      providerId: "gemini",
      config: cfg({ useProxy: false }),
      modelId: "gemini-2.5-flash",
      messages: [{ role: "user", content: "hola" }],
      settings: { ...DEFAULT_SETTINGS, stream: false },
      signal: new AbortController().signal,
      onDelta: () => {},
      onDone: () => {},
    });

    expect(llamadas[0].url).toContain("generativelanguage.googleapis.com");
    expect((llamadas[0].init?.headers as Record<string, string>)["x-target-url"]).toBeUndefined();
  });
});

describe("NVIDIA NIM habla como el snippet de Build", () => {
  it("manda moonshotai/kimi-k3 por el proxy con reasoning_effort y max_tokens", async () => {
    const { llamadas, fn } = fakeFetch({ choices: [{ message: { content: "ok" } }] });
    vi.stubGlobal("fetch", fn);

    await streamChat({
      providerId: "nvidia",
      config: cfg(),
      modelId: "moonshotai/kimi-k3",
      messages: [{ role: "user", content: "hola" }],
      settings: { ...DEFAULT_SETTINGS, stream: false, maxTokens: null },
      signal: new AbortController().signal,
      onDelta: () => {},
      onDone: () => {},
    });

    expect(llamadas[0].url).toBe("/api/proxy?t=nvidia");
    const enviadas = llamadas[0].init?.headers as Record<string, string>;
    expect(enviadas["x-target-url"]).toBe(
      "https://integrate.api.nvidia.com/v1/chat/completions"
    );
    const body = JSON.parse(String(llamadas[0].init?.body ?? "{}"));
    expect(body.model).toBe("moonshotai/kimi-k3");
    expect(body.reasoning_effort).toBe("max");
    expect(body.max_tokens).toBe(16384);
  });
});

describe("fetchModels usa el mismo camino que el chat", () => {
  it("Gemini pasa por el proxy", async () => {
    const { llamadas, fn } = fakeFetch({ models: [{ name: "models/gemini-2.5-flash" }] });
    vi.stubGlobal("fetch", fn);
    const ids = await fetchModels("gemini", cfg());
    expect(llamadas[0].url).toBe("/api/proxy?t=gemini");
    expect(ids).toEqual(["gemini-2.5-flash"]);
  });

  it("Anthropic pasa por el proxy con su parámetro de proveedor", async () => {
    const { llamadas, fn } = fakeFetch({ data: [{ id: "claude-x" }] });
    vi.stubGlobal("fetch", fn);
    await fetchModels("anthropic", cfg());
    expect(llamadas[0].url).toBe("/api/proxy?t=anthropic");
  });

  it("los compatibles con OpenAI también", async () => {
    const { llamadas, fn } = fakeFetch({ data: [{ id: "b" }, { id: "a" }] });
    vi.stubGlobal("fetch", fn);
    const ids = await fetchModels("openai", cfg());
    expect(llamadas[0].url).toBe("/api/proxy?t=openai");
    expect(ids).toEqual(["a", "b"]);
  });
});

describe("cuando el fetch ni llega a responder", () => {
  const enviar = (config: ProviderConfig, signal?: AbortSignal) =>
    streamChat({
      providerId: "gemini",
      config,
      modelId: "gemini-2.5-flash",
      messages: [{ role: "user", content: "hola" }],
      settings: { ...DEFAULT_SETTINGS, stream: false },
      signal: signal ?? new AbortController().signal,
      onDelta: () => {},
      onDone: () => {},
    });

  beforeEach(() => clearRecentRequests());

  it("explica que falló el propio servidor de Prism, no repite «Failed to fetch»", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(enviar(cfg())).rejects.toThrow(/servidor de Prism \(\/api\/proxy\)/);
    await expect(enviar(cfg())).rejects.toThrow(/VPN/);
  });

  it("en modo directo señala el CORS del proveedor", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(enviar(cfg({ useProxy: false }))).rejects.toThrow(/Conexión directa/);
  });

  it("queda registrada como sin respuesta, con su URL real para el cURL", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(enviar(cfg())).rejects.toThrow();
    const [entrada] = getRecentRequests();
    expect(entrada.ok).toBe(false);
    expect(entrada.status).toBe(0);
    expect(entrada.url).toContain("generativelanguage.googleapis.com");
    expect(entrada.headers["x-target-url"]).toBeUndefined();
    expect(entrada.headers["x-goog-api-key"]).toBe("TU_API_KEY");
  });

  it("una cancelación se distingue de un fallo y conserva el AbortError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new DOMException("The user aborted a request.", "AbortError");
    }));
    await expect(enviar(cfg())).rejects.toThrow(/aborted/);
    expect(getRecentRequests()[0].status).toBe(ABORTED);
  });
});

describe("cuando la conexión de streaming se queda muda (v4.19.0)", () => {
  /** Reportado como "se detiene mucho solo": con un modelo de razonamiento
   * vía móvil + VPN, la conexión SSE se corta a media respuesta sin cerrar
   * limpiamente. `reader.read()` se quedaba esperando para siempre —la
   * burbuja se congelaba con lo poco que llegó a pintar, sin ningún error
   * que disparase el reintento que ya existe. */
  const sse = (payload: string) => `data: ${payload}\n\n`;

  function streamDeChunks(chunks: string[], msEntreChunks: number, quedarseMudoAlFinal: boolean) {
    let indice = 0;
    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (indice < chunks.length) {
          if (msEntreChunks > 0) await new Promise((r) => setTimeout(r, msEntreChunks));
          controller.enqueue(new TextEncoder().encode(sse(chunks[indice])));
          indice++;
          return;
        }
        if (quedarseMudoAlFinal) {
          // no queda nada que mandar y la conexión no se cierra: como una
          // que murió sin avisar. No resolver NUNCA este `pull` es la
          // única forma de representarlo sin quedar en un bucle activo
          // (si se resolviera sin encolar nada, el stream volvería a
          // llamar a `pull` de inmediato, sin ceder nunca el hilo).
          return new Promise<void>(() => {});
        }
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
  }

  const enviarStream = (body: ReadableStream<Uint8Array>) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } }))
    );
    return streamChat({
      providerId: "gemini",
      config: cfg(),
      modelId: "gemini-2.5-flash",
      messages: [{ role: "user", content: "hola" }],
      settings: { ...DEFAULT_SETTINGS, stream: true },
      signal: new AbortController().signal,
      onDelta: () => {},
      onDone: () => {},
    });
  };

  it("sin ni un byte durante el hueco de inactividad, rechaza con un error claro en vez de colgarse para siempre", async () => {
    vi.useFakeTimers();
    try {
      const chunkInicial = JSON.stringify({
        candidates: [{ content: { parts: [{ text: "empe" }] } }],
      });
      const promesa = enviarStream(streamDeChunks([chunkInicial], 0, true));
      const veredicto = expect(promesa).rejects.toThrow(/inactividad|conexión parece muerta/i);
      await vi.advanceTimersByTimeAsync(INACTIVIDAD_STREAM_MS + 1000);
      await veredicto;
    } finally {
      vi.useRealTimers();
    }
  });

  it("con trozos que van llegando (aunque tarden), no dispara nada: solo importa el HUECO sin datos, no el tiempo total", async () => {
    const c1 = JSON.stringify({ candidates: [{ content: { parts: [{ text: "a" }] } }] });
    const c2 = JSON.stringify({ candidates: [{ content: { parts: [{ text: "b" }] } }] });
    // 10ms entre trozos: muy por debajo del umbral de inactividad real,
    // sin necesitar timers falsos para probarlo.
    await expect(enviarStream(streamDeChunks([c1, c2], 10, false))).resolves.toBe("ab");
  });
});
