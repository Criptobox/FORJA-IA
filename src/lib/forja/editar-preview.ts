/** Forja IA — Tocar un texto de la vista previa y editarlo ahí mismo.
 *
 * Hasta ahora, para cambiar un titular tenías que abrir Ajustes → Sandbox,
 * encontrar el archivo, buscar la línea y escribirle al modelo «cambia esto
 * por esto otro» — o editarlo tú a mano en el editor de código. Para un
 * cambio de una palabra es mucho rodeo.
 *
 * Esto deja tocar el texto DIRECTAMENTE en la vista previa: un botón activa
 * el modo edición, el texto que pasas por encima se marca, lo tocas y se
 * vuelve editable, escribes y confirmas con Enter. El cambio se localiza en
 * el CÓDIGO FUENTE de la respuesta (no en el DOM del iframe, que se pierde en
 * cuanto se repinta) y se persiste ahí — así sigue estando cuando descargas
 * el ZIP o subes a GitHub.
 *
 * ——— Por qué solo texto, nunca estructura ———
 *
 * El piloto solo deja editables los elementos SIN hijos (hojas del árbol):
 * un <h1>, un <p>, un botón con una palabra. Nunca un contenedor con más
 * elementos dentro — tocar su `textContent` borraría lo que hay adentro. Y el
 * cambio se escribe siempre como texto plano, nunca como HTML: no hay forma
 * de que un tache de edición inyecte una etiqueta.
 *
 * ——— Y el texto suelto junto a otros elementos ———
 *
 * `<h1>El café,<em>despacio.</em></h1>` no es una hoja —tiene un `<em>`
 * dentro— así que la regla de arriba lo dejaba fuera entero: se podía tocar
 * «despacio.» (que sí es una hoja) pero no «El café,», sin ninguna pista de
 * por qué. La regla de «solo hojas» sigue en pie —nunca se vuelve editable
 * un CONTENEDOR—, pero ahora se detecta también el nodo de texto suelto
 * bajo el cursor (con `caretRangeFromPoint`/`caretPositionFromPoint`) y se
 * envuelve en un `<span>` de usar y tirar: se edita igual que una hoja, y al
 * terminar —se guarde o se cancele— el `<span>` se deshace y el nodo de
 * texto vuelve a quedar suelto, tal cual estaba. El elemento en sí —el
 * `<h1>`, el `<em>` de al lado— nunca se toca.
 *
 * ——— Por qué se rechaza si no es único ———
 *
 * Localizar el texto en el código fuente es buscar una cadena. Si esa cadena
 * aparece más de una vez —un botón «Ver más» repetido tres veces—, sustituir
 * la primera que se encuentre sería un acierto de suerte, no una edición: se
 * dice que no se puede y por qué, en vez de adivinar.
 */

export const EDIT_STYLE = `
.forja-editable-hover{ outline: 2px dashed color-mix(in oklch, currentColor 60%, transparent) !important; outline-offset: 2px; cursor: text !important; }
.forja-editing{ outline: 2px solid #2563eb !important; outline-offset: 2px; background: color-mix(in oklch, #2563eb 8%, transparent) !important; }
.forja-texto-hover-caja{ position: fixed; pointer-events: none; z-index: 2147483647; outline: 2px dashed color-mix(in oklch, currentColor 60%, transparent); outline-offset: 1px; border-radius: 2px; }
`;

/** El piloto que corre DENTRO del iframe. Mismo patrón que `sandbox-pilot.ts`
 * y `visual-qa.ts`: nada de `eval`, solo `postMessage` cruzando el sandbox. */
export const EDIT_PILOT_SCRIPT = `(function(){
if (window.__forjaEdit) return;
window.__forjaEdit = true;
var activo = false;
var actual = null;
var envuelto = false;
var textoOriginal = "";
var nodoHover = null;
var marcaTexto = null;

function elegible(el){
  if (!el || el.nodeType !== 1) return false;
  if (el.children && el.children.length > 0) return false;
  var tag = el.tagName;
  if (tag === "SCRIPT" || tag === "STYLE" || tag === "BODY" || tag === "HTML") return false;
  var t = (el.textContent || "").trim();
  if (!t || t.length > 300) return false;
  return true;
}

/* Nodo de texto SUELTO junto a otros elementos —«El café,» en
   <h1>El café,<em>despacio.</em></h1>—: el <h1> no es hoja (tiene el <em>
   dentro), así que \`elegible\` lo descarta entero. Este nodo de texto sí
   se puede editar SOLO A ÉL, sin tocar a sus hermanos. */
function elegibleTexto(nodo){
  if (!nodo || nodo.nodeType !== 3) return false;
  var padre = nodo.parentElement;
  if (!padre) return false;
  var tag = padre.tagName;
  if (tag === "SCRIPT" || tag === "STYLE" || tag === "BODY" || tag === "HTML" || tag === "TEXTAREA") return false;
  // si el padre YA es una hoja, ese camino lo cubre \`elegible(padre)\`
  if (!(padre.children && padre.children.length > 0)) return false;
  var t = (nodo.textContent || "").trim();
  if (!t || t.length > 300) return false;
  return true;
}

/* Qué nodo hay exactamente bajo el puntero —no basta con \`ev.target\`: un
   nodo de texto no recibe eventos propios, así que el target de un click
   sobre «El café,» es el <h1> entero, igual que si se hubiera tocado
   «despacio.». Hace falta mirar el punto exacto. */
function nodoDesdePunto(x, y){
  try {
    if (document.caretRangeFromPoint) {
      var r = document.caretRangeFromPoint(x, y);
      return r ? r.startContainer : null;
    }
    if (document.caretPositionFromPoint) {
      var p = document.caretPositionFromPoint(x, y);
      return p ? p.offsetNode : null;
    }
  } catch(e){}
  return null;
}

function marcar(on){
  try { document.documentElement.classList.toggle("forja-editando", on); } catch(e){}
}

function limpiarHover(el){
  if (el && el.classList) el.classList.remove("forja-editable-hover");
}

function limpiarMarcaTexto(){
  if (marcaTexto) { try{ marcaTexto.remove(); }catch(e){} marcaTexto = null; }
  nodoHover = null;
}

/* Resalta el nodo de texto con una caja superpuesta (\`position:fixed\`,
   \`pointer-events:none\`) en vez de tocar el DOM en cada movimiento del
   ratón: envolver y desenvolver un <span> en cada \`mousemove\` sería
   carísimo y además movería el layout constantemente. */
function pintarMarcaTexto(nodo){
  limpiarMarcaTexto();
  try {
    var rango = document.createRange();
    rango.selectNodeContents(nodo);
    var rects = rango.getClientRects();
    if (!rects.length) return;
    var envoltura = document.createElement("div");
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      var caja = document.createElement("div");
      caja.className = "forja-texto-hover-caja";
      caja.style.left = r.left + "px";
      caja.style.top = r.top + "px";
      caja.style.width = r.width + "px";
      caja.style.height = r.height + "px";
      envoltura.appendChild(caja);
    }
    document.body.appendChild(envoltura);
    marcaTexto = envoltura;
    nodoHover = nodo;
  } catch(e){}
}

function onOver(ev){
  if (!activo) return;
  if (elegible(ev.target)) ev.target.classList.add("forja-editable-hover");
}
function onOut(ev){ limpiarHover(ev.target); }

/* Solo para detectar texto SUELTO: si el elemento bajo el ratón ya es una
   hoja, \`onOver\`/\`onOut\` lo cubren, y aquí no se hace nada más. */
function onMove(ev){
  if (!activo || actual) return;
  if (elegible(ev.target)) { limpiarMarcaTexto(); return; }
  var nodo = nodoDesdePunto(ev.clientX, ev.clientY);
  if (elegibleTexto(nodo)) {
    if (nodo !== nodoHover) pintarMarcaTexto(nodo);
  } else if (nodoHover) {
    limpiarMarcaTexto();
  }
}

function terminar(commit){
  if (!actual) return;
  var el = actual;
  var fueEnvuelto = envuelto;
  actual = null;
  envuelto = false;
  el.contentEditable = "false";
  el.classList.remove("forja-editing");
  var nuevo = (el.textContent || "").trim();
  var huboCambio = !!(commit && nuevo && nuevo !== textoOriginal);
  if (!huboCambio) { el.textContent = textoOriginal; }
  // el <span> de un nodo de texto suelto es de usar y tirar: se guarde o se
  // cancele, el DOM tiene que volver a quedar tal como estaba —un nodo de
  // texto plano, sin envoltura—, o el próximo QA vería un <span> que el
  // modelo nunca escribió.
  if (fueEnvuelto) {
    try {
      var nodoTexto = document.createTextNode(el.textContent || "");
      if (el.parentNode) el.parentNode.replaceChild(nodoTexto, el);
    } catch(e){}
  }
  if (huboCambio) {
    try { parent.postMessage({ source: "forja-edit", type: "cambio", original: textoOriginal, nuevo: nuevo }, "*"); } catch(e){}
  }
}

function editarNodoTexto(nodo){
  var contenedor = nodo.parentNode;
  if (!contenedor) return;
  limpiarMarcaTexto();
  var span = document.createElement("span");
  span.textContent = nodo.textContent;
  contenedor.replaceChild(span, nodo);
  actual = span;
  envuelto = true;
  textoOriginal = (span.textContent || "").trim();
  span.contentEditable = "true";
  span.classList.add("forja-editing");
  span.focus();
  try {
    var rango = document.createRange();
    rango.selectNodeContents(span);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(rango);
  } catch(e){}
}

function onClick(ev){
  if (!activo) return;
  var el = ev.target;
  if (elegible(el)) {
    ev.preventDefault();
    ev.stopPropagation();
    if (actual === el) return;
    if (actual) terminar(true);
    actual = el;
    envuelto = false;
    textoOriginal = (el.textContent || "").trim();
    limpiarHover(el);
    el.contentEditable = "true";
    el.classList.add("forja-editing");
    el.focus();
    try {
      var rango = document.createRange();
      rango.selectNodeContents(el);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(rango);
    } catch(e){}
    return;
  }
  var nodo = nodoDesdePunto(ev.clientX, ev.clientY);
  if (elegibleTexto(nodo)) {
    ev.preventDefault();
    ev.stopPropagation();
    if (actual) terminar(true);
    editarNodoTexto(nodo);
  }
}

function onKeydown(ev){
  if (!actual) return;
  if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); terminar(true); }
  else if (ev.key === "Escape") { ev.preventDefault(); terminar(false); }
}
function onFocusOut(ev){
  if (actual && ev.target === actual) terminar(true);
}

document.addEventListener("mouseover", onOver, true);
document.addEventListener("mouseout", onOut, true);
document.addEventListener("mousemove", onMove, true);
document.addEventListener("click", onClick, true);
document.addEventListener("keydown", onKeydown, true);
document.addEventListener("focusout", onFocusOut, true);

window.addEventListener("message", function(e){
  var d = e.data;
  if (!d || d.source !== "forja-edit-cmd") return;
  if (d.op === "toggle") {
    activo = !!d.on;
    marcar(activo);
    if (!activo) {
      limpiarMarcaTexto();
      if (actual) terminar(true);
    }
  }
});
})();`;

/** Inyecta el piloto de edición en el HTML de la vista previa (idempotente,
 * mismo criterio que el resto de instrumentación del preview). */
export function injectEditPilot(html: string): string {
  if (!html || html.includes("__forjaEdit")) return html;
  const tag = `<style>${EDIT_STYLE}</style><script>${EDIT_PILOT_SCRIPT}</script>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tag}</body>`);
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${tag}</html>`);
  return html + tag;
}

/* ------------------------------------------------------------------ */
/* localizar el cambio en el código fuente                             */
/* ------------------------------------------------------------------ */

/** Escapa lo justo para meter texto plano en contenido HTML: `&`, `<`, `>`.
 * No se tocan comillas — no se está escribiendo un atributo, es texto suelto
 * entre etiquetas. */
function escaparHtml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface ResultadoEdicion {
  ok: boolean;
  /** el contenido con el cambio aplicado, solo si `ok` */
  contenido?: string;
  /** por qué no se aplicó, solo si NO `ok` */
  motivo?: string;
}

/** Cuenta cuántas veces aparece `buscado` en `texto`, sin solapar. */
function contarApariciones(texto: string, buscado: string): number {
  if (!buscado) return 0;
  let n = 0;
  let desde = 0;
  for (;;) {
    const i = texto.indexOf(buscado, desde);
    if (i < 0) break;
    n++;
    desde = i + buscado.length;
  }
  return n;
}

/**
 * Busca `original` (el texto tal como lo devolvió el navegador, ya
 * recortado) dentro del código fuente de la respuesta y lo sustituye por
 * `nuevo`. Dos motivos honestos para no aplicar el cambio, en vez de
 * adivinar:
 *
 *  - **no aparece**: el HTML fuente puede llevar el texto con entidades
 *    (`&amp;`, `&quot;`…) que el navegador ya decodificó al leer
 *    `textContent`. Se prueba también la forma escapada antes de rendirse.
 *  - **aparece más de una vez**: sustituir «la primera» sería un acierto de
 *    suerte. Se dice que hay que ir al Sandbox a elegir cuál.
 */
export function aplicarEdicionTexto(
  contenido: string,
  original: string,
  nuevo: string
): ResultadoEdicion {
  const buscadoOriginal = original.trim();
  const buscadoNuevo = nuevo.trim();
  if (!buscadoOriginal || !buscadoNuevo) {
    return { ok: false, motivo: "el texto no puede quedar vacío" };
  }
  if (buscadoOriginal === buscadoNuevo) {
    return { ok: false, motivo: "no cambió nada" };
  }

  // El reemplazo se escribe SIEMPRE como texto HTML válido — se inserta en
  // contenido de página, nunca en un atributo — sea cual sea la forma en la
  // que se encontró el original.
  const reemplazo = escaparHtml(buscadoNuevo);
  const candidatos = [buscadoOriginal, escaparHtml(buscadoOriginal)];

  for (const buscar of candidatos) {
    const veces = contarApariciones(contenido, buscar);
    if (veces === 0) continue;
    if (veces > 1) {
      return {
        ok: false,
        motivo: `«${buscadoOriginal.slice(0, 40)}» aparece ${veces} veces en el código: edítalo desde el Sandbox para elegir cuál`,
      };
    }
    const i = contenido.indexOf(buscar);
    const contenidoNuevo = contenido.slice(0, i) + reemplazo + contenido.slice(i + buscar.length);
    return { ok: true, contenido: contenidoNuevo };
  }

  return {
    ok: false,
    motivo: "no se encontró ese texto en el código de la respuesta: edítalo desde el Sandbox",
  };
}
