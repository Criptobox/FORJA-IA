/** Forja IA — Una página web de verdad, sin IA.
 *
 * Sin ninguna IA conectada, pedir «una página web para una pizzería» salía como
 * una app de móvil (lo único que sabía hacer la biblioteca). Esto arma una web
 * de escritorio completa y adaptable, en un solo HTML: cabecera fija, portada
 * con su acción, ventajas, carta o catálogo, ofertas, opiniones, quiénes somos,
 * formulario (reserva, pedido, cita o inscripción según el negocio) y pie.
 *
 * Los textos salen del sector y de la idea; los colores, de una paleta del
 * sector elegida por la idea (dos encargos distintos no salen iguales). Usa los
 * tokens de Astryx (escala de texto, espaciado, radios, sombras) de
 * `astryx-base.ts`. Sin recursos externos: las ilustraciones son SVG. Lo que no
 * se sabe del negocio (teléfono, dirección) queda como «Pendiente», no se
 * inventa. El resultado va al chat como `index.html`: se ve en la vista previa,
 * se edita en la pestaña de código y se descarga en el ZIP. */

type Sector = "comida" | "tienda" | "fitness" | "salud" | "viajes" | "educacion" | "musica" | "finanzas" | "general";

interface Contenido {
  marca: string[];
  tag: string;
  titulo: [string, string];
  sub: string;
  cta: string;
  ventajas: [string, string][];
  seccion: string;
  items: [string, string, string][];
  ofertas: [string, string][];
  opiniones: [string, string][];
  sobre: string;
  form: { titulo: string; campos: string[]; boton: string };
  paletas: [string, string, string][]; // acento, segundo, fondo suave
  icono: string;
}

const C: Record<Sector, Contenido> = {
  comida: {
    marca: ["Forno Rosso", "La Brasa", "Casa Nostra", "El Horno de Ana"],
    tag: "Hecho a diario, con producto de temporada",
    titulo: ["Sabor de verdad,", "hecho con calma"],
    sub: "Recetas de siempre, ingredientes frescos y un servicio que te hace volver. Pide para llevar o reserva tu mesa.",
    cta: "Ver la carta",
    ventajas: [["👨‍🍳", "Cocina de la casa"], ["🌿", "Ingredientes frescos"], ["🛵", "A domicilio en 30 min"], ["⭐", "4,9 de media"]],
    seccion: "Nuestra carta",
    items: [["Especial de la casa", "La receta que nos pide todo el mundo.", "12,50 €"], ["Clásico", "Lo de siempre, como siempre.", "9,90 €"], ["De temporada", "Cambia cada mes con el mercado.", "13,00 €"], ["Para compartir", "Tamaño familiar, para la mesa.", "18,50 €"]],
    ofertas: [["2×1", "Los martes en toda la carta."], ["−20 %", "En tu primer pedido online."], ["Gratis", "El postre los fines de semana."]],
    opiniones: [["«De lo mejor del barrio. Volveremos.»", "Sara M."], ["«Llegó caliente y en 25 minutos.»", "David P."], ["«Ambiente cálido y servicio de diez.»", "Emilia R."]],
    sobre: "Somos un pequeño equipo que cocina como en casa: sin prisas, con buen producto y con ganas de que vuelvas.",
    form: { titulo: "Reserva tu mesa", campos: ["Tu nombre", "Correo", "Fecha", "Personas"], boton: "Reservar ahora" },
    paletas: [["#c8281e", "#1f4d36", "#fbf6ec"], ["#d9480f", "#7a3e1d", "#fff8f0"], ["#b5651d", "#2f3e46", "#faf5ee"]],
    icono: "🍕",
  },
  tienda: {
    marca: ["Atelier Norte", "Casa Lino", "Moda Viva", "El Armario"],
    tag: "Envío gratis desde 40 €",
    titulo: ["Tu estilo,", "sin esfuerzo"],
    sub: "Piezas que duran, precios claros y cambios gratis durante 30 días.",
    cta: "Ver la colección",
    ventajas: [["🚚", "Envío en 24-48 h"], ["↩️", "Cambios gratis"], ["🔒", "Pago seguro"], ["⭐", "Miles de clientes"]],
    seccion: "Lo más vendido",
    items: [["Camisa de lino", "Fresca y sin arrugas.", "39 €"], ["Chaqueta ligera", "Para entretiempo.", "69 €"], ["Pantalón sastre", "El básico que combina con todo.", "49 €"], ["Vestido midi", "Corte favorecedor.", "59 €"]],
    ofertas: [["−30 %", "En la segunda prenda."], ["Envío 0 €", "Este fin de semana."], ["Regalo", "Tote bag con tu pedido."]],
    opiniones: [["«La calidad se nota desde el primer día.»", "Carla R."], ["«Llegó en 24 horas y bien envuelto.»", "Nico V."], ["«Cambiar la talla fue facilísimo.»", "Lucía P."]],
    sobre: "Diseñamos ropa para usarla, no para guardarla: buenos tejidos, cortes cómodos y producción responsable.",
    form: { titulo: "Únete y recibe un 10 %", campos: ["Tu nombre", "Correo"], boton: "Quiero mi descuento" },
    paletas: [["#7a5af8", "#1d1b2e", "#f7f5ff"], ["#e0567a", "#2b2230", "#fff6f8"], ["#1f7a6d", "#14261f", "#f3faf8"]],
    icono: "🛍️",
  },
  fitness: {
    marca: ["Pulso Gym", "Fuerza Viva", "Ritmo Club", "Núcleo"],
    tag: "Primera clase gratis",
    titulo: ["Entrena con cabeza,", "progresa de verdad"],
    sub: "Clases guiadas, planes a tu medida y un equipo que te acompaña en cada sesión.",
    cta: "Reserva tu clase",
    ventajas: [["🏋️", "Fuerza y cardio"], ["🧘", "Yoga y movilidad"], ["📈", "Plan a tu medida"], ["⏰", "Abierto 6:00–23:00"]],
    seccion: "Clases y planes",
    items: [["Fuerza", "Técnica y progresión, en grupos pequeños.", "Incluida"], ["HIIT", "45 minutos que cuentan.", "Incluida"], ["Yoga", "Movilidad y calma.", "Incluida"], ["Entrenador personal", "Sesiones uno a uno.", "Desde 30 €"]],
    ofertas: [["1ª gratis", "Prueba cualquier clase."], ["−50 %", "Primer mes con matrícula."], ["Amigo", "Trae a alguien y os sale a mitad."]],
    opiniones: [["«Por fin un gimnasio donde te corrigen la técnica.»", "Dani C."], ["«Las clases de la mañana me cambiaron el día.»", "Ana F."], ["«Ambiente cercano y sin postureo.»", "Leo P."]],
    sobre: "Creemos en la constancia antes que en la intensidad: rutinas que puedes mantener y un seguimiento real.",
    form: { titulo: "Reserva tu clase de prueba", campos: ["Tu nombre", "Correo", "Clase", "Día"], boton: "Reservar gratis" },
    paletas: [["#ff5a1f", "#141414", "#f6f4f2"], ["#16a34a", "#0f1d14", "#f2f8f4"], ["#2563eb", "#0f172a", "#f3f6fc"]],
    icono: "💪",
  },
  salud: {
    marca: ["Clínica Aire", "Centro Vital", "Salud Cerca", "Consulta Lumen"],
    tag: "Cita en menos de 48 h",
    titulo: ["Tu salud,", "en buenas manos"],
    sub: "Especialistas cercanos, citas sin esperas y un seguimiento claro de cada paso.",
    cta: "Pedir cita",
    ventajas: [["🩺", "Especialistas"], ["📅", "Cita en 48 h"], ["💬", "Consulta online"], ["🔒", "Datos protegidos"]],
    seccion: "Especialidades",
    items: [["Medicina general", "Revisiones y seguimiento.", "Cita"], ["Fisioterapia", "Recupera movilidad sin dolor.", "Cita"], ["Nutrición", "Planes realistas y sostenibles.", "Cita"], ["Psicología", "Un espacio seguro para ti.", "Cita"]],
    ofertas: [["Primera visita", "Valoración sin compromiso."], ["Online", "Consulta desde casa."], ["Bonos", "Ahorra en tratamientos."]],
    opiniones: [["«Me atendieron rápido y con mucha calma.»", "Elena M."], ["«La fisio me cambió la espalda.»", "Raúl D."], ["«Explican todo con claridad.»", "Nuria G."]],
    sobre: "Un equipo de profesionales que te escucha, te explica y te acompaña. Sin prisas y sin salas de espera eternas.",
    form: { titulo: "Pide tu cita", campos: ["Tu nombre", "Teléfono", "Especialidad", "Día"], boton: "Solicitar cita" },
    paletas: [["#0e9f8f", "#123c3a", "#f2faf9"], ["#3b82c4", "#132a40", "#f3f8fc"], ["#7c6ee6", "#22204a", "#f7f6ff"]],
    icono: "🩺",
  },
  viajes: {
    marca: ["Rumbo", "Vuela Lejos", "Mapa Abierto", "Brújula"],
    tag: "Cancelación flexible",
    titulo: ["El mundo te espera,", "nosotros lo preparamos"],
    sub: "Escapadas y grandes viajes diseñados a tu medida, con todo resuelto antes de salir.",
    cta: "Ver destinos",
    ventajas: [["✈️", "Vuelos y hoteles"], ["🗺️", "Rutas a medida"], ["🛟", "Asistencia 24/7"], ["💳", "Paga a plazos"]],
    seccion: "Destinos destacados",
    items: [["Lisboa", "4 días de luz y fado.", "Desde 290 €"], ["Islandia", "Auroras y cascadas.", "Desde 1.190 €"], ["Marruecos", "Desierto y medinas.", "Desde 540 €"], ["Japón", "Tradición y neón.", "Desde 1.890 €"]],
    ofertas: [["−15 %", "Reservando con 60 días."], ["Niños gratis", "En hoteles seleccionados."], ["Seguro", "Incluido en todos los viajes."]],
    opiniones: [["«Todo salió perfecto, hasta los traslados.»", "Lucía V."], ["«Nos diseñaron una ruta de diez.»", "Mateo R."], ["«Respondieron a cualquier hora.»", "Irene S."]],
    sobre: "Viajamos antes que tú para recomendarte solo lo que de verdad merece la pena.",
    form: { titulo: "Cuéntanos tu viaje", campos: ["Tu nombre", "Correo", "Destino", "Fechas"], boton: "Pedir propuesta" },
    paletas: [["#0e7490", "#0b2a35", "#f1f9fb"], ["#e76f51", "#264653", "#fdf6f2"], ["#2a9d8f", "#1d3557", "#f2faf8"]],
    icono: "🧭",
  },
  educacion: {
    marca: ["Aula Viva", "Academia Faro", "Aprende+", "Cuaderno"],
    tag: "Clase de prueba gratis",
    titulo: ["Aprende a tu ritmo,", "llega más lejos"],
    sub: "Cursos prácticos con profesores que te acompañan, en grupo o a tu aire.",
    cta: "Ver cursos",
    ventajas: [["🎓", "Profesores expertos"], ["🧩", "Clases prácticas"], ["📱", "Online y presencial"], ["📜", "Certificado"]],
    seccion: "Cursos",
    items: [["Inglés", "Del A1 al C1, con conversación.", "Desde 49 €/mes"], ["Programación", "Primeros pasos con proyectos reales.", "Desde 59 €/mes"], ["Diseño", "Herramientas y criterio.", "Desde 55 €/mes"], ["Refuerzo escolar", "Primaria y ESO.", "Desde 39 €/mes"]],
    ofertas: [["Prueba gratis", "Tu primera clase."], ["−20 %", "Matrícula este mes."], ["Grupos", "Descuento para hermanos."]],
    opiniones: [["«Aprobé el B2 a la primera.»", "Paula M."], ["«Las clases son amenas de verdad.»", "Álex C."], ["«Mi hijo ahora disfruta estudiando.»", "Rocío H."]],
    sobre: "Enseñamos haciendo: poca teoría de relleno y mucha práctica con alguien que te corrige.",
    form: { titulo: "Pide tu clase de prueba", campos: ["Tu nombre", "Correo", "Curso"], boton: "Quiero probar" },
    paletas: [["#2563eb", "#172554", "#f4f7fd"], ["#d97706", "#3b2a0e", "#fdf9f1"], ["#9333ea", "#2e1065", "#f9f5ff"]],
    icono: "📚",
  },
  musica: {
    marca: ["Sala Eco", "Ritmo Norte", "La Nota", "Estudio Faro"],
    tag: "Próximos conciertos",
    titulo: ["La música se vive", "en directo"],
    sub: "Conciertos, sesiones y clases en un espacio hecho para sonar bien.",
    cta: "Ver agenda",
    ventajas: [["🎤", "Directos cada semana"], ["🎧", "Estudio de grabación"], ["🎸", "Clases de instrumento"], ["🍸", "Barra y terraza"]],
    seccion: "Agenda",
    items: [["Viernes: Indie", "Bandas emergentes.", "12 €"], ["Sábado: Jazz", "Trío en directo.", "15 €"], ["Domingo: Acústico", "Tarde tranquila.", "8 €"], ["Jam abierta", "Trae tu instrumento.", "Gratis"]],
    ofertas: [["Abono", "4 conciertos al mes."], ["2×1", "Los jueves."], ["Estudio", "1ª hora a mitad de precio."]],
    opiniones: [["«El mejor sonido de la ciudad.»", "Sofía L."], ["«Grabamos nuestro EP aquí.»", "Hugo B."], ["«Ambiente increíble.»", "Mía R."]],
    sobre: "Un espacio para escuchar, tocar y grabar, con un equipo que ama la música tanto como tú.",
    form: { titulo: "Reserva tus entradas", campos: ["Tu nombre", "Correo", "Concierto", "Entradas"], boton: "Reservar" },
    paletas: [["#e11d48", "#18181b", "#faf7f7"], ["#8b5cf6", "#1e1b2e", "#f7f5ff"], ["#f59e0b", "#1c1917", "#fdfaf3"]],
    icono: "🎵",
  },
  finanzas: {
    marca: ["Cuenta Clara", "Ahorro Fácil", "Brújula Financiera", "Pila"],
    tag: "Sin comisiones ocultas",
    titulo: ["Tu dinero, claro", "y bajo control"],
    sub: "Asesoría cercana para ordenar tus cuentas, ahorrar y planificar sin letra pequeña.",
    cta: "Hablar con un asesor",
    ventajas: [["📊", "Plan de ahorro"], ["🧾", "Impuestos al día"], ["🔒", "Datos seguros"], ["🤝", "Asesor personal"]],
    seccion: "Servicios",
    items: [["Plan de ahorro", "Metas claras y alcanzables.", "Gratis"], ["Declaración de la renta", "Hecha y revisada.", "Desde 40 €"], ["Inversión", "Perfil y cartera a tu medida.", "Consulta"], ["Autónomos", "Contabilidad mensual.", "Desde 39 €/mes"]],
    ofertas: [["1ª consulta", "Gratis y sin compromiso."], ["−25 %", "Renta antes de mayo."], ["Pack", "Autónomo + renta."]],
    opiniones: [["«Por fin entiendo mis gastos.»", "Diego M."], ["«Me ahorraron más de lo que costaron.»", "Sara L."], ["«Siempre responden rápido.»", "Pablo O."]],
    sobre: "Te explicamos tus números en tu idioma y te ayudamos a decidir con calma.",
    form: { titulo: "Pide tu consulta gratis", campos: ["Tu nombre", "Correo", "Tema"], boton: "Solicitar consulta" },
    paletas: [["#0f766e", "#0b1f1d", "#f2f8f7"], ["#1d4ed8", "#0b1530", "#f3f6fd"], ["#b45309", "#231a0b", "#fbf7f0"]],
    icono: "💼",
  },
  general: {
    marca: ["Estudio Faro", "Punto Norte", "Casa Clara", "Nexo"],
    tag: "Atención cercana",
    titulo: ["Lo que necesitas,", "bien hecho"],
    sub: "Un servicio cuidado, con trato cercano y resultados que se notan.",
    cta: "Contactar",
    ventajas: [["⭐", "Calidad"], ["⚡", "Rapidez"], ["🤝", "Trato cercano"], ["🔒", "Confianza"]],
    seccion: "Servicios",
    items: [["Servicio principal", "Lo que mejor sabemos hacer.", "Consulta"], ["Asesoría", "Te orientamos sin compromiso.", "Gratis"], ["Mantenimiento", "Para que todo siga funcionando.", "Consulta"], ["A medida", "Para lo que no está en la lista.", "Consulta"]],
    ofertas: [["Primera visita", "Sin compromiso."], ["−15 %", "Para nuevos clientes."], ["Pack", "Ahorra combinando servicios."]],
    opiniones: [["«Muy profesionales y cercanos.»", "Marta G."], ["«Rápidos y sin sorpresas.»", "Jorge P."], ["«Repetiré seguro.»", "Laura S."]],
    sobre: "Un equipo pequeño que cuida cada detalle y responde cuando lo necesitas.",
    form: { titulo: "Escríbenos", campos: ["Tu nombre", "Correo", "Mensaje"], boton: "Enviar" },
    paletas: [["#ff704b", "#242421", "#f7f5f0"], ["#2563eb", "#111827", "#f5f7fb"], ["#16a34a", "#14201a", "#f3f8f4"]],
    icono: "✦",
  },
};

const PALABRAS: [Sector, RegExp][] = [
  ["comida", /pizz|restaur|caf[eé]|comida|panader|helader|pasteler|hamburgues|sushi|taquer|tacos|bar\b|bistr|cocina|men[uú]|cervecer|brunch|kebab|parrilla|trattoria/],
  ["tienda", /tienda|ropa|moda|zapat|calzado|boutique|joyer|muebles|librer|florister|regalos|accesorios|ecommerce|cat[aá]logo/],
  ["fitness", /gimnas|gym|fitness|entrena|yoga|pilates|crossfit|deport|running|nataci/],
  ["salud", /cl[ií]nica|m[eé]dic|salud|dentist|odontol|fisio|psicol|nutric|veterinar|farmacia|terapia|hospital/],
  ["viajes", /viaje|hotel|turismo|vuelo|destino|hostal|excursi|tours|crucero|agencia de viajes/],
  ["educacion", /academia|curso|clases|escuela|colegio|profesor|idiomas|universidad|tutor|formaci/],
  ["musica", /m[uú]sica|concierto|banda|dj\b|discoteca|karaoke|grabaci|sala de/],
  ["finanzas", /finanz|asesor[ií]a|gestor[ií]a|contab|seguros|inversi|banco|ahorro|impuesto|renta\b/],
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function sectorDeWeb(texto: string): Sector {
  const t = norm(texto ?? "");
  for (const [s, re] of PALABRAS) if (re.test(t)) return s;
  return "general";
}

/** ¿Pide una página web (no una app)? «página web», «web para…», «landing», «sitio»… */
export function esPedidoDeWeb(texto: string): boolean {
  const t = norm(texto ?? "");
  if (!/\b(crea|haz|hazme|construye|disena|genera|monta|quiero|necesito|make|create|build)\b/.test(t)) return false;
  if (/\b(app|aplicacion|dashboard|panel)\b/.test(t) && !/\b(pagina|web|landing|sitio)\b/.test(t)) return false;
  return /\b(pagina web|pagina|sitio web|sitio|web|landing|one ?page|portfolio|portafolio)\b/.test(t);
}

const hash = (s: string) => {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Nombre del negocio: lo que va entre comillas o tras «llamada/llamado», si lo dice; si no, uno del sector. */
function marcaDe(texto: string, c: Contenido, h: number): string {
  const m = /[«"“']([^»"”']{2,30})[»"”']/.exec(texto) ?? /\bllamad[ao]\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ ]{1,28})/.exec(texto);
  return (m?.[1] ?? c.marca[h % c.marca.length]).trim();
}

const ink = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) > 150 ? "#141414" : "#ffffff";
};

/** Ilustración del producto/servicio: SVG con los colores de la paleta (sin fotos externas). */
function ilustracion(i: number, a: string, b: string): string {
  const formas = [
    `<circle cx="110" cy="75" r="52" fill="${a}" opacity=".9"/><circle cx="110" cy="75" r="40" fill="#fff" opacity=".35"/><circle cx="92" cy="62" r="7" fill="${b}"/><circle cx="126" cy="80" r="7" fill="${b}"/><circle cx="104" cy="96" r="6" fill="${b}"/>`,
    `<rect x="62" y="30" width="96" height="90" rx="22" fill="${a}" opacity=".9"/><rect x="80" y="50" width="60" height="10" rx="5" fill="#fff" opacity=".6"/><rect x="80" y="70" width="40" height="10" rx="5" fill="#fff" opacity=".45"/>`,
    `<path d="M50 118 110 30l60 88Z" fill="${a}" opacity=".9"/><circle cx="150" cy="44" r="14" fill="${b}" opacity=".8"/>`,
    `<ellipse cx="110" cy="80" rx="62" ry="40" fill="${a}" opacity=".9"/><ellipse cx="110" cy="72" rx="40" ry="20" fill="#fff" opacity=".35"/>`,
  ];
  return `<svg viewBox="0 0 220 150" aria-hidden="true"><rect width="220" height="150" fill="${b}" opacity=".12"/>${formas[i % formas.length]}</svg>`;
}

export function landingLocal(texto: string): { html: string; sector: Sector; marca: string } {
  const sector = sectorDeWeb(texto);
  const c = C[sector];
  const h = hash(norm(texto ?? ""));
  const [a, oscuro, fondo] = c.paletas[h % c.paletas.length];
  const marca = marcaDe(texto ?? "", c, h);
  const sobreA = ink(a);
  const f = c.form;
  const campo = (n: string) => {
    const tipo = /correo/i.test(n) ? "email" : /tel[eé]fono/i.test(n) ? "tel" : /fecha|d[ií]a/i.test(n) ? "date" : /personas|entradas/i.test(n) ? "number" : "text";
    return `<label>${esc(n)}<input type="${tipo}" name="${esc(norm(n).replace(/\W+/g, "-"))}" required${tipo === "number" ? ' min="1" value="2"' : ""}></label>`;
  };
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(marca)}</title>
<meta name="description" content="${esc(c.sub)}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${c.icono}</text></svg>">
<style>
:root{--a:${a};--on-a:${sobreA};--osc:${oscuro};--fondo:${fondo};--sf:#fff;--ink:#1d1b18;--sec:#55504a;--ln:#00000014;
--text-sm:.8rem;--text-base:1rem;--text-lg:1.125rem;--text-xl:1.4rem;--text-2xl:clamp(1.8rem,3.5vw,2.6rem);--text-3xl:clamp(2.4rem,6vw,4.2rem);
--space-2:.5rem;--space-3:.75rem;--space-4:1rem;--space-6:1.5rem;--space-8:2rem;--space-12:3rem;--space-16:4rem;
--radius-element:.625rem;--radius-container:1rem;--radius-page:1.75rem;--radius-full:9999px;
--shadow-low:0 2px 4px #0000000d,0 4px 8px #0000001a;--shadow-med:0 2px 4px #0000000d,0 8px 20px #0000001a;--dur:300ms;--ease:cubic-bezier(.2,0,0,1)}
*{box-sizing:border-box;margin:0}html{scroll-behavior:smooth}body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--fondo);color:var(--ink);line-height:1.55}
img,svg{display:block;max-width:100%}a{color:inherit}
.btn{display:inline-flex;align-items:center;gap:.4rem;background:var(--a);color:var(--on-a);padding:.85rem 1.4rem;border-radius:var(--radius-full);font-weight:700;text-decoration:none;border:0;cursor:pointer;transition:transform var(--dur) var(--ease),box-shadow var(--dur) var(--ease)}
.btn:hover{transform:translateY(-2px);box-shadow:var(--shadow-med)}.btn:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid var(--a);outline-offset:3px}
.btn.o{background:transparent;color:var(--osc);border:2px solid var(--osc)}
header{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--fondo) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--ln)}
.nav{max-width:1120px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);padding:var(--space-3) var(--space-6)}
.logo{font-weight:800;font-size:var(--text-lg);color:var(--osc);text-decoration:none}.nav ul{display:flex;gap:var(--space-6);list-style:none;padding:0}.nav ul a{text-decoration:none;font-weight:600;font-size:.95rem}
section{max-width:1120px;margin:auto;padding:var(--space-16) var(--space-6)}h2{font-size:var(--text-2xl);letter-spacing:-.02em;line-height:1.15;margin-bottom:var(--space-2)}.sub{color:var(--sec);margin-bottom:var(--space-8);max-width:60ch}
.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:var(--space-12);align-items:center;padding-top:var(--space-12)}
.tag{display:inline-block;background:color-mix(in srgb,var(--a) 14%,transparent);color:var(--osc);font-weight:700;font-size:var(--text-sm);padding:.35rem .8rem;border-radius:var(--radius-full)}
h1{font-size:var(--text-3xl);line-height:1.02;letter-spacing:-.035em;margin:var(--space-4) 0}h1 em{color:var(--a);font-style:normal}
.hero p{font-size:var(--text-lg);color:var(--sec);max-width:48ch;margin-bottom:var(--space-6)}.acc{display:flex;gap:var(--space-3);flex-wrap:wrap}
.arte{aspect-ratio:1;border-radius:var(--radius-page);background:radial-gradient(circle at 30% 30%,color-mix(in srgb,var(--a) 55%,#fff),var(--a) 60%,var(--osc));display:grid;place-items:center;font-size:clamp(5rem,14vw,9rem);box-shadow:var(--shadow-med);animation:flota 6s var(--ease) infinite alternate}
@keyframes flota{to{transform:translateY(-10px) rotate(2deg)}}
.ven{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-4);padding-top:0}.ven div{background:var(--sf);border-radius:var(--radius-container);padding:var(--space-6) var(--space-4);text-align:center;box-shadow:var(--shadow-low);font-weight:600}.ven span{display:block;font-size:1.8rem;margin-bottom:var(--space-2)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:var(--space-6)}
.card{background:var(--sf);border-radius:var(--radius-container);overflow:hidden;box-shadow:var(--shadow-low);transition:transform var(--dur) var(--ease),box-shadow var(--dur) var(--ease)}.card:hover{transform:translateY(-4px);box-shadow:var(--shadow-med)}
.card div{padding:var(--space-4) var(--space-4) var(--space-6)}.card h3{font-size:var(--text-lg)}.card p{color:var(--sec);font-size:.92rem;margin:.25rem 0 .75rem}.card b{color:var(--a);font-size:var(--text-lg)}
.ofe{background:var(--osc);color:#fff;max-width:none}.ofe>div{max-width:1120px;margin:auto}.ofe .sub{color:#ffffffcc}.ofe .grid{grid-template-columns:repeat(3,1fr)}
.of{background:#ffffff12;border:1px solid #ffffff2a;border-radius:var(--radius-container);padding:var(--space-6)}.of b{display:block;font-size:2rem;color:color-mix(in srgb,var(--a) 70%,#fff)}
.op{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-6)}.op figure{background:var(--sf);border-radius:var(--radius-container);padding:var(--space-6);box-shadow:var(--shadow-low)}.op i{color:#e8a400;font-style:normal;letter-spacing:2px}.op blockquote{margin:var(--space-2) 0}.op figcaption{color:var(--sec);font-size:.9rem}
.sobre{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-12);align-items:center}.sobre .arte{aspect-ratio:4/3;font-size:5rem;animation:none}
.forma{background:var(--sf);border-radius:var(--radius-page);box-shadow:var(--shadow-med);padding:var(--space-8);display:grid;grid-template-columns:1fr 1fr;gap:var(--space-8);align-items:start}
form{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)}label{display:grid;gap:.3rem;font-size:var(--text-sm);font-weight:700}input{min-width:0;width:100%;padding:.8rem .9rem;border:1px solid #d9d4cb;border-radius:var(--radius-element);font:inherit;background:#fff;color:var(--ink)}
form .btn{grid-column:1/-1;justify-content:center}.ok{grid-column:1/-1;color:#14804a;font-weight:700;min-height:1.4em}
.pend{color:var(--sec);font-style:italic}
footer{background:var(--ink);color:#f2efe9;padding:var(--space-12) var(--space-6)}footer .in{max-width:1120px;margin:auto;display:flex;flex-wrap:wrap;justify-content:space-between;gap:var(--space-6)}footer b{font-size:var(--text-lg);color:#fff}footer .pend{color:#cfc9bf}
@media (max-width:860px){.nav ul{display:none}.hero,.sobre,.forma{grid-template-columns:1fr}.ven{grid-template-columns:1fr 1fr}.ofe .grid,.op{grid-template-columns:1fr}form{grid-template-columns:1fr}.arte{max-width:320px;justify-self:center;width:100%}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
</style>
</head>
<body>
<header><nav class="nav" aria-label="Principal"><a class="logo" href="#inicio">${c.icono} ${esc(marca)}</a><ul><li><a href="#catalogo">${esc(c.seccion)}</a></li><li><a href="#ofertas">Ofertas</a></li><li><a href="#opiniones">Opiniones</a></li><li><a href="#contacto">Contacto</a></li></ul><a class="btn" href="#contacto">${esc(f.boton)}</a></nav></header>
<main id="inicio">
<section class="hero"><div><span class="tag">${esc(c.tag)}</span><h1>${esc(c.titulo[0])} <em>${esc(c.titulo[1])}</em></h1><p>${esc(c.sub)}</p><div class="acc"><a class="btn" href="#catalogo">${esc(c.cta)}</a><a class="btn o" href="#contacto">${esc(f.titulo)}</a></div></div><div class="arte" role="img" aria-label="${esc(marca)}">${c.icono}</div></section>
<section class="ven" aria-label="Ventajas">${c.ventajas.map(([i, t]) => `<div><span aria-hidden="true">${i}</span>${esc(t)}</div>`).join("")}</section>
<section id="catalogo"><h2>${esc(c.seccion)}</h2><p class="sub">Lo que más nos piden. Pregúntanos por lo que no veas aquí.</p><div class="grid">${c.items.map(([n, d, p], i) => `<article class="card">${ilustracion(i, a, oscuro)}<div><h3>${esc(n)}</h3><p>${esc(d)}</p><b>${esc(p)}</b></div></article>`).join("")}</div></section>
<section id="ofertas" class="ofe"><div><h2>Ofertas</h2><p class="sub">Para que pruebes sin pensarlo dos veces.</p><div class="grid">${c.ofertas.map(([t, d]) => `<div class="of"><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join("")}</div></div></section>
<section id="opiniones"><h2>Lo que dicen de nosotros</h2><p class="sub">Opiniones de clientes reales.</p><div class="op">${c.opiniones.map(([t, n]) => `<figure><i aria-label="5 de 5">★★★★★</i><blockquote>${esc(t)}</blockquote><figcaption>${esc(n)}</figcaption></figure>`).join("")}</div></section>
<section class="sobre"><div class="arte" role="img" aria-label="Sobre ${esc(marca)}">${c.icono}</div><div><h2>Sobre ${esc(marca)}</h2><p class="sub">${esc(c.sobre)}</p><a class="btn o" href="#contacto">Hablemos</a></div></section>
<section id="contacto"><div class="forma"><div><h2>${esc(f.titulo)}</h2><p class="sub">Te respondemos en menos de 24 horas.</p><p class="pend">Teléfono: Pendiente · Dirección: Pendiente</p></div><form onsubmit="event.preventDefault();this.querySelector('.ok').textContent='¡Recibido! Te escribimos muy pronto.';this.reset()">${f.campos.map(campo).join("")}<button class="btn" type="submit">${esc(f.boton)}</button><p class="ok" role="status" aria-live="polite"></p></form></div></section>
</main>
<footer><div class="in"><div><b>${c.icono} ${esc(marca)}</b><p class="pend">Dirección: Pendiente</p></div><div><p class="pend">Teléfono: Pendiente</p><p class="pend">Correo: Pendiente</p></div><div><p>Horario: Pendiente</p><p>© ${new Date().getFullYear()} ${esc(marca)}</p></div></div></footer>
</body>
</html>`;
  return { html, sector, marca };
}
