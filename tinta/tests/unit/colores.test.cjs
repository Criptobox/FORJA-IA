const test = require('node:test'), assert = require('node:assert/strict');
const C = require('../../web/js/tinta-colores.js');
const img = (w, h, fn) => { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b, a] = fn(x, y); const i = (y * w + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a == null ? 255 : a; } return d; };
const logo = img(60, 60, (x, y) => ((x - 30) ** 2 + (y - 30) ** 2 < 300) ? [226, 40, 60] : [255, 255, 255]);
test('un logo sobre blanco da su color de marca, no el blanco', () => {
  const r = C.paletteFrom(logo); const [h] = C.rgbToHsl(...[1, 3, 5].map(i => parseInt(r.palette.accent.slice(i, i + 2), 16)));
  assert.equal(r.dark, false); assert.ok(h < 12 || h > 348, 'tono rojo ' + h);
});
test('cumple contrastes en claro y oscuro', () => {
  for (const mode of ['auto', 'claro', 'oscuro']) { const { palette: p } = C.paletteFrom(logo, { mode });
    assert.ok(C.contrast(p.ink, p.bg) >= 7); assert.ok(C.contrast(p.accent, p.bg) >= 3); assert.ok(C.contrast(p.ink, p.surface) >= 7); assert.equal(p.dark, mode === 'oscuro'); }
});
test('imagen transparente o gris no rompe', () => {
  assert.throws(() => C.paletteFrom(img(8, 8, () => [0, 0, 0, 0])));
  const g = C.paletteFrom(img(40, 40, (x) => { const v = x * 6; return [v, v, v]; })); assert.match(g.palette.accent, /^#[0-9a-f]{6}$/);
});
test('registro de paletas propias', () => {
  const store = {}; global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  delete require.cache[require.resolve('../../web/js/tinta-palettes.js')]; const P = require('../../web/js/tinta-palettes.js'); const n = P.LIST.length;
  const { palette: p } = C.paletteFrom(logo);
  assert.ok(P.addMine({ id: 'mia-abc123', name: '<b>Marca</b>', ...p })); assert.equal(P.LIST.length, n + 1); assert.equal(P.get('mia-abc123').name, 'bMarca/b');
  assert.equal(P.addMine({ id: 'otra', ...p }), null); assert.equal(P.addMine({ id: 'mia-zzz999', ...p, accent: 'rojo' }), null);
  P.LIST.splice(n, 1); assert.equal(P.loadMine(), 1); assert.ok(P.get('mia-abc123').mine);
  assert.ok(P.removeMine('mia-abc123')); assert.equal(P.removeMine('malva'), false); assert.equal(P.LIST.length, n);
});
