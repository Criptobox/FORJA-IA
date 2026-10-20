/** Forja IA — Despliegue estático sin servidor ni cuenta externa.
 *
 * El HTML autocontenido que ya arma `buildRunHtml` (todo inlineado: CSS, JS,
 * imágenes en data URLs) viaja comprimido en el FRAGMENTO (`#`) de la URL de
 * `/d`. Un fragmento nunca se manda al servidor —ni al de Forja ni a ningún
 * proxy intermedio—, así que "desplegar" no necesita subir nada a ningún
 * sitio: el propio enlace ES el sitio. Abrirlo basta para "montarlo", sin
 * repo de GitHub, sin cuenta de hosting, sin backend nuevo que mantener.
 *
 * Trade-off asumido a propósito, no un descuido: el enlace es largo (lleva
 * el sitio entero dentro) y Forja no lo recuerda en ningún sitio — perder el
 * enlace es perder el despliegue. A cambio, funciona en el acto para
 * cualquiera que lo abra, sin que exista ningún servidor de por medio que
 * pueda caerse o dejar de pagarse.
 */

/** Tope del fragmento ya codificado (base64url del HTML comprimido). No es un
 * límite técnico exacto —navegadores y redes distintos cortan en puntos
 * distintos—, es un margen de seguridad bajo el que un enlace se comparte
 * sin problemas por chat/email; por encima, mejor Repo Studio + GitHub Pages
 * (`src/lib/forja/deploy.ts`), pensado para sitios más grandes. */
export const MAX_FRAGMENT_BYTES = 1_800_000;

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const withPad = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  const bin = atob(withPad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export interface DeployEncodeResult {
  /** Lo que va después del `#` en la URL de `/d`. */
  fragment: string;
  /** Tamaño del fragmento ya codificado, para poder avisar si pesa mucho. */
  bytes: number;
  tooLarge: boolean;
}

/** HTML autocontenido → fragmento para `/d#<fragmento>`. */
export async function encodeDeploy(html: string): Promise<DeployEncodeResult> {
  const compressed = await gzip(new TextEncoder().encode(html));
  const fragment = bytesToBase64Url(compressed);
  return { fragment, bytes: fragment.length, tooLarge: fragment.length > MAX_FRAGMENT_BYTES };
}

/** Fragmento de `/d#<fragmento>` → el HTML autocontenido original. */
export async function decodeDeploy(fragment: string): Promise<string> {
  const compressed = base64UrlToBytes(fragment);
  const bytes = await gunzip(compressed);
  return new TextDecoder().decode(bytes);
}
