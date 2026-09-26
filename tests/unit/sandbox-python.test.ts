import { describe, expect, it } from "vitest";
import { detectarPython, htmlPython, PYODIDE_URL } from "../../src/lib/forja/sandbox-python";
import { servidorNode } from "../../src/lib/forja/sandbox-moderno";

/** Forja IA — Scripts de Python (Pyodide) y servidores de Node en el Sandbox. */

const enc = new TextEncoder();
const proyecto = (a: Record<string, string>) => new Map(Object.entries(a).map(([p, t]) => [p, enc.encode(t)]));

describe("detectarPython", () => {
  it("elige main.py, lee requirements.txt y lleva los datos del proyecto", () => {
    const p = detectarPython(
      proyecto({
        "calc/utils.py": "def suma(a, b): return a + b",
        "calc/main.py": "from utils import suma\nprint(suma(2, 3))",
        "calc/datos.csv": "a,b\n1,2",
        "calc/requirements.txt": "requests==2.31.0  # http\nnumpy>=1.26\n-e .\n",
      })
    );
    expect(p?.entrada).toBe("calc/main.py");
    expect(p?.requisitos).toEqual(["requests", "numpy"]);
    expect(Object.keys(p?.archivos ?? {})).toContain("calc/datos.csv");
    expect(p?.servidor).toBeUndefined();
  });

  it("sin main.py, el que tiene «if __name__ == '__main__'»", () => {
    const p = detectarPython(proyecto({ "a.py": "x = 1", "juego.py": 'if __name__ == "__main__":\n    print("hola")' }));
    expect(p?.entrada).toBe("juego.py");
  });

  it("una web con su index.html manda aunque traiga un .py", () => {
    expect(detectarPython(proyecto({ "index.html": "<h1>x</h1>", "build.py": "print(1)" }))).toBeNull();
  });

  it("Flask se reconoce como servidor y se dice por qué no", () => {
    const p = detectarPython(proyecto({ "app.py": "from flask import Flask\napp = Flask(__name__)\napp.run()" }));
    expect(p?.servidor).toMatch(/Flask/);
  });
});

describe("htmlPython", () => {
  it("carga Pyodide y lleva el proyecto como datos, sin que un </script> lo rompa", () => {
    const html = htmlPython({ entrada: "main.py", archivos: { "main.py": 'print("</script>")' }, requisitos: [] });
    expect(html).toContain(PYODIDE_URL);
    expect(html).toContain('"main.py"');
    expect(html).not.toMatch(/print\("<\/script>"\)/);
    expect(html).toContain("<\\/script>");
  });
});

describe("servidorNode", () => {
  it("Express sin parte web: se explica cómo probarlo", () => {
    expect(servidorNode(proyecto({ "package.json": JSON.stringify({ dependencies: { express: "^4.19.0" } }), "server.js": "" }))).toMatch(/Express|express/);
  });
  it("un proyecto de React no es un servidor", () => {
    expect(servidorNode(proyecto({ "package.json": JSON.stringify({ dependencies: { react: "18.3.1" } }) }))).toBeNull();
  });
});
