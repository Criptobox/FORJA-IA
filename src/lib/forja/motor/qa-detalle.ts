/** FORJA IA — QA DE DETALLE (propuesta v4.7 · «lo que no se mide, no se parchea»).
 *
 * EL HUECO QUE TAPA
 * El pipeline mide mucho, pero nada de esto: `revisarVisual()` mide bugs,
 * a11y, genericidad y adherencia al design system; `auditarExperiencia()`
 * mide desviación del ADN de experiencia; `motion-qa-medido.ts` mide las
 * duraciones del CSS. NINGUNO mide DENSIDAD DE DETALLE. Por eso una página
 * pobre pero limpia saca PASS: no hay defectos, simplemente no hay página.
 *
 * Este módulo mide el detalle contra el PLANO DE CONTENIDO
 * (`plano-contenido.ts`) y emite hallazgos con corrección propuesta, en el
 * mismo formato que el resto del QA (problema + evidencia + gravedad +
 * corrección) para que entren en el bucle patch-first sin tocar nada más.
 *
 * Es determinista, gratis y puro: regex sobre el HTML, igual que
 * `vision.ts` y `antigenerico.ts`. Nunca lanza.
 *
 * ENCAJE: fase 6d del núcleo, justo después del QA de experiencia. Lo que
 * el QA de detalle detecta casi nunca se puede parchear solo (falta
 * CONTENIDO, y el contenido lo escribe el modelo): por eso emite
 * `seccionReparacionDetalle()`, un encargo corto y quirúrgico para UNA
 * llamada de reparación en vez de regenerar la página entera.
 */

import type { PlanoContenido } from "./plano-contenido";

/* --------------------------------- tipos ---------------------------------- */

export interface MetricasDetalle {
  /** nº de <section>/<article> de primer nivel dentro de main/body */
  secciones: number;
  /** nº de encabezados h2 (proxy de secciones con nombre) */
  h2: number;
  h3: number;
  /** anclas id="" disponibles para navegación interna */
  anclas: number;
  /** enlaces internos que apuntan a un ancla existente */
  anclasConectadas: number;
  /** palabras de texto visible (sin CSS, sin scripts, sin comentarios) */
  palabras: number;
  /** nº de piezas repetidas detectadas (li, article, card…) */
  piezas: number;
  /** reglas de estado en el CSS */
  estados: string[];
  /** media queries declaradas */
  breakpoints: number;
  /** imágenes y si llevan dimensión/aspect-ratio */
  imagenes: number;
  imagenesConDimension: number;
  /** iconos svg inline */
  svgInline: number;
  /** emojis usados como iconografía (síntoma de acabado pobre) */
  emojis: number;
  /** señales de contenido tabular real */
  tablas: number;
  listas: number;
  /** formularios y labels asociados */
  campos: number;
  camposConLabel: number;
  /** texto de relleno detectado */
  relleno: string[];
  /** repeticiones literales largas (tres tarjetas gemelas de verdad) */
  duplicados: number;
  /** nº de declaraciones CSS (proxy de acabado del sistema visual) */
  declaracionesCss: number;
  /** longitud del HTML en líneas */
  lineas: number;
}

export type GravedadDetalle = "critico" | "aviso" | "mejora";

export interface HallazgoDetalle {
  id: string;
  gravedad: GravedadDetalle;
  titulo: string;
  evidencia: string;
  correccion: string;
}

export interface InformeDetalle {
  metricas: MetricasDetalle;
  hallazgos: HallazgoDetalle[];
  /** 0..100 — cuánto DETALLE tiene la página (no cuánta calidad) */
  puntuacion: number;
  veredicto: "PASS" | "WARN" | "FAIL";
  resumen: string;
}

/* ------------------------------ 1 · medición ------------------------------- */

const RX_ESTADOS: Array<[string, RegExp]> = [
  [":hover", /:hover\b/],
  [":focus-visible", /:focus-visible\b/],
  [":focus", /:focus\b/],
  [":active", /:active\b/],
  [":disabled", /:disabled\b|\[disabled\]/],
  ["[aria-expanded]", /\[aria-expanded/],
  [":checked", /:checked\b/],
  ["::placeholder", /::placeholder\b/],
  [":empty", /:empty\b/],
];

const RX_RELLENO =
  /\b(lorem ipsum|dolor sit amet|texto de ejemplo|su texto aqu[íi]|tu texto aqu[íi]|placeholder text|descripci[óo]n breve|t[íi]tulo de la secci[óo]n|nombre del producto|caracter[íi]stica \d|lorem)\b/gi;

const RX_EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}]/gu;

function contar(rx: RegExp, s: string): number {
  const g = new RegExp(rx.source, rx.flags.includes("g") ? rx.flags : rx.flags + "g");
  return (s.match(g) ?? []).length;
}

/** Extrae el texto visible: fuera style, script, comentarios y etiquetas. */
function textoVisible(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function soloCss(html: string): string {
  return (html.match(/<style[\s\S]*?<\/style>/gi) ?? []).join("\n");
}

/** Mide el detalle de un HTML completo. Determinista, nunca lanza. */
export function medirDetalle(html: string): MetricasDetalle {
  const vacio: MetricasDetalle = {
    secciones: 0, h2: 0, h3: 0, anclas: 0, anclasConectadas: 0, palabras: 0, piezas: 0,
    estados: [], breakpoints: 0, imagenes: 0, imagenesConDimension: 0, svgInline: 0,
    emojis: 0, tablas: 0, listas: 0, campos: 0, camposConLabel: 0, relleno: [],
    duplicados: 0, declaracionesCss: 0, lineas: 0,
  };
  const h = html ?? "";
  if (!h.trim()) return vacio;
  try {
    const css = soloCss(h);
    const texto = textoVisible(h);

    const ids = [...h.matchAll(/\sid="([^"]+)"/gi)].map((m) => m[1]);
    const hrefs = [...h.matchAll(/href="#([^"]+)"/gi)].map((m) => m[1]);
    const anclasConectadas = hrefs.filter((x) => ids.includes(x)).length;

    const imgs = h.match(/<img\b[^>]*>/gi) ?? [];
    const imagenesConDimension = imgs.filter(
      (t) => /\bwidth=|\bheight=|aspect-ratio/i.test(t) || /class="[^"]*"/.test(t)
    ).length;

    const campos = contar(/<(?:input|textarea|select)\b/i, h);
    const labels = contar(/<label\b/i, h);

    // duplicados: bloques de 120+ caracteres que aparecen más de una vez
    const bloques = (h.match(/<(?:article|li|div)[^>]*>[\s\S]{120,400}?<\/(?:article|li|div)>/gi) ?? []).map((b) =>
      b.replace(/\s+/g, " ").replace(/>[^<]{3,}</g, "><")
    );
    const cuenta = new Map<string, number>();
    for (const b of bloques) cuenta.set(b, (cuenta.get(b) ?? 0) + 1);
    const duplicados = [...cuenta.values()].filter((n) => n > 1).length;

    return {
      secciones: contar(/<section\b/i, h) + contar(/<article\b/i, h),
      h2: contar(/<h2\b/i, h),
      h3: contar(/<h3\b/i, h),
      anclas: ids.length,
      anclasConectadas,
      palabras: texto ? texto.split(/\s+/).length : 0,
      piezas: contar(/<li\b/i, h) + contar(/<article\b/i, h),
      estados: RX_ESTADOS.filter(([, rx]) => rx.test(css)).map(([n]) => n),
      breakpoints: contar(/@media[^{]*\(/i, css),
      imagenes: imgs.length,
      imagenesConDimension,
      svgInline: contar(/<svg\b/i, h),
      emojis: contar(RX_EMOJI, texto),
      tablas: contar(/<table\b/i, h),
      listas: contar(/<(?:ul|ol|dl)\b/i, h),
      campos,
      camposConLabel: Math.min(campos, labels),
      relleno: [...new Set((texto.match(RX_RELLENO) ?? []).map((x) => x.toLowerCase()))],
      duplicados,
      declaracionesCss: contar(/[a-z-]+\s*:\s*[^;{}]+;/i, css),
      lineas: h.split("\n").length,
    };
  } catch {
    return vacio;
  }
}

/* ------------------------------ 2 · auditoría ------------------------------ */

const H = (
  id: string,
  gravedad: GravedadDetalle,
  titulo: string,
  evidencia: string,
  correccion: string
): HallazgoDetalle => ({ id, gravedad, titulo, evidencia, correccion });

/** Audita el HTML CONTRA el plano de contenido. Sin plano, audita contra los
 * mínimos universales de acabado. */
export function auditarDetalle(html: string, plano?: PlanoContenido): InformeDetalle {
  const m = medirDetalle(html);
  const hallazgos: HallazgoDetalle[] = [];
  const minSecciones = plano?.presupuesto.minSecciones ?? 6;
  const minItems = plano?.presupuesto.minItemsColeccion ?? 4;
  const estadosExigidos = plano?.presupuesto.estadosExigidos ?? [":hover", ":focus-visible"];
  const [lineaMin] = plano?.presupuesto.lineasObjetivo ?? [500, 900];

  if (!html.trim()) {
    return {
      metricas: m,
      hallazgos: [H("sin-html", "critico", "No hay página", "el HTML llegó vacío", "regenerar")],
      puntuacion: 0,
      veredicto: "FAIL",
      resumen: "sin HTML que auditar",
    };
  }

  /* — estructura — */
  const seccionesReales = Math.max(m.secciones, m.h2);
  if (seccionesReales < minSecciones) {
    hallazgos.push(
      H("pocas-secciones", "critico", "La página tiene menos secciones de las prometidas",
        `${seccionesReales} secciones detectadas, el plano exige ${minSecciones}`,
        `añadir las secciones que faltan del PLANO DE CONTENIDO, completas y con su contenido real (no encabezados vacíos)`)
    );
  }
  if (plano) {
    const idsPresentes = [...html.matchAll(/\sid="([^"]+)"/gi)].map((x) => x[1].toLowerCase());
    const faltan = plano.secciones
      .filter((s) => s.id !== "nav" && s.id !== "footer")
      .filter((s) => !idsPresentes.some((id) => id.includes(s.id) || s.id.includes(id)))
      .map((s) => s.nombre);
    if (faltan.length) {
      hallazgos.push(
        H("secciones-sin-ancla", "aviso", "Secciones del plano sin ancla identificable",
          `sin id reconocible: ${faltan.join(", ")}`,
          "dar a cada sección el id del plano y enlazarlo desde la navegación")
      );
    }
  }

  /* — densidad de contenido — */
  if (m.palabras < minSecciones * 90) {
    hallazgos.push(
      H("contenido-fino", "critico", "Contenido demasiado fino para el nº de secciones",
        `${m.palabras} palabras visibles en ${seccionesReales} secciones`,
        "escribir contenido específico y concreto en cada sección: datos, nombres, cifras, plazos; una sección con tres frases no es una sección")
    );
  }
  if (m.piezas < minItems) {
    hallazgos.push(
      H("coleccion-pobre", "aviso", "Las secciones de colección no llegan al mínimo de piezas",
        `${m.piezas} piezas repetibles (li/article) detectadas, mínimo ${minItems}`,
        "completar cada colección hasta su mínimo con piezas REALES y distintas entre sí")
    );
  }
  if (m.relleno.length) {
    hallazgos.push(
      H("relleno", "critico", "Texto de relleno en la entrega",
        `detectado: ${m.relleno.join(", ")}`,
        "sustituir por copy realista y específico del negocio")
    );
  }
  if (m.duplicados >= 2) {
    hallazgos.push(
      H("piezas-gemelas", "aviso", "Piezas clonadas literalmente",
        `${m.duplicados} bloques repetidos carácter a carácter`,
        "diferenciar cada pieza: distinto texto, distinta longitud, distinto dato; si de verdad son idénticas, la sección no aporta")
    );
  }

  /* — acabado — */
  const faltanEstados = estadosExigidos.filter((e) => !m.estados.includes(e));
  if (faltanEstados.length) {
    hallazgos.push(
      H("estados", faltanEstados.includes(":focus-visible") ? "critico" : "aviso",
        "Faltan estados interactivos en el CSS",
        `sin reglas para: ${faltanEstados.join(", ")}`,
        "declarar cada estado con un cambio visible (no solo opacidad): color, elevación, borde o desplazamiento")
    );
  }
  if (m.breakpoints < 2) {
    hallazgos.push(
      H("responsive-pobre", "critico", "Responsive insuficiente",
        `${m.breakpoints} media query(s)`,
        "declarar al menos 768px y 1024px, y revisar que el plan responsivo del contrato se cumple (qué se reduce, reordena o transforma)")
    );
  }
  if (m.imagenes > 0 && m.imagenesConDimension < m.imagenes) {
    hallazgos.push(
      H("imagenes-sin-dimension", "aviso", "Imágenes sin dimensión declarada",
        `${m.imagenes - m.imagenesConDimension} de ${m.imagenes} sin width/height ni aspect-ratio`,
        "fijar aspect-ratio y object-fit para que el layout no salte al cargar")
    );
  }
  if (m.svgInline === 0 && m.emojis > 2) {
    hallazgos.push(
      H("emoji-por-icono", "aviso", "Emojis haciendo de iconografía",
        `${m.emojis} emojis y 0 SVG inline`,
        "sustituir por SVG inline con currentColor y grosor de trazo coherente en toda la página")
    );
  }
  if (m.campos > 0 && m.camposConLabel < m.campos) {
    hallazgos.push(
      H("campos-sin-label", "critico", "Campos de formulario sin etiqueta",
        `${m.campos} campos, ${m.camposConLabel} labels`,
        "añadir <label for> visible a cada campo; el placeholder no es una etiqueta")
    );
  }
  if (m.anclas > 0 && m.anclasConectadas === 0) {
    hallazgos.push(
      H("nav-muerta", "aviso", "La navegación no lleva a ninguna parte",
        "ningún href=\"#…\" coincide con un id de la página",
        "conectar cada enlace de la navegación con el ancla real de su sección")
    );
  }
  if (m.declaracionesCss < 120) {
    hallazgos.push(
      H("css-fino", "mejora", "Sistema visual poco desarrollado",
        `${m.declaracionesCss} declaraciones CSS`,
        "desarrollar el sistema: escala tipográfica completa, espaciado por tokens, superficies, estados y variantes")
    );
  }
  if (m.lineas < lineaMin * 0.6) {
    hallazgos.push(
      H("pagina-corta", "aviso", "La página queda muy por debajo de la extensión objetivo",
        `${m.lineas} líneas frente a un objetivo de ${lineaMin}+`,
        "no es un problema de verbosidad: falta contenido y acabado; completar el plano antes que añadir CSS")
    );
  }

  /* — puntuación — */
  const puntuacion = puntuacionDetalle(m, plano);
  const criticos = hallazgos.filter((x) => x.gravedad === "critico").length;
  const avisos = hallazgos.filter((x) => x.gravedad === "aviso").length;
  const veredicto: InformeDetalle["veredicto"] = criticos > 0 ? "FAIL" : avisos >= 3 ? "WARN" : "PASS";

  return {
    metricas: m,
    hallazgos,
    puntuacion,
    veredicto,
    resumen:
      `detalle ${puntuacion}/100 (${veredicto}) · ${seccionesReales} secciones · ${m.palabras} palabras · ` +
      `${m.piezas} piezas · estados [${m.estados.join(" ") || "ninguno"}] · ${m.breakpoints} breakpoints · ` +
      `${criticos} crítico(s), ${avisos} aviso(s)`,
  };
}

/** 0..100: cuánto detalle tiene la página medido contra su plano. */
export function puntuacionDetalle(m: MetricasDetalle, plano?: PlanoContenido): number {
  const minSecciones = plano?.presupuesto.minSecciones ?? 6;
  const minItems = plano?.presupuesto.minItemsColeccion ?? 4;
  const escala = (v: number, objetivo: number): number => Math.max(0, Math.min(1, v / Math.max(1, objetivo)));
  const puntos =
    escala(Math.max(m.secciones, m.h2), minSecciones) * 22 +
    escala(m.palabras, minSecciones * 140) * 22 +
    escala(m.piezas, minItems * 2) * 12 +
    escala(m.estados.length, 4) * 12 +
    escala(m.breakpoints, 3) * 8 +
    escala(m.declaracionesCss, 260) * 10 +
    escala(m.svgInline, 6) * 6 +
    escala(m.anclasConectadas, 4) * 4 +
    (m.tablas + m.listas > 0 ? 4 : 0);
  const castigo = (m.relleno.length ? 25 : 0) + Math.min(12, m.duplicados * 4) + (m.campos > m.camposConLabel ? 8 : 0);
  return Math.max(0, Math.min(100, Math.round(puntos - castigo)));
}

/* ----------------------- 3 · encargo de reparación ------------------------- */

/** El detalle que falta casi nunca se parchea con regex: falta CONTENIDO.
 * Esto produce un encargo CORTO y quirúrgico para UNA llamada de reparación
 * (patch-first sobre la sección concreta), en vez de regenerar la página. */
export function seccionReparacionDetalle(informe: InformeDetalle, plano?: PlanoContenido): string {
  const graves = informe.hallazgos.filter((h) => h.gravedad !== "mejora");
  if (!graves.length) return "";
  const l: string[] = [];
  l.push("# REPARACIÓN DE DETALLE (no regeneres la página: AMPLÍALA)");
  l.push(`Puntuación de detalle actual: ${informe.puntuacion}/100 — ${informe.veredicto}.`);
  l.push("Devuelve el MISMO documento con estas correcciones aplicadas. Conserva intactos los tokens, la CSS determinista, el objeto 3D, las primitivas y el contenido que ya estaba bien.");
  l.push("");
  for (const h of graves) {
    l.push(`- **${h.titulo}** (${h.gravedad}) — evidencia: ${h.evidencia}.`);
    l.push(`  Corrección: ${h.correccion}.`);
  }
  if (plano) {
    const coleccion = plano.secciones.filter((s) => s.coleccion);
    if (coleccion.length) {
      l.push("");
      l.push("Recordatorio de mínimos del plano:");
      for (const s of coleccion) l.push(`- ${s.nombre}: ${s.minItems} piezas reales y distintas.`);
    }
  }
  l.push("");
  l.push("Salida: SOLO el documento HTML completo corregido.");
  return l.join("\n");
}

/** Resumen de una línea para la traza y el registro de observabilidad. */
export function resumenDetalle(informe: InformeDetalle): string {
  return informe.resumen;
}
