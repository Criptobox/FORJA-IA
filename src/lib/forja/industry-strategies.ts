/**
 * Forja IA — Estrategias de composición por industria.
 *
 * El Cerebro no debe tratar "una pizzería" y "un SaaS" como la misma landing.
 * Este catálogo es una guía compacta para seleccionar estructura, navegación,
 * contenido y patrones visuales antes de generar código. No contiene plantillas.
 */

export type IndustryId =
  | "restaurant"
  | "ecommerce"
  | "saas"
  | "portfolio"
  | "agency"
  | "real-estate"
  | "health"
  | "education"
  | "finance"
  | "event"
  | "local-service"
  | "content"
  | "unknown";

export interface IndustryStrategy {
  id: IndustryId;
  aliases: string[];
  primaryGoal: string;
  recommendedSections: string[];
  navigation: string;
  conversionPattern: string;
  mobilePattern: string;
  avoid: string[];
}

export const INDUSTRY_STRATEGIES: readonly IndustryStrategy[] = [
  {
    id: "restaurant",
    aliases: ["restaurante", "restaurant", "pizzeria", "pizza", "cafeteria", "bar", "cafe", "comida"],
    primaryGoal: "hacer fácil descubrir el menú, ubicación, horario y reservar o pedir",
    recommendedSections: ["hero visual", "especialidades", "menu", "galeria", "ubicacion y horario", "reservar o pedir"],
    navigation: "compacta; en móvil prioriza menú, reservar/pedir y ubicación",
    conversionPattern: "una acción primaria persistente y secundaria para llamar o llegar",
    mobilePattern: "bottom action bar o CTA pegajoso cuando aporte valor",
    avoid: ["dashboard", "tres cards genéricas de beneficios", "hero corporativo vacío"],
  },
  {
    id: "ecommerce",
    aliases: ["tienda", "shop", "store", "ecommerce", "e-commerce", "productos", "catalogo"],
    primaryGoal: "descubrir, filtrar, comparar y comprar productos",
    recommendedSections: ["hero/campaña", "categorías", "productos destacados", "filtros", "colecciones", "beneficios", "newsletter"],
    navigation: "búsqueda, categorías y carrito visibles; filtros como drawer en móvil",
    conversionPattern: "producto → detalle → carrito → checkout, con CTAs contextuales",
    mobilePattern: "grid adaptativo, filtros bottom sheet y carrito persistente",
    avoid: ["landing de servicio", "tres columnas de texto como contenido principal"],
  },
  {
    id: "saas",
    aliases: ["saas", "software", "app", "plataforma", "startup", "productividad"],
    primaryGoal: "explicar el producto y convertir a prueba, demo o registro",
    recommendedSections: ["hero", "producto en acción", "beneficios", "workflow", "integraciones", "pricing", "faq", "cta"],
    navigation: "sticky y orientada a producto",
    conversionPattern: "demo/producto primero; prueba o demo como acción primaria",
    mobilePattern: "navegación compacta y bloques de producto apilados",
    avoid: ["stock-photo corporativa como hero", "feature cards idénticas sin jerarquía"],
  },
  {
    id: "portfolio",
    aliases: ["portfolio", "portafolio", "fotografo", "fotografía", "diseñador", "artista", "creativo"],
    primaryGoal: "mostrar trabajo y personalidad",
    recommendedSections: ["intro", "proyectos", "caso destacado", "sobre mí", "servicios", "contacto"],
    navigation: "minimalista, con acceso rápido a proyectos",
    conversionPattern: "proyecto → caso → contacto",
    mobilePattern: "galería vertical con imágenes grandes y navegación sencilla",
    avoid: ["cards de producto genéricas", "hero SaaS"],
  },
  {
    id: "agency",
    aliases: ["agencia", "agency", "marketing", "consultoria", "consultoría", "estudio"],
    primaryGoal: "demostrar capacidad y conseguir conversaciones",
    recommendedSections: ["posicionamiento", "servicios", "trabajos", "proceso", "prueba social", "equipo", "contacto"],
    navigation: "editorial o compacta según identidad",
    conversionPattern: "trabajo/proceso → confianza → contacto",
    mobilePattern: "secciones cortas y CTA persistente cuando sea necesario",
    avoid: ["lista interminable de servicios", "hero genérico con gradiente por defecto"],
  },
  {
    id: "real-estate",
    aliases: ["inmobiliaria", "inmobiliario", "real estate", "propiedades", "apartamentos", "casas"],
    primaryGoal: "explorar propiedades y solicitar información o visita",
    recommendedSections: ["búsqueda", "propiedades destacadas", "mapa", "filtros", "servicios", "agente", "contacto"],
    navigation: "búsqueda y filtros como elementos de primera clase",
    conversionPattern: "propiedad → detalles → visita/contacto",
    mobilePattern: "filtros en drawer y cards de propiedades con datos esenciales",
    avoid: ["portfolio creativo sin datos", "cards sin precio/ubicación"],
  },
  {
    id: "health",
    aliases: ["clinica", "clínica", "doctor", "dentista", "salud", "medical", "medico", "médico"],
    primaryGoal: "transmitir confianza y facilitar cita o contacto",
    recommendedSections: ["servicios", "profesionales", "credenciales", "proceso", "faq", "ubicación", "cita"],
    navigation: "muy clara; contacto/cita siempre accesible",
    conversionPattern: "servicio → confianza → cita",
    mobilePattern: "botón de cita/teléfono accesible y contenido legible",
    avoid: ["animaciones excesivas", "contraste bajo", "jerarquía ambigua"],
  },
  {
    id: "education",
    aliases: ["curso", "cursos", "educacion", "educación", "escuela", "academia", "universidad"],
    primaryGoal: "explicar aprendizaje, contenido y siguiente paso",
    recommendedSections: ["programa", "resultados", "lecciones", "profesores", "testimonios", "precio", "faq"],
    navigation: "orientada al contenido y progreso",
    conversionPattern: "contenido → resultados → inscripción",
    mobilePattern: "módulos apilados, progreso visible cuando exista",
    avoid: ["marketing vacío", "exceso de texto sin escaneo"],
  },
  {
    id: "finance",
    aliases: ["finanzas", "fintech", "banco", "inversion", "inversión", "contabilidad"],
    primaryGoal: "explicar producto y generar confianza",
    recommendedSections: ["propuesta", "producto", "seguridad", "beneficios", "datos", "faq", "contacto"],
    navigation: "sobria y predecible",
    conversionPattern: "explicación → confianza → acción",
    mobilePattern: "datos legibles, tablas desplazables y CTAs claros",
    avoid: ["promesas ambiguas", "decoración que compita con datos"],
  },
  {
    id: "event",
    aliases: ["evento", "event", "festival", "conferencia", "concierto", "wedding", "boda"],
    primaryGoal: "informar rápidamente y conseguir registro/asistencia",
    recommendedSections: ["hero", "fecha y lugar", "agenda", "ponentes/artistas", "entradas", "faq", "ubicación"],
    navigation: "anclada a información crítica",
    conversionPattern: "qué/cuándo/dónde → entradas/registro",
    mobilePattern: "fecha, lugar y CTA visibles sin buscar",
    avoid: ["estructura de SaaS", "información crítica escondida"],
  },
  {
    id: "local-service",
    aliases: ["servicio local", "plomero", "electricista", "limpieza", "taller", "barberia", "barbería", "salon", "salón"],
    primaryGoal: "conseguir contacto, llamada o reserva",
    recommendedSections: ["servicio principal", "servicios", "prueba social", "zona", "proceso", "faq", "contacto"],
    navigation: "muy corta y orientada a acción",
    conversionPattern: "problema → solución → confianza → contacto",
    mobilePattern: "teléfono/WhatsApp/reserva accesibles según el brief",
    avoid: ["navegación compleja", "hero abstracto sin acción"],
  },
  {
    id: "content",
    aliases: ["blog", "revista", "magazine", "noticias", "contenido", "newsletter"],
    primaryGoal: "facilitar descubrimiento y lectura",
    recommendedSections: ["destacado", "últimos contenidos", "categorías", "autor", "newsletter"],
    navigation: "orientada a categorías y búsqueda",
    conversionPattern: "descubrimiento → lectura → suscripción",
    mobilePattern: "lectura cómoda, imágenes y titulares jerarquizados",
    avoid: ["dashboard", "bloques de venta repetitivos"],
  },
];

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function detectIndustry(brief: string): IndustryStrategy {
  const text = normalize(brief);
  let best: { strategy: IndustryStrategy; score: number } | undefined;
  for (const strategy of INDUSTRY_STRATEGIES) {
    const score = strategy.aliases.reduce(
      (n, alias) => n + (text.includes(normalize(alias)) ? 1 : 0),
      0,
    );
    if (!best || score > best.score) best = { strategy, score };
  }
  if (best && best.score > 0) return best.strategy;
  // Ninguna alias casó: el catálogo no lleva una entrada "unknown" (sería
  // buscar algo que nunca está), así que la respuesta honesta es esta,
  // directa — sin imponer una industria que el brief no sugirió.
  return {
    id: "unknown",
    aliases: [],
    primaryGoal: "resolver la intención principal del brief sin imponer una plantilla",
    recommendedSections: [],
    navigation: "decidir según contenido",
    conversionPattern: "decidir según intención",
    mobilePattern: "responsive real",
    avoid: ["plantilla genérica repetida"],
  };
}
