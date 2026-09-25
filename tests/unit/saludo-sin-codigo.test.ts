import { describe, expect, it } from "vitest";
import { historialSinCodigo, marcadorSaludo } from "../../src/lib/forja/turno-trivial";

const pagina = (lineas: number) =>
  ["<!DOCTYPE html>", "<html>", ...Array.from({ length: lineas }, (_, i) => `<p>Línea ${i} con algo de texto para pesar</p>`)].join("\n");

describe("historialSinCodigo — un saludo no lleva la página del turno anterior", () => {
  it("sustituye el bloque grande por un marcador y deja la prosa", () => {
    const msgs = [
      { role: "user", content: "hazme una landing" },
      { role: "assistant", content: `Aquí tienes:\n\n\`\`\`html index.html\n${pagina(40)}\n</html>\n\`\`\`\n\n¿Algo más?` },
      { role: "user", content: "hola" },
    ];
    const r = historialSinCodigo(msgs, 2);
    const a = r.mensajes[1].content;
    expect(a).toContain("Aquí tienes:");
    expect(a).toContain("¿Algo más?");
    expect(a).not.toContain("<!DOCTYPE");
    expect(a).toContain("código omitido (html,");
    expect(a).not.toContain("se cortó");
    expect(r.ahorrados).toBeGreaterThan(1000);
  });

  it("también quita el bloque SIN cerrar (la respuesta cortada) y lo dice", () => {
    const msgs = [{ role: "assistant", content: `Va:\n\`\`\`html\n${pagina(40)}\n<button class="cta` }];
    const a = historialSinCodigo(msgs).mensajes[0].content;
    expect(a).not.toContain("<button");
    expect(a).toContain("se cortó a mitad");
    expect(a).toMatch(/no lo reescribas/);
  });

  it("no toca la pregunta viva, ni lo del usuario, ni los bloques pequeños", () => {
    const corto = "```js\nconsole.log(1)\n```";
    const msgs = [
      { role: "user", content: `mira:\n\`\`\`html\n${pagina(40)}\n\`\`\`` },
      { role: "assistant", content: `Prueba esto:\n${corto}` },
      { role: "assistant", content: `\`\`\`html\n${pagina(40)}\n\`\`\`` },
    ];
    const r = historialSinCodigo(msgs, 2);
    expect(r.mensajes[0]).toBe(msgs[0]);
    expect(r.mensajes[1]).toBe(msgs[1]);
    expect(r.mensajes[2]).toBe(msgs[2]);
    expect(r.ahorrados).toBe(0);
  });

  it("el marcador es corto y dice el tamaño", () => {
    const m = marcadorSaludo("html", 162, true);
    expect(m.length).toBeLessThan(200);
    expect(m).toContain("162 líneas");
  });
});
