/** FORJA IA — PLANO DE CONTENIDO (propuesta v4.7 · «la página, no el hero»).
 *
 * EL DIAGNÓSTICO QUE ORIGINA ESTE MÓDULO
 * FORJA decide la EXPERIENCIA con un detalle extraordinario: 10 familias,
 * 7 recetas, 10 heroes, 10 cards, 8 primitivas compiladas, 8 objetos 3D,
 * planes espacial/movimiento/responsive y tokens. Pero NO decide el
 * CONTENIDO. `RecetaExperiencia` no tiene un solo campo de secciones. La
 * estructura de la página nace en la ficha del Diseñador (texto libre) y se
 * ejecuta bajo un prompt que además pide ser COMPACTO (250-500 líneas).
 *
 * Consecuencia medible: bajo presión de tokens el modelo improvisa POCO —
 * hero + tres features + CTA. El objeto 3D no arregla eso; es un hero
 * bonito encima de una página vacía. El detalle de una web real vive en el
 * contenido: cuántas secciones, cuántos ítems por sección, qué datos
 * concretos, qué estados, qué casos borde.
 *
 * QUÉ HACE ESTE MÓDULO
 *   1. EXTRAE HECHOS del brief (precios, teléfono, ciudad, horarios,
 *      servicios enumerados, cantidades): hoy esa información se tira.
 *   2. Elige un INVENTARIO DE SECCIONES por vertical + familia, con
 *      mínimos verificables por sección (nº de ítems, slots obligatorios).
 *   3. Fija un NIVEL DE DETALLE (borrador / produccion / showcase) que
 *      mueve a la vez: nº de secciones, ítems mínimos, techo de líneas y
 *      techo de tokens de la fase `implementation`.
 *   4. Emite la sección de prompt que viaja al maquetador/Codificador.
 *
 * Todo DETERMINISTA y GRATIS, como el resto del motor creativo: mismas
 * reglas de la casa (sin red, sin React, TypeScript estricto, nunca lanza).
 *
 * ENCAJE: se llama justo después de `seleccionarExperiencia()` y su sección
 * se añade a `seccionContratoExperiencia()`. El QA de detalle
 * (`qa-detalle.ts`) audita el HTML CONTRA este plano: lo que se promete
 * aquí se verifica allí.
 */

/* --------------------------------- tipos ---------------------------------- */

export type NivelDetalle = "borrador" | "produccion" | "showcase";

/** Presupuesto de detalle: una sola perilla que mueve todo el pipeline. */
export interface PresupuestoDetalle {
  nivel: NivelDetalle;
  /** nº de secciones del <main> (sin contar nav ni footer) */
  minSecciones: number;
  maxSecciones: number;
  /** ítems mínimos en las secciones de colección (servicios, productos…) */
  minItemsColeccion: number;
  /** techo ORIENTATIVO de líneas que se le pide al modelo */
  lineasObjetivo: [number, number];
  /** techo de tokens de salida sugerido para la fase de implementación */
  maxTokensImplementacion: number;
  /** estados interactivos exigidos (el QA los verifica en el CSS) */
  estadosExigidos: string[];
}

export const PRESUPUESTOS: Record<NivelDetalle, PresupuestoDetalle> = {
  borrador: {
    nivel: "borrador",
    minSecciones: 4,
    maxSecciones: 6,
    minItemsColeccion: 3,
    lineasObjetivo: [250, 450],
    maxTokensImplementacion: 8_192,
    estadosExigidos: [":hover", ":focus-visible"],
  },
  produccion: {
    nivel: "produccion",
    minSecciones: 7,
    maxSecciones: 10,
    minItemsColeccion: 6,
    lineasObjetivo: [700, 1_100],
    maxTokensImplementacion: 16_384,
    estadosExigidos: [":hover", ":focus-visible", ":active", "[aria-expanded]"],
  },
  showcase: {
    nivel: "showcase",
    minSecciones: 9,
    maxSecciones: 13,
    minItemsColeccion: 8,
    lineasObjetivo: [1_100, 1_800],
    maxTokensImplementacion: 24_576,
    estadosExigidos: [":hover", ":focus-visible", ":active", ":disabled", "[aria-expanded]"],
  },
};

/** Un slot de contenido: lo que la sección DEBE contener, verificable. */
export interface SlotContenido {
  id: string;
  /** qué es, en el lenguaje del maquetador */
  que: string;
  /** obligatorio = el QA de detalle lo marca como defecto si falta */
  obligatorio: boolean;
}

export interface SeccionPlan {
  id: string;
  nombre: string;
  /** para qué existe esta sección (si no hay respuesta, fuera) */
  objetivo: string;
  /** true = sección de colección: necesita `minItems` piezas reales */
  coleccion: boolean;
  minItems: number;
  slots: SlotContenido[];
  /** pista compositiva para que no salgan 3 tarjetas gemelas otra vez */
  composicion: string;
}

/** Hechos concretos extraídos del brief del usuario. Oro puro para el
 * detalle: son los datos que convierten «3 tarjetas» en «una carta con 9
 * productos y sus precios reales». */
export interface HechosBrief {
  precios: string[];
  telefonos: string[];
  correos: string[];
  urls: string[];
  ciudades: string[];
  horarios: string[];
  /** listas enumeradas por el usuario («servicios: corte, barba, tinte») */
  enumeraciones: string[];
  /** cantidades declaradas («3 barberos», «12 habitaciones») */
  cantidades: string[];
  /** nombre propio de la marca, si el brief lo declara entre comillas o tras «se llama» */
  marca: string;
  /** resumen legible para la traza */
  resumen: string;
}

export interface PlanoContenido {
  vertical: string;
  nivel: NivelDetalle;
  presupuesto: PresupuestoDetalle;
  hechos: HechosBrief;
  secciones: SeccionPlan[];
  /** por qué este plano y no otro (traza explicable, como el resto del motor) */
  razones: string[];
  resumen: string;
}

/* ----------------------- 1 · extracción de hechos -------------------------- */

const RX_PRECIO = /(?:[$€£]\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\b\d{1,4}(?:[.,]\d{1,2})?\s?(?:€|eur|euros|usd|d[óo]lares?|pesos)\b)/gi;
const RX_TEL = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{3}[\s.-]?\d{2,4}[\s.-]?\d{2,4}/g;
const RX_CORREO = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const RX_URL = /https?:\/\/[^\s<>"']+|\b(?:www\.)[^\s<>"']+/gi;
const RX_HORARIO = /\b(?:\d{1,2}(?::\d{2})?\s?(?:h|hs|am|pm)?\s?(?:a|-|–|hasta)\s?\d{1,2}(?::\d{2})?\s?(?:h|hs|am|pm)?)\b|\b(?:lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)(?:\s?(?:a|-|–)\s?(?:lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo))?\b/gi;
const RX_CANTIDAD = /\b\d{1,4}\s+(?:a[ñn]os|barberos?|mesas?|habitaciones?|productos?|servicios?|clientes?|empleados?|sucursales?|sedes?|proyectos?|plazas?|profesionales?|modelos?|planes?)\b/gi;
const RX_CIUDAD = /\b(?:en|desde)\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]{2,}(?:\s+de\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]{2,})?)/g;
const RX_MARCA = /(?:se llama|llamad[ao]|marca|nombre)\s+[«"“']?([\wÁÉÍÓÚÑáéíóúñ .&-]{2,40})[»"”']?/i;
const RX_ENUMERACION = /(?:servicios?|productos?|secciones?|men[úu]|carta|planes?|incluye|ofrecemos|vendemos|hacemos)\s*(?:de|:|son|como)?\s*([^.;\n]{10,180})/gi;

function unico(xs: string[], tope: number): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const k = x.trim().replace(/\s+/g, " ");
    if (!k || vistos.has(k.toLowerCase())) continue;
    vistos.add(k.toLowerCase());
    out.push(k);
    if (out.length >= tope) break;
  }
  return out;
}

/** Extrae los hechos del brief. Nunca lanza; devuelve listas vacías si nada. */
export function extraerHechos(mensaje: string): HechosBrief {
  const m = (mensaje ?? "").slice(0, 4_000);
  const vacio: HechosBrief = {
    precios: [], telefonos: [], correos: [], urls: [], ciudades: [],
    horarios: [], enumeraciones: [], cantidades: [], marca: "", resumen: "sin hechos declarados en el brief",
  };
  if (!m.trim()) return vacio;
  try {
    const precios = unico(m.match(RX_PRECIO) ?? [], 12);
    const correos = unico(m.match(RX_CORREO) ?? [], 3);
    const urls = unico(m.match(RX_URL) ?? [], 3);
    // los teléfonos se buscan tras quitar precios/correos para no confundir cifras
    const limpio = m.replace(RX_CORREO, " ").replace(RX_PRECIO, " ");
    const telefonos = unico((limpio.match(RX_TEL) ?? []).filter((t) => t.replace(/\D/g, "").length >= 7), 3);
    const horarios = unico(m.match(RX_HORARIO) ?? [], 6);
    const cantidades = unico(m.match(RX_CANTIDAD) ?? [], 6);
    const ciudades = unico(
      [...m.matchAll(RX_CIUDAD)].map((x) => x[1]).filter((c) => !/^(El|La|Los|Las|Un|Una)$/i.test(c)),
      3
    );
    const enumeraciones = unico(
      [...m.matchAll(RX_ENUMERACION)].map((x) => x[1].trim()),
      6
    );
    const marca = (RX_MARCA.exec(m)?.[1] ?? "").trim();
    const partes: string[] = [];
    if (marca) partes.push(`marca «${marca}»`);
    if (precios.length) partes.push(`${precios.length} precio(s)`);
    if (enumeraciones.length) partes.push(`${enumeraciones.length} enumeración(es)`);
    if (ciudades.length) partes.push(`ciudad ${ciudades[0]}`);
    if (horarios.length) partes.push(`${horarios.length} horario(s)`);
    if (telefonos.length || correos.length) partes.push("contacto declarado");
    return {
      precios, telefonos, correos, urls, ciudades, horarios, enumeraciones, cantidades, marca,
      resumen: partes.length ? partes.join(" · ") : "sin hechos declarados en el brief",
    };
  } catch {
    return vacio;
  }
}

/* ----------------------- 2 · catálogo de secciones ------------------------- */

const S = (
  id: string,
  nombre: string,
  objetivo: string,
  coleccion: boolean,
  minItems: number,
  composicion: string,
  slots: Array<[string, string, boolean]>
): SeccionPlan => ({
  id,
  nombre,
  objetivo,
  coleccion,
  minItems,
  composicion,
  slots: slots.map(([sid, que, obligatorio]) => ({ id: sid, que, obligatorio })),
});

/** El catálogo. Cada sección declara QUÉ debe contener, no cómo se ve: el
 * «cómo» lo manda el contrato de experiencia (familia, receta, tokens). */
export const CATALOGO_SECCIONES: ReadonlyArray<SeccionPlan> = [
  S("nav", "Navegación", "orientar y dar acceso a la acción principal", false, 0,
    "barra con marca a la izquierda, 3-5 enlaces y UNA acción primaria; estado activo visible",
    [["marca", "nombre de la marca (texto o logotipo SVG inline)", true],
     ["enlaces", "3-5 enlaces a anclas reales de la página", true],
     ["cta", "acción primaria diferenciada del resto", true],
     ["movil", "menú accesible a 375px (toggle con aria-expanded)", true]]),

  S("hero", "Hero", "decir qué es esto y para quién en 10 segundos", false, 0,
    "el tipo de hero lo fija el contrato de experiencia; PROHIBIDO el centrado por defecto si el contrato dice otro",
    [["claim", "titular concreto (nada de «Bienvenido a nuestra web»)", true],
     ["subclaim", "una frase que añade información nueva, no que repite el claim", true],
     ["cta-doble", "acción primaria + secundaria degradada visualmente", true],
     ["prueba", "señal de confianza inmediata: dato, sello, nº de clientes, valoración", false]]),

  S("prueba", "Prueba social", "quitar el miedo antes de pedir nada", true, 3,
    "logos, valoraciones o cifras en franja horizontal; nunca tres tarjetas gemelas",
    [["items", "logos / valoraciones / métricas con su fuente", true]]),

  S("oferta", "Qué ofrecemos", "explicar el catálogo real con datos", true, 6,
    "retícula desigual: la pieza más importante ocupa el doble; el resto en módulos menores",
    [["items", "cada ítem con nombre, descripción de 1-2 líneas y dato duro (precio, duración, formato)", true],
     ["precio", "precio o rango cuando el brief lo declare", false],
     ["cta-item", "acción por ítem (ver, reservar, añadir)", false]]),

  S("como-funciona", "Cómo funciona", "eliminar la incertidumbre del proceso", true, 3,
    "secuencia real (y SOLO entonces numerada): paso, qué hace el usuario, qué recibe",
    [["pasos", "3-5 pasos con verbo de acción y resultado", true]]),

  S("detalle", "Pieza en profundidad", "demostrar en vez de prometer", false, 0,
    "bloque ancho con imagen/objeto a un lado y lista de especificaciones al otro (no simétrico)",
    [["especificaciones", "6+ especificaciones o características con su valor", true],
     ["visual", "imagen, objeto 3D o UI del producto con aspect-ratio fijo", true]]),

  S("equipo", "Quién está detrás", "poner cara y autoridad", true, 3,
    "retrato + nombre + rol + una línea con algo específico de esa persona",
    [["personas", "nombre, rol y un detalle concreto por persona", true]]),

  S("testimonios", "Testimonios", "voz del cliente con contexto", true, 3,
    "citas de longitud desigual; cada una con nombre, rol y resultado obtenido",
    [["citas", "cita + autor + rol + resultado medible", true]]),

  S("precios", "Precios", "cerrar la decisión económica", true, 3,
    "tabla comparativa o planes con una recomendación marcada; precios alineados tabularmente",
    [["planes", "nombre, precio, qué incluye (5+ líneas), a quién sirve", true],
     ["destacado", "un plan recomendado, marcado con razón (no solo con color)", true]]),

  S("faq", "Preguntas frecuentes", "responder las objeciones reales antes de que frenen", true, 6,
    "acordeón accesible (<details>/<summary> o botón con aria-expanded)",
    [["preguntas", "6+ preguntas específicas del negocio, no genéricas", true]]),

  S("ubicacion", "Dónde estamos", "hacer posible la visita", false, 0,
    "dirección + horarios en tabla legible + cómo llegar; mapa solo como placeholder estático",
    [["direccion", "dirección completa", true],
     ["horarios", "horarios por día en formato tabular", true],
     ["contacto", "teléfono y correo como enlaces tel:/mailto:", true]]),

  S("cta-final", "Cierre", "una última acción sin ruido alrededor", false, 0,
    "bloque de ancho completo, una sola acción, cero enlaces competidores",
    [["claim", "promesa concreta, distinta a la del hero", true],
     ["cta", "la misma acción primaria de arriba, mismo verbo", true]]),

  S("footer", "Pie", "cerrar legal y navegacionalmente", false, 0,
    "3-4 columnas con enlaces reales, legales y contacto; nunca un pie de una línea",
    [["columnas", "3-4 columnas de enlaces agrupados por tema", true],
     ["legal", "aviso legal, privacidad y cookies", true],
     ["contacto", "contacto y redes con etiqueta accesible", true]]),
];

function sec(id: string): SeccionPlan | undefined {
  return CATALOGO_SECCIONES.find((x) => x.id === id);
}

/** Plantillas por vertical: qué secciones pide CADA tipo de negocio. El
 * orden ES la propuesta de lectura. */
const PLANTILLAS: Record<string, string[]> = {
  saas: ["nav", "hero", "prueba", "oferta", "como-funciona", "detalle", "precios", "testimonios", "faq", "cta-final", "footer"],
  ecommerce: ["nav", "hero", "oferta", "detalle", "prueba", "testimonios", "faq", "ubicacion", "cta-final", "footer"],
  restaurante: ["nav", "hero", "oferta", "detalle", "equipo", "testimonios", "ubicacion", "faq", "cta-final", "footer"],
  local: ["nav", "hero", "oferta", "como-funciona", "equipo", "testimonios", "ubicacion", "faq", "cta-final", "footer"],
  portfolio: ["nav", "hero", "oferta", "detalle", "equipo", "testimonios", "cta-final", "footer"],
  agencia: ["nav", "hero", "prueba", "oferta", "como-funciona", "detalle", "testimonios", "precios", "faq", "cta-final", "footer"],
  educacion: ["nav", "hero", "prueba", "oferta", "como-funciona", "equipo", "precios", "testimonios", "faq", "cta-final", "footer"],
  fintech: ["nav", "hero", "prueba", "detalle", "oferta", "como-funciona", "precios", "faq", "cta-final", "footer"],
  general: ["nav", "hero", "prueba", "oferta", "como-funciona", "detalle", "testimonios", "faq", "cta-final", "footer"],
};

/** Verticales locales que hoy NO están en familias-experiencia.ts:VERTICALES
 * aunque el LEEME dice cubrirlos (la señal vive solo en experience-dna.ts). */
const RX_LOCAL =
  /\b(panader|pasteler|pizzer|helader|carnicer|pescader|florister|boutique|barber|peluquer|est[ée]tic|tatuaj|tattoo|taller|ferreter|gimnas|gym|autolavado|hostal|cl[íi]nica|dentista|veterinar|abogad|gestor[íi]a|fontaner|electricist|mudanz|cerrajer)\w*/i;
const RX_RESTAURANTE = /\b(restaurante|bar|cafeter[íi]a|pizzer|sushi|men[úu]|carta|cocina|tapas)\b/i;
const RX_TIENDA = /\b(tienda|ecommerce|e-commerce|shop|venta|cat[áa]logo|carrito)\b/i;
const RX_PORTFOLIO = /\b(portfolio|portafolio|galer[íi]a|fotograf|ilustrad|dise[ñn]ador)\b/i;
const RX_SAAS = /\b(saas|startup|software|plataforma|app web|dashboard|api)\b/i;
const RX_AGENCIA = /\b(agencia|estudio creativo|consultor|marketing)\b/i;
const RX_EDU = /\b(curso|academia|escuela|formaci[óo]n|bootcamp|clases)\b/i;
const RX_FINTECH = /\b(fintech|banca|banco|inversi[óo]n|cripto|seguros?)\b/i;

/** Vertical de CONTENIDO (distinto del vertical informativo de
 * familias-experiencia.ts: aquí decide QUÉ secciones, no la estética). */
export function verticalDeContenido(mensaje: string): string {
  const m = (mensaje ?? "").toLowerCase();
  if (RX_RESTAURANTE.test(m)) return "restaurante";
  if (RX_SAAS.test(m)) return "saas";
  if (RX_TIENDA.test(m)) return "ecommerce";
  if (RX_PORTFOLIO.test(m)) return "portfolio";
  if (RX_AGENCIA.test(m)) return "agencia";
  if (RX_EDU.test(m)) return "educacion";
  if (RX_FINTECH.test(m)) return "fintech";
  if (RX_LOCAL.test(m)) return "local";
  return "general";
}

/* --------------------------- 3 · nivel de detalle -------------------------- */

const RX_PIDE_DETALLE =
  /\b(detallad|completa|completo|profesional|producci[óo]n|extensa|larga|todas las secciones|full|exhaustiv|premium|showcase|impresionante|espectacular)\b/i;
const RX_PIDE_RAPIDO = /\b(r[áa]pido|boceto|borrador|simple|b[áa]sic|prototipo|mockup r[áa]pido|solo el hero)\b/i;

/** Decide el nivel de detalle. `forzado` gana siempre (perilla de la UI). */
export function nivelDeDetalle(mensaje: string, forzado?: NivelDetalle): NivelDetalle {
  if (forzado) return forzado;
  const m = (mensaje ?? "");
  if (RX_PIDE_RAPIDO.test(m)) return "borrador";
  if (RX_PIDE_DETALLE.test(m) || m.length > 320) return "showcase";
  return "produccion";
}

/* ----------------------------- 4 · el plano -------------------------------- */

/** Construye el PLANO DE CONTENIDO completo. Determinista, 0 tokens. */
export function construirPlanoContenido(
  mensaje: string,
  opts: { nivel?: NivelDetalle; verticalForzado?: string } = {}
): PlanoContenido {
  const hechos = extraerHechos(mensaje);
  const vertical = opts.verticalForzado ?? verticalDeContenido(mensaje);
  const nivel = nivelDeDetalle(mensaje, opts.nivel);
  const presupuesto = PRESUPUESTOS[nivel];
  const razones: string[] = [`vertical de contenido «${vertical}»`, `nivel de detalle «${nivel}»`];

  const ids = PLANTILLAS[vertical] ?? PLANTILLAS.general;
  let secciones = ids.map(sec).filter((x): x is SeccionPlan => Boolean(x));

  // los hechos del brief AÑADEN secciones: si hay precios declarados, la
  // página tiene sección de precios sí o sí; si hay dirección/horarios,
  // ubicación es obligatoria. Aquí es donde el brief deja de desperdiciarse.
  const asegurar = (id: string, porQue: string): void => {
    if (secciones.some((s) => s.id === id)) return;
    const s = sec(id);
    if (!s) return;
    const pos = Math.max(1, secciones.length - 2);
    secciones = [...secciones.slice(0, pos), s, ...secciones.slice(pos)];
    razones.push(`sección «${s.nombre}» añadida: ${porQue}`);
  };
  if (hechos.precios.length >= 2) asegurar("precios", `el brief declara ${hechos.precios.length} precios`);
  if (hechos.horarios.length || hechos.ciudades.length) asegurar("ubicacion", "el brief declara horario o ciudad");
  if (hechos.cantidades.some((c) => /barbero|empleado|profesional/i.test(c))) asegurar("equipo", "el brief declara personas");

  // el nivel recorta o amplía: se quitan por el final las no esenciales
  const esenciales = new Set(["nav", "hero", "oferta", "cta-final", "footer"]);
  while (secciones.length > presupuesto.maxSecciones + 2) {
    const i = secciones.map((s) => s.id).findIndex((id) => !esenciales.has(id));
    if (i < 0) break;
    razones.push(`sección «${secciones[i].nombre}» recortada por el nivel «${nivel}»`);
    secciones.splice(i, 1);
  }

  // los mínimos de colección se ajustan al nivel y a los hechos reales
  secciones = secciones.map((s) => {
    if (!s.coleccion) return s;
    const porHechos = s.id === "oferta" && hechos.precios.length > s.minItems ? hechos.precios.length : 0;
    return { ...s, minItems: Math.max(s.minItems, presupuesto.minItemsColeccion, porHechos) };
  });

  const resumen = [
    `contenido=${vertical}`,
    `detalle=${nivel}`,
    `secciones=${secciones.length}`,
    `ítems mín.=${presupuesto.minItemsColeccion}`,
    `líneas=${presupuesto.lineasObjetivo[0]}-${presupuesto.lineasObjetivo[1]}`,
    `hechos: ${hechos.resumen}`,
  ].join(" · ");

  return { vertical, nivel, presupuesto, hechos, secciones, razones, resumen };
}

/* ------------------------- 5 · sección para el prompt ---------------------- */

/** El bloque que viaja al maquetador/Codificador. Va DESPUÉS del contrato de
 * experiencia: el contrato dice CÓMO se ve, esto dice QUÉ tiene que haber. */
export function seccionPlanoContenido(plano: PlanoContenido): string {
  const l: string[] = [];
  l.push("# PLANO DE CONTENIDO (obligatorio — el QA de detalle lo verifica)");
  l.push(
    `Nivel de detalle: ${plano.nivel.toUpperCase()} · ${plano.secciones.length} secciones · ` +
      `mínimo ${plano.presupuesto.minItemsColeccion} piezas reales en cada sección de colección · ` +
      `extensión objetivo ${plano.presupuesto.lineasObjetivo[0]}-${plano.presupuesto.lineasObjetivo[1]} líneas.`
  );
  l.push(
    "Una sección que no cumpla su mínimo de piezas cuenta como DEFECTO, igual que un contraste roto. " +
      "No recortes secciones para ahorrar: si no cabe todo, reduce decoración, nunca contenido."
  );

  const h = plano.hechos;
  const hechos: string[] = [];
  if (h.marca) hechos.push(`marca: ${h.marca}`);
  if (h.precios.length) hechos.push(`precios declarados (ÚSALOS TAL CUAL): ${h.precios.join(", ")}`);
  if (h.enumeraciones.length) hechos.push(`enumeraciones del brief: ${h.enumeraciones.join(" | ")}`);
  if (h.cantidades.length) hechos.push(`cantidades: ${h.cantidades.join(", ")}`);
  if (h.ciudades.length) hechos.push(`ubicación: ${h.ciudades.join(", ")}`);
  if (h.horarios.length) hechos.push(`horarios: ${h.horarios.join(", ")}`);
  if (h.telefonos.length) hechos.push(`teléfono: ${h.telefonos.join(", ")}`);
  if (h.correos.length) hechos.push(`correo: ${h.correos.join(", ")}`);
  if (hechos.length) {
    l.push("");
    l.push("## Hechos declarados por el usuario — son DATOS, no sugerencias");
    l.push(...hechos.map((x) => `- ${x}`));
    l.push("Inventar un dato que contradiga a estos es un defecto grave. Lo que no esté aquí NO debe presentarse como un hecho real: usa copy conceptual claramente no factual o un placeholder explícito como [PRECIO], [TELÉFONO], [HORARIO]. En modo demo, cualquier dato ficticio debe quedar marcado como DEMO. Nunca inventes cifras, nombres, horarios, precios o contacto que parezcan reales.");
  }

  l.push("");
  l.push("## Secciones obligatorias, en este orden");
  plano.secciones.forEach((s, i) => {
    l.push(`${i + 1}. **${s.nombre}** (id \`${s.id}\`) — ${s.objetivo}`);
    l.push(`   Composición: ${s.composicion}`);
    if (s.coleccion) l.push(`   Mínimo ${s.minItems} piezas REALES y DISTINTAS entre sí (distinto texto, distinto dato, distinta longitud).`);
    const obl = s.slots.filter((x) => x.obligatorio).map((x) => x.que);
    const opt = s.slots.filter((x) => !x.obligatorio).map((x) => x.que);
    if (obl.length) l.push(`   Debe contener: ${obl.join("; ")}.`);
    if (opt.length) l.push(`   Si el brief lo permite: ${opt.join("; ")}.`);
  });

  l.push("");
  l.push("## Acabado exigido en TODA la página");
  l.push(`- Estados en CSS: ${plano.presupuesto.estadosExigidos.join(", ")} — visibles, no solo un cambio de opacidad.`);
  l.push("- Imágenes con aspect-ratio fijo y object-fit; nunca un <img> sin dimensión que salte el layout.");
  l.push("- Iconos como SVG inline con currentColor y stroke coherente; nunca emojis como iconografía.");
  l.push("- Todo dato tabular alineado (font-variant-numeric: tabular-nums en precios y cifras).");
  l.push("- Casos borde tratados: qué se ve si una lista está vacía, qué dice un error de formulario.");
  l.push("- Cada sección con un ancla (`id`) que coincide con los enlaces de la navegación.");
  return l.join("\n");
}

/** Resumen de una línea para la traza del núcleo. */
export function resumenPlano(plano: PlanoContenido): string {
  return plano.resumen;
}
