/* Paleta a partir de una imagen: saca los colores dominantes de una foto o un logo y arma una paleta completa de Tinta
   (fondo, tarjetas, acento, segundo acento, texto y línea) que cumple los contrastes de la app.
   Lógica pura sobre los píxeles (RGBA): la imagen se reduce y se lee en el navegador; aquí no hay DOM, red ni recursos externos.
   Pasos: 1) agrupa los colores parecidos y mide cuánto ocupa cada uno; 2) elige como acento el color más vivo y
   frecuente (un logo sobre fondo blanco da su color de marca, no el blanco); 3) elige un segundo acento de otro tono;
   4) decide claro u oscuro (o lo que se pida) y deriva fondo, tarjetas, texto y línea con el tono del acento;
   5) ajusta la luminosidad de los acentos hasta que se distingan del fondo. */
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const toHex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; let h = 0, s = 0;
    if (d) { s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return [h, s, l];
  }
  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360; const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2; let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }
  const hsl = (h, s, l) => toHex(...hslToRgb(h, clamp(s, 0, 1), clamp(l, 0, 1)));
  const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4); return r * .2126 + g * .7152 + b * .0722; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

  /* Agrupa los píxeles opacos por color parecido y devuelve los grupos de mayor a menor. */
  function clusters(data) {
    const bins = new Map(); let total = 0;
    for (let i = 0; i + 3 < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2], k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3), e = bins.get(k);
      if (e) { e.n++; e.r += r; e.g += g; e.b += b; } else bins.set(k, { n: 1, r, g, b });
      total++;
    }
    const list = [...bins.values()].map(e => ({ n: e.n, rgb: [e.r / e.n, e.g / e.n, e.b / e.n] })).sort((a, b) => b.n - a.n), out = [];
    const near = (c, e) => Math.hypot(c.rgb[0] - e.rgb[0], c.rgb[1] - e.rgb[1], c.rgb[2] - e.rgb[2]);
    for (const e of list) {
      let hit = null, bd = 1e9; for (const c of out) { const d = near(c, e); if (d < bd) { bd = d; hit = c; } }
      if (hit && (bd < 44 || out.length >= 24)) { const t = hit.n + e.n; hit.rgb = hit.rgb.map((v, i) => (v * hit.n + e.rgb[i] * e.n) / t); hit.n = t; } else out.push({ n: e.n, rgb: [...e.rgb] });
    }
    return { total, list: out.sort((a, b) => b.n - a.n).map(c => ({ hex: toHex(...c.rgb), share: c.n / total, hsl: rgbToHsl(...c.rgb) })) };
  }

  /* Ajusta la luminosidad de un color hasta que se distinga del fondo (por encima del contraste mínimo). */
  function separate(h, s, l, bg, dark, min) {
    let out = hsl(h, s, l), i = 0;
    while (contrast(out, bg) < min && i++ < 24) { l = clamp(l + (dark ? .035 : -.035), .04, .96); out = hsl(h, s, l); }
    return out;
  }

  function paletteFrom(data, opts) {
    const mode = opts && ['claro', 'oscuro', 'auto'].includes(opts.mode) ? opts.mode : 'auto';
    const { total, list } = clusters(data);
    if (!total || !list.length) throw new Error('La imagen está vacía o es transparente.');
    const avgL = list.reduce((a, c) => a + c.share * c.hsl[2], 0);
    const dark = mode === 'oscuro' ? true : mode === 'claro' ? false : avgL < .4;
    const vivid = list.filter(c => c.hsl[1] > .22 && c.hsl[2] > .12 && c.hsl[2] < .92 && c.share >= .004)
      .map(c => ({ ...c, score: c.hsl[1] * (1 - Math.abs(c.hsl[2] - .5) * 1.4) * (.35 + Math.sqrt(c.share)) })).sort((a, b) => b.score - a.score);
    let h, s, l, source;
    if (vivid.length) { [h, s, l] = vivid[0].hsl; source = vivid[0].hex; s = clamp(s, .35, .92); }
    else { const pick = list.find(c => c.hsl[2] < .7 && c.hsl[2] > .08) || list[0]; h = pick.hsl[0] || 220; s = .08; l = pick.hsl[2]; source = pick.hex; }
    const second = vivid.find(c => hueGap(c.hsl[0], h) >= 35);
    let h2, s2, l2; if (second) { [h2, s2, l2] = second.hsl; s2 = clamp(s2, .3, .9); } else { h2 = h + 32; s2 = clamp(s * .9, vivid.length ? .3 : .06, .9); l2 = l; }
    const bg = dark ? hsl(h, .25, .07) : hsl(h, .3, .965), surface = dark ? hsl(h, .22, .12) : '#ffffff';
    const ink = dark ? hsl(h, .18, .94) : hsl(h, .22, .12), line = dark ? hsl(h, .2, .2) : hsl(h, .2, .88);
    const accent = separate(h, s, vivid.length ? l : (dark ? .7 : .35), bg, dark, 3.2), accent2 = separate(h2, s2, l2, bg, dark, 2.2);
    return { dark, swatches: list.slice(0, 8).map(c => ({ hex: c.hex, share: Math.round(c.share * 1000) / 1000 })), source, palette: { bg, surface, accent, accent2: accent2 === accent ? separate(h + 30, s2, l2, bg, dark, 2.2) : accent2, ink, line, dark } };
  }

  root.TintaColores = { paletteFrom, clusters, contrast, rgbToHsl, hslToRgb, toHex };
  if (typeof module !== 'undefined') module.exports = root.TintaColores;
})(typeof window !== 'undefined' ? window : globalThis);
