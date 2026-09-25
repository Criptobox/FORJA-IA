/** FORJA IA — ICONOGRAFÍA E IMAGEN COMPILADAS (v4.7, idea G).
 *
 * EL HUECO
 * v4.6 compiló el objeto 3D y las 8 primitivas, pero no lo que rellena el
 * 80% de una página realmente detallada: iconos, placeholders de imagen y
 * texturas. El modelo improvisaba — normalmente con emojis (que no son
 * iconografía: no heredan color, no escalan con el texto y no tienen
 * accesibilidad) o con <img> sin dimensión, que hace saltar el layout al
 * cargar. El QA de detalle lo detecta; este módulo lo evita de raíz.
 *
 * MISMA FILOSOFÍA QUE primitivas.ts
 * El Codificador SELECCIONA y parametriza; no re-inventa. Cada icono nace
 * con `currentColor`, grosor de trazo coherente, `stroke-linecap` uniforme,
 * `aria-hidden` y viewBox 24. Reutilizar uno sale GRATIS: 0 tokens.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

/* --------------------------------- iconos ---------------------------------- */

export interface IconoDef {
  id: string;
  /** para qué sirve, en el lenguaje del maquetador */
  uso: string;
  /** el contenido del <svg> (paths con currentColor heredado) */
  trazo: string;
}

/** 24 iconos de trazo, viewBox 24×24, grosor 1.75, terminaciones redondas.
 * Cubren las secciones del plano de contenido: navegación, oferta, proceso,
 * confianza, contacto, estado. */
export const ICONOS: ReadonlyArray<IconoDef> = [
  { id: "flecha", uso: "avanzar, enlace de sección", trazo: '<path d="M5 12h14M13 6l6 6-6 6"/>' },
  { id: "check", uso: "incluido en un plan, paso completado", trazo: '<path d="M4 12.5 9 17.5 20 6.5"/>' },
  { id: "mas", uso: "acordeón cerrado, añadir", trazo: '<path d="M12 5v14M5 12h14"/>' },
  { id: "menos", uso: "acordeón abierto", trazo: '<path d="M5 12h14"/>' },
  { id: "menu", uso: "navegación en móvil", trazo: '<path d="M4 7h16M4 12h16M4 17h16"/>' },
  { id: "cerrar", uso: "cerrar panel o menú", trazo: '<path d="M6 6l12 12M18 6L6 18"/>' },
  { id: "reloj", uso: "horarios, duración", trazo: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>' },
  { id: "pin", uso: "ubicación, dirección", trazo: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>' },
  { id: "telefono", uso: "llamar", trazo: '<path d="M6 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 6.2 2 2 0 0 1 6 4Z"/>' },
  { id: "correo", uso: "escribir", trazo: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>' },
  { id: "chat", uso: "mensajería, soporte", trazo: '<path d="M20 15a2 2 0 0 1-2 2H8l-4 3.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z"/>' },
  { id: "calendario", uso: "reservar, agenda", trazo: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>' },
  { id: "estrella", uso: "valoración, destacado", trazo: '<path d="m12 4 2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4-3.9 5.5-.8Z"/>' },
  { id: "escudo", uso: "garantía, seguridad", trazo: '<path d="M12 3.5 19 6v6c0 4.4-3 7.4-7 8.6-4-1.2-7-4.2-7-8.6V6Z"/><path d="m9 12 2 2 4-4"/>' },
  { id: "rayo", uso: "rapidez, potencia", trazo: '<path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12Z"/>' },
  { id: "diana", uso: "objetivo, precisión", trazo: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>' },
  { id: "grafico", uso: "resultados, métricas", trazo: '<path d="M4 19h16M7.5 19v-6M12 19V7M16.5 19v-9"/>' },
  { id: "documento", uso: "presupuesto, ficha técnica", trazo: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M8.5 13h7M8.5 16.5h5"/>' },
  { id: "etiqueta", uso: "precio, categoría", trazo: '<path d="M3.5 11.5V5a1.5 1.5 0 0 1 1.5-1.5h6.5l9 9-8 8Z"/><circle cx="8" cy="8" r="1.4"/>' },
  { id: "carrito", uso: "comprar, pedido", trazo: '<path d="M3 4h2.5l2.2 10.5h9.6L19.5 7H7"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>' },
  { id: "persona", uso: "equipo, cuenta", trazo: '<circle cx="12" cy="8.5" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>' },
  { id: "herramienta", uso: "servicio, taller, mantenimiento", trazo: '<path d="M14.5 3.5a5 5 0 0 0 6 6l-9 9a2.5 2.5 0 0 1-3.5-3.5Z"/><path d="m6 18 .01 0"/>' },
  { id: "hoja", uso: "natural, sostenible, artesano", trazo: '<path d="M20 4c-9 0-15 4-15 11a5 5 0 0 0 5 5c7 0 10-7 10-16Z"/><path d="M14 9.5 7 17"/>' },
  { id: "capas", uso: "profundidad, catálogo, módulos", trazo: '<path d="m12 3.5 8.5 4.5L12 12.5 3.5 8Z"/><path d="m4 12.5 8 4.3 8-4.3M4 16.8l8 4.3 8-4.3"/>' },
];

export function iconoPorId(id: string): IconoDef | undefined {
  return ICONOS.find((i) => i.id === id.toLowerCase());
}

/** El SVG inline listo para pegar. Decorativo por defecto (aria-hidden);
 * con `etiqueta` se vuelve semántico (role="img" + <title>). */
export function svgIcono(id: string, opts: { tamano?: number; etiqueta?: string; clase?: string } = {}): string {
  const def = iconoPorId(id);
  if (!def) return "";
  const t = Math.max(12, Math.min(64, opts.tamano ?? 24));
  const clase = opts.clase ? ` class="${opts.clase}"` : ' class="f-ico"';
  const semantica = opts.etiqueta
    ? ` role="img" aria-label="${opts.etiqueta.replace(/"/g, "&quot;")}"`
    : ' aria-hidden="true" focusable="false"';
  return (
    `<svg${clase} width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"${semantica}>` +
    `${def.trazo}</svg>`
  );
}

/** La CSS del sistema de iconos: hereda color y escala con el texto — que
 * es justo lo que un emoji no hace. */
export const CSS_ICONOS = `/* Iconografía FORJA — hereda color y escala con el texto */
.f-ico{width:1.25em;height:1.25em;flex:0 0 auto;vertical-align:-.18em;color:inherit}
.f-ico--acento{color:var(--acento,currentColor)}
.f-ico-caja{display:inline-flex;align-items:center;justify-content:center;
  width:2.75rem;height:2.75rem;border-radius:var(--radius-sm,8px);
  background:var(--surface-2,rgba(127,127,127,.08));color:inherit}
@media (forced-colors: active){.f-ico{forced-color-adjust:auto}}`;

/* --------------------------- imagen y textura ------------------------------ */

/** Placeholder de imagen con proporción fija: ocupa su hueco ANTES de
 * cargar, así el layout no salta. Es el sustituto honesto del <img> sin
 * dimensión que el QA de detalle marca como defecto. */
export function figuraPlaceholder(
  alt: string,
  opts: { ratio?: string; clase?: string; pie?: string } = {}
): string {
  const ratio = opts.ratio ?? "4 / 3";
  const clase = opts.clase ?? "f-fig";
  const pie = opts.pie
    ? `<figcaption class="f-fig-pie">${opts.pie.replace(/</g, "&lt;")}</figcaption>`
    : "";
  return (
    `<figure class="${clase}" style="--f-ratio:${ratio}">` +
    `<div class="f-fig-marco" role="img" aria-label="${alt.replace(/"/g, "&quot;")}"></div>${pie}</figure>`
  );
}

/** CSS de imagen: proporción fija, recorte correcto y una textura de marca
 * (degradado del acento + grano en CSS puro, 0 activos descargados). */
export const CSS_IMAGEN = `/* Imagen FORJA — proporción fija: el layout nunca salta */
.f-fig{margin:0;display:flex;flex-direction:column;gap:.5rem}
.f-fig-marco{aspect-ratio:var(--f-ratio,4/3);width:100%;border-radius:var(--radius-md,12px);
  background:
    radial-gradient(120% 90% at 20% 15%, color-mix(in oklab, var(--acento,#556) 38%, transparent), transparent 60%),
    linear-gradient(145deg, var(--surface-2,#e8e8ea), var(--surface-1,#f4f4f6));
  position:relative;overflow:hidden;isolation:isolate}
.f-fig-marco::after{content:"";position:absolute;inset:0;opacity:.28;mix-blend-mode:overlay;
  background-image:radial-gradient(currentColor .6px, transparent .7px);background-size:4px 4px}
.f-fig img,.f-fig-marco img{width:100%;height:100%;object-fit:cover;display:block}
.f-fig-pie{font-size:.85rem;line-height:1.45;color:var(--texto-2,inherit);opacity:.78}
/* cifras siempre alineadas: precios, métricas, tablas */
.f-num,td.f-num,.f-precio{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}`;

/* ------------------------- selección por contexto -------------------------- */

/** Reglas léxicas: qué iconos pide cada tipo de negocio. Determinista. */
const POR_SENAL: ReadonlyArray<{ rx: RegExp; iconos: string[] }> = [
  // el orden importa: lo más específico primero. «bar» dentro de
  // «barbería» y «producto» dentro de un brief de saas mandaban antes el
  // juego equivocado.
  { rx: /\b(barber|peluquer|est[ée]tic|spa|masaje|u[ñn]as)\w*/i, iconos: ["calendario", "reloj", "persona", "estrella", "pin", "etiqueta"] },
  { rx: /\b(saas|software|plataforma|app web|dashboard|api|anal[íi]tic)\w*/i, iconos: ["rayo", "grafico", "escudo", "capas", "check", "diana"] },
  { rx: /\b(taller|reparaci|fontaner|electricist|cerrajer|mec[áa]nic|mantenimiento)\w*/i, iconos: ["herramienta", "reloj", "telefono", "escudo", "check", "pin"] },
  { rx: /\b(cl[íi]nica|dentista|m[ée]dic|veterinar|salud)\w*/i, iconos: ["escudo", "calendario", "persona", "pin", "telefono", "check"] },
  { rx: /\b(gimnas|gym|entrenam|fitness|deporte)\w*/i, iconos: ["rayo", "diana", "calendario", "grafico", "persona", "check"] },
  { rx: /\b(abogad|gestor|consultor|asesor|fintech|banca|seguro)\w*/i, iconos: ["documento", "escudo", "grafico", "check", "persona", "diana"] },
  { rx: /\b(curso|academia|escuela|formaci[óo]n|clases)\w*/i, iconos: ["documento", "calendario", "persona", "check", "grafico", "estrella"] },
  { rx: /\b(portfolio|portafolio|fotograf|dise[ñn]|galer[íi]a|estudio creativo)\w*/i, iconos: ["capas", "flecha", "estrella", "correo", "persona", "diana"] },
  { rx: /\b(restaurante|bar|cafeter|pizzer|panader|pasteler|men[úu]|carta|cocina)\b\w*/i, iconos: ["reloj", "pin", "telefono", "estrella", "hoja", "etiqueta"] },
  { rx: /\b(tienda|ecommerce|shop|venta|cat[áa]logo|carrito|producto)\w*/i, iconos: ["carrito", "etiqueta", "escudo", "flecha", "estrella", "documento"] },
];

/** Base universal: sirve a cualquier página del plano de contenido. */
const BASE = ["flecha", "check", "mas", "menu", "cerrar", "correo"];

export interface EleccionIconos {
  iconos: string[];
  motivo: string;
}

/** Elige el juego de iconos de esta generación. Gratis, determinista. */
export function elegirIconos(mensaje: string, max = 10): EleccionIconos {
  const m = mensaje ?? "";
  const encontrada = POR_SENAL.find((r) => r.rx.test(m));
  const contextuales = encontrada?.iconos ?? ["estrella", "escudo", "grafico", "pin", "reloj", "documento"];
  const iconos: string[] = [];
  for (const id of [...BASE, ...contextuales]) {
    if (!iconos.includes(id) && iconoPorId(id)) iconos.push(id);
    if (iconos.length >= Math.max(6, Math.min(24, max))) break;
  }
  return {
    iconos,
    motivo: encontrada
      ? `juego elegido por señal de sector (${encontrada.rx.source.slice(2, 28)}…)`
      : "juego neutro: navegación, confianza y datos",
  };
}

/** CSS completa del sistema visual de apoyo (iconos + imagen + cifras). */
export function cssIconografia(): string {
  return `${CSS_ICONOS}\n\n${CSS_IMAGEN}`;
}

/** La sección que viaja al prompt: catálogo con su HTML exacto. El
 * Codificador copia y cambia el contenido; no dibuja paths a mano. */
export function seccionIconografia(eleccion: EleccionIconos): string {
  if (!eleccion.iconos.length) return "";
  const l: string[] = [];
  l.push("# ICONOGRAFÍA E IMAGEN COMPILADAS (usar estas piezas, no inventarlas)");
  l.push(`Juego de esta página: ${eleccion.iconos.join(", ")} — ${eleccion.motivo}.`);
  l.push("Reglas: los iconos van como SVG inline con currentColor y grosor 1.75 (PROHIBIDO usar emojis como iconografía: no heredan color ni escalan con el texto). Las imágenes van SIEMPRE con proporción declarada.");
  l.push("");
  l.push("## SVG exactos (cópialos tal cual; cambia solo el tamaño o la clase)");
  for (const id of eleccion.iconos) {
    const def = iconoPorId(id);
    if (def) l.push(`- \`${id}\` (${def.uso}): ${svgIcono(id)}`);
  }
  l.push("");
  l.push("## Imagen con proporción fija (sustituye a cualquier <img> sin dimensión)");
  l.push(figuraPlaceholder("Descripción real de lo que se ve", { ratio: "4 / 3", pie: "Pie opcional con un dato concreto" }));
  l.push("");
  l.push("La CSS de ambos sistemas viaja en el bloque de CSS determinista: inclúyela y no la reescribas.");
  return l.join("\n");
}

export function resumenIconografia(eleccion: EleccionIconos): string {
  return `iconos=${eleccion.iconos.length}`;
}

/* ----------------------- iconos por referencia (0 tokens) ------------------ */

/** La marca que escribe el modelo en vez del SVG entero:
 *  `<i data-icono="taza"></i>` (con `class` y `aria-label` opcionales).
 *  Escribir el SVG costaba ~250 caracteres por icono en la respuesta —el
 *  token más caro— y otros tantos en el prompt para enseñárselo. */
const MARCA_ICONO = /<i\b([^>]*?)\bdata-icono\s*=\s*["']([\w-]+)["']([^>]*)>\s*<\/i>/gi;

function atributo(attrs: string, nombre: string): string | undefined {
  const m = attrs.match(new RegExp(`\\b${nombre}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m?.[1];
}

/**
 * Sustituye las marcas `data-icono` por su SVG real e incluye la CSS de los
 * iconos si hace falta. Un id que no existe se deja tal cual: no se inventa
 * un icono. Idempotente: un HTML sin marcas sale igual.
 */
export function expandirIconos(html: string): string {
  if (!html || !/data-icono/i.test(html)) return html;
  let usados = 0;
  const out = html.replace(MARCA_ICONO, (entera, antes: string, id: string, despues: string) => {
    if (!iconoPorId(id)) return entera;
    usados++;
    const attrs = `${antes} ${despues}`;
    const extra = atributo(attrs, "class");
    const tam = Number(atributo(attrs, "data-tamano"));
    return svgIcono(id, {
      clase: ["f-ico", extra].filter(Boolean).join(" "),
      etiqueta: atributo(attrs, "aria-label"),
      ...(Number.isFinite(tam) && tam > 0 ? { tamano: tam } : {}),
    });
  });
  if (!usados || /\.f-ico\s*\{/.test(out)) return out;
  const estilo = `<style>${CSS_ICONOS}</style>`;
  return /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${estilo}</head>`) : `${estilo}\n${out}`;
}
