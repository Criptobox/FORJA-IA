/* Capa oscura de Tinta: adapta el CSS de cualquier bloque a una paleta oscura sin tocar sus ilustraciones.
   Los fondos claros pasan a la superficie oscura (conservando un poco de su tono), los bordes claros a la línea
   de la paleta, los botones negros al acento, y cada color de texto se aclara hasta leerse (contraste ≥ 4,5)
   sobre el fondo que tendrá. Los colores vivos y las ilustraciones SVG del HTML no cambian. */
(function (root) {
  'use strict';
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  function parse(h) {
    h = h.replace('#', '');
    if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    return { rgb: n, a: h.length === 8 ? h.slice(6) : '' };
  }
  const hex = rgb => '#' + rgb.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const lum = rgb => { const [r, g, b] = rgb.map(v => v / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4); return r * .2126 + g * .7152 + b * .0722; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  function toHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
    if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
    return [h, s, l];
  }
  function toRgb([h, s, l]) {
    if (!s) return [l * 255, l * 255, l * 255];
    const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  const rgbOf = c => parse(c).rgb;
  /* Un fondo claro → superficie oscura. Blanco = superficie; tonos casi blancos un poco más claros. */
  function darkSurface(rgb, P) {
    const [h, s, l] = toHsl(rgb), base = toHsl(rgbOf(P.surface));
    const L = clamp(base[2] + (1 - l) * .45, 0, .32);
    return s > .25 ? toRgb([h, Math.min(s, .28), L]) : toRgb([base[0], base[1], L]);
  }
  /* Un texto que no se lee sobre bg → el más parecido que sí se lea. */
  function readable(rgb, bg, P) {
    if (contrast(rgb, bg) >= 4.5) return rgb;
    const [h, s, l] = toHsl(rgb), dark = lum(bg) < .2;
    if (dark && s < .3) { const ink = rgbOf(P.ink), muted = rgbOf(P.muted || P.ink); return l < .25 ? ink : (contrast(muted, bg) >= 4.5 ? muted : ink); }
    let L = l; for (let i = 0; i < 40; i++) { L = clamp(L + (dark ? .03 : -.03)); const c = toRgb([h, s, L]); if (contrast(c, bg) >= 4.5) return c; }
    return dark ? [255, 255, 255] : [17, 17, 17];
  }
  const NAMED = { white: '#ffffff', black: '#000000' };
  const COLOR = /#[0-9a-f]{8}\b|#[0-9a-f]{6}\b|#[0-9a-f]{3,4}\b|rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/gi;
  function mapColors(value, fn) {
    return value.replace(/\b(white|black)\b/gi, m => NAMED[m.toLowerCase()]).replace(COLOR, (m, r, g, b, a) => {
      let rgb, alpha = '';
      if (r !== undefined) { rgb = [+r, +g, +b]; if (a !== undefined) alpha = Math.round(clamp(+a) * 255).toString(16).padStart(2, '0'); }
      else { const p = parse(m); if (!p) return m; rgb = p.rgb; alpha = p.a; }
      const out = fn(rgb, alpha);
      return out ? hex(out) + alpha : m;
    });
  }
  const firstColor = v => { const m = /#[0-9a-f]{6}\b/i.exec(v); return m ? rgbOf(m[0]) : null; };
  const BG = /^(background|background-color|background-image)$/, LINE = /^(border|border-[a-z-]+|outline|outline-color|box-shadow|text-decoration-color|caret-color)$/, TEXT = /^(color|fill|stroke|-webkit-text-fill-color)$/;
  function rule(selector, body, P) {
    const isButton = /button|\.btn|\bcta\b|\.add\b|\.buy\b|\.go\b|\.send\b/i.test(selector);
    const decls = body.split(';'); let ruleBg = null;
    const out = decls.map(d => {
      const i = d.indexOf(':'); if (i < 0) return d;
      const prop = d.slice(0, i).trim().toLowerCase(); let val = d.slice(i + 1);
      if (BG.test(prop) || prop === 'background') {
        val = mapColors(val, (rgb, alpha) => {
          const [, s] = toHsl(rgb), L = lum(rgb);
          if (alpha && parseInt(alpha, 16) < 90) return null;
          if (L > .4) return darkSurface(rgb, P);
          if (isButton && L < .06 && s < .25) return rgbOf(P.accent);
          return null;
        });
        const c = firstColor(val); if (c && !ruleBg) ruleBg = c;
      } else if (LINE.test(prop)) {
        val = mapColors(val, (rgb, alpha) => (lum(rgb) > .55 && !(alpha && prop === 'box-shadow' && /inset/.test(val))) ? rgbOf(P.line) : (prop === 'box-shadow' && lum(rgb) > .55 ? rgbOf(P.surface) : null));
      }
      return d.slice(0, i + 1) + val;
    });
    const bg = ruleBg || rgbOf(P.surface);
    return out.map(d => {
      const i = d.indexOf(':'); if (i < 0) return d;
      const prop = d.slice(0, i).trim().toLowerCase();
      if (!TEXT.test(prop)) return d;
      return d.slice(0, i + 1) + mapColors(d.slice(i + 1), rgb => { const r = readable(rgb, bg, P); return r === rgb ? null : r; });
    }).join(';');
  }
  /* Solo reglas «hoja» (sin llaves dentro): así entra también en @media y @keyframes. */
  function css(text, P) {
    if (!text || !P) return text || '';
    return text.replace(/([^{}]*)\{([^{}]*)\}/g, (m, sel, body) => sel + '{' + rule(sel, body, P) + '}');
  }
  /* style="…" del HTML fuera de los SVG. */
  function html(markup, P) {
    if (!markup || !P) return markup || '';
    return markup.replace(/(<(?!svg|path|circle|rect|ellipse|g |stop|linearGradient|radialGradient)[a-z][a-z0-9-]*\b[^>]*\sstyle=")([^"]*)(")/gi, (m, a, st, z) => a + rule('', st, P) + z);
  }
  const muted = P => hex(toRgb((([h, s, l]) => [h, s * .5, clamp(l * .78)])(toHsl(rgbOf(P.ink)))));
  const isDark = P => !!P && lum(rgbOf(P.bg)) < .1;
  root.TintaDark = { css, html, isDark, muted, contrast: (a, b) => contrast(rgbOf(a), rgbOf(b)) };
  if (typeof module !== 'undefined') module.exports = root.TintaDark;
})(typeof window !== 'undefined' ? window : globalThis);
