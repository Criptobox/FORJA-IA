import { describe, expect, it } from "vitest";
import { transform } from "sucrase";
import { buildRunHtml } from "../../src/lib/forja/sandbox";
import {
  detectarProyectoModerno,
  fijarTraductor,
  moduloSintetico,
  prepararModerno,
  urlDePaquete,
  variablesPublicas,
  versionLimpia,
  type ProyectoModerno,
} from "../../src/lib/forja/sandbox-moderno";

/** Forja IA — Proyectos modernos (Vite + React + TS + Tailwind) en el Sandbox.
 *
 * Lo que traen casi todas las IAs. Antes el Sandbox respondía «este proyecto
 * importa paquetes de npm; el Sandbox no instala dependencias» y no se veía
 * nada. */

const enc = new TextEncoder();
const proyecto = (archivos: Record<string, string>) =>
  new Map(Object.entries(archivos).map(([p, t]) => [p, enc.encode(t)]));

/** Lo que genera `npm create vite` + shadcn, en pequeño. */
const VITE_REACT = {
  "mi-app/package.json": JSON.stringify({
    name: "mi-app",
    dependencies: { react: "^18.3.1", "react-dom": "^18.3.1", "lucide-react": "^0.460.0", "react-router-dom": "^6.28.0" },
    devDependencies: { vite: "^5.4.0", typescript: "^5.6.0", tailwindcss: "^3.4.14" },
  }),
  "mi-app/tsconfig.json": `{
    // comentarios y comas finales, como los de verdad
    "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"], }, },
  }`,
  "mi-app/index.html":
    '<!doctype html><html><head><meta charset="utf-8"><title>App</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
  "mi-app/src/main.tsx": [
    'import { StrictMode } from "react";',
    'import { createRoot } from "react-dom/client";',
    'import App from "./App";',
    'import "./index.css";',
    'createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);',
  ].join("\n"),
  "mi-app/src/App.tsx": [
    'import type { FC } from "react";',
    'import { Coffee } from "lucide-react";',
    'import { Boton } from "@/components/Boton";',
    'import estilos from "./App.module.css";',
    'import datos from "./datos.json";',
    'import logo from "./assets/logo.svg";',
    'import { BrowserRouter } from "react-router-dom";',
    "interface Props { titulo?: string }",
    'const App: FC<Props> = ({ titulo = "Hola" }) => (',
    "  <BrowserRouter><main className={estilos.caja}><img src={logo} /><Coffee /><h1>{titulo} {datos.nombre}</h1><Boton /><p>{import.meta.env.VITE_API}</p></main></BrowserRouter>",
    ");",
    "export default App;",
  ].join("\n"),
  "mi-app/src/components/Boton.tsx": 'export function Boton() { return <button className="bg-primary px-4">Pedir</button>; }',
  "mi-app/src/App.module.css": ".caja { padding: 2rem; }",
  "mi-app/src/index.css": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n.x { @apply p-4; }",
  "mi-app/src/datos.json": '{ "nombre": "Grano" }',
  "mi-app/src/assets/logo.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
  "mi-app/public/favicon.png": "\x89PNG",
  "mi-app/tailwind.config.js":
    'import animate from "tailwindcss-animate";\nexport default { content: ["./index.html"], theme: { extend: { colors: { primary: "#f60" } } }, plugins: [animate] };',
  "mi-app/.env": "VITE_API=https://api.ejemplo.com\nSECRETO_SERVIDOR=no-debe-salir",
};

// al cargar el archivo, no en beforeAll: los describe de abajo preparan el
// proyecto al recogerse, antes de que corra ningún hook
fijarTraductor(transform as unknown as Parameters<typeof fijarTraductor>[0]);

describe("detectarProyectoModerno", () => {
  it("reconoce Vite + React + TS + Tailwind 3, con su raíz y sus alias", () => {
    const p = detectarProyectoModerno(proyecto(VITE_REACT)) as ProyectoModerno;
    expect(p.framework).toBe("react");
    expect(p.raiz).toBe("mi-app");
    expect(p.tailwind).toBe(3);
    expect(p.alias["@/"]).toBe("src/");
    expect(p.deps.react).toBe("18.3.1");
    expect(p.soportado).toBe(true);
  });

  it("una web de HTML/CSS/JS de siempre NO es moderna: se ejecuta como hasta ahora", () => {
    expect(detectarProyectoModerno(proyecto({ "index.html": "<h1>x</h1>", "app.js": "console.log(1)" }))).toBeNull();
  });

  it("Next.js se reconoce y se dice por qué no se ejecuta aquí", () => {
    const p = detectarProyectoModerno(
      proyecto({ "package.json": JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0" } }), "app/page.tsx": "export default () => null" })
    );
    expect(p?.soportado).toBe(false);
    expect(p?.motivo).toMatch(/servidor/);
  });

  it("Tailwind 4 se reconoce por @import \"tailwindcss\" aunque no haya config", () => {
    const p = detectarProyectoModerno(
      proyecto({ "package.json": JSON.stringify({ dependencies: { react: "19.0.0" } }), "src/index.css": '@import "tailwindcss";', "src/main.tsx": "" })
    );
    expect(p?.tailwind).toBe(4);
  });
});

describe("paquetes de npm desde el CDN", () => {
  const p = detectarProyectoModerno(proyecto(VITE_REACT)) as ProyectoModerno;

  it("con la versión del package.json y React fijado a una sola copia", () => {
    expect(urlDePaquete("react", p)).toBe("https://esm.sh/react@18.3.1");
    expect(urlDePaquete("react/jsx-runtime", p)).toBe("https://esm.sh/react@18.3.1/jsx-runtime");
    expect(urlDePaquete("react-dom/client", p)).toBe("https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1");
    expect(urlDePaquete("lucide-react", p)).toBe("https://esm.sh/lucide-react@0.460.0?deps=react@18.3.1,react-dom@18.3.1");
    expect(urlDePaquete("@radix-ui/react-slot", p)).toBe("https://esm.sh/@radix-ui/react-slot?deps=react@18.3.1,react-dom@18.3.1");
  });

  it("los módulos de Node no se piden al CDN", () => {
    expect(urlDePaquete("fs", p)).toBeNull();
    expect(urlDePaquete("node:path", p)).toBeNull();
  });

  it("versionLimpia quita rangos y descarta lo que no es una versión", () => {
    expect(versionLimpia("^18.3.1")).toBe("18.3.1");
    expect(versionLimpia("~5.4")).toBe("5.4");
    expect(versionLimpia("latest")).toBe("");
    expect(versionLimpia("workspace:*")).toBe("");
  });
});

describe("variablesPublicas", () => {
  it("solo VITE_* y REACT_APP_*: una clave de servidor no llega a la página", () => {
    const v = variablesPublicas(proyecto(VITE_REACT), "mi-app");
    expect(v).toEqual({ VITE_API: "https://api.ejemplo.com" });
  });
});

describe("el proyecto entero, listo para el iframe", () => {
  const files = proyecto(VITE_REACT);
  const p = detectarProyectoModerno(files) as ProyectoModerno;
  const ctx = prepararModerno(files, p)!;
  const r = buildRunHtml("mi-app/index.html", files, ctx);
  const mapa = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(r.html)![1].replace(/<\\\//g, "</")).imports as Record<string, string>;
  const codigo = (clave: string) => {
    const url = mapa[clave];
    expect(url, clave).toBeTruthy();
    return Buffer.from(url.split(",")[1], "base64").toString("utf8");
  };

  it("no quedan paquetes sin resolver ni archivos que falten", () => {
    expect(r.bareImports).toEqual([]);
    expect(r.missing).toEqual([]);
    expect(r.erroresTraduccion).toEqual([]);
  });

  it("el <script src=/src/main.tsx> arranca el módulo traducido", () => {
    expect(r.html).toContain('import "forja:mi-app/src/main.tsx"');
    const main = codigo("forja:mi-app/src/main.tsx");
    expect(main).not.toMatch(/<StrictMode>|!\)/);
    expect(main).toContain("react/jsx-runtime");
    expect(main).toContain('"forja:mi-app/src/App.tsx"');
  });

  it("los tipos desaparecen y el alias @/ lleva a src/", () => {
    const app = codigo("forja:mi-app/src/App.tsx");
    expect(app).not.toMatch(/interface Props|: FC</);
    expect(app).toContain('"forja:mi-app/src/components/Boton.tsx"');
  });

  it("import.meta.env sale de las variables públicas", () => {
    expect(codigo("forja:mi-app/src/App.tsx")).toContain("globalThis.__FORJA_ENV__");
    expect(r.html).toContain('"VITE_API":"https://api.ejemplo.com"');
    expect(r.html).not.toContain("no-debe-salir");
  });

  it("CSS, CSS Modules, JSON e imágenes importados son módulos", () => {
    expect(codigo("forja:mi-app/src/index.css")).toContain("text/tailwindcss");
    expect(codigo("forja:mi-app/src/App.module.css")).toContain("new Proxy");
    expect(codigo("forja:mi-app/src/datos.json")).toContain('"nombre":"Grano"');
    expect(codigo("forja:mi-app/src/assets/logo.svg")).toContain("data:image/svg+xml;base64");
  });

  it("los paquetes van al CDN y React Router se cambia a memoria", () => {
    expect(mapa["react"]).toBe("https://esm.sh/react@18.3.1");
    expect(mapa["react-dom/client"]).toContain("esm.sh/react-dom@18.3.1/client");
    expect(mapa["lucide-react"]).toContain("esm.sh/lucide-react@0.460.0");
    const router = Buffer.from(mapa["react-router-dom"].split(",")[1], "base64").toString("utf8");
    expect(router).toContain("MemoryRouter as BrowserRouter");
    expect(router).toContain("esm.sh/react-router-dom@6.28.0");
  });

  it("Tailwind 3 con TU configuración (sin plugins, que el CDN no carga)", () => {
    expect(r.html).toContain("cdn.tailwindcss.com");
    expect(r.html).toContain('forja:mi-app/tailwind.config.js');
    const cfg = codigo("forja:mi-app/tailwind.config.js");
    expect(cfg).not.toContain("tailwindcss-animate");
    expect(cfg).toContain("primary");
  });

  it("el import map va antes que la configuración de Tailwind (que ya lo usa)", () => {
    expect(r.html.indexOf("importmap")).toBeLessThan(r.html.indexOf("tailwind.config.js"));
  });
});

describe("otros formatos que llegan", () => {
  it("CRA: public/index.html sin script → se le añade la entrada, y los .js llevan JSX", () => {
    const files = proyecto({
      "package.json": JSON.stringify({ dependencies: { react: "18.2.0", "react-dom": "18.2.0", "react-scripts": "5.0.1" } }),
      "public/index.html": '<!doctype html><html><head><link rel="icon" href="%PUBLIC_URL%/favicon.ico"></head><body><div id="root"></div></body></html>',
      "src/index.js": 'import ReactDOM from "react-dom/client";\nimport App from "./App";\nReactDOM.createRoot(document.getElementById("root")).render(<App />);',
      "src/App.js": "export default function App() { return <h1>{process.env.REACT_APP_NOMBRE}</h1>; }",
      ".env": "REACT_APP_NOMBRE=Grano",
    });
    const p = detectarProyectoModerno(files) as ProyectoModerno;
    const ctx = prepararModerno(files, p)!;
    const r = buildRunHtml(ctx.entryPath, files, ctx);
    expect(r.html).toContain('import "forja:src/index.js"');
    expect(r.html).not.toContain("%PUBLIC_URL%");
    expect(r.html).toContain('"REACT_APP_NOMBRE":"Grano"');
    expect(r.erroresTraduccion).toEqual([]);
    expect(r.bareImports).toEqual([]);
  });

  it("un ZIP con solo src/ (sin HTML) se abre con un HTML inventado", () => {
    const files = proyecto({
      "src/main.jsx": 'import { createRoot } from "react-dom/client";\ncreateRoot(document.getElementById("root")).render(<p>hola</p>);',
    });
    const p = detectarProyectoModerno(files) as ProyectoModerno;
    const ctx = prepararModerno(files, p)!;
    const r = buildRunHtml(ctx.entryPath, files, ctx);
    expect(r.html).toContain('<div id="root"></div>');
    expect(r.html).toContain('import "forja:src/main.jsx"');
  });

  it("un error de sintaxis en un .tsx se dice con su archivo, no deja la página en blanco sin más", () => {
    const files = proyecto({
      "package.json": JSON.stringify({ dependencies: { react: "18.3.1" } }),
      "index.html": '<div id="root"></div><script type="module" src="/src/main.tsx"></script>',
      "src/main.tsx": "const x = <div>;",
    });
    const p = detectarProyectoModerno(files) as ProyectoModerno;
    const r = buildRunHtml("index.html", files, prepararModerno(files, p)!);
    expect(r.erroresTraduccion[0]).toMatch(/^src\/main\.tsx:/);
  });

  it("Tailwind 4: el @import \"tailwindcss\" se quita (el CDN ya lo trae) y el resto se procesa", () => {
    const p = { tailwind: 4, jsxImportSource: "react" } as ProyectoModerno;
    const mod = moduloSintetico("src/index.css", "./index.css", enc.encode('@import "tailwindcss";\n@theme { --color-marca: #f60; }'), p);
    expect(mod).not.toContain('@import \\"tailwindcss\\"');
    expect(mod).toContain("@theme");
    expect(mod).toContain("text/tailwindcss");
  });

  it("?raw da el texto y ?react da un componente", () => {
    const p = { tailwind: null, jsxImportSource: "react" } as ProyectoModerno;
    expect(moduloSintetico("a.txt", "./a.txt?raw", enc.encode("hola"), p)).toBe('export default "hola";');
    expect(moduloSintetico("i.svg", "./i.svg?react", enc.encode("<svg/>"), p)).toContain("createElement");
  });

  it("una web de las de siempre sigue exactamente igual (sin contexto moderno)", () => {
    const files = proyecto({ "index.html": '<script type="module" src="app.js"></script>', "app.js": 'import "./b.js";', "b.js": "console.log(1)" });
    const r = buildRunHtml("index.html", files);
    expect(r.html).toContain('import "forja:app.js"');
    expect(r.paquetes).toEqual([]);
  });
});
