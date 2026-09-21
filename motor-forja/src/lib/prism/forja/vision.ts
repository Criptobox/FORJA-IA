/** FORJA IA — Visión e inspección de páginas de FORJA IA (v2.3 «El Ojo Clínico»).
 *
 * Hasta ahora el Revisor solo leía CÓDIGO. Pero el usuario pide lo que un
 * profesional espera: que la IA VEA la página y detecte bugs. Este módulo
 * lo resuelve en dos capas complementarias:
 *
 *   1. INSPECTOR ESTÁTICO (chequeosEstaticos): función PURA y determinista
 *      que analiza el HTML con regex. No cuesta llamadas, corre igual en el
 *      servidor y en el navegador, y encuentra los fallos objetivos que no
 *      deberían depender del humor de un modelo: falta el meta viewport,
 *      imágenes sin alt, campos sin etiqueta, saltos de jerarquía de
 *      encabezados, contraste bajo en los pares de color declarados,
 *      texto < 12px, target="_blank" sin noopener, etiquetas obsoletas…
 *      El núcleo lo ejecuta en CADA ronda y le pasa el informe al Revisor,
 *      que confirma o descarta cada hallazgo (la última palabra es de un
 *      modelo con contexto, no de una regex).
 *
 *   2. VISIÓN CON MODELO MULTIMODAL (LlamadaVision + promptVisionBase):
 *      para lo que una regex no puede ver (solapes, texto cortado,
 *      desbordes en móvil, imágenes rotas), el HOST puede inyectar una
 *      función que mande una CAPTURA a un modelo con visión. Igual que
 *      LlamadaModelo: el módulo define el contrato, el host pone el motor.
 *
 * Este archivo NO importa nada del resto del módulo: lo usa tanto el núcleo
 * (servidor) como la UI del preview (navegador) sin ciclos ni dependencias.
 */

/* ------------------------------- tipos ---------------------------------- */

/** Gravedad. `critico` debe bloquear la aprobación si el Revisor lo confirma. */
export type SeveridadHallazgo = "critico" | "aviso" | "mejora";

/** Área del problema, para filtrar y para pintar la UI. */
export type CategoriaHallazgo =
  | "bug"
  | "accesibilidad"
  | "visual"
  | "movil"
  | "seo"
  | "rendimiento"
  | "seguridad"
  | "estandares";

/** Un defecto encontrado al inspeccionar una página. */
export interface HallazgoVision {
  severidad: SeveridadHallazgo;
  categoria: CategoriaHallazgo;
  /** QUÉ falla, en una línea corta */
  titulo: string;
  /** DÓNDE y por qué importa; puede traer la evidencia recortada */
  detalle: string;
}

const ORDEN_SEVERIDAD: Record<SeveridadHallazgo, number> = {
  critico: 0,
  aviso: 1,
  mejora: 2,
};

/* ---------------------------- utilidades --------------------------------- */

/** Colores soportados: #RGB, #RRGGBB, rgb() y rgba(). Devuelve [r,g,b]. */
function colorDesde(valor: string): [number, number, number] | null {
  const v = valor.trim().toLowerCase();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      return [
        parseInt(h[0] + h[0], 16),
        parseInt(h[1] + h[1], 16),
        parseInt(h[2] + h[2], 16),
      ];
    }
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  const rgb = v.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  return null;
}

/** Luminancia relativa WCAG 2.x de un canal RGB 0..255. */
function luminancia([r, g, b]: [number, number, number]): number {
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Ratio de contraste WCAG entre dos colores CSS, o null si alguno no se
 * entiende (degradados, nombres, var()): sin dato no hay hallazgo. */
function ratioContraste(a: string, b: string): number | null {
  const ca = colorDesde(a);
  const cb = colorDesde(b);
  if (!ca || !cb) return null;
  const l1 = luminancia(ca);
  const l2 = luminancia(cb);
  const clara = Math.max(l1, l2);
  const oscura = Math.min(l1, l2);
  return (clara + 0.05) / (oscura + 0.05);
}

/** Recorta una evidencia para que quepa en el informe/prompt. */
function evidencia(texto: string, max = 90): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length <= max ? limpio : `${limpio.slice(0, max - 1)}…`;
}

function push(
  out: HallazgoVision[],
  h: HallazgoVision,
  limitePorTipo?: Map<string, number>
): void {
  if (limitePorTipo) {
    const clave = `${h.severidad}:${h.titulo}`;
    const n = (limitePorTipo.get(clave) ?? 0) + 1;
    limitePorTipo.set(clave, n);
    if (n > 3) return; // máximo 3 instancias del mismo hallazgo
  }
  out.push(h);
}

/* ------------------------ el inspector estático -------------------------- */

/** Analiza un HTML (documento completo O fragmento de componente) y devuelve
 * los hallazgos ordenados por gravedad. Nunca lanza: HTML roto = hallazgos,
 * no excepciones. Tope de 30 para no ahogar al Revisor ni a la UI. */
export function chequeosEstaticos(html: string): HallazgoVision[] {
  const out: HallazgoVision[] = [];
  if (!html || html.length < 20) return out;
  const limite = new Map<string, number>();
  const esDocumento = /<html[\s>]/i.test(html) || /<!doctype\s+html/i.test(html);

  /* --- documentos: cabecera mínima ------------------------------------ */
  if (esDocumento) {
    if (!/<meta\s+[^>]*name\s*=\s*["']viewport["'][^>]*>/i.test(html)) {
      out.push({
        severidad: "critico",
        categoria: "movil",
        titulo: "Falta el meta viewport",
        detalle:
          "Sin <meta name=\"viewport\" content=\"width=device-width…\"> la página se ve como un escritorio en miniatura en el móvil. Es el bug móvil nº1 y se corrige con una línea en el <head>.",
      });
    }
    if (!/<html[^>]*\slang\s*=/i.test(html)) {
      out.push({
        severidad: "aviso",
        categoria: "accesibilidad",
        titulo: "<html> sin atributo lang",
        detalle:
          "Los lectores de pantalla y los traductores necesitan lang (p. ej. <html lang=\"es\">) para pronunciar y traducir bien el contenido.",
      });
    }
    if (!/<meta\s+[^>]*charset/i.test(html)) {
      out.push({
        severidad: "aviso",
        categoria: "estandares",
        titulo: "Falta declarar el charset",
        detalle: "Añade <meta charset=\"utf-8\"> como primera línea del <head>: sin él, acentos y eñes pueden romperse.",
      });
    }
    const mTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    if (!mTitle || mTitle[1].trim().length === 0) {
      out.push({
        severidad: "aviso",
        categoria: "seo",
        titulo: "Falta el <title> de la página",
        detalle: "La pestaña del navegador, los marcadores y los buscadores usan el título; vacío o ausente es un fallo básico de SEO.",
      });
    }
    if (!/<!doctype/i.test(html)) {
      out.push({
        severidad: "mejora",
        categoria: "estandares",
        titulo: "Falta <!DOCTYPE html>",
        detalle: "Sin doctype el navegador activa el «quirks mode» y cambia el modelo de caja: siempre decláralo.",
      });
    }
  }

  /* --- imágenes: alt y dimensiones -------------------------------------
   * La regex es consciente de comillas: atributos con > dentro (p. ej.
   * data URIs con SVG inline) no cortan la etiqueta a la mitad. */
  const imagenes = html.match(/<img\b(?:"[^"]*"|'[^']*'|[^>])*>/gi) ?? [];
  let sinAlt = 0;
  let sinDimensiones = 0;
  const ejemplosSinAlt: string[] = [];
  for (const img of imagenes) {
    if (!/\balt\s*=/i.test(img)) {
      sinAlt++;
      if (ejemplosSinAlt.length < 2) ejemplosSinAlt.push(evidencia(img));
    }
    if (!/\bwidth\s*=/i.test(img) && !/\bheight\s*=/i.test(img)) sinDimensiones++;
  }
  if (sinAlt > 0) {
    out.push({
      severidad: "critico",
      categoria: "accesibilidad",
      titulo: `Imagenes sin atributo alt (${sinAlt})`,
      detalle: `Un lector de pantalla no sabe qué muestran. Añade alt descriptivo (o alt=\"\" si es decorativa). Ejemplos: ${ejemplosSinAlt.join(" · ")}`,
    });
  }
  if (sinDimensiones > 0) {
    push(out, {
      severidad: "mejora",
      categoria: "rendimiento",
      titulo: `Imagenes sin width/height (${sinDimensiones})`,
      detalle:
        "Sin dimensiones el navegador reserva mal el espacio y la página «salta» al cargar (CLS). Declara width y height, o aspect-ratio en CSS.",
    }, limite);
  }

  /* --- formularios: etiqueta accesible ---------------------------------- */
  const idsConLabel = new Set<string>();
  const rxLabel = /<label\b[^>]*\bfor\s*=\s*["']([^"']+)["']/gi;
  let mLabel: RegExpExecArray | null;
  while ((mLabel = rxLabel.exec(html)) !== null) idsConLabel.add(mLabel[1]);
  const campos = html.match(/<(?:input|select|textarea)\b(?:"[^"]*"|'[^']*'|[^>])*>/gi) ?? [];
  let camposSinEtiqueta = 0;
  const ejemplosCampo: string[] = [];
  for (const campo of campos) {
    const tipo = campo.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    if (["hidden", "submit", "button", "reset", "image"].includes(tipo)) continue;
    const id = campo.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const ok =
      /\baria-label(?:ledby)?\s*=/i.test(campo) ||
      (id !== "" && idsConLabel.has(id));
    if (!ok) {
      camposSinEtiqueta++;
      if (ejemplosCampo.length < 2) ejemplosCampo.push(evidencia(campo));
    }
  }
  if (camposSinEtiqueta > 0) {
    out.push({
      severidad: "critico",
      categoria: "accesibilidad",
      titulo: `Campos de formulario sin etiqueta (${camposSinEtiqueta})`,
      detalle: `Todo input/select/textarea necesita <label for> (o aria-label). Ejemplos: ${ejemplosCampo.join(" · ")}`,
    });
  }

  /* --- botones vacíos (icon-only sin aria-label) ------------------------- */
  const rxButton = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  let mButton: RegExpExecArray | null;
  while ((mButton = rxButton.exec(html)) !== null) {
    const attrs = mButton[1];
    const contenido = mButton[2].replace(/<[^>]*>/g, "").trim();
    if (contenido === "" && !/\baria-label\s*=/i.test(attrs)) {
      push(out, {
        severidad: "aviso",
        categoria: "accesibilidad",
        titulo: "Botón sin texto ni aria-label",
        detalle:
          "Los botones solo-icono (menu, cerrar, redes) deben llevar aria-label para que un lector de pantalla los anuncie.",
      }, limite);
    }
  }

  /* --- jerarquía de encabezados ------------------------------------------ */
  const niveles: number[] = [];
  const rxH = /<h([1-6])\b/gi;
  let mH: RegExpExecArray | null;
  while ((mH = rxH.exec(html)) !== null) niveles.push(Number(mH[1]));
  if (niveles.length > 0) {
    const h1 = niveles.filter((n) => n === 1).length;
    if (esDocumento && h1 === 0) {
      out.push({
        severidad: "aviso",
        categoria: "seo",
        titulo: "No hay ningún <h1>",
        detalle: "Cada página necesita un h1: es el titular principal para usuarios y buscadores.",
      });
    }
    if (niveles[0] !== 1) {
      push(out, {
        severidad: "aviso",
        categoria: "accesibilidad",
        titulo: `El primer encabezado es h${niveles[0]}`,
        detalle: "La jerarquía debe empezar en h1 y descender sin saltos: los lectores de pantalla la usan como índice.",
      }, limite);
    }
    for (let i = 1; i < niveles.length; i++) {
      if (niveles[i] - niveles[i - 1] > 1) {
        push(out, {
          severidad: "aviso",
          categoria: "accesibilidad",
          titulo: `Salto de jerarquía: h${niveles[i - 1]} → h${niveles[i]}`,
          detalle: "No saltes niveles (h2 → h4). Usa clases CSS para el tamaño visual y conserva el orden semántico.",
        }, limite);
        break;
      }
    }
    if (h1 > 1) {
      push(out, {
        severidad: "mejora",
        categoria: "seo",
        titulo: `Hay ${h1} h1 en la página`,
        detalle: "Lo normal es UN h1 por página; lo demás deben ser h2/h3.",
      }, limite);
    }
  }

  /* --- enlaces y seguridad ------------------------------------------------ */
  const rxA = /<a\b(?:"[^"]*"|'[^']*'|[^>])*>/gi;
  let mA: RegExpExecArray | null;
  let blanksSinRel = 0;
  while ((mA = rxA.exec(html)) !== null) {
    if (!/\btarget\s*=\s*["']_blank["']/i.test(mA[0])) continue;
    const rel = mA[0].match(/\brel\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
    if (!/noopener/i.test(rel)) blanksSinRel++;
  }
  if (blanksSinRel > 0) {
    push(out, {
      severidad: "aviso",
      categoria: "seguridad",
      titulo: `target=\"_blank\" sin rel=\"noopener\" (${blanksSinRel})`,
      detalle:
        "La página abierta puede manipular la original (tabnabbing). Añade rel=\"noopener noreferrer\" a cada enlace externo.",
    }, limite);
  }
  const enlacesMuertos = (html.match(/<a\b[^>]*href\s*=\s*["']#["']/gi) ?? []).length;
  if (enlacesMuertos >= 3) {
    push(out, {
      severidad: "mejora",
      categoria: "bug",
      titulo: `Enlaces muertos href=\"#\" (${enlacesMuertos})`,
      detalle: "Muchos enlaces apuntan a «#»: en una maqueta es aceptable, pero en la entrega final cada enlace debe ir a su sección o página.",
    }, limite);
  }

  /* --- CSS: contraste, texto pequeño, obsoleto, inline -------------------- */
  const paresContraste: { a: string; b: string; donde: string }[] = [];

  // 1) pares dentro del mismo atributo style="…"
  const rxStyle = /style\s*=\s*["']([^"']*)["']/gi;
  let mStyle: RegExpExecArray | null;
  while ((mStyle = rxStyle.exec(html)) !== null) {
    const s = mStyle[1];
    const color = s.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1];
    const fondo = s.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i)?.[1];
    if (color && fondo) paresContraste.push({ a: color, b: fondo, donde: evidencia(mStyle[0], 70) });
  }

  // 2) pares dentro del mismo bloque { … } de <style>
  const rxStyleTag = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let mTag: RegExpExecArray | null;
  while ((mTag = rxStyleTag.exec(html)) !== null) {
    const rxRegla = /([^{}]+)\{([^{}]*)\}/g;
    let mRegla: RegExpExecArray | null;
    while ((mRegla = rxRegla.exec(mTag[1])) !== null) {
      const cuerpo = mRegla[2];
      const color = cuerpo.match(/(?:^|[;])\s*color\s*:\s*([^;]+)/i)?.[1];
      const fondo = cuerpo.match(/(?:^|[;])\s*background(?:-color)?\s*:\s*([^;]+)/i)?.[1];
      if (color && fondo) {
        paresContraste.push({ a: color, b: fondo, donde: evidencia(mRegla[1], 50) });
      }
    }
  }

  const bajos: string[] = [];
  for (const par of paresContraste) {
    if (bajos.length >= 3) break;
    const ratio = ratioContraste(par.a, par.b);
    if (ratio !== null && ratio < 4.5) {
      bajos.push(`${ratio.toFixed(2)}:1 (${par.donde})`);
    }
  }
  if (bajos.length > 0) {
    out.push({
      severidad: "aviso",
      categoria: "visual",
      titulo: "Contraste de texto posiblemente bajo",
      detalle: `Pares color/fondo declarados con menos de 4.5:1 (mínimo WCAG AA): ${bajos.join(" · ")}. El Inspector solo ve colores planos declarados: confirma sobre todo si hay texto sobre imágenes o degradados.`,
    });
  }

  // font-size < 12px
  const tamanos: number[] = [];
  const rxFont = /font-size\s*:\s*(\d+(?:\.\d+)?)px/gi;
  let mFont: RegExpExecArray | null;
  while ((mFont = rxFont.exec(html)) !== null) tamanos.push(Number(mFont[1]));
  const pequenos = tamanos.filter((t) => t < 12);
  if (pequenos.length > 0) {
    push(out, {
      severidad: "aviso",
      categoria: "accesibilidad",
      titulo: `Texto con fuente < 12px (${pequenos.length} casos, mínimo ${Math.min(...pequenos)}px)`,
      detalle: "Por debajo de 12px la lectura se hace difícil, sobre todo en móvil. Sube esos tamaños o usa rem.",
    }, limite);
  }

  // etiquetas obsoletas
  const obsoletas = ["center", "font", "marquee", "big", "strike", "tt", "frame", "frameset"]
    .filter((t) => new RegExp(`<${t}[\\s>]`, "i").test(html));
  if (obsoletas.length > 0) {
    out.push({
      severidad: "aviso",
      categoria: "estandares",
      titulo: `Etiquetas HTML obsoletas: ${obsoletas.map((t) => `<${t}>`).join(", ")}`,
      detalle: "Estas etiquetas ya no son estándar y pueden comportarse distinto en cada navegador. Sustitúyelas por CSS.",
    });
  }

  // manejadores inline
  const inline = (html.match(/\son(?:click|mouseover|mouseout|change|submit|load)\s*=/gi) ?? []).length;
  if (inline > 0) {
    push(out, {
      severidad: "mejora",
      categoria: "bug",
      titulo: `Manejadores de eventos inline (${inline})`,
      detalle: "Los onclick=\"…\" inline dificultan el mantenimiento y la CSP. Mueve los eventos a addEventListener en el <script>.",
    }, limite);
  }

  // tabindex positivo
  const mTab = html.match(/tabindex\s*=\s*["'](\d+)["']/i);
  if (mTab && Number(mTab[1]) > 0) {
    push(out, {
      severidad: "aviso",
      categoria: "accesibilidad",
      titulo: "tabindex positivo en el HTML",
      detalle: "tabindex=\"1…\" rompe el orden natural de foco. Usa tabindex=\"0\" o reordena el DOM.",
    }, limite);
  }

  // vídeo con autoplay sin muted
  const videos = html.match(/<video\b(?:"[^"]*"|'[^']*'|[^>])*>/gi) ?? [];
  for (const video of videos) {
    if (/\bautoplay/i.test(video) && !/\bmuted/i.test(video)) {
      push(out, {
        severidad: "aviso",
        categoria: "bug",
        titulo: "<video autoplay> sin muted",
        detalle: "Los navegadores bloquean el autoplay con sonido: el vídeo no arrancará. Añade muted (y playsinline para iOS).",
      }, limite);
      break;
    }
  }

  /* --- orden y tope final -------------------------------------------------- */
  const ordenado = out.sort(
    (a, b) => ORDEN_SEVERIDAD[a.severidad] - ORDEN_SEVERIDAD[b.severidad]
  );
  return ordenado.slice(0, 30);
}

/* ------------------------ informe para el Revisor ------------------------- */

/** Bloque de texto que el núcleo añade al mensaje del Revisor con los
 * hallazgos del inspector. Vacío si no hubo hallazgos (no ensucia el prompt). */
export function informeInspector(hallazgos: HallazgoVision[]): string {
  if (hallazgos.length === 0) return "";
  const lineas = hallazgos.map((h, i) => {
    const etiqueta = h.severidad.toUpperCase();
    return `${i + 1}. [${etiqueta}/${h.categoria}] ${h.titulo} — ${h.detalle}`;
  });
  const criticos = hallazgos.filter((h) => h.severidad === "critico").length;
  return `---INSPECTOR VISUAL DE FORJA IA (chequeo automático del HTML: regex, no opinión)---
${lineas.join("\n")}

Estos hallazgos son OBJETIVOS pero automatizados: confirma o descarta cada uno
con tu criterio. Los CRÍTICOS confirmados (${criticos} en esta lista) impiden
aprobar la entrega hasta que el Codificador los corrija.
---FIN INSPECTOR VISUAL---`;
}

/* ------------------- visión con modelo multimodal ------------------------- */

/** Contrato que el HOST inyecta para analizar capturas (screenshots). En
 * FORJA IA: captura de la vista previa → modelo con visión (BYOK). En el
 * preview sin pantalla real no se usa; el inspector estático cubre el flujo. */
export type LlamadaVision = (args: {
  /** imagen en base64 (sin el prefijo data:) */
  imagen: string;
  mimeType: string;
  system: string;
  user: string;
}) => Promise<string>;

/** Prompt de sistema del rol de visión. Formato cerrado con etiquetas, igual
 * que el resto del módulo: los modelos gratuitos lo cumplen mejor que JSON. */
export const PROMPT_VISION = `## Quién eres
Eres el Inspector Visual de FORJA IA. Recibes una CAPTURA DE PANTALLA de una
página web (y opcionalmente su HTML). Tu trabajo es encontrar defectos que se
VEN: elementos solapados, texto cortado o que desborda, scroll horizontal,
imágenes rotas o deformadas, botones ilegibles, contraste insuficiente,
espacios vacíos raros, layout roto en móvil.

## Reglas
1. Solo señales lo que se puede VER en la captura: nada de opiniones de gusto.
2. Cada hallazgo: QUÉ ves mal, DÓNDE está en pantalla, CÓMO se corregiría.
3. Entre 3 y 8 hallazgos como máximo. Si la captura está limpia, dilo.
4. NO reescribes la página completa: describes defectos puntuales.`;

/** Formato de salida del rol de visión (se añade al prompt del host). */
export const FORMATO_VISION = `## Formato de salida OBLIGATORIO
Un hallazgo por etiqueta:
<hallazgo severidad="critico|aviso|mejora" categoria="visual|accesibilidad|movil|bug">Título — dónde está y cómo corregirlo</hallazgo>
Si NO hay defectos visibles: <sin-hallazgos />
Y cierra siempre con: <veredicto>ok|con-defectos</veredicto>`;

/** Mensaje de usuario para el modelo de visión. */
export function mensajeVision(captura: { mimeType: string; html?: string }): string {
  return [
    "Analiza la captura adjunta de esta página web.",
    captura.html
      ? `Para ayudarte, el HTML de la página (recortado):\n${captura.html.slice(0, 6000)}`
      : "",
    "Devuelve los hallazgos en el formato acordado.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Parser tolerante de la respuesta del modelo de visión: acepta atributos
 * en cualquier orden, con o sin acentos, y listas [- CRÍTICO] como fallback. */
export function parseHallazgos(texto: string): HallazgoVision[] {
  const out: HallazgoVision[] = [];
  if (!texto) return out;
  if (/<sin-hallazgos/i.test(texto)) return out;

  /** «crítico» → «critico»: los modelos acentúan a veces y a veces no. */
  const sinTildes = (v: string) =>
    v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const normalizaSeveridad = (bruto: string): SeveridadHallazgo => {
    const v = sinTildes(bruto);
    if (v.includes("crit")) return "critico";
    if (v.includes("mejora") || v.includes("minor") || v.includes("info")) return "mejora";
    return "aviso";
  };
  const normalizaCategoria = (bruto: string): CategoriaHallazgo => {
    const v = sinTildes(bruto);
    if (v.includes("acces") || v === "a11y") return "accesibilidad";
    if (v.includes("movil") || v.includes("responsive") || v.includes("mobile")) return "movil";
    if (v.includes("visual") || v.includes("estet")) return "visual";
    if (v.includes("seo")) return "seo";
    if (v.includes("rend") || v.includes("perf")) return "rendimiento";
    if (v.includes("segur")) return "seguridad";
    if (v.includes("estandar")) return "estandares";
    return "bug";
  };

  // Atributos leídos INDEPENDIENTEMENTE del orden en que vengan.
  const rxTag = /<hallazgo\b([^>]*)>([\s\S]*?)<\/hallazgo>/gi;
  let m: RegExpExecArray | null;
  while ((m = rxTag.exec(texto)) !== null && out.length < 12) {
    const attrs = m[1];
    const cuerpo = m[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!cuerpo) continue;
    out.push({
      severidad: normalizaSeveridad(attrs.match(/severidad\s*=\s*["']([^"']*)["']/i)?.[1] ?? ""),
      categoria: normalizaCategoria(attrs.match(/categoria\s*=\s*["']([^"']*)["']/i)?.[1] ?? ""),
      titulo: cuerpo.split(/[—–-]/)[0].trim().slice(0, 90) || cuerpo.slice(0, 90),
      detalle: cuerpo.slice(0, 260),
    });
  }

  if (out.length === 0) {
    // fallback: líneas «- [CRÍTICO] texto» o «- texto»
    const lineas = texto.split(/\n+/).filter((l) => /^\s*[-*\d.)]/.test(l));
    for (const linea of lineas.slice(0, 12)) {
      const cuerpo = linea.replace(/^\s*[-*\d.)\s]+/, "").trim();
      if (cuerpo.length < 8) continue;
      out.push({
        severidad: /\bcr[ií]tico\b/i.test(cuerpo) ? "critico" : "aviso",
        categoria: "bug",
        titulo: cuerpo.split(/[—–-]/)[0].trim().slice(0, 90),
        detalle: cuerpo.slice(0, 260),
      });
    }
  }
  return out;
}
