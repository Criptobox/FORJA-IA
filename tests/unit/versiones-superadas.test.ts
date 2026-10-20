import { describe, it, expect } from "vitest";
import {
  MIN_CHARS,
  marcador,
  podarVersionesSuperadas,
} from "../../src/lib/forja/versiones-superadas";

const pagina = (marca: string, n = MIN_CHARS + 200) =>
  `<!doctype html>\n<html><body><h1>${marca}</h1>\n${"<p>texto</p>\n".repeat(Math.ceil(n / 13))}</body></html>`;
const bloque = (ruta: string, codigo: string) => `**${ruta}**\n\n\`\`\`html\n${codigo}\n\`\`\``;

describe("podarVersionesSuperadas", () => {
  it("quita la versión vieja y deja intacta la última", () => {
    const v1 = pagina("uno");
    const v2 = pagina("dos");
    const msgs = [
      { role: "user", content: "haz una web" },
      { role: "assistant", content: `Aquí va:\n\n${bloque("index.html", v1)}` },
      { role: "user", content: "cambia el título" },
      { role: "assistant", content: `Hecho:\n\n${bloque("index.html", v2)}` },
      { role: "user", content: "gracias, ¿y ahora?" },
    ];
    const r = podarVersionesSuperadas(msgs, 4);
    expect(r.bloques).toBe(1);
    expect(r.mensajes[1].content).not.toContain("<h1>uno</h1>");
    expect(r.mensajes[1].content).toContain("«index.html»");
    expect(r.mensajes[1].content).toContain("Aquí va:");
    expect(r.mensajes[3].content).toBe(msgs[3].content);
    expect(r.ahorrados).toBeGreaterThan(v1.length - 200);
  });

  it("un fragmento pequeño no sustituye al archivo entero", () => {
    const msgs = [
      { role: "assistant", content: bloque("index.html", pagina("uno")) },
      { role: "assistant", content: bloque("index.html", "<button>Nuevo</button>") },
    ];
    const r = podarVersionesSuperadas(msgs);
    expect(r.bloques).toBe(0);
    expect(r.mensajes).toEqual(msgs);
  });

  it("no toca archivos sin versión posterior ni bloques pequeños", () => {
    const msgs = [
      { role: "assistant", content: bloque("styles.css", "body{margin:0}") + "\n\n" + bloque("index.html", pagina("a")) },
      { role: "assistant", content: bloque("styles.css", "body{margin:1px}") },
    ];
    const r = podarVersionesSuperadas(msgs);
    expect(r.bloques).toBe(0);
  });

  it("archivos distintos no se sustituyen entre sí", () => {
    const msgs = [
      { role: "assistant", content: bloque("index.html", pagina("a")) },
      { role: "assistant", content: bloque("about.html", pagina("b")) },
    ];
    expect(podarVersionesSuperadas(msgs).bloques).toBe(0);
  });

  it("nunca modifica el mensaje protegido, pero sí cuenta como versión nueva", () => {
    const msgs = [
      { role: "assistant", content: bloque("index.html", pagina("vieja")) },
      { role: "user", content: `te pego la mía:\n\n${bloque("index.html", pagina("mia"))}` },
    ];
    const r = podarVersionesSuperadas(msgs, 1);
    expect(r.bloques).toBe(1);
    expect(r.mensajes[1]).toBe(msgs[1]);
    expect(r.mensajes[0].content).toBe(`**index.html**\n\n${marcador("index.html", pagina("vieja").length)}`);
  });

  it("es determinista y no muta la entrada", () => {
    const msgs = [
      { role: "assistant", content: bloque("index.html", pagina("1")) },
      { role: "assistant", content: bloque("index.html", pagina("2")) },
      { role: "assistant", content: bloque("index.html", pagina("3")) },
    ];
    const copia = JSON.parse(JSON.stringify(msgs));
    const a = podarVersionesSuperadas(msgs);
    const b = podarVersionesSuperadas(msgs);
    expect(a).toEqual(b);
    expect(a.bloques).toBe(2);
    expect(msgs).toEqual(copia);
  });

  it("solo sustituyen mensajes posteriores, no una copia en el mismo mensaje", () => {
    const msgs = [{ role: "assistant", content: `${bloque("index.html", pagina("a"))}\n\ncorrijo:\n\n${bloque("index.html", pagina("b"))}` }];
    const r = podarVersionesSuperadas(msgs);
    expect(r.bloques).toBe(0);
  });
});
