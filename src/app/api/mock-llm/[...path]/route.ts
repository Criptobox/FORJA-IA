import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mock OpenAI-compatible incluido en la app (para pruebas E2E sin claves).
 * - POST /api/mock-llm/v1/chat/completions — chat streaming/no-streaming
 *   · system con «MODO AGENTE» → respuesta con bucle plan→step→review→answer+project-map
 *   · mensaje con página/html/landing/juego → documento HTML en ```html
 *   · mensaje multimodal (imágenes) → confirma que las vio
 *   · resto → saludo de prueba
 * - GET /api/mock-llm/v1/models — lista de modelos
 * Clave válida: "test-key-123".
 */

const KEY = "test-key-123";

/** Los modelos que este mock reconoce. Cualquier otro se rechaza, igual que
 *  haría un proveedor real. */
const MODELOS = [
  "mock-limite-7000",
  "mock-413-sin-numeros",
  "mock-mini-free",
  "mock-big-free",
  "mock-pro-free",
  "mock-vision",
  "mock-paid-pro",
  "mock-tools",
  // Alias de `mock-tools` que además pasa el filtro de "gratis" (contiene
  // «-free»): hace falta para probar FORJA WEB, que enruta por la misma
  // cadena de candidatos que Auto y esa cadena descarta lo que no sea gratis.
  "mock-tools-free",
  "mock-cortado",
  "mock-vacio",
  "mock-filtro-seguridad",
  "mock-filtro-seguridad-json",
  "mock-rescate",
  "mock-largo",
  "mock-corta-y-cae",
  "mock-empalma-free",
  "mock-prosa-cortada",
  "mock-lee-url",
  "mock-codigo-roto",
  "mock-efectos",
  "mock-generica",
  "mock-generica-terca",
  "mock-iconos-emoji",
  "mock-proyecto-repo",
  "mock-3d-mal-puesto",
  "mock-3d",
  "mock-2d-mal-puesto",
  "mock-2d",
  "mock-scroll",
  "mock-tema-en-head",
  "mock-texto-mixto",
  "mock-boton-roto",
  "mock-enlace-roto",
  "mock-mide",
  "mock-verifica",
  "mock-diagnostica",
  "mock-visual-review",
  "mock-visual-review-sin-vision",
  "mock-llamada-en-texto",
  "mock-toca-header",
  "mock-director",
  "mock-obrero",
  "mock-obrero:free",
  "mock-obrero-free",
];

const AGENT_DOC = (extra: string) =>
  [
    "<!DOCTYPE html>",
    '<html lang="es"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>Agente Demo</title>",
    "<style>body{font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#0f172a;color:#fff}",
    "h1{font-size:2.2rem;margin:0 0 8px}.card{text-align:center;padding:40px;border-radius:20px;background:rgba(255,255,255,.06)}",
    extra,
    "</style></head><body>",
    '<div class="card"><h1>Construido por el agente</h1><p>Iteraciones verificadas automáticamente.</p>',
    '<button id="b">Púlsame</button><span id="n">0</span></div>',
    "<script>let n=0;document.getElementById('b').onclick=()=>{n++;document.getElementById('n').textContent=n};</script>",
    "</body></html>",
  ].join("\n");

const HTML_DOC = [
  "<!DOCTYPE html>",
  '<html lang="es">',
  "<head>",
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  "<title>Demo Forja</title>",
  "<style>",
  "  body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;",
  "  background:linear-gradient(135deg,#1e1b4b,#0f766e 55%,#be185d);color:#fff}",
  "  .card{background:rgba(255,255,255,.1);backdrop-filter:blur(12px);padding:48px;border-radius:24px;",
  "  text-align:center;max-width:420px;border:1px solid rgba(255,255,255,.2)}",
  "  h1{margin:0 0 12px;font-size:2rem}",
  "  p{opacity:.85;line-height:1.6}",
  "  button{margin-top:20px;padding:12px 28px;border:0;border-radius:999px;font-weight:600;",
  "  background:#fff;color:#1e1b4b;cursor:pointer;transition:transform .2s}",
  "  button:hover{transform:scale(1.05)}",
  "  #n{font-size:3rem;font-weight:800;display:block;margin-top:16px}",
  "</style>",
  "</head>",
  "<body>",
  '<div class="card">',
  "<h1>Funciona en vivo ✨</h1>",
  "<p>Esta página se generó con Forja IA y se renderiza mientras la IA escribe.</p>",
  '<button id="b">Púlsame</button>',
  '<span id="n">0</span>',
  "</div>",
  "<script>",
  "let n=0;document.getElementById('b').onclick=()=>{n++;document.getElementById('n').textContent=n};",
  "</script>",
  "</body>",
  "</html>",
].join("\n");

/** Estructura de los mensajes que el agente envía cuando está en bucle de
 * tools. El último mensaje puede ser `role: "tool"` (el resultado de un
 * tool anterior). El mock responde al `tool` con un mensaje final. */
interface MockMsg {
  role: string;
  content: unknown;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
}

function buildReply(body: { messages?: MockMsg[]; tools?: unknown; model?: string }): string {
  const msgs = body.messages ?? [];
  const modelo = body.model ?? "";
  const last = msgs[msgs.length - 1];
  const raw = typeof last?.content === "string" ? last.content : JSON.stringify(last?.content ?? "");
  const seesImage = Array.isArray(last?.content);
  const wantsAgent = msgs.some(
    (m) => typeof m.content === "string" && (m.content as string).includes("MODO AGENTE")
  );
  const wantsHtml = /página|pagina|html|landing|juego/i.test(raw);
  // Si el último mensaje es resultado de un tool, el agente ya ejecutó
  // la herramienta. Respondemos con una respuesta final que confirma que
  // el tool se ejecutó.
  const lastIsToolResult = last?.role === "tool";
  if (lastIsToolResult) {
    return `He ejecutado la herramienta que pediste. El resultado fue:\n\n> ${raw.slice(0, 200)}\n\nAhora puedo darte la respuesta final: la iteración con tools funcionó correctamente.`;
  }

  // `mock-enlace-roto`: el fallo está detrás de un ENLACE, que el barrido
  // automático no pulsa (un <a> puede navegar fuera y dejar la prueba sin
  // página). Solo sale usándola: es justo el hueco que cubre la detección en
  // vivo.
  if (modelo === "mock-enlace-roto") {
    const leCorrigieron = msgs.some(
      (m) =>
        typeof m.content === "string" &&
        (m.content as string).includes("He estado usando la página que hiciste")
    );
    const script = leCorrigieron
      ? "document.getElementById('v').onclick=function(e){e.preventDefault();document.title='ok';};"
      : "document.getElementById('v').onclick=function(e){e.preventDefault();mostrarMas();};";
    return [
      "<plan>",
      "- Página con un enlace",
      "</plan>",
      "",
      '<step n="1" title="La página">',
      "```html",
      "<!DOCTYPE html>",
      '<html lang="es"><head><meta charset="utf-8"><title>Enlace</title></head>',
      "<body>",
      '<h1>Catálogo</h1><a href="#" id="v">Ver más</a>',
      `<script>${script}</script>`,
      "</body></html>",
      "```",
      "</step>",
      "",
      '<review pass="yes">',
      "- Hecho",
      "</review>",
      "",
      "<answer>",
      leCorrigieron ? "Enlace arreglado tras usarla." : "Aquí tienes el catálogo.",
      "</answer>",
    ].join("\n");
  }

  // `mock-boton-roto`: la página CARGA limpia y el fallo está detrás del clic.
  // Es el caso que la revisión de la v3.28.0 daba por bueno: solo miraba lo
  // que revienta al abrir.
  if (modelo === "mock-boton-roto") {
    const leCorrigieron = msgs.some(
      (m) =>
        typeof m.content === "string" &&
        (m.content as string).includes("He pulsado los botones de tu página")
    );
    const script = leCorrigieron
      ? "document.getElementById('b').onclick=function(){document.getElementById('n').textContent='ok';};"
      : "document.getElementById('b').onclick=function(){sumarTotal();};";
    return [
      "<plan>",
      "- Montar la página con su botón",
      "</plan>",
      "",
      '<step n="1" title="La página">',
      "```html",
      "<!DOCTYPE html>",
      '<html lang="es"><head><meta charset="utf-8"><title>Botón</title></head>',
      "<body>",
      '<button id="b">Sumar</button><span id="n">0</span>',
      `<script>${script}</script>`,
      "</body></html>",
      "```",
      "</step>",
      "",
      '<review pass="yes">',
      "- Hecho",
      "</review>",
      "",
      "<answer>",
      leCorrigieron ? "Botón arreglado tras pulsarlo." : "Aquí tienes la página con su botón.",
      "</answer>",
    ].join("\n");
  }

  // `mock-codigo-roto`: el agente que entrega una página con un fallo de
  // verdad. La primera entrega llama a una función que no existe, así que la
  // consola del iframe suelta un ReferenceError; si se le devuelven los
  // errores, entrega la versión arreglada. Sirve para comprobar que el agente
  // PRUEBA su propio código por el camino XML (sin `tools`).
  if (modelo === "mock-codigo-roto") {
    const leCorrigieron = msgs.some(
      (m) =>
        typeof m.content === "string" &&
        (m.content as string).includes("He ejecutado tu código en el navegador")
    );
    const cuerpo = leCorrigieron
      ? '<h1 id="t">Arreglada por el agente</h1><script>document.getElementById("t").dataset.ok="1";</script>'
      : '<h1 id="t">Con fallo</h1><script>pintarTodo();</script>';
    return [
      "<plan>",
      "- Montar la página",
      "</plan>",
      "",
      '<step n="1" title="La página">',
      "```html",
      "<!DOCTYPE html>",
      '<html lang="es"><head><meta charset="utf-8"><title>Prueba</title></head>',
      "<body>",
      cuerpo,
      "</body></html>",
      "```",
      "</step>",
      "",
      '<review pass="yes">',
      "- Hecho",
      "</review>",
      "",
      "<answer>",
      leCorrigieron ? "Corregido tras ejecutarlo." : "Aquí tienes la página.",
      "</answer>",
    ].join("\n");
  }

  // `mock-efectos`: una página que ENLAZA el kit de efectos sin escribirlo,
  // que es exactamente lo que se le pide al modelo real. Sirve para comprobar
  // dos cosas: que Forja añade `forja-fx.css`/`forja-fx.js` al proyecto por su
  // cuenta, y que el contenido dentro de un `data-fx="reveal"` se ve — con o
  // sin JavaScript.
  if (modelo === "mock-efectos") {
    return [
      "Aquí tienes la página.",
      "",
      "```html",
      "<!DOCTYPE html>",
      '<html lang="es"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "<title>Con efectos</title>",
      '<link rel="stylesheet" href="forja-fx.css">',
      "</head>",
      '<body style="font-family:system-ui;margin:0;padding:24px">',
      '<section data-fx="reveal"><h1>Titular que entra al hacer scroll</h1></section>',
      '<section data-fx="stagger" style="margin-top:4000px">',
      "<p>Primero</p><p>Segundo</p>",
      '<button id="b" onclick="document.getElementById(\'n\').textContent=\'pulsado\'">Púlsame</button>',
      '<span id="n">sin pulsar</span>',
      "</section>",
      '<script src="forja-fx.js" defer></script>',
      "</body></html>",
      "```",
    ].join("\n");
  }

  // `mock-generica`: la página de manual de un generador — Lorem ipsum, tres
  // tarjetas clonadas, un solo tamaño de letra, la fuente del sistema y un
  // hero centrado con su botón. La segunda entrega es la pulida. Sirve para
  // comprobar que Forja MIDE lo genérico en la página pintada y se lo
  // devuelve al modelo, en vez de fiarse de que se autoevalúe.
  if (modelo === "mock-generica") {
    const lePulieron = msgs.some(
      (m) =>
        typeof m.content === "string" &&
        (m.content as string).includes("y la he medido")
    );
    const tarjeta = (n: number) =>
      `<div style="width:220px;height:150px;border-radius:12px;background:#eee;padding:16px">` +
      `<h3>Característica ${n}</h3><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p></div>`;
    const cuerpo = lePulieron
      ? '<h1 style="font-family:Georgia,serif;font-size:64px">Pulida de verdad</h1>' +
        '<p style="font-size:16px">Copia escrita para este encargo, sin relleno.</p>' +
        '<p style="font-size:13px">Apoyo</p><h2 style="font-size:34px">Un segundo nivel</h2>'
      : `<section style="text-align:center"><h1>Bienvenido a nuestro sitio</h1>` +
        `<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>` +
        `<a class="cta" href="#">Empezar</a></section>` +
        `<div style="display:flex;gap:16px">${tarjeta(1)}${tarjeta(2)}${tarjeta(3)}</div>` +
        Array.from({ length: 30 }, (_, i) => `<p>Texto de ejemplo ${i}</p>`).join("");
    return [
      lePulieron ? "Corregido tras medirla." : "Aquí tienes la página.",
      "",
      "```html",
      "<!DOCTYPE html>",
      '<html lang="es"><head><meta charset="utf-8"><title>Demo</title></head>',
      '<body style="font-family:system-ui;margin:0;padding:24px">',
      cuerpo,
      "</body></html>",
      "```",
    ].join("\n");
  }

  // `mock-iconos-emoji`: una página con botones cuyo ÚNICO contenido es un
  // emoji (🛒, 🔍) haciendo de icono — el patrón que pide evitar
  // `skill-anti-slop` y que `generico.ts` (seña `iconos-emoji`) mide de
  // verdad en el DOM pintado. La segunda entrega los cambia por SVG propio.
  if (modelo === "mock-iconos-emoji") {
    const lePulieron = msgs.some(
      (m) =>
        typeof m.content === "string" &&
        (m.content as string).includes("y la he medido")
    );
    const nav = lePulieron
      ? '<nav><button aria-label="Carrito"><svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"/></svg></button>' +
        '<button aria-label="Buscar"><svg width="20" height="20" viewBox="0 0 20 20"><rect width="16" height="16"/></svg></button></nav>'
      : "<nav><button>\u{1F6D2}</button><button>\u{1F50D}</button></nav>";
    const cuerpo =
      nav + Array.from({ length: 30 }, (_, i) => `<p>Texto de ejemplo ${i}</p>`).join("");
    return [
      lePulieron ? "Corregido tras medirla." : "Aquí tienes la página.",
      "",
      "```html",
      "<!DOCTYPE html>",
      '<html lang="es"><head><meta charset="utf-8"><title>Demo</title></head>',
      '<body style="font-family:Georgia,serif;margin:0;padding:24px">',
      cuerpo,
      "</body></html>",
      "```",
    ].join("\n");
  }

  // `mock-proyecto-repo`: entrega TRES archivos separados si —y solo si— ve
  // la instrucción de excepción en el prompt (la que se añade cuando el
  // usuario pide explícitamente «un proyecto para un repo»). Sin esa
  // instrucción, entrega el único-archivo de siempre. Sirve para comprobar
  // que la excepción de verdad viaja en el prompt Y que el modelo, al
  // seguirla, produce un proyecto con varios archivos de verdad — no solo
  // que el texto se mandó.
  if (modelo === "mock-proyecto-repo") {
    const conExcepcion = msgs.some(
      (m) =>
        typeof m.content === "string" &&
        (m.content as string).includes("Excepción: aquí se pide un PROYECTO")
    );
    if (conExcepcion) {
      return [
        "Aquí tienes el proyecto, con los archivos separados.",
        "",
        "```html index.html",
        "<!DOCTYPE html>",
        '<html lang="es"><head><meta charset="utf-8"><title>Proyecto</title>',
        '<link rel="stylesheet" href="styles.css"></head>',
        '<body><h1>Hola</h1><script src="app.js"></script></body></html>',
        "```",
        "",
        "```css styles.css",
        "body{margin:0;font-family:system-ui}",
        "```",
        "",
        "```js app.js",
        "console.log('listo')",
        "```",
      ].join("\n");
    }
    return [
      "Aquí tienes tu página.",
      "",
      "```html",
      "<!DOCTYPE html>",
      '<html lang="es"><head><meta charset="utf-8"><title>Solo</title></head>',
      "<body><h1>Todo en uno</h1></body></html>",
      "```",
    ].join("\n");
  }

  // `mock-3d-mal-puesto`: enlaza el motor 3D en una landing pedida
  // explícitamente "minimalista" — la dirección "minimal" lo tiene
  // PROHIBIDO (EFECTOS_POR_DIRECCION). Sirve para comprobar que Forja lo
  // detecta en la página ya pintada y se lo devuelve al modelo, igual que
  // hace con lo genérico — dogfooding: hasta ahora nadie comprobaba esto,
  // el prompt lo prohibía pero nadie miraba si se hacía caso.
  //
  // El marcador de corrección NO puede ser ".includes('motor 3D')" desde que
  // `senasEfectosFueraDeDireccion` se generalizó (v4.12.0): el texto ahora es
  // neutro, solo nombra los ids reales ("3d-malla"), no la frase "motor 3D".
  // Mismo marcador que `mock-2d-mal-puesto`: la apertura de
  // `promptDeGenerico`, que solo aparece en un mensaje de corrección real.
  if (modelo === "mock-3d-mal-puesto") {
    const leCorrigieron = msgs.some(
      (m) => typeof m.content === "string" && (m.content as string).includes("y la he medido")
    );
    const escena = leCorrigieron
      ? ""
      : '<canvas data-fx3d="3d-malla" class="fx-mesh" style="width:100%;height:300px;display:block"></canvas>\n<script src="forja-3d.js" defer></script>\n';
    return [
      leCorrigieron ? "Quitado el motor 3D." : "Aquí tienes la página.",
      "",
      "```html",
      "<!DOCTYPE html>",
      '<html lang="es"><head><meta charset="utf-8"><title>Tienda</title>',
      '<link rel="stylesheet" href="forja-fx.css"></head>',
      '<body style="margin:0;font-family:system-ui">',
      "<h1>Bienvenido a la tienda</h1>",
      escena,
      "</body></html>",
      "```",
    ].join("\n");
  }

  // `mock-2d-mal-puesto`: pone un efecto 2D (marquee) en una landing pedida
  // explícitamente "editorial de revista" — la dirección "editorial" lo
  // tiene PROHIBIDO (EFECTOS_POR_DIRECCION.editorial.evita). Mismo mecanismo
  // que `mock-3d-mal-puesto` pero para la mitad 2D del mismo detector.
  //
  // El marcador de corrección NO puede ser ".includes('marquee')": el propio
  // prompt de sistema de "editorial" ya nombra "marquee" en su lista de
  // PROHIBIDOS (promptEfectos), así que esa palabra sale también en el
  // primer turno, antes de corregir nada — el mismo colapso que ya se
  // encontró con "motor 3D" en la dirección experimental. Se usa el mismo
  // marcador único que `mock-3d-mal-puesto`: la apertura de
  // `promptDeGenerico`, que solo aparece en un mensaje de corrección real.
  if (modelo === "mock-2d-mal-puesto") {
    const leCorrigieron = msgs.some(
      (m) => typeof m.content === "string" && (m.content as string).includes("y la he medido")
    );
    const marquee = leCorrigieron
      ? ""
      : '<div class="fx-marquee" style="white-space:nowrap;overflow:hidden">Novedades cada semana · Novedades cada semana ·</div>\n';
    return [
      leCorrigieron ? "Quitado el marquee." : "Aquí tienes la página.",
      "",
      "```html",
      "<!DOCTYPE html>",
      '<html lang="es"><head><meta charset="utf-8"><title>Revista</title>',
      '<link rel="stylesheet" href="forja-fx.css"></head>',
      '<body style="margin:0;font-family:system-ui">',
      "<h1>Editorial de revista</h1>",
      marquee,
      "</body></html>",
      "```",
    ].join("\n");
  }

  // `mock-2d`: enlaza el marquee (clase suelta, sin corrección) — igual que
  // `mock-3d` para el motor 3D, sirve para comprobar en una dirección que SÍ
  // lo permite (brutalista) que Forja no lo toca.
  if (modelo === "mock-2d") {
    return [
      "Aquí tienes la página.",
      "",
      "```html",
      "<!DOCTYPE html>",
      '<html lang="es"><head><meta charset="utf-8">',
      "<title>Con marquee</title>",
      '<link rel="stylesheet" href="forja-fx.css"></head>',
      '<body style="margin:0">',
      '<div class="fx-marquee" style="white-space:nowrap;overflow:hidden">Últimas noticias · Últimas noticias ·</div>',
      "</body></html>",
      "```",
    ].join("\n");
  }

  // `mock-generica-terca`: la MISMA página de manual, pero que NUNCA se
  // pule por mucho que se le corrija — sirve para llegar al tope de
  // MAX_REVISIONES con la página todavía genérica, y comprobar que Forja lo
  // dice al final en vez de quedarse callado (dogfooding: antes, la última
  // pasada ni se comprobaba).
  if (modelo === "mock-generica-terca") {
    const tarjeta = (n: number) =>
      `<div style="width:220px;height:150px;border-radius:12px;background:#eee;padding:16px">` +
      `<h3>Característica ${n}</h3><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p></div>`;
    const cuerpo =
      `<section style="text-align:center"><h1>Bienvenido a nuestro sitio</h1>` +
      `<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>` +
      `<a class="cta" href="#">Empezar</a></section>` +
      `<div style="display:flex;gap:16px">${tarjeta(1)}${tarjeta(2)}${tarjeta(3)}</div>` +
      Array.from({ length: 30 }, (_, i) => `<p>Texto de ejemplo ${i}</p>`).join("");
    return [
      "Aquí tienes la página.",
      "",
      "```html",
      "<!DOCTYPE html>",
      '<html lang="es"><head><meta charset="utf-8"><title>Demo</title></head>',
      '<body style="font-family:system-ui;margin:0;padding:24px">',
      cuerpo,
      "</body></html>",
      "```",
    ].join("\n");
  }

  // `mock-3d`: enlaza el motor 3D (canvas con globo de líneas) sin
  // escribirlo — igual que `mock-efectos` para el kit normal, pero para
  // comprobar que Forja también añade `forja-3d.js` cuando hace falta.
  if (modelo === "mock-3d") {
    return [
      "Aquí tienes la escena.",
      "",
      "```html",
      "<!DOCTYPE html>",
      '<html lang="es"><head><meta charset="utf-8">',
      "<title>Con 3D</title>",
      '<link rel="stylesheet" href="forja-fx.css"></head>',
      '<body style="margin:0;color:oklch(0.7 0.2 280)">',
      '<canvas data-fx3d="3d-malla" class="fx-mesh" style="width:100%;height:400px;display:block"></canvas>',
      '<script src="forja-3d.js" defer></script>',
      "</body></html>",
      "```",
    ].join("\n");
  }

  // `mock-tema-en-head`: el patrón MÁS común en una web generada por un
  // modelo de verdad — leer el tema guardado ANTES del primer pintado, para
  // no dar el flash del tema equivocado. El script vive en `<head>`, antes
  // de cualquier cosa que Forja inyecte. Sirve para comprobar que el puente
  // de consola gana esa carrera (dogfooding v4.10.0: un `pageerror` de
  // localStorage sandboxed salía justo con este patrón).
  if (modelo === "mock-tema-en-head") {
    return [
      "Aquí tienes la página.",
      "",
      "```html",
      "<!DOCTYPE html>",
      '<html lang="es"><head><meta charset="utf-8">',
      "<script>",
      "  if (localStorage.getItem('tema') === 'oscuro') document.documentElement.classList.add('oscuro');",
      "</script>",
      "<title>Con detección de tema</title></head>",
      "<body><h1>Hola</h1></body></html>",
      "```",
    ].join("\n");
  }

  // `mock-texto-mixto`: un <h1> que NO es una hoja — trae un <em> dentro,
  // junto a texto suelto — para comprobar el gap de dogfooding v4.10.0/.1:
  // tocar la vista previa solo dejaba editar «despacio.» (la hoja), nunca
  // «El café,» (el texto suelto de al lado). data-testid en cada pieza para
  // que el E2E pueda verificar el DOM sin depender del texto exacto.
  if (modelo === "mock-texto-mixto") {
    return [
      "Aquí tienes la página.",
      "",
      "```html",
      "<!DOCTYPE html>",
      '<html lang="es"><head><meta charset="utf-8"><title>Café</title></head>',
      "<body>",
      '<h1 data-testid="titular">El café,<em data-testid="hoja">despacio.</em></h1>',
      "</body></html>",
      "```",
    ].join("\n");
  }

  // `mock-scroll`: una sección anclada (`pin`) con tres pasos y una sección
  // que se desliza en horizontal — para comprobar el scroll narrativo.
  if (modelo === "mock-scroll") {
    return [
      "Aquí tienes la página.",
      "",
      "```html",
      "<!DOCTYPE html>",
      '<html lang="es"><head><meta charset="utf-8">',
      "<title>Scroll narrativo</title>",
      '<link rel="stylesheet" href="forja-fx.css"></head>',
      '<body style="margin:0;font-family:system-ui">',
      '<section data-fx="pin" style="height:300vh">',
      '<div data-fx="pin-inner" style="display:flex;align-items:center;justify-content:center">',
      '<p data-fx-step>Paso uno</p><p data-fx-step>Paso dos</p><p data-fx-step>Paso tres</p>',
      "</div></section>",
      '<section data-fx="horizontal" style="height:300vh">',
      '<div data-fx="horizontal-track">',
      '<div style="width:100vw;flex:none">Panel A</div><div style="width:100vw;flex:none">Panel B</div><div style="width:100vw;flex:none">Panel C</div>',
      "</div></section>",
      '<script src="forja-fx.js" defer></script>',
      "</body></html>",
      "```",
    ].join("\n");
  }

  // `mock-corta-y-cae` / `mock-empalma-free`: el failover que CONTINÚA.
  //
  // El primero escribe media web y luego el endpoint le devuelve un 402 (ver
  // el POST), así que la respuesta se queda cortada y sin cuota. El segundo es
  // el de repuesto: si recibe la orden de empalmar, entrega solo el resto —
  // nunca la página entera. Así el test distingue «continuó» de «reinició».
  if (modelo === "mock-empalma-free") {
    const empalma = msgs.some(
      (m) =>
        typeof m.content === "string" &&
        (m.content as string).includes("Tu respuesta anterior se cortó por longitud")
    );
    if (empalma) {
      return [
        'rd"><h1>Rescatada</h1><p>El repuesto siguió desde el corte.</p></div>',
        "</body>",
        "</html>",
        "```",
      ].join("\n");
    }
    // sin la orden de empalmar, el repuesto empieza de cero: es justo el
    // comportamiento viejo, y el test tiene que poder verlo
    return [
      "Aquí tienes tu página:",
      "",
      "```html",
      "<!DOCTYPE html>",
      "<html><body><h1>Empezada de cero</h1></body></html>",
      "```",
    ].join("\n");
  }

  // `mock-largo`: imita el techo de tokens con una web larga. La primera
  // respuesta se corta DENTRO del bloque de código (la cerca queda abierta y
  // el documento sin `</html>`), que es exactamente lo que rompía la vista
  // previa. Si se le pide continuar, entrega el resto para empalmar.
  if (modelo === "mock-largo") {
    const pideSeguir = msgs.some(
      (m) =>
        typeof m.content === "string" &&
        (m.content as string).includes("Tu respuesta anterior se cortó por longitud")
    );
    if (pideSeguir) {
      return [
        'rd"><h1>Forja</h1><p>Página entera tras empalmar los dos trozos.</p></div>',
        "</body>",
        "</html>",
        "```",
      ].join("\n");
    }
    return [
      "Aquí tienes tu página:",
      "",
      "```html",
      "<!DOCTYPE html>",
      '<html lang="es"><head><meta charset="utf-8"><title>Larga</title></head>',
      "<body>",
      '<div class="ca',
    ].join("\n");
  }

  // `mock-vacio`: imita al modelo de razonamiento que gasta el turno pensando
  // y cierra el stream sin escribir nada. Se contaba como respuesta buena y la
  // burbuja se quedaba en blanco. Devuelve solo razonamiento.
  if (modelo === "mock-vacio") return "";

  // `mock-filtro-seguridad`: imita el caso real visto con nemotron vía
  // OpenRouter en FORJA WEB — el modelo devuelve el preámbulo de un filtro
  // de seguridad EN VEZ de la página pedida. No está vacío (se contaba
  // como respuesta buena), pero tampoco es una respuesta.
  if (modelo === "mock-filtro-seguridad") return "User Safety: safe\nResponse Safety: safe";

  // `mock-filtro-seguridad-json`: la MISMA respuesta, pero en JSON — otro
  // caso real visto en la app (coló en la primera versión del filtro
  // porque la comilla de cierre justo después de "Safety" rompía el
  // patrón que solo esperaba texto plano).
  if (modelo === "mock-filtro-seguridad-json")
    return '{"User Safety": "safe", "Response Safety": "safe"}';

  // `mock-cortado`: imita al modelo que se queda sin tokens a mitad de una
  // etiqueta. Es el caso real que dejaba al agente parado en silencio. Cuando
  // recibe la instrucción de continuar, cierra el trabajo como debe.
  if (modelo === "mock-cortado") {
    const continuando = msgs.some(
      (m) => typeof m.content === "string" && (m.content as string).startsWith("Continúa el trabajo anterior")
    );
    if (continuando) {
      return [
        '<step n="2" title="Cierre del trabajo">',
        "Termino lo que había quedado a medias.",
        "</step>",
        "",
        '<review pass="yes">',
        "- Todo el plan cumplido",
        "</review>",
        "",
        "<answer>",
        "Trabajo retomado y terminado tras el corte.",
        "</answer>",
      ].join("\n");
    }
    // se corta dentro del <step>: la etiqueta nunca se cierra
    return [
      "<plan>",
      "- Escribir la estructura",
      "- Rematar los estilos",
      "</plan>",
      "",
      '<step n="1" title="Estructura">',
      "Empiezo a escribir el documento y aquí se acaba el pres",
    ].join("\n");
  }

  if (modelo === "mock-rescate") {
    return "Aquí tienes la respuesta completa del modelo de repuesto.";
  }

  if (wantsAgent) {
    return [
      "<plan>",
      "- Crear la estructura HTML base",
      "- Añadir estilos y animación",
      "- Verificar el resultado final",
      "</plan>",
      "",
      '<step n="1" title="Estructura HTML base">',
      "Creo el documento con semántica clara:",
      "",
      "```html",
      AGENT_DOC(""),
      "```",
      "</step>",
      "",
      '<review pass="no">',
      "- Falta animación de entrada",
      "- El botón necesita estilo hover",
      "</review>",
      "",
      '<step n="2" title="Pulido: animación y hover">',
      "Añado la animación y mejoro el botón:",
      "",
      "```html",
      AGENT_DOC(
        ".card{animation:subir .6s ease both}@keyframes subir{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}"
      ),
      "```",
      "</step>",
      "",
      '<review pass="yes">',
      "- Estructura correcta",
      "- Animación funcionando",
      "- Responsive verificado",
      "</review>",
      "",
      "<answer>",
      "Listo: la página quedó construida en **2 iteraciones** con revisión final aprobada. El bucle detectó 2 fallos en la primera pasada y los corrigió automáticamente.",
      "</answer>",
      "",
      '<project-map>{"name":"Agente Demo","description":"Página de presentación generada por el agente","files":[{"name":"index.html","kind":"html","summary":"Presentación con animación y botón de prueba"}],"features":["Animación de entrada","Botón interactivo","Responsive"]}</project-map>',
    ].join("\n");
  }
  if (wantsHtml) {
    return `Aquí tienes tu página. La vista previa se construye en vivo:\n\n\`\`\`html\n${HTML_DOC}\n\`\`\``;
  }
  if (seesImage) {
    return "He recibido tu **imagen** correctamente 👀 El pipeline multimodal funciona: la imagen viajó como `image_url` en el protocolo OpenAI y el modelo la recibió. ¿Qué quieres que haga con ella?";
  }
  return "¡Hola! Soy **Forja IA** funcionando con tu API.\n\nTodo el pipeline opera correctamente: `UI → proxy → servidor → SSE → UI`.";
}

function sse(reply: string): Response {
  const chunks = reply.match(/[\s\S]{1,14}/g) ?? [];
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      let i = 0;
      timer = setInterval(() => {
        try {
          if (i < chunks.length) {
            const payload = { id: "mock-1", choices: [{ delta: { content: chunks[i] }, index: 0 }] };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            i++;
          } else {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            clearInterval(timer);
          }
        } catch {
          // el cliente se fue a mitad: el controlador ya está cerrado y seguir
          // escribiendo lanzaba una excepción NO capturada que tumbaba el
          // proceso entero de Node, no solo esta petición
          clearInterval(timer);
        }
      }, 30);
    },
    // se llama cuando el navegador aborta (cerrar pestaña, cancelar, navegar)
    cancel() {
      clearInterval(timer);
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
  });
}

/** El protocolo de Anthropic, lo justo para poder probarlo de verdad.
 *
 * Hasta ahora el mock solo hablaba OpenAI, así que el camino de Anthropic
 * —el único con cortes de caché— no tenía ninguna prueba que mirara lo que
 * sale de la app. Esto responde con la forma real de `/v1/messages`, incluido
 * el `usage`, que es de donde el panel saca la cuenta del proveedor.
 *
 * La caché se simula de la única manera honesta posible: si la petición trae
 * cortes, se devuelven tokens de caché; si no los trae, cero. Así la prueba
 * distingue «la app marcó los cortes» de «la app no los marcó», que es
 * exactamente lo que hay que comprobar.
 */
function respuestaAnthropic(body: {
  system?: unknown;
  messages?: { role: string; content: unknown }[];
}): Response {
  const crudo = JSON.stringify(body ?? {});
  const cortes = (crudo.match(/"cache_control"/g) ?? []).length;
  const texto =
    "¡Hola! Soy **Forja IA** hablando el protocolo de Anthropic.\n\n" +
    `Cortes de caché recibidos: ${cortes}.`;
  return Response.json({
    id: "msg_mock",
    type: "message",
    role: "assistant",
    model: "mock-claude",
    content: [{ type: "text", text: texto }],
    stop_reason: "end_turn",
    usage: {
      input_tokens: 120,
      output_tokens: 45,
      // sin cortes no hay caché: es lo que pasaría de verdad
      cache_read_input_tokens: cortes > 0 ? 880 : 0,
      cache_creation_input_tokens: cortes > 0 ? 40 : 0,
    },
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const ruta = path.join("/");
  if (ruta.endsWith("v1/messages") || ruta.endsWith("messages")) {
    if (req.headers.get("x-api-key") !== KEY) {
      return Response.json({ error: { message: "Clave inválida" } }, { status: 401 });
    }
    return respuestaAnthropic(await req.json());
  }
  if (!ruta.endsWith("chat/completions")) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  if (req.headers.get("authorization") !== `Bearer ${KEY}`) {
    return Response.json({ error: { message: "Clave inválida" } }, { status: 401 });
  }
  const body = (await req.json()) as { stream?: boolean; model?: string; messages?: MockMsg[]; tools?: unknown };

  /* Un proveedor de verdad rechaza el id que no conoce, y hasta ahora el mock
   * aceptaba cualquiera. Con eso no se podía ejercitar la comprobación de
   * modelos: un id inventado pasaba por bueno. */
  if (body.model && !MODELOS.includes(body.model)) {
    return Response.json(
      { error: { message: `The model \`${body.model}\` does not exist`, code: "model_not_found" } },
      { status: 404 }
    );
  }
  /* El 413 real de Groq, con su texto: «Request too large … input tokens per
   * minute (ITPM): Limit 7000, Requested 21138». No es un fallo del modelo ni
   * de la clave: es que la conversación no cabe, y hasta la v4.5.0 dejaba la
   * pantalla en rojo sin probar nada más. */
  /* Un 413 SIN números: el proveedor dice que no cabe pero no dice cuánto
   * admite. Sin ese dato no hay a qué recortar, y lo único que queda es
   * cambiar de modelo — que es el otro camino y también hay que probarlo. */
  if ((body.model ?? "").includes("mock-413-sin-numeros")) {
    return Response.json(
      { error: { message: "Request too large, please reduce your message size and try again." } },
      { status: 413 }
    );
  }
  if ((body.model ?? "").includes("mock-limite-7000")) {
    // Rechaza SOLO lo que no le cabe, como haría el de verdad. Así se puede
    // probar el recorte: la misma petición, con menos historial, sí entra.
    const tokens = Math.ceil(
      (body.messages ?? []).reduce((a, m) => a + String(m.content ?? "").length, 0) / 4
    );
    if (tokens > 7000) {
      return Response.json(
        {
          error: {
            message: `Request too large for model \`mock-limite-7000\` in organization \`org_mock\` service tier \`on_demand\` on input tokens per minute (ITPM): Limit 7000, Requested ${tokens}, please reduce your message size and try again.`,
          },
        },
        { status: 413 }
      );
    }
  }
  // Simulación del límite real de AiHubMix: «cuentas sin recargar solo 10 intentos»
  if ((body.model ?? "").toLowerCase().includes("kimi-k3")) {
    return Response.json(
      {
        error: {
          message:
            "Sorry, to prevent abuse of free resources, accounts that have not been recharged can only try 10 times. You can increase the free quota after recharging: https://console.aihubmix.com/topup",
        },
      },
      { status: 429 }
    );
  }

  // Si el último mensaje es resultado de un tool (role: "tool"), el
  // agente ya ejecutó la herramienta y la siguiente respuesta debe ser
  // el texto final, no más tool_calls.
  const lastMsg = body.messages?.[body.messages.length - 1];
  const lastIsToolResult = lastMsg?.role === "tool";

  // Si el body trae `tools`, el último mensaje NO es tool_result, y el
  // modelo es `mock-tools`, devolvemos tool_calls en vez de texto. Esto
  // permite ejercitar el bucle de tools del agente: el modelo pide
  // `list_files`, el runner lo ejecuta localmente, y la siguiente vuelta
  // ya no lleva tools (el último mensaje es tool_result).
  // `mock-mide`: el agente que MIDE su propio cambio en vez de darlo por bueno.
  //
  // Recorre una sesión de trabajo completa con las herramientas de la v3.40:
  // escribe una página rota, guarda un punto de restauración, la mide, la
  // arregla, la vuelve a medir (ahora sí hay con qué comparar), mira qué
  // archivos se movieron y consulta el mapa del proyecto. Al final entrega el
  // texto de TODAS las herramientas, que es lo que el E2E puede leer.
  //
  // Las rondas se cuentan por los turnos de assistant con `tool_calls`, no por
  // los `role:"tool"`: una ronda puede pedir dos herramientas a la vez y con
  // los resultados el contador se descuadraba.
  // `mock-toca-header`: el agente que intenta escribir el archivo que el
  // usuario protegió. Sirve para comprobar que el bloqueo es real y no una
  // nota que el modelo puede ignorar.
  // `mock-director` / `mock-obrero`: el equipo dirigido. El director reparte
  // en tres trozos y luego cierra; el obrero entrega su parte. Sirve para
  // comprobar que el reparto se lee, que cada ejecutor recibe SOLO su trozo y
  // que el veredicto ve lo que volvió.
  if (body.model === "mock-director") {
    const ultimo = body.messages?.[body.messages.length - 1];
    const texto = typeof ultimo?.content === "string" ? ultimo.content : "";
    if (texto.includes("partir el encargo")) {
      return Response.json({
        choices: [
          {
            message: {
              content: [
                '<trozo titulo="HTML">escribe el html de la portada</trozo>',
                '<trozo titulo="CSS">escribe los estilos</trozo>',
                '<trozo titulo="JS">escribe el script del menú</trozo>',
              ].join("\n"),
            },
            index: 0,
          },
        ],
      });
    }
    // veredicto: se devuelve lo que vio, para poder comprobarlo desde fuera
    const partes = [...texto.matchAll(/<parte n="\d+" titulo="([^"]*)">\n([\s\S]*?)\n<\/parte>/g)]
      .map((m) => `${m[1]}=${m[2].trim()}`)
      .join(" | ");
    return Response.json({
      choices: [{ message: { content: `VEREDICTO DEL DIRECTOR: ${partes}` }, index: 0 }],
    });
  }

  if (body.model?.startsWith("mock-obrero")) {
    const ultimo = body.messages?.[body.messages.length - 1];
    const texto = typeof ultimo?.content === "string" ? ultimo.content : "";
    const m = /<tu-encargo titulo="([^"]*)">/.exec(texto);
    // se devuelve el título recibido: así el test ve qué trozo le tocó a quién
    return Response.json({
      choices: [{ message: { content: `hecho:${m ? m[1] : "SIN-TROZO"}` }, index: 0 }],
    });
  }

  if (body.model === "mock-toca-header") {
    const rondas = (body.messages ?? []).filter(
      (m) => Array.isArray((m as { tool_calls?: unknown[] }).tool_calls) &&
        ((m as { tool_calls?: unknown[] }).tool_calls ?? []).length > 0
    ).length;
    if (body.tools && rondas < 1) {
      const toolCalls = [
        {
          id: "call_header_1",
          type: "function",
          function: {
            name: "write_file",
            arguments: JSON.stringify({ path: "src/Header.tsx", content: "REESCRITO POR EL AGENTE" }),
          },
        },
      ];
      if (body.stream) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ id: "m", choices: [{ delta: { tool_calls: toolCalls }, index: 0 }] })}\n\n`
              )
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
        });
      }
      return Response.json({ choices: [{ message: { content: "", tool_calls: toolCalls }, index: 0 }] });
    }
    const dicho = (body.messages ?? [])
      .filter((m) => m.role === "tool")
      .map((m) => (typeof m.content === "string" ? m.content : ""))
      .join("\n");
    return Response.json({
      choices: [{ message: { content: `Lo que me contestó la herramienta:\n\n${dicho}` }, index: 0 }],
    });
  }

  if (body.model === "mock-mide") {
    const rondas = (body.messages ?? []).filter(
      (m) => Array.isArray((m as { tool_calls?: unknown[] }).tool_calls) &&
        ((m as { tool_calls?: unknown[] }).tool_calls ?? []).length > 0
    ).length;

    const pagina = (roto: boolean) =>
      [
        "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\">",
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
        "<title>Cafetería Prima</title></head>",
        "<body style=\"margin:0;font:16px/1.5 system-ui;color:#111;background:#fff\">",
        "<h1 style=\"font-size:20px;padding:12px\">Cafetería Prima</h1>",
        "<p style=\"padding:0 12px\">Tostado artesanal cada semana.</p>",
        roto ? "<script>noExisteEstaFuncion()</script>" : "",
        "</body></html>",
      ].join("");

    const fn = (name: string, args: unknown) => ({
      id: `call_mide_${name}_${rondas}`,
      type: "function",
      function: { name, arguments: JSON.stringify(args) },
    });

    // El id del punto de restauración NO es adivinable: se lee del texto que
    // devolvió `git_snapshot`, igual que haría un modelo de verdad.
    const idSnapshot = (): string => {
      for (const m of body.messages ?? []) {
        const c = typeof m.content === "string" ? m.content : "";
        const hit = /Snapshot «([^»]+)» creado/.exec(c);
        if (hit) return hit[1];
      }
      return "sin-id";
    };

    const guion: Array<Array<ReturnType<typeof fn>>> = [
      [fn("write_file", { path: "index.html", content: pagina(true) })],
      [fn("git_snapshot", { action: "create", message: "antes de arreglar" })],
      [fn("run_regression", { include_qa: true })],
      [fn("write_file", { path: "index.html", content: pagina(false) })],
      [fn("run_regression", { include_qa: true })],
      [
        fn("snapshot_diff", { a: idSnapshot() }),
        fn("ask_memory", { q: "qué pasó con el gradiente del hero" }),
      ],
    ];

    if (body.tools && rondas < guion.length) {
      const toolCalls = guion[rondas];
      if (body.stream) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  id: "mock-mide-1",
                  choices: [{ delta: { tool_calls: toolCalls }, index: 0 }],
                })}\n\n`
              )
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
        });
      }
      return Response.json({
        choices: [{ message: { content: "", tool_calls: toolCalls }, index: 0 }],
      });
    }

    // Guion agotado: se entrega lo que dijeron las herramientas, literal.
    const dicho = (body.messages ?? [])
      .filter((m) => m.role === "tool")
      .map((m) => (typeof m.content === "string" ? m.content : ""))
      .join("\n\n---\n\n");
    return Response.json({
      choices: [{ message: { content: `Esto es lo que midieron las herramientas:\n\n${dicho}` }, index: 0 }],
    });
  }

  // `mock-verifica`: el agente pide `verify_project` — la comprobación
  // INDEPENDIENTE (v4.24) que no acepta que el modelo se autodeclare
  // aprobado. Escribe una página con hallazgos reales (falta alt, falta
  // lang, falta viewport), la verifica (NO PASS), la arregla, y la
  // vuelve a verificar (PASS). El texto final es literal, igual que
  // `mock-mide`.
  if (body.model === "mock-verifica") {
    const rondas = (body.messages ?? []).filter(
      (m) => Array.isArray((m as { tool_calls?: unknown[] }).tool_calls) &&
        ((m as { tool_calls?: unknown[] }).tool_calls ?? []).length > 0
    ).length;

    const pagina = (rota: boolean) => rota
      ? '<!doctype html><html><body><img src="logo.png"><button></button></body></html>'
      // objetivo de toque real ≥24×24px (WCAG 2.5.8): el botón sin estilo
      // del fixture anterior medía menos de 24px de alto y el nuevo chequeo
      // en vivo lo cazaba — la página "arreglada" tiene que estarlo de verdad.
      : '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Forja</title></head><body><button aria-label="Abrir" style="min-width:44px;min-height:44px;padding:10px 16px">OK</button></body></html>';

    const fn = (name: string, args: unknown) => ({
      id: `call_verifica_${name}_${rondas}`,
      type: "function",
      function: { name, arguments: JSON.stringify(args) },
    });

    const guion: Array<Array<ReturnType<typeof fn>>> = [
      [fn("write_file", { path: "index.html", content: pagina(true) })],
      [fn("verify_project", {})],
      [fn("write_file", { path: "index.html", content: pagina(false) })],
      [fn("verify_project", {})],
    ];

    if (body.tools && rondas < guion.length) {
      const toolCalls = guion[rondas];
      if (body.stream) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  id: "mock-verifica-1",
                  choices: [{ delta: { tool_calls: toolCalls }, index: 0 }],
                })}\n\n`
              )
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
        });
      }
      return Response.json({
        choices: [{ message: { content: "", tool_calls: toolCalls }, index: 0 }],
      });
    }

    const dicho = (body.messages ?? [])
      .filter((m) => m.role === "tool")
      .map((m) => (typeof m.content === "string" ? m.content : ""))
      .join("\n\n---\n\n");
    return Response.json({
      choices: [{ message: { content: `Esto es lo que dijo la verificación:\n\n${dicho}` }, index: 0 }],
    });
  }

  // `mock-diagnostica`: el agente pide `diagnose_project` (v4.25) en vez de
  // `verify_project` — la MISMA verificación, pero convertida en causa +
  // acción + archivo candidato en vez de solo PASS/NO PASS. Escribe una
  // página con un hallazgo real (una imagen sin `alt`), diagnostica
  // (BLOCKED, con «index.html» como candidato), la arregla, y vuelve a
  // diagnosticar (READY). El texto final es literal, igual que `mock-mide`.
  if (body.model === "mock-diagnostica") {
    const rondas = (body.messages ?? []).filter(
      (m) => Array.isArray((m as { tool_calls?: unknown[] }).tool_calls) &&
        ((m as { tool_calls?: unknown[] }).tool_calls ?? []).length > 0
    ).length;

    // Imagen como data: URI para no depender de un segundo archivo — dos
    // `write_file` en la MISMA ronda compartirían nombre de tool y, con el
    // esquema de ids de abajo, el mismo id: el cliente los acumula por id
    // al reensamblar el streaming y uno pisa al otro.
    const pagina = (rota: boolean) => rota
      ? '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Forja</title></head><body><img src="data:image/svg+xml,%3Csvg/%3E"></body></html>'
      : '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Forja</title></head><body><img alt="Logo" src="data:image/svg+xml,%3Csvg/%3E"></body></html>';

    const fn = (name: string, args: unknown) => ({
      id: `call_diagnostica_${name}_${rondas}`,
      type: "function",
      function: { name, arguments: JSON.stringify(args) },
    });

    const guion: Array<Array<ReturnType<typeof fn>>> = [
      [fn("write_file", { path: "index.html", content: pagina(true) })],
      [fn("diagnose_project", {})],
      [fn("write_file", { path: "index.html", content: pagina(false) })],
      [fn("diagnose_project", {})],
    ];

    if (body.tools && rondas < guion.length) {
      const toolCalls = guion[rondas];
      if (body.stream) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  id: "mock-diagnostica-1",
                  choices: [{ delta: { tool_calls: toolCalls }, index: 0 }],
                })}\n\n`
              )
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
        });
      }
      return Response.json({
        choices: [{ message: { content: "", tool_calls: toolCalls }, index: 0 }],
      });
    }

    const dicho = (body.messages ?? [])
      .filter((m) => m.role === "tool")
      .map((m) => (typeof m.content === "string" ? m.content : ""))
      .join("\n\n---\n\n");
    return Response.json({
      choices: [{ message: { content: `Esto es lo que dijo el diagnóstico:\n\n${dicho}` }, index: 0 }],
    });
  }

  // `mock-visual-review`: el agente pide `visual_review` (captura real +
  // crítica de un modelo con visión) sobre el proyecto — la mitad "vea la
  // página" del QA, no la mitad "mida el DOM" que ya prueban los mocks de
  // arriba. Sirve para comprobar el mecanismo ENTERO: la captura de verdad
  // dentro del sandbox oculto (sin `allow-same-origin`) y la llamada
  // INTERNA de vuelta a este mismo mock que hace `visionCritique` por su
  // cuenta, ya con la imagen — sin que el bucle de tools la vea pasar.
  //
  // Esa llamada interna se distingue de la del bucle principal por su
  // FORMA, no por texto propenso a falsos positivos (la lección de "motor
  // 3D"/"marquee" de `efectos.ts`): trae una imagen (`content` es un
  // array) y nunca lleva `tools`, mientras que el bucle principal siempre
  // lleva `tools` mientras dura.
  //
  // `mock-visual-review-sin-vision` es la MISMA escena, pero la llamada con
  // imagen se rechaza como haría un proveedor real cuando el modelo no
  // admite imágenes — para comprobar que la herramienta lo dice en vez de
  // fingir una crítica.
  if (body.model === "mock-visual-review" || body.model === "mock-visual-review-sin-vision") {
    const conImagen = Array.isArray(lastMsg?.content);
    if (conImagen) {
      if (body.model === "mock-visual-review-sin-vision") {
        return Response.json(
          { error: { message: "This model does not support image input." } },
          { status: 400 }
        );
      }
      const critica =
        "El botón principal casi no se distingue del fondo: el contraste es demasiado bajo. El resto de la jerarquía se ve clara.";
      if (body.stream) return sse(critica);
      return Response.json({ choices: [{ message: { content: critica }, index: 0 }] });
    }
    const rondas = (body.messages ?? []).filter(
      (m) => Array.isArray((m as { tool_calls?: unknown[] }).tool_calls) &&
        ((m as { tool_calls?: unknown[] }).tool_calls ?? []).length > 0
    ).length;
    // El proyecto empieza vacío: hace falta escribir una página ANTES de
    // poder capturarla. Dos rondas — igual que `mock-mide` — no una: sin
    // el `write_file`, `visual_review` no tendría nada que renderizar.
    const guion = [
      [
        {
          id: "call_visual_review_write",
          type: "function",
          function: {
            name: "write_file",
            arguments: JSON.stringify({
              path: "index.html",
              content:
                '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Tienda</title></head><body style="margin:0;font-family:system-ui"><h1>Bienvenido a la tienda</h1><button style="background:#eee;color:#eee">Comprar</button></body></html>',
            }),
          },
        },
      ],
      [
        {
          id: "call_visual_review_1",
          type: "function",
          function: { name: "visual_review", arguments: JSON.stringify({ foco: "el hero" }) },
        },
      ],
    ];
    if (body.tools && rondas < guion.length) {
      const toolCalls = guion[rondas];
      if (body.stream) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ id: "mock-visual-review-1", choices: [{ delta: { tool_calls: toolCalls }, index: 0 }] })}\n\n`
              )
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
        });
      }
      return Response.json({ choices: [{ message: { content: "", tool_calls: toolCalls }, index: 0 }] });
    }
    // La herramienta ya devolvió su resultado (crítica, o el aviso de que
    // el modelo no admite imágenes): se entrega literal, para que el E2E
    // pueda leer exactamente lo que dijo `visual_review`.
    const dicho = (body.messages ?? [])
      .filter((m) => m.role === "tool")
      .map((m) => (typeof m.content === "string" ? m.content : ""))
      .join("\n");
    return Response.json({
      choices: [{ message: { content: `Crítica visual: ${dicho}` }, index: 0 }],
    });
  }

  // `mock-llamada-en-texto`: el modelo pide la herramienta como TEXTO, con
  // SU PROPIA plantilla de function-calling (`<function=…><parameter=…>`),
  // en vez de rellenar `tool_calls` de la API — el caso real reportado por
  // un usuario con nvidia/nemotron vía OpenRouter, dos veces seguidas en
  // la misma conversación. Nunca llama a `onToolCalls`: el texto crudo es
  // TODO lo que manda. Sirve para comprobar que Forja reconoce esa
  // plantilla como una llamada de verdad (`tool-calls-texto.ts`), la
  // ejecuta, y no la enseña literal en el chat.
  if (body.model === "mock-llamada-en-texto") {
    if (lastIsToolResult) {
      return Response.json({
        choices: [{ message: { content: "Página escrita." }, index: 0 }],
      });
    }
    const llamada =
      "<function=write_file><parameter=path>index.html</parameter>" +
      '<parameter=content><!DOCTYPE html><html lang="es"><body><h1>Bienvenido a la tienda</h1></body></html></parameter></function>';
    if (body.stream) return sse(llamada);
    return Response.json({ choices: [{ message: { content: llamada }, index: 0 }] });
  }

  if (body.tools && (body.model?.startsWith("mock-tools") || body.model === "mock-lee-url") && !lastIsToolResult) {
    const leeUrl = body.model === "mock-lee-url";
    const toolCalls = [
      {
        id: "call_mock_1",
        type: "function",
        function: leeUrl
          ? { name: "read_url", arguments: JSON.stringify({ url: "http://localhost:3000/api/mock-web" }) }
          : { name: "list_files", arguments: "{}" },
      },
    ];
    if (body.stream) {
      // Streaming: emitimos el tool_call en el primer delta. El cliente
      // (chat-client) lo acumula con `parseToolCallsFromChunk`.
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  id: "mock-tools-1",
                  choices: [{ delta: { tool_calls: toolCalls }, index: 0 }],
                })}\n\n`
              )
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch {
            /* ignore */
          }
        },
      });
      return new Response(stream, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
      });
    }
    return Response.json({
      choices: [{ message: { content: "", tool_calls: toolCalls }, index: 0 }],
    });
  }

  // `mock-corta-y-cae`: escribe media web y se cae a mitad del stream, que es
  // lo que hace un modelo gratis cuando el proveedor le corta. Sirve para
  // comprobar que el failover RESCATA lo escrito en vez de tirarlo.
  if (body.model === "mock-corta-y-cae") {
    const parcial = [
      "Aquí tienes tu página:",
      "",
      "```html",
      "<!DOCTYPE html>",
      '<html lang="es"><head><meta charset="utf-8"><title>Rescate</title></head>',
      "<body>",
      "<p>Un párrafo largo para que el trozo escrito supere el mínimo de rescate y",
      "el failover lo considere trabajo aprovechable en vez de ruido suelto.</p>",
      '<div class="ca',
    ].join("\n");
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ id: "m", choices: [{ delta: { content: parcial }, index: 0 }] })}\n\n`
          )
        );
        // El corte va con un respiro: si se rompe el cuerpo en el mismo tick
        // que el `enqueue`, el cliente ni llega a leer el trozo y entonces no
        // hay trabajo a medias que rescatar — que es justo lo que se prueba.
        setTimeout(() => {
          try {
            controller.error(new Error("El proveedor cortó la conexión"));
          } catch {
            /* ya cerrado */
          }
        }, 150);
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
    });
  }

  // `mock-prosa-cortada`: texto corriente cortado a mitad de una frase, SIN
  // bloque de código de por medio. La forma del texto no delata nada ahí: la
  // única señal es el `finish_reason: "length"` que manda el proveedor.
  if (body.model === "mock-prosa-cortada") {
    const sigue = (body.messages ?? []).some(
      (m) =>
        typeof m.content === "string" &&
        (m.content as string).includes("Tu respuesta anterior se cortó por longitud")
    );
    const texto = sigue
      ? " y este es el final que solo llega si se pidió continuar."
      : "La historia empieza tranquila y avanza sin sobresaltos hasta que de pronto se interrum";
    return Response.json({
      choices: [{ message: { content: texto }, finish_reason: sigue ? "stop" : "length", index: 0 }],
    });
  }

  const reply = buildReply(body);
  if (body.stream) return sse(reply);
  return Response.json({ choices: [{ message: { content: reply }, index: 0 }] });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (!path.join("/").endsWith("models")) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json({ data: MODELOS.map((id) => ({ id })) });
}
