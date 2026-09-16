/** FORJA IA — Catálogo de habilidades de FORJA IA.
 *
 * Una habilidad es un bloque de conocimiento especializado que se AÑADE al
 * prompt del Diseñador cuando el proyecto lo necesita. Es el segundo nivel
 * del entrenamiento: el nivel base (conocimiento/disenador.ts) enseña a
 * diseñar; las habilidades enseñan a diseñar UNA COSA CONCRETAMENTE.
 *
 * Están diseñadas para activarse por proyecto en Ajustes, y el núcleo puede
 * activar automáticamente las que el tipo de web requiera (ver nucleo.ts).
 * Cada bloque cabe en ~700 caracteres, la misma disciplina que LIMITE_MODO:
 * si una habilidad no cabe ahí, está mal escrita.
 */

export interface HabilidadForja {
  id: string;
  nombre: string;
  /** para qué tipo de proyecto aplica (se activa sola si coincide) */
  aplicaA: string[];
  /** el bloque que viaja al Diseñador */
  texto: string;
}

export const HABILIDADES_FORJA: HabilidadForja[] = [
  {
    id: "landing-conversion",
    nombre: "Landing de conversión",
    aplicaA: ["landing", "producto", "servicio"],
    texto: `[Habilidad: landing de conversión]
El CTA principal visible sin scroll (hero con altura 100svh máximo).
Beneficios como tarjetas de 3 columnas (1 en móvil) con icono + título +
1 frase. Prueba social antes del CTA final: cifras, logos o testimonios.
Formulario corto: email + botón; cada campo extra baja la conversión.
Jerarquía del hero: propuesta de valor (31-39px) > subtítulo > CTA > micro-confianza («Gratis, sin tarjeta»).`,
  },
  {
    id: "dashboard-datos",
    nombre: "Dashboards y paneles",
    aplicaA: ["dashboard", "panel", "admin"],
    texto: `[Habilidad: dashboards]
Densidad alta, decoración cero: nada de sombras grandes ni gradientes.
KPIs como tarjetas: cifra grande (31px, tabular-nums) + variación con
flecha + etiqueta pequeña. Gráfico principal ocupa 2/3, tabla 1/3.
Alineación numérica derecha con font-variant-numeric: tabular-nums.
Estados de carga y vacío diseñados (esqueleto, mensaje con acción).
Navegación lateral colapsable a iconos por debajo de 1024px.`,
  },
  {
    id: "tienda-producto",
    nombre: "E-commerce y fichas de producto",
    aplicaA: ["tienda", "ecommerce", "producto"],
    texto: `[Habilidad: e-commerce]
Ficha de producto: galería a la izquierda (sticky en desktop, carrusel en
móvil), compra a la derecha: precio grande, variantes como chips táctiles,
CTA fijo abajo en móvil. Precio con font-variant-numeric: tabular-nums.
Badge de stock/envío en verde; tachado solo si hay descuento real.
Grid de catálogo: 4 columnas desktop, 2 tablet, carrusel horizontal móvil.`,
  },
  {
    id: "dark-premium",
    nombre: "Modo oscuro premium",
    aplicaA: ["cualquiera"],
    texto: `[Habilidad: modo oscuro]
Fondo #0F172A (nunca negro puro); superficies elevadas más claras por
nivel (#1E293B, #273549). Texto #F1F5F9, secundario #94A3B8.
El acento sube luminosidad (ej. #60A5FA en vez de #3B82F6) para pasar el
contraste. Sombras casi invisibles: separación por borde 1px rgba blanco
al 8%. Imágenes con filter: brightness(0.9) para no quemar la pantalla.`,
  },
  {
    id: "animacion-sutil",
    nombre: "Animación y microinteracción",
    aplicaA: ["cualquiera"],
    texto: `[Habilidad: microinteracción]
Duraciones: 150ms para hover/focus, 250ms para paneles, 400ms máximo para
transiciones grandes. Curva estándar cubic-bezier(0.2, 0, 0, 1).
Entrada al scroll con IntersectionObserver: fade + translateY(12px),
una vez, sin repetir. Todo bajo @media (prefers-reduced-motion: no-preference).
Hover en tarjetas: translateY(-2px) + sombra suave; nunca escalar texto.`,
  },
  {
    id: "seo-tecnico",
    nombre: "SEO técnico base",
    aplicaA: ["landing", "blog", "tienda", "portfolio"],
    texto: `[Habilidad: SEO técnico]
<title> único de 50-60 caracteres y meta description de 140-160.
Un solo h1 que contiene la palabra clave; jerarquía h2/h3 sin saltos.
Imagenes con alt descriptivo y loading="lazy" salvo la del hero.
Enlaces externos con rel="noopener". URL semántica si hay rutas.
Schema.org LocalBusiness/Article/Product según el tipo de página.`,
  },
  {
    id: "tendencias-2026",
    nombre: "Tendencias actuales (con juicio)",
    aplicaA: ["cualquiera"],
    texto: `[Habilidad: tendencias con juicio]
Tipografía display GRANDE en el hero (clamp(40px, 8vw, 88px), peso 700+,
interlineado 1.05) combinada con cuerpo pequeño: contraste de escala.
Grid bento para muestras de funcionalidades: celdas variadas en un grid
de 12 col, siempre con la celda principal destacando.
Glass sutil solo si aporta: backdrop-filter con fondo sólido de respaldo.
Gradientes mesh para fondos de marca tech, con texto SIEMPRE plano encima.
Regla: 1 tendencia protagonista por proyecto. Dos ya es imitación.`,
  },
  {
    id: "spa-webapp",
    nombre: "Apps SaaS (interfaz de producto)",
    aplicaA: ["spa", "app", "saas", "crm", "erp"],
    texto: `[Habilidad: interfaz de producto]
Tríada de estados en cada vista: vacío (mensaje + acción de crear),
cargando (esqueleto con las mismas formas del contenido) y error
(motivo + botón reintentar). Nada de pantallas en blanco.
Tablas: cabecera sticky, filas 44px, acciones al hover, paginación visible.
Sidebar con secciones agrupadas y elemento activo marcado con fondo.
Toasts abajo a la derecha, 4s, con acción deshacer si la operación borra.
Atajos de teclado para acciones frecuentes (n, /, esc) documentados.`,
  },
  {
    id: "negocio-local",
    nombre: "Negocio local y reservas",
    aplicaA: ["restaurante", "salon", "clinica", "taller", "local", "cita"],
    texto: `[Habilidad: negocio local]
El horario, el teléfono y la dirección visibles SIN scroll (o en barra
fija móvil). Botón de reserva/cita en cada sección importante, no solo
en el hero. Mapa con enlace a navegación y foto real del local.
Galería de fotos del negocio ANTES que decoración genérica: la gente
confía en lo que ve. Menú/servicios con precios claros en tabla simple.
Schema.org LocalBusiness con horarios; href="tel:" en el teléfono.`,
  },
];

/** Habilidad por id, o undefined. */
export function habilidadPorId(id: string): HabilidadForja | undefined {
  return HABILIDADES_FORJA.find((h) => h.id === id);
}

/** Bloques de las habilidades pedidas, en el orden del catálogo (mismo
 * criterio determinista que textoDeModos en agent-modes.ts). */
export function bloquesDeHabilidades(ids: readonly string[]): string[] {
  return HABILIDADES_FORJA.filter((h) => ids.includes(h.id)).map((h) => h.texto);
}

/** Activación automática: dada la petición del usuario, sugiere habilidades
 * por palabras clave. Barato y determinista; el Diseñador siempre puede
 * prescindir del bloque si no aplica. */
export function habilidadesSugeridas(mensaje: string): string[] {
  const m = mensaje.toLowerCase();
  const out: string[] = [];
  for (const h of HABILIDADES_FORJA) {
    if (h.aplicaA.some((a) => a !== "cualquiera" && m.includes(a))) {
      out.push(h.id);
    }
  }
  if (m.includes("oscuro") || m.includes("dark")) out.push("dark-premium");
  if (m.includes("animad") || m.includes("movimiento")) out.push("animacion-sutil");
  if (m.includes("seo") || m.includes("google")) out.push("seo-tecnico");
  return [...new Set(out)];
}
