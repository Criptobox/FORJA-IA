import { describe, expect, it } from "vitest";
import { auditarWeb, resumirAuditoria } from "../../src/lib/forja/web-audit";

const ids = (html: string) => auditarWeb(html).hallazgos.map((h) => h.id);

const LIMPIA = `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Café Lento — tostado en Valencia</title>
<meta name="description" content="Café de especialidad tostado cada semana en Valencia. Envío en 24 h y suscripción mensual.">
<meta property="og:title" content="Café Lento"><meta property="og:description" content="Tostado cada semana">
<meta property="og:image" content="og.jpg">
<style>a:focus-visible{outline:2px solid}</style>
</head><body><main><h1>Café que se nota</h1><h2>Orígenes</h2><h3>Etiopía</h3>
<img src="a.jpg" alt="Saco" width="400" height="300">
<label for="email">Correo</label><input id="email" type="email">
<a href="/precios">Ver precios</a></main></body></html>`;

describe("auditarWeb", () => {
  it("sin HTML no puntúa: null, no un 100 inventado", () => {
    const a = auditarWeb("");
    expect(a.puntuacion).toEqual({ seo: null, rendimiento: null, accesibilidad: null });
    expect(auditarWeb("solo texto sin etiquetas").puntuacion.seo).toBeNull();
  });

  it("una página bien hecha sale limpia en las tres categorías", () => {
    const a = auditarWeb(LIMPIA);
    expect(a.hallazgos).toEqual([]);
    expect(a.puntuacion).toEqual({ seo: 100, rendimiento: 100, accesibilidad: 100 });
  });

  it("SEO: meta description, Open Graph, h1 y saltos de encabezado", () => {
    const r = ids("<html><head><title>x</title></head><body><h2>A</h2><h4>B</h4><a href='#'>clic aquí</a></body></html>");
    expect(r).toContain("seo-meta-description");
    expect(r).toContain("seo-open-graph");
    expect(r).toContain("seo-sin-h1");
    expect(r).toContain("seo-salto-encabezado");
    expect(r).toContain("seo-enlace-generico");
    expect(ids("<body><h1>a</h1><h1>b</h1></body>")).toContain("seo-varios-h1");
  });

  it("rendimiento: imágenes sin tamaño/lazy, scripts bloqueantes y fuentes", () => {
    const html = `<html><head><script src="app.js"></script><script src="ok.js" defer></script>
      <script type="module" src="m.js"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">
      <style>@import url("x.css"); @font-face{font-family:A;src:url(a.woff2)}</style></head>
      <body><img src="1.jpg" alt=""><img src="2.jpg" alt=""><img src="3.jpg" alt=""></body></html>`;
    const a = auditarWeb(html);
    const r = a.hallazgos.map((h) => h.id);
    expect(r).toEqual(expect.arrayContaining([
      "perf-img-sin-tamano", "perf-img-sin-lazy", "perf-script-bloqueante",
      "perf-fuentes-preconnect", "perf-font-display", "perf-css-import",
    ]));
    // solo app.js bloquea: defer y type=module no
    expect(a.hallazgos.find((h) => h.id === "perf-script-bloqueante")?.mensaje).toMatch(/^1 /);
    expect(a.puntuacion.rendimiento).toBeLessThan(100);
  });

  it("rendimiento: una imagen en base64 enorme se señala", () => {
    const b64 = "A".repeat(200_000);
    expect(ids(`<body><img src="data:image/png;base64,${b64}" alt="x" width="1" height="1"></body>`)).toContain("perf-data-uri");
  });

  it("accesibilidad: campos sin etiqueta, pero no los envueltos ni los ocultos", () => {
    const html = `<body><form>
      <input type="text" placeholder="Nombre">
      <label>Correo <input type="email"></label>
      <input type="hidden" name="t"><input type="submit" value="Enviar">
      <input aria-label="Buscar"></form></body>`;
    const h = auditarWeb(html).hallazgos.find((x) => x.id === "a11y-campo-sin-etiqueta");
    expect(h?.mensaje).toMatch(/^1 campo/);
  });

  it("accesibilidad: tabindex positivo, foco invisible, div clicable y autoplay", () => {
    const r = ids(`<html><head><style>*{outline:none}</style></head><body>
      <div tabindex="3">a</div><div onclick="go()">ir</div><video autoplay src="v.mp4"></video></body></html>`);
    expect(r).toEqual(expect.arrayContaining([
      "a11y-tabindex-positivo", "a11y-foco-invisible", "a11y-clic-sin-rol", "a11y-video-autoplay",
    ]));
    // con :focus-visible definido, quitar el outline por defecto es legítimo
    expect(ids("<style>*{outline:none} a:focus-visible{outline:2px solid}</style><a href='/'>x</a>")).not.toContain("a11y-foco-invisible");
  });

  it("no confunde HTML dentro de un <script> con etiquetas reales", () => {
    const r = ids(`${LIMPIA.replace("</main>", "</main><script>const t = '<input type=text><h4>x</h4>';</script>")}`);
    expect(r).not.toContain("a11y-campo-sin-etiqueta");
    expect(r).not.toContain("seo-salto-encabezado");
  });

  it("agrupa repeticiones: 40 imágenes sin tamaño son un hallazgo, no cuarenta", () => {
    const imgs = Array.from({ length: 40 }, (_, i) => `<img src="${i}.jpg" alt="">`).join("");
    const a = auditarWeb(`<body>${imgs}</body>`);
    expect(a.hallazgos.filter((h) => h.id === "perf-img-sin-tamano")).toHaveLength(1);
  });

  it("el resumen lleva puntuaciones y el arreglo de cada hallazgo", () => {
    const txt = resumirAuditoria(auditarWeb("<body><h2>x</h2></body>"));
    expect(txt).toMatch(/SEO \d+/);
    expect(txt).toMatch(/→ /);
  });
});

describe("auditarWeb — HTML retorcido", () => {
  it("`</script >` con espacio también cierra el script", () => {
    const r = auditarWeb(`${LIMPIA.replace("</main>", "</main><script>const t = '<input type=text>';</script >")}`);
    expect(r.hallazgos.map((h) => h.id)).not.toContain("a11y-campo-sin-etiqueta");
  });
  it("un comentario sin cerrar no deja etiquetas vivas", () => {
    const r = auditarWeb(`${LIMPIA.replace("</main>", "</main><!-- <input type=text>")}`);
    expect(r.hallazgos.map((h) => h.id)).not.toContain("a11y-campo-sin-etiqueta");
  });
  it("las etiquetas partidas no sobreviven al contar texto visible", () => {
    const r = auditarWeb(`<body><a href="/x"><scr<b>ipt>aquí</a></body>`);
    expect(r.hallazgos.find((h) => h.id === "seo-enlace-generico")).toBeUndefined();
  });
});

describe("auditarWeb — cierres de script raros", () => {
  it("`</script\\t\\n foo>` también cierra", () => {
    const r = auditarWeb(`${LIMPIA.replace("</main>", "</main><script>const t = '<input type=text>';</script\t\n foo>")}`);
    expect(r.hallazgos.map((h) => h.id)).not.toContain("a11y-campo-sin-etiqueta");
  });
  it("un script sin cerrar se lleva el resto (era código)", () => {
    const r = auditarWeb(`${LIMPIA.replace("</main>", "</main><script>const t = '<input type=text>';")}`);
    expect(r.hallazgos.map((h) => h.id)).not.toContain("a11y-campo-sin-etiqueta");
  });
  it("<scripts> o <styled-x> no son <script>/<style>", () => {
    const r = auditarWeb(`<body><styled-x><input type="text"></styled-x></body>`);
    expect(r.hallazgos.map((h) => h.id)).toContain("a11y-campo-sin-etiqueta");
  });
});
