/**
 * Forja IA — Design Architect.
 * Convierte un brief corto en una decisión de arquitectura visual.
 * No genera HTML: prepara decisiones compactas para el Code Agent.
 */
import { detectIndustry, type IndustryStrategy } from "./industry-strategies";
import { DIRECCIONES, elegirDireccion, type DireccionVisual } from "./design-directions";

export interface DesignArchitecture {
  industry: IndustryStrategy;
  direction: DireccionVisual;
  layoutPrinciples: string[];
  responsiveRules: string[];
  interactionRules: string[];
  forbiddenPatterns: string[];
  rationale: string[];
  /** Decisiones estructurales específicas del sector, no solo paleta/estilo. */
  industryBlueprint: IndustryBlueprint;
}

export interface IndustryBlueprint {
  composition: string;
  signatureComponents: string[];
  contentRequirements: string[];
  visualSignals: string[];
  avoidLayouts: string[];
}

const INDUSTRY_BLUEPRINTS: Record<IndustryStrategy["id"], IndustryBlueprint> = {
  restaurant: {
    composition: "composición editorial gastronómica: fotografía protagonista, menú legible y bloque de ubicación/horario; evitar un hero de SaaS",
    signatureComponents: ["menú con categorías y precios", "especialidad de la casa con fotografía", "horario y mapa/direcciones", "reserva o pedido con acción visible"],
    contentRequirements: ["nombre y propuesta del local", "platos o productos gastronómicos concretos", "horarios y ubicación como datos editables si faltan"],
    visualSignals: ["fotografía de comida", "texturas o color vinculados a la marca", "jerarquía de menú y precios"],
    avoidLayouts: ["tabla de precios SaaS", "grid de beneficios abstractos", "hero con métricas de negocio inventadas"],
  },
  ecommerce: {
    composition: "experiencia de catálogo: campaña o colección, navegación por categorías y productos comprables; no tratarlo como una landing de servicios",
    signatureComponents: ["buscador de productos", "categorías/colecciones", "tarjetas de producto con imagen, precio y estado", "filtros y ordenación", "carrito y CTA de compra"],
    contentRequirements: ["productos concretos coherentes con el negocio", "precios claramente diferenciados de texto promocional", "estados vacíos y variantes cuando sean relevantes"],
    visualSignals: ["fotografía de producto consistente", "jerarquía de precio y descuento solo si procede", "espaciado de catálogo y filtros usables"],
    avoidLayouts: ["tres tarjetas de servicios como página principal", "testimonios ocupando el lugar del catálogo", "checkout simulado como si procesara pagos reales"],
  },
  saas: {
    composition: "narrativa de producto: promesa concreta, interfaz o demo visual, flujo de uso y conversión a prueba/demo",
    signatureComponents: ["mockup de interfaz del producto", "flujo de trabajo en pasos", "integraciones solo si son reales o claramente ilustrativas", "planes comparables cuando el brief los pida"],
    contentRequirements: ["problema y usuario objetivo", "cómo funciona el producto", "CTA de prueba/demo"],
    visualSignals: ["capturas/mockup de interfaz", "diagramas de flujo", "jerarquía tipográfica de producto digital"],
    avoidLayouts: ["foto de stock genérica como única prueba", "catálogo de productos físicos", "métricas o clientes inventados"],
  },
  portfolio: {
    composition: "composición autoral y editorial: trabajo visual primero, ritmo asimétrico y casos destacados antes de una lista de servicios",
    signatureComponents: ["proyectos visuales de gran formato", "caso destacado con contexto y resultado", "bio breve", "contacto directo"],
    contentRequirements: ["proyectos como foco", "rol y aportación del creador", "datos desconocidos como campos sustituibles, no logros inventados"],
    visualSignals: ["imágenes grandes", "composición asimétrica controlada", "tipografía con personalidad"],
    avoidLayouts: ["grid de productos con precios", "hero SaaS con métricas", "tres cards idénticas como estructura dominante"],
  },
  agency: {
    composition: "narrativa de confianza: posicionamiento, trabajos/casos, proceso y servicios con una llamada a conversar",
    signatureComponents: ["casos de trabajo", "servicios agrupados por resultado", "proceso de colaboración", "CTA de consulta"],
    contentRequirements: ["especialización de la agencia", "entregables concretos", "prueba social solo si está disponible"],
    visualSignals: ["sistema editorial consistente", "proyectos como evidencia", "contraste claro entre posicionamiento y detalle"],
    avoidLayouts: ["lista interminable de servicios", "logos de clientes inventados", "gradiente genérico como única identidad"],
  },
  "real-estate": {
    composition: "descubrimiento de propiedades: filtros y datos de inmueble al frente, con imagen, precio, zona y acceso a detalle",
    signatureComponents: ["buscador y filtros", "fichas de propiedad con precio/zona/superficie", "detalle de inmueble", "solicitud de visita"],
    contentRequirements: ["atributos comparables de cada propiedad", "ubicación y precio cuando estén disponibles", "contacto o visita"],
    visualSignals: ["fotografía arquitectónica", "datos de inmueble escaneables", "filtros visibles y accesibles"],
    avoidLayouts: ["portfolio artístico sin atributos", "cards de beneficios abstractos", "direcciones o precios inventados como reales"],
  },
  health: {
    composition: "arquitectura de confianza y acceso: servicio/profesional, credenciales verificables, proceso de cita y ubicación",
    signatureComponents: ["servicios clínicos", "profesionales y credenciales disponibles", "solicitud de cita", "horario y ubicación"],
    contentRequirements: ["servicios claramente descritos", "credenciales solo si se proporcionan", "avisos de emergencia o límites cuando sean relevantes"],
    visualSignals: ["contraste y legibilidad altos", "espacio generoso", "iconografía funcional"],
    avoidLayouts: ["promesas médicas garantizadas", "animaciones que distraigan", "credenciales o reseñas inventadas"],
  },
  education: {
    composition: "recorrido de aprendizaje: resultado formativo, programa modular, instructor, formato y siguiente paso de inscripción",
    signatureComponents: ["programa o módulos", "resultados de aprendizaje", "perfil del instructor", "duración/formato y precio si se conoce"],
    contentRequirements: ["a quién va dirigido", "qué aprenderá la persona", "requisitos y formato si se conocen"],
    visualSignals: ["módulos con jerarquía", "indicadores de progreso solo si existen", "muestras de lecciones"],
    avoidLayouts: ["landing vacía con claims vagos", "testimonios inventados", "pricing sin explicar qué incluye"],
  },
  finance: {
    composition: "claridad y confianza: propuesta explicada, datos comprensibles, costes/riesgos y seguridad sin exageraciones",
    signatureComponents: ["resumen del producto", "tabla o explicación de costes", "seguridad y condiciones", "preguntas frecuentes"],
    contentRequirements: ["condiciones y comisiones solo si se conocen", "explicación clara de riesgos", "datos etiquetados con unidades y contexto"],
    visualSignals: ["tablas legibles", "gráficos con unidades", "pocos adornos y contraste alto"],
    avoidLayouts: ["promesas de rentabilidad", "contadores financieros ficticios", "datos sin fuente ni unidad"],
  },
  event: {
    composition: "página de evento: identidad del evento, fecha/lugar y registro/entradas visibles antes de información secundaria",
    signatureComponents: ["fecha y sede", "agenda o programación", "ponentes/artistas", "entradas o registro"],
    contentRequirements: ["qué, cuándo y dónde", "programación disponible", "CTA de asistencia"],
    visualSignals: ["key visual de evento", "tipografía expresiva alineada al tema", "fecha y ubicación destacadas"],
    avoidLayouts: ["secciones SaaS de integraciones", "fecha escondida al final", "ponentes o artistas inventados"],
  },
  "local-service": {
    composition: "conversión local: servicio y zona atendida, confianza, disponibilidad y contacto directo sin navegación compleja",
    signatureComponents: ["servicios y alcance", "zona de cobertura", "reseñas verificadas si existen", "llamada/WhatsApp/reserva"],
    contentRequirements: ["qué servicio se ofrece", "a quién atiende y dónde", "forma clara de pedir presupuesto o cita"],
    visualSignals: ["fotos del trabajo real o ilustraciones relevantes", "CTA accesible en móvil", "datos de contacto visibles"],
    avoidLayouts: ["hero abstracto sin servicio concreto", "formularios extensos antes de explicar la oferta", "reseñas falsas"],
  },
  content: {
    composition: "experiencia editorial: historia destacada, categorías, titulares con jerarquía, autoría y lectura cómoda",
    signatureComponents: ["artículo destacado", "feed de publicaciones", "categorías/búsqueda", "autor y fecha", "suscripción opcional"],
    contentRequirements: ["titulares diferenciados", "autoría/fecha cuando existan", "estructura legible para lectura larga"],
    visualSignals: ["tipografía de lectura", "imágenes editoriales", "ritmo de titulares y extractos"],
    avoidLayouts: ["grid de venta repetido", "dashboard administrativo", "titulares de relleno indistinguibles"],
  },
  unknown: {
    composition: "deducir una estructura a partir del objetivo, contenido y público del brief; no imponer una industria",
    signatureComponents: ["bloques elegidos por la tarea", "navegación proporcional al contenido", "una acción principal coherente"],
    contentRequirements: ["objetivo explícito", "contenido específico del encargo", "marcar como editable cualquier dato desconocido"],
    visualSignals: ["jerarquía clara", "composición con ritmo", "dirección visual coherente con el tema"],
    avoidLayouts: ["plantilla universal", "tres tarjetas idénticas por defecto", "contenido ficticio presentado como real"],
  },
};

export interface DesignArchitectInput {
  brief: string;
  directionId?: string;
  previousDirectionIds?: string[];
}

/** Sin `directionId` explícito (quien ya eligió una dirección en otro
 * sitio y quiere que el Architect la use, no que decida otra), delega en
 * `elegirDireccion`: el mismo hash del brief que ya usa el resto de la
 * app (mismo encargo decide igual, encargos distintos varían, evitando
 * las direcciones recientes). Reinventar la rotación aquí duplicaba la
 * lógica y, sin `previousDirectionIds` reales, siempre caía en la
 * primera del catálogo — cero variedad entre encargos. */
function chooseDirection(input: DesignArchitectInput): DireccionVisual {
  if (input.directionId) {
    const exact = DIRECCIONES.find((d) => d.id === input.directionId);
    if (exact) return exact;
  }
  return elegirDireccion(input.brief, input.previousDirectionIds ?? []).direccion;
}

export function buildDesignArchitecture(input: DesignArchitectInput): DesignArchitecture {
  const industry = detectIndustry(input.brief);
  const direction = chooseDirection(input);

  const industryBlueprint = INDUSTRY_BLUEPRINTS[industry.id] ?? INDUSTRY_BLUEPRINTS.unknown;

  const layoutPrinciples = [
    `La estructura debe servir primero al objetivo: ${industry.primaryGoal}.`,
    `Composición sectorial obligatoria: ${industryBlueprint.composition}.`,
    `Componentes distintivos que deben considerarse: ${industryBlueprint.signatureComponents.join("; ")}.`,
    `Contenido mínimo específico: ${industryBlueprint.contentRequirements.join("; ")}.`,
    `Señales visuales del sector: ${industryBlueprint.visualSignals.join("; ")}.`,
    `Usar la lógica de navegación: ${industry.navigation}.`,
    `Patrón de conversión: ${industry.conversionPattern}.`,
    `Composición de la dirección: ${direction.composicion}.`,
    "Crear jerarquía de una idea principal por viewport; no rellenar huecos con tarjetas.",
    "Variar ritmos: combinar bloques de contenido, imagen, lista, datos y espacios de descanso.",
  ];

  const responsiveRules = [
    `En móvil: ${industry.mobilePattern}.`,
    "Diseñar primero el orden móvil y después ampliar a tablet/escritorio.",
    "No reducir simplemente el escritorio: cambiar columnas, navegación y controles cuando sea necesario.",
    "Probar al menos 320, 390, 768 y escritorio.",
  ];

  const interactionRules = [
    "Cada interacción importante debe tener estado hover/focus/active/loading/disabled cuando corresponda.",
    "Preferir microinteracciones cortas con propósito; no animar por decorar.",
    "Los drawers, sheets, filtros y navegación móvil deben tener foco y cierre accesibles.",
  ];

  const forbiddenPatterns = [
    ...industry.avoid,
    ...industryBlueprint.avoidLayouts,
    "hero centrado genérico con tres cards idénticas salvo que el brief lo exija",
    "una sola tipografía system-ui para toda la página cuando la dirección exige personalidad",
    "contenido de relleno inventado para llenar espacio",
  ];

  return {
    industry,
    direction,
    industryBlueprint,
    layoutPrinciples,
    responsiveRules,
    interactionRules,
    forbiddenPatterns,
    rationale: [
      `Industria detectada: ${industry.id}.`,
      `Dirección visual: ${direction.nombre}.`,
      `Se evita una plantilla universal y se decide la composición antes del código.`,
    ],
  };
}

export function designArchitecturePrompt(a: DesignArchitecture): string {
  return [
    "[FORJA DESIGN ARCHITECT]",
    `INDUSTRIA: ${a.industry.id}`,
    `OBJETIVO: ${a.industry.primaryGoal}`,
    `DIRECCIÓN: ${a.direction.nombre}`,
    `PALETA: ${JSON.stringify(a.direction.paleta)}`,
    `TIPOGRAFÍA: ${a.direction.fuentes.display} + ${a.direction.fuentes.cuerpo}`,
    `COMPOSICIÓN VISUAL: ${a.direction.composicion}`,
    `COMPOSICIÓN DEL SECTOR: ${a.industryBlueprint.composition}`,
    `COMPONENTES CARACTERÍSTICOS: ${a.industryBlueprint.signatureComponents.join("; ")}`,
    `CONTENIDO NECESARIO: ${a.industryBlueprint.contentRequirements.join("; ")}`,
    `SEÑALES VISUALES: ${a.industryBlueprint.visualSignals.join("; ")}`,
    `DETALLE VISUAL: ${a.direction.detalle}`,
    "PRINCIPIOS:",
    ...a.layoutPrinciples.map((x) => `- ${x}`),
    "RESPONSIVE:",
    ...a.responsiveRules.map((x) => `- ${x}`),
    "INTERACCIÓN:",
    ...a.interactionRules.map((x) => `- ${x}`),
    "NO HACER:",
    ...a.forbiddenPatterns.map((x) => `- ${x}`),
  ].join("\n");
}
