/** FORJA IA — Fuentes semilla para el autoaprendizaje de FORJA IA.
 *
 * v2: la IA puede ALIMENTARSE SOLA de internet. Estas son las fuentes de
 * arranque, elegidas por tres criterios: enseñan criterio de diseño (no
 * trucos de moda), son estables en el tiempo y su contenido es público.
 *
 * La lista principal incluye el repo abierto que recopila los system prompts
 * de las mejores IAs de construcción de webs (v0, Lovable, Bolt, Cursor…):
 * no se copian esos prompts (son propiedad de sus autores) — se DESTILAN en
 * principios generales, igual que un aprendiz lee a los maestros sin
 * plagiarlos. Para eso está el prompt extractor en autoaprendizaje.ts.
 *
 * El host (FORJA IA) aporta el lector real: fetch para URLs directas y su
 * buscador web para «consultas» (ver LectorWeb en autoaprendizaje.ts).
 */

export type TipoFuenteForja =
  | "prompts-ia" // cómo piden diseño las mejores IAs (destilar principios)
  | "design-system" // fundaciones: color, tipografía, espaciado, componentes
  | "accesibilidad" // WCAG, web.dev, HIG
  | "tendencias" // galerías y premios: qué se está haciendo HOY
  | "personalizada"; // v2.1: fuentes del Apartado del usuario (fuentes-usuario.ts)

export interface FuenteForja {
  id: string;
  nombre: string;
  /** URL directa (preferente) o URL de partida */
  url: string;
  tipo: TipoFuenteForja;
  /** 3 = fundacional y estable, 2 = buena, 1 = útil con filtros */
  calidad: 1 | 2 | 3;
  /** qué extraer de aquí (guía para el extractor) */
  extraer: string;
  /** consulta para encontrar MÁS fuentes así cuando toque refrescar */
  consultaAmpliacion: string;
}

export const FUENTES_SEMILLA: FuenteForja[] = [
  {
    id: "sysprompts-mejores-ias",
    nombre: "System prompts de las mejores IAs de webs (repo abierto)",
    url: "https://raw.githubusercontent.com/x1xhlol/system-prompts-and-models-of-ai-tools/main/README.md",
    tipo: "prompts-ia",
    calidad: 3,
    extraer:
      "Principios que repiten los prompts de v0, Lovable, Bolt y Cursor: cómo exigen fidelidad visual, evitan placeholders rotos, manejan estilos por defecto y ordenan construir (diseño → código). Destilar en REGLAS generales; nunca copiar frases literales.",
    consultaAmpliacion: "github system prompts v0 lovable bolt cursor repo",
  },
  {
    id: "material-3",
    nombre: "Material Design 3 — fundaciones",
    url: "https://m3.material.io/foundations",
    tipo: "design-system",
    calidad: 3,
    extraer:
      "Roles de color (surface, on-surface, primary), escala tipográfica, elevación, estados de interacción, layout adaptativo.",
    consultaAmpliacion: "material design 3 foundations color roles typography scale",
  },
  {
    id: "apple-hig",
    nombre: "Apple Human Interface Guidelines",
    url: "https://developer.apple.com/design/human-interface-guidelines",
    tipo: "design-system",
    calidad: 3,
    extraer:
      "Jerarquía visual, tipografía dinámica, áreas táctiles, feedback de interacción, diseño de formularios sin fricción.",
    consultaAmpliacion: "human interface guidelines layout typography feedback",
  },
  {
    id: "webdev-a11y",
    nombre: "web.dev — Learn Accessibility",
    url: "https://web.dev/learn/accessibility",
    tipo: "accesibilidad",
    calidad: 3,
    extraer:
      "Contraste real, orden de foco, ARIA cuando hace falta (y cuando sobra), formularios accesibles, imágenes decorativas vs informativas.",
    consultaAmpliacion: "learn accessibility web.dev contrast focus aria forms",
  },
  {
    id: "tailwind-fundamentos",
    nombre: "Tailwind CSS — conceptos (escalas y utilidades)",
    url: "https://tailwindcss.com/docs/typography",
    tipo: "design-system",
    calidad: 2,
    extraer:
      "Escalas de espaciado y tipografía que usa el ecosistema real, nombres de tamaño, cómo se traduce una ficha de diseño a clases.",
    consultaAmpliacion: "tailwind css scale spacing typography docs",
  },
  {
    id: "refactoring-ui",
    nombre: "Refactoring UI — vistas previas",
    url: "https://www.refactoringui.com/previews",
    tipo: "design-system",
    calidad: 2,
    extraer:
      "Jerarquía con peso/tono en vez de solo tamaño, densidad correcta, sombras por capas, decisiones de alineación que evitan el look amateur.",
    consultaAmpliacion: "refactoring ui hierarchy shadows alignment density",
  },
  {
    id: "awwwards-galeria",
    nombre: "Awwwards — webs premiadas del mes",
    url: "https://www.awwwards.com/websites/",
    tipo: "tendencias",
    calidad: 1,
    extraer:
      "Solo TENDENCIAS VISUALES de alto nivel (paletas recurrentes, tipografías display, patrones de hero). Filtrar agresivamente: nada de trucos de accesibilidad dudosa.",
    consultaAmpliacion: "awwwards web design trends of the month",
  },
  {
    id: "awesome-prompts",
    nombre: "Awesome ChatGPT Prompts — rol de diseñador",
    url: "https://raw.githubusercontent.com/f/awesome-chatgpt-prompts/main/README.md",
    tipo: "prompts-ia",
    calidad: 1,
    extraer:
      "Vocabulario y técnicas de rol prompting (actúa como diseñador senior, pide criterios medibles). Filtrar: solo lo que mejore reglas de diseño concretas.",
    consultaAmpliacion: "awesome chatgpt prompts act as web designer",
  },
];

/** Fuente por id (para el informe del ciclo y los ajustes). */
export function fuentePorId(id: string): FuenteForja | undefined {
  return FUENTES_SEMILLA.find((f) => f.id === id);
}
