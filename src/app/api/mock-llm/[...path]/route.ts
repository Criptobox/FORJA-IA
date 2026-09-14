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
  "mock-cortado",
  "mock-vacio",
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
  "mock-proyecto-repo",
  "mock-3d-mal-puesto",
  "mock-3d",
  "mock-scroll",
  "mock-tema-en-head",
  "mock-texto-mixto",
  "mock-boton-roto",
  "mock-enlace-roto",
  "mock-mide",
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
  "<title>Demo Prism</title>",
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
  "<p>Esta página se generó con Prism AI y se renderiza mientras la IA escribe.</p>",
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
  // dos cosas: que Prism añade `prism-fx.css`/`prism-fx.js` al proyecto por su
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
      '<link rel="stylesheet" href="prism-fx.css">',
      "</head>",
      '<body style="font-family:system-ui;margin:0;padding:24px">',
      '<section data-fx="reveal"><h1>Titular que entra al hacer scroll</h1></section>',
      '<section data-fx="stagger" style="margin-top:4000px">',
      "<p>Primero</p><p>Segundo</p>",
      '<button id="b" onclick="document.getElementById(\'n\').textContent=\'pulsado\'">Púlsame</button>',
      '<span id="n">sin pulsar</span>',
      "</section>",
      '<script src="prism-fx.js" defer></script>',
      "</body></html>",
      "```",
    ].join("\n");
  }

  // `mock-generica`: la página de manual de un generador — Lorem ipsum, tres
  // tarjetas clonadas, un solo tamaño de letra, la fuente del sistema y un
  // hero centrado con su botón. La segunda entrega es la pulida. Sirve para
  // comprobar que Prism MIDE lo genérico en la página pintada y se lo
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
  // PROHIBIDO (EFECTOS_POR_DIRECCION). Sirve para comprobar que Prism lo
  // detecta en la página ya pintada y se lo devuelve al modelo, igual que
  // hace con lo genérico — dogfooding: hasta ahora nadie comprobaba esto,
  // el prompt lo prohibía pero nadie miraba si se hacía caso.
  if (modelo === "mock-3d-mal-puesto") {
    const leCorrigieron = msgs.some(
      (m) => typeof m.content === "string" && (m.content as string).includes("motor 3D")
    );
    const escena = leCorrigieron
      ? ""
      : '<canvas data-fx3d="3d-malla" class="fx-mesh" style="width:100%;height:300px;display:block"></canvas>\n<script src="prism-3d.js" defer></script>\n';
    return [
      leCorrigieron ? "Quitado el motor 3D." : "Aquí tienes la página.",
      "",
      "```html",
      "<!DOCTYPE html>",
      '<html lang="es"><head><meta charset="utf-8"><title>Tienda</title>',
      '<link rel="stylesheet" href="prism-fx.css"></head>',
      '<body style="margin:0;font-family:system-ui">',
      "<h1>Bienvenido a la tienda</h1>",
      escena,
      "</body></html>",
      "```",
    ].join("\n");
  }

  // `mock-generica-terca`: la MISMA página de manual, pero que NUNCA se
  // pule por mucho que se le corrija — sirve para llegar al tope de
  // MAX_REVISIONES con la página todavía genérica, y comprobar que Prism lo
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
  // comprobar que Prism también añade `prism-3d.js` cuando hace falta.
  if (modelo === "mock-3d") {
    return [
      "Aquí tienes la escena.",
      "",
      "```html",
      "<!DOCTYPE html>",
      '<html lang="es"><head><meta charset="utf-8">',
      "<title>Con 3D</title>",
      '<link rel="stylesheet" href="prism-fx.css"></head>',
      '<body style="margin:0;color:oklch(0.7 0.2 280)">',
      '<canvas data-fx3d="3d-malla" class="fx-mesh" style="width:100%;height:400px;display:block"></canvas>',
      '<script src="prism-3d.js" defer></script>',
      "</body></html>",
      "```",
    ].join("\n");
  }

  // `mock-tema-en-head`: el patrón MÁS común en una web generada por un
  // modelo de verdad — leer el tema guardado ANTES del primer pintado, para
  // no dar el flash del tema equivocado. El script vive en `<head>`, antes
  // de cualquier cosa que Prism inyecte. Sirve para comprobar que el puente
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
      '<link rel="stylesheet" href="prism-fx.css"></head>',
      '<body style="margin:0;font-family:system-ui">',
      '<section data-fx="pin" style="height:300vh">',
      '<div data-fx="pin-inner" style="display:flex;align-items:center;justify-content:center">',
      '<p data-fx-step>Paso uno</p><p data-fx-step>Paso dos</p><p data-fx-step>Paso tres</p>',
      "</div></section>",
      '<section data-fx="horizontal" style="height:300vh">',
      '<div data-fx="horizontal-track">',
      '<div style="width:100vw;flex:none">Panel A</div><div style="width:100vw;flex:none">Panel B</div><div style="width:100vw;flex:none">Panel C</div>',
      "</div></section>",
      '<script src="prism-fx.js" defer></script>',
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
        'rd"><h1>Prism</h1><p>Página entera tras empalmar los dos trozos.</p></div>',
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
  return "¡Hola! Soy **Prism AI** funcionando con tu API.\n\nTodo el pipeline opera correctamente: `UI → proxy → servidor → SSE → UI`.";
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
    "¡Hola! Soy **Prism AI** hablando el protocolo de Anthropic.\n\n" +
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

  if (body.tools && (body.model === "mock-tools" || body.model === "mock-lee-url") && !lastIsToolResult) {
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
