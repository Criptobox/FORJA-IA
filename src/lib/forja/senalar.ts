/** Forja IA — Señalar un elemento de la vista previa para pedirle un cambio a la IA.
 *
 * «Cambia el botón de abajo» obliga al modelo a adivinar cuál: hay tres
 * botones abajo, y el que el usuario ve no se llama «el de abajo» en el
 * código. Aquí se toca el elemento en la vista previa y viaja con el mensaje
 * lo que lo identifica sin ambigüedad: su etiqueta, un selector estable, el
 * texto visible y su HTML actual. El usuario solo escribe QUÉ quiere.
 *
 * En la conversación se ve como una etiqueta encima del mensaje (igual que
 * un documento adjunto); el bloque con el HTML solo lo lee el modelo.
 *
 * Lo que manda el iframe es de una página que no controlamos: se valida,
 * se recorta y se trata siempre como TEXTO (nunca se pinta como HTML).
 */

export interface ElementoSenalado {
  id: string;
  /** `button`, `section`… */
  etiqueta: string;
  /** selector estable (id o ruta con nth-of-type), el mismo del editor de estilos */
  selector: string;
  /** texto visible, recortado */
  texto: string;
  /** HTML actual del elemento, recortado */
  html: string;
  /** el apartado que lo contiene (section, header, nav…), si lo hay */
  seccion?: Omit<ElementoSenalado, "id" | "seccion">;
}

export const MAX_SENALADOS = 5;
const MAX_TEXTO = 160;
const MAX_HTML = 1500;
const MAX_HTML_SECCION = 3000;

function cadena(x: unknown, max: number): string {
  return typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function htmlRecortado(x: unknown, max: number): string {
  if (typeof x !== "string") return "";
  const t = x.trim();
  return t.length > max ? `${t.slice(0, max)}\n<!-- …recortado: ${t.length - max} caracteres más -->` : t;
}

function parte(raw: Record<string, unknown>, maxHtml: number) {
  const etiqueta = cadena(raw.etiqueta, 20).toLowerCase();
  const selector = cadena(raw.selector, 300);
  if (!/^[a-z][a-z0-9-]*$/.test(etiqueta) || !selector) return null;
  return { etiqueta, selector, texto: cadena(raw.texto, MAX_TEXTO), html: htmlRecortado(raw.html, maxHtml) };
}

/** Valida lo que llega del piloto del iframe. */
export function normalizarSenalado(raw: unknown, id: string): ElementoSenalado | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const base = parte(r, MAX_HTML);
  if (!base) return null;
  const sec = r.seccion && typeof r.seccion === "object" ? parte(r.seccion as Record<string, unknown>, MAX_HTML_SECCION) : null;
  return { id, ...base, ...(sec && sec.selector !== base.selector ? { seccion: sec } : {}) };
}

/** Sube al apartado que contiene el elemento (si lo trae). */
export function ampliarASeccion(e: ElementoSenalado): ElementoSenalado {
  return e.seccion ? { id: e.id, ...e.seccion } : e;
}

/** Añade sin repetir el mismo elemento y con tope. */
export function agregarSenalado(lista: readonly ElementoSenalado[], nuevo: ElementoSenalado): ElementoSenalado[] {
  const sin = lista.filter((e) => e.selector !== nuevo.selector);
  return [...sin, nuevo].slice(-MAX_SENALADOS);
}

/** La etiqueta corta que se ve en el chat: `<button> «Añadir»`. */
export function etiquetaCorta(e: ElementoSenalado): string {
  const t = e.texto.length > 40 ? `${e.texto.slice(0, 39)}…` : e.texto;
  return t ? `<${e.etiqueta}> «${t}»` : `<${e.etiqueta}>`;
}

/** El bloque que lee el modelo, detrás de lo que escribió el usuario. */
export function textoParaModelo(lista: readonly ElementoSenalado[]): string {
  if (!lista.length) return "";
  const bloques = lista.map((e, i) =>
    [
      `### Elemento señalado ${lista.length > 1 ? i + 1 : ""}`.trim(),
      `- Etiqueta: <${e.etiqueta}>`,
      `- Selector: \`${e.selector}\``,
      e.texto ? `- Texto visible: «${e.texto}»` : "- Sin texto visible",
      "- HTML actual en la página:",
      "```html",
      e.html || "(no disponible)",
      "```",
    ].join("\n")
  );
  return [
    `[El usuario ha señalado ${lista.length === 1 ? "este elemento" : "estos elementos"} en la vista previa. Su petición se refiere a ${lista.length === 1 ? "él" : "ellos"}: localízalo${lista.length === 1 ? "" : "s"} en el código por el HTML y el selector, aplica el cambio ahí y conserva igual el resto de la página. Si la petición afecta a más cosas, dilo.]`,
    ...bloques,
  ].join("\n\n");
}
