import { describe, expect, it } from "vitest";
import { verifyWebProject, summarizeVerification } from "../../src/lib/forja/web-verifier";

describe("web-verifier", () => {
  it("does not approve without runtime and visual evidence", () => {
    const v = verifyWebProject({ "index.html": "<!doctype html><html><body><h1>Hola</h1></body></html>" });
    expect(v.passed).toBe(false);
    expect(v.evidenceComplete).toBe(false);
    expect(v.findings.some((x) => x.id === "runtime-missing")).toBe(true);
    expect(v.findings.some((x) => x.id === "visual-missing")).toBe(true);
  });

  it("detects accessibility, broken local assets and likely secrets", () => {
    const v = verifyWebProject({
      "index.html": '<!doctype html><html><body><img src="missing.png"><button></button><script src="app.js"></script></body></html>',
      "config.js": ["const key = \"sk", "-123456789012345678901234\";"].join(""),
    }, { executed: true, errors: 0, qa: { ok: true } });
    expect(v.findings.some((x) => x.id === "missing-local-asset")).toBe(true);
    expect(v.findings.some((x) => x.id === "img-alt")).toBe(true);
    expect(v.findings.some((x) => x.id === "interactive-name")).toBe(true);
    expect(v.findings.some((x) => x.id === "possible-secret")).toBe(true);
    expect(v.passed).toBe(false);
  });

  it("approves only when runtime and visual evidence are clean", () => {
    const v = verifyWebProject({
      "index.html": '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Forja</title></head><body><img alt="Logo" src="logo.svg"><button aria-label="Abrir">OK</button></body></html>',
      "logo.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",
    }, { executed: true, errors: 0, qa: { ok: true, noRespondio: false, items: [] } });
    expect(v.passed).toBe(true);
    expect(summarizeVerification(v)).toContain("PASS");
  });

  it("no duplica a 'error' lo que el chequeo estático ya marcó como aviso (alt, nombre accesible)", () => {
    const v = verifyWebProject({
      "index.html": '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Forja</title></head><body><img src="logo.svg"><button></button></body></html>',
      "logo.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",
    }, {
      executed: true,
      errors: 0,
      qa: {
        ok: false,
        noRespondio: false,
        items: [
          { tipo: "sin-alt", detalle: "img sin alt" },
          { tipo: "sin-nombre", detalle: "button sin nombre" },
        ],
      },
    });
    expect(v.findings.filter((x) => x.id === "img-alt")).toHaveLength(1);
    expect(v.findings.some((x) => x.id === "visual-sin-alt")).toBe(false);
    expect(v.findings.some((x) => x.id === "visual-sin-nombre")).toBe(false);
  });

  it("un objetivo de toque pequeño medido en vivo sí bloquea: no tiene chequeo estático equivalente", () => {
    const v = verifyWebProject({
      "index.html": '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Forja</title></head><body><button aria-label="Abrir">OK</button></body></html>',
    }, {
      executed: true,
      errors: 0,
      qa: { ok: false, noRespondio: false, items: [{ tipo: "toque-pequeno", detalle: "<button> 16x16px" }] },
    });
    expect(v.findings.some((x) => x.id === "visual-toque-pequeno" && x.severity === "error")).toBe(true);
    expect(v.passed).toBe(false);
  });
});

describe("web-verifier + auditoría web", () => {
  it("los hallazgos de SEO/rendimiento/accesibilidad llegan como avisos y no tumban un PASS", () => {
    const v = verifyWebProject({
      "index.html": '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Forja</title><script src="app.js"></script></head><body><h2>Sin h1</h2><input placeholder="Nombre"></body></html>',
      "app.js": "console.log(1)",
    }, { executed: true, errors: 0, qa: { ok: true, noRespondio: false, items: [] } });
    const ids = v.findings.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(["seo-meta-description", "seo-sin-h1", "perf-script-bloqueante", "a11y-campo-sin-etiqueta"]));
    expect(v.findings.every((f) => f.severity !== "error")).toBe(true);
    expect(v.passed).toBe(true);
  });

  it("lee el CSS de los archivos del proyecto, no solo el <style> del HTML", () => {
    const v = verifyWebProject({
      "index.html": '<!doctype html><html lang="es"><head><link rel="stylesheet" href="styles.css"><title>x</title></head><body><h1>x</h1></body></html>',
      "styles.css": "button{outline:none}",
    });
    expect(v.findings.some((f) => f.id === "a11y-foco-invisible")).toBe(true);
  });

  it("los errores van primero aunque haya muchos avisos", () => {
    const v = verifyWebProject({ "index.html": "<html><body><h3>x</h3><img src='nope.png'></body></html>" });
    expect(v.findings[0].severity).toBe("error");
  });
});
