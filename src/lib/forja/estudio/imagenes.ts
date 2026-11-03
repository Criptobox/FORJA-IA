/** FORJA IA — Estudio de diseño: preparar imágenes de referencia (navegador).
 *
 * Toda imagen que entra en la Biblioteca se reduce (lado máximo 1024 px,
 * JPEG 85%): es lo que se adjunta a un modelo con visión — más grande solo
 * gasta tokens — y lo que se guarda en IndexedDB. De paso se saca su paleta. */

import { paletaDePixeles } from "./biblioteca";

export const LADO_REFERENCIA = 1024;

export interface ImagenPreparada {
  dataUrl: string;
  ancho: number;
  alto: number;
  paleta: string[];
}

function cargar(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => mal(new Error("No se pudo leer la imagen"));
    im.src = src;
  });
}

/** Reduce, recodifica y extrae la paleta de una imagen (data URL o blob URL). */
export async function prepararImagen(src: string, lado = LADO_REFERENCIA): Promise<ImagenPreparada> {
  const im = await cargar(src);
  const z = Math.min(1, lado / Math.max(im.naturalWidth, im.naturalHeight));
  const ancho = Math.max(1, Math.round(im.naturalWidth * z));
  const alto = Math.max(1, Math.round(im.naturalHeight * z));
  const c = document.createElement("canvas");
  c.width = ancho;
  c.height = alto;
  const g = c.getContext("2d");
  if (!g) throw new Error("El navegador no deja dibujar la imagen");
  g.fillStyle = "#ffffff"; // lo transparente sale blanco en JPEG, no negro
  g.fillRect(0, 0, ancho, alto);
  g.drawImage(im, 0, 0, ancho, alto);
  // paleta sobre una versión diminuta: 48 px bastan y es instantáneo
  const p = document.createElement("canvas");
  p.width = p.height = 48;
  const gp = p.getContext("2d");
  let paleta: string[] = [];
  if (gp) {
    gp.drawImage(im, 0, 0, 48, 48);
    paleta = paletaDePixeles(gp.getImageData(0, 0, 48, 48).data);
  }
  return { dataUrl: c.toDataURL("image/jpeg", 0.85), ancho, alto, paleta };
}

/** Un `File` (input de archivo) → data URL. */
export function leerArchivo(f: Blob): Promise<string> {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => mal(new Error("No se pudo leer el archivo"));
    r.readAsDataURL(f);
  });
}
