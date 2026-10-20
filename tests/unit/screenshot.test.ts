import { describe, expect, it } from "vitest";
import { injectScreenshot, promptCritica, SCREENSHOT_SCRIPT } from "../../src/lib/forja/screenshot";

describe("captura real de la vista previa (para el QA por visión)", () => {
  it("injectScreenshot añade el capturador antes de </body>", () => {
    const html = "<!doctype html><html><body><h1>Hola</h1></body></html>";
    const out = injectScreenshot(html);
    expect(out).toContain("forja-shot-result");
    expect(out.indexOf("<script>")).toBeGreaterThan(0);
    expect(out.indexOf("<script>")).toBeLessThan(out.indexOf("</body>"));
  });

  it("injectScreenshot es idempotente: no inyecta dos veces", () => {
    const html = "<body><p>x</p></body>";
    const una = injectScreenshot(html);
    const dos = injectScreenshot(una);
    expect(dos).toBe(una);
    // "forja-shot-result" sale varias veces DENTRO del propio script (una
    // por cada postMessage: éxito, fallo al dibujar, fallo al cargar la
    // imagen, fallo general) — no sirve para contar inyecciones. Lo que sí
    // cuenta las veces que se inyectó es la propia etiqueta <script>.
    expect(dos.split("<script>").length - 1).toBe(1);
  });

  it("HTML sin body/html también recibe el capturador; el vacío queda vacío", () => {
    expect(injectScreenshot("<p>sueltos</p>")).toContain("forja-shot-result");
    expect(injectScreenshot("")).toBe("");
  });

  it("el script no cierra la etiqueta script por accidente", () => {
    expect(SCREENSHOT_SCRIPT).not.toContain("</script");
  });

  it("captura sola al cargar (sin pedirlo desde fuera) y reporta por postMessage", () => {
    // A diferencia del QA visual (que se puede pedir a varios anchos), aquí
    // solo hace falta una captura por ejecución: se dispara sola.
    expect(SCREENSHOT_SCRIPT).toContain("setTimeout(capturar, 400)");
    expect(SCREENSHOT_SCRIPT).toContain("type: 'forja-shot-result'");
    expect(SCREENSHOT_SCRIPT).toContain("parent.postMessage");
  });

  it("usa la técnica SVG+foreignObject+canvas, sin ninguna librería", () => {
    expect(SCREENSHOT_SCRIPT).toContain("XMLSerializer");
    expect(SCREENSHOT_SCRIPT).toContain("foreignObject");
    expect(SCREENSHOT_SCRIPT).toContain("toDataURL");
    // el único "http://" es el espacio de nombres XML del propio SVG
    // (obligatorio en la spec), no una descarga: no hay ningún `fetch`,
    // `XMLHttpRequest` ni `<script src=` a nada externo.
    expect(SCREENSHOT_SCRIPT).not.toMatch(/\bfetch\(|XMLHttpRequest|<script src=/);
  });

  it("deja los efectos en su estado final antes de capturar (asentarFx) y los devuelve después", () => {
    // Reusa el mismo asentador que ya usa `visual-qa.ts`/`generico.ts`: sin
    // esto la foto saldría a medio entrar (opacity:0 esperando el scroll).
    expect(SCREENSHOT_SCRIPT).toContain("function asentarFx()");
    expect(SCREENSHOT_SCRIPT).toContain("function desasentarFx(");
    expect(SCREENSHOT_SCRIPT).toContain("asentarFx()");
    expect(SCREENSHOT_SCRIPT).toContain("desasentarFx(tocadosFx)");
  });

  it("tope de tamaño: 1152 px de lado, igual que attachments.ts", () => {
    expect(SCREENSHOT_SCRIPT).toContain("1152 / w");
  });

  it("rellena el fondo real ANTES de dibujar: una página sin color de fondo explícito no sale negra", () => {
    // Bug real, encontrado probando la tool a mano contra la app real (no
    // en un test escrito antes): una página con fondo blanco por DEFECTO
    // del navegador (sin `background` explícito) salía casi toda NEGRA en
    // la captura, con el texto por defecto (negro) invisible encima. El
    // foreignObject no hereda el blanco por defecto, y exportar a JPEG (sin
    // canal alfa) rellena lo transparente de negro, no de blanco. Sin este
    // relleno previo, cualquier página "normal" —la inmensa mayoría, que no
    // pone `background` a mano— saldría con la captura rota.
    expect(SCREENSHOT_SCRIPT).toContain("fillStyle");
    expect(SCREENSHOT_SCRIPT).toContain("fillRect(0, 0, outW, outH)");
    // el relleno pasa ANTES de dibujar la imagen encima, no después (si no,
    // taparía lo capturado)
    expect(SCREENSHOT_SCRIPT.indexOf("fillRect")).toBeLessThan(SCREENSHOT_SCRIPT.indexOf("ctx.drawImage"));
  });

  it("un fallo al capturar (p. ej. canvas contaminado) se reporta, nunca se calla", () => {
    expect(SCREENSHOT_SCRIPT).toContain("ok: false, error:");
  });
});

describe("promptCritica", () => {
  it("pide una crítica concreta y prohíbe inventar problemas", () => {
    const p = promptCritica();
    expect(p).toMatch(/captura real/i);
    expect(p).toMatch(/no inventes/i);
  });

  it("con foco, le dice al modelo dónde fijarse", () => {
    const p = promptCritica("el formulario de contacto");
    expect(p).toContain("el formulario de contacto");
  });

  it("sin foco, no menciona ningún «presta atención»", () => {
    const p = promptCritica();
    expect(p).not.toMatch(/presta especial atención/i);
  });
});
