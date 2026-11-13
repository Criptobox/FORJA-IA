/* Guardián de contraste de las pantallas: pinta cada bloque fuera de la vista, mide cada texto contra el
   fondo real que tiene detrás (incluidos degradados y opacidad) y, si no llega a WCAG AA (4,5:1; 3:1 en texto
   grande), le da el tono más parecido que sí se lee. Si es texto claro sobre un botón de color, oscurece el
   botón en vez del texto. Las correcciones se guardan en el propio bloque (atributo data-tc + una regla CSS),
   así que viajan también a la exportación. No toca ilustraciones (SVG) ni la biblioteca. */
(function (root) {
  'use strict';
  const cache = new Map();
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const parse = s => { const m = String(s).match(/[\d.]+/g); return m ? { c: m.slice(0, 3).map(Number), a: m.length > 3 ? +m[3] : 1 } : null; };
  const lum = c => { const [r, g, b] = c.map(v => v / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4); return r * .2126 + g * .7152 + b * .0722; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const hex = c => '#' + c.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const mix = (fg, bg, a) => fg.map((v, i) => v * a + bg[i] * (1 - a));
  function hsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6; } return [h, s, l]; }
  function rgb([h, s, l]) { if (!s) return [l * 255, l * 255, l * 255]; const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]; }
  const passes = (fg, bgs, alpha, need) => bgs.every(b => ratio(mix(fg, b, alpha), b) >= need);
  /* El tono más cercano (misma matiz) que se lea sobre todos los fondos. */
  function nearest(fg, bgs, alpha, need) {
    const [h, s, l] = hsl(fg);
    for (let d = .02; d <= 1; d += .02) for (const L of [l - d, l + d]) { if (L < 0 || L > 1) continue; const c = rgb([h, s, L]); if (passes(c, bgs, alpha, need)) return c; }
    return null;
  }
  const stops = img => (img.match(/rgba?\([^)]*\)/g) || []).map(parse).filter(x => x && x.a > .5).map(x => x.c);
  function backgrounds(el, screen) {
    for (let x = el; x && x.nodeType === 1; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') { const st = stops(cs.backgroundImage); if (st.length) return { list: st, own: x === el }; }
      const b = parse(cs.backgroundColor); if (b && b.a > .5) return { list: [b.c], own: x === el };
    }
    return { list: [screen], own: false };
  }
  function opacity(el) { let o = 1; for (let x = el; x && x.nodeType === 1; x = x.parentElement) o *= +getComputedStyle(x).opacity; return o; }
  /* block: bloque final (con estilos ya aplicados); base: CSS base; screen: color de fondo de la pantalla (#rrggbb). */
  function guard(block, base, screen) {
    if (typeof document === 'undefined' || !block || !block.html) return block;
    const key = screen + '\u0000' + base + '\u0000' + (block.base || '') + block.css + '\u0000' + block.html;
    if (cache.has(key)) return cache.get(key);
    const bgScreen = hexToRgb(/^#[0-9a-f]{6}$/i.test(screen) ? screen : '#ffffff');
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-10000px;top:0;width:360px;visibility:hidden;pointer-events:none';
    const sr = host.attachShadow({ mode: 'open' }); sr.innerHTML = '<style>' + base + (block.base || '') + block.css + '*,*::before,*::after{animation:none!important;transition:none!important}</style>' + block.html; document.body.appendChild(host);
    const tpl = document.createElement('template'); tpl.innerHTML = block.html;
    const live = [...sr.querySelectorAll('*')].slice(1), src = [...tpl.content.querySelectorAll('*')], rules = [], marked = new Set();
    /* En las barras, los botones cambian de «activo» al navegar: se mide cada texto en los dos estados. */
    const nav = block.role === 'nav', toggles = nav ? [...sr.querySelectorAll('button,a')] : [], passesList = nav ? ['off', 'on'] : ['as-is'];
    if (live.length === src.length) for (const pass of passesList) {
      if (pass !== 'as-is') toggles.forEach(b => b.classList.toggle('on', pass === 'on'));
      live.forEach((el, i) => {
        if (el.closest('svg,style,script,template') || !el.getClientRects().length) return;
        if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
        const cs = getComputedStyle(el), fg = parse(cs.color); if (!fg) return;
        const size = parseFloat(cs.fontSize), need = ((size >= 18.66 || (size >= 14 && +cs.fontWeight >= 700)) ? 3 : 4.5) + .05;
        const bg = backgrounds(el, bgScreen), alpha = fg.a * opacity(el);
        if (passes(fg.c, bg.list, alpha, need)) return;
        let rule = '';
        if (bg.own && lum(fg.c) > .6 && bg.list.length) {
          /* Texto claro sobre un botón o etiqueta de color: se oscurece el fondo. */
          const dark = bg.list.map(b => { const [h, s, l] = hsl(b); for (let L = l; L >= 0; L -= .02) { const c = rgb([h, s, L]); if (ratio(mix(fg.c, c, alpha), c) >= need) return c; } return [0, 0, 0]; });
          rule = 'background:' + (dark.length > 1 ? 'linear-gradient(135deg,' + dark.map(hex).join(',') + ')' : hex(dark[0])) + '!important';
        } else {
          let c = nearest(fg.c, bg.list, alpha, need), extra = '';
          if (!c && alpha < 1) { c = nearest(fg.c, bg.list, 1, need); extra = ';opacity:1!important'; }
          if (!c) return;
          rule = 'color:' + hex(c) + '!important' + extra;
        }
        const t = '[data-tc="' + i + '"]', inBtn = nav && el.closest('button,a');
        const sel = !inBtn ? t : pass === 'on' ? ':is(button,a).on ' + t + ',:is(button,a).on' + t : ':is(button,a):not(.on) ' + t + ',:is(button,a):not(.on)' + t;
        if (!inBtn && marked.has(i)) return;
        marked.add(i); src[i].setAttribute('data-tc', i); rules.push(sel + '{' + rule + '}');
      });
    }
    host.remove();
    const out = rules.length ? { ...block, html: tpl.innerHTML, css: block.css + rules.join('') } : block;
    if (cache.size > 400) cache.clear(); cache.set(key, out); return out;
  }
  root.TintaContrast = { guard, ratio: (a, b) => ratio(hexToRgb(a), hexToRgb(b)) };
  if (typeof module !== 'undefined') module.exports = root.TintaContrast;
})(typeof window !== 'undefined' ? window : globalThis);
