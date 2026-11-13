/* Motor de diseños.
   Cada estilo es una función  (t, e) => [html, css]  registrada en D["familia.variante"].
   De ese par salen DOS cosas idénticas: la vista previa (Shadow DOM) y el código a copiar.
   Así lo que ves es exactamente lo que copias. */
const D = {};

/* Tokens derivados de una entrada: colores por rol, superficies claro/oscuro y radios. */
function tokens(e) {
  const c = (e.colors && e.colors.length ? e.colors : ["#888888"]).slice(0, 6).map(x => safeColor(x));
  const dark = e.mode === "dark";
  const rs = String(e.radius == null ? "16" : e.radius);
  const pct = rs.indexOf("%") >= 0, n = parseFloat(rs), rad = isNaN(n) ? 16 : n;
  const R = pct ? 20 : Math.min(rad, 32);
  const a = bestAccent(c);
  return {
    c, c0: c[0], c1: c[1] || c[0], c2: c[2] || c[1] || c[0], c3: c[3] || c[2] || c[1] || c[0],
    a, on: inkOn(a), dark,
    pr: sat(a) > 0.25 ? a : "#1C1C1E", onpr: inkOn(sat(a) > 0.25 ? a : "#1C1C1E"),
    bg: dark ? "#14151C" : "#FFFFFF", sf: dark ? "#1F212B" : "#F3F4F7",
    tx: dark ? "#F5F6FA" : "#14161B", mu: dark ? "#9BA3B4" : "#6B7280",
    ln: dark ? "rgba(255,255,255,.10)" : "rgba(20,22,27,.08)",
    r: R + "px", rad: R, pill: (pct || rad >= 24) ? "999px" : R + "px", round: pct, rs
  };
}

/* Variante por defecto de cada pestaña (para estilos creados por el usuario). */
const TAB_DEFAULT = {
  Chat: "chat.clean", Tarjetas: "card.product", Avatares: "avatar.photo", Plantillas: "tpl.store",
  Barras: "bar.plain", Botones: "btn.primary", Paletas: "pal.sample", Tipografía: "type.accent",
  Entradas: "input.search", Encabezados: "head.title", Listas: "list.settings", Formularios: "form.field",
  Hojas: "sheet.bottom", Avisos: "notice.toast", Datos: "data.stat"
};

function variantOf(e) {
  if (e.v && D[e.v]) return e.v;
  return TAB_DEFAULT[e.tab] || "pal.sample";
}

function designParts(e) {
  const f = D[variantOf(e)] || D["pal.sample"];
  const r = f(tokens(e), e);
  return { html: r[0], css: r[1] };
}

/* Código que se copia: HTML + <style>, autocontenido. */
function designCode(e) {
  if (e.code && String(e.code).trim()) return String(e.code);
  const p = designParts(e);
  return p.html + "\n\n<style>\n*{box-sizing:border-box;margin:0}\n" + p.css + "\n</style>";
}

/* Contenido del Shadow DOM de la vista previa. */
const SHADOW_BASE =
  ":host{display:block;font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;color:#14161B;line-height:1.3}" +
  "*{box-sizing:border-box;margin:0}button{font:inherit;border:0;cursor:pointer;background:none;color:inherit}" +
  "svg{display:block;flex:none}p{margin:0}";
function designShadow(e) {
  const p = designParts(e);
  return "<style>" + SHADOW_BASE + p.css + "</style>" + p.html;
}

/* Pequeños ayudantes de plantilla */
const lines = (...w) => w.map(x => '<i class="ln" style="width:' + x + '"></i>').join("");
function stars(n, color) {
  return '<span style="display:inline-flex;gap:2px;color:' + color + '">' + Array(n).fill(icf("star", 12)).join("") + "</span>";
}
