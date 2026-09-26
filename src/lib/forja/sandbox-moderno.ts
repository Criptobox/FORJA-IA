/** Forja IA — Proyectos modernos (React, Vite, TypeScript, Tailwind) dentro del Sandbox.
 *
 * Lo que generan casi todas las IAs —y casi cualquier plantilla de hoy— es un
 * proyecto Vite + React + TypeScript + Tailwind: `index.html` con
 * `<script type="module" src="/src/main.tsx">`, componentes `.tsx`, paquetes de
 * npm y un `@/` que apunta a `src/`. El Sandbox solo sabía ejecutar HTML, CSS y
 * JS tal cual, y a todo eso respondía «el Sandbox no instala dependencias».
 *
 * Aquí se hace lo que hace Vite en desarrollo, pero dentro del navegador y sin
 * servidor:
 *
 *  - **TS/TSX/JSX → JS** con Sucrase (rápido, ligero y sin comprobar tipos:
 *    lo mismo que hace Vite con esbuild). Se carga solo cuando hace falta.
 *  - **Paquetes de npm** desde esm.sh, con la versión de tu `package.json` y
 *    React fijado a una sola copia (dos Reacts = «Invalid hook call»).
 *  - **CSS importado desde JS**, CSS Modules, JSON, imágenes y `?raw`/`?url`
 *    como módulos inventados.
 *  - **Alias** de `tsconfig.json` (`@/` → `src/` si no dice otra cosa).
 *  - **Tailwind** v3 (con tu `tailwind.config`) y v4, con su CDN oficial de
 *    navegador.
 *  - **`import.meta.env`** y **`process.env`** con las variables públicas de tus
 *    `.env` (solo `VITE_*` y `REACT_APP_*`, como hacen Vite y CRA).
 *  - **React Router**: `BrowserRouter` pasa a `MemoryRouter`, porque dentro del
 *    iframe la dirección es `about:srcdoc` y ninguna ruta casaría.
 *  - La carpeta **`public/`** se sirve en la raíz, como en Vite.
 *
 *  - **Vue** (`.vue`, con `<script setup>`, TS y estilos `scoped`) y **Svelte 5**
 *    (`.svelte`): sus compiladores se cargan solo si el proyecto los usa.
 *
 * Lo que NO se puede: Next.js (necesita servidor) y código de Node (fs,
 * servidores). Se dice claro en vez de pintar una página en blanco.
 *
 * Funciones puras salvo `cargarTraductor`: se prueban sin navegador.
 */
import { extOf, mimeFor, resolvePath, toDataUrl } from "./sandbox";
import type { OpcionesGrafo } from "./sandbox-modules";

/** Un valor como literal de JavaScript que se puede pegar en cualquier sitio:
 *  dentro de un módulo, de un `<script>` o de un atributo. `JSON.stringify` ya
 *  escapa comillas y saltos, pero deja `<`, `>`, `/` y los separadores de
 *  línea U+2028/U+2029: un `</script>` dentro de un CSS o de un .env cerraría
 *  la etiqueta antes de tiempo. */
const ESCAPES_JS: Record<string, string> = {
  "<": "\\u003C",
  ">": "\\u003E",
  "/": "\\u002F",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};
export function literalJs(valor: unknown): string {
  return JSON.stringify(valor).replace(/[<>/\u2028\u2029]/g, (c) => ESCAPES_JS[c]);
}

/* ------------------------------------------------------------------ */
/* detección                                                          */
/* ------------------------------------------------------------------ */

export type Framework = "react" | "preact" | "solid" | "vue" | "svelte" | "next" | "vanilla";

export interface ProyectoModerno {
  /** carpeta donde vive el package.json ("" = raíz) */
  raiz: string;
  framework: Framework;
  /** dependencias declaradas: nombre → versión limpia («18.3.1», o "" si no se sabe) */
  deps: Record<string, string>;
  /** prefijo de alias → carpeta («@/» → «src/») */
  alias: Record<string, string>;
  tailwind: 3 | 4 | null;
  /** de dónde sale el JSX automático («react», «preact»…) */
  jsxImportSource: string;
  /** ¿se puede ejecutar aquí? */
  soportado: boolean;
  /** por qué no, en palabras del usuario */
  motivo?: string;
}

const dec = new TextDecoder();
const leer = (files: Map<string, Uint8Array>, p: string): string | null => {
  const d = files.get(p);
  return d ? dec.decode(d) : null;
};
const unir = (raiz: string, p: string) => (raiz ? `${raiz}/${p}` : p);

/** JSON con comentarios y comas finales (tsconfig, jsconfig). */
function jsonTolerante(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    try {
      const sin = texto
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:"'])\/\/.*$/gm, "$1")
        .replace(/,(\s*[}\]])/g, "$1");
      return JSON.parse(sin);
    } catch {
      return null;
    }
  }
}

/** «^18.3.1» → «18.3.1»; «latest», «*», «workspace:*», rutas… → "" */
export function versionLimpia(v: string): string {
  const m = /(\d+\.\d+\.\d+(?:-[\w.]+)?|\d+\.\d+|\d+)/.exec(v ?? "");
  if (!m || /^(file|link|workspace|git|github|http)/i.test(v)) return "";
  return m[1];
}

const TIENE_CODIGO_MODERNO = /\.(tsx|jsx|ts|mts)$/i;

/**
 * ¿Es un proyecto moderno, y cuál? `null` si es una web de HTML/CSS/JS de las
 * de siempre (el Sandbox la sigue ejecutando como hasta ahora).
 */
export function detectarProyectoModerno(files: Map<string, Uint8Array>): ProyectoModerno | null {
  const paths = [...files.keys()];
  const hondo = (p: string) => p.split("/").length;
  const pkgPath = paths
    .filter((p) => p.split("/").pop() === "package.json" && !p.includes("node_modules/"))
    .sort((a, b) => hondo(a) - hondo(b))[0];
  const raiz = pkgPath ? pkgPath.split("/").slice(0, -1).join("/") : "";
  const conCodigo = paths.some((p) => TIENE_CODIGO_MODERNO.test(p) && !p.endsWith(".d.ts"));
  if (!pkgPath && !conCodigo) return null;

  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
  if (pkgPath) {
    const j = jsonTolerante(leer(files, pkgPath) ?? "");
    if (j && typeof j === "object") pkg = j as typeof pkg;
  }
  const todas = { ...(pkg.devDependencies ?? {}), ...(pkg.dependencies ?? {}) };
  const deps: Record<string, string> = {};
  for (const [n, v] of Object.entries(todas)) deps[n] = versionLimpia(String(v));

  // Un package.json sin nada de front (una API de Node, un script) no es esto
  const hayFront =
    conCodigo ||
    ["react", "preact", "solid-js", "vue", "svelte", "next", "vite", "react-scripts"].some((d) => d in deps);
  if (!hayFront) return null;

  const framework: Framework =
    "next" in deps
      ? "next"
      : "vue" in deps || paths.some((p) => p.endsWith(".vue"))
        ? "vue"
        : "svelte" in deps || paths.some((p) => p.endsWith(".svelte"))
          ? "svelte"
          : "solid-js" in deps
            ? "solid"
            : "preact" in deps && !("react" in deps)
              ? "preact"
              : "react" in deps || paths.some((p) => /\.(tsx|jsx)$/i.test(p))
                ? "react"
                : "vanilla";

  // alias: los de tsconfig/jsconfig; si no hay, el convenio «@/» → «src/»
  const alias: Record<string, string> = {};
  for (const nombre of ["tsconfig.json", "tsconfig.app.json", "jsconfig.json"]) {
    const j = jsonTolerante(leer(files, unir(raiz, nombre)) ?? "") as {
      compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
    } | null;
    const opts = j?.compilerOptions;
    if (!opts?.paths) continue;
    const base = (opts.baseUrl ?? ".").replace(/^\.\/?/, "").replace(/\/$/, "");
    for (const [clave, destinos] of Object.entries(opts.paths)) {
      if (!clave.endsWith("/*") || !destinos?.[0]?.endsWith("/*")) continue;
      const destino = resolvePath(base, destinos[0].slice(0, -1));
      alias[clave.slice(0, -1)] = destino ? `${destino}/` : "";
    }
  }
  if (!Object.keys(alias).length) alias["@/"] = "src/";
  // «~/» también lo usan algunas plantillas
  if (!("~/" in alias)) alias["~/"] = alias["@/"] ?? "src/";

  const tw = deps.tailwindcss ?? deps["@tailwindcss/vite"] ?? deps["@tailwindcss/postcss"];
  const cssV4 = paths.some(
    (p) => p.endsWith(".css") && /@import\s+["']tailwindcss["']/.test(leer(files, p) ?? "")
  );
  const tailwind: 3 | 4 | null =
    "@tailwindcss/vite" in deps || "@tailwindcss/postcss" in deps || cssV4 || (tw && tw.startsWith("4"))
      ? 4
      : tw !== undefined || paths.some((p) => /(^|\/)tailwind\.config\.(js|cjs|mjs|ts)$/.test(p))
        ? 3
        : null;

  const jsxImportSource = framework === "preact" ? "preact" : framework === "solid" ? "solid-js/h" : "react";

  const base: ProyectoModerno = {
    raiz,
    framework,
    deps,
    alias,
    tailwind,
    jsxImportSource,
    soportado: true,
  };
  if (framework === "next") {
    return {
      ...base,
      soportado: false,
      motivo:
        "Es un proyecto de Next.js: sus páginas las genera un servidor de Node, y eso no cabe dentro del navegador. Usa «Construir y previsualizar» o despliégalo (Vercel lo abre tal cual).",
    };
  }
  if ("@sveltejs/kit" in deps) {
    return {
      ...base,
      soportado: false,
      motivo: "Es un proyecto de SvelteKit: sus rutas las resuelve un servidor. Usa «Construir y previsualizar» o despliégalo.",
    };
  }
  if ("nuxt" in deps) {
    return {
      ...base,
      soportado: false,
      motivo: "Es un proyecto de Nuxt: sus páginas las genera un servidor. Usa «Construir y previsualizar» o despliégalo.",
    };
  }
  return base;
}

/* ------------------------------------------------------------------ */
/* paquetes de npm → esm.sh                                           */
/* ------------------------------------------------------------------ */

export const CDN = "https://esm.sh";

/** SOLO PARA PRUEBAS: una base local (`localStorage["forja-cdn-pruebas"]`,
 *  únicamente localhost) que sustituye a los CDN de verdad. Las peticiones del
 *  iframe a un CDN externo no siempre las puede interceptar el navegador de
 *  pruebas; a localhost no hace falta interceptarlas. Sin esa clave, nada
 *  cambia. */
export function baseCdnPruebas(): string | null {
  try {
    const b = globalThis.localStorage?.getItem("forja-cdn-pruebas") ?? "";
    return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(b) ? b.replace(/\/+$/, "") : null;
  } catch {
    return null;
  }
}

function cdnEsm(): string {
  const p = baseCdnPruebas();
  return p ? `${p}/esm` : CDN;
}
const REACT_POR_DEFECTO = "18.3.1";

/** Nombre del paquete y resto de la ruta: «@radix-ui/react-slot/x» → [«@radix-ui/react-slot», «/x»] */
export function partirEspecificador(spec: string): [string, string] {
  const partes = spec.split("/");
  const n = spec.startsWith("@") ? 2 : 1;
  return [partes.slice(0, n).join("/"), partes.length > n ? `/${partes.slice(n).join("/")}` : ""];
}

/** Módulos de Node que no existen en el navegador. */
const NODE_BUILTIN =
  /^(node:|fs$|fs\/|path$|os$|child_process$|crypto$|http$|https$|net$|tls$|stream$|zlib$|worker_threads$|cluster$|dgram$|dns$|readline$|vm$)/;

/**
 * La URL de CDN de un paquete. Todas las copias de React apuntan a la MISMA
 * versión (`?deps=`): si cada librería trajera la suya, React se rompería con
 * «Invalid hook call».
 */
export function urlDePaquete(spec: string, p: ProyectoModerno): string | null {
  if (!spec || NODE_BUILTIN.test(spec) || spec.startsWith("#")) return null;
  const [nombre, sub] = partirEspecificador(spec);
  if (!/^(@[\w.-]+\/)?[\w.-]+$/.test(nombre)) return null;
  const reactV = p.deps.react || REACT_POR_DEFECTO;
  const reactDomV = p.deps["react-dom"] || reactV;
  let version = p.deps[nombre] ?? "";
  if (!version && nombre === "react") version = reactV;
  if (!version && nombre === "react-dom") version = reactDomV;
  const conVersion = version ? `${nombre}@${version}` : nombre;
  const cdn = cdnEsm();
  if (nombre === "react") return `${cdn}/${conVersion}${sub}`;
  if (p.framework === "svelte" && nombre === "svelte") {
    // el runtime TIENE que ser de la misma versión que el compilador que
    // tradujo los .svelte, no la del package.json
    return `${cdn}/svelte@${versionSvelte()}${sub}`;
  }
  if (p.framework === "vue" && nombre === "vue") return `${cdn}/${conVersion}${sub}`;
  const fijar =
    p.framework === "vue"
      ? `?deps=vue@${p.deps.vue || "3"}`
      : p.framework === "svelte"
        ? `?deps=svelte@${versionSvelte()}`
        : p.framework === "preact"
      ? p.deps.preact
        ? `?deps=preact@${p.deps.preact}`
        : ""
      : p.framework === "react"
        ? nombre === "react-dom"
          ? `?deps=react@${reactV}`
          : `?deps=react@${reactV},react-dom@${reactDomV}`
        : "";
  return `${cdn}/${conVersion}${sub}${fijar}`;
}

/** React Router dentro de un iframe `srcdoc`: la dirección es «about:srcdoc»
 *  y ninguna ruta casa, así que la app sale en blanco. Se sirve el mismo
 *  paquete con los routers de navegador cambiados por los de memoria. */
function shimRouter(urlReal: string): string {
  const u = literalJs(urlReal);
  return [
    `export * from ${u};`,
    `import { MemoryRouter, createMemoryRouter } from ${u};`,
    "export { MemoryRouter as BrowserRouter, createMemoryRouter as createBrowserRouter };",
  ].join("\n");
}

const ROUTERS = new Set(["react-router-dom", "react-router"]);

function comoDataUrl(code: string): string {
  const bytes = new TextEncoder().encode(code);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:text/javascript;base64,${btoa(bin)}`;
}

/* ------------------------------------------------------------------ */
/* traducción TS/JSX → JS                                             */
/* ------------------------------------------------------------------ */

type Transform = (code: string, opts: Record<string, unknown>) => { code: string };
let traductor: Transform | null = null;

/** Carga Sucrase solo cuando hace falta (no pesa en la app si no se usa). */
export async function cargarTraductor(): Promise<Transform> {
  if (traductor) return traductor;
  const mod = (await import("sucrase")) as unknown as { transform: Transform };
  traductor = mod.transform;
  return traductor;
}

/** Solo para pruebas y para quien ya lo tenga cargado. */
export function fijarTraductor(t: Transform): void {
  traductor = t;
}

/* ——— Vue y Svelte: sus compiladores, solo si el proyecto los usa ——— */

type CompiladorVue = typeof import("@vue/compiler-sfc");
type CompiladorSvelte = Pick<typeof import("svelte/compiler"), "compile" | "VERSION">;
let compVue: CompiladorVue | null = null;
let compSvelte: CompiladorSvelte | null = null;

function versionSvelte(): string {
  return compSvelte?.VERSION ?? "5";
}

/** Todo lo que necesita ESTE proyecto para traducirse: Sucrase siempre, y el
 *  compilador de Vue o de Svelte si es de esos. */
export async function cargarCompiladores(p: ProyectoModerno): Promise<void> {
  await cargarTraductor();
  // la versión de NAVEGADOR a propósito: la de Node arrastra una docena de
  // motores de plantillas (pug, coffee-script…) que no existen aquí
  if (p.framework === "vue" && !compVue) {
    compVue = (await import("@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js")) as unknown as CompiladorVue;
  }
  if (p.framework === "svelte" && !compSvelte) compSvelte = await import("svelte/compiler");
}

/** Solo para pruebas. */
export function fijarCompiladores(c: { vue?: CompiladorVue; svelte?: CompiladorSvelte }): void {
  if (c.vue) compVue = c.vue;
  if (c.svelte) compSvelte = c.svelte;
}

/** Un id corto y estable por archivo (para los estilos «scoped»). */
function hashCorto(texto: string): string {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 8);
}

/** Un `.vue` → módulo ES: script (con `<script setup>` y TS), plantilla
 *  compilada y estilos inyectados (con su `scoped`). */
function compilarVue(path: string, fuente: string, ts: (code: string) => string): string {
  const c = compVue;
  if (!c) throw new Error("el compilador de Vue no está cargado");
  const { descriptor, errors } = c.parse(fuente, { filename: path });
  if (errors.length) throw new Error(String((errors[0] as { message?: string }).message ?? errors[0]));
  const id = hashCorto(path);
  const scoped = descriptor.styles.some((st) => st.scoped);
  const partes: string[] = [];
  const conScript = descriptor.script || descriptor.scriptSetup;
  if (conScript) {
    // genDefaultAs: «const __sfc__ = …» en vez de «export default …», sin
    // tener que volver a analizar el código (que puede llevar TS)
    const script = c.compileScript(descriptor, { id, inlineTemplate: true, isProd: true, genDefaultAs: "__sfc__" });
    partes.push(script.content);
  } else {
    partes.push("const __sfc__ = {};");
  }
  // plantilla aparte solo si no la metió ya `<script setup>` (inlineTemplate)
  if (descriptor.template && !descriptor.scriptSetup) {
    const t = c.compileTemplate({
      source: descriptor.template.content,
      filename: path,
      id,
      scoped,
      compilerOptions: scoped ? { scopeId: `data-v-${id}` } : {},
    });
    if (t.errors.length) throw new Error(String(t.errors[0]));
    partes.push(t.code.replace(/\bexport function render\b/, "function __render"));
    partes.push("__sfc__.render = __render;");
  }
  if (scoped) partes.push(`__sfc__.__scopeId = ${literalJs(`data-v-${id}`)};`);
  for (const st of descriptor.styles) {
    if (st.lang && st.lang !== "css") {
      partes.push(`console.warn(${literalJs(`${path}: estilos ${st.lang} no se compilan dentro del Sandbox; se aplican tal cual.`)});`);
    }
    const css = c.compileStyle({ source: st.content, filename: path, id: `data-v-${id}`, scoped: !!st.scoped });
    partes.push(inyectarCss(path, css.code, false));
  }
  partes.push("export default __sfc__;");
  const lang = descriptor.scriptSetup?.lang ?? descriptor.script?.lang;
  const code = partes.join("\n");
  return lang === "ts" || lang === "tsx" ? ts(code) : code;
}

/** Un `.svelte` → módulo ES (Svelte 5; los de Svelte 4 entran en modo
 *  compatibilidad). El CSS va dentro del propio componente. */
function compilarSvelte(path: string, fuente: string): string {
  const c = compSvelte;
  if (!c) throw new Error("el compilador de Svelte no está cargado");
  return c.compile(fuente, { filename: path, generate: "client", css: "injected", dev: false }).js.code;
}

/** Variables públicas de los .env: solo `VITE_*` y `REACT_APP_*`, como hacen
 *  Vite y CRA. Una clave de servidor no se cuela en la página. */
export function variablesPublicas(files: Map<string, Uint8Array>, raiz: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const nombre of [".env", ".env.development", ".env.local", ".env.development.local"]) {
    const texto = leer(files, unir(raiz, nombre));
    if (!texto) continue;
    for (const linea of texto.split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?((?:VITE_|REACT_APP_)[A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
      if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
  return out;
}

const ES_CONFIG_TAILWIND = /(^|\/)tailwind\.config\.(js|cjs|mjs|ts)$/;

/** Un archivo CommonJS (`module.exports = …`) como módulo ES. Solo para los
 *  de configuración, que son los que lo usan de verdad en un front moderno.
 *  Los `require` de plugins quedan en nada: el CDN no los carga. */
function commonJsAEsm(code: string): string {
  return [
    "const module = { exports: {} }; const exports = module.exports;",
    "const require = () => (() => ({}));",
    code,
    "export default module.exports;",
  ].join("\n");
}

export interface ContextoModerno {
  proyecto: ProyectoModerno;
  /** archivos a ejecutar (con el HTML de entrada y `public/` en la raíz) */
  files: Map<string, Uint8Array>;
  entryPath: string;
  /** lo que va en el <head> antes de cualquier módulo */
  cabecera: string;
  /** módulos que no importa nadie pero hay que cargar (la config de Tailwind) */
  raicesExtra: string[];
  /** opciones del grafo de módulos; `cssUrls` y `recurso` los pone el Sandbox */
  opciones: (ayudas: {
    cssUrls: (path: string, css: string) => string;
  }) => OpcionesGrafo;
}

/** Las rutas «/logo.png» del código que existen en `public/`: Vite las sirve
 *  en la raíz, pero dentro del iframe no hay raíz desde la que servirlas. */
function incrustarPublicos(code: string, publicos: Map<string, Uint8Array>): string {
  if (!publicos.size) return code;
  return code.replace(/(["'`])(\/[^"'`\s]+\.(?:png|jpe?g|gif|webp|avif|svg|ico|mp3|mp4|webm|woff2?))\1/gi, (m, q: string, ruta: string) => {
    const data = publicos.get(ruta);
    const mime = mimeFor(ruta);
    if (!data || !mime || data.length > 3 * 1024 * 1024) return m;
    return `${q}${toDataUrl(data, mime)}${q}`;
  });
}

/** `import.meta.env` de Vite → las variables públicas; `import.meta.hot` no existe aquí. */
function reemplazarEnv(code: string): string {
  return code.replace(/\bimport\.meta\.env\b/g, "globalThis.__FORJA_ENV__").replace(/\bimport\.meta\.hot\b/g, "undefined");
}

/** Directivas de Tailwind v4 que el CDN de navegador no entiende o ya trae. */
function cssParaTailwind(css: string, version: 3 | 4 | null): { css: string; tailwind: boolean } {
  const usa = /@tailwind\s|@apply\s|@import\s+["']tailwindcss|@theme\b|@layer\s+(base|components|utilities)/.test(css);
  if (!usa || !version) return { css, tailwind: false };
  if (version === 4) {
    css = css
      .replace(/@import\s+["']tailwindcss[^"']*["'][^;]*;/g, "")
      .replace(/@(plugin|config|source)\s+[^;]+;/g, "");
  }
  return { css, tailwind: true };
}

/**
 * Prepara un proyecto moderno para el Sandbox. Necesita el traductor cargado
 * (`cargarTraductor`). Devuelve `null` si no es moderno o no se puede ejecutar
 * aquí (el motivo está en `detectarProyectoModerno`).
 */
export function prepararModerno(files: Map<string, Uint8Array>, proyecto: ProyectoModerno): ContextoModerno | null {
  if (!proyecto.soportado || !traductor) return null;
  if (proyecto.framework === "vue" && !compVue) return null;
  if (proyecto.framework === "svelte" && !compSvelte) return null;
  const transform = traductor;
  const { raiz } = proyecto;
  const enRaiz = (p: string) => unir(raiz, p);

  // public/ se sirve en la raíz, como en Vite
  const salida = new Map(files);
  const publicos = new Map<string, Uint8Array>();
  const prefijoPublic = `${enRaiz("public")}/`;
  for (const [p, d] of files) {
    if (!p.startsWith(prefijoPublic)) continue;
    const rel = p.slice(prefijoPublic.length);
    publicos.set(`/${rel}`, d);
    if (!salida.has(enRaiz(rel))) salida.set(enRaiz(rel), d);
  }

  // HTML de entrada: el de Vite en la raíz; el de CRA en public/ (sin script);
  // o uno inventado si el ZIP solo trae el código.
  const candidatosMain = ["src/main.tsx", "src/main.jsx", "src/main.ts", "src/main.js", "src/index.tsx", "src/index.jsx", "src/index.ts", "src/index.js"].map(enRaiz);
  const main = candidatosMain.find((p) => files.has(p));
  const entryPath = enRaiz("index.html");
  let html = leer(files, entryPath);
  if (!html) {
    const cra = leer(files, enRaiz("public/index.html"));
    html = cra ?? '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Proyecto</title>\n</head>\n<body>\n<div id="root"></div>\n<div id="app"></div>\n</body>\n</html>';
    html = html.replace(/%PUBLIC_URL%/g, "");
    if (main && !/<script\b[^>]*type\s*=\s*["']module["']/i.test(html)) {
      const script = `<script type="module" src="/${main.slice(raiz ? raiz.length + 1 : 0)}"></script>`;
      html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${script}\n</body>`) : `${html}\n${script}`;
    }
    salida.set(entryPath, new TextEncoder().encode(html));
  }

  const env = variablesPublicas(files, raiz);
  const envVite = { MODE: "development", DEV: true, PROD: false, SSR: false, BASE_URL: "/", ...env };
  const envNode = { NODE_ENV: "development", ...env };

  // configuración de Tailwind v3, si la hay
  const configTw =
    proyecto.tailwind === 3
      ? ["tailwind.config.ts", "tailwind.config.js", "tailwind.config.mjs", "tailwind.config.cjs"].map(enRaiz).find((p) => files.has(p))
      : undefined;

  const cabecera = [
    `<script>window.__FORJA_ENV__=${literalJs(envVite)};window.process=window.process||{env:${literalJs(envNode)}};window.global=window.global||window;</script>`,
    proyecto.tailwind === 3 ? `<script src="${baseCdnPruebas() ? `${baseCdnPruebas()}/tailwind3.js` : "https://cdn.tailwindcss.com/3.4.17"}"></script>` : "",
    proyecto.tailwind === 4
      ? `<script src="${baseCdnPruebas() ? `${baseCdnPruebas()}/tailwind4.js` : "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"}"></script>`
      : "",
    configTw
      ? `<script type="module">import c from ${literalJs(`forja:${configTw}`)};try{window.tailwind.config=Object.assign({},c,{plugins:[]});}catch(e){console.warn("tailwind.config no se pudo aplicar:",e&&e.message)}</script>`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const soloTs = (code: string, path: string) =>
    transform(code, { transforms: ["typescript"], production: true, filePath: path, disableESTransforms: true }).code;

  const transformar = (path: string, code: string): string => {
    const e = extOf(path);
    if (e === "vue") return incrustarPublicos(reemplazarEnv(compilarVue(path, code, (c) => soloTs(c, path))), publicos);
    if (e === "svelte") return incrustarPublicos(reemplazarEnv(compilarSvelte(path, code)), publicos);
    let out = code;
    if (ES_CONFIG_TAILWIND.test(path)) {
      // sin plugins: el CDN no los carga, y sus import rompería el módulo
      out = out.replace(/^\s*import\s+[\w{}\s,*]+\s+from\s+["'][^"'.][^"']*["'];?\s*$/gm, "");
      out = out.replace(/require\(\s*["'][^"']+["']\s*\)/g, "(() => ({}))");
    }
    // Los .js de un proyecto de React (CRA los usa) pueden llevar JSX: pasar
    // el transform de JSX por un JS normal no cambia nada.
    const conJsx = proyecto.framework === "react" || proyecto.framework === "preact";
    const transforms =
      e === "ts" || e === "mts"
        ? ["typescript"]
        : e === "tsx"
          ? ["typescript", "jsx"]
          : e === "jsx" || (conJsx && (e === "js" || e === "mjs") && !ES_CONFIG_TAILWIND.test(path))
            ? ["jsx"]
            : [];
    if (transforms.length) {
      out = transform(out, {
        transforms,
        jsxRuntime: "automatic",
        jsxImportSource: proyecto.jsxImportSource,
        production: true,
        filePath: path,
        disableESTransforms: true,
      }).code;
    }
    if (ES_CONFIG_TAILWIND.test(path) && /\bmodule\.exports\b/.test(out) && !/\bexport\s+default\b/.test(out)) {
      out = commonJsAEsm(out);
    }
    return incrustarPublicos(reemplazarEnv(out), publicos);
  };

  const alias = (spec: string): string | null => {
    for (const [prefijo, carpeta] of Object.entries(proyecto.alias).sort((a, b) => b[0].length - a[0].length)) {
      if (spec.startsWith(prefijo)) return enRaiz(`${carpeta}${spec.slice(prefijo.length)}`.replace(/^\/+/, ""));
    }
    return null;
  };

  const externo = (spec: string): string | null => {
    const url = urlDePaquete(spec, proyecto);
    if (!url) return null;
    const [nombre] = partirEspecificador(spec);
    return ROUTERS.has(nombre) && spec === nombre ? comoDataUrl(shimRouter(url)) : url;
  };

  return {
    proyecto,
    files: salida,
    entryPath,
    cabecera,
    raicesExtra: configTw ? [configTw] : [],
    opciones: ({ cssUrls }) => ({
      raiz,
      transformar,
      alias,
      externo,
      sintetico: (path, spec, data) => moduloSintetico(path, spec, data, proyecto, cssUrls),
    }),
  };
}

/** Lo que no es JS pero se importa desde JS, convertido en módulo. */
export function moduloSintetico(
  path: string,
  spec: string,
  data: Uint8Array,
  proyecto: ProyectoModerno,
  cssUrls: (path: string, css: string) => string = (_p, c) => c
): string | null {
  const consulta = spec.split("?")[1] ?? "";
  const e = extOf(path);
  const texto = () => dec.decode(data);
  if (/(^|&)raw\b/.test(consulta)) return `export default ${literalJs(texto())};`;
  if (e === "json") {
    try {
      return `export default ${literalJs(JSON.parse(texto()))};`;
    } catch {
      return `throw new SyntaxError(${literalJs(`${path} no es un JSON válido`)});`;
    }
  }
  if (e === "css" || e === "scss" || e === "sass" || e === "less") {
    if (e !== "css") {
      // Sass/Less necesitan su compilador: se inyecta tal cual y se avisa en consola
      return `console.warn(${literalJs(`${path}: Sass/Less no se compila dentro del Sandbox; se aplica tal cual.`)});\n${inyectarCss(path, texto(), false)}`;
    }
    const { css, tailwind } = cssParaTailwind(cssUrls(path, texto()), proyecto.tailwind);
    const modulos = /\.module\.css$/i.test(path);
    return (
      inyectarCss(path, css, tailwind) +
      (modulos
        ? // CSS Modules: los nombres de clase se quedan tal cual (sin hash)
          "\nexport default new Proxy({}, { get: (_, k) => (typeof k === 'string' ? k : undefined) });"
        : `\nexport default ${literalJs(css)};`)
    );
  }
  const mime = mimeFor(path);
  if (mime) {
    const url = toDataUrl(data, mime);
    if (e === "svg" && /(^|&)react\b/.test(consulta)) {
      // vite-plugin-svgr: el SVG como componente
      return [
        `import { createElement } from ${literalJs(proyecto.jsxImportSource === "preact" ? "preact" : "react")};`,
        `export default function Svg(props) { return createElement("img", Object.assign({ src: ${literalJs(url)}, alt: "" }, props)); }`,
      ].join("\n");
    }
    // «import logo from './logo.png'» (y «?url»): la URL del recurso
    return `export default ${literalJs(url)};`;
  }
  return null;
}

function inyectarCss(path: string, css: string, tailwind: boolean): string {
  return [
    "const s = document.createElement('style');",
    tailwind ? "s.type = 'text/tailwindcss';" : "",
    `s.dataset.forjaFrom = ${literalJs(path)};`,
    `s.textContent = ${literalJs(css)};`,
    "document.head.appendChild(s);",
  ]
    .filter(Boolean)
    .join("\n");
}

/** ¿Es un servidor de Node (Express, Fastify…) sin parte web? Dentro del
 *  navegador no hay puertos ni `fs`: se dice en vez de enseñar nada. */
export function servidorNode(files: Map<string, Uint8Array>): string | null {
  const pkg = [...files.keys()]
    .filter((p) => p.split("/").pop() === "package.json")
    .sort((a, b) => a.split("/").length - b.split("/").length)[0];
  if (!pkg) return null;
  const j = jsonTolerante(leer(files, pkg) ?? "") as { dependencies?: Record<string, string> } | null;
  const deps = Object.keys(j?.dependencies ?? {});
  const srv = ["express", "fastify", "koa", "@hapi/hapi", "@nestjs/core", "hono", "socket.io"].find((d) => deps.includes(d));
  return srv
    ? `Es un servidor de Node (${srv}): necesita un proceso escuchando en un puerto, y eso no existe dentro del navegador. Pruébalo en tu ordenador con «npm install» y «npm start», o despliégalo (Render, Railway, Fly.io).`
    : null;
}
