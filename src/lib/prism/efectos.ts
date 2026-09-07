/** Prism AI — El kit de efectos, y a quién pertenece cada uno.
 *
 * Una página generada por un modelo se nota a un kilómetro: los bloques están
 * bien, el color está bien, y aun así parece una maqueta. Lo que falta casi
 * siempre es lo mismo —textura, entrada, un gesto al pasar el ratón—, y no lo
 * escribe ningún modelo por su cuenta porque cuesta código y no se lo pides.
 *
 * ——— Por qué un kit propio y no una librería por CDN ———
 *
 * Porque la página acaba en tres sitios donde un CDN es un problema:
 *
 *  1. La vista previa, un iframe con `srcdoc` y SIN `allow-same-origin`. El
 *     script externo carga, sí, hasta el día que no: CDN caído, red que lo
 *     bloquea, avión. Y entonces la página se ve rota sin decir por qué —
 *     Prism no sabe distinguir «tu código falla» de «no cargó la librería».
 *  2. El ZIP que te descargas, que tiene que abrirse con doble clic y ya.
 *  3. Tu GitHub Pages, donde una dependencia de terceros es tuya para siempre.
 *
 * El kit son dos archivos de ~5 KB que VIAJAN con el proyecto. Sin red, sin
 * versiones que se rompen, sin licencias que explicar.
 *
 * ——— Por qué atados a la dirección visual ———
 *
 * Un catálogo de efectos suelto produce el mismo AI-slop, solo que con brillo:
 * todas las páginas con el mismo desvanecido al hacer scroll. Aquí cada
 * dirección declara los suyos y los que tiene PROHIBIDOS — un neobrutalismo
 * con desvanecidos suaves deja de ser neobrutalismo, y un editorial con
 * inclinación 3D es una web de plantilla.
 */
import { FX_CSS, FX_JS } from "./efectos-datos";

export { FX_CSS, FX_JS } from "./efectos-datos";

/** Los nombres con los que el kit viaja en el proyecto. */
export const FX_CSS_PATH = "prism-fx.css";
export const FX_JS_PATH = "prism-fx.js";

/** Cuántos efectos como mucho por página. Con más, todo se mueve y nada
 * destaca — que es el fallo opuesto al que esto viene a arreglar. */
export const MAX_EFECTOS = 4;

export interface Efecto {
  id: string;
  /** cómo se pone, en una línea: es lo único que el modelo necesita saber */
  uso: string;
  /** solo CSS (no necesita el .js) */
  soloCss?: boolean;
}

/** El catálogo entero. El `uso` es literalmente lo que viaja al modelo, así
 * que se escribe corto: cada carácter se paga en cada generación de UI. */
export const EFECTOS: readonly Efecto[] = [
  { id: "reveal", uso: 'data-fx="reveal" en una sección: entra al hacer scroll' },
  { id: "stagger", uso: 'data-fx="stagger" en un contenedor: sus hijos entran en cascada' },
  { id: "split", uso: 'data-fx="split" en un titular: entra palabra a palabra' },
  { id: "pop", uso: 'data-fx="pop": entrada a corte seco, sin desvanecido' },
  { id: "tilt", uso: 'data-fx="tilt" en una tarjeta: se inclina en 3D con el puntero' },
  { id: "magnetic", uso: 'data-fx="magnetic" en un botón: se acerca al cursor' },
  { id: "spotlight", uso: 'data-fx="spotlight" en un panel: halo que sigue al cursor' },
  { id: "count", uso: 'data-fx="count" data-fx-to="1200" en una cifra: cuenta al verse' },
  { id: "parallax", uso: 'data-fx="parallax" data-fx-vel="0.15": se mueve más lento al scroll' },
  { id: "marquee", uso: 'class="fx-marquee" con el contenido DUPLICADO dentro', soloCss: true },
  { id: "noise", uso: 'class="fx-noise" en una sección: grano de papel encima', soloCss: true },
  { id: "mesh", uso: 'class="fx-mesh": fondo de gradientes suaves del color actual', soloCss: true },
  { id: "grid", uso: 'class="fx-grid" o "fx-dots": retícula técnica de fondo', soloCss: true },
  { id: "underline", uso: 'class="fx-underline" en enlaces: el subrayado se dibuja', soloCss: true },
  { id: "sheen", uso: 'class="fx-sheen" en un botón: destello que lo cruza al hover', soloCss: true },
  { id: "float", uso: 'class="fx-float": flota despacio en bucle', soloCss: true },
  { id: "blob", uso: 'class="fx-blob" en una imagen: máscara orgánica que respira', soloCss: true },
];

const POR_ID = new Map(EFECTOS.map((e) => [e.id, e]));

export function efectoPorId(id: string): Efecto | null {
  return POR_ID.get(id) ?? null;
}

/** Qué efectos son de cada dirección visual, y cuáles la romperían.
 *
 * Lo prohibido importa tanto como lo permitido: sin la lista negra el modelo
 * mete el desvanecido suave en todas partes, porque es lo que ha visto un
 * millón de veces. */
export const EFECTOS_POR_DIRECCION: Record<
  string,
  { usa: readonly string[]; evita: readonly string[] }
> = {
  editorial: {
    usa: ["reveal", "stagger", "split", "underline", "parallax", "noise"],
    evita: ["tilt", "spotlight", "sheen", "float", "mesh", "marquee"],
  },
  minimal: {
    usa: ["reveal", "stagger", "count", "underline", "float"],
    evita: ["marquee", "noise", "tilt", "spotlight", "sheen", "pop"],
  },
  tech: {
    usa: ["reveal", "count", "spotlight", "sheen", "grid", "tilt"],
    evita: ["float", "blob", "noise", "split", "marquee"],
  },
  brutalista: {
    usa: ["pop", "marquee", "tilt", "sheen", "split"],
    evita: ["reveal", "float", "blob", "spotlight", "mesh", "noise"],
  },
  calido: {
    usa: ["reveal", "stagger", "float", "blob", "noise", "parallax"],
    evita: ["marquee", "grid", "spotlight", "sheen", "pop", "tilt"],
  },
};

export interface EfectosDeDireccion {
  usa: Efecto[];
  evita: string[];
}

/** Los efectos de una dirección. Una dirección que no esté en el mapa se
 * queda SIN efectos en vez de heredar unos genéricos: repartir a ojo es
 * exactamente lo que hace que todas las páginas se parezcan. */
export function efectosDe(direccionId: string): EfectosDeDireccion {
  const m = EFECTOS_POR_DIRECCION[direccionId];
  if (!m) return { usa: [], evita: [] };
  return {
    usa: m.usa.map((id) => POR_ID.get(id)).filter((e): e is Efecto => e != null),
    evita: [...m.evita],
  };
}

/** El bloque que viaja en el prompt de sistema cuando el encargo es de UI.
 *
 * El modelo NO escribe el kit: lo enlaza y ya. Escribirlo costaría ~2.500
 * tokens de salida por respuesta, saldría distinto cada vez y con erratas.
 * Prism añade los dos archivos al proyecto por su cuenta. */
export function promptEfectos(direccionId: string): string {
  const { usa, evita } = efectosDe(direccionId);
  if (!usa.length) return "";
  return [
    "## EFECTOS (kit local, ya incluido — NO lo escribas)",
    `Enlaza <link rel="stylesheet" href="${FX_CSS_PATH}"> y <script src="${FX_JS_PATH}" defer></script>: Prism añade los dos archivos al proyecto. Nunca uses librerías de animación por CDN.`,
    `Usa entre 2 y ${MAX_EFECTOS} de estos, los que la página pida — no todos:`,
    ...usa.map((e) => `- ${e.uso}`),
    `PROHIBIDOS en esta dirección (romperían su mundo visual): ${evita.join(", ")}.`,
    "Todo se ve sin JavaScript y se apaga solo con prefers-reduced-motion: no pongas opacity:0 a mano para animar.",
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* medir una página con efectos                                       */
/* ------------------------------------------------------------------ */

/** Deja el kit en su estado FINAL antes de medir o de pulsar botones.
 *
 * Esto no es un adorno, es lo que evita que los efectos degraden dos
 * comprobaciones que ya existían. El QA visual y el barrido de botones
 * ignoran a propósito lo que tiene `opacity: 0` —no se mide lo que no se
 * ve—, y una sección que aún no ha entrado por scroll está exactamente así.
 * Sin esto, una página con efectos se revisaría solo en el primer pantallazo
 * y el informe diría «sin problemas» de lo que nunca miró: el peor resultado
 * posible, porque parece una comprobación y no lo es.
 *
 * Se marcan todos los `[data-fx]` como ya entrados, con las transiciones
 * apagadas (`fx-medir`) para que el estilo calculado sea el final YA: con la
 * transición corriendo, medir justo después seguiría leyendo opacidad 0.
 *
 * Y se deshace: `desasentarFx` devuelve la página como estaba. El QA se
 * ejecuta solo en cada vista previa, y sin deshacerlo el usuario nunca vería
 * sus propios efectos — se los habría revelado el medidor. Medir no puede
 * cambiar lo medido. */
export const FX_ASENTAR = `function asentarFx(){var t=[];try{document.documentElement.classList.add("fx-medir");var n=document.querySelectorAll("[data-fx]");for(var i=0;i<n.length;i++){if(!n[i].classList.contains("fx-in")){n[i].classList.add("fx-in");t.push(n[i]);}}}catch(e){}return t;}
function desasentarFx(t){try{document.documentElement.classList.remove("fx-medir");for(var i=0;i<t.length;i++)t[i].classList.remove("fx-in");}catch(e){}}`;

/* ------------------------------------------------------------------ */
/* que el kit viaje con el proyecto                                   */
/* ------------------------------------------------------------------ */

/** ¿Alguno de los archivos enlaza el kit? Acepta las tres formas en que un
 * modelo escribe una ruta hermana: `prism-fx.css`, `./prism-fx.css`,
 * `/prism-fx.css`. */
export function usaKit(textos: readonly string[]): { css: boolean; js: boolean } {
  const todo = textos.join("\n");
  return {
    css: new RegExp(`["'(/.]${FX_CSS_PATH}`).test(todo),
    js: new RegExp(`["'(/.]${FX_JS_PATH}`).test(todo),
  };
}

/** Añade al proyecto los archivos del kit que se enlazan y no están.
 *
 * Nunca pisa un archivo que ya venga: si el modelo escribió el suyo (o el
 * usuario lo editó en el Sandbox), manda el suyo. Esto rellena huecos, no
 * impone. */
export function conKit(files: Record<string, string>): Record<string, string> {
  const { css, js } = usaKit(Object.values(files));
  const falta: Record<string, string> = {};
  if (css && files[FX_CSS_PATH] == null) falta[FX_CSS_PATH] = FX_CSS;
  if (js && files[FX_JS_PATH] == null) falta[FX_JS_PATH] = FX_JS;
  if (!Object.keys(falta).length) return files;
  return { ...files, ...falta };
}

/** Los nombres del kit que faltan, para el que trabaja con listas de archivos
 * en vez de con un mapa. */
export function faltanDelKit(
  rutas: readonly string[],
  textos: readonly string[]
): { path: string; text: string }[] {
  const { css, js } = usaKit(textos);
  const out: { path: string; text: string }[] = [];
  if (css && !rutas.includes(FX_CSS_PATH)) out.push({ path: FX_CSS_PATH, text: FX_CSS });
  if (js && !rutas.includes(FX_JS_PATH)) out.push({ path: FX_JS_PATH, text: FX_JS });
  return out;
}
