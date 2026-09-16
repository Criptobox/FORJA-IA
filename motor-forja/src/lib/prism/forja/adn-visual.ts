/** FORJA IA — ADN Visual de FORJA IA: la identidad del proyecto ANTES de las ideas.
 *
 * Idea del dueño del proyecto (v2.4.0): en vez de que el Diseñador suelte
 * «Dirección 1 / 2 / 3» desde cero, PRIMERO define el ADN visual del proyecto:
 *
 *   · Personalidad   — rasgos con nombre (tecnológico, silencioso, preciso…)
 *   · Sensación      — ejes puntuados 0..10 (confianza 8, innovación 9, lujo 7,
 *                      agresividad 2): lo que el usuario debe SENTIR al entrar
 *   · Lenguaje       — decisiones visuales recurrentes (superficies limpias,
 *                      grandes espacios negativos, tipografía protagonista…)
 *   · Prohibiciones  — lo que NO encaja (tarjetas genéricas, gradientes
 *                      excesivos, blobs, glassmorphism en exceso…)
 *
 * Por qué cambia tanto el resultado: las 3 direcciones dejan de ser tres webs
 * distintas y pasan a ser TRES VARIACIONES DEL MISMO ADN; y el ADN viaja a
 * TODOS los roles (Codificador, maquetador, Revisor y Juez), de modo que una
 * prohibición de verdad prohíbe y un eje de sensación se puede auditar.
 *
 * Todo el archivo es puro y tolerante: parse por etiquetas (los modelos
 * gratuitos fallan con JSON), saneo con topes y un ADN POR DEFECTO
 * anti-genérico si el modelo se olvida del bloque — nunca se bloquea el flujo.
 */

/** Un eje de sensación con su puntuación 0..10. */
export interface EjeSensacion {
  eje: string;
  valor: number;
}

/** El ADN visual completo del proyecto. */
export interface AdnVisual {
  /** 2-6 rasgos con nombre */
  personalidad: string[];
  /** 2-6 ejes con puntuación 0..10 */
  sensacion: EjeSensacion[];
  /** 2-8 decisiones visuales recurrentes */
  lenguaje: string[];
  /** 2-8 cosas que NO encajan con este proyecto */
  prohibiciones: string[];
}

/** Topes del ADN: sin ellos un modelo verborreico rellena 20 rasgos y el
 * bloque deja de ser un ADN para ser un ensayo. */
export const MAX_TRAITOS_ADN = 6;
export const MAX_EJES_ADN = 6;
export const MAX_LENGUAJE_ADN = 8;
export const MAX_PROHIBICIONES_ADN = 8;
const MAX_TEXTO_RASGO = 48;
const MAX_TEXTO_LENGUAJE = 80;

/** ADN por defecto anti-genérico: la lista de prohibiciones es LA que el
 * dueño del proyecto pidió para TODOS los proyectos (tarjetas genéricas,
 * gradientes excesivos, blobs, dashboards de cajitas, glassmorphism en
 * exceso, layouts repetitivos). Sirve como red de seguridad cuando el modelo
 * no emite el bloque <adn>: el flujo nunca se bloquea y lo anti-genérico
 * siempre está protegido. */
export function adnDesdePeticion(mensaje: string): AdnVisual {
  const m = (mensaje || "").toLowerCase();
  const sensible = /\b(banco|financ|legal|abogad|cl[ií]nic|salud|gobierno|segur)\b/.test(m);
  const vital = /\b(fiesta|evento|musica|m[uú]sic|juego|gaming|bar|restaurante|moda)\b/.test(m);
  return {
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
  };
}

/** Limpia un item de lista: sin saltos, sin viñetas, con tope de longitud. */
function limpiarItem(s: string, max: number): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^[-*•\d.)\s]+/, "")
    .trim()
    .slice(0, max);
}

/** Sanea un ADN: dedupe, topes y valores 0..10. Idempotente. */
export function sanearAdn(adn: AdnVisual): AdnVisual {
  const uniq = (xs: string[]): string[] => {
    const vistos = new Set<string>();
    const out: string[] = [];
    for (const x of xs) {
      const t = limpiarItem(x, MAX_TEXTO_LENGUAJE);
      if (!t || t.length < 3) continue;
      const clave = t.toLowerCase();
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      out.push(t);
    }
    return out;
  };
  const sensacion = (() => {
    const vistos = new Set<string>();
    const out: EjeSensacion[] = [];
    for (const e of adn.sensacion) {
      const eje = limpiarItem(e.eje, MAX_TEXTO_RASGO).toLowerCase();
      if (!eje || vistos.has(eje)) continue;
      vistos.add(eje);
      const valor = Math.max(0, Math.min(10, Math.round(Number(e.valor) || 0)));
      out.push({ eje, valor });
    }
    return out;
  })();
  return {
    personalidad: uniq(adn.personalidad).slice(0, MAX_TRAITOS_ADN),
    sensacion: sensacion.slice(0, MAX_EJES_ADN),
    lenguaje: uniq(adn.lenguaje).slice(0, MAX_LENGUAJE_ADN),
    prohibiciones: uniq(adn.prohibiciones).slice(0, MAX_PROHIBICIONES_ADN),
  };
}

/** ¿Este ADN tiene contenido mínimo para viajar a los prompts? */
export function adnVacio(adn: AdnVisual | null | undefined): boolean {
  if (!adn) return true;
  return (
    adn.personalidad.length === 0 &&
    adn.sensacion.length === 0 &&
    adn.lenguaje.length === 0 &&
    adn.prohibiciones.length === 0
  );
}

/** Parser tolerante del bloque <adn>. Acepta:
 *   <adn> Personalidad: a, b, c / Sensación: confianza 8, innovación 9
 *         Lenguaje: x / Prohibiciones: p1 / Prohibición: p2 </adn>
 * — tildes opcionales, orden libre, viñetas, «/10», dos puntos por eje
 *   («confianza: 8») y el bloque también puede no existir (devuelve null). */
export function parseAdn(texto: string): AdnVisual | null {
  if (!texto) return null;
  const bloque = texto.match(/<adn>([\s\S]*?)<\/adn>/i);
  const fuente = bloque ? bloque[1] : "";
  if (!fuente.trim()) return null;

  const listaDe = (nombre: string): string[] => {
    const re = new RegExp(`^\\s*(?:${nombre})\\s*:\\s*(.+)$`, "gim");
    const items: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(fuente)) !== null) {
      for (const trozo of m[1].split(/[,;/]\s*/)) {
        const t = limpiarItem(trozo, MAX_TEXTO_LENGUAJE);
        if (t.length >= 3) items.push(t);
      }
    }
    return items;
  };

  const personalidad = listaDe("personalidad|rasgos");
  const lenguaje = listaDe("lenguaje|lenguaje visual");
  const prohibiciones = listaDe("prohibiciones|prohibici[óo]n|no hacer|evitar");

  // Sensación: «confianza 8», «confianza: 8», «confianza 8/10», separados
  // por comas o en una línea por eje.
  const sensacion: EjeSensacion[] = [];
  const lineasSens = fuente.match(/^\s*sensaci[óo]n(?:\s+objetiva|\s+deseada)?\s*:\s*([\s\S]*?)(?=\n\s*\S+\s*:|$)/gim) ?? [];
  const cuerpoSens = lineasSens.join("\n");
  const reEje = /([a-záéíóúñü]{3,20})\s*[:=]?\s*(\d{1,2})(?:\s*\/\s*10)?/gi;
  let e: RegExpExecArray | null;
  while ((e = reEje.exec(cuerpoSens)) !== null) {
    const eje = limpiarItem(e[1], MAX_TEXTO_RASGO);
    if (eje.length < 3) continue;
    sensacion.push({ eje, valor: Math.max(0, Math.min(10, Number(e[2]))) });
  }

  const crudo: AdnVisual = { personalidad, sensacion, lenguaje, prohibiciones };
  if (adnVacio(crudo)) return null;
  return sanearAdn(crudo);
}

/** Bloque de texto para el chat: el usuario VE el ADN del proyecto. */
export function textoAdn(adn: AdnVisual): string {
  const lista = (xs: string[]): string => xs.map((x) => `- ${x}`).join("\n");
  const sens = adn.sensacion.length
    ? adn.sensacion.map((e) => `${e.eje} **${e.valor}/10**`).join(" · ")
    : "—";
  return [
    `**Personalidad:** ${adn.personalidad.join(", ") || "—"}`,
    `**Sensación:** ${sens}`,
    `**Lenguaje visual:**\n${lista(adn.lenguaje) || "-"}`,
    `**Prohibiciones:**\n${lista(adn.prohibiciones) || "-"}`,
  ].join("\n");
}

/** Sección que viaja a los prompts de Codificador, maquetador, Revisor y
 * Juez. Es deliberadamente CORTA y mandatoria: las prohibiciones son reglas
 * duras, no consejos. */
export function seccionAdn(adn: AdnVisual): string {
  const sens = adn.sensacion.map((e) => `${e.eje} ${e.valor}/10`).join(", ");
  return [
    `# ADN visual del proyecto (OBLIGATORIO, aplica a cada decisión)`,
    `Personalidad: ${adn.personalidad.join(", ") || "—"}`,
    `Sensación objetivo: ${sens || "—"}`,
    `Lenguaje visual: ${adn.lenguaje.join("; ") || "—"}`,
    `PROHIBIDO en este proyecto: ${adn.prohibiciones.join("; ") || "—"}`,
    `El resultado debe ser reconocible como ESTE proyecto, nunca como una plantilla; el Revisor y el Juez auditan contra este ADN.`,
  ].join("\n");
}
