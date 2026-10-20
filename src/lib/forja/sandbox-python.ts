/** Forja IA — Scripts de Python dentro del Sandbox (Pyodide).
 *
 * Un ZIP con un `main.py` no tenía nada que ejecutar: el Sandbox solo sabía de
 * páginas web. Pyodide es CPython compilado a WebAssembly: corre dentro del
 * propio iframe aislado, sin servidor, con la biblioteca estándar y los
 * paquetes científicos habituales (numpy, pandas, matplotlib…), que se cargan
 * solos según los `import` del código.
 *
 * Lo que sale por `print` se ve en la página y en la consola del Sandbox;
 * `input()` pregunta con una ventana del navegador. Lo que NO se puede es
 * levantar un servidor (Flask, Django, FastAPI): se dice claro.
 *
 * Funciones puras: se prueban sin navegador.
 */

import { baseCdnPruebas, literalJs } from "./sandbox-moderno";

export const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";

/** Pyodide de verdad, o el local de las pruebas (`baseCdnPruebas`). */
function urlPyodide(): string {
  const p = baseCdnPruebas();
  return p ? `${p}/pyodide/pyodide.js` : PYODIDE_URL;
}

export interface ProyectoPython {
  /** el .py que se ejecuta */
  entrada: string;
  /** todos los archivos de texto que el script puede abrir (ruta → contenido) */
  archivos: Record<string, string>;
  /** paquetes de requirements.txt (los puros de PyPI se instalan con micropip) */
  requisitos: string[];
  /** si es un servidor web, por qué no se ejecuta aquí */
  servidor?: string;
}

const dec = new TextDecoder();

/** Orden en que se busca el script principal. */
const ENTRADAS = ["main.py", "app.py", "__main__.py", "run.py", "script.py", "index.py"];

const TEXTO = /\.(py|txt|csv|json|md|toml|cfg|ini|ya?ml|tsv|xml|html?)$/i;

/** ¿Es un proyecto de Python (y no una web que trae un .py suelto)? */
export function detectarPython(files: Map<string, Uint8Array>): ProyectoPython | null {
  const paths = [...files.keys()];
  const pys = paths.filter((p) => p.endsWith(".py"));
  if (!pys.length) return null;
  // una web con su index.html manda: el .py será una utilidad suya
  if (paths.some((p) => /(^|\/)index\.html?$/i.test(p))) return null;
  const hondo = (p: string) => p.split("/").length;
  const entrada =
    ENTRADAS.map((n) => pys.filter((p) => p.split("/").pop() === n).sort((a, b) => hondo(a) - hondo(b))[0]).find(Boolean) ??
    // si no hay un nombre típico: el que tenga «if __name__ == "__main__"», o el menos hondo
    pys.find((p) => /if\s+__name__\s*==\s*["']__main__["']/.test(dec.decode(files.get(p) as Uint8Array))) ??
    [...pys].sort((a, b) => hondo(a) - hondo(b) || a.localeCompare(b))[0];

  const archivos: Record<string, string> = {};
  for (const [p, d] of files) {
    if (TEXTO.test(p) && d.length <= 2 * 1024 * 1024) archivos[p] = dec.decode(d);
  }
  const reqPath = paths.find((p) => p.split("/").pop() === "requirements.txt");
  const requisitos = reqPath
    ? (archivos[reqPath] ?? "")
        .split(/\r?\n/)
        .map((l) => l.replace(/#.*/, "").trim())
        .filter((l) => l && !l.startsWith("-"))
        .map((l) => l.split(/[<>=!~;[ ]/)[0])
        .filter(Boolean)
    : [];

  const codigo = pys.map((p) => archivos[p] ?? "").join("\n");
  const servidor =
    /\bfrom\s+flask\s+import|\bimport\s+flask\b|\bFlask\(/.test(codigo)
      ? "Flask"
      : /\bdjango\b/.test(codigo)
        ? "Django"
        : /\bfastapi\b|\buvicorn\b/i.test(codigo)
          ? "FastAPI"
          : undefined;
  return {
    entrada,
    archivos,
    requisitos,
    ...(servidor
      ? {
          servidor: `Es un servidor web de ${servidor}: necesita un proceso escuchando en un puerto, y eso no existe dentro del navegador. Sus scripts sueltos sí se pueden probar.`,
        }
      : {}),
  };
}

/** La página que ejecuta el script dentro del iframe. */
export function htmlPython(p: ProyectoPython): string {
  const datos = literalJs({ entrada: p.entrada, archivos: p.archivos, requisitos: p.requisitos, servidor: p.servidor ?? null });
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${p.entrada}</title>
<style>
  body { margin: 0; font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; background: #0b0e17; color: #e6e9f2; }
  header { padding: 10px 14px; border-bottom: 1px solid #ffffff14; color: #9aa3b8; font-size: 12px; display: flex; gap: 8px; align-items: center; }
  header b { color: #e6e9f2; }
  #estado { margin-left: auto; }
  pre { margin: 0; padding: 14px; white-space: pre-wrap; word-break: break-word; }
  .err { color: #ff8a8a; }
  .aviso { color: #ffd479; }
  img { max-width: 100%; background: #fff; display: block; margin: 8px 0; }
</style>
</head>
<body>
<header>🐍 <b id="nombre"></b><span id="estado">Cargando Python…</span></header>
<pre id="salida"></pre>
<script type="application/json" id="forja-python">${datos}</script>
<script>
/* Pyodide se carga desde aquí, no con un <script src> en el HTML: así se sabe
   si falló (sin conexión) y se dice, en vez de quedarse esperando. */
function cargarPyodide() {
  return new Promise(function (ok) {
    var s = document.createElement("script");
    s.src = ${literalJs(urlPyodide())};
    s.onload = function () { ok(true); };
    s.onerror = function () { ok(false); };
    document.head.appendChild(s);
  });
}
(async function () {
  var d = JSON.parse(document.getElementById("forja-python").textContent);
  var salida = document.getElementById("salida");
  var estado = document.getElementById("estado");
  document.getElementById("nombre").textContent = d.entrada;
  function escribir(texto, clase) {
    var s = document.createElement("span");
    if (clase) s.className = clase;
    s.textContent = texto + "\\n";
    salida.appendChild(s);
  }
  if (d.servidor) escribir("⚠ " + d.servidor, "aviso");
  if (!(await cargarPyodide()) || typeof loadPyodide !== "function") {
    estado.textContent = "sin conexión";
    escribir("No se pudo descargar Python (Pyodide). Hace falta conexión a internet la primera vez.", "err");
    console.error("Pyodide no se pudo cargar");
    return;
  }
  try {
    var py = await loadPyodide({
      stdout: function (t) { escribir(t); console.log(t); },
      stderr: function (t) { escribir(t, "err"); console.error(t); },
    });
    // los archivos del proyecto, donde el script espera encontrarlos
    var base = d.entrada.indexOf("/") >= 0 ? d.entrada.slice(0, d.entrada.lastIndexOf("/")) : "";
    for (var ruta in d.archivos) {
      var destino = "/proyecto/" + ruta;
      var dir = destino.slice(0, destino.lastIndexOf("/"));
      py.FS.mkdirTree(dir);
      py.FS.writeFile(destino, d.archivos[ruta]);
    }
    py.FS.chdir("/proyecto" + (base ? "/" + base : ""));
    py.runPython("import sys; sys.path.insert(0, '.')");
    py.setStdin({ stdin: function () { var r = window.prompt("input() de Python:"); return r === null ? "" : r; } });
    estado.textContent = "instalando paquetes…";
    var codigo = d.archivos[d.entrada] || "";
    await py.loadPackagesFromImports(codigo);
    if (d.requisitos.length) {
      await py.loadPackage("micropip");
      var micropip = py.pyimport("micropip");
      for (var i = 0; i < d.requisitos.length; i++) {
        try { await micropip.install(d.requisitos[i]); } catch (e) { escribir("No se pudo instalar " + d.requisitos[i] + ": " + (e && e.message ? e.message.split("\\n")[0] : e), "aviso"); }
      }
    }
    // matplotlib: los gráficos, como imagen en la página
    if (/matplotlib/.test(codigo)) {
      py.runPython("import matplotlib; matplotlib.use('AGG')");
    }
    estado.textContent = "ejecutando…";
    await py.runPythonAsync(codigo, { filename: d.entrada });
    if (/matplotlib/.test(codigo)) {
      var png = py.runPython("import io, base64, matplotlib.pyplot as plt\\nb = io.BytesIO()\\n(plt.gcf().savefig(b, format='png'), base64.b64encode(b.getvalue()).decode())[1] if plt.get_fignums() else ''");
      if (png) { var img = document.createElement("img"); img.src = "data:image/png;base64," + png; salida.appendChild(img); }
    }
    estado.textContent = "terminado ✓";
  } catch (e) {
    estado.textContent = "error";
    var msg = e && e.message ? e.message : String(e);
    escribir(msg, "err");
    console.error(msg.split("\\n").filter(Boolean).slice(-1)[0] || msg);
  }
})();
</script>
</body>
</html>`;
}
