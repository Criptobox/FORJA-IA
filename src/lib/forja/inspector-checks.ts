/** Forja IA — Reglas del Inspector Visual: QA de interfaz medida, no mirada.
 *
 * El Inspector recorre el DOM vivo y juzga cinco reglas. Las reglas viven AQUÍ
 * (puras, sobre una descripción mínima del elemento) y el DOM vive en el
 * componente: así las reglas se prueban en vitest con elementos falsos, sin
 * jsdom ni navegador, y el componente solo hace de traductor.
 *
 * Las cinco reglas y su porqué:
 *  1. sin-nombre-accesible (alta): un botón sin nombre es un botón que grita
 *     «botón» al lector de pantalla. WCAG 4.1.2.
 *  2. imagen-sin-alt (alta): una imagen sin alt ni vacío explícito es ruido
 *     sin interpretar. WCAG 1.1.1. (alt="" es válido: decorativa declarada.)
 *  3. fuera-viewport (media): contenido real que se sale de la pantalla y
 *     NADIE lo recorta — el mismo criterio que responsive.spec.ts mide en e2e.
 *  4. contraste-bajo (media/alta): texto que no llega a AA 4.5:1 (3:1 si es
 *     grande), medido con las funciones de design-tokens. WCAG 1.4.3.
 *  5. toque-pequeno (baja): objetivo clicable menor de 24×24 px. WCAG 2.5.8.
 *
 * Lo que NO hace a propósito: no puntuar ni estimar. O mide, o no está.
 */
import {
  ratioContraste,
  esTextoGrande,
  WCAG,
  type Rgb,
} from "@/lib/design-tokens";

/** La porción mínima del DOM que una regla necesita. El componente la arma
 *  con getBoundingClientRect/getComputedStyle; los tests la escriben a mano. */
export interface ElementoInspeccionable {
  /** tagName en mayúsculas: "BUTTON", "IMG", "DIV"… */
  etiqueta: string;
  /** role explícito (getAttribute("role")) o null */
  rol: string | null;
  /** aria-label, title o texto propio ya normalizado; "" si no hay */
  nombreAccesible: string;
  esImagen: boolean;
  /** atributo alt crudo: null = AUSENTE (alt="" es string vacío, distinto) */
  alt: string | null;
  /** es objetivo interactivo real: botón, enlace, role clickeable */
  clickeable: boolean;
  rect: { left: number; right: number; top: number; bottom: number };
  /** un ancestro con overflow distinto de visible recorta lo que se salga */
  recortado: boolean;
  /** color computado de texto y fondo efectivo (rgb()/hex); null = no medible */
  colorTexto: string | null;
  colorFondo: string | null;
  /** tamaño tipográfico en px y peso (para decidir «texto grande») */
  px: number;
  peso: number;
  /** ¿tiene nodos de texto propios? (el contraste se mide solo en texto real,
   *  no en contenedores que heredan lo que otro pinta) */
  textoDirecto: boolean;
  /** pista corta para el humano que lee el hallazgo */
  pista: string;
}

export type Severidad = "alta" | "media" | "baja";

export interface HallazgoInspector {
  regla: ReglaId;
  severidad: Severidad;
  /** qué elemento y por qué, en una línea */
  detalle: string;
}

export type ReglaId =
  | "sin-nombre-accesible"
  | "imagen-sin-alt"
  | "fuera-viewport"
  | "contraste-bajo"
  | "toque-pequeno";

export interface ResumenInspector {
  hallazgos: HallazgoInspector[];
  /** conteo por regla, para los chips de cabecera */
  porRegla: Record<ReglaId, number>;
  porSeveridad: Record<Severidad, number>;
  /** elementos examinados (con los que las reglas aplicables cuentan) */
  examinados: number;
}

const REGLAS: Record<ReglaId, { severidad: Severidad; titulo: string; explicacion: string }> = {
  "sin-nombre-accesible": {
    severidad: "alta",
    titulo: "Sin nombre accesible",
    explicacion: "Botones y enlaces sin aria-label ni texto: el lector de pantalla solo dice «botón».",
  },
  "imagen-sin-alt": {
    severidad: "alta",
    titulo: "Imagen sin alt",
    explicacion: "Imagen sin atributo alt (alt=\"\" vale: decorativa declarada).",
  },
  "fuera-viewport": {
    severidad: "media",
    titulo: "Fuera de la pantalla",
    explicacion: "Elemento que se sale del viewport y ningún ancestro lo recorta.",
  },
  "contraste-bajo": {
    severidad: "media",
    titulo: "Contraste bajo",
    explicacion: "Texto que no llega a AA 4.5:1 (3:1 si es texto grande), medido con los tokens WCAG.",
  },
  "toque-pequeno": {
    severidad: "baja",
    titulo: "Objetivo pequeño",
    explicacion: "Objetivo clicable menor de 24×24 px (WCAG 2.5.8).",
  },
};

export function reglasInspector(): Array<{
  id: ReglaId;
  severidad: Severidad;
  titulo: string;
  explicacion: string;
}> {
  return (Object.keys(REGLAS) as ReglaId[]).map((id) => ({ id, ...REGLAS[id] }));
}

const MIN_OBJETIVO = 24;

function fueraDelViewport(
  rect: ElementoInspeccionable["rect"],
  ancho: number,
  alto: number
): boolean {
  // tolerancia de 1px: los bordes redondeados y las sombras no son desbordes
  return (
    rect.right > ancho + 1 ||
    rect.left < -1 ||
    rect.bottom > alto + 1 ||
    rect.top < -1
  );
}

/** Audita una lista de elementos contra las cinco reglas. */
export function inspeccionar(
  elementos: ElementoInspeccionable[],
  viewport: { ancho: number; alto: number }
): ResumenInspector {
  const hallazgos: HallazgoInspector[] = [];
  const porRegla = Object.fromEntries(
    (Object.keys(REGLAS) as ReglaId[]).map((id) => [id, 0])
  ) as Record<ReglaId, number>;
  const porSeveridad: Record<Severidad, number> = { alta: 0, media: 0, baja: 0 };

  for (const el of elementos) {
    // 1. sin nombre accesible
    if (el.clickeable && el.nombreAccesible.trim() === "") {
      hallazgos.push({
        regla: "sin-nombre-accesible",
        severidad: REGLAS["sin-nombre-accesible"].severidad,
        detalle: `<${el.etiqueta.toLowerCase()}> clickeable sin aria-label ni texto ${el.pista}`,
      });
    }

    // 2. imagen sin alt (alt="" es válido: decorativa declarada)
    if (el.esImagen && el.alt === null) {
      hallazgos.push({
        regla: "imagen-sin-alt",
        severidad: REGLAS["imagen-sin-alt"].severidad,
        detalle: `<img> sin atributo alt ${el.pista}`,
      });
    }

    // 3. fuera de viewport (solo si nadie lo recorta)
    if (!el.recortado && fueraDelViewport(el.rect, viewport.ancho, viewport.alto)) {
      hallazgos.push({
        regla: "fuera-viewport",
        severidad: REGLAS["fuera-viewport"].severidad,
        detalle: `<${el.etiqueta.toLowerCase()}> pinta fuera de ${Math.round(viewport.ancho)}×${Math.round(viewport.alto)} ${el.pista}`,
      });
    }

    // 4. contraste: SOLO con texto propio y colores medibles
    if (
      el.textoDirecto &&
      el.colorTexto &&
      el.colorFondo &&
      el.px > 0
    ) {
      const ratio = ratioContraste(el.colorTexto, el.colorFondo);
      if (ratio !== null) {
        const grande = esTextoGrande(el.px, el.peso >= 700);
        const umbral = grande ? WCAG.AA_TEXTO_GRANDE : WCAG.AA_TEXTO;
        if (ratio < umbral) {
          hallazgos.push({
            regla: "contraste-bajo",
            // no llega ni al piso de componentes 3:1: es grave
            severidad: ratio < WCAG.AA_COMPONENTE ? "alta" : "media",
            detalle: `<${el.etiqueta.toLowerCase()}> ${el.px}px ratio ${ratio.toFixed(2)}:1 < ${umbral}:1 ${el.pista}`,
          });
        }
      }
    }

    // 5. objetivo de toque pequeño
    if (el.clickeable) {
      const anchoObj = Math.abs(el.rect.right - el.rect.left);
      const altoObj = Math.abs(el.rect.bottom - el.rect.top);
      if (anchoObj > 0 && altoObj > 0 && (anchoObj < MIN_OBJETIVO || altoObj < MIN_OBJETIVO)) {
        hallazgos.push({
          regla: "toque-pequeno",
          severidad: REGLAS["toque-pequeno"].severidad,
          detalle: `<${el.etiqueta.toLowerCase()}> ${Math.round(anchoObj)}×${Math.round(altoObj)} px < ${MIN_OBJETIVO}×${MIN_OBJETIVO} ${el.pista}`,
        });
      }
    }
  }

  for (const h of hallazgos) {
    porRegla[h.regla] += 1;
    porSeveridad[h.severidad] += 1;
  }

  return { hallazgos, porRegla, porSeveridad, examinados: elementos.length };
}

/** Color rgb()/rgba() computado → hex opaco, o null si trae alfa < 1
 *  (sobre un fondo semitransparente el contraste depende de lo que haya
 *  debajo; medirlo aquí sería inventar un número). */
export function colorOpaco(css: string): string | null {
  const c = css.trim().toLowerCase();
  if (c === "transparent" || c === "") return null;
  const rgba = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(c);
  if (rgba) {
    const alfa = rgba[4] === undefined ? 1 : Number(rgba[4]);
    if (alfa < 0.99) return null;
    const rgb: Rgb = { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]) };
    return `#${[rgb.r, rgb.g, rgb.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }
  // #rgb / #rrggbb pasan tal cual (las funciones de tokens ya las entienden)
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/.test(c) ? c : null;
}
