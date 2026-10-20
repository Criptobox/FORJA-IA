/** FORJA IA — EL ESTUDIO de FORJA IA: pipeline jerárquico con Director
 * Creativo, tres equipos en paralelo, panel de jueces y diseño fusión.
 *
 * El dueño del proyecto dibujó (v3.0.0) la evolución de la Arena:
 *
 *                  PETICIÓN
 *                     ↓
 *              DIRECTOR CREATIVO
 *                     ↓
 *         ┌───────────┼───────────┐
 *         ↓           ↓           ↓
 *      VISIÓN A    VISIÓN B    VISIÓN C
 *         ↓           ↓           ↓
 *       MAQUETA     MAQUETA     MAQUETA
 *         └───────────┼───────────┘
 *                     ↓
 *              PANEL DE JUECES
 *          ┌─────────┼─────────┐
 *          ↓         ↓         ↓
 *       VISUAL    UX/A11Y   ORIGINALIDAD
 *          └─────────┼─────────┘
 *                     ↓
 *              DIRECTOR FINAL
 *                     ↓
 *              DISEÑO FUSIÓN
 *                     ↓
 *               (código + Revisor, como siempre)
 *
 * Coste: ~9 llamadas (1 director + 3 maquetas + 3 jueces + 1 director final
 * + 1 maqueta de fusión). Es un modo OPT-IN para proyectos importantes; el
 * duelo de la Arena (2 equipos) sigue siendo el modo económico de siempre.
 *
 * Filosofía igual que todo el módulo:
 *  · etiquetas simples, no JSON (modelos gratuitos);
 *  · los 3 equipos y los 3 jueces corren en PARALELO (Promise.all);
 *  · el Juez de Originalidad recibe como EVIDENCIA el informe del motor
 *    anti-genérico (antigenerico.ts) — física, no opinión;
 *  · respaldo honesto en cada fase: si el Director no emite visiones
 *    legibles se cae al pipeline normal (ejecutarForja); si falla un juez su
 *    nota es neutra; si falla el Director Final decide el panel; si falla
 *    la maqueta de fusión gana la maqueta base. NUNCA se bloquea.
 *  · el usuario manda: la fusión es la recomendación del sistema; puede
 *    continuar con otra visión si prefiere su idea.
 */

import type {
  ArtefactoForja,
  ConfigForja,
  DireccionDiseno,
  ModeloDeRol,
  PeticionForja,
  PropuestaMaqueta,
  ResultadoForja,
  RolForja,
  RondaForja,
} from "./tipos";
import { PERFIL_DEFECTO, PERFILES, techoTokens } from "./tipos";
import type { DependenciasForja, EventoForja } from "./nucleo";
import { ejecutarForja, mensajeDisenador } from "./nucleo";
import { PROMPT_MAQUETA } from "./maqueta";
import {
  continuarSalidaTruncada,
  continuarConLlamada,
} from "./continuacion-nucleo";
import { extraerCodigo } from "./nucleo-extractos";
import { EQUIPO_FORJA } from "./equipo";
import {
  adnDesdePeticion,
  parseAdn,
  sanearAdn,
  seccionAdn,
  textoAdn,
  type AdnVisual,
} from "./adn-visual";
import {
  detectarGenericidad,
  resumenAntiGenerico,
  seccionAntiGenerico,
  type InformeAntiGenerico,
} from "./antigenerico";
import { seccionRepresentacion } from "./representacion";
import { promptDisenador } from "./conocimiento/disenador";
import { bloquesDeHabilidades, habilidadesSugeridas } from "./habilidades";
import { reglasParaPrompt } from "./conocimiento-usuario";
import type { LeccionArena } from "./conocimiento-global";
import { parseLeccionesArena } from "./arena";

/* ------------------------------- contratos ------------------------------- */

/** Una visión divergente del Director Creativo: una forma distinta de
 * representar la información del negocio, no otra paleta. */
export interface VisionCreativa {
  n: 1 | 2 | 3;
  nombre: string;
  /** representación + decisión compositiva */
  enfoque: string;
  porQue: string;
}

/** Ids del panel de jueces. Cada juez especializa su mirada. */
export type JuezEstudioId = "visual" | "ux" | "originalidad";

export interface JuezEstudio {
  id: JuezEstudioId;
  nombre: string;
  /** criterios que puntúa, 0..10 cada uno */
  criterios: readonly string[];
  instruccion: string;
}

/** El panel: tres miradas, como dibujó el dueño. 6 criterios × 10 = 60
 * puntos máximo por visión (visual 30, UX 20, originalidad 10). */
export const JUECES_ESTUDIO: ReadonlyArray<JuezEstudio> = [
  {
    id: "visual",
    nombre: "Juez visual",
    criterios: ["jerarquia", "color", "tipografia"],
    instruccion:
      "Juzgas SOLO la mirada: ¿en 10 segundos se entiende qué mirar primero? ¿La paleta es propia y coherente (60-30-10, contraste real)? ¿La tipografía tiene intención y escala con ritmo? Ignoras accesibilidad técnica y originalidad: no te tocan.",
  },
  {
    id: "ux",
    nombre: "Juez UX y accesibilidad",
    criterios: ["accesibilidad", "responsive"],
    instruccion:
      "Juzgas SOLO uso y accesibilidad: contraste AA, alt, labels, foco visible, semántica, un solo h1; ¿funciona a 375px con áreas táctiles de 44px y sin scroll horizontal? Ignoras estética y originalidad: no te tocan.",
  },
  {
    id: "originalidad",
    nombre: "Juez de originalidad",
    criterios: ["originalidad"],
    instruccion:
      "Juzgas SOLO identidad: ¿esto se distingue de una plantilla de IA? Recibirás el INFORME ANTI-GENÉRICO de cada visión (detección automática de patrones genéricos): úsalo como evidencia física. Sin síntomas no basta para un 10: premia la decisión compositiva que se recuerda («la web de los nodos», «el mapa vivo»), no la decoración.",
  },
];

/** La nota de un juez del panel. */
export interface NotaJuez {
  juez: JuezEstudioId;
  nombre: string;
  /** criterio → nota, por visión (1..3); lo ausente = 5 */
  notas: Record<number, Record<string, number>>;
  /** total del juez por visión (suma de sus criterios) */
  total: [number, number, number];
  razones: string;
  lecciones: LeccionArena[];
  /** true si el juez falló (cuota/red): notas neutras, sin lecciones */
  ausente?: boolean;
}

/** El veredicto agregado del panel. */
export interface PanelEstudio {
  jueces: NotaJuez[];
  /** suma de los 3 jueces por visión (máx 60) */
  totales: [number, number, number];
  ganador: 1 | 2 | 3;
}

/** Lo que dicta el Director Final tras ver el panel. */
export interface FusionDirector {
  /** la maqueta que sirve de BASE del diseño final */
  base: 1 | 2 | 3;
  adoptar: string[];
  evitar: string[];
  razones: string;
}

export interface OpcionesEstudio {
  /** lo que MÁS te importa, en tus palabras; los jueces lo ponderan */
  criteriosDelUsuario?: string;
  /** modelo de los jueces; si falta, el activo del chat (fallback) */
  juez?: ModeloDeRol;
}

export interface ResultadoEstudio {
  modo: "estudio";
  adn: AdnVisual;
  visiones: VisionCreativa[];
  /** una maqueta por visión; null = esa visión falló o fue descalificada */
  maquetas: (PropuestaMaqueta | null)[];
  /** informe anti-genérico por visión (misma posición; null si no hubo html) */
  informes: (InformeAntiGenerico | null)[];
  panel: PanelEstudio;
  fusion: FusionDirector;
  /** la propuesta FUSIONADA, lista para el flujo de siempre:
   * aprobada → continuarForja, ajustada → ajustarMaquetaForja */
  propuesta: PropuestaMaqueta;
  fichaTexto: string;
  /** lecciones del panel para registrarLeccionesArena (evolución) */
  lecciones: LeccionArena[];
  rondas: RondaForja[];
  /** texto final para el chat */
  respuesta: string;
  /** true = el Director no emitió visiones y se usó el pipeline normal */
  fallbackUsado: boolean;
  /** el resultado normal si fallbackUsado (la UI lo muestra tal cual) */
  resultadoFallback?: ResultadoForja;
}

/* ------------------------------- parsers --------------------------------- */

/** Extrae el bloque <ficha> (o, si el modelo se olvidó de la etiqueta, el
 * texto a partir de «Tipo de web:», que es el encabezado de la ficha). */
function extraerFicha(texto: string): string {
  const bloque = texto.match(/<ficha>([\s\S]*?)<\/ficha>/i);
  if (bloque) return bloque[1].trim();
  const idx = texto.search(/tipo de web\s*:/i);
  return idx >= 0 ? texto.slice(idx).trim() : "";
}

/** Parser tolerante de <visiones>: «1. Nombre — enfoque — por qué», con
 * tildes opcionales, guiones mezclados y viñetas. Máximo 3. */
export function parseVisiones(texto: string): VisionCreativa[] {
  if (!texto) return [];
  const bloque = texto.match(/<visiones>([\s\S]*?)<\/visiones>/i);
  const fuente = bloque ? bloque[1] : texto;
  const out: VisionCreativa[] = [];
  const re = /^\s*(\d)[.)]\s*(.+?)\s*[—–-]\s*(.+?)(?:\s*[—–-]\s*(.+?))?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fuente)) !== null && out.length < 3) {
    const n = Number(m[1]);
    if (n < 1 || n > 3) continue;
    if (out.some((v) => v.n === n)) continue;
    const enfoque = m[3].trim().slice(0, 220);
    if (enfoque.length < 10) continue;
    out.push({
      n: n as 1 | 2 | 3,
      nombre: m[2].trim().slice(0, 48),
      enfoque,
      porQue: (m[4] ?? "").trim().slice(0, 200),
    });
  }
  return out;
}

/** Parser tolerante del <fusion base="N"> del Director Final. */
export function parseFusion(texto: string, defectoBase: 1 | 2 | 3): FusionDirector {
  const bloque = texto.match(/<fusion([^>]*)>([\s\S]*?)<\/fusion>/i);
  const attrs = bloque?.[1] ?? texto;
  const cuerpo = bloque?.[2] ?? texto ?? "";
  const baseAttr = attrs.match(/base\s*=\s*"?([123])"?/i)?.[1];
  const baseTexto = cuerpo.match(/base\s*[:=]\s*(?:visi[óo]n\s*)?([123])/i)?.[1];
  const base = (Number(baseAttr ?? baseTexto ?? defectoBase) || defectoBase) as 1 | 2 | 3;
  const listaDe = (nombre: string): string[] => {
    const m = cuerpo.match(new RegExp(`<${nombre}>([\\s\\S]*?)<\\/${nombre}>`, "i"));
    if (!m) return [];
    return m[1]
      .split(/\n+/)
      .map((l) => l.trim().replace(/^[-*\d.)\s]+/, "").trim())
      .filter((l) => l.length >= 8)
      .slice(0, 4)
      .map((l) => l.slice(0, 200));
  };
  return {
    base,
    adoptar: listaDe("adoptar"),
    evitar: listaDe("evitar"),
    razones: (cuerpo.match(/<razones>([\s\S]*?)<\/razones>/i)?.[1] ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 600),
  };
}

const NFD = (s: string): string => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Parser de las <puntuacion vision="N" criterio="x"> de un juez. Solo
 * cuenta los criterios DE ESE juez; lo ausente = 5. */
export function parseNotasJuez(
  texto: string,
  juez: JuezEstudio
): { notas: Record<number, Record<string, number>>; total: [number, number, number]; razones: string; lecciones: LeccionArena[] } {
  const notas: Record<number, Record<string, number>> = { 1: {}, 2: {}, 3: {} };
  const re =
    /<puntuacion\s+(?:vision="([123])"\s+criterio="([a-záéíóú]+)"|criterio="([a-záéíóú]+)"\s+vision="([123])")\s*>\s*([\d.]+)\s*<\/puntuacion>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    const vision = Number(m[1] ?? m[4]);
    const criterio = NFD(m[2] ?? m[3] ?? "");
    if (vision !== 1 && vision !== 2 && vision !== 3) continue;
    if (!juez.criterios.some((c) => NFD(c) === criterio)) continue;
    const n = Math.round(Number(m[5]));
    notas[vision][criterio] = Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 5;
  }
  const total = [1, 2, 3].map((v) => {
    const porCriterio = juez.criterios.map((c) => notas[v][NFD(c)] ?? 5);
    return porCriterio.reduce((s, x) => s + x, 0);
  }) as [number, number, number];
  return {
    notas,
    total,
    razones: (texto.match(/<razones>([\s\S]*?)<\/razones>/i)?.[1] ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500),
    lecciones: parseLeccionesArena(texto),
  };
}

/* ------------------------------- prompts --------------------------------- */

/** Prompt del juez del panel: identidad propia, criterios propios, y el
 * mismo formato de etiquetas que la Arena (tolerante, sin JSON). */
export function promptJuezEstudio(
  juez: JuezEstudio,
  criteriosDelUsuario?: string
): string {
  const criterios = juez.criterios
    .map((c) => `- ${c}: 0 a 10 (5 = mediocre, 9-10 = excepcional, sé exigente)`)
    .join("\n");
  return `## Quién eres
Eres el ${juez.nombre} del panel del Estudio de FORJA IA: especialista
imparcial. La misma petición la resolvieron TRES visiones del mismo ADN
(visión 1, 2 y 3); tú puntúas SOLO tu especialidad en cada una.

## Tu especialidad
${juez.instruccion}

## Tus criterios (0..10)
${criterios}${
    criteriosDelUsuario?.trim()
      ? `\n\n## Peso extra del dueño del proyecto\n«${criteriosDelUsuario.trim().slice(0, 200)}» — si afecta a tus criterios, refléjalo en la nota.`
      : ""
  }

## Cómo juzgas
- Juzgas lo que ves (ficha + maqueta HTML), no promesas.
- Sé exigente y diferenciador: no repartas 7s por comodidad.
- Si una visión no tiene maqueta disponible, ponle 3 y dilo en razones.

## Salida OBLIGATORIA (etiquetas exactas, sin JSON)
<puntuacion vision="1" criterio="${juez.criterios[0]}">7</puntuacion>
… (una por criterio y visión: ${juez.criterios.length} × 3)
<razones>2-4 frases comparando las tres visiones desde TU especialidad</razones>

Y SOLO si ves algo reutilizable a nivel de patrón:
<lecciones>
<leccion tipo="conservar" vision="2">qué hizo bien y merece conservarse en la fusión</leccion>
<leccion tipo="evitar" vision="1">qué patrón produjo el resultado inferior</leccion>
</lecciones>
Una línea por lección (máx 200 caracteres), concreta y generalizable.`;
}

/** Prompt del Director Final: convierte el panel en una decisión de fusión. */
export function promptDirectorFinal(): string {
  return `## Quién eres
Eres el DIRECTOR FINAL del Estudio de FORJA IA. Tres maquetadores
materializaron tres visiones del mismo ADN; el panel (visual, UX,originalidad) ya las puntuó. Tu trabajo NO es repetir el veredicto: es
diseñar la FUSIÓN — el diseño final que este proyecto merece.

## Cómo decides
1. Eliges la BASE: la visión que mejor resuelve el problema (composición y
   contenido). La fusión NO es un empate de cosas: es un diseño coherente
   con un solo punto de vista.
2. Dictas qué ADOPTAR de las otras visiones: elementos concretos que el
   panel valoró y que encajan sin romper la base (2-4, una línea cada uno).
3. Dictas qué EVITAR: patrones que el panel penalizó o que el informe
   anti-genérico detectó (1-3).

## Salida OBLIGATORIA (etiquetas exactas, sin JSON)
<fusion base="1">
<adoptar>
- de la visión 2: [elemento concreto y por qué]
- …
</adoptar>
<evitar>
- [patrón a no repetir y por qué]
- …
</evitar>
<razones>3-5 frases: por qué esta base, qué aporta cada adopción y cómo quedará el diseño final.</razones>
</fusion>`;
}

/* ------------------------------- mensajes -------------------------------- */

const MAX_HTML_JUEZ = 7000;
const MAX_HTML_DIRECTOR = 4500;

/** Mensaje del panel: las tres maquetas en paralelo. El juez de originalidad
 * recibe además el informe anti-genérico como evidencia. */
function mensajePanel(
  peticion: PeticionForja,
  adn: AdnVisual,
  visiones: VisionCreativa[],
  maquetas: (PropuestaMaqueta | null)[],
  informes: (InformeAntiGenerico | null)[],
  juez: JuezEstudio
): string {
  const bloques = visiones.map((v, i) => {
    const m = maquetas[i];
    const informe = informes[i];
    const partes = [
      `## VISIÓN ${v.n}: «${v.nombre}»`,
      `Enfoque: ${v.enfoque}`,
      m?.html
        ? `# Maqueta (recortada)\n${m.html.slice(0, MAX_HTML_JUEZ)}`
        : `# Maqueta: NO DISPONIBLE (falló su generación)`,
    ];
    if (juez.id === "originalidad" && informe) {
      partes.push(
        `# INFORME ANTI-GENÉRICO (evidencia automática)\nNivel de saturación: ${informe.nivel.toUpperCase()} · Identidad ${informe.puntuacionIdentidad}/100\n${
          informe.sintomas.length
            ? informe.sintomas.map((s) => `- ${s.nombre}: ${s.motivo}`).join("\n")
            : "- sin síntomas de plantilla detectados"
        }`
      );
    }
    return partes.join("\n\n");
  });
  return [
    `# Petición original del usuario\n${peticion.mensaje}`,
    `# ADN visual común de las tres visiones\n${textoAdn(adn)}`,
    ...bloques,
  ].join("\n\n");
}

/** Mensaje del Director Final: panel + maquetas + lecciones. */
function mensajeDirectorFinal(
  peticion: PeticionForja,
  adn: AdnVisual,
  visiones: VisionCreativa[],
  maquetas: (PropuestaMaqueta | null)[],
  informes: (InformeAntiGenerico | null)[],
  panel: PanelEstudio,
  lecciones: LeccionArena[]
): string {
  const bloques = visiones.map((v, i) => {
    const m = maquetas[i];
    const informe = informes[i];
    return [
      `## VISIÓN ${v.n}: «${v.nombre}» — total del panel: ${panel.totales[i]}/60`,
      `Enfoque: ${v.enfoque}`,
      m?.html ? `# Maqueta (recortada)\n${m.html.slice(0, MAX_HTML_DIRECTOR)}` : `# Maqueta NO DISPONIBLE`,
      informe && informe.sintomas.length
        ? `# Anti-genérico: ${resumenAntiGenerico(informe)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  });
  const mirada = panel.jueces
    .map((j) => `- ${j.nombre}: ${j.total.join(" / ")} (V1/V2/V3)${j.razones ? ` — «${j.razones.slice(0, 220)}»` : ""}`)
    .join("\n");
  const lecs = lecciones.length
    ? lecciones.map((l) => `- [${l.tipo}] ${l.texto}`).join("\n")
    : "(el panel no dejó lecciones)";
  return [
    `# Petición original del usuario\n${peticion.mensaje}`,
    `# ADN visual común\n${textoAdn(adn)}`,
    `# Veredicto del panel\n${mirada}\nLecciones del panel:\n${lecs}`,
    ...bloques,
  ].join("\n\n");
}

/** Mensaje del maquetador de fusión: la base + las directrices del Director
 * Final, con ADN y anti-genérico como siempre. */
function mensajeFusion(
  peticion: PeticionForja,
  fichaTexto: string,
  adn: AdnVisual,
  fusion: FusionDirector,
  visiones: VisionCreativa[]
): string {
  const base = visiones.find((v) => v.n === fusion.base);
  const adoptar = fusion.adoptar.length
    ? fusion.adoptar.map((a) => `- ${a}`).join("\n")
    : "- (nada concreto: mantén la base con coherencia)";
  const evitar = fusion.evitar.length
    ? fusion.evitar.map((a) => `- ${a}`).join("\n")
    : "- los patrones genéricos del bloque Anti-genérico";
  return `# Ficha de diseño base del estudio\n${fichaTexto}\n\n${seccionAdn(adn)}\n\n${seccionAntiGenerico()}\n\n## FUSIÓN DEL DIRECTOR FINAL (obligatoria)\nToma como BASE la maqueta de la visión ${fusion.base}${
    base ? ` («${base.nombre}»: ${base.enfoque})` : ""
  } — conservas su composición, su representación de la información y su contenido — y ADOPTA de las otras visiones EXACTAMENTE esto:\n${adoptar}\n\nEVITA:\n${evitar}\n\nEl resultado debe leerse como UN diseño coherente, no como un collage.\n\n# Petición original del usuario\n${peticion.mensaje}`;
}

/* ------------------------------ respuesta -------------------------------- */

function construirRespuestaEstudio(
  visiones: VisionCreativa[],
  panel: PanelEstudio,
  fusion: FusionDirector,
  informes: (InformeAntiGenerico | null)[],
  lecciones: LeccionArena[],
  hayHtmlFusion: boolean
): string {
  const filaJuez = (j: NotaJuez): string =>
    `| ${j.nombre}${j.ausente ? " (ausente)" : ""} | ${j.total[0]} | ${j.total[1]} | ${j.total[2]} |`;
  const ganadorVision = visiones.find((v) => v.n === panel.ganador);
  const titular = `🏆 El panel elige la **Visión ${panel.ganador}**${ganadorVision ? ` «${ganadorVision.nombre}»` : ""} con ${panel.totales[panel.ganador - 1]}/60, y el Director Final fusiona desde ahí.`;

  const lineaInforme = (i: number): string => {
    const inf = informes[i];
    if (!inf) return `- Visión ${i + 1}: sin informe (maqueta no generada)`;
    if (inf.sintomas.length === 0)
      return `- Visión ${i + 1}: limpio — identidad ${inf.puntuacionIdentidad}/100`;
    return `- Visión ${i + 1}: saturación ${inf.nivel.toUpperCase()} (${inf.puntuacionIdentidad}/100) — ${inf.sintomas
      .map((s) => s.nombre)
      .join(", ")}`;
  };

  const fusionTexto = [
    `### Diseño fusión`,
    `- **Base:** visión ${fusion.base}${visiones.find((v) => v.n === fusion.base) ? ` «${visiones.find((v) => v.n === fusion.base)!.nombre}»` : ""}`,
    fusion.adoptar.length ? `- **Adoptar:**\n${fusion.adoptar.map((a) => `  - ${a}`).join("\n")}` : "",
    fusion.evitar.length ? `- **Evitar:**\n${fusion.evitar.map((a) => `  - ${a}`).join("\n")}` : "",
    fusion.razones ? `\n**Por qué:** ${fusion.razones}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const aprendido = lecciones.length
    ? `\n\n### Lo que FORJA IA aprendió en este estudio\n${lecciones
        .map((l) => {
          const icono = l.tipo === "destacar" ? "✦" : l.tipo === "conservar" ? "⊕" : "✕";
          return `- ${icono} **${l.tipo.charAt(0).toUpperCase()}${l.tipo.slice(1)}**: ${l.texto}`;
        })
        .join("\n")}\nEstas lecciones entran al conocimiento (experimentos, patrones y fallos): la siguiente generación parte de aquí.`
    : "";

  const estadoHtml = hayHtmlFusion
    ? "Tienes la maqueta FUSIONADA en la vista previa."
    : "No pude generar la maqueta fusionada (cuota o red): elige visión abajo y continúo con ella.";

  return `## El Estudio de FORJA IA

**Cómo ha funcionado:** Director Creativo → 3 visiones divergentes en paralelo → Panel de Jueces (visual · UX/accesibilidad · originalidad) → Director Final → Diseño fusión.

### Panel de Jueces
| Juez | Visión 1 | Visión 2 | Visión 3 |
|---|---|---|---|
${panel.jueces.map(filaJuez).join("\n")}
| **Total (máx 60)** | **${panel.totales[0]}** | **${panel.totales[1]}** | **${panel.totales[2]}** |

${titular}

${fusionTexto}

### Anti-genérico por visión
${informes.map((_, i) => lineaInforme(i)).join("\n")}${aprendido}

${estadoHtml}

**Para continuar:** «Aprobado» → el equipo codifica la fusión · «Ajusta: …» → corrijo la fusión · «Uso la visión 2/3» → continúo con esa base tal cual.`;
}

/* ------------------------------ el estudio -------------------------------- */

/** Preparación igual que el núcleo (habilidades + reglas), sin duplicar
 * almacenamiento ni efectos: lectura pura de la config y la memoria. */
function preparar(peticion: PeticionForja, cfg: ConfigForja, deps: DependenciasForja) {
  const reglas = reglasParaPrompt(deps.memoria);
  const perfil = cfg.perfil ?? PERFIL_DEFECTO;
  const reglasGlobales = (peticion.conocimientoGlobal ?? []).slice(0, PERFILES[perfil].reglasGlobales);
  const sugeridas = new Set([...cfg.habilidades, ...habilidadesSugeridas(peticion.mensaje)]);
  return { bloques: bloquesDeHabilidades([...sugeridas]), reglas, reglasGlobales };
}

/** Ejecuta el Estudio completo. Entrada/salida alineadas con la Arena: el
 * host pasa la petición, su config, sus deps y el modelo fallback; recibe
 * un ResultadoEstudio cuya `propuesta` entra en el flujo normal de maqueta
 * (continuarForja al aprobar) y cuyas `lecciones` se persisten con
 * registrarLeccionesArena para que la evolución continúe. */
export async function estudioForja(
  peticion: PeticionForja,
  cfg: ConfigForja,
  deps: DependenciasForja,
  fallback: ModeloDeRol,
  opciones: OpcionesEstudio = {}
): Promise<ResultadoEstudio> {
  const rondas: RondaForja[] = [];
  let contadorRondas = 0;
  const ev = (fase: Extract<EventoForja, { tipo: "estudio" }>["fase"], extra: { detalle?: string; hecho?: number; total?: number; ok?: boolean } = {}) =>
    deps.onProgreso?.({ tipo: "estudio", fase, ...extra });

  const temp = (rol: RolForja): number =>
    cfg.temperaturaPorRol?.[rol] ?? EQUIPO_FORJA[rol].temperatura;

  /** Llamadora local: traza + eventos rol-inicio/fin + fragmentos, con
   * modelo por rol (o override para los jueces). Nunca lanza más arriba:
   * las fases gestionan sus propios try/catch.
   *
   * v4.2 — techo de salida desde la config (techoTokens) + segundo
   * cinturón anti-truncamiento: si la salida queda estructuralmente rota
   * (las visiones y maquetas del Estudio son LARGAS), se continúa aquí
   * con la misma llamada antes de pasarla a los jueces. */
  const llamada = async (
    rol: RolForja,
    system: string,
    user: string,
    artefacto: ArtefactoForja,
    modeloOverride?: ModeloDeRol
  ): Promise<string> => {
    const modelo = modeloOverride ?? cfg.porRol[rol] ?? fallback;
    const clave = `${modelo.providerId}:${modelo.modelId}`;
    const ronda = ++contadorRondas;
    deps.onProgreso?.({ tipo: "rol-inicio", rol, ronda, modelo: clave });
    const t0 = Date.now();
    let salida = "";
    try {
      salida = await deps.llamarModelo({
        providerId: modelo.providerId,
        modelId: modelo.modelId,
        system,
        user,
        temperatura: temp(rol),
        onFragmento: (t) => deps.onProgreso?.({ tipo: "fragmento", rol, texto: t }),
        rol, // v4.1: para el techo de salida y la cadena de failover del adaptador
        maxTokens: techoTokens(cfg, rol), // v4.2: presupuesto por rol desde la config
      });
      const res = await continuarSalidaTruncada({
        salida,
        continuarCon: continuarConLlamada(deps.llamarModelo, {
          providerId: modelo.providerId,
          modelId: modelo.modelId,
          system,
          temperatura: temp(rol),
          rol,
          maxTokens: techoTokens(cfg, rol),
          onFragmento: (t) => deps.onProgreso?.({ tipo: "fragmento", rol, texto: t }),
        }),
        onContinuacion: (n) =>
          deps.onProgreso?.({ tipo: "continuacion-nucleo", rol, ronda, n }),
      });
      salida = res.texto;
    } finally {
      rondas.push({ n: ronda, rol, artefacto, salida, modeloUsado: clave, duracionMs: Date.now() - t0 });
      deps.onProgreso?.({ tipo: "rol-fin", rol, ronda, ok: salida.length > 0 });
    }
    return salida;
  };

  /** FASE 0 — Director Creativo --------------------------------------- */
  ev("director", { detalle: "El Diseñador dirige: ADN + 3 visiones divergentes" });
  const { bloques, reglas, reglasGlobales } = preparar(peticion, cfg, deps);
  let textoDirector = "";
  try {
    textoDirector = await llamada(
      "disenador",
      promptDisenador(bloques, reglas, reglasGlobales, false, true, seccionRepresentacion(peticion.mensaje)),
      mensajeDisenador(peticion),
      "direcciones"
    );
  } catch {
    textoDirector = "";
  }

  const visiones = parseVisiones(textoDirector);
  const fichaTexto = extraerFicha(textoDirector);

  // Respaldo honesto: sin visiones legibles no hay estudio — pipeline normal.
  if (visiones.length < 2 || !fichaTexto) {
    ev("fallback", { detalle: "Visiones no legibles: se continúa con el pipeline normal" });
    const res = await ejecutarForja(peticion, cfg, deps, fallback);
    return {
      modo: "estudio",
      adn: res.adn ?? sanearAdn(adnDesdePeticion(peticion.mensaje)),
      visiones: [],
      maquetas: [],
      informes: [],
      panel: { jueces: [], totales: [0, 0, 0], ganador: 1 },
      fusion: { base: 1, adoptar: [], evitar: [], razones: "" },
      propuesta: res.maqueta ?? { direcciones: [], html: "", eleccion: 1, estado: "propuesta", notas: "", ajustes: 0 },
      fichaTexto: res.fichaTexto,
      lecciones: [],
      rondas: res.rondas,
      respuesta: res.respuesta,
      fallbackUsado: true,
      resultadoFallback: res,
    };
  }

  const adn = sanearAdn(parseAdn(textoDirector) ?? adnDesdePeticion(peticion.mensaje));

  /** FASE 1 — Tres maquetas en paralelo ------------------------------- */
  ev("maquetas", { total: visiones.length, hecho: 0 });
  const modeloCodificador = cfg.porRol.codificador ?? fallback;
  const maquetas: (PropuestaMaqueta | null)[] = await Promise.all(
    visiones.map(async (v, i): Promise<PropuestaMaqueta | null> => {
      try {
        ev("maquetas", { detalle: `visión ${v.n}: ${v.nombre}`, hecho: i, total: visiones.length });
        const user = [
          `# Ficha de diseño base del estudio\n${fichaTexto}`,
          seccionAdn(adn),
          seccionAntiGenerico(),
          `## DIRECTRIZ DEL DIRECTOR CREATIVO (obligatoria)\nTu visión asignada es la ${v.n}: «${v.nombre}».\nEnfoque: ${v.enfoque}${v.porQue ? `\nPor qué: ${v.porQue}` : ""}\nDesarrolla SOLO esta visión: es una de las tres variaciones del mismo ADN y debe ser claramente DISTINTA de las otras (otra representación de la información, otra composición), nunca un clon con otro color.`,
          `# Petición original del usuario\n${peticion.mensaje}`,
        ].join("\n\n");
        const texto = await llamada("codificador", PROMPT_MAQUETA, user, "maqueta", modeloCodificador);
        const html = extraerCodigo(texto);
        if (!html) return null;
        const informe = detectarGenericidad(html);
        const visionComoDireccion: DireccionDiseno = {
          n: v.n,
          nombre: v.nombre,
          concepto: v.enfoque,
          porQue: v.porQue || v.enfoque,
          paleta: "",
          tipografia: "",
        };
        return {
          direcciones: [visionComoDireccion],
          html,
          eleccion: v.n,
          estado: "propuesta",
          notas:
            (informe.nivel === "alto"
              ? `- ⚠ ${resumenAntiGenerico(informe)}\n`
              : "") + `- Maqueta de la visión ${v.n} del Estudio.`,
          ajustes: 0,
          genericidad: informe,
        };
      } catch {
        return null;
      }
    })
  );
  const informes = maquetas.map((m) => (m?.html ? detectarGenericidad(m.html) : null));

  /** FASE 2 — Panel de jueces en paralelo ----------------------------- */
  ev("jueces", { total: JUECES_ESTUDIO.length, hecho: 0 });
  const modeloJuez = opciones.juez ?? fallback;
  const jueces: NotaJuez[] = await Promise.all(
    JUECES_ESTUDIO.map(async (j, i): Promise<NotaJuez> => {
      try {
        ev("jueces", { detalle: j.nombre, hecho: i, total: JUECES_ESTUDIO.length });
        const texto = await llamada(
          "revisor",
          promptJuezEstudio(j, opciones.criteriosDelUsuario),
          mensajePanel(peticion, adn, visiones, maquetas, informes, j),
          "veredicto",
          modeloJuez
        );
        const parse = parseNotasJuez(texto, j);
        if (!parse.razones) {
          // juez en blanco: nota neutra y honrada
          return { juez: j.id, nombre: j.nombre, notas: parse.notas, total: parse.total, razones: "(sin razones)", lecciones: [], ausente: true };
        }
        return { juez: j.id, nombre: j.nombre, notas: parse.notas, total: parse.total, razones: parse.razones, lecciones: parse.lecciones.slice(0, 4) };
      } catch {
        return {
          juez: j.id,
          nombre: j.nombre,
          notas: {},
          total: [j.criterios.length * 5, j.criterios.length * 5, j.criterios.length * 5] as [number, number, number],
          razones: "El juez no pudo puntuar (cuota o red): nota neutra.",
          lecciones: [],
          ausente: true,
        };
      }
    })
  );

  const totales = [1, 2, 3].map((v) => jueces.reduce((s, j) => s + j.total[v - 1], 0)) as [number, number, number];
  // ganador: mayor total; desempate por el juez de originalidad; luego orden
  const juezOriginalidad = jueces.find((j) => j.juez === "originalidad");
  let ganador: 1 | 2 | 3 = 1;
  for (const v of [1, 2, 3] as const) {
    if (totales[v - 1] > totales[ganador - 1]) ganador = v;
  }
  const empatados = ([1, 2, 3] as const).filter((v) => totales[v - 1] === totales[ganador - 1]);
  if (empatados.length > 1 && juezOriginalidad) {
    ganador = empatados.reduce((mejor, v) =>
      juezOriginalidad.total[v - 1] > juezOriginalidad.total[mejor - 1] ? v : mejor
    );
  }
  const panel: PanelEstudio = { jueces, totales, ganador };

  /** FASE 3 — Director Final ------------------------------------------ */
  ev("fusion", { detalle: "El Director Final dicta la fusión" });
  const leccionesPanel = jueces.flatMap((j) => j.lecciones).slice(0, 6);
  let fusion: FusionDirector;
  try {
    const textoFusion = await llamada(
      "disenador",
      promptDirectorFinal(),
      mensajeDirectorFinal(peticion, adn, visiones, maquetas, informes, panel, leccionesPanel),
      "ficha-diseno",
      cfg.porRol.disenador ?? fallback
    );
    fusion = parseFusion(textoFusion, ganador);
  } catch {
    fusion = {
      base: ganador,
      adoptar: [],
      evitar: [],
      razones: "El Director Final no pudo decidir (cuota o red): se continúa con la base del panel.",
    };
  }

  /** FASE 4 — Maqueta de fusión ---------------------------------------- */
  ev("fusion", { detalle: `Maquetando la fusión (base: visión ${fusion.base})` });
  let htmlFusion = "";
  try {
    const texto = await llamada(
      "codificador",
      PROMPT_MAQUETA,
      mensajeFusion(peticion, fichaTexto, adn, fusion, visiones),
      "maqueta",
      modeloCodificador
    );
    htmlFusion = extraerCodigo(texto);
  } catch {
    htmlFusion = "";
  }
  let baseUsada = fusion.base;
  if (!htmlFusion) {
    // la fusión no se maquetó: se conserva la maqueta base del estudio
    const maquetaBase = maquetas[fusion.base - 1] ?? maquetas.find((m) => m?.html) ?? null;
    htmlFusion = maquetaBase?.html ?? "";
    const e = maquetaBase?.eleccion;
    baseUsada = e === 1 || e === 2 || e === 3 ? e : fusion.base;
  }

  /** Resultado ---------------------------------------------------------- */
  const propuesta: PropuestaMaqueta = {
    direcciones: visiones.map(
      (v): DireccionDiseno => ({ n: v.n, nombre: v.nombre, concepto: v.enfoque, porQue: v.porQue || v.enfoque, paleta: "", tipografia: "" })
    ),
    html: htmlFusion,
    eleccion: baseUsada,
    estado: "propuesta",
    notas: [
      `- Fusión del Director Final: base = visión ${baseUsada}${fusion.adoptar.length ? `, ${fusion.adoptar.length} adopción(es)` : ""}${fusion.evitar.length ? `, ${fusion.evitar.length} evitación(es)` : ""}.`,
      `- Panel: ${jueces.map((j) => `${j.nombre} ${j.total.join("/")}`).join(" · ")}.`,
      ...informes.map((inf, i) => `- Visión ${i + 1}: ${inf ? resumenAntiGenerico(inf) : "sin maqueta"}`),
      "- Los textos son provisionales pero realistas: revisa tono y datos.",
    ].join("\n"),
    ajustes: 0,
    genericidad: htmlFusion ? detectarGenericidad(htmlFusion) : undefined,
  };

  ev("fin", { ok: true });
  return {
    modo: "estudio",
    adn,
    visiones,
    maquetas,
    informes,
    panel,
    fusion: { ...fusion, base: baseUsada },
    propuesta,
    fichaTexto,
    lecciones: leccionesPanel,
    rondas,
    respuesta: construirRespuestaEstudio(visiones, panel, { ...fusion, base: baseUsada }, informes, leccionesPanel, htmlFusion.length > 0),
    fallbackUsado: false,
  };
}

/** Convierte el estudio en el ResultadoForja que la UI ya sabe pintar: si hubo
 * fallback es el pipeline normal; si no, el estado «esperando-aprobacion»
 * con la fusión como propuesta (aprobado → continuarForja, como siempre). */
export function comoResultadoForja(estudio: ResultadoEstudio): ResultadoForja {
  if (estudio.fallbackUsado && estudio.resultadoFallback) return estudio.resultadoFallback;
  return {
    estado: "esperando-aprobacion",
    codigo: "",
    respuesta: estudio.respuesta,
    ficha: null,
    fichaTexto: estudio.fichaTexto,
    maqueta: estudio.propuesta,
    rondas: estudio.rondas,
    veredicto: null,
    agotado: false,
    adn: estudio.adn,
  };
}
