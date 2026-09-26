import { readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CDN de mentira para las pruebas E2E del Sandbox (proyectos modernos y
 * Python). El Sandbox lo usa solo si `localStorage["forja-cdn-pruebas"]`
 * apunta aquí (ver `baseCdnPruebas` en sandbox-moderno.ts).
 *
 * Por qué existe: las peticiones del iframe aislado a un CDN externo no
 * siempre las puede interceptar el navegador de pruebas (el iframe puede ir
 * en otro proceso), y la red de las pruebas no sale a internet. A localhost
 * no hace falta interceptar nada.
 *
 *  - /esm/react@18.3.1 …      mini-React de juguete (pintar + useState)
 *  - /esm/vue@3.5.13          el runtime de Vue de verdad (node_modules)
 *  - /pyodide/pyodide.js      Pyodide de juguete (comprueba la tubería)
 *  - /tailwind3.js            marca que el CDN de Tailwind se cargó
 *
 * En producción no sirve nada. */

const MINI_REACT = `
let render = null, estados = [], i = 0;
export const Fragment = Symbol("f");
export function createElement(type, props, ...children) {
  return { type, props: { ...(props || {}), children: children.length ? children : props && props.children } };
}
export function useState(v0) {
  const k = i++;
  if (!(k in estados)) estados[k] = v0;
  return [estados[k], (v) => { estados[k] = v; if (render) render(); }];
}
export function __montar(el, vnodo) { render = () => { i = 0; el.innerHTML = ""; pintar(vnodo, el); }; render(); }
function pintar(v, padre) {
  if (v == null || v === false) return;
  if (Array.isArray(v)) return v.forEach((h) => pintar(h, padre));
  if (typeof v !== "object") return padre.appendChild(document.createTextNode(String(v)));
  if (typeof v.type === "function") return pintar(v.type(v.props), padre);
  if (v.type === Fragment) return pintar(v.props.children, padre);
  const el = document.createElement(v.type);
  for (const [k, val] of Object.entries(v.props)) {
    if (k === "children") continue;
    if (k === "className") el.className = val;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), val);
    else el.setAttribute(k, val);
  }
  pintar(v.props.children, el);
  padre.appendChild(el);
}
export default { createElement, useState, Fragment };
`;

function modulos(base: string): Record<string, string> {
  return {
    "esm/react@18.3.1": MINI_REACT,
    "esm/react@18.3.1/jsx-runtime": `import { Fragment } from "${base}/esm/react@18.3.1";
export { Fragment };
export const jsx = (type, props) => ({ type, props });
export const jsxs = jsx;`,
    "esm/react-dom@18.3.1/client": `import { __montar } from "${base}/esm/react@18.3.1";
export function createRoot(el) { return { render: (v) => __montar(el, v) }; }`,
    "esm/lucide-react@0.460.0": `import { jsx } from "${base}/esm/react@18.3.1/jsx-runtime";
export const Coffee = () => jsx("svg", { id: "icono", "data-icono": "coffee" });`,
    "esm/react-router-dom@6.28.0": `export const BrowserRouter = () => { throw new Error("BrowserRouter en about:srcdoc no casa ninguna ruta"); };
export const MemoryRouter = (p) => p.children;
export const createMemoryRouter = () => ({});`,
    "tailwind3.js": "window.tailwind = { __falso: true };",
    "pyodide/pyodide.js": `
window.loadPyodide = async function (opts) {
  var fs = {}, cwd = "/";
  return {
    FS: { mkdirTree: function () {}, writeFile: function (p, t) { fs[p] = t; }, chdir: function (d) { cwd = d; } },
    runPython: function () { return ""; },
    setStdin: function () {},
    loadPackagesFromImports: async function () {},
    loadPackage: async function () {},
    runPythonAsync: async function (code) {
      opts.stdout("EJECUTADO " + code.split("\\n")[0]);
      opts.stdout("CWD " + cwd);
      opts.stdout("CSV " + (fs["/proyecto/datos.csv"] || "no está"));
    },
  };
};`,
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (process.env.NODE_ENV === "production") return new Response("no", { status: 404 });
  const { path } = await ctx.params;
  const ruta = path.join("/");
  const base = new URL(req.url).origin + "/api/mock-cdn";
  let cuerpo: string | undefined = modulos(base)[ruta];
  if (!cuerpo && ruta === "esm/vue@3.5.13") {
    try {
      cuerpo = readFileSync(join(process.cwd(), "node_modules/vue/dist/vue.runtime.esm-browser.prod.js"), "utf8");
    } catch {
      cuerpo = undefined;
    }
  }
  return new Response(cuerpo ?? `throw new Error(${JSON.stringify(`mock-cdn: sin módulo para ${ruta}`)});`, {
    status: cuerpo ? 200 : 404,
    headers: { "content-type": "application/javascript; charset=utf-8", "access-control-allow-origin": "*", "cache-control": "no-store" },
  });
}
