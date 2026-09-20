/** Tests del ejecutor de herramientas (tool-runner.ts).
 * No toca la red ni React: recibe un `ToolContext` en memoria. */
import { describe, it, expect } from "vitest";
import { runTool, runTools, type ToolContext } from "../../src/lib/forja/tool-runner";
import type { ToolCall } from "../../src/lib/forja/tools-catalog";

const ctx = (over: Partial<ToolContext> = {}): ToolContext => ({
  projectFiles: {
    "index.html": "<!doctype html><body>hola</body>",
    "styles.css": "body { color: red }",
    "src/app.js": "console.log('hola')",
  },
  ...over,
});

const call = (name: string, args: Record<string, unknown> = {}): ToolCall => ({
  id: `call_${name}_${Math.random().toString(36).slice(2, 6)}`,
  name,
  args,
});

describe("read_file", () => {
  it("devuelve el contenido si el archivo existe", async () => {
    const r = await runTool(call("read_file", { path: "index.html" }), ctx());
    expect(r.ok).toBe(true);
    expect(r.content).toContain("<body>hola</body>");
  });
  it("error claro si el archivo no existe", async () => {
    const r = await runTool(call("read_file", { path: "no-existe.js" }), ctx());
    expect(r.ok).toBe(false);
    expect(r.content).toContain("no existe");
    expect(r.content).toContain("list_files");
  });
  it("error si falta path", async () => {
    const r = await runTool(call("read_file", {}), ctx());
    expect(r.ok).toBe(false);
    expect(r.content).toContain("path");
  });
});

describe("kb_search", () => {
  const recurso = {
    id: "f1",
    name: "landing-referencia.png",
    mimeType: "image/png",
    sizeBytes: 2048,
    accountEmail: "ana@example.com",
    webViewLink: "https://drive.google.com/file/d/1",
    category: "visual",
    tags: ["dashboard", "oscuro"],
    technology: "React",
    license: "propio",
    status: "clasificado" as const,
    indexedAt: "2026-01-01T00:00:00.000Z",
  };

  it("sin recursos indexados, lo dice en vez de fingir una búsqueda", async () => {
    const r = await runTool(call("kb_search", { query: "dashboard" }), ctx());
    expect(r.ok).toBe(true);
    expect(r.content).toContain("Todavía no hay ningún recurso");
  });

  it("con recursos pero ninguno casa, lo distingue de «no hay nada indexado»", async () => {
    const r = await runTool(call("kb_search", { query: "algo-que-no-existe" }), ctx({ kbResources: [recurso] }));
    expect(r.ok).toBe(true);
    expect(r.content).toContain("1 recurso(s) indexados");
    expect(r.content).toContain("ninguno casa");
  });

  it("encuentra por categoría/etiqueta/tecnología y devuelve el enlace de Drive", async () => {
    const r = await runTool(call("kb_search", { query: "dashboard" }), ctx({ kbResources: [recurso] }));
    expect(r.ok).toBe(true);
    expect(r.content).toContain("landing-referencia.png");
    expect(r.content).toContain(recurso.webViewLink);
  });

  it("error si falta query", async () => {
    const r = await runTool(call("kb_search", {}), ctx({ kbResources: [recurso] }));
    expect(r.ok).toBe(false);
    expect(r.content).toContain("query");
  });

  it("respeta el permiso «lee_proyecto»: apagado, no se ejecuta", async () => {
    const r = await runTool(
      call("kb_search", { query: "dashboard" }),
      ctx({
        kbResources: [recurso],
        permisos: { lee_proyecto: false, escribe_proyecto: true, ejecuta: true, red: true },
      })
    );
    expect(r.ok).toBe(false);
    expect(r.content).toMatch(/leer el proyecto/i);
  });
});

describe("kb_project_search", () => {
  const proyecto = {
    version: 1 as const,
    id: "kb-project-1",
    name: "shop-ui",
    analyzedAt: "2026-01-01T00:00:00.000Z",
    totalFiles: 1,
    indexedFiles: 1,
    ignoredFiles: 0,
    totalBytes: 20,
    technologies: ["React", "TypeScript"],
    frameworks: ["Next.js"],
    packageManagers: ["npm"],
    components: ["FilterDrawer"],
    patterns: ["component-library"],
    licenses: [],
    entryPoints: [],
    importantFiles: [],
    files: [
      {
        path: "src/components/FilterDrawer.tsx",
        sizeBytes: 20,
        kind: "source" as const,
        technology: ["React", "TypeScript"],
        componentNames: ["FilterDrawer"],
        patterns: ["component-library"],
      },
    ],
  };

  it("sin proyectos analizados, lo dice en vez de fingir una búsqueda", async () => {
    const r = await runTool(call("kb_project_search", { query: "filtro" }), ctx());
    expect(r.ok).toBe(true);
    expect(r.content).toContain("ningún proyecto ZIP/repositorio analizado");
  });

  it("encuentra un componente por nombre y devuelve el archivo, no el repositorio entero", async () => {
    const r = await runTool(
      call("kb_project_search", { query: "filtro lateral", component: "FilterDrawer" }),
      ctx({ kbProjectManifests: [proyecto] })
    );
    expect(r.ok).toBe(true);
    expect(r.content).toContain("FilterDrawer.tsx");
    expect(r.content).not.toContain("component-library, utility-css");
  });

  it("con proyectos pero ninguno casa, lo distingue de «no hay proyectos»", async () => {
    const r = await runTool(
      call("kb_project_search", { query: "algo-que-no-existe-en-ningun-lado" }),
      ctx({ kbProjectManifests: [proyecto] })
    );
    expect(r.ok).toBe(true);
    expect(r.content).toContain("Ningún proyecto analizado");
  });

  it("error si falta query", async () => {
    const r = await runTool(call("kb_project_search", {}), ctx({ kbProjectManifests: [proyecto] }));
    expect(r.ok).toBe(false);
    expect(r.content).toContain("query");
  });

  it("respeta el permiso «lee_proyecto»: apagado, no se ejecuta", async () => {
    const r = await runTool(
      call("kb_project_search", { query: "filtro" }),
      ctx({
        kbProjectManifests: [proyecto],
        permisos: { lee_proyecto: false, escribe_proyecto: true, ejecuta: true, red: true },
      })
    );
    expect(r.ok).toBe(false);
    expect(r.content).toMatch(/leer el proyecto/i);
  });
});

describe("write_file", () => {
  it("escribe y actualiza projectFiles", async () => {
    const c = ctx();
    const r = await runTool(call("write_file", { path: "nuevo.txt", content: "hola" }), c);
    expect(r.ok).toBe(true);
    expect(c.projectFiles["nuevo.txt"]).toBe("hola");
  });
  it("reemplaza contenido existente", async () => {
    const c = ctx();
    const r = await runTool(call("write_file", { path: "index.html", content: "NUEVO" }), c);
    expect(r.ok).toBe(true);
    expect(c.projectFiles["index.html"]).toBe("NUEVO");
  });
  it("error si falta content", async () => {
    const r = await runTool(call("write_file", { path: "a.txt" }), ctx());
    expect(r.ok).toBe(false);
    expect(r.content).toContain("content");
  });

  it("rechaza crear un archivo NUEVO con nombre de parche", async () => {
    const c = ctx();
    for (const nombre of ["fix-123.ts", "patch-final.js", "temporary-fix.html", "utils.bak.js", "backup-styles.css"]) {
      const r = await runTool(call("write_file", { path: nombre, content: "x" }), c);
      expect(r.ok, nombre).toBe(false);
      expect(r.content, nombre).toContain("edit_file");
      expect(c.projectFiles[nombre], nombre).toBeUndefined();
    }
  });

  it("no confunde nombres normales que solo contienen la palabra a medias", async () => {
    const c = ctx();
    for (const nombre of ["prefix-loader.js", "traffic.js", "index.html"]) {
      const r = await runTool(call("write_file", { path: nombre, content: "x" }), c);
      expect(r.ok, nombre).toBe(true);
    }
  });

  it("permite SOBRESCRIBIR un archivo que ya existía con ese nombre (no es el patrón que se evita)", async () => {
    const c = ctx({ projectFiles: { "temp-fix.js": "viejo" } });
    const r = await runTool(call("write_file", { path: "temp-fix.js", content: "nuevo" }), c);
    expect(r.ok).toBe(true);
    expect(c.projectFiles["temp-fix.js"]).toBe("nuevo");
  });
});

describe("rutas de archivo: sin salir del proyecto", () => {
  it("write_file rechaza «..» en la ruta", async () => {
    const c = ctx();
    const r = await runTool(call("write_file", { path: "../fuera.txt", content: "x" }), c);
    expect(r.ok).toBe(false);
    expect(r.content).toContain("Ruta inválida");
    expect(c.projectFiles["../fuera.txt"]).toBeUndefined();
  });
  it("write_file rechaza una ruta absoluta", async () => {
    const r = await runTool(call("write_file", { path: "/etc/passwd", content: "x" }), ctx());
    expect(r.ok).toBe(false);
    expect(r.content).toContain("Ruta inválida");
  });
  it("read_file rechaza «..» en la ruta", async () => {
    const r = await runTool(call("read_file", { path: "src/../../secreto.env" }), ctx());
    expect(r.ok).toBe(false);
    expect(r.content).toContain("Ruta inválida");
  });
  it("apply_patch y edit_file también rechazan rutas fuera del proyecto", async () => {
    const r1 = await runTool(call("apply_patch", { path: "../a.txt", parches: [{ search: "x", replace: "y" }] }), ctx());
    expect(r1.ok).toBe(false);
    expect(r1.content).toContain("Ruta inválida");
    const r2 = await runTool(call("edit_file", { path: "../a.txt", find: "x", replace: "y" }), ctx());
    expect(r2.ok).toBe(false);
    expect(r2.content).toContain("Ruta inválida");
  });
  it("una ruta relativa normal sigue funcionando igual que siempre", async () => {
    const c = ctx();
    const r = await runTool(call("write_file", { path: "src/nuevo.txt", content: "ok" }), c);
    expect(r.ok).toBe(true);
    expect(c.projectFiles["src/nuevo.txt"]).toBe("ok");
  });
});

describe("list_files", () => {
  it("lista todo si no hay prefix", async () => {
    const r = await runTool(call("list_files", {}), ctx());
    expect(r.ok).toBe(true);
    expect(r.content).toContain("index.html");
    expect(r.content).toContain("styles.css");
    expect(r.content).toContain("src/app.js");
  });
  it("filtra por prefix", async () => {
    const r = await runTool(call("list_files", { prefix: "src/" }), ctx());
    expect(r.ok).toBe(true);
    expect(r.content).toContain("src/app.js");
    expect(r.content).not.toContain("index.html");
  });
  it("avisa si no hay archivos que coincidan", async () => {
    const r = await runTool(call("list_files", { prefix: "no/" }), ctx());
    expect(r.ok).toBe(true);
    expect(r.content).toContain("No hay archivos");
  });
});

describe("run_project", () => {
  /* El fallo: `ok` significa «sin errores», no «se pudo ejecutar», y el
   * comentario del tipo decía lo contrario. Con `ok`, esta rama contestaba
   * «No se pudo ejecutar el proyecto» SIEMPRE que había errores — o sea, se
   * le ocultaban al agente los errores de su propio código, que es justo
   * para lo que existe la herramienta. */
  it("cuando el proyecto SÍ se ejecuta y da errores, el modelo los ve", async () => {
    const c = ctx({
      runProject: async () => ({
        ok: false,
        ejecutado: true,
        logs: 1,
        errors: 1,
        logLines: [],
        errorLines: ["Uncaught ReferenceError: pintarTodo is not defined"],
      }),
    });
    const r = await runTool(call("run_project", {}), c);
    expect(r.content, "no puede decir que no se pudo ejecutar").not.toContain(
      "No se pudo ejecutar"
    );
    expect(r.content).toContain("pintarTodo is not defined");
  });

  it("cuando de verdad no se pudo ejecutar, lo dice con su motivo", async () => {
    const c = ctx({
      runProject: async () => ({
        ok: false,
        ejecutado: false,
        logs: 0,
        errors: 0,
        logLines: [],
        errorLines: [],
        reason: "No hay ningún archivo .html en el proyecto.",
      }),
    });
    const r = await runTool(call("run_project", {}), c);
    expect(r.content).toContain("No hay ningún archivo .html");
  });

  it("devuelve logs y errores del outcome", async () => {
    const c = ctx({
      runProject: async () => ({
        // se ejecutó y dio un error: `ok` es «sin errores», así que aquí es
        // false. Antes este fixture ponía `ok: true` con `errors: 1`, una
        // combinación que en la realidad no se da nunca.
        ok: false,
        ejecutado: true,
        logs: 3,
        errors: 1,
        logLines: ["log1", "log2", "log3"],
        errorLines: ["err1"],
      }),
    });
    const r = await runTool(call("run_project", {}), c);
    expect(r.ok).toBe(true);
    expect(r.content).toContain("3 logs");
    expect(r.content).toContain("1 errores");
    expect(r.content).toContain("log1");
    expect(r.content).toContain("err1");
  });
  it("avisa si no hay Sandbox disponible", async () => {
    const r = await runTool(call("run_project", {}), ctx());
    expect(r.ok).toBe(false);
    expect(r.content).toContain("No hay Sandbox");
  });
  it("pasa qa al runProject", async () => {
    let seen = false;
    const c = ctx({
      runProject: async (opts) => {
        seen = opts?.qa === true;
        return { ok: true, ejecutado: true, logs: 0, errors: 0, logLines: [], errorLines: [], qaFindings: 2 };
      },
    });
    await runTool(call("run_project", { qa: true }), c);
    expect(seen).toBe(true);
  });
});

describe("get_quota", () => {
  it("devuelve los datos si hay snapshot", async () => {
    const c = ctx({
      getQuota: () => ({
        providerId: "openai",
        modelId: "gpt-4o",
        requestsRemaining: 42,
        tokensRemaining: 1000,
      }),
    });
    const r = await runTool(call("get_quota", {}), c);
    expect(r.ok).toBe(true);
    expect(r.content).toContain("42");
    expect(r.content).toContain("1000");
  });
  it("mensaje claro si el proveedor no expone cuota", async () => {
    const c = ctx({ getQuota: () => null });
    const r = await runTool(call("get_quota", {}), c);
    expect(r.ok).toBe(true);
    expect(r.content).toContain("no expone");
  });
  it("avisa si no hay getter", async () => {
    const r = await runTool(call("get_quota", {}), ctx());
    expect(r.ok).toBe(true);
    expect(r.content).toContain("No hay datos de cuota");
  });
});

describe("herramientas desconocidas", () => {
  it("rechaza con lista de las disponibles", async () => {
    // search_web ya existe (v3.32): el ejemplo pasa a un nombre de verdad inventado
    const r = await runTool(call("hacker_magic", { q: "hola" }), ctx());
    expect(r.ok).toBe(false);
    expect(r.content).toContain("Herramienta desconocida");
    expect(r.content).toContain("read_file");
    expect(r.content).toContain("write_file");
    expect(r.content).toContain("search_web");
  });
});

describe("verify_project", () => {
  it("avisa si no hay Sandbox disponible", async () => {
    const r = await runTool(call("verify_project", {}), ctx());
    expect(r.ok).toBe(false);
    expect(r.content).toContain("No hay Sandbox");
  });

  it("si el proyecto no se ejecuta, no hay evidencia y lo dice", async () => {
    const c = ctx({
      runProject: async () => ({
        ok: false, ejecutado: false, logs: 0, errors: 0, logLines: [], errorLines: [],
        reason: "el iframe no respondió",
      }),
    });
    const r = await runTool(call("verify_project", {}), c);
    expect(r.ok).toBe(false);
    expect(r.content).toContain("el iframe no respondió");
  });

  it("con ejecución y QA limpios, aprueba (PASS)", async () => {
    const c = ctx({
      projectFiles: {
        "index.html": '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width"><title>Forja</title></head><body><img alt="Logo" src="logo.svg"></body></html>',
        "logo.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",
      },
      runProject: async () => ({
        ok: true, ejecutado: true, logs: 0, errors: 0, logLines: [], errorLines: [],
        qa: { width: 320, ok: true, items: [], at: Date.now(), noRespondio: false },
      }),
    });
    const r = await runTool(call("verify_project", {}), c);
    expect(r.ok).toBe(true);
    expect(r.content).toContain("PASS");
  });

  it("nunca aprueba solo con la ejecución: sin QA visual, sigue sin PASS", async () => {
    const c = ctx({
      runProject: async () => ({ ok: true, ejecutado: true, logs: 0, errors: 0, logLines: [], errorLines: [] }),
    });
    const r = await runTool(call("verify_project", {}), c);
    expect(r.content).toContain("NO PASS");
  });
});

describe("diagnose_project", () => {
  it("avisa si no hay Sandbox disponible", async () => {
    const r = await runTool(call("diagnose_project", {}), ctx());
    expect(r.ok).toBe(false);
    expect(r.content).toContain("No hay Sandbox");
  });

  it("si el proyecto no se ejecuta, diagnostica el fallo de runtime como bloqueante", async () => {
    const c = ctx({
      runProject: async () => ({
        ok: false, ejecutado: false, logs: 0, errors: 0, logLines: [], errorLines: [],
        reason: "el iframe no respondió",
      }),
    });
    const r = await runTool(call("diagnose_project", {}), c);
    expect(r.ok).toBe(true);
    expect(r.content).toContain("BLOCKED");
    expect(r.content).toContain("el iframe no respondió");
  });

  it("con hallazgos reales, da causa, acción y archivo candidato — no inventa una línea", async () => {
    const c = ctx({
      projectFiles: {
        "index.html": '<!doctype html><html><body><img src="logo.svg"></body></html>',
      },
      runProject: async () => ({
        ok: true, ejecutado: true, logs: 0, errors: 0, logLines: [], errorLines: [],
        qa: { width: 320, ok: true, items: [], at: Date.now(), noRespondio: false },
      }),
    });
    const r = await runTool(call("diagnose_project", {}), c);
    expect(r.ok).toBe(true);
    expect(r.content).toContain("Diagnóstico accionable");
    expect(r.content).toContain("index.html");
  });

  it("con el proyecto limpio, el diagnóstico dice que está listo", async () => {
    const c = ctx({
      projectFiles: {
        "index.html": '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width"><title>Forja</title></head><body><img alt="Logo" src="logo.svg"></body></html>',
        "logo.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",
      },
      runProject: async () => ({
        ok: true, ejecutado: true, logs: 0, errors: 0, logLines: [], errorLines: [],
        qa: { width: 320, ok: true, items: [], at: Date.now(), noRespondio: false },
      }),
    });
    const r = await runTool(call("diagnose_project", {}), c);
    expect(r.content).toContain("READY");
  });
});

describe("check_definition_of_done", () => {
  const proyectoLimpio = {
    "index.html": '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width"><title>Forja</title></head><body><img alt="Logo" src="logo.svg"></body></html>',
    "logo.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",
  };
  const qaLimpio = { width: 320, ok: true, items: [], at: Date.now(), noRespondio: false };

  it("avisa si no hay Sandbox disponible", async () => {
    const r = await runTool(call("check_definition_of_done", {}), ctx());
    expect(r.ok).toBe(false);
    expect(r.content).toContain("No hay Sandbox");
  });

  it("si el proyecto no se ejecuta, no hay evidencia y dice NO LISTO", async () => {
    const c = ctx({
      runProject: async () => ({
        ok: false, ejecutado: false, logs: 0, errors: 0, logLines: [], errorLines: [],
        reason: "el iframe no respondió",
      }),
    });
    const r = await runTool(call("check_definition_of_done", {}), c);
    expect(r.ok).toBe(true);
    expect(r.content).toContain("NO LISTO PARA PUBLICAR");
    expect(r.content).toContain("el iframe no respondió");
  });

  it("con verificación, seguridad y salud limpias, dice LISTO PARA PUBLICAR", async () => {
    const c = ctx({
      projectFiles: proyectoLimpio,
      runProject: async () => ({
        ok: true, ejecutado: true, logs: 0, errors: 0, logLines: [], errorLines: [], qa: qaLimpio,
      }),
    });
    const r = await runTool(call("check_definition_of_done", {}), c);
    expect(r.ok).toBe(true);
    expect(r.content).toContain("LISTO PARA PUBLICAR");
    expect(r.content).not.toContain("NO LISTO");
  });

  it("aunque verify_project apruebe, un bloqueante de salud (página huérfana en el mapa) tumba el veredicto", async () => {
    // El mapa del proyecto es evidencia que `verify_project` no mira: aquí es
    // donde `check_definition_of_done` aporta algo que el otro tool no ve.
    const c = ctx({
      projectFiles: proyectoLimpio,
      runProject: async () => ({
        ok: true, ejecutado: true, logs: 0, errors: 0, logLines: [], errorLines: [], qa: qaLimpio,
      }),
      projectMap: {
        name: "Demo",
        description: "demo",
        files: [{ name: "index.html", kind: "html", summary: "portada", links: [] }],
        features: [],
        updatedAt: Date.now(),
      },
    });
    const r = await runTool(call("check_definition_of_done", {}), c);
    expect(r.content).toContain("NO LISTO PARA PUBLICAR");
    expect(r.content).toContain("huérfana");
  });

  it("una credencial embebida se detecta y bloquea el veredicto", async () => {
    // ensamblada en runtime para no disparar el guard de higiene del repo
    // (tests/unit/higiene-repo.test.ts) con una clave de forma real en el fuente
    const clave = ["sk", "-abcdefghijklmnopqrstuvwx"].join("");
    const c = ctx({
      projectFiles: {
        ...proyectoLimpio,
        "config.js": `const key = '${clave}';`,
      },
      runProject: async () => ({
        ok: true, ejecutado: true, logs: 0, errors: 0, logLines: [], errorLines: [], qa: qaLimpio,
      }),
    });
    const r = await runTool(call("check_definition_of_done", {}), c);
    expect(r.content).toContain("NO LISTO PARA PUBLICAR");
    expect(r.content).toContain("Hallazgos de seguridad");
  });

  it("nunca inventa un check que no corrió: sin QA visual no hay PASS aunque no truene nada", async () => {
    const c = ctx({
      projectFiles: proyectoLimpio,
      runProject: async () => ({ ok: true, ejecutado: true, logs: 0, errors: 0, logLines: [], errorLines: [] }),
    });
    const r = await runTool(call("check_definition_of_done", {}), c);
    expect(r.content).toContain("NO LISTO PARA PUBLICAR");
    expect(r.content).toContain("NO PASS");
  });
});

describe("visual_review", () => {
  it("avisa si no hay Sandbox disponible", async () => {
    const r = await runTool(call("visual_review", {}), ctx());
    expect(r.ok).toBe(false);
    expect(r.content).toContain("No hay Sandbox");
  });

  it("avisa si no hay forma de pedir la crítica (sin visionCritique)", async () => {
    const c = ctx({
      runProject: async () => ({ ok: true, ejecutado: true, logs: 0, errors: 0, logLines: [], errorLines: [] }),
    });
    const r = await runTool(call("visual_review", {}), c);
    expect(r.ok).toBe(false);
    expect(r.content).toContain("crítica visual");
  });

  it("si el proyecto no se ejecuta, lo dice y no llega a pedir captura", async () => {
    let pidioCritica = false;
    const c = ctx({
      runProject: async () => ({
        ok: false,
        ejecutado: false,
        logs: 0,
        errors: 0,
        logLines: [],
        errorLines: [],
        reason: "No hay ningún archivo .html en el proyecto.",
      }),
      visionCritique: async () => {
        pidioCritica = true;
        return { ok: true, texto: "no debería llegar aquí" };
      },
    });
    const r = await runTool(call("visual_review", {}), c);
    expect(r.content).toContain("No hay ningún archivo .html");
    expect(pidioCritica, "no pide crítica de una página que no se ejecutó").toBe(false);
  });

  it("si la captura falla, lo dice con el motivo y no llega a pedir crítica", async () => {
    let pidioCritica = false;
    const c = ctx({
      runProject: async () => ({
        ok: true,
        ejecutado: true,
        logs: 0,
        errors: 0,
        logLines: [],
        errorLines: [],
        screenshot: { ok: false, error: "canvas contaminado" },
      }),
      visionCritique: async () => {
        pidioCritica = true;
        return { ok: true, texto: "no debería llegar aquí" };
      },
    });
    const r = await runTool(call("visual_review", {}), c);
    expect(r.ok).toBe(true);
    expect(r.content).toContain("No se pudo capturar");
    expect(r.content).toContain("canvas contaminado");
    expect(pidioCritica, "no pide crítica sin una captura de verdad").toBe(false);
  });

  it("pide la captura con screenshot:true y pasa el dataUrl y el foco a la crítica", async () => {
    let vistoOpts: { screenshot?: boolean } | undefined;
    let vistoDataUrl = "";
    let vistoFoco: string | undefined;
    const c = ctx({
      runProject: async (opts) => {
        vistoOpts = opts;
        return {
          ok: true,
          ejecutado: true,
          logs: 0,
          errors: 0,
          logLines: [],
          errorLines: [],
          screenshot: { ok: true, dataUrl: "data:image/jpeg;base64,ABC123" },
        };
      },
      visionCritique: async (dataUrl, foco) => {
        vistoDataUrl = dataUrl;
        vistoFoco = foco;
        return { ok: true, texto: "El botón principal queda sin contraste contra el fondo." };
      },
    });
    const r = await runTool(call("visual_review", { foco: "el CTA" }), c);
    expect(vistoOpts?.screenshot).toBe(true);
    expect(vistoDataUrl).toBe("data:image/jpeg;base64,ABC123");
    expect(vistoFoco).toBe("el CTA");
    expect(r.ok).toBe(true);
    expect(r.content).toContain("sin contraste");
  });

  it("cuando el modelo activo no admite imágenes, la crítica lo dice y no se finge una respuesta", async () => {
    const c = ctx({
      runProject: async () => ({
        ok: true,
        ejecutado: true,
        logs: 0,
        errors: 0,
        logLines: [],
        errorLines: [],
        screenshot: { ok: true, dataUrl: "data:image/jpeg;base64,ABC123" },
      }),
      visionCritique: async () => ({
        ok: false,
        texto: "El modelo activo no admite imágenes. Elige un modelo con visión para usar «visual_review».",
      }),
    });
    const r = await runTool(call("visual_review", {}), c);
    expect(r.ok).toBe(true);
    expect(r.content).toContain("no admite imágenes");
  });
});

describe("runTools (paralelo)", () => {
  it("ejecuta varias llamadas a la vez y devuelve en orden", async () => {
    const c = ctx();
    const results = await runTools(
      [
        call("read_file", { path: "index.html" }),
        call("read_file", { path: "styles.css" }),
        call("list_files", {}),
      ],
      c
    );
    expect(results).toHaveLength(3);
    expect(results[0].content).toContain("hola");
    expect(results[1].content).toContain("color: red");
    expect(results[2].content).toContain("index.html");
  });
});
