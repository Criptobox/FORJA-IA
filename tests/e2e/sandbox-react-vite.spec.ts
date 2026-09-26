import { expect, test, type Page } from "./fixtures";
import { writeZip } from "../../src/lib/forja/zip";

/** Forja IA — Un proyecto Vite + React + TypeScript se ejecuta DENTRO del Sandbox.
 *
 * Lo que generan casi todas las IAs. Antes: «Este proyecto importa paquetes de
 * npm… el Sandbox no instala dependencias», y nada que ver.
 *
 * Los paquetes vienen de esm.sh. Aquí esm.sh se simula con una mini-React de
 * juguete (la red de las pruebas no sale a internet): lo que se prueba es la
 * tubería de Forja —traducir TSX, resolver `@/`, CSS Modules, JSON, imágenes,
 * variables de entorno, el cambio de BrowserRouter y el import map— en un
 * navegador de verdad. Que esm.sh sirve React de verdad no hace falta probarlo.
 */

const texto = (s: string) => new TextEncoder().encode(s);

function zipViteReact(): Buffer {
  return Buffer.from(
    writeZip([
      {
        path: "mi-app/package.json",
        data: texto(
          JSON.stringify({
            dependencies: { react: "^18.3.1", "react-dom": "^18.3.1", "lucide-react": "^0.460.0", "react-router-dom": "^6.28.0" },
            devDependencies: { vite: "^5.4.0", typescript: "^5.6.0" },
          })
        ),
      },
      { path: "mi-app/tsconfig.json", data: texto('{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }') },
      {
        path: "mi-app/index.html",
        data: texto('<!doctype html><html><head><meta charset="utf-8"><title>App</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>'),
      },
      {
        path: "mi-app/src/main.tsx",
        data: texto(
          'import { createRoot } from "react-dom/client";\nimport App from "./App";\nimport "./index.css";\ncreateRoot(document.getElementById("root")!).render(<App />);\nconsole.log("arrancó la app de React");'
        ),
      },
      {
        path: "mi-app/src/App.tsx",
        data: texto(
          [
            'import { useState } from "react";',
            'import { Coffee } from "lucide-react";',
            'import { BrowserRouter } from "react-router-dom";',
            'import { Boton } from "@/components/Boton";',
            'import estilos from "./App.module.css";',
            'import datos from "./datos.json";',
            'import logo from "./logo.svg";',
            "type Props = { titulo?: string };",
            'export default function App({ titulo = "Hola" }: Props) {',
            "  const [n, setN] = useState<number>(0);",
            "  return (",
            "    <BrowserRouter>",
            '      <main className={estilos.caja}>',
            '        <img id="logo" src={logo} alt="" />',
            "        <Coffee />",
            '        <h1 id="titulo">{titulo} {datos.nombre}</h1>',
            '        <p id="env">{import.meta.env.VITE_CIUDAD}</p>',
            '        <Boton onClick={() => setN(n + 1)} texto={`Pedidos: ${n}`} />',
            "      </main>",
            "    </BrowserRouter>",
            "  );",
            "}",
          ].join("\n")
        ),
      },
      {
        path: "mi-app/src/components/Boton.tsx",
        data: texto('export function Boton({ onClick, texto }: { onClick: () => void; texto: string }) {\n  return <button id="boton" onClick={onClick}>{texto}</button>;\n}'),
      },
      { path: "mi-app/src/App.module.css", data: texto(".caja { padding: 24px; }") },
      { path: "mi-app/src/index.css", data: texto("body { background: rgb(1, 2, 3); }") },
      { path: "mi-app/src/datos.json", data: texto('{ "nombre": "Grano" }') },
      { path: "mi-app/src/logo.svg", data: texto('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>') },
      { path: "mi-app/.env", data: texto("VITE_CIUDAD=Madrid\nCLAVE_PRIVADA=no-sale") },
    ])
  );
}

/** Mini-React de juguete: lo justo para pintar y re-pintar con useState. */
const MINI_REACT = `
let raiz = null, render = null, estados = [], i = 0;
export const Fragment = Symbol("f");
export function createElement(type, props, ...children) {
  return { type, props: { ...(props || {}), children: children.length ? children : props && props.children } };
}
export function useState(v0) {
  const k = i++;
  if (!(k in estados)) estados[k] = v0;
  return [estados[k], (v) => { estados[k] = v; if (render) render(); }];
}
export function __montar(el, vnodo) { raiz = el; render = () => { i = 0; el.innerHTML = ""; pintar(vnodo, el); }; render(); }
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

const MODULOS: Record<string, string> = {
  "/react@18.3.1": MINI_REACT,
  "/react@18.3.1/jsx-runtime": `import { Fragment } from "https://esm.sh/react@18.3.1";
export { Fragment };
export const jsx = (type, props) => ({ type, props });
export const jsxs = jsx;`,
  "/react-dom@18.3.1/client": `import { __montar } from "https://esm.sh/react@18.3.1";
export function createRoot(el) { return { render: (v) => __montar(el, v) }; }`,
  "/lucide-react@0.460.0": `import { jsx } from "https://esm.sh/react@18.3.1/jsx-runtime";
export const Coffee = () => jsx("svg", { id: "icono", "data-icono": "coffee" });`,
  "/react-router-dom@6.28.0": `export const BrowserRouter = () => { throw new Error("BrowserRouter en about:srcdoc no casa ninguna ruta"); };
export const MemoryRouter = (p) => p.children;
export const createMemoryRouter = () => ({});
export const Link = (p) => p.children;`,
};

async function esmFalso(page: Page) {
  const pedidos: string[] = [];
  await page.route("https://esm.sh/**", async (route) => {
    const url = new URL(route.request().url());
    pedidos.push(url.pathname + url.search);
    const cuerpo = MODULOS[url.pathname];
    await route.fulfill({
      status: cuerpo ? 200 : 404,
      contentType: "application/javascript",
      headers: { "access-control-allow-origin": "*" },
      body: cuerpo ?? `throw new Error("sin módulo falso para ${url.pathname}")`,
    });
  });
  return pedidos;
}

test("un Vite + React + TS con alias, CSS Modules, JSON, SVG, .env y React Router se ve y funciona", async ({ page }) => {
  await page.addInitScript(() => {
    if (window.top !== window.self) return;
    try {
      localStorage.setItem(
        "forja-ai-v1",
        JSON.stringify({
          state: { sessions: [], activeSessionId: null, onboardingDone: true, favorites: [], radarSeenIds: [], version: 1 },
          version: 0,
        })
      );
    } catch {
      /* marco sin acceso */
    }
  });
  const pedidos = await esmFalso(page);

  await page.goto("/");
  await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Sandbox", exact: false }).first().click();
  await page
    .getByRole("dialog")
    .locator('input[type="file"]')
    .setInputFiles({ name: "mi-app.zip", mimeType: "application/zip", buffer: zipViteReact() });

  const marco = page.frameLocator('iframe[title="Vista previa del Sandbox"]');
  await expect(marco.locator("#titulo")).toHaveText("Hola Grano", { timeout: 30_000 });
  // .env: la variable pública sí, la privada no
  await expect(marco.locator("#env")).toHaveText("Madrid");
  // el icono de un paquete de npm, desde el CDN
  await expect(marco.locator("#icono")).toHaveAttribute("data-icono", "coffee");
  // CSS Module y CSS importado desde JS, aplicados
  await expect(marco.locator("main")).toHaveClass("caja");
  await expect(marco.locator("main")).toHaveCSS("padding-top", "24px");
  await expect(marco.locator("body")).toHaveCSS("background-color", "rgb(1, 2, 3)");
  // el SVG importado es una URL que se puede pintar
  await expect(marco.locator("#logo")).toHaveAttribute("src", /^data:image\/svg\+xml;base64,/);
  // y es interactiva: el estado de React funciona
  await marco.locator("#boton").click();
  await expect(marco.locator("#boton")).toHaveText("Pedidos: 1");

  // una sola copia de React para todos, con la versión del package.json
  expect(pedidos).toContain("/lucide-react@0.460.0?deps=react@18.3.1,react-dom@18.3.1");
  expect(pedidos.some((p) => p.startsWith("/react-dom@18.3.1/client"))).toBe(true);
});
