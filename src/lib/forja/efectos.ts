/** Forja IA — El kit de efectos, y a quién pertenece cada uno.
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
 *     Forja no sabe distinguir «tu código falla» de «no cargó la librería».
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
import { FX3D_JS, FX_CSS, FX_JS } from "./efectos-datos";
import type { MedidasGenerico, SenaGenerica } from "./generico";

export { FX3D_JS, FX_CSS, FX_JS } from "./efectos-datos";

/** Los nombres con los que el kit viaja en el proyecto. */
export const FX_CSS_PATH = "forja-fx.css";
export const FX_JS_PATH = "forja-fx.js";
/** El motor 3D es un tercer archivo, aparte: es el único que pesa (WebGL de
 * verdad), así que solo se añade cuando algo lo enlaza — una landing tranquila
 * no tiene por qué cargar 12 KB de un motor que nunca usa. */
export const FX3D_JS_PATH = "forja-3d.js";

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
  {
    id: "pin",
    uso:
      'data-fx="pin" en una sección alta (height:300vh) con data-fx="pin-inner" dentro: se ancla al hacer scroll. [data-fx-step] en los hijos los revela en orden',
  },
  {
    id: "horizontal",
    uso:
      'data-fx="horizontal" con data-fx="horizontal-track" dentro (paneles en fila): el scroll vertical los desliza en horizontal',
  },
  {
    id: "cursor",
    uso: 'data-fx="cursor" en <body>: cursor propio. data-fx-cursor="Ver" en un hijo lo agranda con esa etiqueta',
  },
  {
    id: "scramble",
    uso: 'data-fx="scramble" en un titular corto: se revela con caracteres al azar antes de asentarse',
  },
  {
    id: "3d-particulas",
    uso: '<canvas data-fx3d="3d-particulas" class="fx-mesh">: partículas WebGL propias que reaccionan al cursor (tiñe con el CSS `color` del canvas)',
  },
  {
    id: "3d-malla",
    uso: '<canvas data-fx3d="3d-malla" class="fx-mesh">: un globo de líneas que gira despacio y sigue el cursor',
  },
  {
    id: "3d-shader",
    uso: '<canvas data-fx3d="3d-shader" class="fx-mesh">: fondo con un blob de gradiente fluido, sin geometría 3D',
  },
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
    // «pin»: la narrativa larga de una revista es justo lo que un scroll
    // anclado sabe contar — un reportaje, no un producto.
    usa: ["reveal", "stagger", "split", "underline", "parallax", "noise", "pin"],
    evita: [
      "tilt", "spotlight", "sheen", "float", "mesh", "marquee",
      "cursor", "scramble", "horizontal", "3d-particulas", "3d-malla", "3d-shader",
    ],
  },
  minimal: {
    usa: ["reveal", "stagger", "count", "underline", "float"],
    evita: [
      "marquee", "noise", "tilt", "spotlight", "sheen", "pop",
      "cursor", "scramble", "pin", "horizontal", "3d-particulas", "3d-malla", "3d-shader",
    ],
  },
  tech: {
    // el campo de partículas encaja con la estética de dashboard/red de datos.
    usa: ["reveal", "count", "spotlight", "sheen", "grid", "tilt", "cursor", "scramble", "3d-particulas"],
    evita: ["float", "blob", "noise", "split", "marquee", "pin", "horizontal", "3d-malla", "3d-shader"],
  },
  brutalista: {
    // el scroll horizontal a golpes y el texto que se «hackea» son bordes,
    // no elegancia — encajan con bloques que chocan entre sí.
    usa: ["pop", "marquee", "tilt", "sheen", "split", "horizontal", "scramble"],
    evita: [
      "reveal", "float", "blob", "spotlight", "mesh", "noise",
      "cursor", "pin", "3d-particulas", "3d-malla", "3d-shader",
    ],
  },
  calido: {
    usa: ["reveal", "stagger", "float", "blob", "noise", "parallax"],
    evita: [
      "marquee", "grid", "spotlight", "sheen", "pop", "tilt",
      "cursor", "scramble", "pin", "horizontal", "3d-particulas", "3d-malla", "3d-shader",
    ],
  },
  // La sexta dirección (`design-directions.ts`): la única con permiso de usar
  // el motor 3D, el cursor propio y el scroll narrativo a la vez. En las
  // otras cinco, cualquiera de estos rompería el mundo que ya tienen resuelto.
  experimental: {
    usa: ["cursor", "scramble", "pin", "horizontal", "3d-particulas", "3d-malla", "3d-shader", "tilt", "spotlight"],
    evita: ["marquee", "blob", "float", "noise", "underline", "pop"],
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
 * Forja añade los dos archivos al proyecto por su cuenta. */
export function promptEfectos(direccionId: string): string {
  const { usa, evita } = efectosDe(direccionId);
  if (!usa.length) return "";
  return [
    "## EFECTOS (kit local, ya incluido — NO lo escribas)",
    `Enlaza <link rel="stylesheet" href="${FX_CSS_PATH}"> y <script src="${FX_JS_PATH}" defer></script>: Forja añade los dos archivos al proyecto. Nunca uses librerías de animación por CDN.`,
    `Usa entre 2 y ${MAX_EFECTOS} de estos, los que la página pida — no todos:`,
    ...usa.map((e) => `- ${e.uso}`),
    `PROHIBIDOS en esta dirección (romperían su mundo visual): ${evita.join(", ")}.`,
    "Todo se ve sin JavaScript y se apaga solo con prefers-reduced-motion: no pongas opacity:0 a mano para animar.",
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* solo los efectos que SU dirección permite                          */
/* ------------------------------------------------------------------ */

/**
 * El prompt trae una lista negra por dirección (`EFECTOS_POR_DIRECCION`),
 * 2D y 3D por igual, pero eso solo se lo dice al modelo — nadie comprobaba
 * si le hacía caso. Esto mide la página YA PINTADA (`efectos2d`/`efectos3d`,
 * del mismo barrido que `generico.ts`) y compara contra lo que esa
 * dirección tiene prohibido de verdad, sea cual sea.
 *
 * Una sola función para las dos familias (antes eran dos, una por cada
 * una — puro efecto2D o motor 3D: la comparación es idéntica, solo cambia
 * de qué lista se lee, así que separarlas era duplicar sin motivo). El
 * texto de cada efecto prohibido sale del propio catálogo (`efectoPorId`),
 * no de una frase escrita a mano por familia.
 *
 * Devuelve `SenaGenerica[]` a propósito, con la misma forma que
 * `senasGenericas` — así se reutiliza tal cual todo el aviso/reintento del
 * bucle de auto-revisión (`promptDeGenerico`, `resumenGenerico`,
 * `avisoIntentosAgotados` de `generico.ts`), sin duplicar esa fontanería.
 */
export function senasEfectosFueraDeDireccion(
  m: MedidasGenerico,
  direccionId: string | null | undefined
): SenaGenerica[] {
  if (!direccionId) return [];
  const mapa = EFECTOS_POR_DIRECCION[direccionId];
  if (!mapa) return [];
  const presentes = [...m.efectos2d, ...m.efectos3d];
  const prohibidos = [...new Set(presentes.filter((id) => mapa.evita.includes(id)))];
  if (!prohibidos.length) return [];
  const usos = prohibidos.map((id) => `- ${id}: ${efectoPorId(id)?.uso ?? "efecto del kit"}`).join("\n");
  return [
    {
      id: "efecto-fuera-de-direccion",
      detalle: `Usa ${prohibidos.length === 1 ? "un efecto prohibido" : `${prohibidos.length} efectos prohibidos`} en la dirección "${direccionId}": ${prohibidos.join(", ")}.`,
      arreglo: `Esta dirección los tiene en su lista de prohibidos — rompen el mundo visual que ya tiene resuelto. Quítalos:\n${usos}`,
    },
  ];
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
 * modelo escribe una ruta hermana: `forja-fx.css`, `./forja-fx.css`,
 * `/forja-fx.css`. El motor 3D se detecta aparte: es el único de los tres que
 * pesa, así que solo se añade cuando de verdad hace falta. */
export function usaKit(textos: readonly string[]): { css: boolean; js: boolean; js3d: boolean } {
  const todo = textos.join("\n");
  return {
    css: new RegExp(`["'(/.]${FX_CSS_PATH}`).test(todo),
    js: new RegExp(`["'(/.]${FX_JS_PATH}`).test(todo),
    js3d: new RegExp(`["'(/.]${FX3D_JS_PATH}`).test(todo),
  };
}

/** Añade al proyecto los archivos del kit que se enlazan y no están.
 *
 * Nunca pisa un archivo que ya venga: si el modelo escribió el suyo (o el
 * usuario lo editó en el Sandbox), manda el suyo. Esto rellena huecos, no
 * impone. */
export function conKit(files: Record<string, string>): Record<string, string> {
  const { css, js, js3d } = usaKit(Object.values(files));
  const falta: Record<string, string> = {};
  if (css && files[FX_CSS_PATH] == null) falta[FX_CSS_PATH] = FX_CSS;
  if (js && files[FX_JS_PATH] == null) falta[FX_JS_PATH] = FX_JS;
  if (js3d && files[FX3D_JS_PATH] == null) falta[FX3D_JS_PATH] = FX3D_JS;
  if (!Object.keys(falta).length) return files;
  return { ...files, ...falta };
}

/** Los nombres del kit que faltan, para el que trabaja con listas de archivos
 * en vez de con un mapa. */
export function faltanDelKit(
  rutas: readonly string[],
  textos: readonly string[]
): { path: string; text: string }[] {
  const { css, js, js3d } = usaKit(textos);
  const out: { path: string; text: string }[] = [];
  if (css && !rutas.includes(FX_CSS_PATH)) out.push({ path: FX_CSS_PATH, text: FX_CSS });
  if (js && !rutas.includes(FX_JS_PATH)) out.push({ path: FX_JS_PATH, text: FX_JS });
  if (js3d && !rutas.includes(FX3D_JS_PATH)) out.push({ path: FX3D_JS_PATH, text: FX3D_JS });
  return out;
}
