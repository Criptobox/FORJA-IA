/** FORJA IA — CARD SYSTEM moderno (v4.5.0, corrección §7).
 *
 * Las cards dejan de ser «<div class="card">»: 14 variantes semánticas,
 * cada una con COMPORTAMIENTO y PROPÓSITO. Y la disciplina del doc:
 * no abusar de glassmorphism — el sistema debe producir superficies
 * modernas sin depender de blur + gradient + glass + shadow en todas partes.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import type { ExperienciaDna } from "./experience-dna";
import type { RecetaExperiencia } from "./experience-recipes";

/* -------------------------------- tipos ------------------------------------ */

export type VarianteCard =
  | "CARD_STATIC"
  | "CARD_FLOATING"
  | "CARD_MAGNETIC"
  | "CARD_TILT"
  | "CARD_GLASS"
  | "CARD_3D"
  | "CARD_EXPANDABLE"
  | "CARD_HORIZONTAL"
  | "CARD_STACKED"
  | "CARD_SPOTLIGHT"
  | "CARD_INTERACTIVE"
  | "CARD_PRODUCT"
  | "CARD_METRIC"
  | "CARD_MEDIA";

export interface DefCard {
  id: VarianteCard;
  /** qué HACE (no cómo se ve) */
  comportamiento: string;
  /** para qué sirve en la jerarquía del contenido */
  proposito: string;
  /** señales que la sugieren */
  cuando?: RegExp;
  /** CSS de referencia (el doc lo pide explícito por variante) */
  css: string;
}

export const CARDS: ReadonlyArray<DefCard> = [
  {
    id: "CARD_STATIC",
    comportamiento: "no reacciona salvo al foco de teclado",
    proposito: "contenido de referencia que no pide acción",
    css: `.card-static { border-radius: var(--radius-lg); border: 1px solid var(--linea); }`,
  },
  {
    id: "CARD_FLOATING",
    comportamiento: "flota sobre el lienzo con sombra propia y deriva ambiente",
    proposito: "datos y acciones sobre el objeto/escena",
    css: `.card-floating { border-radius: 28px; transform: translateZ(20px); box-shadow: var(--shadow-floating); }`,
  },
  {
    id: "CARD_MAGNETIC",
    comportamiento: "se atrae hacia el puntero dentro de su campo y regresa con easing",
    proposito: "CTA y acciones clave",
    css: `.card-magnetic { transition: transform 300ms var(--ease-out); }`,
  },
  {
    id: "CARD_TILT",
    comportamiento: "inclina en 3D según la posición del puntero (máx 8°)",
    proposito: "piezas visuales que ganan con la perspectiva",
    css: `.card-tilt { transform-style: preserve-3d; perspective: 1000px; }`,
  },
  {
    id: "CARD_GLASS",
    comportamiento: "superficie translúcida con blur SOLO sobre capas con contenido detrás",
    proposito: "UI flotante encima de escena u objeto",
    css: `.card-glass { background: color-mix(in srgb, var(--superficie) 72%, transparent); backdrop-filter: blur(14px); border-radius: 24px; border: 1px solid var(--linea); }`,
  },
  {
    id: "CARD_3D",
    comportamiento: "pieza de la escena con translateZ y reacción al scroll",
    proposito: "objetos dentro del plano espacial",
    css: `.card-3d { transform-style: preserve-3d; transform: translateZ(40px); }`,
  },
  {
    id: "CARD_EXPANDABLE",
    comportamiento: "se expande con detalle real al click/teclado (Enter/Espacio)",
    proposito: "listas que necesitan profundidad sin cambiar de página",
    css: `.card-expandable { cursor: pointer; } .card-expandable[aria-expanded="true"] { border-color: var(--acento); }`,
  },
  {
    id: "CARD_HORIZONTAL",
    comportamiento: "formato ancho: media a un lado, texto al otro",
    proposito: "listados con jerarquía fuerte (noticias, proyectos)",
    css: `.card-horizontal { display: grid; grid-template-columns: 2fr 3fr; gap: 20px; border-radius: 24px; }`,
  },
  {
    id: "CARD_STACKED",
    comportamiento: "pila con profundidad: cada capa translateZ distinta",
    proposito: "mostrar acumulación (planes, versiones, historial)",
    css: `.card-stack { position: relative; } .card-stack > * + * { transform: translateZ(calc(var(--n, 1) * -10px)); }`,
  },
  {
    id: "CARD_SPOTLIGHT",
    comportamiento: "un foco de luz sigue al puntero dentro de la card",
    proposito: "destacar UNA pieza sin saturar el resto",
    css: `.card-spotlight { position: relative; overflow: hidden; } .card-spotlight::after { content: ""; position: absolute; inset: -40%; background: radial-gradient(200px circle at var(--mx, 50%) var(--my, 50%), var(--acento-suave), transparent 60%); opacity: 0; transition: opacity 300ms; } .card-spotlight:hover::after { opacity: 1; }`,
  },
  {
    id: "CARD_INTERACTIVE",
    comportamiento: "toda la card es clicable con estado hover/active/focus visibles",
    proposito: "navegación por contenido (proyectos, artículos)",
    css: `.card-interactive { transition: transform 250ms var(--ease-out), border-color 250ms; } .card-interactive:hover { transform: translateY(-4px); border-color: var(--acento); }`,
  },
  {
    id: "CARD_PRODUCT",
    comportamiento: "ficha con media dominante, precio tabular y acción clara",
    proposito: "e-commerce y catálogos",
    css: `.card-product { border-radius: 20px; } .card-product .precio { font-variant-numeric: tabular-nums; }`,
  },
  {
    id: "CARD_METRIC",
    comportamiento: "número grande tabular + delta con color semántico",
    proposito: "métricas flotantes sobre la escena",
    css: `.card-metric { border-radius: 24px; padding: 20px 24px; } .card-metric .valor { font-variant-numeric: tabular-nums; font-weight: 700; }`,
  },
  {
    id: "CARD_MEDIA",
    comportamiento: "video/imagen con aspect-ratio fijo y reproducción con intención",
    proposito: "demos y showreels",
    css: `.card-media { aspect-ratio: 16/9; object-fit: cover; border-radius: 20px; }`,
  },
];

export function defCard(id: string): DefCard | undefined {
  return CARDS.find((c) => c.id === id);
}

/* ------------------------------- elección ---------------------------------- */

export interface EleccionCards {
  variantes: VarianteCard[];
  /** disciplinas aplicadas (para la traza: por qué NO se eligió glass, etc.) */
  disciplina: string[];
}

/** Elige las variantes para ESTA experiencia. Determinista. Disciplina del
 * doc: glass máximo UNA variante y solo si el ADN pide blur; el resto de
 * superficies se diferencia por elevación/borde/tono, no por más blur. */
export function elegirCards(e: ExperienciaDna, r: RecetaExperiencia, max = 5): EleccionCards {
  const out: VarianteCard[] = [];
  const disciplina: string[] = [];

  if (r.superficies.floatingCards) out.push("CARD_FLOATING");
  if (e.interaction.tilt) out.push("CARD_TILT");
  if (e.interaction.magnetic) out.push("CARD_MAGNETIC");
  if (e.object.use3d || e.spatial.mode === "3d" || e.spatial.mode === "immersive") out.push("CARD_3D");
  if (r.interaccion.projectReveal || r.interaccion.hoverTransform) out.push("CARD_INTERACTIVE");
  if (r.id === "spatial_product" || r.id === "3d_showcase") out.push("CARD_METRIC");
  if (/\b(portfolio|proyectos?|galeria|galer[ií]a|blog|noticias?)\b/i.test(`${r.id} ${r.nombre}`) || r.composicion.reticula === "técnica") out.push("CARD_HORIZONTAL");
  if (e.interaction.expandable) out.push("CARD_EXPANDABLE");
  if (r.objeto.tipo === "escena") out.push("CARD_MEDIA");
  out.push("CARD_STATIC");

  if (e.surface.blur >= 0.4 && out.length < max) {
    out.unshift("CARD_GLASS");
    disciplina.push("glass permitido: el ADN pide blur y hay capas con contenido detrás");
  } else {
    disciplina.push("glass limitado (doc §7): se diferencia por elevación, borde y tono, no por blur en todas partes");
  }

  const uniq = [...new Set(out)];
  return { variantes: uniq.slice(0, Math.max(2, max)), disciplina };
}

/** La CSS de las variantes elegidas, lista para el <style> del Codificador.
 * Determinista (§17): radios, sombras y timing ya coherentes con tokens. */
export function cssCards(variantes: VarianteCard[]): string {
  const bloques = variantes.map((v) => defCard(v)?.css ?? "").filter(Boolean);
  return [`/* Card System (FORJA, ${variantes.length} variantes) */`, ...bloques].join("\n");
}

/** Bloque de texto para prompts. */
export function seccionCards(eleccion: EleccionCards): string {
  const defs = eleccion.variantes.map((v) => {
    const d = defCard(v)!;
    return `- ${v}: ${d.comportamiento} — para ${d.proposito}`;
  });
  return [
    `# CARD SYSTEM (variantes semánticas con comportamiento, corrección §7)`,
    ...defs,
    ...eleccion.disciplina.map((d) => `Disciplina: ${d}`),
  ].join("\n");
}

/* Biblioteca contextual de componentes visuales v4.70.0 */
export type FamiliaComponente = "navegacion" | "conversion" | "catalogo" | "contenido" | "confianza" | "datos" | "multimedia" | "utilidad";
export interface PatronComponente { id: string; familia: FamiliaComponente; proposito: string; senales: RegExp; instruccion: string; }
export const BIBLIOTECA_COMPONENTES: ReadonlyArray<PatronComponente> = [
 {id:"NAV_STICKY_COMPACT",familia:"navegacion",proposito:"orientación persistente",senales:/tienda|cat[aá]logo|servicios|saas|corporativ|documentaci[oó]n/i,instruccion:"navegación compacta sticky y menú móvil accesible"},
 {id:"HERO_SPLIT_MEDIA",familia:"multimedia",proposito:"propuesta y evidencia visual",senales:/restaurante|pizzer[ií]a|hotel|inmobiliaria|producto|tienda|portfolio|agencia/i,instruccion:"hero dividido con media dominante relevante, no un rectángulo vacío"},
 {id:"PRODUCT_FILTER_BAR",familia:"catalogo",proposito:"encontrar productos",senales:/tienda|ecommerce|e-commerce|cat[aá]logo|productos|ropa|zapatos|muebles/i,instruccion:"categorías y filtros funcionales o claramente marcados como demo"},
 {id:"PRODUCT_CARD_BUY",familia:"catalogo",proposito:"comparar y comprar",senales:/tienda|ecommerce|e-commerce|cat[aá]logo|productos|ropa|zapatos|muebles/i,instruccion:"imagen, nombre, precio, disponibilidad y acción; no inventar descuentos"},
 {id:"MENU_CATEGORY_LIST",familia:"contenido",proposito:"explorar oferta gastronómica",senales:/restaurante|pizzer[ií]a|caf[eé]|bar\b|panader[ií]a|men[uú]/i,instruccion:"menú por categorías; sin platos ni precios inventados"},
 {id:"PROJECT_CASE_STUDY",familia:"contenido",proposito:"mostrar trabajo y resultado",senales:/portfolio|portafolio|agencia|diseñador|proyectos|estudio creativo/i,instruccion:"casos con imagen, contexto, aportación y resultado; evitar tarjetas idénticas"},
 {id:"TRUST_PROOF_STRIP",familia:"confianza",proposito:"reducir incertidumbre",senales:/servicios|agencia|consultor[ií]a|salud|cl[ií]nica|finanzas|inmobiliaria|empresa/i,instruccion:"pruebas verificables; no inventar certificaciones, testimonios ni cifras"},
 {id:"BOOKING_ACTION_PANEL",familia:"conversion",proposito:"cita o reserva",senales:/reserva|cita|barber[ií]a|sal[oó]n|cl[ií]nica|hotel|restaurante|consulta/i,instruccion:"panel de reserva claro; no fingir envío sin backend"},
 {id:"PRICING_COMPARISON",familia:"conversion",proposito:"comparar planes",senales:/saas|suscripci[oó]n|planes|precios|software|plataforma/i,instruccion:"comparativa legible sin afirmar popularidad no demostrada"},
 {id:"FEATURE_WORKFLOW",familia:"contenido",proposito:"explicar producto digital",senales:/saas|app\b|aplicaci[oó]n|plataforma|software|herramienta digital/i,instruccion:"flujo de uso por pasos con mockup contextual"},
 {id:"FAQ_DISCLOSURE",familia:"utilidad",proposito:"resolver dudas",senales:/servicios|producto|tienda|saas|curso|educaci[oó]n|env[ií]o|devoluci[oó]n/i,instruccion:"FAQ accesible con respuestas basadas en el brief"},
 {id:"CONTACT_CHANNELS",familia:"conversion",proposito:"facilitar contacto",senales:/contacto|servicios|empresa|agencia|local|profesional/i,instruccion:"canales disponibles; no inventar teléfono, dirección ni horario"},
 {id:"METRIC_HIGHLIGHT",familia:"datos",proposito:"mostrar escala real",senales:/dashboard|anal[ií]tica|m[eé]tricas|finanzas|saas|resultados/i,instruccion:"usar datos proporcionados o etiquetar las cifras como demostración"}
];
export interface SeleccionComponentes { patrones: PatronComponente[]; instrucciones: string[]; }
export function seleccionarComponentesVisuales(contexto: string, max = 5): SeleccionComponentes {
 const candidatos=BIBLIOTECA_COMPONENTES.filter(p=>p.senales.test(contexto.slice(0,12000))); const out:PatronComponente[]=[]; const familias=new Set<FamiliaComponente>();
 for(const p of candidatos){if(out.length>=Math.max(2,Math.min(max,8)))break;if(familias.has(p.familia)&&out.length>=2)continue;out.push(p);familias.add(p.familia);}
 return {patrones:out,instrucciones:out.map(p=>`- ${p.id} (${p.proposito}): ${p.instruccion}`)};
}
export function seccionBibliotecaComponentes(s: SeleccionComponentes): string { return ["# BIBLIOTECA DE COMPONENTES VISUALES (selección contextual)","Implementa patrones pertinentes con HTML semántico, accesibilidad y diseño adaptable. No conviertas todo en tarjetas ni inventes datos.",...(s.instrucciones.length?s.instrucciones:["- Elige componentes por la función del proyecto; evita secciones decorativas."]),"Si una función requiere backend no disponible, identifícala como demostración."].join("\n"); }

