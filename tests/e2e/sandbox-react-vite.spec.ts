import { expect, test, type Page } from "./fixtures";
import { writeZip } from "../../src/lib/forja/zip";

/** Forja IA — Un proyecto Vite + React + TypeScript se ejecuta DENTRO del Sandbox.
 *
 * Lo que generan casi todas las IAs. Antes: «Este proyecto importa paquetes de
 * npm… el Sandbox no instala dependencias», y nada que ver.
 *
 * Los paquetes vienen de esm.sh. Aquí el CDN es el de mentira de la propia
 * app (`/api/mock-cdn`, activado con `localStorage["forja-cdn-pruebas"]`):
 * mini-React de juguete, el runtime de Vue de verdad y un Pyodide de juguete.
 * Lo que se prueba es la tubería de Forja —traducir TSX/Vue, resolver `@/`,
 * CSS Modules, JSON, imágenes, variables de entorno, el cambio de
 * BrowserRouter, el import map, Python— en un navegador de verdad.
 *
 * No se usa `page.route` hacia esm.sh: el iframe aislado puede ir en otro
 * proceso de Chromium y sus primeras peticiones a veces se escapaban de la
 * interceptación (fallos al azar). A localhost no hace falta interceptar.
 */

// El service worker de la app (public/sw.js) toma el control en el primer
// arranque, y una petición que pasa por él ya no la ve `page.route`: esm.sh
// saldría a la red de verdad (bloqueada en las pruebas) y la app se quedaría
// en blanco. Con la red de verdad no pasa nada: el SW deja pasar lo externo.
test.use({ serviceWorkers: "block" });

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

/** Semilla de la app + el CDN de mentira para el Sandbox. */
async function preparar(page: Page) {
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
      localStorage.setItem("forja-cdn-pruebas", `${location.origin}/api/mock-cdn`);
    } catch {
      /* marco sin acceso */
    }
  });
}

/** El import map que Forja metió en el iframe (qué paquetes pidió y de dónde). */
async function importMap(page: Page): Promise<Record<string, string>> {
  const src = (await page.locator('iframe[title="Vista previa del Sandbox"]').getAttribute("srcdoc")) ?? "";
  const m = /<script type="importmap">([\s\S]*?)<\/script>/.exec(src);
  return m ? (JSON.parse(m[1].replace(/<\\\//g, "</")).imports as Record<string, string>) : {};
}

async function abrirZip(page: Page, nombre: string, zip: Buffer) {
  await page.goto("/");
  await expect(page.getByPlaceholder("Escribe tu mensaje…")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Sandbox", exact: false }).first().click();
  await page.getByRole("dialog").locator('input[type="file"]').setInputFiles({ name: nombre, mimeType: "application/zip", buffer: zip });
}

test("un Vite + React + TS con alias, CSS Modules, JSON, SVG, .env y React Router se ve y funciona", async ({ page }) => {
  await preparar(page);
  await abrirZip(page, "mi-app.zip", zipViteReact());

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
  const mapa = await importMap(page);
  expect(mapa["lucide-react"]).toMatch(/\/esm\/lucide-react@0\.460\.0\?deps=react@18\.3\.1,react-dom@18\.3\.1$/);
  expect(mapa["react-dom/client"]).toMatch(/\/esm\/react-dom@18\.3\.1\/client/);
});

/* ------------------------------------------------------------------ */
/* Vue: con el runtime de Vue DE VERDAD sirviendo de esm.sh           */
/* ------------------------------------------------------------------ */

function zipVue(): Buffer {
  return Buffer.from(
    writeZip([
      { path: "tienda/package.json", data: texto(JSON.stringify({ dependencies: { vue: "^3.5.13" }, devDependencies: { vite: "^5.4.0" } })) },
      { path: "tienda/index.html", data: texto('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>') },
      { path: "tienda/src/main.ts", data: texto('import { createApp } from "vue";\nimport App from "./App.vue";\ncreateApp(App).mount("#app");') },
      {
        path: "tienda/src/App.vue",
        data: texto(
          [
            '<script setup lang="ts">',
            'import { ref } from "vue";',
            'import Producto from "./components/Producto.vue";',
            "const carrito = ref<number>(0);",
            "</script>",
            "<template>",
            '  <h1 id="titulo">Tienda Grano</h1>',
            '  <Producto nombre="Café de Huila" @anadir="carrito++" />',
            '  <p id="carrito" class="total">Carrito: {{ carrito }}</p>',
            "</template>",
            "<style scoped>.total { color: rgb(200, 0, 0); }</style>",
          ].join("\n")
        ),
      },
      {
        path: "tienda/src/components/Producto.vue",
        data: texto(
          '<script>export default { props: ["nombre"], emits: ["anadir"] };</script>\n<template><button id="anadir" @click="$emit(\'anadir\')">Añadir {{ nombre }}</button></template>'
        ),
      },
    ])
  );
}

test("un Vite + Vue (script setup, TS, scoped y componente hijo) se ve y funciona", async ({ page }) => {
  await preparar(page);
  await abrirZip(page, "tienda.zip", zipVue());

  const marco = page.frameLocator('iframe[title="Vista previa del Sandbox"]');
  await expect(marco.locator("#titulo")).toHaveText("Tienda Grano", { timeout: 30_000 });
  await expect(marco.locator("#anadir")).toHaveText("Añadir Café de Huila");
  // el estilo scoped llega solo a su componente
  await expect(marco.locator("#carrito")).toHaveCSS("color", "rgb(200, 0, 0)");
  // y es reactiva: el evento del hijo sube al padre
  await marco.locator("#anadir").click();
  await marco.locator("#anadir").click();
  await expect(marco.locator("#carrito")).toHaveText("Carrito: 2");
});

/* ------------------------------------------------------------------ */
/* Python: el script corre en el propio iframe (Pyodide)              */
/* ------------------------------------------------------------------ */

test("un ZIP con main.py se ejecuta con Python en el navegador y se ve su salida", async ({ page }) => {
  await preparar(page);
  const zip = Buffer.from(
    writeZip([
      { path: "calc/main.py", data: texto('import csv\nprint("hola")') },
      { path: "calc/datos.csv", data: texto("a,b") },
    ])
  );
  await abrirZip(page, "calc.zip", zip);

  // el Pyodide de juguete (/api/mock-cdn) cuenta qué recibió
  const marco = page.frameLocator('iframe[title="Vista previa del Sandbox"]');
  await expect(marco.locator("#salida")).toContainText("EJECUTADO import csv", { timeout: 30_000 });
  // se trabaja desde la carpeta del script y los datos están donde los espera
  await expect(marco.locator("#salida")).toContainText("CWD /proyecto");
  await expect(marco.locator("#salida")).toContainText("CSV a,b");
  await expect(marco.locator("#estado")).toHaveText("terminado ✓");
});
