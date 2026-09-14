/** Prism AI — Captura real de la vista previa, para el QA por visión.
 *
 * `generico.ts` / `visual-qa.ts` MIDEN el DOM (números, no píxeles). Esto
 * SACA UNA FOTO de verdad: la única forma de que un modelo con visión vea
 * lo que vería un usuario —jerarquía, alineación, composición— que ningún
 * selector puede medir.
 *
 * Mismo problema de origen que `visual-qa.ts`: el iframe corre con
 * `sandbox` SIN `allow-same-origin`, así que no hay forma de leer su
 * `contentDocument` desde fuera ni de dibujarlo con un `html2canvas` que
 * viva en el padre. La captura se hace DESDE DENTRO, con lo que ya da el
 * navegador — cero librería, cero red, cero KB de más:
 *
 *   1. Serializar el documento a XML (`XMLSerializer`).
 *   2. Envolverlo en `<svg><foreignObject>`: un SVG es una imagen válida
 *      y su contenido HTML se pinta como se vería en la página.
 *   3. Cargar ese SVG (como `data:` URI) en una `Image` y dibujarla en un
 *      `<canvas>` del MISMO documento — nunca una imagen ajena sin CORS,
 *      que es justo lo que dejaría el canvas «contaminado».
 *   4. `canvas.toDataURL()` — funciona porque todo lo dibujado es propio.
 *
 * Probado contra la sandbox real (sin `allow-same-origin`, con gradiente,
 * sombra y fuente cargada por `<link>`): funciona.
 *
 * Límite honesto: un `<canvas>` con contenido pintado a mano (WebGL, 2D)
 * NO sale en la captura — `foreignObject` serializa el DOM, no el bitmap
 * que un canvas tiene pintado encima. El motor 3D (`prism-3d.js`) y
 * cualquier gráfico en canvas saldrán en blanco dentro de la foto. Es una
 * limitación real de la técnica, no un bug: se documenta aquí para que
 * nadie prometa lo que esto no puede dar.
 */

import { FX_ASENTAR } from "./efectos";

/** Mismo tope que `attachments.ts` (imágenes que sube el usuario): un lado
 * máximo de 1152 px y JPEG al 85%. La captura es para que un modelo la
 * MIRE, no para archivarla — más grande solo gasta tokens de visión sin
 * que se vea mejor. */
const LADO_MAXIMO = 1152;
const CALIDAD_JPEG = 0.85;

/** El capturador que corre DENTRO del iframe. Se dispara solo, poco
 * después de cargar (deja tiempo a que las fuentes y el layout asienten),
 * y manda el resultado por `postMessage` — el único canal que cruza un
 * sandbox sin `allow-same-origin`. No espera una petición: quien lo
 * inyecta ya sabe que lo quiere, así que no hace falta el ida-y-vuelta que
 * sí necesita el QA (que se puede pedir a varios anchos). */
export const SCREENSHOT_SCRIPT = `(function(){
if (window.__prismShot) return;
window.__prismShot = true;
${FX_ASENTAR}
function capturar(){
  var tocadosFx = null;
  try {
    // los efectos en su estado FINAL: si no, la foto sale a medio entrar
    // (opacity:0 esperando el scroll), que no es lo que vería un usuario.
    tocadosFx = asentarFx();
    var de = document.documentElement;
    var w = de.clientWidth;
    var h = Math.min(de.scrollHeight, w * 3); // tope: 3 pantallas, no la web entera
    var xml = new XMLSerializer().serializeToString(de);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' +
      '<foreignObject width="100%" height="100%">' + xml + '</foreignObject></svg>';
    var svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    var img = new Image();
    img.onload = function(){
      try {
        var escala = Math.min(1, ${LADO_MAXIMO} / w);
        var outW = Math.max(1, Math.round(w * escala));
        var outH = Math.max(1, Math.round(h * escala));
        var canvas = document.createElement('canvas');
        canvas.width = outW; canvas.height = outH;
        var ctx = canvas.getContext('2d');
        // El SVG que compone el foreignObject no hereda el fondo por
        // defecto del navegador (blanco): sin rellenar antes, lo que era
        // transparente sale NEGRO al exportar a JPEG (sin canal alfa, el
        // relleno de lo transparente es negro, no blanco) — una página
        // "normal" sin color de fondo explícito salía casi toda negra, con
        // el texto por defecto (negro) invisible encima. Se rellena con el
        // fondo real de la página (o blanco si también es transparente)
        // ANTES de dibujar encima.
        var fondo = getComputedStyle(document.body).backgroundColor;
        if (!fondo || fondo === 'rgba(0, 0, 0, 0)' || fondo === 'transparent') {
          fondo = getComputedStyle(document.documentElement).backgroundColor;
        }
        if (!fondo || fondo === 'rgba(0, 0, 0, 0)' || fondo === 'transparent') {
          fondo = '#ffffff';
        }
        ctx.fillStyle = fondo;
        ctx.fillRect(0, 0, outW, outH);
        ctx.drawImage(img, 0, 0, w, h, 0, 0, outW, outH);
        var dataUrl = canvas.toDataURL('image/jpeg', ${CALIDAD_JPEG});
        if (tocadosFx) desasentarFx(tocadosFx);
        parent.postMessage({ type: 'prism-shot-result', ok: true, dataUrl: dataUrl }, '*');
      } catch (e) {
        if (tocadosFx) desasentarFx(tocadosFx);
        parent.postMessage({ type: 'prism-shot-result', ok: false, error: String((e && e.message) || e) }, '*');
      }
    };
    img.onerror = function(){
      if (tocadosFx) desasentarFx(tocadosFx);
      parent.postMessage({ type: 'prism-shot-result', ok: false, error: 'No se pudo componer la imagen de la página.' }, '*');
    };
    img.src = svgUrl;
  } catch (e) {
    if (tocadosFx) desasentarFx(tocadosFx);
    parent.postMessage({ type: 'prism-shot-result', ok: false, error: String((e && e.message) || e) }, '*');
  }
}
function auto(){ setTimeout(capturar, 400); }
if (document.readyState === "complete") auto();
else window.addEventListener("load", auto);
})();`;

/** Inyecta el capturador en el HTML de la vista previa (idempotente). */
export function injectScreenshot(html: string): string {
  if (!html || html.includes("prism-shot-result")) return html;
  const tag = `<script>${SCREENSHOT_SCRIPT}</script>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tag}</body>`);
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${tag}</html>`);
  return html + tag;
}

/** El prompt que acompaña la captura al modelo con visión. Genérico a
 * propósito: sirve para cualquier página, no solo para una queja concreta. */
export function promptCritica(foco?: string): string {
  return [
    "Esto es una captura real de la página que se acaba de generar o editar — no una descripción, la imagen tal cual se ve.",
    "Mírala como lo haría un diseñador revisando el trabajo de otra persona: jerarquía, alineación, espaciado, contraste, composición, algo que se vea roto, cortado o genérico.",
    foco ? `Presta especial atención a: ${foco}.` : "",
    "Sé concreto: qué ves exactamente y dónde. Si no encuentras ningún problema real, dilo — no inventes uno para tener algo que decir.",
  ]
    .filter(Boolean)
    .join("\n");
}
