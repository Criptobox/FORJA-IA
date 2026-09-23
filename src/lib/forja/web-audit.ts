/** Forja IA — Auditoría estática de SEO, rendimiento y accesibilidad de código.
 *
 * Completa lo que ya se mide en otros sitios sin repetirlo:
 * - `visual-qa.ts` mide el DOM pintado (desbordes, contraste, tamaño de
 *   texto, nombres accesibles, objetivos táctiles).
 * - `web-verifier.ts` comprueba lang, <title>, viewport, alt y nombre de
 *   botones/enlaces.
 * Aquí va lo que se puede leer del código y ninguno de los dos mira: meta
 * description y Open Graph, jerarquía de encabezados, imágenes sin tamaño
 * (saltos de maquetación), scripts que bloquean el pintado, campos de
 * formulario sin etiqueta, foco invisible, tabindex positivo…
 *
 * Es heurística sobre texto, así que nada de lo que sale aquí es un «error»:
 * como mucho un aviso. Repeticiones del mismo problema se agrupan en un solo
 * hallazgo con su número, para que una galería de 40 fotos no entierre el
 * resto. Sin HTML no hay puntuación (`null`), nunca un 100 inventado.
 */

export type CategoriaAuditoria = "seo" | "rendimiento" | "accesibilidad";
export type SeveridadAuditoria = "warning" | "info";

export interface HallazgoAuditoria {
  id: string;
  categoria: CategoriaAuditoria;
  severidad: SeveridadAuditoria;
  mensaje: string;
  /** qué hacer, en una frase */
  arreglo: string;
  /** fragmento o recuento que lo sostiene */
  evidencia?: string;
}

export interface AuditoriaWeb {
  hallazgos: HallazgoAuditoria[];
  puntuacion: Record<CategoriaAuditoria, number | null>;
}

const PESO: Record<SeveridadAuditoria, number> = { warning: 12, info: 4 };

/** Tamaño a partir del cual un HTML empieza a pesar en móvil. */
export const HTML_PESADO_BYTES = 500_000;
/** Una imagen incrustada en base64 por encima de esto debería ser un archivo. */
export const DATA_URI_PESADA_BYTES = 100_000;

function recorta(s: string, n = 80): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function atributo(attrs: string, nombre: string): string | null {
  const m = attrs.match(new RegExp(`\\b${nombre}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[1] ?? m[2] ?? m[3] ?? "") : null;
}

function tieneAtributo(attrs: string, nombre: string): boolean {
  return new RegExp(`(?:^|\\s)${nombre}(?:\\s*=|\\s|$)`, "i").test(attrs);
}

/** El HTML sin el contenido de <script> y <style>, para no confundir
 * cadenas de JS con etiquetas reales. Conserva las etiquetas de apertura. */
function sinCodigo(html: string): string {
  // `</script >` también cierra; y un comentario sin cerrar llega hasta el final
  return hastaQueNoCambie(
    html
      .replace(/(<script\b[^>]*>)[\s\S]*?(<\/script\s*>)/gi, "$1$2")
      .replace(/(<style\b[^>]*>)[\s\S]*?(<\/style\s*>)/gi, "$1$2"),
    (t) => t.replace(/<!--[\s\S]*?(?:-->|$)/g, "")
  );
}

/** Aplica `f` hasta que el texto deja de cambiar: quitar una etiqueta puede
 *  juntar los trozos de otra («<scr<b>ipt>»), y una sola pasada la dejaría. */
function hastaQueNoCambie(texto: string, f: (t: string) => string): string {
  let antes = texto;
  for (let i = 0; i < 20; i++) {
    const despues = f(antes);
    if (despues === antes) return despues;
    antes = despues;
  }
  return antes;
}

/** Solo el texto visible (para medir longitudes, nunca para pintarlo). */
function textoPlano(html: string, sep = ""): string {
  return hastaQueNoCambie(html, (t) => t.replace(/<[^>]*>/g, sep)).replace(/[<>]/g, sep);
}

function css(html: string): string {
  const bloques = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  const enLinea = [...html.matchAll(/\bstyle\s*=\s*"([^"]*)"/gi)].map((m) => m[1]);
  return [...bloques, ...enLinea].join("\n");
}

function metaContenido(marcado: string, clave: string, valor: string): string | null {
  for (const m of marcado.matchAll(/<meta\b([^>]*)>/gi)) {
    const v = atributo(m[1], clave);
    if (v && v.toLowerCase() === valor) return atributo(m[1], "content") ?? "";
  }
  return null;
}

function auditarSeo(marcado: string, out: HallazgoAuditoria[]) {
  const desc = metaContenido(marcado, "name", "description");
  if (desc == null || !desc.trim()) {
    out.push({
      id: "seo-meta-description",
      categoria: "seo",
      severidad: "warning",
      mensaje: "Falta <meta name=\"description\">: el buscador inventará el resumen de la página.",
      arreglo: "Añade en el <head> una descripción de 50-160 caracteres que diga qué ofrece la página.",
    });
  } else if (desc.trim().length < 50 || desc.trim().length > 170) {
    out.push({
      id: "seo-meta-description-largo",
      categoria: "seo",
      severidad: "info",
      mensaje: `La meta description tiene ${desc.trim().length} caracteres; los buscadores muestran bien entre 50 y 160.`,
      arreglo: "Ajusta la descripción a 50-160 caracteres.",
      evidencia: recorta(desc),
    });
  }

  const titulo = marcado.match(/<title\b[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  if (titulo && titulo.length > 65) {
    out.push({
      id: "seo-title-largo",
      categoria: "seo",
      severidad: "info",
      mensaje: `El <title> tiene ${titulo.length} caracteres y se cortará en los resultados (≈60).`,
      arreglo: "Acorta el título a unos 60 caracteres con lo importante delante.",
      evidencia: recorta(titulo),
    });
  }

  const og = ["og:title", "og:description", "og:image"].filter((p) => metaContenido(marcado, "property", p) == null);
  if (og.length) {
    out.push({
      id: "seo-open-graph",
      categoria: "seo",
      severidad: "info",
      mensaje: `Faltan etiquetas Open Graph (${og.join(", ")}): al compartir el enlace saldrá sin título o sin imagen.`,
      arreglo: "Añade <meta property=\"og:title\">, og:description y og:image en el <head>.",
    });
  }

  const niveles = [...marcado.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
  const h1 = niveles.filter((n) => n === 1).length;
  if (niveles.length && h1 === 0) {
    out.push({
      id: "seo-sin-h1",
      categoria: "seo",
      severidad: "warning",
      mensaje: "La página no tiene <h1>: ni buscadores ni lectores de pantalla saben cuál es el tema principal.",
      arreglo: "Convierte el titular principal en el único <h1> de la página.",
    });
  } else if (h1 > 1) {
    out.push({
      id: "seo-varios-h1",
      categoria: "seo",
      severidad: "info",
      mensaje: `Hay ${h1} <h1>; lo claro es uno por página y el resto como <h2>.`,
      arreglo: "Deja un solo <h1> y baja los demás a <h2>.",
    });
  }
  for (let i = 1; i < niveles.length; i++) {
    if (niveles[i] > niveles[i - 1] + 1) {
      out.push({
        id: "seo-salto-encabezado",
        categoria: "seo",
        severidad: "info",
        mensaje: `La jerarquía de encabezados salta de <h${niveles[i - 1]}> a <h${niveles[i]}>.`,
        arreglo: "No te saltes niveles: tras un h2 viene un h3. Si solo buscas un tamaño, cámbialo por CSS.",
      });
      break;
    }
  }

  const genericos = [...marcado.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => textoPlano(m[1], " ").replace(/\s+/g, " ").trim().toLowerCase())
    .filter((t) => /^(?:haz clic aquí|clic aquí|pulsa aquí|aquí|click here|here|leer más|ver más|más|read more|more)$/.test(t));
  if (genericos.length) {
    out.push({
      id: "seo-enlace-generico",
      categoria: "seo",
      severidad: "info",
      mensaje: `${genericos.length} enlace(s) con texto genérico («${genericos[0]}»): fuera de contexto no dicen adónde llevan.`,
      arreglo: "Escribe en el enlace el destino: «Ver precios», «Leer el caso de Acme».",
    });
  }
}

function auditarRendimiento(html: string, marcado: string, estilos: string, out: HallazgoAuditoria[]) {
  const bytes = new TextEncoder().encode(html).length;
  if (bytes > HTML_PESADO_BYTES) {
    out.push({
      id: "perf-html-pesado",
      categoria: "rendimiento",
      severidad: "warning",
      mensaje: `El HTML pesa ${Math.round(bytes / 1024)} KB; en móvil con red lenta tarda en empezar a pintarse.`,
      arreglo: "Saca imágenes incrustadas y bloques grandes a archivos aparte.",
    });
  }

  const pesadas = [...html.matchAll(/data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)/g)].filter(
    (m) => m[1].length * 0.75 > DATA_URI_PESADA_BYTES
  );
  if (pesadas.length) {
    out.push({
      id: "perf-data-uri",
      categoria: "rendimiento",
      severidad: "warning",
      mensaje: `${pesadas.length} imagen(es) incrustada(s) en base64 de más de ${DATA_URI_PESADA_BYTES / 1000} KB: no se cachean y engordan el HTML un 33 %.`,
      arreglo: "Guarda esas imágenes como archivos (idealmente WebP/AVIF) y enlázalas.",
    });
  }

  const imgs = [...marcado.matchAll(/<img\b([^>]*)>/gi)].map((m) => m[1]);
  const sinTamano = imgs.filter((a) => atributo(a, "width") == null || atributo(a, "height") == null);
  if (sinTamano.length) {
    out.push({
      id: "perf-img-sin-tamano",
      categoria: "rendimiento",
      severidad: "info",
      mensaje: `${sinTamano.length} de ${imgs.length} imagen(es) sin width/height: la página «salta» al cargarlas (CLS).`,
      arreglo: "Pon width y height (o aspect-ratio en CSS) a cada <img>.",
    });
  }
  const sinLazy = imgs.slice(2).filter((a) => (atributo(a, "loading") ?? "").toLowerCase() !== "lazy");
  if (sinLazy.length) {
    out.push({
      id: "perf-img-sin-lazy",
      categoria: "rendimiento",
      severidad: "info",
      mensaje: `${sinLazy.length} imagen(es) por debajo del inicio se descargan aunque nadie baje hasta ellas.`,
      arreglo: "Añade loading=\"lazy\" a las imágenes que no están en la primera pantalla.",
    });
  }

  const head = marcado.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
  const bloqueantes = [...head.matchAll(/<script\b([^>]*)>/gi)]
    .map((m) => m[1])
    .filter((a) => atributo(a, "src") != null && !tieneAtributo(a, "defer") && !tieneAtributo(a, "async") && (atributo(a, "type") ?? "").toLowerCase() !== "module");
  if (bloqueantes.length) {
    out.push({
      id: "perf-script-bloqueante",
      categoria: "rendimiento",
      severidad: "warning",
      mensaje: `${bloqueantes.length} <script src> en el <head> sin defer: la página no se pinta hasta descargarlos y ejecutarlos.`,
      arreglo: "Añade defer (o muévelos antes de </body>).",
      evidencia: recorta(atributo(bloqueantes[0], "src") ?? ""),
    });
  }

  if (/<link\b[^>]*fonts\.googleapis\.com/i.test(marcado) && !/<link\b[^>]*rel\s*=\s*["']?preconnect[^>]*fonts\.gstatic\.com/i.test(marcado)) {
    out.push({
      id: "perf-fuentes-preconnect",
      categoria: "rendimiento",
      severidad: "info",
      mensaje: "Usa Google Fonts sin preconnect a fonts.gstatic.com: el texto tarda más en aparecer.",
      arreglo: "Añade <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin> antes de la hoja de fuentes.",
    });
  }
  if (/@font-face\b/i.test(estilos) && !/font-display\s*:/i.test(estilos)) {
    out.push({
      id: "perf-font-display",
      categoria: "rendimiento",
      severidad: "info",
      mensaje: "Hay @font-face sin font-display: el texto puede quedar invisible mientras carga la fuente.",
      arreglo: "Añade font-display: swap a cada @font-face.",
    });
  }
  if (/@import\s+(?:url\()?["']?[^;]+/i.test(estilos)) {
    out.push({
      id: "perf-css-import",
      categoria: "rendimiento",
      severidad: "info",
      mensaje: "El CSS usa @import: las hojas se descargan en cadena en vez de en paralelo.",
      arreglo: "Cambia los @import por <link rel=\"stylesheet\"> en el <head>.",
    });
  }
}

function auditarAccesibilidad(marcado: string, estilos: string, out: HallazgoAuditoria[]) {
  const idsConLabel = new Set(
    [...marcado.matchAll(/<label\b([^>]*)>/gi)].map((m) => atributo(m[1], "for")).filter((x): x is string => !!x)
  );
  // campos envueltos en <label>…</label>: el texto del label ya los nombra
  const envueltos = new Set<string>();
  for (const m of marcado.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi)) {
    for (const c of m[1].matchAll(/<(?:input|select|textarea)\b([^>]*)>/gi)) envueltos.add(c[1]);
  }
  const sinEtiqueta = [...marcado.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)].filter((m) => {
    const attrs = m[2];
    const tipo = (atributo(attrs, "type") ?? "").toLowerCase();
    if (m[1].toLowerCase() === "input" && /^(?:hidden|submit|button|reset|image)$/.test(tipo)) return false;
    if (envueltos.has(attrs)) return false;
    if (atributo(attrs, "aria-label") || atributo(attrs, "aria-labelledby") || atributo(attrs, "title")) return false;
    const id = atributo(attrs, "id");
    return !(id && idsConLabel.has(id));
  });
  if (sinEtiqueta.length) {
    const ej = sinEtiqueta[0];
    out.push({
      id: "a11y-campo-sin-etiqueta",
      categoria: "accesibilidad",
      severidad: "warning",
      mensaje: `${sinEtiqueta.length} campo(s) de formulario sin etiqueta: el placeholder desaparece al escribir y el lector de pantalla no sabe qué pedir.`,
      arreglo: "Asocia un <label for=\"id\"> a cada campo (o aria-label si el diseño no deja sitio).",
      evidencia: recorta(`<${ej[1]}${ej[2]}>`),
    });
  }

  const tabPositivo = [...marcado.matchAll(/\btabindex\s*=\s*["']?(\d+)/gi)].filter((m) => Number(m[1]) > 0);
  if (tabPositivo.length) {
    out.push({
      id: "a11y-tabindex-positivo",
      categoria: "accesibilidad",
      severidad: "warning",
      mensaje: `${tabPositivo.length} elemento(s) con tabindex positivo: rompen el orden natural del teclado.`,
      arreglo: "Usa tabindex=\"0\" o reordena el HTML; nunca valores mayores que 0.",
    });
  }

  if (/outline\s*:\s*(?:none|0)\b/i.test(estilos) && !/:focus-visible/i.test(estilos)) {
    out.push({
      id: "a11y-foco-invisible",
      categoria: "accesibilidad",
      severidad: "warning",
      mensaje: "El CSS quita el outline y no define :focus-visible: quien navega con teclado no ve dónde está.",
      arreglo: "Define un estilo :focus-visible visible (anillo o subrayado con contraste) para enlaces, botones y campos.",
    });
  }

  const clicSinRol = [...marcado.matchAll(/<(div|span|li|img)\b([^>]*)>/gi)].filter(
    (m) => /\bonclick\s*=/i.test(m[2]) && !atributo(m[2], "role") && atributo(m[2], "tabindex") == null
  );
  if (clicSinRol.length) {
    out.push({
      id: "a11y-clic-sin-rol",
      categoria: "accesibilidad",
      severidad: "warning",
      mensaje: `${clicSinRol.length} <${clicSinRol[0][1]}> con onclick sin rol ni tabindex: con teclado no se puede activar.`,
      arreglo: "Usa un <button> (o añade role=\"button\", tabindex=\"0\" y manejo de Enter/Espacio).",
    });
  }

  if (/<video\b[^>]*\bautoplay\b/i.test(marcado) && !/<video\b[^>]*\bmuted\b/i.test(marcado)) {
    out.push({
      id: "a11y-video-autoplay",
      categoria: "accesibilidad",
      severidad: "info",
      mensaje: "Un vídeo arranca solo con sonido (autoplay sin muted); además los navegadores lo bloquean.",
      arreglo: "Añade muted y playsinline, o quita autoplay.",
    });
  }

  const cuerpo = marcado.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? "";
  if (textoPlano(cuerpo).trim().length > 400 && !/<main\b/i.test(marcado) && !/role\s*=\s*["']main["']/i.test(marcado)) {
    out.push({
      id: "a11y-sin-main",
      categoria: "accesibilidad",
      severidad: "info",
      mensaje: "La página no tiene <main>: los lectores de pantalla no pueden saltar directos al contenido.",
      arreglo: "Envuelve el contenido principal en <main> (y usa <header>, <nav>, <footer>).",
    });
  }

  if (/@keyframes\b/i.test(estilos) && !/prefers-reduced-motion/i.test(estilos)) {
    out.push({
      id: "a11y-movimiento-reducido",
      categoria: "accesibilidad",
      severidad: "info",
      mensaje: "Hay animaciones @keyframes sin respetar prefers-reduced-motion.",
      arreglo: "Envuelve las animaciones en @media (prefers-reduced-motion: no-preference) o apágalas con reduce.",
    });
  }
}

/** Audita un HTML (o el texto de varios archivos concatenados). */
export function auditarWeb(html: string | null | undefined): AuditoriaWeb {
  const texto = html ?? "";
  if (!texto.trim() || !/<[a-z!][^>]*>/i.test(texto)) {
    return { hallazgos: [], puntuacion: { seo: null, rendimiento: null, accesibilidad: null } };
  }
  const marcado = sinCodigo(texto);
  const estilos = css(texto);
  const hallazgos: HallazgoAuditoria[] = [];
  auditarSeo(marcado, hallazgos);
  auditarRendimiento(texto, marcado, estilos, hallazgos);
  auditarAccesibilidad(marcado, estilos, hallazgos);

  const puntuacion = { seo: 100, rendimiento: 100, accesibilidad: 100 } as Record<CategoriaAuditoria, number | null>;
  for (const h of hallazgos) puntuacion[h.categoria] = Math.max(0, (puntuacion[h.categoria] as number) - PESO[h.severidad]);
  return { hallazgos, puntuacion };
}

/** Resumen en texto para el agente o para el portapapeles. */
export function resumirAuditoria(a: AuditoriaWeb): string {
  const p = a.puntuacion;
  const fmt = (n: number | null) => (n == null ? "—" : String(n));
  const lineas = [`Auditoría web: SEO ${fmt(p.seo)} · Rendimiento ${fmt(p.rendimiento)} · Accesibilidad (código) ${fmt(p.accesibilidad)}.`];
  for (const h of a.hallazgos) lineas.push(`- [${h.severidad}] ${h.mensaje} → ${h.arreglo}`);
  return lineas.join("\n");
}
