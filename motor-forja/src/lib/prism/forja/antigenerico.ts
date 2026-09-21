/** FORJA IA — Motor ANTI-GENÉRICO de FORJA IA: aprender de las páginas malas.
 *
 * Idea del dueño del proyecto (v3.0.0): saber «esto funciona» es útil, pero
 * saber «esto parece una plantilla genérica de IA y debemos evitarlo» es
 * muchísimo más poderoso. FORJA IA no debe perseguir «diseños bonitos» sino
 * DISEÑOS CON IDENTIDAD.
 *
 * Este archivo es el detector de saturación: examina el HTML de una maqueta
 * o entrega y cuenta cuántos SÍNTOMAS de plantilla genérica presenta. Es
 * determinista y gratis (regex sobre el código, igual que vision.ts): corre
 * en CADA maqueta y en CADA entrega sin gastar una sola llamada de modelo.
 *
 * El informe usa el formato que el dueño describió:
 *
 *   PATRÓN DETECTADO
 *   ❌ Hero centrado
 *   ❌ Título gigante
 *   ❌ Botón azul por defecto
 *   ❌ Tres tarjetas gemelas
 *   ❌ Fondo degradado
 *   ❌ Blobs decorativos
 *   Nivel de saturación: ALTO
 *   Motivo: patrón excesivamente frecuente en interfaces generadas por IA.
 *
 * Y lo más importante: cada síntoma lleva su ALTERNATIVA, porque prohibir
 * sin proponer solo produce otro tipo de plantilla.
 *
 * Todo es puro: sin red, sin modelo, sin estado. El Revisor recibe este
 * informe como candidatos a defecto (los confirma o descarta con criterio,
 * igual que hace con el Inspector visual) y el Juez de Originalidad del
 * Estudio lo usa como EVIDENCIA física, no como opinión.
 */

/** Un síntoma de plantilla genérica detectado en el HTML. */
export interface SintomaGenerico {
  id: string;
  /** nombre visible: «Hero centrado», «Botón azul por defecto»… */
  nombre: string;
  /** por qué este síntoma delata plantilla */
  motivo: string;
  /** qué hacer en su lugar: prohibir sin proponer no sirve */
  alternativa: string;
  /** 1..3: 3 = delata plantilla por sí solo, 1 = solo suma al conjunto */
  gravedad: 1 | 2 | 3;
}

/** Informe completo de genericidad de una página. */
export interface InformeAntiGenerico {
  /** síntomas encontrados, ordenados por gravedad */
  sintomas: SintomaGenerico[];
  /** "bajo" (0-1), "medio" (2-3) o "alto" (4+) */
  nivel: "bajo" | "medio" | "alto";
  /** el motivo agregado, en el lenguaje del dueño */
  motivo: string;
  /** 0..100: cuánta identidad propia conserva la página */
  puntuacionIdentidad: number;
  /** síntomas que NO se detectaron (para el prompt: qué evitar igualmente) */
  recordatorio: string[];
}

/** Nivel de saturación → motivo agregado. */
const MOTIVOS_NIVEL: Record<InformeAntiGenerico["nivel"], string> = {
  bajo: "La página conserva identidad propia; vigila que no deriva a plantilla al añadir secciones.",
  medio: "Empieza a parecer una plantilla generada por IA: sustituye los síntomas por decisiones con intención.",
  alto: "Patrón excesivamente frecuente en interfaces generadas por IA. Esto no es un diseño, es una plantilla con otro logo.",
};

/** El catálogo: cada patrón que el dueño señaló como «lo que hace una IA
 * genérica», con su detector, su motivo y su alternativa. */
interface DefinicionSintoma {
  id: string;
  nombre: string;
  motivo: string;
  alternativa: string;
  gravedad: 1 | 2 | 3;
  /** devuelve true si el HTML presenta el síntoma */
  detecta: (html: string) => boolean;
}

/** azules por defecto de Tailwind / generadores: blue-500..700 y
 * sky-500..700, en hex y rgb. */
const AZULES_DEFECTO =
  /#(?:3b82f6|2563eb|1d4ed8|1e40af|0ea5e9|0284c7|60a5fa)\b|rgb\(\s*(?:59\s*,\s*130\s*,\s*246|37\s*,\s*99\s*,\s*235|29\s*,\s*78\s*,\s*216|30\s*,\s*58\s*,\s*138|14\s*,\s*165\s*,\s*233|2\s*,\s*132\s*,\s*199)\s*\)/gi;

const defs: DefinicionSintoma[] = [
  {
    id: "hero-centrado",
    nombre: "Hero centrado",
    motivo:
      "el hero centrado con el CTA al medio es LA composición por defecto de todo generador: cero intención compositiva",
    alternativa:
      "composición asimétrica o editorial: que la jerarquía la den el peso, la posición y el espacio, no el centro",
    gravedad: 2,
    detecta: (h) => {
      if (!/<h1[\s>]/i.test(h)) return false;
      const tieneHero = /<(?:section|header|div|main)[^>]*\s(?:class|id)="[^"]*(?:hero|banner|masthead|portada)[^"]*"[^>]*>/i.test(h);
      if (!tieneHero) return false;
      // ¿centrado? a) en el propio bloque (estilo inline o clase text-center);
      const bloque = h.match(/<(?:section|header|div)[^>]*\s(?:class|id)="[^"]*(?:hero|banner|masthead|portada)[^"]*"[^>]*>[\s\S]{0,800}?<\/(?:section|header|div)>/i)?.[0] ?? "";
      if (/text-align\s*:\s*center|text-center/i.test(bloque)) return true;
      // b) en el CSS: una regla .hero { … text-align:center … }
      const cssHero = h.match(/\.(?:hero|banner|masthead|portada)[\w-]*[^{}]*\{[^{}]*\}/gi) ?? [];
      return cssHero.some((regla) => /text-align\s*:\s*center/i.test(regla));
    },
  },
  {
    id: "titulo-gigante",
    nombre: "Título gigante",
    motivo:
      "el titular descomunal sin escala secundaria grita «plantilla landing»: el tamaño no es jerarquía",
    alternativa:
      "escala modular (1.25) con ritmo real y un titular que convoque en una frase, no que ocupe media pantalla",
    gravedad: 2,
    detecta: (h) => {
      if (!/<h1[\s>]/i.test(h)) return false;
      const h1 = h.match(/<h1[\s\S]{0,400}?<\/h1>/i)?.[0] ?? "";
      // el tamaño puede estar inline, en cualquier regla CSS cuyo selector
      // mencione h1 (h1{…}, .hero h1{…}, h1,h2{…}) o en la clase del h1
      const fuentes: string[] = [h1];
      fuentes.push(...(h.match(/[^{}]*\bh1\b[^{}]*\{[^{}]*\}/gi) ?? []));
      const claseH1 = h1.match(/class="([^"]*)"/i)?.[1];
      if (claseH1) {
        for (const cls of claseH1.split(/\s+/).filter(Boolean)) {
          const esc = cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          fuentes.push(...(h.match(new RegExp(`\\.${esc}[^{}]*\\{[^{}]*\\}`, "gi")) ?? []));
        }
      }
      const texto = fuentes.join("\n");
      const rem = texto.match(/font-size\s*:\s*([\d.]+)\s*rem/i);
      if (rem && parseFloat(rem[1]) >= 3.5) return true;
      const px = texto.match(/font-size\s*:\s*([\d.]+)\s*px/i);
      if (px && parseFloat(px[1]) >= 56) return true;
      const clamp = texto.match(/clamp\([^,]*,\s*([\d.]+)\s*(?:rem|vw)/i);
      if (clamp && parseFloat(clamp[1]) >= 4) return true;
      return /text-(?:[6-9]xl|8xl)|text-\[\s*(?:4|5)rem/i.test(texto);
    },
  },
  {
    id: "boton-azul",
    nombre: "Botón azul por defecto",
    motivo:
      "el azul #3B82F6 es la identidad de Tailwind, no del proyecto: es la señal nº 1 de «esto lo hizo una IA»",
    alternativa:
      "un acento propio derivado del ADN del proyecto, usado SOLO en la acción principal",
    gravedad: 3,
    detecta: (h) => {
      if (!/<(?:button|a)[\s>]/i.test(h)) return false;
      AZULES_DEFECTO.lastIndex = 0;
      return AZULES_DEFECTO.test(h);
    },
  },
  {
    id: "tres-tarjetas",
    nombre: "Tres tarjetas gemelas",
    motivo:
      "tres tarjetas iguales debajo del hero es el patrón más repetido de la IA: rellena el hueco en vez de explicar",
    alternativa:
      "módulos asimétricos, una lista editorial o la representación que merecen esos datos (timeline, mapa, nodos)",
    gravedad: 2,
    detecta: (h) => {
      const rejilla = /grid-template-columns\s*:[^;}]*\b(?:1fr\s*){3}/i.test(h) ||
        /grid-cols-3/i.test(h) ||
        /repeat\(\s*3\s*,\s*minmax\(0(?:px)?,\s*1fr\)\)/i.test(h);
      if (!rejilla) return false;
      const tarjetas = (h.match(/class="[^"]*(?:card|feature|benefic|servic)[^"]*"/gi) ?? []).length;
      const articulos = (h.match(/<article[\s>]/gi) ?? []).length;
      return tarjetas >= 3 || articulos >= 3;
    },
  },
  {
    id: "fondo-degradado",
    nombre: "Fondo degradado",
    motivo:
      "el gradiente de fondo para «dar vida» es decoración sin idea: el color debe ser lenguaje, no tapete",
    alternativa:
      "superficies planas con contraste real; si hace falta un degradado, que sea sutil y con función (profundidad, foco)",
    gravedad: 1,
    detecta: (h) =>
      /(?:background(?:-image)?|bg)\s*:\s*(?:linear|radial)-gradient/i.test(h) ||
      /bg-gradient-to-(?:r|b|br|tr)/i.test(h),
  },
  {
    id: "blobs-decorativos",
    nombre: "Blobs decorativos",
    motivo:
      "círculos difuminados flotando de fondo: el ornamento genérico de las landings de IA desde 2022",
    alternativa:
      "espacio negativo generoso; si la página necesita una forma, que tenga función (contener, separar, señalar)",
    gravedad: 2,
    detecta: (h) => {
      const clase = /class="[^"]*blob[^"]*"|\.blob\b|--blob/i.test(h);
      const circulosBlur = /border-radius\s*:\s*50(?:%|\s)|border-radius\s*:\s*9999px/i.test(h) &&
        /filter\s*:\s*blur\(/i.test(h);
      const radialFondo = /background(?:-image)?\s*:[^;}]*radial-gradient[^;}]*(?:circle|50%)/i.test(h) &&
        /position\s*:\s*absolute/i.test(h);
      return clase || circulosBlur || radialFondo;
    },
  },
  {
    id: "glassmorphism-excesivo",
    nombre: "Glassmorphism en exceso",
    motivo:
      "tres o más superficies con desenfoque: el efecto está sustituyendo a la composición",
    alternativa:
      "profundidad por bordes, sombras de dos capas y contraste de superficie; el vidrio, si acaso, en UNA superficie",
    gravedad: 2,
    detecta: (h) => (h.match(/backdrop-filter\s*:/gi) ?? []).length >= 3,
  },
  {
    id: "dashboard-cajitas",
    nombre: "Dashboard de cajitas",
    motivo:
      "sidebar + KPIs en fila + gráfico + tabla: el dashboard que describiste («cajitas») sin preguntar qué merece el dato",
    alternativa:
      "antes de maquetar, elegir la representación de la información (timeline, mapa, nodos, capas…) y dejar que los componentes sirvan a esa representación",
    gravedad: 3,
    detecta: (h) => {
      const senales = [
        /class="[^"]*(?:sidebar|sidenav|aside-nav)[^"]*"|<aside[\s>]/i,
        /class="[^"]*(?:kpi|stat-card|metric|stat)[^"]*"/i,
        /<table[\s>]/i,
        /class="[^"]*(?:chart|graph|spark)[^"]*"|<canvas[\s>]|<svg[^>]*(?:chart|graph)/i,
        /class="[^"]*(?:dashboard|panel-grid|widgets)[^"]*"/i,
      ];
      return senales.filter((s) => s.test(h)).length >= 3;
    },
  },
];

/** Niveles → umbral. 4 o más síntomas = saturación ALTA (el informe del
 * dueño con 6 síntomas cae aquí). */
function nivelDe(sintomas: SintomaGenerico[]): InformeAntiGenerico["nivel"] {
  if (sintomas.length >= 4) return "alto";
  if (sintomas.length >= 2) return "medio";
  return "bajo";
}

/** Ejecuta el detector sobre un HTML (maqueta o código final). Nunca lanza:
 * con entrada vacía devuelve un informe «bajo» honesto. */
export function detectarGenericidad(html: string): InformeAntiGenerico {
  if (!html || html.length < 60) {
    return {
      sintomas: [],
      nivel: "bajo",
      motivo: MOTIVOS_NIVEL.bajo,
      puntuacionIdentidad: 100,
      recordatorio: CATALOGO_ANTIPATRONES.map((s) => s.nombre),
    };
  }
  const sintomas: SintomaGenerico[] = [];
  for (const d of defs) {
    let ok = false;
    try {
      ok = d.detecta(html);
    } catch {
      ok = false; // un detector nunca tumba el informe
    }
    if (ok) {
      sintomas.push({
        id: d.id,
        nombre: d.nombre,
        motivo: d.motivo,
        alternativa: d.alternativa,
        gravedad: d.gravedad,
      });
    }
  }
  sintomas.sort((a, b) => b.gravedad - a.gravedad);
  const nivel = nivelDe(sintomas);
  const penal = sintomas.reduce((s, x) => s + x.gravedad * 12, 0);
  const detectados = new Set(sintomas.map((s) => s.id));
  return {
    sintomas,
    nivel,
    motivo: MOTIVOS_NIVEL[nivel],
    puntuacionIdentidad: Math.max(20, 100 - penal),
    recordatorio: defs.filter((d) => !detectados.has(d.id)).map((d) => d.nombre),
  };
}

/** Lista pública de los patrones prohibidos (para UI y docs). */
export const CATALOGO_ANTIPATRONES: ReadonlyArray<{
  id: string;
  nombre: string;
  alternativa: string;
}> = defs.map((d) => ({ id: d.id, nombre: d.nombre, alternativa: d.alternativa }));

/** El informe en el formato EXACTO que describió el dueño, para el chat. */
export function textoInformeAntiGenerico(informe: InformeAntiGenerico): string {
  if (informe.sintomas.length === 0) {
    return `### Anti-genérico ✅\nSin síntomas de plantilla: la página se lee como un proyecto con identidad propia (${informe.puntuacionIdentidad}/100).`;
  }
  const nivel = informe.nivel.toUpperCase();
  const lineas = informe.sintomas.map((s) => `- ❌ **${s.nombre}** — ${s.motivo}.`);
  const alternativas = informe.sintomas.map((s) => `- **${s.nombre}** → ${s.alternativa}`);
  return `### Anti-genérico · PATRÓN DETECTADO

${lineas.join("\n")}

**Nivel de saturación: ${nivel}** (${informe.puntuacionIdentidad}/100 de identidad)

**Motivo:** ${informe.motivo}

**Cómo salir del patrón:**
${alternativas.join("\n")}`;
}

/** Sección que viaja a los prompts del maquetador y del Codificador:
 * la lista de lo que la IA genérica hace y que aquí está PROHIBIDO. */
export function seccionAntiGenerico(): string {
  const lista = defs
    .map((d) => `- ${d.nombre} → en su lugar: ${d.alternativa}`)
    .join("\n");
  return `# Anti-genérico (OBLIGATORIO en todo el diseño)
Estos patrones delatan una interfaz generada por IA. Están PROHIBIDOS incluso
si la ficha no lo menciona; si el resultado los contiene, el Revisor lo
cuenta como defecto y el Juez de Originalidad lo penaliza:
${lista}
Regla de oro: primero decide cómo REPRESENTAR la información de este negocio,
después elige los componentes. Un diseño con identidad no es «bonito»: es
reconocible como ESTE proyecto.`;
}

/** Resumen corto para notas de maqueta y traza de UI. */
export function resumenAntiGenerico(informe: InformeAntiGenerico): string {
  if (informe.sintomas.length === 0) return `Anti-genérico: limpio (${informe.puntuacionIdentidad}/100)`;
  const nombres = informe.sintomas.map((s) => s.nombre).join(", ");
  return `Anti-genérico: saturación ${informe.nivel.toUpperCase()} — ${nombres}`;
}
