import { describe, it, expect } from "vitest";
import {
  blockingKeys,
  diagnosticKey,
  entropy,
  extractRefs,
  findUnbalanced,
  lineAt,
  maskCss,
  maskJs,
  printableStrings,
  reviewProject,
  type Diagnostic,
  type ReviewFile,
} from "../../src/lib/forja/sandbox-review";

/** Proyecto mínimo y correcto sobre el que añadir el caso de cada prueba. */
function projectOf(extra: Record<string, string>, base = true): ReviewFile[] {
  const files: Record<string, string> = base
    ? {
        "index.html": `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Proyecto</title>
</head><body></body></html>`,
        "README.md": "# Proyecto",
        ".gitignore": "node_modules\n",
        LICENSE: "MIT",
      }
    : {};
  return Object.entries({ ...files, ...extra }).map(([path, text]) => ({
    path,
    text,
    size: text.length,
  }));
}

function find(ds: Diagnostic[], family: string, needle: string): Diagnostic | undefined {
  return ds.find((d) => d.family === family && d.message.includes(needle));
}

/* Fixtures de credenciales FALSAS para el detector. Se ensamblan en tiempo de
 * ejecución a propósito: así el código fuente no contiene patrones que los
 * escáneres estáticos (GitHub, plataformas de subida) confundan con secretos
 * reales, pero el detector sí los ve tal y como llegan en runtime. */
const sec = (...partes: string[]) => partes.join("");
const K_ANTHROPIC = sec("sk", "-ant", "-api03-", "abcdefghijklmnopqrstuvwxyz0123456789");
const K_AWS = sec("AK", "IAIOSFODNN7EXAMPLE"); // ejemplo canónico de la doc de AWS
const K_GITHUB = sec("ghp_", "0123456789abcdefghijklmnopqrstuvwxyz");
const K_GOOGLE = sec("AI", "zaSyA1bC2dE3fG4hI5jK6lM7nO8pQ9rS0tU1v");
const K_PEM = sec("-----BEGIN", " OPENSSH", " PRIVATE", " KEY-----");

describe("lineAt", () => {
  it("cuenta las líneas 1-based", () => {
    const t = "uno\ndos\ntres";
    expect(lineAt(t, 0)).toBe(1);
    expect(lineAt(t, 4)).toBe(2);
    expect(lineAt(t, 8)).toBe(3);
    expect(lineAt(t, 9999)).toBe(3);
  });
});

describe("maskJs", () => {
  it("no cuenta delimitadores dentro de cadenas ni comentarios", () => {
    const code = `const a = "no {cuenta}"; // tampoco }
/* ni } aquí */
function f() { return 1; }`;
    expect(findUnbalanced(maskJs(code))).toBeNull();
  });
  it("conserva la longitud y los saltos de línea", () => {
    const code = "const s = 'abc';\nconst t = 2;\n";
    const m = maskJs(code);
    expect(m).toHaveLength(code.length);
    expect(m.split("\n")).toHaveLength(code.split("\n").length);
  });
  it("no se confunde con la división ni con las expresiones regulares", () => {
    expect(findUnbalanced(maskJs("const r = /[}{]/g; const d = a / b;"))).toBeNull();
  });
  it("detecta una llave sin cerrar de verdad", () => {
    const bad = findUnbalanced(maskJs("function f() {\n  if (x) {\n    y();\n}\n"));
    expect(bad).not.toBeNull();
    expect(bad?.expected).toBe("{");
  });
  it("detecta un cierre huérfano", () => {
    const bad = findUnbalanced(maskJs("const a = 1;\n}\n"));
    expect(bad?.found).toBe("}");
  });

  /* --- regresiones de los falsos positivos del revisor sobre su propio
   *     código (public/motor-forja.mjs, verificacion-v47.mjs) --- */

  it("regex justo tras la cabecera de un for/if sin llaves no se traga el código", () => {
    // El «/» tras «)» es ambiguo (¿división o regex?): si el «(» abría una
    // cabecera for/if/while/…, el turno empieza ahí y es un regex.
    const code = "for (let x of lista) /\\balt\\s*=/i.test(x) || fallos.push(x);";
    expect(findUnbalanced(maskJs(code))).toBeNull();
  });

  it("regex tras palabra que solo precede un valor (return/re/)", () => {
    expect(findUnbalanced(maskJs("function f(s){ return /\\d+/.test(s) ? 1 : 0; }"))).toBeNull();
  });

  it("plantillas anidadas con interpolación cuentan su código interior", () => {
    const code = "const t = `a ${ x ? `b${c}` : `${d} )` } e(${f(1)}) g`;";
    expect(findUnbalanced(maskJs(code))).toBeNull();
  });

  it("un regex con backticks (/```/g) no rompe el balance", () => {
    const code = 'if((a.match(/```/g)??[]).length%2===1)return!0;';
    expect(findUnbalanced(maskJs(code))).toBeNull();
  });

  it("un «)» dentro del TEXTO de una plantilla no cierra nada", () => {
    const code = "const h = `pares ) sueltos ( y llaves } en el texto`;";
    expect(findUnbalanced(maskJs(code))).toBeNull();
  });
});

describe("maskCss", () => {
  it("ignora llaves dentro de comentarios y cadenas", () => {
    const css = `/* } */ .a { content: "}"; }`;
    expect(findUnbalanced(maskCss(css).replace(/[()[\]]/g, " "))).toBeNull();
  });
});

describe("entropy", () => {
  it("da más entropía a un token aleatorio que a una palabra repetida", () => {
    expect(entropy("aaaaaaaa")).toBeLessThan(1);
    expect(entropy("f3K9zQ1pR7wX2mL8")).toBeGreaterThan(3);
  });
});

describe("extractRefs", () => {
  it("resuelve las referencias del HTML respecto a su carpeta", () => {
    const refs = extractRefs(
      "sub/pag.html",
      '<link rel="stylesheet" href="../css/a.css"><img src="img/b.png"><a href="https://x.com">x</a>'
    );
    expect(refs.map((r) => r.target)).toEqual(["css/a.css", "sub/img/b.png"]);
  });
  it("desglosa srcset en cada candidato", () => {
    const refs = extractRefs("i.html", '<img srcset="a.png 1x, b.png 2x">');
    expect(refs.map((r) => r.target)).toEqual(["a.png", "b.png"]);
  });
  it("saca url() y @import del CSS", () => {
    const refs = extractRefs("css/e.css", '@import "otro.css";\nbody{background:url(../img/f.png)}');
    expect(refs.map((r) => r.target)).toEqual(["css/otro.css", "img/f.png"]);
  });
  it("saca url() de un <style> embebido en el HTML", () => {
    const refs = extractRefs("i.html", "<style>body{background:url(img/g.png)}</style>");
    expect(refs.map((r) => r.target)).toEqual(["img/g.png"]);
  });
  it("un @import de PAQUETE (Tailwind 4) no es un enlace roto", () => {
    // `@import "tailwindcss"` lo resuelve el build desde node_modules; marcarlo
    // de roto daba falsos positivos en cualquier proyecto Tailwind 4.
    const refs = extractRefs(
      "src/app/globals.css",
      '@import "tailwindcss";\n@import "tw-animate-css";\n@import "tailwindcss/theme.css";'
    );
    expect(refs).toHaveLength(0);
  });
  it("un @import relativo SÍ se sigue comprobando", () => {
    const refs = extractRefs("src/app/globals.css", '@import "./tema.css";\n@import "paquete/tema.css";');
    // «./tema.css» es local; «paquete/tema.css» es subruta de paquete (sin
    // punto en el primer segmento) y no se marca.
    expect(refs.map((r) => r.target)).toEqual(["src/app/tema.css"]);
  });
});

describe("reviewProject — credenciales", () => {
  it("detecta claves de proveedores conocidos como error", () => {
    const r = reviewProject(
      projectOf({ "app.js": `const k = "${K_ANTHROPIC}";` })
    );
    const d = find(r.diagnostics, "secreto", "Anthropic");
    expect(d?.level).toBe("error");
    expect(d?.file).toBe("app.js");
    expect(r.ready).toBe(false);
  });
  it("detecta claves de AWS, GitHub y Google", () => {
    const r = reviewProject(
      projectOf({
        "a.js": [
          `const aws = "${K_AWS}";`,
          `const gh = "${K_GITHUB}";`,
          `const g = "${K_GOOGLE}";`,
        ].join("\n"),
      })
    );
    expect(find(r.diagnostics, "secreto", "AWS")).toBeDefined();
    expect(find(r.diagnostics, "secreto", "GitHub")).toBeDefined();
    expect(find(r.diagnostics, "secreto", "Google")).toBeDefined();
  });
  it("señala la línea exacta del hallazgo", () => {
    const r = reviewProject(
      projectOf({ "a.js": `// uno\n// dos\nconst k = "${K_AWS}";` })
    );
    expect(find(r.diagnostics, "secreto", "AWS")?.line).toBe(3);
  });
  it("no confunde un hueco por rellenar con una credencial", () => {
    const r = reviewProject(
      projectOf({
        "conf.js": [
          'const apiKey = "tu-clave-aqui";',
          'const password = "changeme";',
          'const token = process.env.TOKEN;',
          'const secret_key = "xxxxxxxxxxxx";',
          'const access_token = "<PON_TU_TOKEN>";',
        ].join("\n"),
      })
    );
    expect(r.diagnostics.filter((d) => d.family === "secreto")).toHaveLength(0);
  });
  it("avisa de una asignación genérica con pinta de credencial real", () => {
    const r = reviewProject(
      projectOf({ "conf.js": 'const apiKey = "f3K9zQ1pR7wX2mL8vB6nT4yH";' })
    );
    const d = find(r.diagnostics, "secreto", "apiKey");
    expect(d?.level).toBe("warn");
  });
  it("detecta una clave privada en un archivo suelto", () => {
    const r = reviewProject(
      projectOf({ "notas.txt": `${K_PEM}\n${sec("MI", "IE...")}\n` })
    );
    expect(find(r.diagnostics, "secreto", "clave privada")?.level).toBe("error");
  });
});

describe("reviewProject — archivos que no deberían subirse", () => {
  it("marca .env como error y respeta .env.example", () => {
    const r = reviewProject(projectOf({ ".env": "API_KEY=1", ".env.example": "API_KEY=" }));
    const errs = r.diagnostics.filter((d) => d.family === "privado" && d.file === ".env");
    expect(errs[0]?.level).toBe("error");
    expect(r.diagnostics.some((d) => d.family === "privado" && d.file === ".env.example")).toBe(
      false
    );
  });
  it("marca certificados y claves SSH", () => {
    const r = reviewProject(projectOf({ "certs/server.pem": "x", ".ssh/id_rsa": "x" }));
    expect(r.diagnostics.filter((d) => d.family === "privado" && d.level === "error")).toHaveLength(
      2
    );
  });
  it("avisa de node_modules y de la basura del sistema", () => {
    const r = reviewProject(projectOf({ "node_modules/x/i.js": "1", ".DS_Store": "x" }));
    expect(find(r.diagnostics, "privado", "dependencias")?.level).toBe("warn");
    expect(find(r.diagnostics, "privado", "basura")?.level).toBe("info");
  });
});

describe("reviewProject — enlaces rotos", () => {
  it("detecta un recurso local que no existe y da su línea", () => {
    const r = reviewProject(
      projectOf({
        "index.html": `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>t</title>
<link rel="stylesheet" href="css/falta.css">
</head><body></body></html>`,
      })
    );
    const d = find(r.diagnostics, "ref", "css/falta.css");
    expect(d?.level).toBe("error");
    expect(d?.line).toBe(5);
  });
  it("no marca los recursos que sí están ni los externos", () => {
    const r = reviewProject(
      projectOf({
        "index.html": `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="w"><title>t</title>
<link rel="stylesheet" href="css/a.css">
<script src="https://cdn.ejemplo.com/x.js"></script></head><body></body></html>`,
        "css/a.css": "body{}",
      })
    );
    expect(r.diagnostics.filter((d) => d.family === "ref")).toHaveLength(0);
  });
});

describe("reviewProject — sintaxis", () => {
  it("detecta JSON inválido", () => {
    const r = reviewProject(projectOf({ "datos.json": '{"a": 1,}' }));
    expect(find(r.diagnostics, "sintaxis", "JSON inválido")?.level).toBe("error");
  });
  it("acepta JSON válido", () => {
    const r = reviewProject(projectOf({ "datos.json": '{"a": 1}' }));
    expect(r.diagnostics.filter((d) => d.family === "sintaxis")).toHaveLength(0);
  });
  it("detecta llaves desbalanceadas en JS y en CSS", () => {
    const r = reviewProject(
      projectOf({ "a.js": "function f() {\n", "e.css": ".a { color: red;\n" })
    );
    expect(r.diagnostics.filter((d) => d.family === "sintaxis" && d.level === "error")).toHaveLength(
      2
    );
  });
});

describe("reviewProject — HTML", () => {
  it("echa en falta doctype, charset, viewport y title", () => {
    const html = "<html><body><p>hola</p></body></html>";
    const r = reviewProject([
      ...projectOf({}).filter((f) => f.path !== "index.html"),
      { path: "index.html", text: html, size: html.length },
    ]);
    for (const needle of ["doctype", "charset", "viewport", "<title>"]) {
      expect(find(r.diagnostics, "html", needle), needle).toBeDefined();
    }
  });
  it("no se queja de un HTML completo", () => {
    const r = reviewProject(projectOf({}));
    expect(r.diagnostics.filter((d) => d.family === "html")).toHaveLength(0);
  });
  it("señala las imágenes sin alt", () => {
    const r = reviewProject(
      projectOf({
        "p.html": '<!doctype html><html lang="es"><head><meta charset="utf-8">\n<meta name="viewport" content="w"><title>t</title></head><body><img src="a.png"></body></html>',
        "a.png": "",
      })
    );
    expect(find(r.diagnostics, "html", "sin atributo alt")?.level).toBe("info");
  });
});

describe("reviewProject — GitHub", () => {
  it("detecta colisiones de mayúsculas", () => {
    const r = reviewProject(projectOf({ "Util.js": "1", "util.js": "2" }));
    expect(find(r.diagnostics, "git", "salvo mayúsculas")?.level).toBe("error");
  });
  it("rechaza los archivos por encima del límite de GitHub", () => {
    const files = projectOf({});
    files.push({ path: "video.bin", text: null, size: 120 * 1024 * 1024 });
    const r = reviewProject(files);
    expect(find(r.diagnostics, "git", "rechaza")?.level).toBe("error");
  });
});

describe("reviewProject — proyecto y resumen", () => {
  it("echa en falta README, .gitignore, licencia y página de entrada", () => {
    const r = reviewProject(projectOf({ "notas.txt": "hola" }, false));
    expect(find(r.diagnostics, "proyecto", "README")).toBeDefined();
    expect(find(r.diagnostics, "proyecto", ".gitignore")).toBeDefined();
    expect(find(r.diagnostics, "proyecto", "licencia")).toBeDefined();
    expect(find(r.diagnostics, "proyecto", "HTML")).toBeDefined();
  });
  it("un proyecto correcto queda listo para subir", () => {
    const r = reviewProject(projectOf({}));
    expect(r.ready).toBe(true);
    expect(r.counts.error).toBe(0);
  });
  it("ordena por gravedad y cuenta lo analizado", () => {
    const r = reviewProject(projectOf({ "a.js": `const k = "${K_AWS}"; // TODO` }));
    expect(r.diagnostics[0].level).toBe("error");
    expect(r.scanned).toBe(r.total);
    expect(r.counts.error + r.counts.warn + r.counts.info).toBe(r.diagnostics.length);
  });
  it("no analiza el contenido de los binarios pero sí su ruta", () => {
    const r = reviewProject([{ path: "foto.png", text: null, size: 10 }]);
    expect(r.scanned).toBe(0);
    expect(r.total).toBe(1);
  });
});

describe("reviewProject — riesgos y limpieza", () => {
  it("avisa de debugger, eval y http:// sin cifrar", () => {
    const r = reviewProject(
      projectOf({ "a.js": 'debugger;\neval("1");\nfetch("http://ejemplo.com/x");' })
    );
    expect(find(r.diagnostics, "riesgo", "debugger")?.level).toBe("warn");
    expect(find(r.diagnostics, "riesgo", "eval()")?.level).toBe("warn");
    expect(find(r.diagnostics, "riesgo", "http://")?.level).toBe("warn");
  });
  it("no marca http://localhost", () => {
    const r = reviewProject(projectOf({ "a.js": 'fetch("http://localhost:3000");' }));
    expect(r.diagnostics.filter((d) => d.family === "riesgo")).toHaveLength(0);
  });
  it("recuerda los TODO y los console.log pendientes", () => {
    const r = reviewProject(projectOf({ "a.js": "// TODO: acabar\nconsole.log(1);" }));
    expect(find(r.diagnostics, "estilo", "TODO")).toBeDefined();
    expect(find(r.diagnostics, "estilo", "console.log")).toBeDefined();
  });
});

describe("reviewProject — falsos positivos que no debe dar", () => {
  it("no confunde el xmlns de un SVG con un recurso sin cifrar", () => {
    const r = reviewProject(
      projectOf({
        "logo.svg": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0"/></svg>',
      })
    );
    expect(r.diagnostics.filter((d) => d.family === "riesgo")).toHaveLength(0);
  });
  it("tampoco con los espacios de nombres de Inkscape ni con el DOCTYPE antiguo", () => {
    const r = reviewProject(
      projectOf({
        "d.svg": '<svg xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:cc="http://creativecommons.org/ns#"></svg>',
      })
    );
    expect(r.diagnostics.filter((d) => d.family === "riesgo")).toHaveLength(0);
  });
  it("pero sigue avisando de una descarga real por http://", () => {
    const r = reviewProject(projectOf({ "a.js": 'fetch("http://api.ejemplo.com/datos");' }));
    expect(find(r.diagnostics, "riesgo", "http://")?.level).toBe("warn");
  });
});

describe("blockingKeys / diagnosticKey — el permiso se ata a lo que se vio", () => {
  const conCredencial = (extra: Record<string, string> = {}) =>
    reviewProject(projectOf({ "a.js": `const k = "${K_AWS}";`, ...extra }));

  it("solo cuentan los hallazgos que bloquean, no los avisos", () => {
    // «debugger» es aviso, la clave de AWS es error: solo la segunda bloquea
    const r = conCredencial({ "b.js": "debugger;" });
    expect(r.counts.warn).toBeGreaterThan(0);
    const claves = blockingKeys(r);
    expect(claves.size).toBe(r.counts.error);
    expect([...claves].every((k) => k.startsWith("secreto|"))).toBe(true);
  });

  it("el mismo proyecto da las mismas claves: el permiso sigue valiendo", () => {
    const a = blockingKeys(conCredencial());
    const b = blockingKeys(conCredencial());
    expect([...b].every((k) => a.has(k))).toBe(true);
  });

  it("una credencial NUEVA no queda cubierta por el permiso anterior", () => {
    const antes = blockingKeys(conCredencial());
    // se cuela después un token de GitHub en otro archivo
    const despues = blockingKeys(
      conCredencial({ "b.js": `const t = "${K_GITHUB}";` })
    );
    expect([...despues].every((k) => antes.has(k))).toBe(false);
  });

  it("corregir un hallazgo no revoca el permiso de los que quedan", () => {
    const antes = blockingKeys(
      conCredencial({ "b.js": `const t = "${K_GITHUB}";` })
    );
    const despues = blockingKeys(conCredencial()); // se quitó b.js
    expect([...despues].every((k) => antes.has(k))).toBe(true);
  });

  it("la clave distingue archivo y línea, no solo el mensaje", () => {
    const d = { level: "error", family: "secreto", file: "a.js", line: 3, message: "x" } as const;
    expect(diagnosticKey(d)).not.toBe(diagnosticKey({ ...d, file: "b.js" }));
    expect(diagnosticKey(d)).not.toBe(diagnosticKey({ ...d, line: 4 }));
  });
});

describe("credenciales dentro de binarios", () => {
  const bytesDe = (s: string) => new TextEncoder().encode(s);

  it("extrae las cadenas imprimibles y descarta el ruido", () => {
    const crudo = new Uint8Array([0, 1, 2, ...bytesDe("clave_visible_aqui"), 0, 3, ...bytesDe("no")]);
    const out = printableStrings(crudo, 8);
    expect(out).toContain("clave_visible_aqui");
    expect(out).not.toContain("no"); // por debajo del mínimo
  });

  it("encuentra una clave de AWS guardada dentro de un PDF", () => {
    const pdf = new Uint8Array([
      ...bytesDe("%PDF-1.7\n"),
      0, 0, 1,
      ...bytesDe(`/Autor (config) /Clave (${K_AWS})`),
      0,
    ]);
    const r = reviewProject([
      ...projectOf({}),
      { path: "docs/manual.pdf", text: null, size: pdf.length, bytes: pdf },
    ]);
    const d = find(r.diagnostics, "secreto", "AWS");
    expect(d?.level).toBe("error");
    expect(d?.file).toBe("docs/manual.pdf");
    expect(r.ready).toBe(false);
  });

  it("un binario limpio no genera hallazgos", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, ...bytesDe("IHDR imagen normal")]);
    const r = reviewProject([
      ...projectOf({}),
      { path: "img/logo.png", text: null, size: png.length, bytes: png },
    ]);
    expect(r.diagnostics.filter((d) => d.family === "secreto")).toHaveLength(0);
    expect(r.ready).toBe(true);
  });

  it("sin bytes no se inventa nada: solo se mira la ruta y el tamaño", () => {
    const r = reviewProject([
      ...projectOf({}),
      { path: "docs/manual.pdf", text: null, size: 999 },
    ]);
    expect(r.diagnostics.filter((d) => d.family === "secreto")).toHaveLength(0);
  });
});
