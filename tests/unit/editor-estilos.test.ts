import { describe, expect, it } from "vitest";
import {
  aHex,
  ajustesDeFuente,
  aplicarAjustesEnFuente,
  cssDeCambios,
  injectEstiloPilot,
  parsearAjustes,
  selectorValido,
  valorValido,
} from "../../src/lib/forja/editor-estilos";

const F = "```";
const RESPUESTA = [
  "Aquí tienes tu página.",
  `${F}html`,
  '<!DOCTYPE html><html lang="es"><head><style>:root{--acento:#f97316}</style></head>',
  "<body><main><h1>Hola</h1><section><h2>Uno</h2></section><section><h2>Dos</h2></section></main></body></html>",
  F,
  "¿Te cambio algo más?",
].join("\n");

describe("validación de selectores y valores", () => {
  it("acepta lo que genera el piloto y los tokens", () => {
    expect(selectorValido("body > main > section:nth-of-type(2) > h2")).toBe(true);
    expect(selectorValido("#hero > p")).toBe(true);
    expect(selectorValido(":root")).toBe(true);
  });

  it("rechaza lo que podría cerrar la regla o la etiqueta", () => {
    for (const s of ["h1{color:red}", "h1;", "</style><script>", "a[href]"]) expect(selectorValido(s), s).toBe(false);
    for (const v of ["red;}", "red</style>", "url(https://x.com/a.png)", "expression(alert(1))", "red /* x */"]) {
      expect(valorValido(v), v).toBe(false);
    }
    for (const v of ["#0f172a", "rgb(15, 23, 42)", "oklch(0.7 0.2 40)", "16px", "1.25rem 2rem", "var(--acento)", ""]) {
      expect(valorValido(v), v).toBe(true);
    }
  });
});

describe("aHex", () => {
  it("convierte lo que da getComputedStyle a lo que entiende <input type=color>", () => {
    expect(aHex("rgb(15, 23, 42)")).toBe("#0f172a");
    expect(aHex("rgba(255, 0, 0, 1)")).toBe("#ff0000");
    expect(aHex("#abc")).toBe("#aabbcc");
    expect(aHex("#F97316")).toBe("#f97316");
  });
  it("lo transparente o en otro espacio de color no se inventa", () => {
    expect(aHex("rgba(0, 0, 0, 0)")).toBeNull();
    expect(aHex("oklch(0.7 0.2 40)")).toBeNull();
    expect(aHex("")).toBeNull();
  });
});

describe("aplicarAjustesEnFuente", () => {
  it("añade el bloque al final del <body> del documento, sin tocar el resto de la respuesta", () => {
    const r = aplicarAjustesEnFuente(RESPUESTA, [
      { selector: "body > main > section:nth-of-type(2) > h2", props: { color: "#0f172a", "font-size": "40px" } },
    ]);
    expect(r.ok).toBe(true);
    const c = r.contenido!;
    expect(c.startsWith("Aquí tienes tu página.")).toBe(true);
    expect(c.endsWith("¿Te cambio algo más?")).toBe(true);
    expect(c).toMatch(/<style data-forja-ajustes>[\s\S]*section:nth-of-type\(2\) > h2 \{ color: #0f172a !important; font-size: 40px !important; \}[\s\S]*<\/style>\n<\/body>/);
  });

  it("los tokens van en :root sin !important y primero", () => {
    const r = aplicarAjustesEnFuente(RESPUESTA, [
      { selector: "h1", props: { color: "#111111" } },
      { selector: ":root", props: { "--acento": "#e11d48" } },
    ]);
    const bloque = r.contenido!.match(/<style data-forja-ajustes>([\s\S]*?)<\/style>/)![1];
    expect(bloque.indexOf(":root")).toBeLessThan(bloque.indexOf("h1 {"));
    expect(bloque).toContain(":root { --acento: #e11d48; }");
  });

  it("una segunda edición fusiona en el mismo bloque, no apila otro", () => {
    const a = aplicarAjustesEnFuente(RESPUESTA, [{ selector: "h1", props: { color: "#111111" } }]).contenido!;
    const b = aplicarAjustesEnFuente(a, [{ selector: "h1", props: { "font-weight": "800" } }]).contenido!;
    expect(b.match(/data-forja-ajustes/g)).toHaveLength(1);
    expect(ajustesDeFuente(b).get("h1")).toEqual(new Map([["color", "#111111"], ["font-weight", "800"]]));
  });

  it("vaciar todos los valores quita la regla, y sin reglas se quita el bloque entero", () => {
    const a = aplicarAjustesEnFuente(RESPUESTA, [{ selector: "h1", props: { color: "#111111" } }]).contenido!;
    const b = aplicarAjustesEnFuente(a, [{ selector: "h1", props: { color: "" } }]).contenido!;
    expect(b).not.toContain("data-forja-ajustes");
    expect(b).toBe(RESPUESTA);
  });

  it("rechaza sin tocar nada lo que no valida", () => {
    const r = aplicarAjustesEnFuente(RESPUESTA, [{ selector: "h1", props: { color: "red;}</style><script>alert(1)" } }]);
    expect(r.ok).toBe(false);
    expect(aplicarAjustesEnFuente(RESPUESTA, [{ selector: "h1", props: { position: "fixed" } }]).ok).toBe(false);
  });

  it("con varias versiones de la página, edita la última (la que se ve)", () => {
    const doble = `${RESPUESTA}\n\nVersión corregida:\n${F}html\n<!DOCTYPE html><html><head></head><body><h1>V2</h1></body></html>\n${F}`;
    const c = aplicarAjustesEnFuente(doble, [{ selector: "h1", props: { color: "#111111" } }]).contenido!;
    const iV2 = c.indexOf("<h1>V2</h1>");
    expect(c.indexOf("data-forja-ajustes")).toBeGreaterThan(iV2);
    expect(c.slice(0, iV2)).not.toContain("data-forja-ajustes");
  });

  it("sin documento HTML lo dice", () => {
    expect(aplicarAjustesEnFuente("solo texto", [{ selector: "h1", props: { color: "#000000" } }]).ok).toBe(false);
  });

  it("un bloque escrito a mano con basura se lee sin lo que no valida", () => {
    const r = parsearAjustes("h1 { color: red; position: fixed; } h1{ } bad{selector { x: y }");
    expect(r.get("h1")).toEqual(new Map([["color", "red"]]));
  });
});

describe("previsualización y piloto", () => {
  it("el CSS en vivo es el mismo que se guardaría", () => {
    expect(cssDeCambios([{ selector: "h1", props: { color: "#111111" } }])).toContain("h1 { color: #111111 !important; }");
    expect(cssDeCambios([{ selector: "h1{", props: { color: "#111111" } }])).toBe("");
  });

  it("el piloto se inyecta una vez, antes del último </body>", () => {
    const html = injectEstiloPilot("<html><body><p>x</p></body></html>");
    expect(injectEstiloPilot(html)).toBe(html);
    expect(html).toMatch(/__forjaEstilo[\s\S]*<\/script><\/body><\/html>$/);
  });
});
