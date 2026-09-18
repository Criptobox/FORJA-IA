/** Forja IA — Cuando el modelo pide la herramienta como TEXTO, no como
 * tool_calls. Reportado por un usuario dos veces seguidas en la misma
 * conversación (nvidia/nemotron vía OpenRouter): la burbuja enseñaba
 * literal `<function=write_file> <parameter=path>...` en vez de escribir
 * el archivo.
 */
import { describe, expect, it } from "vitest";
import {
  pareceLlamadaEnTexto,
  parseLlamadasEnTexto,
  quitarLlamadasEnTexto,
} from "../../src/lib/prism/tool-calls-texto";

const LLAMADA_REAL =
  '<function=write_file><parameter=path>index.html</parameter>' +
  '<parameter=content><!DOCTYPE html><html lang="es"><body><h1>Hola</h1></body></html></parameter></function>';

describe("pareceLlamadaEnTexto", () => {
  it("reconoce la plantilla real reportada", () => {
    expect(pareceLlamadaEnTexto(LLAMADA_REAL)).toBe(true);
  });

  it("no se dispara con texto normal, ni con un <function> a secas", () => {
    expect(pareceLlamadaEnTexto("Aquí tienes tu página.")).toBe(false);
    expect(pareceLlamadaEnTexto("una <function> matemática, no de programación")).toBe(false);
  });
});

describe("parseLlamadasEnTexto", () => {
  it("extrae el nombre y los parámetros de la llamada real reportada", () => {
    const llamadas = parseLlamadasEnTexto(LLAMADA_REAL);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].name).toBe("write_file");
    expect(llamadas[0].args.path).toBe("index.html");
    expect(llamadas[0].args.content).toContain("<h1>Hola</h1>");
  });

  it("con espacios sueltos entre etiquetas (como llegó de verdad)", () => {
    const conEspacios =
      "<function=write_file> <parameter=path> index.html </parameter> " +
      "<parameter=content> <!DOCTYPE html> </parameter> </function>";
    const llamadas = parseLlamadasEnTexto(conEspacios);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].args.path).toBe("index.html");
  });

  it("varias llamadas en el mismo texto, todas se extraen", () => {
    const dos = LLAMADA_REAL + LLAMADA_REAL.replace("index.html", "styles.html");
    const llamadas = parseLlamadasEnTexto(dos);
    expect(llamadas).toHaveLength(2);
    expect(llamadas[0].id).not.toBe(llamadas[1].id);
  });

  it("una llamada CORTADA a mitad (respuesta truncada) no se cuenta: sin cierre no hay forma de saber si el parámetro quedó completo", () => {
    const cortada = '<function=write_file><parameter=path>index.html</parameter><parameter=content><!DOCTYPE';
    expect(parseLlamadasEnTexto(cortada)).toEqual([]);
  });

  it("texto sin ninguna llamada: lista vacía, no lanza", () => {
    expect(parseLlamadasEnTexto("Aquí tienes tu página.")).toEqual([]);
  });
});

describe("quitarLlamadasEnTexto", () => {
  it("deja vacío cuando el modelo SOLO escribió la llamada (el caso real)", () => {
    expect(quitarLlamadasEnTexto(LLAMADA_REAL)).toBe("");
  });

  it("conserva el texto que de verdad acompañaba a la llamada", () => {
    const conTexto = `Aquí lo tienes:\n\n${LLAMADA_REAL}\n\n¿Qué más necesitas?`;
    const limpio = quitarLlamadasEnTexto(conTexto);
    expect(limpio).toContain("Aquí lo tienes");
    expect(limpio).toContain("¿Qué más necesitas?");
    expect(limpio).not.toContain("<function=");
  });
});
