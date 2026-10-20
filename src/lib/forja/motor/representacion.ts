/** FORJA IA — REPRESENTACIÓN PRIMERO: el dato antes que el componente.
 *
 * Idea del dueño del proyecto (v3.0.0): una IA normal que recibe «hazme un
 * dashboard premium» produce sidebar + KPI + gráfico + tabla + tarjetas.
 * FORJA IA debe pensar antes: «¿cómo represento los datos de ESTE negocio
 * de una forma que no parezca otro dashboard?». Solo entonces elige
 * componentes: composición radial, mapa visual, línea de tiempo, capas,
 * nodos, módulos asimétricos, visualización contextual, navegación espacial…
 *
 * No siempre: una tienda sigue necesitando su ficha de producto. Pero la
 * representación se ELIGE con criterio, no se copia por defecto. Este
 * módulo:
 *   1. Cataloga representaciones con «cuándo encajan» (regex de intención).
 *   2. sugiereRepresentaciones() rankea 3 candidatas para ESTA petición
 *      (determinista, gratis, sin modelo).
 *   3. seccionRepresentacion() viaja al Diseñador como paso OBLIGATORIO del
 *      método: representación → componentes. Es el antídoto directo contra
 *      el 6.5/10 de originalidad y el «dashboard de cajitas».
 *
 * Puro y sin estado, igual que todo el módulo.
 */

/** Una forma de representar la información del negocio. */
export interface RepresentacionInfo {
  id: string;
  /** nombre corto: «Composición radial», «Línea de tiempo»… */
  nombre: string;
  /** qué es y cuándo gana, en una o dos frases */
  descripcion: string;
  /** palabras de la petición que la sugieren (ES, insensible a mayúsculas) */
  cuando: RegExp;
  /** ejemplo concreto para despertar ideas en el Diseñador */
  ejemplo: string;
}

export const REPRESENTACIONES: ReadonlyArray<RepresentacionInfo> = [
  {
    id: "radial",
    nombre: "Composición radial",
    descripcion:
      "un centro (el dato que lo explica todo) y los demás elementos orbitando por importancia; ideal cuando todo el negocio gira alrededor de UNA cosa",
    cuando: /\b(radar|orbita|orbital|central|nucleo|núcleo|hub|copiloto|asistente|monitoreo|supervision|supervisión)\b/i,
    ejemplo:
      "una app de monitoreo con el servicio principal al centro y las métricas satélite a distintas distancias según su estado",
  },
  {
    id: "mapa",
    nombre: "Mapa visual",
    descripcion:
      "la geografía ES la interfaz: zonas, rutas y densidades sobre un mapa; ideal si el negocio ocurre en lugares físicos",
    cuando: /\b(mapa|zona|ruta|cobertura|ciudad|barrio|reparto|delivery|flota|sucursal|tienda[s]? f[ií]sic|geoloc|localizaciones?)\b/i,
    ejemplo:
      "una flota de reparto con cobertura por zonas coloreadas y cada unidad viva sobre el plano, no en una tabla",
  },
  {
    id: "timeline",
    nombre: "Línea de tiempo",
    descripcion:
      "el eje temporal como columna vertebral: pasado, presente y futuro navegables; ideal para procesos, agendas e historias",
    cuando: /\b(historia|cronolog|agenda|evento[s]?|calendario|reserva[s]?|proceso|fases|roadmap|trayectoria|itinerario|seguimiento)\b/i,
    ejemplo:
      "un estudio de eventos donde cada proyecto es una línea vertical con sus hitos y las reservas del mes a un lado",
  },
  {
    id: "capas",
    nombre: "Capas",
    descripcion:
      "la misma información en niveles superponibles (como un mapa con overlays): contexto abajo, detalle encima; ideal para análisis comparativos",
    cuando: /\b(capas|comparar|comparativa|analisis|análisis|detalle|profundidad|overlay|filtros|dimensiones?)\b/i,
    ejemplo:
      "un informe de rendimiento con la vista general de fondo y capas que se activan: canal, dispositivo, periodo",
  },
  {
    id: "nodos",
    nombre: "Nodos y relaciones",
    descripcion:
      "entidades como nodos y sus vínculos como aristas: el grafo ES el contenido; ideal para equipos, redes y catálogos conectados",
    cuando: /\b(red|relacion|relación|conexion|conexión|equipo[s]?|colaborador|grafo|dependenc|catalogo|catálogo|arquitectura|integracion|integración)\b/i,
    ejemplo:
      "la web de un estudio con cada proyecto conectado a sus disciplinas y clientes: navegar el grafo es navegar el portfolio",
  },
  {
    id: "asimetrico",
    nombre: "Módulos asimétricos",
    descripcion:
      "un lienzo en mosaico donde cada pieza mide lo que vale: lo importante ocupa más, lo secundario menos; rompe la retícula monótona sin perder orden",
    cuando: /\b(portfolio|galeria|galería|mosaico|bento|destacado[s]?| editorial|magazine|revista)\b/i,
    ejemplo:
      "un portfolio donde el proyecto estrella ocupa la mitad del lienzo y los demás se ajustan a su peso real",
  },
  {
    id: "contextual",
    nombre: "Visualización contextual",
    descripcion:
      "los datos vivos dentro de la escena real del negocio (un plano, un cuerpo, una máquina, un menú) en lugar de tarjetas abstractas",
    cuando: /\b(datos?|metricas|métricas|estadistic|tiempo real|iot|sensores?|cocina|gym|salud|vital|finanzas|presupuesto)\b/i,
    ejemplo:
      "el panel de una cocina de restaurante con cada estación marcada sobre su plano y su estado de pedidos, no una tabla de tickets",
  },
  {
    id: "espacial",
    nombre: "Navegación espacial",
    descripcion:
      "la web como un espacio que se recorre (pan, zoom, escenas contiguas) en lugar de páginas apiladas; para experiencias memorables con contenido acotado",
    cuando: /\b(experiencia|inmersiv|recorrido|tour|museo|exposicion|exposición|escena|3d|parallax|navegacion espacial|navegación espacial)\b/i,
    ejemplo:
      "la web de una galería como un recorrido continuo de salas: el scroll avanza por el espacio, el mapa lateral te sitúa",
  },
  {
    id: "editorial",
    nombre: "Editorial narrativa",
    descripcion:
      "estructura de artículo impreso: jerarquía tipográfica fuerte, columna de lectura, margen que comenta; cuando el argumento es el producto",
    cuando: /\b(blog|articulo|artículo|historia|marca|manifiesto|case study|caso de exito|caso de éxito|noticia|revista)\b/i,
    ejemplo:
      "la página de una marca con su historia como reportaje: capitales grandes, márgenes que respiran y el CTA cuando ya te convenció",
  },
  {
    id: "lienzo",
    nombre: "Lienzo único",
    descripcion:
      "una sola pantalla que lo contiene todo (sin scroll o mínimo): herramienta, juego o demo donde la interacción es el contenido",
    cuando: /\b(herramienta|calculadora|simulador|configurador|juego|demo|editor|canvas|lienzo|app de una pantalla)\b/i,
    ejemplo:
      "un configurador de producto donde el lienzo central es el producto y los controles orbitan alrededor",
  },
];

/** Una candidata con el porqué de su sugerencia. */
export interface SugerenciaRepresentacion {
  representacion: RepresentacionInfo;
  /** por qué encaja con ESTA petición (qué palabras la activaron) */
  razon: string;
}

/** Rankea las representaciones para una petición. Determinista: puntúa por
 * coincidencias de intención, desempata por orden del catálogo (estable). */
export function sugerirRepresentaciones(
  peticion: string,
  limite = 3
): SugerenciaRepresentacion[] {
  const texto = (peticion || "").toLowerCase();
  const candidatas: Array<SugerenciaRepresentacion & { puntos: number }> = [];
  REPRESENTACIONES.forEach((r, i) => {
    // copia global: cuenta CUÁNTAS señales distintas dispara el texto
    const rx = new RegExp(r.cuando.source, r.cuando.flags.includes("g") ? r.cuando.flags : r.cuando.flags + "g");
    const matches = texto.match(rx) ?? [];
    if (matches.length === 0) return;
    const primera = matches[0]?.trim() ?? "";
    // puntos = nº de señales + la señal más larga/1000; penal de orden mínimo
    // (0.001·i) solo para desempate estable entre iguales.
    const puntos = matches.length + primera.length / 1000 - i * 0.001;
    candidatas.push({
      representacion: r,
      razon:
        matches.length > 1
          ? `la petición menciona ${matches.length} señales de este enfoque (p. ej. «${primera}»)`
          : `la petición habla de «${primera}»`,
      puntos,
    });
  });
  candidatas.sort((a, b) => b.puntos - a.puntos);
  return candidatas.slice(0, Math.max(1, limite));
}

/** El bloque que viaja al Diseñador (siempre, en cualquier modo): el paso 1
 * del método ya no es «qué estética», es «qué representación». */
export function seccionRepresentacion(peticion: string): string {
  const sugeridas = sugerirRepresentaciones(peticion, 3);
  const catalogo = REPRESENTACIONES.map((r) => `- ${r.nombre}: ${r.descripcion}`).join("\n");
  const candidatas = sugeridas.length
    ? sugeridas
        .map(
          (s) =>
            `- ${s.representacion.nombre} — ${s.razon}; por ejemplo: ${s.representacion.ejemplo}`
        )
        .join("\n")
    : "- (ninguna señal clara: elige tú la representación que haga evidente el dato principal de este negocio)";
  return `# Representación primero (paso 1 del método, antes de estética y componentes)
Una IA genérica responde a «dashboard premium» con sidebar + KPIs + gráfico +
tarjetas. Tú NO: primero preguntas cómo REPRESENTAR la información de este
negocio para que se entienda de un vistazo, y después eliges los componentes
que sirven a esa representación.

Catálogo de representaciones (no es cerrado):
${catalogo}

Candidatas detectadas para ESTA petición:
${candidatas}

Decide una representación principal (puedes hibridar con una secundaria) y
refleja la decisión en la ficha: en «Estructura» y en «Mensaje principal».
Si lo correcto para ESTE negocio es un patrón clásico (ficha de producto,
blog de columna única), elígilo CON CRITERIO y dilo en la ficha: lo
prohibido es no decidir, no el patrón clásico.`;
}
