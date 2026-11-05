/** FORJA IA — Estudio de diseño: todo el lienzo en UN PNG («lámina»).
 *
 * Una imagen con todas las pantallas del proyecto una junto a otra, cada una
 * con su nombre debajo: lo que se pega en un chat, una presentación o un
 * ticket sin mandar un ZIP. Cada pantalla se captura con el mismo capturador
 * aislado de siempre (`captura.ts`); aquí solo se COLOCAN y se dibujan.
 *
 * La disposición es pura (se prueba sin navegador); dibujar necesita un
 * <canvas>, así que `componerLamina` solo corre en el navegador. */

export interface Tamano {
  ancho: number;
  alto: number;
}

export interface Celda {
  /** esquina de la IMAGEN (el rótulo va justo debajo) */
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export interface Disposicion {
  ancho: number;
  alto: number;
  celdas: Celda[];
}

export interface OpcionesDisposicion {
  columnas: number;
  margen: number;
  hueco: number;
  /** alto de la franja del título, arriba */
  cabecera: number;
  /** alto del rótulo bajo cada pantalla */
  pie: number;
}

/** Lado máximo de la imagen final. Los navegadores limitan el <canvas>
 * (≈16.000 px y un área total); por encima se reduce todo en proporción en
 * vez de fallar sin decir nada. */
export const LADO_MAXIMO = 8000;

/** Cuántas pantallas caben por fila: las estrechas (móvil) más juntas, las
 * anchas (escritorio) de menos en menos para que la lámina no se haga
 * enorme. Nunca más columnas que pantallas. */
export function columnasPara(cuantas: number, anchoDispositivo: number): number {
  const max = anchoDispositivo <= 480 ? 4 : anchoDispositivo <= 900 ? 3 : 2;
  return Math.max(1, Math.min(cuantas, max));
}

/** Coloca las pantallas en filas, de izquierda a derecha y de arriba abajo.
 * Una fila mide lo que la más alta de sus pantallas; cada columna, lo que la
 * más ancha de las suyas. */
export function disposicionLamina(tamanos: Tamano[], o: OpcionesDisposicion): Disposicion {
  const cols = Math.max(1, Math.floor(o.columnas));
  const filas = Math.ceil(tamanos.length / cols);
  const anchoCol = Array.from({ length: cols }, () => 0);
  const altoFila = Array.from({ length: filas }, () => 0);
  tamanos.forEach((t, i) => {
    const c = i % cols;
    const f = Math.floor(i / cols);
    anchoCol[c] = Math.max(anchoCol[c], t.ancho);
    altoFila[f] = Math.max(altoFila[f], t.alto);
  });

  const xCol: number[] = [];
  let x = o.margen;
  for (const a of anchoCol) {
    xCol.push(x);
    x += a + o.hueco;
  }
  const yFila: number[] = [];
  let y = o.margen + o.cabecera;
  for (const a of altoFila) {
    yFila.push(y);
    y += a + o.pie + o.hueco;
  }

  const celdas = tamanos.map((t, i) => ({
    x: xCol[i % cols],
    y: yFila[Math.floor(i / cols)],
    ancho: t.ancho,
    alto: t.alto,
  }));
  const usados = tamanos.length ? Math.min(cols, tamanos.length) : 0;
  const anchoUtil = anchoCol.slice(0, usados).reduce((a, b) => a + b, 0) + Math.max(0, usados - 1) * o.hueco;
  const altoUtil = altoFila.reduce((a, b) => a + b + o.pie, 0) + Math.max(0, filas - 1) * o.hueco;
  return {
    ancho: Math.round(anchoUtil + o.margen * 2),
    alto: Math.round(altoUtil + o.margen * 2 + o.cabecera),
    celdas,
  };
}

/** Factor para que ningún lado pase de `LADO_MAXIMO` (1 = sin reducir). */
export function factorDeReduccion(ancho: number, alto: number, lado = LADO_MAXIMO): number {
  const mayor = Math.max(ancho, alto);
  return mayor > lado ? lado / mayor : 1;
}

export interface PantallaLamina {
  nombre: string;
  /** PNG de la pantalla, como data URL */
  dataUrl: string;
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer una de las capturas"));
    img.src = src;
  });
}

/** Recorta un texto con «…» hasta que quepa en `max` px (con la fuente ya
 * puesta en el contexto). */
function ajustar(ctx: CanvasRenderingContext2D, texto: string, max: number): string {
  if (ctx.measureText(texto).width <= max) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

/** Dibuja la lámina y devuelve el PNG. Solo en el navegador. */
export async function componerLamina(titulo: string, pantallas: PantallaLamina[], anchoDispositivo: number): Promise<Blob> {
  if (!pantallas.length) throw new Error("No hay pantallas que juntar");
  const imagenes = await Promise.all(pantallas.map((p) => cargarImagen(p.dataUrl)));

  // Las capturas salen al doble de nítidas: se trabaja en ESE tamaño y los
  // márgenes y el texto se escalan igual, así la lámina conserva la nitidez.
  const E = 2;
  const disp = disposicionLamina(
    imagenes.map((i) => ({ ancho: i.naturalWidth, alto: i.naturalHeight })),
    {
      columnas: columnasPara(pantallas.length, anchoDispositivo),
      margen: 48 * E,
      hueco: 32 * E,
      cabecera: 64 * E,
      pie: 40 * E,
    }
  );
  const k = factorDeReduccion(disp.ancho, disp.alto);

  const lienzo = document.createElement("canvas");
  lienzo.width = Math.max(1, Math.round(disp.ancho * k));
  lienzo.height = Math.max(1, Math.round(disp.alto * k));
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("El navegador no deja dibujar la imagen");
  ctx.scale(k, k);

  ctx.fillStyle = "#14151c";
  ctx.fillRect(0, 0, disp.ancho, disp.alto);

  const fuente = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f4f4f6";
  ctx.font = `700 ${22 * E}px ${fuente}`;
  ctx.fillText(ajustar(ctx, titulo, disp.ancho - 96 * E), 48 * E, 48 * E + 22 * E);
  ctx.fillStyle = "#ff8a3d";
  ctx.fillRect(48 * E, 48 * E + 34 * E, 36 * E, 3 * E);

  imagenes.forEach((img, i) => {
    const c = disp.celdas[i];
    const r = 14 * E;
    // sombra y esquinas redondeadas: la pantalla se lee como una tarjeta
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 24 * E;
    ctx.shadowOffsetY = 8 * E;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.roundRect(c.x, c.y, c.ancho, c.alto, r);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(c.x, c.y, c.ancho, c.alto, r);
    ctx.clip();
    ctx.drawImage(img, c.x, c.y, c.ancho, c.alto);
    ctx.restore();

    ctx.fillStyle = "#c9cad3";
    ctx.font = `600 ${15 * E}px ${fuente}`;
    ctx.fillText(ajustar(ctx, pantallas[i].nombre, c.ancho), c.x, c.y + c.alto + 26 * E);
  });

  return new Promise<Blob>((resolve, reject) =>
    lienzo.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo crear la imagen"))), "image/png")
  );
}
