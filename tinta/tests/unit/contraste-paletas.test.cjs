const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../../web/js/tinta-palettes.js'), C = require('../../web/js/tinta-contrast.js');
test('TintaContrast.ratio sigue la fórmula WCAG', () => {
  assert.equal(Math.round(C.ratio('#000000', '#ffffff')), 21); assert.equal(C.ratio('#777777', '#777777'), 1);
});
test('hay 66 paletas con id único, todas válidas', () => {
  assert.equal(P.LIST.length, 66); assert.equal(new Set(P.LIST.map(p => p.id)).size, 66); assert.ok(P.LIST.every(P.valid));
});
test('get y normalize devuelven la paleta o null', () => {
  assert.equal(P.get('tinta').id, 'tinta'); assert.equal(P.get('no-existe'), null); assert.equal(P.normalize('tinta'), 'tinta'); assert.equal(P.normalize('zz'), null); assert.equal(P.normalize(5), null);
});
test('hay 19 paletas oscuras y su fondo es casi negro', () => {
  const oscuras = P.LIST.filter(p => p.dark); assert.equal(oscuras.length, 19);
  assert.ok(oscuras.every(p => C.ratio(p.bg, '#000000') < 3), 'fondo oscuro');
});
test('el texto sobre el acento de cada paleta cumple 4.5:1', () => {
  for (const p of P.LIST) assert.ok(P.contrast(p.accent, P.onAccent(p.accent)) >= 4.5, p.id);
});
