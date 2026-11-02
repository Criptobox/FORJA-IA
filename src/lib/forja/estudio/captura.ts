/** FORJA IA — Estudio de diseño: exportar una pantalla a PNG.
 *
 * Reutiliza el capturador del QA por visión (`screenshot.ts`), que se hace la
 * foto DESDE DENTRO de un iframe aislado (sin `allow-same-origin`): el HTML
 * que escribió el modelo nunca corre con acceso a FORJA (ni a las claves del
 * localStorage). Aquí solo cambian las opciones: PNG, el doble de nítido y
 * más alto. Mismo límite honesto que allí: lo pintado en un <canvas> (3D,
 * gráficos) sale en blanco. */

import { scriptCaptura } from "../screenshot";

export const TIPO_CAPTURA = "forja-estudio-png";

/** El HTML con el capturador dentro (al final de <body>). */
export function htmlParaCaptura(html: string): string {
  const tag = `<script>${scriptCaptura({
    formato: "png",
    escalaMax: 2,
    ladoMaximo: 2600,
    altoPantallas: 8,
    tipoMensaje: TIPO_CAPTURA,
  })}</script>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${tag}</body>`);
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>(?![\s\S]*<\/html>)/i, `${tag}</html>`);
  return html + tag;
}

/** `data:image/png;base64,…` → bytes (para el ZIP o la descarga). */
export function dataUrlABytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Pinta el HTML en un iframe aislado fuera de la vista, a `ancho`×`alto`
 * de viewport, y devuelve el PNG como data URL. Solo en el navegador. */
export function capturarPng(html: string, ancho: number, alto: number, timeoutMs = 20_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const f = document.createElement("iframe");
    f.setAttribute("sandbox", "allow-scripts");
    f.setAttribute("aria-hidden", "true");
    f.tabIndex = -1;
    f.style.cssText = `position:fixed;left:-30000px;top:0;width:${ancho}px;height:${alto}px;border:0;pointer-events:none`;
    let reloj: ReturnType<typeof setTimeout> | null = null;
    const limpiar = () => {
      window.removeEventListener("message", onMsg);
      if (reloj) clearTimeout(reloj);
      f.remove();
    };
    function onMsg(e: MessageEvent) {
      if (e.source !== f.contentWindow) return;
      const d = e.data as { type?: string; ok?: boolean; dataUrl?: string; error?: string } | null;
      if (!d || d.type !== TIPO_CAPTURA) return;
      limpiar();
      if (d.ok && d.dataUrl) resolve(d.dataUrl);
      else reject(new Error(d.error || "No se pudo hacer la captura"));
    }
    window.addEventListener("message", onMsg);
    reloj = setTimeout(() => {
      limpiar();
      reject(new Error("La captura tardó demasiado"));
    }, timeoutMs);
    f.srcdoc = htmlParaCaptura(html);
    document.body.appendChild(f);
  });
}
