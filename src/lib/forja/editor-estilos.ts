/** Forja IA — Editor de estilos en la vista previa.
 *
 * `editar-preview.ts` deja cambiar TEXTOS tocándolos. Esto es su pareja para
 * el diseño: tocas un elemento y cambias su color, fondo, tamaño de letra,
 * peso, espaciado, radio o alineación; o cambias un token de `:root`
 * (`--acento`, `--fondo`…) y se repinta toda la página que lo usa.
 *
 * ——— Dónde se guarda el cambio ———
 *
 * Igual que con el texto, NO en el DOM del iframe (se pierde al repintar),
 * sino en el código de la respuesta. Localizar «el <h2> de la tercera
 * sección» dentro del HTML fuente a base de buscar cadenas no es fiable, así
 * que en vez de reescribir el elemento se añade UN bloque al final del
 * documento:
 *
 *   <style data-forja-ajustes>
 *   :root { --acento: #e11d48; }
 *   body > main > section:nth-of-type(3) > h2 { color: #0f172a !important; }
 *   </style>
 *
 * Va al final del <body> para ganar por orden a todo el CSS anterior, y las
 * reglas de elemento llevan `!important` para ganar también por
 * especificidad (lo que ves en el panel es lo que queda). Los tokens no lo
 * llevan: les basta el orden, y así el propio código puede seguir
 * sobrescribiéndolos donde quiera. El bloque es legible, viaja en el ZIP y en
 * GitHub, y el modelo lo ve en la siguiente vuelta.
 *
 * ——— Seguridad ———
 *
 * Selectores y valores vienen de la página (un iframe que no controlamos) y
 * acaban dentro de un <style> del código: solo se aceptan caracteres que no
 * pueden cerrar la regla ni la etiqueta (nada de `{`, `}`, `;`, `<`, `/*`).
 */

/** Propiedades que el panel deja tocar, con su nombre CSS. */
export const PROPS_EDITABLES = [
  "color",
  "background-color",
  "font-size",
  "font-weight",
  "letter-spacing",
  "line-height",
  "padding",
  "border-radius",
  "text-align",
] as const;
export type PropEditable = (typeof PROPS_EDITABLES)[number];
export type PropsEstilo = Partial<Record<PropEditable, string>>;

/** Lo que el piloto manda al seleccionar un elemento. */
export interface SeleccionEstilo {
  selector: string;
  etiqueta: string;
  estilos: PropsEstilo;
}

export interface CambioEstilo {
  /** selector del elemento, o `:root` para tokens */
  selector: string;
  /** propiedad → valor; un valor vacío quita la propiedad */
  props: Record<string, string>;
}

export interface ResultadoAjuste {
  ok: boolean;
  contenido?: string;
  motivo?: string;
}

const RE_SELECTOR = /^[A-Za-z0-9\s>#.:_()\-*]+$/;
const RE_VALOR = /^[A-Za-z0-9\s#%.,()\-+/"']+$/;
const RE_PROP_TOKEN = /^--[A-Za-z0-9_-]{1,60}$/;

export function selectorValido(sel: string): boolean {
  const s = sel.trim();
  return s.length > 0 && s.length <= 300 && (s === ":root" || RE_SELECTOR.test(s));
}

export function valorValido(v: string): boolean {
  const s = v.trim();
  return s.length <= 120 && (s === "" || (RE_VALOR.test(s) && !s.includes("/*") && !/\b(?:url|expression)\s*\(/i.test(s)));
}

function propValida(selector: string, prop: string): boolean {
  if (selector === ":root") return RE_PROP_TOKEN.test(prop);
  return (PROPS_EDITABLES as readonly string[]).includes(prop);
}

/** `rgb(…)`, `rgba(…)` o `#rgb/#rrggbb` → `#rrggbb` para un <input type=color>.
 *  Lo que no es un color opaco representable (oklch, transparente…) da null. */
export function aHex(css: string | null | undefined): string | null {
  const t = (css ?? "").trim().toLowerCase();
  let m = t.match(/^#([0-9a-f]{3})$/);
  if (m) return `#${m[1].split("").map((c) => c + c).join("")}`;
  m = t.match(/^#([0-9a-f]{6})$/);
  if (m) return `#${m[1]}`;
  m = t.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (!m) return null;
  if (m[4] != null) {
    const a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    if (a < 1) return null;
  }
  return `#${[m[1], m[2], m[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0")).join("")}`;
}

type Reglas = Map<string, Map<string, string>>;

const RE_BLOQUE = /<style data-forja-ajustes>([\s\S]*?)<\/style>\s*/i;

/** Lee las reglas del bloque de ajustes (solo el formato que escribimos). */
export function parsearAjustes(css: string): Reglas {
  const reglas: Reglas = new Map();
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim();
    if (!selectorValido(selector)) continue;
    const props = new Map<string, string>();
    for (const decl of m[2].split(";")) {
      const i = decl.indexOf(":");
      if (i < 0) continue;
      const prop = decl.slice(0, i).trim();
      const valor = decl.slice(i + 1).replace(/!important/i, "").trim();
      if (prop && valor && propValida(selector, prop) && valorValido(valor)) props.set(prop, valor);
    }
    if (props.size) reglas.set(selector, props);
  }
  return reglas;
}

export function serializarAjustes(reglas: Reglas): string {
  const lineas = ["/* Ajustes hechos en la vista previa de Forja. Edítalos o bórralos sin miedo. */"];
  // los tokens primero: es lo que se lee para entender el resto
  const orden = [...reglas.keys()].sort((a, b) => (a === ":root" ? -1 : b === ":root" ? 1 : 0));
  for (const sel of orden) {
    const props = reglas.get(sel);
    if (!props?.size) continue;
    const imp = sel === ":root" ? "" : " !important";
    const cuerpo = [...props].map(([p, v]) => `${p}: ${v}${imp};`).join(" ");
    lineas.push(`${sel} { ${cuerpo} }`);
  }
  return lineas.join("\n");
}

/** Mezcla cambios en unas reglas. Valida todo antes de tocar nada. */
export function fusionarAjustes(reglas: Reglas, cambios: readonly CambioEstilo[]): { ok: true; reglas: Reglas } | { ok: false; motivo: string } {
  const nuevas: Reglas = new Map([...reglas].map(([s, p]) => [s, new Map(p)]));
  for (const c of cambios) {
    const sel = c.selector.trim();
    if (!selectorValido(sel)) return { ok: false, motivo: `selector no admitido: «${sel.slice(0, 60)}»` };
    const props = nuevas.get(sel) ?? new Map<string, string>();
    for (const [p, v] of Object.entries(c.props)) {
      if (!propValida(sel, p)) return { ok: false, motivo: `propiedad no admitida: «${p}»` };
      if (!valorValido(v)) return { ok: false, motivo: `valor no admitido para ${p}: «${v.slice(0, 40)}»` };
      if (v.trim()) props.set(p, v.trim());
      else props.delete(p);
    }
    if (props.size) nuevas.set(sel, props);
    else nuevas.delete(sel);
  }
  return { ok: true, reglas: nuevas };
}

/** Dónde empieza y acaba el documento HTML que pinta la vista previa: el
 *  ÚLTIMO de la respuesta, igual que `extractPreviewHtml`. */
function ultimoDocumento(contenido: string): { ini: number; fin: number } | null {
  let ini = -1;
  let doctype = -1;
  for (const m of contenido.matchAll(/<!doctype\s+html|<html[\s>]/gi)) {
    const esHtml = /^<html/i.test(m[0]);
    const i = m.index ?? 0;
    // el <html> que va justo detrás de su doctype es el mismo documento
    if (esHtml && doctype >= 0 && i - doctype < 200) continue;
    ini = i;
    doctype = esHtml ? -1 : i;
  }
  if (ini < 0) return null;
  const resto = contenido.slice(ini);
  const cierre = resto.match(/<\/html\s*>/i);
  const cerca = resto.indexOf("```");
  let fin = cerca >= 0 ? cerca : resto.length;
  if (cierre?.index != null && cierre.index < fin) fin = cierre.index + cierre[0].length;
  return { ini, fin: ini + fin };
}

/** Aplica cambios de estilo al código de la respuesta. */
export function aplicarAjustesEnFuente(contenido: string, cambios: readonly CambioEstilo[]): ResultadoAjuste {
  if (!cambios.length) return { ok: false, motivo: "no hay cambios" };
  const doc = ultimoDocumento(contenido);
  if (!doc) return { ok: false, motivo: "la respuesta no trae un documento HTML donde guardar el estilo" };
  let html = contenido.slice(doc.ini, doc.fin);

  const existente = html.match(RE_BLOQUE);
  const r = fusionarAjustes(parsearAjustes(existente?.[1] ?? ""), cambios);
  if (!r.ok) return r;

  const bloque = r.reglas.size ? `<style data-forja-ajustes>\n${serializarAjustes(r.reglas)}\n</style>\n` : "";
  if (existente) {
    html = html.replace(RE_BLOQUE, bloque);
  } else if (!bloque) {
    return { ok: false, motivo: "no hay nada que quitar" };
  } else {
    const cierreBody = html.search(/<\/body\s*>(?![\s\S]*<\/body\s*>)/i);
    const cierreHtml = html.search(/<\/html\s*>/i);
    const donde = cierreBody >= 0 ? cierreBody : cierreHtml >= 0 ? cierreHtml : html.length;
    html = html.slice(0, donde) + bloque + html.slice(donde);
  }
  return { ok: true, contenido: contenido.slice(0, doc.ini) + html + contenido.slice(doc.fin) };
}

/** Las reglas vigentes en el documento de la respuesta (para el panel). */
export function ajustesDeFuente(contenido: string): Reglas {
  const doc = ultimoDocumento(contenido);
  if (!doc) return new Map();
  return parsearAjustes(contenido.slice(doc.ini, doc.fin).match(RE_BLOQUE)?.[1] ?? "");
}

/** CSS para previsualizar en vivo, antes de guardar. */
export function cssDeCambios(cambios: readonly CambioEstilo[]): string {
  const r = fusionarAjustes(new Map(), cambios);
  return r.ok ? serializarAjustes(r.reglas) : "";
}

/* ------------------------------------------------------------------ */
/* el piloto que corre dentro del iframe                               */
/* ------------------------------------------------------------------ */

export const ESTILO_PILOT_CSS = `
.forja-estilo-hover{ outline: 2px dashed #f97316 !important; outline-offset: 2px; cursor: crosshair !important; }
.forja-estilo-sel{ outline: 2px solid #f97316 !important; outline-offset: 2px; }
`;

/** Mismo patrón que `EDIT_PILOT_SCRIPT`: nada de eval, solo postMessage. */
export const ESTILO_PILOT_SCRIPT = `(function(){
if (window.__forjaEstilo) return;
window.__forjaEstilo = true;
var activo = false, sel = null, vivo = null, modo = "estilo";
var PROPS = ${JSON.stringify(PROPS_EDITABLES)};
function prohibido(el){ return !el || el.nodeType !== 1 || /^(HTML|BODY|SCRIPT|STYLE|HEAD|META|LINK)$/.test(el.tagName); }
function idValido(id){ return /^[A-Za-z][A-Za-z0-9_-]*$/.test(id || ""); }
function selectorDe(el){
  var partes = [];
  while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
    if (idValido(el.id)) { partes.unshift("#" + el.id); break; }
    var tag = el.tagName.toLowerCase(), i = 1, h = el, total = 0;
    while ((h = h.previousElementSibling)) if (h.tagName === el.tagName) i++;
    if (el.parentElement) { var hs = el.parentElement.children; for (var k = 0; k < hs.length; k++) if (hs[k].tagName === el.tagName) total++; }
    partes.unshift(total > 1 ? tag + ":nth-of-type(" + i + ")" : tag);
    el = el.parentElement;
  }
  if (!partes.length || partes[0].charAt(0) !== "#") partes.unshift("body");
  return partes.join(" > ");
}
function tokens(){
  var out = {}, n = 0, cs = getComputedStyle(document.documentElement);
  try {
    for (var i = 0; i < document.styleSheets.length; i++) {
      var reglas; try { reglas = document.styleSheets[i].cssRules; } catch(e) { continue; }
      for (var j = 0; j < reglas.length; j++) {
        var r = reglas[j];
        if (r.selectorText !== ":root" || !r.style) continue;
        for (var k = 0; k < r.style.length && n < 40; k++) {
          var p = r.style[k];
          if (p.indexOf("--") === 0 && !(p in out)) { out[p] = cs.getPropertyValue(p).trim(); n++; }
        }
      }
    }
  } catch(e){}
  return out;
}
/* Modo «señalar»: lo que se toca va al chat como referencia para la IA.
   Un icono dentro de un botón señala el BOTÓN; y se manda también el
   apartado que lo contiene, por si se quiere ampliar a toda la sección. */
function limpio(el){
  var c = el.cloneNode(true);
  var todos = [c].concat(Array.prototype.slice.call(c.querySelectorAll ? c.querySelectorAll("[class]") : []));
  for (var i = 0; i < todos.length; i++) { if (todos[i].classList) { todos[i].classList.remove("forja-estilo-hover"); todos[i].classList.remove("forja-estilo-sel"); if (!todos[i].className) todos[i].removeAttribute("class"); } }
  return c.outerHTML || "";
}
function info(el){
  return { etiqueta: el.tagName.toLowerCase(), selector: selectorDe(el), texto: (el.innerText || el.textContent || el.getAttribute("aria-label") || el.getAttribute("alt") || "").trim().slice(0, 300), html: limpio(el).slice(0, 4000) };
}
function senalar(el){
  var objetivo = (el.closest && el.closest("button,a,label,summary,[role=button],input,select,textarea")) || el;
  var seccion = objetivo.parentElement && objetivo.parentElement.closest ? objetivo.parentElement.closest("section,article,header,footer,nav,aside,form,li,figure,main") : null;
  if (seccion && (seccion === document.body || seccion === document.documentElement)) seccion = null;
  var m = info(objetivo);
  m.type = "senalado";
  if (seccion) m.seccion = info(seccion);
  objetivo.classList.add("forja-estilo-sel");
  setTimeout(function(){ objetivo.classList.remove("forja-estilo-sel"); }, 900);
  enviar(m);
}
function enviar(m){ m.source = "forja-estilo"; try { parent.postMessage(m, "*"); } catch(e){} }
function over(ev){ if (activo && !prohibido(ev.target)) ev.target.classList.add("forja-estilo-hover"); }
function out(ev){ if (ev.target && ev.target.classList) ev.target.classList.remove("forja-estilo-hover"); }
function click(ev){
  if (!activo || prohibido(ev.target)) return;
  ev.preventDefault(); ev.stopPropagation();
  if (modo === "senalar") { ev.target.classList.remove("forja-estilo-hover"); senalar(ev.target); return; }
  if (sel) sel.classList.remove("forja-estilo-sel");
  sel = ev.target;
  sel.classList.remove("forja-estilo-hover");
  sel.classList.add("forja-estilo-sel");
  var cs = getComputedStyle(sel), estilos = {};
  for (var i = 0; i < PROPS.length; i++) estilos[PROPS[i]] = cs.getPropertyValue(PROPS[i]).trim();
  enviar({ type: "seleccion", selector: selectorDe(sel), etiqueta: sel.tagName.toLowerCase(), estilos: estilos });
}
document.addEventListener("mouseover", over, true);
document.addEventListener("mouseout", out, true);
document.addEventListener("click", click, true);
window.addEventListener("message", function(e){
  var d = e.data;
  if (!d || d.source !== "forja-estilo-cmd") return;
  if (d.op === "toggle") {
    activo = !!d.on;
    modo = d.modo === "senalar" ? "senalar" : "estilo";
    if (activo && modo === "estilo") enviar({ type: "tokens", tokens: tokens() });
    else if (sel) { sel.classList.remove("forja-estilo-sel"); sel = null; }
  } else if (d.op === "vivo" && typeof d.css === "string") {
    if (!vivo) { vivo = document.createElement("style"); vivo.setAttribute("data-forja-vivo", ""); (document.body || document.documentElement).appendChild(vivo); }
    vivo.textContent = d.css;
  }
});
enviar({ type: "listo" });
})();`;

/** Inyecta el piloto de estilos (idempotente). */
export function injectEstiloPilot(html: string): string {
  if (!html || html.includes("__forjaEstilo")) return html;
  const tag = `<style>${ESTILO_PILOT_CSS}</style><script>${ESTILO_PILOT_SCRIPT}</script>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${tag}</body>`);
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${tag}</html>`);
  return html + tag;
}
