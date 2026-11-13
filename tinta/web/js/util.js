/* Utilidades compartidas: escape, color, contraste. Sin dependencias. */
/* Dentro de la app de Android no existen las descargas del navegador: el APK expone EstilosAndroid.saveFile y el sistema deja elegir dónde guardar. Devuelve true si el archivo se entregó a la app. */
function nativeSave(blob, name) {
  const bridge = window.EstilosAndroid;
  if (!bridge || typeof bridge.saveFile !== "function" || !blob) return false;
  const reader = new FileReader();
  reader.onload = () => { const s = String(reader.result); bridge.saveFile(String(name), blob.type || "application/octet-stream", s.slice(s.indexOf(",") + 1)); };
  reader.readAsDataURL(blob);
  return true;
}
/* Portapapeles nativo (app Android): el WebView no siempre deja usar navigator.clipboard, así que el puente lo hace por la app. */
/* Peticiones https por la app Android (sin CORS). Devuelve una promesa con algo parecido a Response, o null si no hay puente (entonces se usa fetch). */
let nativeHttpSeq = 0;
const nativeHttpPending = {};
if (typeof window !== "undefined") window.__nativeHttpDone = function (id, status, b64, err) {
  const p = nativeHttpPending[id]; if (!p) return; delete nativeHttpPending[id];
  if (err) { p.reject(new TypeError(err)); return; }
  let text = "";
  try { const bin = atob(b64), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); text = new TextDecoder().decode(bytes); } catch (e) { /* cuerpo vacío */ }
  p.resolve({ ok: status >= 200 && status < 300, status, text: async () => text, json: async () => JSON.parse(text), headers: { get: () => null } });
};
function nativeFetch(url, init) {
  const bridge = window.EstilosAndroid;
  if (!bridge || typeof bridge.httpRequest !== "function" || !/^https:\/\//i.test(String(url))) return null;
  init = init || {};
  return new Promise((resolve, reject) => {
    if (init.signal && init.signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const id = ++nativeHttpSeq; nativeHttpPending[id] = { resolve, reject };
    if (init.signal) init.signal.addEventListener("abort", () => { if (nativeHttpPending[id]) { delete nativeHttpPending[id]; try { bridge.httpCancel(id); } catch (e) { /* ya terminó */ } reject(new DOMException("Aborted", "AbortError")); } });
    try { bridge.httpRequest(id, String(init.method || "GET").toUpperCase(), String(url), JSON.stringify(init.headers || {}), init.body == null ? "" : String(init.body), 120000); }
    catch (e) { delete nativeHttpPending[id]; reject(new TypeError("No se pudo enviar la petición.")); }
  });
}
function nativeCopy(text) {
  const bridge = window.EstilosAndroid;
  if (!bridge || typeof bridge.copyText !== "function") return false;
  try { return bridge.copyText(String(text)) === true; } catch (e) { return false; }
}
function nativeRead() {
  const bridge = window.EstilosAndroid;
  if (!bridge || typeof bridge.readText !== "function") return null;
  try { return String(bridge.readText()); } catch (e) { return null; }
}
const APP_VERSION = "14.1.0"; /* CI lo reemplaza por 14.1.<n.º de build> en cada despliegue */

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* Solo se aceptan colores #RGB / #RRGGBB / #RRGGBBAA. Cualquier otra cosa se descarta:
   así un JSON importado no puede inyectar CSS ni JS en atributos. */
const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
function safeColor(c, fallback) {
  c = String(c == null ? "" : c).trim();
  if (/^[0-9a-f]{3,8}$/i.test(c)) c = "#" + c;
  return HEX_RE.test(c) ? c.toUpperCase() : (fallback || "#888888");
}
function safeId(id) { return String(id == null ? "" : id).replace(/[^\w-]/g, "").slice(0, 60); }

function rgb(hex) {
  let h = safeColor(hex).slice(1);
  if (h.length <= 4) h = h.split("").map(x => x + x).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lum(hex) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const [r, g, b] = rgb(hex);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function inkOn(hex) { return contrast(hex, "#111318") >= contrast(hex, "#FFFFFF") ? "#111318" : "#FFFFFF"; }
function sat(hex) {
  const [r, g, b] = rgb(hex), mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}
function bestAccent(colors) {
  const cs = (colors || []).filter(x => x.toUpperCase() !== "#FFFFFF");
  if (!cs.length) return "#3B82F6";
  return cs.slice().sort((x, y) => sat(y) - sat(x))[0];
}
function mix(a, b, p) { // mezcla a→b en proporción p (0..1)
  const A = rgb(a), B = rgb(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * p).toString(16).padStart(2, "0")).join("");
}
function wcag(ratio) { return ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA grande" : "Falla"; }
