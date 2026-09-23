/** FORJA IA — REFERENCIAS de FORJA IA (v4.0.0, sección 23 del plan).
 *
 * El usuario puede aportar: screenshot, URL, imagen, HTML existente,
 * repositorio, design system o descripción textual. El pipeline del plan:
 *
 *   REFERENCIA → ANÁLISIS → ATRIBUTOS → INSPIRACIÓN → ADN
 *
 * Regla de oro: «NUNCA copiar automáticamente una referencia. La referencia
 * debe convertirse en conocimiento abstracto». Este módulo implementa el
 * análisis DETERMINISTA de la referencia (atributos: estructura, densidad,
 * paleta, tipografía, representaciones), la conversión a INSPIRACIÓN
 * abstracta y su inyección como REFERENCIAS del ADN 2.0 — nunca como
 * tokens sueltos ni como copia del código.
 *
 * Las URLs pasan por seguridad-web.ts (dictamen + tipo de contenido). Las
 * capturas/imagenes no se «ven» aquí: eso es la capa multimodal opcional
 * (LlamadaVision en vision.ts); este módulo define su contrato y trabaja
 * con los atributos que un análisis previo le entregue.
 */

import type { AdnVisual2 } from "./tipos-v4";
import { listaLimpia } from "./tipos-v4";
import { urlAptaparaAprendizaje } from "./seguridad-web";
import { extraerAdnReferencia, principiosNoPixeles, type AdnReferencia } from "./reference-dna";

/* -------------------------------- tipos ------------------------------------ */

export type TipoReferencia =
  | "screenshot"
  | "url"
  | "imagen"
  | "html"
  | "repositorio"
  | "design-system"
  | "descripcion";

/** Una referencia aportada por el usuario. */
export interface ReferenciaForja {
  id: string;
  tipo: TipoReferencia;
  /** URL (si tipo url) — validada por seguridad */
  url?: string;
  /** texto: html crudo, descripción o notas del design system */
  texto?: string;
  /** atributos ya extraídos de una imagen/captura (por el host multimodal) */
  atributosVisuales?: string[];
  /** estado del dictamen de seguridad para url */
  urlSegura?: boolean;
}

/** Atributos abstractos extraídos de la referencia.
 * v4.5: añade el REFERENCE DNA (corrección §24) — el lenguaje de la
 * referencia convertido en especificación, no en píxeles. */
export interface AtributosReferencia {
  /** estructura dominante (por secciones) */
  estructura: string[];
  /** decisiones de color detectadas (hex o descripción) */
  color: string[];
  /** tipografía declarada */
  tipografia: string[];
  /** densidad observada (alta/media/baja) */
  densidad: "alta" | "media" | "baja" | "desconocida";
  /** representaciones de información que la referencia usa */
  representaciones: string[];
  /** riesgos: por qué NO copiarla tal cual */
  riesgos: string[];
  /** v4.5 — REFERENCE DNA: principios de lenguaje extraídos (§24) */
  adn?: AdnReferencia;
}

/** La inspiración final que entra al ADN (abstracta, con guardas). */
export interface InspiracionForja {
  /** líneas para el ADN 2.0 (dimension referencias) */
  referencias: string[];
  /** líneas para anti-patrones: lo que la referencia hace y NO hay que imitar */
  antiPatrones: string[];
  resumen: string;
}

/* -------------------------------- análisis --------------------------------- */

/** Analiza una referencia y extrae atributos abstractos. Para html/descr/DS
 * el análisis es determinista; para imagen/screenshot depende de los
 * atributosVisuales que el host ya haya extraído. */
export function analizarReferencia(ref: ReferenciaForja): AtributosReferencia {
  const texto = ref.texto ?? "";
  const atributos: AtributosReferencia = {
    estructura: [],
    color: [],
    tipografia: [],
    densidad: "desconocida",
    representaciones: [],
    riesgos: [],
  };

  // URL: dictamen de seguridad primero
  if (ref.tipo === "url" && ref.url) {
    const dictamen = urlAptaparaAprendizaje(ref.url);
    atributos.riesgos.push(dictamen.ok ? "contenido externo: usar como inspiración, nunca como copia" : `URL no apta: ${dictamen.motivos[0] ?? "rechazada por seguridad"}`);
    ref.urlSegura = dictamen.ok;
    if (!dictamen.ok) return atributos;
  }

  // Estructura: secciones con clase o encabezados
  if (ref.tipo === "html" || ref.tipo === "repositorio") {
    const secciones = [...texto.matchAll(/<(?:section|header|footer|main)[^>]*(?:class|id)="([^"]{2,40})"/gi)]
      .map((m) => m[1].split(/\s+/)[0])
      .slice(0, 8);
    atributos.estructura = listaLimpia(secciones, 8, 40);
    const hexes = [...texto.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase());
    atributos.color = listaLimpia([...new Set(hexes)], 5, 12);
    const fuentes = [...texto.matchAll(/font-family\s*:\s*([^;}]+)/gi)].map((m) => m[1].trim().slice(0, 40));
    atributos.tipografia = listaLimpia(fuentes, 3, 60);
    const dens = texto.replace(/<[^>]+>/g, " ").trim().length;
    atributos.densidad = dens > 4000 ? "alta" : dens > 1200 ? "media" : "baja";
  }

  // Descripción / design system: líneas con intención
  if (ref.tipo === "descripcion" || ref.tipo === "design-system") {
    const lineas = texto
      .split("\n")
      .map((l) => l.replace(/^[-*\d.)\s]+/, "").trim())
      .filter((l) => l.length >= 8 && l.length <= 120)
      .slice(0, 8);
    atributos.estructura = listaLimpia(lineas, 8, 90);
  }

  // Imagen/screenshot: los atributos los trajo el host
  if (ref.tipo === "imagen" || ref.tipo === "screenshot") {
    atributos.estructura = listaLimpia(ref.atributosVisuales ?? [], 6, 80);
    if (!(ref.atributosVisuales ?? []).length) {
      atributos.riesgos.push("captura sin análisis visual previo: pide atributos al host multimodal");
    }
  }

  // Representaciones reconocibles por palabras
  const cuerpo = `${texto} ${(ref.atributosVisuales ?? []).join(" ")}`.toLowerCase();
  const mapaRepr: { palabra: RegExp; nombre: string }[] = [
    { palabra: /timeline|l[ií]nea de tiempo|cronolog|historia\b/, nombre: "línea de tiempo" },
    { palabra: /mapa|cartograf|geograf/, nombre: "mapa" },
    { palabra: /compara|versus|frente a/, nombre: "comparación lado a lado" },
    { palabra: /pasos|proceso|c[óo]mo funciona/, nombre: "proceso en pasos" },
    { palabra: /dashboard|panel de control/, nombre: "dashboard" },
    { palabra: /editorial|revista|art[ií]culo/, nombre: "editorial" },
  ];
  for (const { palabra, nombre } of mapaRepr) {
    if (palabra.test(cuerpo)) atributos.representaciones.push(nombre);
  }
  atributos.representaciones = atributos.representaciones.slice(0, 4);

  // v4.5 — REFERENCE DNA (§24): el lenguaje de la referencia como
  // especificación (dark canvas, technical grid, oversized typography,
  // central 3D object, floating UI, rounded surfaces…). Con atributos
  // visuales del host multimodal O con la descripción textual.
  const fuenteDna = [texto, (ref.atributosVisuales ?? []).join(" ")].join(" ");
  if (fuenteDna.trim()) atributos.adn = extraerAdnReferencia(fuenteDna);

  return atributos;
}

/* ------------------------- atributos → inspiración -------------------------- */

/** Convierte atributos en INSPIRACIÓN abstracta: qué aprender (referencias)
 * y qué NO imitar (anti-patrones). La garantía del plan: abstracto, no copia.
 * v4.5 (§25): los principios del REFERENCE DNA viajan aquí — la referencia
 * se convierte en PRINCIPIOS (dark, technical, spatial, 3D, minimal,
 * cinematic…), nunca en píxeles. */
export function inspiracionDesdeAtributos(atributos: AtributosReferencia, tipo: TipoReferencia): InspiracionForja {
  const referencias: string[] = [];
  const antiPatrones: string[] = [];

  if (atributos.estructura.length) {
    referencias.push(`${tipo}: composición que ordena así — ${atributos.estructura.slice(0, 3).join(" → ")}`);
  }
  if (atributos.representaciones.length) {
    referencias.push(`${tipo}: usa ${atributos.representaciones.join(" y ")} para su información (valorar para el nuestro)`);
  }
  if (atributos.densidad === "media") {
    referencias.push(`${tipo}: equilibrio de densidad notable (ni saturado ni vacío)`);
  }
  if (atributos.tipografia.length) {
    referencias.push(`${tipo}: pareja tipográfica con contraste real (${atributos.tipografia[0]})`);
  }

  // Riesgos → anti-patrones
  if (atributos.densidad === "alta") antiPatrones.push(`${tipo}: densidad asfixiante — no imitar`);
  if (atributos.densidad === "baja" && tipo !== "descripcion") antiPatrones.push(`${tipo}: aire sin contenido — no imitar`);
  if (atributos.riesgos.length) antiPatrones.push(...atributos.riesgos.map((r) => `${tipo}: ${r}`));
  antiPatrones.push(`${tipo}: copiar colores/fuentes literalmente — prohibido (inspiración ≠ plantilla)`);

  // v4.5 (§25): principios del Reference DNA → aprender/no copiar
  if (atributos.adn) {
    const p = principiosNoPixeles(atributos.adn);
    referencias.push(...p.aprender);
    antiPatrones.push(...p.noCopiar);
  }

  return {
    referencias: listaLimpia(referencias, 8, 110),
    antiPatrones: listaLimpia(antiPatrones, 8, 110),
    resumen: `Referencia (${tipo}) analizada: ${atributos.estructura.length} pistas de estructura, ${atributos.representaciones.length} representaciones, ${antiPatrones.length} riesgos a no imitar${atributos.adn ? " + Reference DNA de principios" : ""}.`,
  };
}

/* ---------------------------- inyección en el ADN ---------------------------- */

/** Inyecta inspiraciones como REFERENCIAS y ANTI-PATRONES del ADN 2.0.
 * Nunca toca colores ni tipografías del ADN: eso lo decide el Diseñador. */
export function inyectarEnAdn(adn: AdnVisual2, inspiraciones: InspiracionForja[]): AdnVisual2 {
  const referencias = listaLimpia(
    [...adn.referencias, ...inspiraciones.flatMap((i) => i.referencias)],
    8,
    110
  );
  const antiPatrones = listaLimpia(
    [...adn.antiPatrones, ...inspiraciones.flatMap((i) => i.antiPatrones)],
    8,
    110
  );
  return { ...adn, referencias, antiPatrones };
}

/* ----------------------------- texto para prompts --------------------------- */

/** Sección de referencias para el prompt del Diseñador (compacta y con la
 * regla de oro visible). */
export function seccionReferencias(adn: AdnVisual2): string {
  if (!adn.referencias.length && !adn.antiPatrones.length) return "";
  return [
    `# Referencias e inspiración (regla: ABSTRACTO, nunca copiar)`,
    adn.referencias.length ? `Aprender: ${adn.referencias.join("; ")}` : "",
    adn.antiPatrones.length ? `No imitar: ${adn.antiPatrones.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Id de referencia. */
export function nuevoIdReferencia(): string {
  return `ref-${Date.now().toString(36)}`;
}
