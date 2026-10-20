/** Forja IA — Módulos ES dentro del Sandbox.
 *
 * Un proyecto moderno reparte el código en archivos que se importan entre sí:
 *
 *     <script type="module" src="js/app.js"></script>
 *     // js/app.js
 *     import { saludo } from "./util.js";
 *
 * Dentro del iframe el documento es un `srcdoc` sin origen propio, así que las
 * rutas relativas no apuntan a ningún sitio y el navegador no puede resolver
 * «./util.js». La solución no necesita empaquetador:
 *
 *  1. Cada módulo del proyecto recibe un especificador propio, «forja:<ruta>».
 *  2. Dentro de cada módulo se reescriben los import/export relativos a ese
 *     especificador (recursivamente, sea cual sea la profundidad).
 *  3. Se emite un <script type="importmap"> que asocia cada «forja:<ruta>» con
 *     una URL data: que lleva el código ya reescrito.
 *
 * Como el mapa se declara entero de antemano, los ciclos de importación y las
 * importaciones dinámicas funcionan igual que en un servidor de verdad.
 *
 * Lo que NO se puede resolver son los especificadores «desnudos» (import React
 * from "react"): eso exigiría instalar dependencias, y el Sandbox no instala
 * nada. Se devuelven en `bare` para poder avisar en vez de fallar en silencio.
 */

import { decodeText, extOf, resolvePath } from "./sandbox";

/** Prefijo de los especificadores que se inventan para el import map. */
export const MODULE_SCHEME = "forja:";

export interface ModuleGraph {
  /** especificador «forja:<ruta>» → URL data: con el código reescrito, y los
   *  paquetes de npm que se sirven desde un CDN → su URL */
  imports: Record<string, string>;
  /** rutas que se importaron pero no están en el proyecto */
  missing: string[];
  /** especificadores desnudos (paquetes de npm) que no se pueden resolver */
  bare: string[];
  /** número de módulos incluidos en el mapa */
  count: number;
  /** archivos que no se pudieron traducir (TS/JSX con errores de sintaxis) */
  errores?: string[];
}

const MODULE_EXT = new Set(["js", "mjs"]);
/** Con un proyecto moderno (React, Vite…) también son módulos estos, una vez
 *  traducidos a JavaScript. */
const MODULE_EXT_MODERNO = new Set(["js", "mjs", "jsx", "ts", "tsx", "mts", "vue", "svelte"]);
const MAX_MODULES = 600;

/** Lo que cambia cuando el proyecto es moderno (`sandbox-moderno.ts`). Sin
 *  opciones, el grafo se comporta exactamente como siempre. */
export interface OpcionesGrafo {
  /** carpeta raíz del proyecto: «/src/x» se ancla ahí, no en la raíz del ZIP */
  raiz?: string;
  /** TS/JSX → JS. Si está, también son módulos .ts/.tsx/.jsx */
  transformar?: (path: string, code: string) => string;
  /** módulo inventado para lo que no es JS pero se importa (CSS, JSON,
   *  imágenes…). null = no se sabe convertir */
  sintetico?: (path: string, spec: string, data: Uint8Array) => string | null;
  /** alias del proyecto («@/x» → «src/x»): devuelve la ruta sin extensión */
  alias?: (spec: string) => string | null;
  /** paquete de npm → URL del CDN (null = no se puede servir) */
  externo?: (spec: string) => string | null;
}

/** ¿La ruta puede ser un módulo del proyecto? */
export function isModulePath(path: string, moderno = false): boolean {
  return (moderno ? MODULE_EXT_MODERNO : MODULE_EXT).has(extOf(path));
}

/** Un especificador es relativo si empieza por ./ ../ o / */
export function isRelativeSpecifier(spec: string): boolean {
  return spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/");
}

/**
 * Encuentra los especificadores de un módulo: import/export estáticos e
 * import() dinámico. Trabaja sobre el texto tal cual — es suficiente porque
 * solo se tocan las comillas del especificador, no la estructura del código.
 */
const STATIC_SPEC =
  /(\bimport\s+(?:[\w*{}\n\r\t, $]+\s+from\s+)?|(?:\bexport\s+(?:\*|\{[^}]*\})\s+from\s+))(["'])([^"']+)\2/g;
const DYNAMIC_SPEC = /(\bimport\s*\(\s*)(["'])([^"']+)\2(\s*\))/g;

/** Resuelve un especificador relativo contra el proyecto, probando las
 * terminaciones habituales que el navegador NO adivina pero la gente escribe. */
export function resolveModule(
  fromPath: string,
  spec: string,
  has: (p: string) => boolean,
  opts: OpcionesGrafo = {}
): string | null {
  const baseDir = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : "";
  const limpio = spec.split("#")[0].split("?")[0];
  let target = resolvePath(baseDir, limpio);
  // «/src/main.tsx» en un proyecto que vive dentro de una carpeta del ZIP
  if (limpio.startsWith("/") && opts.raiz && !has(target) && !target.startsWith(`${opts.raiz}/`)) {
    target = `${opts.raiz}/${target}`;
  }
  return candidatosDe(target, !!opts.transformar).find(has) ?? null;
}

/** Las terminaciones que el navegador NO adivina pero la gente escribe (y los
 *  empaquetadores sí resuelven). */
function candidatosDe(target: string, moderno: boolean): string[] {
  const base = [target, `${target}.js`, `${target}.mjs`, `${target}/index.js`];
  if (!moderno) return base;
  return [
    ...base,
    `${target}.tsx`,
    `${target}.ts`,
    `${target}.jsx`,
    `${target}.mts`,
    `${target}/index.tsx`,
    `${target}/index.ts`,
    `${target}/index.jsx`,
  ];
}

/** Un especificador con alias («@/components/x») resuelto a un archivo. */
function resolverAlias(spec: string, has: (p: string) => boolean, opts: OpcionesGrafo): string | null {
  const ruta = opts.alias?.(spec.split("#")[0].split("?")[0]);
  if (ruta == null) return null;
  return candidatosDe(ruta, true).find(has) ?? null;
}

/** Reescribe los especificadores relativos de un módulo a «forja:<ruta>».
 * `onMissing` recibe la ruta YA resuelta contra la raíz del proyecto, que es
 * la que hay que enseñar: «./nada.js» desde js/app.js se ve como «js/nada.js». */
export function rewriteSpecifiers(
  path: string,
  code: string,
  has: (p: string) => boolean,
  onMissing: (resolvedPath: string) => void,
  onBare: (spec: string) => void,
  opts: OpcionesGrafo = {},
  onExterno?: (spec: string, url: string) => void
): string {
  const baseDir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const swap = (spec: string): string | null => {
    if (!isRelativeSpecifier(spec)) {
      // http(s):// y data: los resuelve el navegador solo
      if (/^(https?:|data:|blob:)/i.test(spec)) return null;
      const conAlias = resolverAlias(spec, has, opts);
      if (conAlias) return MODULE_SCHEME + conAlias + consulta(spec);
      const url = opts.externo?.(spec);
      if (url) {
        // se queda tal cual: el import map lo lleva al CDN
        onExterno?.(spec, url);
        return null;
      }
      onBare(spec);
      return null;
    }
    const resolved = resolveModule(path, spec, has, opts);
    if (!resolved) {
      onMissing(resolvePath(baseDir, spec.split("#")[0].split("?")[0]));
      return null;
    }
    return MODULE_SCHEME + resolved + consulta(spec);
  };
  code = code.replace(STATIC_SPEC, (whole, head: string, q: string, spec: string) => {
    const next = swap(spec);
    return next ? `${head}${q}${next}${q}` : whole;
  });
  code = code.replace(DYNAMIC_SPEC, (whole, head: string, q: string, spec: string, tail: string) => {
    const next = swap(spec);
    return next ? `${head}${q}${next}${q}${tail}` : whole;
  });
  return code;
}

/** «?raw», «?url», «?react»: cambian QUÉ exporta un import de un recurso, así
 *  que forman parte del especificador (un mismo SVG puede entrar como URL y
 *  como componente). Los de JS no llevan nada. */
function consulta(spec: string): string {
  const q = spec.split("#")[0].split("?")[1];
  return q ? `?${q}` : "";
}

/** Codifica texto UTF-8 como URL data: apta para un módulo. */
export function toModuleDataUrl(code: string): string {
  const bytes = new TextEncoder().encode(code);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:text/javascript;base64,${btoa(bin)}`;
}

/** Sintaxis que delata un módulo ES (y no un script clásico). */
const ESM_SYNTAX =
  /(^|[\n;}])\s*(?:import\s*[({'"*]|import\s+[\w${]|export\s+(?:default|const|let|var|function|class|async|\*|\{))/;

export function looksLikeModule(code: string): boolean {
  return ESM_SYNTAX.test(code);
}

/** Especificadores que importa un módulo, en orden de aparición. */
export function specifiersOf(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(STATIC_SPEC)) out.push(m[3]);
  for (const m of code.matchAll(DYNAMIC_SPEC)) out.push(m[3]);
  return out;
}

/**
 * Construye el import map del proyecto recorriendo el grafo de verdad.
 *
 * Solo entran los archivos que participan como módulos: los que llevan sintaxis
 * ESM, los que arrancan desde un <script type="module" src> (`roots`) y todo lo
 * que estos importan, directa o indirectamente. Un proyecto clásico sin
 * módulos no genera mapa alguno y se sigue inlineando como siempre — así no se
 * duplica en base64 un JS de medio mega para nada.
 */
export function buildModuleGraph(
  files: Map<string, Uint8Array>,
  roots: string[] = [],
  opts: OpcionesGrafo = {}
): ModuleGraph {
  const has = (p: string) => files.has(p);
  const moderno = !!opts.transformar;
  const code = new Map<string, string>();
  for (const [p, d] of files) {
    if (!isModulePath(p, moderno)) continue;
    try {
      code.set(p, decodeText(d));
    } catch {
      /* binario disfrazado de .js */
    }
  }
  // Lo que no es JS pero se importa desde JS (CSS, JSON, imágenes): se le
  // inventa un módulo. Clave «ruta?consulta», como el especificador.
  const sinteticos = new Map<string, string>();
  const errores: string[] = [];

  // semillas: las que pide el HTML y las que ya se ven como módulo
  const included = new Set<string>();
  const queue: string[] = [];
  const add = (p: string) => {
    if (!code.has(p) || included.has(p) || included.size >= MAX_MODULES) return;
    included.add(p);
    queue.push(p);
  };
  // En un proyecto moderno se traduce ANTES de buscar imports: los de tipos
  // («import type») desaparecen y no se piden módulos que no existen.
  const traducido = new Map<string, string>();
  const fuente = (p: string): string => {
    const hecho = traducido.get(p);
    if (hecho != null) return hecho;
    const crudo = code.get(p) as string;
    let out = crudo;
    if (opts.transformar) {
      try {
        out = opts.transformar(p, crudo);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errores.push(`${p}: ${msg}`);
        out = `throw new SyntaxError(${JSON.stringify(`${p}: ${msg}`)});`;
      }
    }
    traducido.set(p, out);
    return out;
  };

  for (const r of roots) add(r);
  if (!moderno) for (const [p, c] of code) if (looksLikeModule(c)) add(p);

  const destinoDe = (path: string, spec: string): string | null =>
    isRelativeSpecifier(spec) ? resolveModule(path, spec, has, opts) : resolverAlias(spec, has, opts);

  // cierre transitivo: lo que importan los ya incluidos entra también
  while (queue.length) {
    const path = queue.shift() as string;
    for (const spec of specifiersOf(fuente(path))) {
      const target = destinoDe(path, spec);
      if (!target) continue;
      if (code.has(target)) add(target);
      else if (opts.sintetico) {
        const clave = target + consulta(spec);
        if (!sinteticos.has(clave)) {
          const mod = opts.sintetico(target, spec, files.get(target) as Uint8Array);
          if (mod != null) sinteticos.set(clave, mod);
        }
      }
    }
  }

  const missing = new Set<string>();
  const bare = new Set<string>();
  const imports: Record<string, string> = {};
  const externos: Record<string, string> = {};
  for (const path of included) {
    const rewritten = rewriteSpecifiers(
      path,
      fuente(path),
      has,
      (target) => missing.add(target),
      (spec) => bare.add(spec),
      opts,
      (spec, url) => {
        externos[spec] = url;
      }
    );
    imports[MODULE_SCHEME + path] = toModuleDataUrl(rewritten);
  }
  for (const [clave, mod] of sinteticos) {
    // un módulo inventado también puede importar paquetes (un SVG como
    // componente de React importa «react»)
    const rewritten = rewriteSpecifiers(clave, mod, has, () => {}, (spec) => bare.add(spec), opts, (spec, url) => {
      externos[spec] = url;
    });
    imports[MODULE_SCHEME + clave] = toModuleDataUrl(rewritten);
  }
  Object.assign(imports, externos);

  return {
    imports,
    missing: [...missing],
    bare: [...bare],
    count: included.size + sinteticos.size,
    ...(errores.length ? { errores } : {}),
  };
}

/** Etiqueta <script type="importmap"> lista para insertar en el <head>. */
export function importMapTag(graph: ModuleGraph): string {
  if (!graph.count) return "";
  // «/» en el JSON cerraría la etiqueta si apareciera como «</script>»
  const json = JSON.stringify({ imports: graph.imports }).replace(/<\//g, "<\\/");
  return `<script type="importmap">${json}</script>`;
}
