"use client";
/** Prism AI — Forja Lab: maqueta COMPLETA para la pestaña Ficha → Maqueta.
 *
 * Antes, `maquetaDesdeTokens()` (en ficha-tab.tsx) era una plantilla fija
 * — header + 3 tarjetas gemelas + pie — que ignoraba el brief entero y
 * salía igual sin importar lo que se pidiera. El motor SÍ sabe construir
 * un plano de contenido real (`construirPlanoContenido`, plano-contenido.ts,
 * v4.7 "La Página, no el Hero"): extrae hechos del brief (precios,
 * horarios, ciudad, teléfono…) y decide qué secciones lleva la página según
 * el vertical detectado — pero nadie lo llamaba desde este demo.
 *
 * Este módulo sí lo usa: recorre `plano.secciones` y renderiza cada una con
 * contenido real cuando el brief lo trae, o con un banco de textos variados
 * por vertical (nunca literalmente inventado como si fuera un dato real,
 * tal como exige el propio plano) cuando no. Sigue siendo 100% determinista
 * y sin red — no reemplaza a un Codificador real (ese escribe prosa única
 * con un LLM); esto es lo máximo que se puede armar sin uno, pero ya no es
 * la misma página vacía repetida en cada intento. */

type Motor = Record<string, any>;

interface SeccionPlan {
  id: string;
  nombre: string;
  coleccion: boolean;
  minItems: number;
}

interface HechosBrief {
  precios: string[];
  telefonos: string[];
  correos: string[];
  ciudades: string[];
  horarios: string[];
  enumeraciones: string[];
  cantidades: string[];
  marca: string;
}

interface PlanoContenido {
  vertical: string;
  nivel: string;
  secciones: SeccionPlan[];
  hechos: HechosBrief;
  resumen: string;
}

/** Bancos de copy por vertical — genérico pero variado, nunca un dato que
 * parezca real (fechas, cifras, nombres propios de personas). */
const BANCOS: Record<string, { oferta: string[]; proceso: string[]; testimonio: string[]; faq: string[] }> = {
  restaurante: {
    oferta: ["Carta de temporada con producto local", "Menú del día renovado cada semana", "Reservas para grupos y eventos privados", "Maridaje sugerido por plato", "Opciones vegetarianas y sin gluten marcadas", "Repostería de elaboración propia"],
    proceso: ["Reserva tu mesa online o por teléfono", "Te recibimos y acomodamos en sala", "Disfruta del menú con maridaje sugerido", "Cierra con nuestra repostería de la casa"],
    testimonio: ["El trato fue cercano desde que entramos por la puerta.", "Se nota el producto de temporada en cada plato.", "Volvimos a la semana siguiente con más gente.", "La relación entre lo que pagas y lo que recibes es honesta."],
    faq: ["¿Aceptáis reservas de última hora?", "¿Hay opción sin gluten?", "¿Se puede reservar para grupos grandes?", "¿Tenéis parking cerca?", "¿Hacéis catering para eventos?", "¿Cuál es la política de cancelación?"],
  },
  saas: {
    oferta: ["Panel de control con métricas en tiempo real", "Integraciones con las herramientas que ya usas", "Automatizaciones sin escribir una línea de código", "Roles y permisos por equipo", "Exportación de datos en cualquier formato", "Soporte con tiempo de respuesta garantizado"],
    proceso: ["Crea tu cuenta y conecta tus datos", "Configura el flujo con las plantillas incluidas", "Invita a tu equipo y reparte permisos", "Mide el resultado desde el panel"],
    testimonio: ["Redujo el tiempo de una tarea manual de horas a minutos.", "La curva de aprendizaje fue mucho más corta de lo esperado.", "El soporte respondió el mismo día con una solución real.", "Migrar desde la herramienta anterior costó menos de una tarde."],
    faq: ["¿Hay periodo de prueba?", "¿Puedo cancelar cuando quiera?", "¿Cómo funciona la facturación por equipo?", "¿Qué pasa con mis datos si me doy de baja?", "¿Ofrecéis migración desde otra plataforma?", "¿Hay límite de usuarios por plan?"],
  },
  ecommerce: {
    oferta: ["Envío en 24-48h en península", "Devoluciones gratuitas hasta 30 días", "Pago seguro con varios métodos", "Packaging cuidado, listo para regalo", "Stock verificado en tiempo real", "Atención al cliente por chat"],
    proceso: ["Elige el producto y añádelo al carrito", "Paga con el método que prefieras", "Recibe la confirmación y el seguimiento del envío", "Si no encaja, lo devuelves gratis"],
    testimonio: ["Llegó antes de lo que anunciaban en la web.", "El empaquetado transmitía cuidado, no era genérico.", "La devolución fue tan simple como la compra.", "El producto coincidía exactamente con las fotos."],
    faq: ["¿Cuánto tarda el envío?", "¿Puedo devolver un producto usado una vez?", "¿Enviáis fuera de la península?", "¿Qué métodos de pago aceptáis?", "¿Cómo sigo mi pedido?", "¿Hay coste de devolución?"],
  },
  general: {
    oferta: ["Atención personalizada de principio a fin", "Precios claros, sin letra pequeña", "Resultados verificables, no promesas vagas", "Disponibilidad para resolver dudas rápido", "Trabajo adaptado a cada caso", "Seguimiento después de la entrega"],
    proceso: ["Cuéntanos qué necesitas", "Te proponemos una solución concreta", "Lo ejecutamos con seguimiento constante", "Entregamos y resolvemos lo que surja después"],
    testimonio: ["Cumplieron lo que prometieron en el plazo acordado.", "La comunicación fue clara durante todo el proceso.", "El resultado final superó lo que esperábamos.", "Resolvieron una duda fuera de horario sin problema."],
    faq: ["¿Cómo empezamos a trabajar juntos?", "¿Cuánto tarda un proyecto típico?", "¿Qué pasa si no quedo conforme?", "¿Ofrecéis algún tipo de garantía?", "¿Puedo pedir cambios sobre la marcha?", "¿Trabajáis con clientes fuera de la ciudad?"],
  },
};

function bancoDe(vertical: string) {
  return BANCOS[vertical] ?? BANCOS.general;
}

/** Franja de confianza (nav→hero, antes de la oferta): señales cortas,
 * distintas de las citas completas de «Testimonios» para que no se repita
 * el mismo texto en dos sitios de la página. */
const SENALES_CONFIANZA = [
  "Respuesta en menos de 24h",
  "Sin permanencia ni letra pequeña",
  "Datos y precios verificables, no genéricos",
  "Mismo equipo del primer contacto a la entrega",
];

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

/** Nunca repite un elemento textualmente: si se piden más de los que hay
 * en el banco, entrega los que hay y ya — una sección con menos piezas de
 * las que el plano pedía es mejor que una con dos frases idénticas. */
function tomar<T>(xs: T[], n: number): T[] {
  return xs.slice(0, Math.min(n, xs.length));
}

function icono(motor: Motor, id: string, clase?: string): string {
  try {
    return motor.svgIcono?.(id, clase ? { clase } : {}) ?? "";
  } catch {
    return "";
  }
}

function seccionNav(secciones: SeccionPlan[], nombre: string): string {
  const enlaces = secciones.filter((s) => !["nav", "footer"].includes(s.id)).slice(0, 5);
  return `<header class="f-nav" id="nav">
  <div class="f-nav-marca">${esc(nombre)}</div>
  <nav aria-label="Principal">${enlaces.map((s) => `<a href="#${s.id}">${esc(s.nombre)}</a>`).join("")}</nav>
  <a class="f-cta f-cta--sm" href="#cta-final">Empezar</a>
</header>`;
}

function seccionHero(nombre: string, identidad: string, plano: PlanoContenido, motor: Motor): string {
  const marca = plano.hechos.marca || nombre;
  const sub = plano.hechos.enumeraciones[0] || identidad || "un producto profesional con decisiones propias, nunca una plantilla";
  return `<section class="f-hero" id="hero">
  <div class="f-hero-texto">
    <span class="f-chip">${esc(plano.vertical)} · forjado a medida</span>
    <h1>${esc(marca)}</h1>
    <p>${esc(sub)}</p>
    <div class="f-hero-acciones">
      <a class="f-cta" href="#cta-final">Empezar ahora ${icono(motor, "flecha")}</a>
      <a class="f-cta f-cta--ghost" href="#oferta">Ver qué ofrecemos</a>
    </div>
  </div>
</section>`;
}

function seccionPrueba(motor: Motor): string {
  const items = SENALES_CONFIANZA;
  return `<section class="f-prueba" id="prueba">
  <h2 class="f-visually-hidden">Prueba social</h2>
  <div class="f-prueba-fila">
    ${items.map((t) => `<div class="f-prueba-item">${icono(motor, "check")}<span>${esc(t)}</span></div>`).join("\n    ")}
  </div>
</section>`;
}

function seccionOferta(s: SeccionPlan, plano: PlanoContenido, banco: string[], motor: Motor): string {
  const precios = plano.hechos.precios;
  const items = tomar(banco, Math.max(s.minItems, 3, precios.length));
  return `<section class="f-seccion" id="${s.id}">
  <h2>Qué ofrecemos</h2>
  <div class="f-rejilla f-rejilla--oferta">
    ${items
      .map((t, i) => {
        const precio = precios[i] ? `<span class="f-precio">${esc(precios[i])}</span>` : "";
        return `<article class="f-tarjeta${i === 0 ? " f-tarjeta--grande" : ""}">${icono(motor, "estrella")}<h3>${esc(t)}</h3><p>Incluye seguimiento y ajustes tras la entrega.</p>${precio}</article>`;
      })
      .join("\n    ")}
  </div>
</section>`;
}

function seccionProceso(s: SeccionPlan, banco: string[]): string {
  // un proceso natural son 3-5 pasos (así lo pide el propio catálogo de
  // secciones); forzarlo a 6+ solo porque el nivel de detalle lo pide
  // produce relleno, no más información real.
  const pasos = tomar(banco, Math.min(Math.max(s.minItems, 3), 5));
  return `<section class="f-seccion f-seccion--alt" id="${s.id}">
  <h2>Cómo funciona</h2>
  <ol class="f-pasos">
    ${pasos.map((p, i) => `<li><span class="f-paso-n">${i + 1}</span><span>${esc(p)}</span></li>`).join("\n    ")}
  </ol>
</section>`;
}

function seccionDetalle(s: SeccionPlan, plano: PlanoContenido, motor: Motor): string {
  const especificaciones = plano.hechos.cantidades.length
    ? plano.hechos.cantidades
    : ["Atención directa, sin intermediarios", "Seguimiento tras la entrega", "Adaptado al caso concreto, no a una plantilla", "Comunicación clara en cada paso", "Precios sin letra pequeña", "Disponibilidad para resolver dudas"];
  const fig = motor.figuraPlaceholder?.("Vista del producto o servicio", { ratio: "4 / 3" }) ??
    `<div class="f-fig" style="aspect-ratio:4/3;border-radius:12px;background:linear-gradient(135deg,var(--dominante,#3b82f6),var(--profundo,#1d4ed8))"></div>`;
  return `<section class="f-seccion f-seccion--detalle" id="${s.id}">
  <div class="f-detalle-visual">${fig}</div>
  <div class="f-detalle-texto">
    <h2>En profundidad</h2>
    <ul class="f-specs">
      ${tomar(especificaciones, Math.min(6, especificaciones.length)).map((e) => `<li>${icono(motor, "check")}<span>${esc(e)}</span></li>`).join("\n      ")}
    </ul>
  </div>
</section>`;
}

function seccionEquipo(s: SeccionPlan, motor: Motor): string {
  // un equipo real y pequeño no crece porque el nivel de detalle lo pida:
  // se cubren los roles plausibles y no más.
  const roles = ["Dirección", "Atención al cliente", "Operaciones", "Calidad"];
  const items = tomar(roles, Math.min(Math.max(s.minItems, 3), roles.length));
  return `<section class="f-seccion" id="${s.id}">
  <h2>Quién está detrás</h2>
  <div class="f-rejilla">
    ${items.map((r) => `<article class="f-tarjeta f-tarjeta--persona">${icono(motor, "persona", "f-avatar")}<h3>${esc(r)}</h3><p>Responsable del área, disponible para dudas directas.</p></article>`).join("\n    ")}
  </div>
</section>`;
}

function seccionTestimonios(s: SeccionPlan, banco: string[]): string {
  const items = tomar(banco, Math.max(s.minItems, 3));
  return `<section class="f-seccion f-seccion--alt" id="${s.id}">
  <h2>Lo que dicen</h2>
  <div class="f-rejilla f-rejilla--testimonios">
    ${items.map((t) => `<blockquote class="f-cita"><p>&ldquo;${esc(t)}&rdquo;</p><footer>— cliente, [NOMBRE DEMO]</footer></blockquote>`).join("\n    ")}
  </div>
</section>`;
}

function seccionPrecios(s: SeccionPlan, plano: PlanoContenido): string {
  const precios = plano.hechos.precios;
  const planes = precios.length
    ? precios.map((p, i) => ({ nombre: `Plan ${i + 1}`, precio: p }))
    : [
        { nombre: "Básico", precio: "[PRECIO DEMO]" },
        { nombre: "Estándar", precio: "[PRECIO DEMO]" },
        { nombre: "Premium", precio: "[PRECIO DEMO]" },
      ];
  const destacado = Math.min(1, planes.length - 1);
  return `<section class="f-seccion" id="${s.id}">
  <h2>Precios</h2>
  <div class="f-rejilla f-rejilla--precios">
    ${planes
      .map(
        (p, i) =>
          `<article class="f-plan${i === destacado ? " f-plan--destacado" : ""}">${i === destacado ? '<span class="f-chip f-chip--acento">recomendado</span>' : ""}<h3>${esc(p.nombre)}</h3><p class="f-precio f-precio--grande">${esc(p.precio)}</p><ul><li>Incluye seguimiento</li><li>Soporte directo</li><li>Ajustes tras la entrega</li></ul><a class="f-cta f-cta--sm" href="#cta-final">Elegir</a></article>`
      )
      .join("\n    ")}
  </div>
</section>`;
}

function seccionFaq(s: SeccionPlan, banco: string[]): string {
  const items = tomar(banco, Math.max(s.minItems, 4));
  return `<section class="f-seccion f-seccion--alt" id="${s.id}">
  <h2>Preguntas frecuentes</h2>
  <div class="f-acordeon">
    ${items.map((q) => `<details><summary>${esc(q)}</summary><p>Respuesta detallada disponible al contactar — este es un dato de ejemplo, sustitúyelo por el real.</p></details>`).join("\n    ")}
  </div>
</section>`;
}

function seccionUbicacion(s: SeccionPlan, plano: PlanoContenido, motor: Motor): string {
  const h = plano.hechos;
  const direccion = h.ciudades[0] ? `${h.ciudades[0]} — [DIRECCIÓN DEMO]` : "[DIRECCIÓN DEMO]";
  const horarios = h.horarios.length ? h.horarios : ["[HORARIO DEMO]"];
  const tel = h.telefonos[0] ?? "[TELÉFONO DEMO]";
  const correo = h.correos[0] ?? "[CORREO DEMO]";
  return `<section class="f-seccion" id="${s.id}">
  <h2>Dónde estamos</h2>
  <div class="f-ubicacion">
    <p>${icono(motor, "pin")}${esc(direccion)}</p>
    <table class="f-horarios"><tbody>
      ${horarios.map((hr) => `<tr><td>${esc(hr)}</td></tr>`).join("")}
    </tbody></table>
    <p><a href="tel:${esc(tel.replace(/\s+/g, ""))}">${icono(motor, "telefono")}${esc(tel)}</a></p>
    <p><a href="mailto:${esc(correo)}">${icono(motor, "correo")}${esc(correo)}</a></p>
  </div>
</section>`;
}

function seccionCtaFinal(nombre: string): string {
  return `<section class="f-cta-final" id="cta-final">
  <h2>Empieza con ${esc(nombre)} hoy</h2>
  <a class="f-cta f-cta--grande" href="#nav">Hablemos</a>
</section>`;
}

function seccionFooter(nombre: string, secciones: SeccionPlan[]): string {
  const enlaces = secciones.filter((s) => !["nav", "footer", "cta-final"].includes(s.id));
  const col = (xs: SeccionPlan[]) => xs.map((s) => `<a href="#${s.id}">${esc(s.nombre)}</a>`).join("");
  const mitad = Math.ceil(enlaces.length / 2);
  return `<footer class="f-footer" id="footer">
  <div class="f-footer-col"><h4>${esc(nombre)}</h4>${col(enlaces.slice(0, mitad))}</div>
  <div class="f-footer-col"><h4>Más</h4>${col(enlaces.slice(mitad))}</div>
  <div class="f-footer-col"><h4>Legal</h4><a href="#">Aviso legal</a><a href="#">Privacidad</a><a href="#">Cookies</a></div>
  <p class="f-footer-nota">Maqueta generada por Forja Lab · datos de contacto marcados [DEMO] son de ejemplo.</p>
</footer>`;
}

const RENDERERS: Record<string, (s: SeccionPlan, plano: PlanoContenido, motor: Motor, banco: ReturnType<typeof bancoDe>, nombre: string) => string> = {
  nav: (_s, plano, _m, _b, nombre) => seccionNav(plano.secciones, nombre),
  hero: (_s, plano, motor, _b, nombre) => seccionHero(nombre, plano.hechos.marca, plano, motor),
  prueba: (_s, _p, motor) => seccionPrueba(motor),
  oferta: (s, plano, motor, banco) => seccionOferta(s, plano, banco.oferta, motor),
  "como-funciona": (s, _p, _m, banco) => seccionProceso(s, banco.proceso),
  detalle: (s, plano, motor) => seccionDetalle(s, plano, motor),
  equipo: (s, _p, motor) => seccionEquipo(s, motor),
  testimonios: (s, _p, _m, banco) => seccionTestimonios(s, banco.testimonio),
  precios: (s, plano) => seccionPrecios(s, plano),
  faq: (s, _p, _m, banco) => seccionFaq(s, banco.faq),
  ubicacion: (s, plano, motor) => seccionUbicacion(s, plano, motor),
  "cta-final": (_s, _p, _m, _b, nombre) => seccionCtaFinal(nombre),
  footer: (_s, plano, _m, _b, nombre) => seccionFooter(nombre, plano.secciones),
};

const CSS_BASE = `
:root{VARS}
*{box-sizing:border-box;margin:0}
body{font-family:var(--font-texto,system-ui);background:var(--fondo,#0f1117);color:var(--texto,#e7e9ee);line-height:1.6}
h1,h2,h3{font-family:var(--font-display,Georgia);line-height:1.15}
.f-visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
a{color:inherit}
.f-nav{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.9rem 1.5rem;background:color-mix(in srgb,var(--fondo,#0f1117) 88%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid color-mix(in srgb,var(--texto,#fff) 10%,transparent)}
.f-nav-marca{font-weight:700;font-family:var(--font-display,Georgia)}
.f-nav nav{display:flex;gap:1.1rem;font-size:.85rem;flex-wrap:wrap}
.f-nav nav a{text-decoration:none;opacity:.85}
.f-nav nav a:hover,.f-nav nav a:focus-visible{opacity:1;text-decoration:underline}
.f-cta{display:inline-flex;align-items:center;gap:.4rem;background:var(--dominante,#3b82f6);color:#fff;padding:.65rem 1.3rem;border-radius:.6rem;font-weight:600;text-decoration:none;font-size:.85rem}
.f-cta:hover,.f-cta:focus-visible{filter:brightness(1.1);outline:2px solid var(--dominante,#3b82f6);outline-offset:2px}
.f-cta--sm{padding:.5rem 1rem;font-size:.8rem}
.f-cta--grande{padding:.9rem 2rem;font-size:1rem}
.f-cta--ghost{background:transparent;border:1px solid color-mix(in srgb,var(--texto,#fff) 25%,transparent);color:var(--texto,#fff)}
.f-hero{padding:5rem 1.5rem 4rem;text-align:center;background:linear-gradient(160deg,var(--dominante,#3b82f6),var(--profundo,#1d4ed8))}
.f-hero h1{font-size:clamp(2rem,5vw,3.2rem);letter-spacing:-.02em;margin:.9rem 0}
.f-hero p{opacity:.92;max-width:36rem;margin:0 auto 1.6rem;font-size:1rem}
.f-hero-acciones{display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap}
.f-chip{display:inline-block;background:color-mix(in srgb,#fff 20%,transparent);padding:.3rem .8rem;border-radius:999px;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em}
.f-chip--acento{background:var(--dominante,#3b82f6);color:#fff;position:absolute;top:-.7rem;left:50%;transform:translateX(-50%)}
.f-prueba{padding:1.6rem 1.5rem;border-bottom:1px solid color-mix(in srgb,var(--texto,#fff) 8%,transparent)}
.f-prueba-fila{display:flex;gap:1.5rem;flex-wrap:wrap;justify-content:center;max-width:64rem;margin:0 auto;font-size:.82rem;opacity:.85}
.f-prueba-item{display:flex;align-items:center;gap:.4rem}
.f-seccion{padding:3.5rem 1.5rem;max-width:64rem;margin:0 auto}
.f-seccion--alt{background:color-mix(in srgb,var(--texto,#fff) 3%,transparent);max-width:none}
.f-seccion--alt>*{max-width:64rem;margin-left:auto;margin-right:auto}
.f-seccion h2{font-size:1.6rem;margin-bottom:1.6rem}
.f-rejilla{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))}
.f-rejilla--oferta .f-tarjeta--grande{grid-column:span 2}
.f-tarjeta{position:relative;border:1px solid color-mix(in srgb,var(--texto,#fff) 12%,transparent);border-radius:.9rem;padding:1.3rem;background:color-mix(in srgb,var(--texto,#fff) 4%,transparent)}
.f-tarjeta h3{font-size:1rem;margin:.5rem 0 .4rem}
.f-tarjeta p{font-size:.85rem;opacity:.78}
.f-precio{display:inline-block;margin-top:.5rem;font-weight:700;font-variant-numeric:tabular-nums}
.f-pasos{list-style:none;display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))}
.f-pasos li{display:flex;flex-direction:column;gap:.5rem;font-size:.85rem}
.f-paso-n{width:2rem;height:2rem;display:flex;align-items:center;justify-content:center;border-radius:999px;background:var(--dominante,#3b82f6);color:#fff;font-weight:700;font-size:.8rem}
.f-seccion--detalle{display:grid;gap:2rem;grid-template-columns:1fr 1fr;align-items:center}
.f-specs{list-style:none;display:grid;gap:.6rem;font-size:.88rem}
.f-specs li{display:flex;align-items:center;gap:.5rem}
.f-tarjeta--persona{text-align:center}
.f-avatar{width:2.5rem;height:2.5rem;border-radius:999px;background:color-mix(in srgb,var(--texto,#fff) 10%,transparent);padding:.5rem}
.f-rejilla--testimonios{grid-template-columns:repeat(auto-fit,minmax(16rem,1fr))}
.f-cita{border-left:3px solid var(--dominante,#3b82f6);padding:.2rem 0 .2rem 1rem;font-size:.9rem}
.f-cita footer{margin-top:.5rem;font-size:.78rem;opacity:.65}
.f-plan{position:relative;border:1px solid color-mix(in srgb,var(--texto,#fff) 12%,transparent);border-radius:1rem;padding:1.5rem;text-align:center}
.f-plan--destacado{border-color:var(--dominante,#3b82f6);box-shadow:0 0 0 1px var(--dominante,#3b82f6)}
.f-precio--grande{font-size:1.6rem;margin:.6rem 0}
.f-plan ul{list-style:none;font-size:.82rem;opacity:.85;margin:1rem 0;display:grid;gap:.4rem}
.f-acordeon details{border-bottom:1px solid color-mix(in srgb,var(--texto,#fff) 10%,transparent);padding:.9rem 0}
.f-acordeon summary{cursor:pointer;font-weight:600;font-size:.92rem}
.f-acordeon summary:focus-visible{outline:2px solid var(--dominante,#3b82f6)}
.f-acordeon p{margin-top:.6rem;font-size:.85rem;opacity:.8}
.f-ubicacion{display:grid;gap:.8rem;font-size:.9rem}
.f-ubicacion p{display:flex;align-items:center;gap:.5rem}
.f-horarios td{padding:.2rem 0;font-variant-numeric:tabular-nums}
.f-cta-final{padding:4.5rem 1.5rem;text-align:center;background:color-mix(in srgb,var(--dominante,#3b82f6) 15%,transparent)}
.f-cta-final h2{font-size:1.8rem;margin-bottom:1.4rem}
.f-footer{padding:2.5rem 1.5rem 1.5rem;display:grid;gap:1.5rem;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));font-size:.82rem;max-width:64rem;margin:0 auto}
.f-footer-col{display:flex;flex-direction:column;gap:.4rem}
.f-footer-col a{opacity:.75;text-decoration:none}
.f-footer-col a:hover{opacity:1;text-decoration:underline}
.f-footer-nota{grid-column:1/-1;opacity:.55;font-size:.72rem;border-top:1px solid color-mix(in srgb,var(--texto,#fff) 8%,transparent);padding-top:1rem}
@media (max-width:720px){.f-seccion--detalle{grid-template-columns:1fr}.f-rejilla--oferta .f-tarjeta--grande{grid-column:span 1}}
@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
`;

/** Construye la maqueta COMPLETA a partir del plano de contenido real del
 * motor. `motor` es el bundle cargado por `cargarMotor()`. */
export function paginaCompletaDesdeMensaje(
  motor: Motor,
  mensaje: string,
  adn2: any,
  tokensCss: string,
  nombre: string
): { html: string; plano: PlanoContenido } {
  const plano: PlanoContenido = motor.construirPlanoContenido(mensaje);
  const banco = bancoDe(plano.vertical);
  const cuerpo = plano.secciones
    .map((s) => {
      const render = RENDERERS[s.id];
      if (!render) return "";
      try {
        return render(s, plano, motor, banco, nombre);
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n");

  const vars = extraerVars(tokensCss);
  const cssIconos = (() => {
    try {
      return motor.cssIconografia?.() ?? "";
    } catch {
      return "";
    }
  })();

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(plano.hechos.marca || nombre)} — forjado con Forja Lab</title>
<style>
${CSS_BASE.replace("VARS", vars)}
${cssIconos}
</style></head>
<body>
${cuerpo}
</body></html>`;

  return { html, plano };
}

function extraerVars(tokensCss: string): string {
  const vars = [...tokensCss.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)]
    .slice(0, 12)
    .map((m) => `${m[1]}:${m[2].trim()}`)
    .join(";");
  const display = tokensCss.match(/font-(?:display|titulo)[^;]*([^;]+);/i)?.[1];
  const dom = tokensCss.match(/--[^\n]*dominante[^\n]*/i)?.[0]?.match(/#[0-9a-f]{3,8}/i)?.[0];
  const prof = tokensCss.match(/--[^\n]*profundo[^\n]*/i)?.[0]?.match(/#[0-9a-f]{3,8}/i)?.[0];
  return `${vars};--dominante:${dom ?? "#3b82f6"};--profundo:${prof ?? "#1d4ed8"};--font-display:${display ?? "Georgia,serif"}`;
}
