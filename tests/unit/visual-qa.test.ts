import { describe, expect, it } from "vitest";
import {
  injectVisualQA,
  QA_WIDTHS,
  reglaDeQA,
  VISUAL_QA_SCRIPT,
} from "../../src/lib/forja/visual-qa";

describe("QA visual sobre la vista previa", () => {
  it("la batería mide móvil, tablet, portátil y escritorio grande", () => {
    expect([...QA_WIDTHS]).toEqual([320, 390, 768, 1280, 1920]);
  });

  it("injectVisualQA añade el medidor antes de </body>", () => {
    const html = "<!doctype html><html><body><h1>Hola</h1></body></html>";
    const out = injectVisualQA(html);
    expect(out).toContain("forja-qa-run");
    expect(out.indexOf("<script>")).toBeGreaterThan(0);
    expect(out.indexOf("<script>")).toBeLessThan(out.indexOf("</body>"));
  });

  it("injectVisualQA es idempotente: no inyecta dos veces", () => {
    const html = "<body><p>x</p></body>";
    const una = injectVisualQA(html);
    const dos = injectVisualQA(una);
    expect(dos).toBe(una);
    expect(dos.split("forja-qa-run").length - 1).toBe(1);
  });

  it("HTML sin body/html también recibe el medidor; el vacío queda vacío", () => {
    expect(injectVisualQA("<p>sueltos</p>")).toContain("forja-qa-run");
    expect(injectVisualQA("")).toBe("");
  });

  it("el script del medidor no cierra la etiqueta script por accidente", () => {
    expect(VISUAL_QA_SCRIPT).not.toContain("</script");
  });

  it("el medidor escucha, se auto-mide al cargar y reporta por postMessage", () => {
    expect(VISUAL_QA_SCRIPT).toContain('addEventListener("message"');
    expect(VISUAL_QA_SCRIPT).toContain('"forja-qa-run"');
    expect(VISUAL_QA_SCRIPT).toContain('type:"forja-qa-result"');
    expect(VISUAL_QA_SCRIPT).toContain("responder(0)"); // medida automática al cargar
    expect(VISUAL_QA_SCRIPT).toContain("parent.postMessage");
  });

  it("cada tipo de hallazgo tiene su regla de memoria de fallos", () => {
    expect(reglaDeQA("scroll")).toMatch(/scroll horizontal/i);
    expect(reglaDeQA("fuera")).toMatch(/viewport/i);
    expect(reglaDeQA("texto")).toMatch(/12 px/);
    expect(reglaDeQA("contraste")).toMatch(/4\.5:1/);
    expect(reglaDeQA("sin-nombre")).toMatch(/nombre accesible/i);
    expect(reglaDeQA("sin-alt")).toMatch(/alt/i);
    expect(reglaDeQA("toque-pequeno")).toMatch(/24×24/);
  });

  it("el medidor también audita nombre accesible, alt y objetivo de toque", () => {
    // mismas tres reglas que el Inspector Visual mide sobre la propia app
    expect(VISUAL_QA_SCRIPT).toContain('tipo:"sin-nombre"');
    expect(VISUAL_QA_SCRIPT).toContain('tipo:"sin-alt"');
    expect(VISUAL_QA_SCRIPT).toContain('tipo:"toque-pequeno"');
  });
});
