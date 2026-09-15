/** Prism AI — Bucle de tools del agente: el techo de vueltas y el texto.
 *
 * Estos dos fallos son los que dejaban al agente parado a mitad del
 * trabajo. Se prueban aquí, sin React, inyectando un `streamChat` y un
 * `probeTools` falsos:
 *
 *  1. Al agotar las vueltas, el mensaje de cierre se CONSTRUÍA y se
 *     tiraba (`continue` salía del bucle). El agente devolvía cadena
 *     vacía: burbuja en blanco y trabajo detenido.
 *  2. El texto del modelo nunca se guardaba, así que los turnos que se
 *     le reinyectaban iban con `content: ""` y perdía su propio trabajo
 *     entre vueltas.
 */
import { describe, it, expect, vi } from "vitest";
import {
  ejecutarConTools,
  CIERRE_TOOLS,
  type DepsTools,
} from "../../src/lib/prism/use-agent-tools";
import type { StreamMessage, StreamOptions } from "../../src/lib/prism/chat-client";
import type { AppSettings } from "../../src/lib/prism/types";
import { useLlamadasTexto } from "../../src/lib/prism/llamadas-texto-medidas";

/** Opciones mínimas: solo lo que el bucle mira. */
function opciones(overrides: Partial<StreamOptions> = {}): Omit<StreamOptions, "tools"> {
  return {
    providerId: "custom",
    config: { apiKey: "k", enabled: true, models: [], useProxy: false },
    modelId: "modelo-de-prueba",
    messages: [{ role: "user", content: "construye una página" }] as StreamMessage[],
    settings: { stream: false } as unknown as AppSettings,
    signal: new AbortController().signal,
    onDelta: () => {},
    onDone: () => {},
    ...overrides,
  } as Omit<StreamOptions, "tools">;
}

/** `deps` falsos. `respuestas` es la guion de vueltas: cada entrada dice
 * qué texto devuelve el modelo y si pide herramientas. */
function deps(
  respuestas: Array<{ texto: string; pideTool?: boolean }>,
  registro: Array<{ messages: StreamMessage[]; conTools: boolean }>
): DepsTools {
  let i = 0;
  return {
    probe: vi.fn(async () => ({
      support: "ok" as const,
      verdict: "ok" as const,
      status: 200,
      ms: 1,
      at: Date.now(),
    })),
    stream: vi.fn(async (opts: StreamOptions) => {
      const paso = respuestas[Math.min(i, respuestas.length - 1)];
      i++;
      registro.push({ messages: opts.messages, conTools: !!opts.tools });
      if (paso.pideTool) {
        opts.onToolCalls?.([{ id: `call_${i}`, name: "list_files", args: {} }]);
      }
      opts.onDelta(paso.texto);
      return paso.texto;
    }) as unknown as DepsTools["stream"],
  };
}

describe("ejecutarConTools — el techo de vueltas no puede dejar al agente mudo", () => {
  it("agotadas las vueltas, manda el cierre SIN tools y devuelve la respuesta final", async () => {
    const registro: Array<{ messages: StreamMessage[]; conTools: boolean }> = [];
    // el modelo pide herramientas en todas las vueltas y solo cierra
    // cuando se le pide expresamente (última entrada del guion)
    const d = deps(
      [
        { texto: "voy a mirar los archivos", pideTool: true },
        { texto: "sigo mirando", pideTool: true },
        { texto: "Listo: aquí está la página terminada." },
      ],
      registro
    );

    const salida = await ejecutarConTools(opciones(), true, 2, null, { apiKey: "k" }, undefined, d);

    // 3 llamadas: 2 vueltas con tools + el cierre
    expect(registro).toHaveLength(3);
    expect(registro[0].conTools, "la 1ª vuelta ofrece herramientas").toBe(true);
    expect(registro[1].conTools, "la 2ª vuelta ofrece herramientas").toBe(true);
    expect(registro[2].conTools, "el cierre NO ofrece herramientas").toBe(false);

    // el mensaje de cierre viaja de verdad en la última petición
    const ultima = registro[2].messages;
    expect(ultima[ultima.length - 1].content).toBe(CIERRE_TOOLS);

    // y el agente entrega texto, no una burbuja vacía
    expect(salida).toBe("Listo: aquí está la página terminada.");
  });

  it("el texto del modelo se conserva en el turno que se le reinyecta", async () => {
    const registro: Array<{ messages: StreamMessage[]; conTools: boolean }> = [];
    const d = deps(
      [
        { texto: "<plan>\n- leer archivos\n</plan>", pideTool: true },
        { texto: "<answer>hecho</answer>" },
      ],
      registro
    );

    await ejecutarConTools(opciones(), true, 3, null, { apiKey: "k" }, undefined, d);

    const segunda = registro[1].messages;
    const asistente = segunda.find((m) => m.role === "assistant");
    expect(asistente?.content, "el plan que escribió no se pierde").toBe(
      "<plan>\n- leer archivos\n</plan>"
    );
  });

  it("si el modelo no pide herramientas, una sola llamada y ya", async () => {
    const registro: Array<{ messages: StreamMessage[]; conTools: boolean }> = [];
    const d = deps([{ texto: "respuesta directa" }], registro);

    const salida = await ejecutarConTools(opciones(), true, 3, null, { apiKey: "k" }, undefined, d);

    expect(registro).toHaveLength(1);
    expect(salida).toBe("respuesta directa");
  });

  it("con maxLoops=1 todavía se ofrecen herramientas en la vuelta útil", async () => {
    const registro: Array<{ messages: StreamMessage[]; conTools: boolean }> = [];
    const d = deps([{ texto: "miro", pideTool: true }, { texto: "final" }], registro);

    await ejecutarConTools(opciones(), true, 1, null, { apiKey: "k" }, undefined, d);

    expect(registro[0].conTools, "la única vuelta lleva el catálogo").toBe(true);
    expect(registro).toHaveLength(2); // vuelta + cierre
  });
});

describe("ejecutarConTools — persistencia entre vueltas (v3.32)", () => {
  /** Guion con dos tandas: la 1ª escribe un archivo, la 2ª lo lista.
   * El tool_result que vuelve al modelo en la 2ª vuelta dice si el
   * archivo SOBREVIVIÓ: hasta la v3.31 el contexto se reconstruía
   * desde el seed en cada vuelta y el agente perdía su propio trabajo. */
  function depsEscribirYListar(
    registro: Array<{ messages: StreamMessage[]; conTools: boolean }>
  ): DepsTools {
    let vuelta = 0;
    return {
      probe: vi.fn(async () => ({
        support: "ok" as const,
        verdict: "ok" as const,
        status: 200,
        ms: 1,
        at: Date.now(),
      })),
      stream: vi.fn(async (opts: StreamOptions) => {
        vuelta++;
        registro.push({ messages: opts.messages, conTools: !!opts.tools });
        if (vuelta === 1) {
          opts.onToolCalls?.([
            { id: "c1", name: "write_file", args: { path: "nuevo.txt", content: "hola agente" } },
          ]);
          return "escribo el archivo";
        }
        if (vuelta === 2) {
          opts.onToolCalls?.([{ id: "c2", name: "list_files", args: {} }]);
          return "compruebo qué hay";
        }
        return "listo";
      }) as unknown as DepsTools["stream"],
    };
  }

  it("lo escrito en la vuelta 1 existe en la vuelta 2", async () => {
    const registro: Array<{ messages: StreamMessage[]; conTools: boolean }> = [];
    const d = depsEscribirYListar(registro);

    await ejecutarConTools(opciones(), true, 4, null, { apiKey: "k" }, undefined, d);

    // la 2ª llamada lleva el resultado de list_files reinyectado:
    // el tool_result de la vuelta 2 debe contener el archivo de la vuelta 1.
    // El rol "tool" no está en el tipo Role (se cuela por cast en el
    // cliente): se identifica por tool_call_id, misma convención que
    // chat-client.ts usa al reenviar.
    const segunda = registro[1].messages;
    const resultadoList = segunda.filter(
      (m) => (m as { tool_call_id?: string }).tool_call_id != null
    );
    expect(resultadoList.length).toBeGreaterThan(0);
    const junto = resultadoList.map((m) => m.content ?? "").join("\n");
    expect(junto, "write_file de la vuelta 1 sobrevive a la vuelta 2").toContain("nuevo.txt");
  });

  it("onProjectFiles recibe el estado del proyecto tras cada tanda de tools", async () => {
    const registro: Array<{ messages: StreamMessage[]; conTools: boolean }> = [];
    const d = depsEscribirYListar(registro);
    const volcados: Array<Record<string, string>> = [];

    await ejecutarConTools(
      opciones(),
      true,
      4,
      null,
      { apiKey: "k" },
      undefined,
      d,
      (files) => volcados.push(files)
    );

    expect(volcados.length).toBeGreaterThanOrEqual(1);
    expect(volcados[0]["nuevo.txt"]).toBe("hola agente");
    // es una copia: mutarla fuera no toca el contexto del bucle
    volcados[0]["nuevo.txt"] = "fuera";
    expect(volcados[1] ? volcados[1]["nuevo.txt"] : "hola agente").toBe("hola agente");
  });
});

describe("ejecutarConTools — la llamada pedida como TEXTO (no tool_calls) se ejecuta igual", () => {
  /** Lo que reportó un usuario dos veces seguidas: nvidia/nemotron vía
   * OpenRouter escribe la llamada con SU plantilla de function-calling en
   * vez de rellenar `tool_calls` — sin `pideTool`, sin `onToolCalls`, el
   * texto trae literal `<function=write_file>…</function>`. */
  const LLAMADA_TEXTO =
    "<function=write_file><parameter=path>index.html</parameter>" +
    '<parameter=content><!DOCTYPE html><html lang="es"><body><h1>Hola</h1></body></html></parameter></function>';

  function depsLlamadaEnTexto(
    registro: Array<{ messages: StreamMessage[]; conTools: boolean }>
  ): DepsTools {
    let vuelta = 0;
    return {
      probe: vi.fn(async () => ({
        support: "ok" as const,
        verdict: "ok" as const,
        status: 200,
        ms: 1,
        at: Date.now(),
      })),
      stream: vi.fn(async (opts: StreamOptions) => {
        vuelta++;
        registro.push({ messages: opts.messages, conTools: !!opts.tools });
        if (vuelta === 1) {
          // el modelo NO llama a onToolCalls: la plantilla viene como texto
          opts.onDelta(LLAMADA_TEXTO);
          return LLAMADA_TEXTO;
        }
        opts.onDelta("Página escrita.");
        return "Página escrita.";
      }) as unknown as DepsTools["stream"],
    };
  }

  it("se reconoce, se ejecuta de verdad (el archivo se escribe) y no queda como texto final", async () => {
    const registro: Array<{ messages: StreamMessage[]; conTools: boolean }> = [];
    const volcados: Array<Record<string, string>> = [];

    const salida = await ejecutarConTools(
      opciones(),
      true,
      3,
      null,
      { apiKey: "k" },
      undefined,
      depsLlamadaEnTexto(registro),
      (files) => volcados.push(files)
    );

    // el archivo se escribió de verdad, no solo se "leyó" la plantilla
    expect(volcados.length).toBeGreaterThan(0);
    expect(volcados[0]["index.html"]).toContain("<h1>Hola</h1>");

    // dos vueltas: la que trajo la llamada en texto + la que responde
    // tras ejecutarla — no una sola vuelta que se rinde con el texto crudo
    expect(registro).toHaveLength(2);

    // la respuesta final es la de la SEGUNDA vuelta, no la plantilla cruda
    expect(salida).toBe("Página escrita.");
    expect(salida).not.toContain("<function=");
  });

  it("el mensaje reinyectado al modelo no lleva la plantilla cruda como su propio texto", async () => {
    const registro: Array<{ messages: StreamMessage[]; conTools: boolean }> = [];
    await ejecutarConTools(opciones(), true, 3, null, { apiKey: "k" }, undefined, depsLlamadaEnTexto(registro));

    const segunda = registro[1].messages;
    const asistente = segunda.find((m) => m.role === "assistant");
    // vacío (o sin la plantilla): reinyectarle su propio texto roto es
    // invitarlo a repetir el mismo patrón
    expect(asistente?.content ?? "").not.toContain("<function=");
  });

  it("cuando el fallback dispara de verdad, se anota para este modelo — el probe por sí solo nunca lo habría sabido", async () => {
    useLlamadasTexto.setState({ medidas: {} });
    const registro: Array<{ messages: StreamMessage[]; conTools: boolean }> = [];
    await ejecutarConTools(opciones(), true, 3, null, { apiKey: "k" }, undefined, depsLlamadaEnTexto(registro));

    const medidas = useLlamadasTexto.getState().medidas;
    expect(medidas["custom::modelo-de-prueba"]).toBeTruthy();
    expect(medidas["custom::modelo-de-prueba"].veces).toBe(1);
  });

  it("una llamada de verdad cortada a mitad (respuesta truncada) no se ejecuta: se trata como texto normal", async () => {
    const registro: Array<{ messages: StreamMessage[]; conTools: boolean }> = [];
    const cortada = "<function=write_file><parameter=path>index.html</parameter><parameter=content><!DOCTYPE";
    const d: DepsTools = {
      probe: vi.fn(async () => ({ support: "ok" as const, verdict: "ok" as const, status: 200, ms: 1, at: Date.now() })),
      stream: vi.fn(async (opts: StreamOptions) => {
        registro.push({ messages: opts.messages, conTools: !!opts.tools });
        opts.onDelta(cortada);
        return cortada;
      }) as unknown as DepsTools["stream"],
    };

    const salida = await ejecutarConTools(opciones(), true, 3, null, { apiKey: "k" }, undefined, d);
    // sin cierre `</function>` no hay llamada reconocible: el bucle termina
    // en la primera vuelta con el texto tal cual (ni mejor ni peor que hoy)
    expect(salida).toBe(cortada);
    expect(registro).toHaveLength(1);
  });
});

describe("ejecutarConTools — los permisos recortan lo que se le OFRECE al modelo", () => {
  /** El catálogo que viajó en cada vuelta con `tools`. */
  function depsQueApunta(catalogos: Array<string[]>): DepsTools {
    return {
      probe: vi.fn(async () => ({
        support: "ok" as const,
        verdict: "ok" as const,
        status: 200,
        ms: 1,
        at: Date.now(),
      })),
      stream: vi.fn(async (opts: StreamOptions) => {
        if (opts.tools) catalogos.push((opts.tools as ReadonlyArray<{ name: string }>).map((t) => t.name));
        opts.onDelta("listo");
        return "listo";
      }) as unknown as DepsTools["stream"],
    };
  }

  it("con «red» apagada, las tres de internet no se le describen siquiera", async () => {
    // Describirle herramientas que se le van a rechazar es gastar contexto y
    // provocar reintentos. La comprobación de verdad está en el runner.
    const catalogos: Array<string[]> = [];
    await ejecutarConTools(
      opciones(),
      true,
      1,
      null,
      { apiKey: "k" },
      undefined,
      depsQueApunta(catalogos),
      undefined,
      null,
      { lee_proyecto: true, escribe_proyecto: true, ejecuta: true, red: false }
    );
    expect(catalogos[0]).not.toContain("read_url");
    expect(catalogos[0]).not.toContain("search_web");
    expect(catalogos[0]).not.toContain("fetch_api");
    expect(catalogos[0]).toContain("list_files");
  });

  it("sin permisos indicados se le ofrece el catálogo entero", async () => {
    const catalogos: Array<string[]> = [];
    await ejecutarConTools(opciones(), true, 1, null, { apiKey: "k" }, undefined, depsQueApunta(catalogos));
    expect(catalogos[0]).toContain("read_url");
    expect(catalogos[0]).toContain("write_file");
  });

  it("con TODO apagado no se pasa catálogo: no se le ofrece nada", async () => {
    const catalogos: Array<string[]> = [];
    await ejecutarConTools(
      opciones(),
      true,
      1,
      null,
      { apiKey: "k" },
      undefined,
      depsQueApunta(catalogos),
      undefined,
      null,
      { lee_proyecto: false, escribe_proyecto: false, ejecuta: false, red: false }
    );
    expect(catalogos).toEqual([]);
  });
});

describe("ejecutarConTools — auto-verificación tras una mutación del proyecto", () => {
  /** El modelo escribe un archivo en la vuelta 1 y cierra en la vuelta 2.
   * `write_file` dispara la auto-verificación: se ejecuta `verify_project`
   * SIN que el modelo lo haya pedido, y su resultado viaja de vuelta al
   * modelo en la misma tanda. */
  function depsEscribeYCierra(
    registro: Array<{ messages: StreamMessage[]; conTools: boolean }>
  ): DepsTools {
    let vuelta = 0;
    return {
      probe: vi.fn(async () => ({ support: "ok" as const, verdict: "ok" as const, status: 200, ms: 1, at: Date.now() })),
      stream: vi.fn(async (opts: StreamOptions) => {
        vuelta++;
        registro.push({ messages: opts.messages, conTools: !!opts.tools });
        if (vuelta === 1) {
          opts.onToolCalls?.([
            { id: "w1", name: "write_file", args: { path: "index.html", content: "<html><body>hola</body></html>" } },
          ]);
          return "escribo la página";
        }
        return "listo";
      }) as unknown as DepsTools["stream"],
    };
  }

  it("dispara verify_project solo, sin que el modelo lo pida", async () => {
    const registro: Array<{ messages: StreamMessage[]; conTools: boolean }> = [];
    await ejecutarConTools(opciones(), true, 3, null, { apiKey: "k" }, undefined, depsEscribeYCierra(registro));

    // la 2ª vuelta lleva reinyectado el resultado de write_file Y el de la
    // verificación automática — dos tool_call_id distintos.
    const segunda = registro[1].messages;
    const idsResultado = segunda
      .map((m) => (m as unknown as { tool_call_id?: string }).tool_call_id)
      .filter((id): id is string => !!id);
    expect(idsResultado).toContain("w1");
    expect(idsResultado.some((id) => id.startsWith("auto-verify-"))).toBe(true);
  });

  it("cada tool_result de la vuelta reinyectada tiene su tool_call anunciado por el assistant — si no, la API real (OpenAI/Anthropic) rechaza el turno con 400", async () => {
    const registro: Array<{ messages: StreamMessage[]; conTools: boolean }> = [];
    await ejecutarConTools(opciones(), true, 3, null, { apiKey: "k" }, undefined, depsEscribeYCierra(registro));

    const segunda = registro[1].messages;
    const asistente = segunda.find((m) => m.role === "assistant") as unknown as {
      tool_calls?: Array<{ id: string }>;
    };
    const idsAnunciados = new Set((asistente?.tool_calls ?? []).map((tc) => tc.id));
    const idsResultado = segunda
      .map((m) => (m as unknown as { tool_call_id?: string }).tool_call_id)
      .filter((id): id is string => !!id);

    for (const id of idsResultado) {
      expect(idsAnunciados.has(id), `tool_result «${id}» no tiene tool_call anunciado`).toBe(true);
    }
  });

  it("no duplica la verificación si el modelo ya llamó verify_project en esa misma tanda", async () => {
    const registro: Array<{ messages: StreamMessage[]; conTools: boolean }> = [];
    let vuelta = 0;
    const d: DepsTools = {
      probe: vi.fn(async () => ({ support: "ok" as const, verdict: "ok" as const, status: 200, ms: 1, at: Date.now() })),
      stream: vi.fn(async (opts: StreamOptions) => {
        vuelta++;
        registro.push({ messages: opts.messages, conTools: !!opts.tools });
        if (vuelta === 1) {
          opts.onToolCalls?.([
            { id: "w1", name: "write_file", args: { path: "index.html", content: "<html></html>" } },
            { id: "v1", name: "verify_project", args: {} },
          ]);
          return "escribo y verifico";
        }
        return "listo";
      }) as unknown as DepsTools["stream"],
    };

    await ejecutarConTools(opciones(), true, 3, null, { apiKey: "k" }, undefined, d);

    const segunda = registro[1].messages;
    const idsResultado = segunda
      .map((m) => (m as unknown as { tool_call_id?: string }).tool_call_id)
      .filter((id): id is string => !!id);
    // solo el verify_project explícito del modelo (v1); ninguno auto-*
    expect(idsResultado.filter((id) => id.startsWith("auto-verify-"))).toHaveLength(0);
  });

  it("no se dispara si la vuelta no mutó nada (solo lectura)", async () => {
    const registro: Array<{ messages: StreamMessage[]; conTools: boolean }> = [];
    let vuelta = 0;
    const d: DepsTools = {
      probe: vi.fn(async () => ({ support: "ok" as const, verdict: "ok" as const, status: 200, ms: 1, at: Date.now() })),
      stream: vi.fn(async (opts: StreamOptions) => {
        vuelta++;
        registro.push({ messages: opts.messages, conTools: !!opts.tools });
        if (vuelta === 1) {
          opts.onToolCalls?.([{ id: "l1", name: "list_files", args: {} }]);
          return "miro los archivos";
        }
        return "listo";
      }) as unknown as DepsTools["stream"],
    };

    await ejecutarConTools(opciones(), true, 3, null, { apiKey: "k" }, undefined, d);

    const segunda = registro[1].messages;
    const idsResultado = segunda
      .map((m) => (m as unknown as { tool_call_id?: string }).tool_call_id)
      .filter((id): id is string => !!id);
    expect(idsResultado.some((id) => id.startsWith("auto-verify-"))).toBe(false);
  });
});
