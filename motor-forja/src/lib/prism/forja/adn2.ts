/** FORJA IA — ADN VISUAL 2.0 de FORJA IA (v4.0.0, fase 3 del plan maestro).
 *
 * El ADN v1 (adn-visual.ts) demostró que una identidad explícita mejora todo
 * el pipeline: las 3 direcciones dejan de ser tres webs distintas y pasan a
 * ser variaciones del mismo ADN. Pero se quedó corto en 4 dimensiones
 * (personalidad, sensación, lenguaje, prohibiciones): un Codificador puede
 * respetarlas y aun así producir algo genérico porque falta QUÉ composición,
 * QUÉ tipografía, QUÉ color, QUÉ espaciado, QUÉ movimiento, QUÉ
 * representación y QUÉ interacción hacen que esto sea ESTE proyecto.
 *
 * El ADN 2.0 extiende a 14 dimensiones:
 *
 *   IDENTIDAD  · PERSONALIDAD · SENSACIÓN   · COMPOSICIÓN
 *   TIPOGRAFÍA · COLOR        · ESPACIADO   · MOVIMIENTO
 *   REPRESENTACIÓN · INTERACCIÓN · PROHIBICIONES · REFERENCIAS
 *   ANTI-PATRONES · ACCESIBILIDAD
 *
 * Y —clave del plan— debe poder CONVERTIRSE en: DESIGN.md, tokens.css,
 * contexto para skills, reglas de critique, reglas del Revisor,
 * restricciones del Codificador y criterios de la Arena (exportadores-adn.ts).
 *
 * Compatibilidad total: cualquier AdnVisual de v3 entra por
 * `adn2DesdeAdn1()` y queda completo; los parseadores de v3 siguen
 * funcionando porque AdnVisual2 ES un AdnVisual con más campos.
 */

import {
  type AdnVisual,
  type EjeSensacion,
  MAX_PROHIBICIONES_ADN,
  sanearAdn,
} from "./adn-visual";
import {
  type AdnVisual2,
  MAX_LISTA_ADN2,
  listaLimpia,
} from "./tipos-v4";
import { REPRESENTACIONES } from "./representacion";
import { sintetizarExperienciaDna } from "./experience-dna";

/* ------------------------- construcción y migración ----------------------- */

/** ADN 2.0 vacío pero con las listas listas para rellenar. */
export function adn2Vacio(): AdnVisual2 {
  return {
    personalidad: [],
    sensacion: [],
    lenguaje: [],
    prohibiciones: [],
    identidad: "",
    composicion: [],
    tipografia: [],
    color: [],
    espaciado: [],
    movimiento: [],
    representacion: [],
    interaccion: [],
    referencias: [],
    antiPatrones: [],
    accesibilidad: [],
  };
}

/** ¿Tiene este ADN 2.0 contenido mínimo para viajar a los prompts? */
export function adn2EstaVacio(adn: AdnVisual2 | null | undefined): boolean {
  if (!adn) return true;
  const vacio = (xs: unknown[]): boolean => !xs || xs.length === 0;
  return (
    !adn.identidad &&
    vacio(adn.personalidad) &&
    vacio(adn.sensacion) &&
    vacio(adn.composicion) &&
    vacio(adn.tipografia) &&
    vacio(adn.color) &&
    vacio(adn.espaciado) &&
    vacio(adn.movimiento) &&
    vacio(adn.representacion) &&
    vacio(adn.interaccion) &&
    vacio(adn.prohibiciones) &&
    vacio(adn.referencias) &&
    vacio(adn.antiPatrones) &&
    vacio(adn.accesibilidad)
  );
}

/** Ruta de migración v3 → v4: rellena las 10 dimensiones nuevas desde lo
 * que ya sabemos (ADN v1 + la petición), con valores anti-genéricos por
 * defecto coherentes con el resto del módulo. Nunca lanza: si falta el
 * ADN v1 se construye desde la petición.
 *
 * v4.5 — CORRECCIONES §2/§9: el ADN 2.0 ahora incorpora el vocabulario del
 * EXPERIENCE DNA (spatial/depth/surface/object) según las señales de la
 * petición, y el movimiento deja la regla estrecha de 200-300ms como
 * ÚNICA filosofía: micro 150-300ms · componente 250-600ms · reveal
 * 500-1000ms · escena 800-1600ms · ambiente continuo (por categorías). */
export function adn2DesdeAdn1(adn1: AdnVisual | null | undefined, mensaje: string): AdnVisual2 {
  const base: AdnVisual = adn1 && !adnVacio1(adn1)
    ? adn1
    : adn1DeRespaldo(mensaje);
  const m = (mensaje || "").toLowerCase();
  const sensible = /\b(banco|financ|legal|abogad|cl[ií]nic|salud|gobierno|segur)\b/.test(m);
  const editorial = /\b(portfolio|portafolio|revista|blog|editorial|agencia|fotograf)\b/.test(m);
  const vivaz = /\b(fiesta|evento|musica|m[uú]sic|juego|gaming|bar|restaurante|moda)\b/.test(m);

  // v4.5: las señales de experiencia (deterministas y gratis) enriquecen
  // el ADN con spatial/depth/surface/object — el ADN deja de ser solo visual
  const { dna: exp } = sintetizarExperienciaDna(mensaje);
  const moderna = exp.spatial.depth >= 0.5 || exp.motion.intensity >= 0.6;

  return {
    ...base,
    identidad:
      (sensible && "una institución fiable que inspire calma y control") ||
      (editorial && "una voz editorial con carácter y aire") ||
      (vivaz && "una marca vivaz que se recuerda en diez segundos") ||
      "un producto profesional con decisiones propias, nunca una plantilla",
    composicion: listaLimpia([
      editorial ? "retícula editorial asimétrica con foco claro" : "retícula de 12 columnas con rompimientos intencionales",
      "un solo focal point por pantalla",
      vivaz ? "densidad alta controlada con aire en la jerarquía" : "espacio negativo generoso alrededor de lo importante",
      ...(moderna
        ? [
            `profundidad por capas (modo ${exp.spatial.mode}, ${exp.spatial.layers} capas declaradas)`,
            exp.object.use3d ? "objeto 3D focal con tratamiento propio" : "superficies flotantes con elevación distinta por capa",
          ]
        : []),
    ], MAX_LISTA_ADN2),
    tipografia: listaLimpia([
      "pareja display + texto con contraste real de peso",
      "escala modular 1.25 con ritmo vertical estable",
      "números tabulares en datos y precios",
    ], MAX_LISTA_ADN2),
    color: listaLimpia([
      sensible ? "paleta sobria: un dominante oscuro, un acento sereno, grises con matiz" : "un color dominante con carácter, un acento único, neutros con matiz propio",
      "prohibido el azul por defecto (#3b82f6 y familia) como identidad",
      "el acento se usa en UNA cosa por pantalla: la acción importante",
    ], MAX_LISTA_ADN2),
    espaciado: listaLimpia([
      "escala de espaciado en múltiplos de 4",
      "secciones que respiran: mínimo 96px de aire entre bloques",
      "el aire es jerarquía: lo importante tiene más espacio, no más ruido",
    ], MAX_LISTA_ADN2),
    movimiento: listaLimpia([
      // v4.5 §9: timing POR CATEGORÍA, no una regla global estrecha
      "microinteracción 150-300ms · componente 250-600ms · reveal 500-1000ms · escena 800-1600ms · ambiente continuo",
      exp.motion.intensity >= 0.6
        ? "el movimiento tiene coreografía: entrada escalonada, parallax por capas y flotación del objeto"
        : "solo se mueve lo que significa algo: feedback, foco, transición",
      "respeto total de prefers-reduced-motion",
    ], MAX_LISTA_ADN2),
    representacion: listaLimpia(
      REPRESENTACIONES.slice(0, 3).map((r) => r.nombre),
      MAX_LISTA_ADN2
    ),
    interaccion: listaLimpia([
      "estados hover/focus/active definidos para TODO lo clicable",
      "foco visible siempre (nunca outline:none sin alternativa)",
      "feedback inmediato en cada acción (menos de 100ms)",
      ...(exp.interaction.richness >= 0.7 ? ["interacción avanzada: magnetic CTA y tilt en piezas clave"] : []),
    ], MAX_LISTA_ADN2),
    referencias: [],
    antiPatrones: listaLimpia([
      "hero centrado + título gigante + botón azul",
      "tres tarjetas gemelas como única forma de listar",
      "dashboard de cajitas sin narrativa",
    ], MAX_LISTA_ADN2),
    accesibilidad: listaLimpia([
      "contraste AA (4.5:1 texto, 3:1 texto grande) en pares declarados",
      "navegación completa por teclado con orden lógico",
      "alt en toda imagen y label en todo campo",
    ], MAX_LISTA_ADN2),
  };
}

function adnVacio1(adn: AdnVisual): boolean {
  return (
    adn.personalidad.length === 0 &&
    adn.sensacion.length === 0 &&
    adn.lenguaje.length === 0 &&
    adn.prohibiciones.length === 0
  );
}

function adn1DeRespaldo(mensaje: string): AdnVisual {
  const m = (mensaje || "").toLowerCase();
  const sensible = /\b(banco|financ|legal|abogad|cl[ií]nic|salud|gobierno|segur)\b/.test(m);
  const vital = /\b(fiesta|evento|musica|m[uú]sic|juego|gaming|bar|restaurante|moda)\b/.test(m);
  return sanearAdn({
    personalidad: sensible
      ? ["sobrio", "fiable", "preciso", "cercano"]
      : vital
        ? ["energético", "expresivo", "directo", "moderno"]
        : ["profesional", "claro", "preciso", "moderno"],
    sensacion: [
      { eje: "confianza", valor: sensible ? 9 : 7 },
      { eje: "claridad", valor: 8 },
      { eje: "innovación", valor: vital ? 8 : 5 },
      { eje: "agresividad", valor: vital ? 6 : 2 },
    ],
    lenguaje: [
      "superficies limpias",
      "jerarquía evidente en 10 segundos",
      "tipografía protagonista",
      "espacios negativos generosos",
    ],
    prohibiciones: [
      "tarjetas genéricas en fila",
      "gradientes excesivos",
      "dashboards de cajitas",
      "blobs decorativos de fondo",
      "glassmorphism en exceso",
      "layouts repetitivos de plantilla",
    ],
  });
}

/* -------------------------------- saneo ----------------------------------- */

/** Sanea un ADN 2.0 completo: dedupe, topes, valores 0..10 en la sensación
 * e identidad con tope de longitud. Idempotente. */
export function sanearAdn2(adn: AdnVisual2): AdnVisual2 {
  const sensacion: EjeSensacion[] = [];
  const vistos = new Set<string>();
  for (const e of adn.sensacion) {
    const eje = (e.eje ?? "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 48);
    if (eje.length < 3 || vistos.has(eje)) continue;
    vistos.add(eje);
    sensacion.push({ eje, valor: Math.max(0, Math.min(10, Math.round(Number(e.valor) || 0))) });
  }
  const core = sanearAdn({
    personalidad: adn.personalidad,
    sensacion,
    lenguaje: adn.lenguaje,
    prohibiciones: adn.prohibiciones,
  });
  return {
    ...core,
    identidad: (adn.identidad ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
    composicion: listaLimpia(adn.composicion ?? [], MAX_LISTA_ADN2),
    tipografia: listaLimpia(adn.tipografia ?? [], MAX_LISTA_ADN2),
    color: listaLimpia(adn.color ?? [], MAX_LISTA_ADN2),
    espaciado: listaLimpia(adn.espaciado ?? [], MAX_LISTA_ADN2),
    movimiento: listaLimpia(adn.movimiento ?? [], MAX_LISTA_ADN2),
    representacion: listaLimpia(adn.representacion ?? [], MAX_LISTA_ADN2),
    interaccion: listaLimpia(adn.interaccion ?? [], MAX_LISTA_ADN2),
    referencias: listaLimpia(adn.referencias ?? [], MAX_LISTA_ADN2),
    antiPatrones: listaLimpia(adn.antiPatrones ?? [], MAX_LISTA_ADN2),
    accesibilidad: listaLimpia(adn.accesibilidad ?? [], MAX_LISTA_ADN2),
  };
}

/* -------------------------------- parser ---------------------------------- */

/** Parser tolerante del bloque <adn2>. Formato (lo que pide el prompt):
 *
 *   <adn2>
 *   Identidad: una editorial técnica silenciosa
 *   Personalidad: a, b, c
 *   Sensación: confianza 8, innovación 9
 *   Composición: x; y
 *   Tipografía: ...
 *   Color: ...
 *   Espaciado: ...
 *   Movimiento: ...
 *   Representación: ...
 *   Interacción: ...
 *   Prohibiciones: ...
 *   Referencias: ...
 *   Anti-patrones: ...
 *   Accesibilidad: ...
 *   </adn2>
 *
 * Acepta tildes opcionales, orden libre, comas/puntos y coma/barras como
 * separadores y el bloque ausente (devuelve null). Si el modelo emite un
 * <adn> de v1, se acepta igual (solo rellena el core). */
export function parseAdn2(texto: string): AdnVisual2 | null {
  if (!texto) return null;
  const bloque = texto.match(/<adn2>([\s\S]*?)<\/adn2>/i);
  let fuente = bloque ? bloque[1] : "";
  if (!fuente.trim()) {
    // tolerancia v1: aceptar un <adn> clásico como ADN 2.0 incompleto
    const bloque1 = texto.match(/<adn>([\s\S]*?)<\/adn>/i);
    fuente = bloque1 ? bloque1[1] : "";
  }
  if (!fuente.trim()) return null;

  const listaDe = (nombres: string): string[] => {
    const re = new RegExp(`^\\s*(?:${nombres})\\s*:\\s*(.+)$`, "gim");
    const items: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(fuente)) !== null) {
      for (const trozo of m[1].split(/[,;/]\s*/)) {
        const t = trozo.replace(/\s+/g, " ").trim().slice(0, 90);
        if (t.length >= 3) items.push(t);
      }
    }
    return items;
  };

  const identidad = (fuente.match(/^\s*identidad\s*:\s*(.+)$/im)?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  const sensacion: EjeSensacion[] = [];
  // captura la línea «Sensación: …» y las líneas de continuación que no
  // sean una etiqueta nueva («X:»): soporta ejes en una línea y en varias
  let cuerpoSens = "";
  let enSens = false;
  for (const linea of fuente.split("\n")) {
    if (/^\s*sensaci[óo]n\s*:/i.test(linea)) {
      enSens = true;
      cuerpoSens += `${linea.replace(/^\s*sensaci[óo]n\s*:\s*/i, "")}\n`;
      continue;
    }
    if (enSens) {
      if (!linea.trim() || /^\s*[a-záéíóúñü][a-záéíóúñü -]{2,20}\s*:\s/.test(linea)) {
        enSens = false;
        continue;
      }
      cuerpoSens += `${linea}\n`;
    }
  }
  const reEje = /([a-záéíóúñü]{3,20})\s*[:=]?\s*(\d{1,2})(?:\s*\/\s*10)?/gi;
  let e: RegExpExecArray | null;
  while ((e = reEje.exec(cuerpoSens)) !== null) {
    const eje = e[1].trim().toLowerCase();
    if (eje.length < 3) continue;
    sensacion.push({ eje, valor: Math.max(0, Math.min(10, Number(e[2]))) });
  }

  const crudo: AdnVisual2 = {
    ...adn2Vacio(),
    identidad,
    personalidad: listaDe("personalidad|rasgos"),
    sensacion,
    composicion: listaDe("composici[óo]n|composicion"),
    tipografia: listaDe("tipograf[ií]a|tipografia"),
    color: listaDe("colores?"),
    espaciado: listaDe("espaciado|espacio"),
    movimiento: listaDe("movimiento|motion"),
    representacion: listaDe("representaci[óo]n|representacion"),
    interaccion: listaDe("interacci[óo]n|interaccion"),
    lenguaje: listaDe("lenguaje( visual)?"),
    prohibiciones: listaDe("prohibiciones|prohibici[óo]n|no hacer|evitar"),
    referencias: listaDe("referencias"),
    antiPatrones: listaDe("anti-?patrones"),
    accesibilidad: listaDe("accesibilidad|a11y"),
  };
  if (adn2EstaVacio(crudo)) return null;
  return sanearAdn2(crudo);
}

/* ------------------------------ salidas texto ----------------------------- */

/** Bloque para el chat: el usuario VE el ADN 2.0 completo. */
export function textoAdn2(adn: AdnVisual2): string {
  const lista = (xs: string[]): string =>
    xs.length ? xs.map((x) => `- ${x}`).join("\n") : "-";
  const sens = adn.sensacion.length
    ? adn.sensacion.map((e) => `${e.eje} **${e.valor}/10**`).join(" · ")
    : "—";
  return [
    `**Identidad:** ${adn.identidad || "—"}`,
    `**Personalidad:** ${adn.personalidad.join(", ") || "—"}`,
    `**Sensación:** ${sens}`,
    `**Composición:**\n${lista(adn.composicion)}`,
    `**Tipografía:**\n${lista(adn.tipografia)}`,
    `**Color:**\n${lista(adn.color)}`,
    `**Espaciado:**\n${lista(adn.espaciado)}`,
    `**Movimiento:**\n${lista(adn.movimiento)}`,
    `**Representación:** ${adn.representacion.join(" · ") || "—"}`,
    `**Interacción:**\n${lista(adn.interaccion)}`,
    `**Prohibiciones:**\n${lista(adn.prohibiciones)}`,
    adn.antiPatrones.length ? `**Anti-patrones:**\n${lista(adn.antiPatrones)}` : "",
    adn.accesibilidad.length ? `**Accesibilidad:**\n${lista(adn.accesibilidad)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Sección mandatoria para prompts (Codificador, maquetador, Revisor,
 * jueces, Arena). Las 14 dimensiones en versión compacta y dura. */
export function seccionAdn2(adn: AdnVisual2): string {
  const sens = adn.sensacion.map((e) => `${e.eje} ${e.valor}/10`).join(", ");
  const linea = (etiqueta: string, xs: string[]): string =>
    xs.length ? `${etiqueta}: ${xs.join("; ")}` : "";
  return [
    `# ADN visual 2.0 del proyecto (OBLIGATORIO, aplica a cada decisión)`,
    `Identidad: ${adn.identidad || "un producto con decisiones propias, nunca una plantilla"}`,
    `Personalidad: ${adn.personalidad.join(", ") || "—"}`,
    `Sensación objetivo: ${sens || "—"}`,
    linea("Composición", adn.composicion),
    linea("Tipografía", adn.tipografia),
    linea("Color", adn.color),
    linea("Espaciado", adn.espaciado),
    linea("Movimiento", adn.movimiento),
    linea("Representación de la información", adn.representacion),
    linea("Interacción", adn.interaccion),
    `PROHIBIDO en este proyecto: ${[...adn.prohibiciones, ...adn.antiPatrones].join("; ") || "—"}`,
    linea("Accesibilidad mínima", adn.accesibilidad),
    `El resultado debe ser reconocible como ESTE proyecto, nunca como una plantilla; Revisor, jueces y Arena auditan contra este ADN.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Prompt que pide el bloque <adn2> al Diseñador. Viaja como parte del
 * system/user del rol; el parser de arriba lee su salida. */
export function promptBloqueAdn2(mensaje: string): string {
  return [
    `## Define el ADN visual 2.0 ANTES de proponer direcciones`,
    `Para el proyecto: «${mensaje.slice(0, 200)}»`,
    `Responde EXACTAMENTE con este bloque (tildes opcionales, orden libre):`,
    ``,
    `<adn2>`,
    `Identidad: (la identidad del proyecto en UNA frase)`,
    `Personalidad: (2-6 rasgos con nombre)`,
    `Sensación: (ejes con nota 0..10, ej. confianza 8, innovación 9)`,
    `Composición: (2-4 decisiones de retícula, foco y densidad)`,
    `Tipografía: (pareja, escala y ritmo)`,
    `Color: (dominante + acento con intención; nada de azul por defecto)`,
    `Espaciado: (escala y aire)`,
    `Movimiento: (qué anima, cuándo, cuánto)`,
    `Representación: (cómo se representa la información de ESTE negocio)`,
    `Interacción: (estados, foco, feedback)`,
    `Prohibiciones: (lo que NO encaja aquí)`,
    `Referencias: (inspiración abstracta, nunca copiar)`,
    `Anti-patrones: (patrones del sector que aquí quedan baratos)`,
    `Accesibilidad: (mínimos del proyecto)`,
    `</adn2>`,
  ].join("\n");
}

/** Tope de prohibiciones totales cuando el ADN 2.0 viaja al prompt: las
 * prohibiciones del ADN más los anti-patrones no pueden ser un sermón. */
export const MAX_PROHIBICIONES_PROMPT = MAX_PROHIBICIONES_ADN + 4;
