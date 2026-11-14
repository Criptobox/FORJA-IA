const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../../web/js/tinta-palettes.js'), C = require('../../web/js/tinta-contrast.js');
test('TintaContrast.ratio sigue la fórmula WCAG', () => {
  assert.equal(Math.round(C.ratio('#000000', '#ffffff')), 21); assert.equal(C.ratio('#777777', '#777777'), 1);
});
test('hay 90 paletas con id único, todas válidas', () => {
  assert.equal(P.LIST.length, 90); assert.equal(new Set(P.LIST.map(p => p.id)).size, 90); assert.ok(P.LIST.every(P.valid));
});
test('get y normalize devuelven la paleta o null', () => {
  assert.equal(P.get('tinta').id, 'tinta'); assert.equal(P.get('no-existe'), null); assert.equal(P.normalize('tinta'), 'tinta'); assert.equal(P.normalize('zz'), null); assert.equal(P.normalize(5), null);
});
test('hay 24 paletas oscuras y su fondo es casi negro', () => {
  const oscuras = P.LIST.filter(p => p.dark); assert.equal(oscuras.length, 24);
  assert.ok(oscuras.every(p => C.ratio(p.bg, '#000000') < 3), 'fondo oscuro');
});
test('el texto sobre el acento de cada paleta cumple 4.5:1', () => {
  for (const p of P.LIST) assert.ok(P.contrast(p.accent, P.onAccent(p.accent)) >= 4.5, p.id);
});

const NUEVAS = P.LIST.filter(p => /^(pro-|regla-)/.test(p.id) || p.id === 'marple');
test('tercera tanda: las 20 profesionales, las 3 de la regla 60-30-10 y Marple', () => {
  assert.equal(NUEVAS.length, 24); assert.equal(NUEVAS.filter(p => p.id.startsWith('pro-')).length, 20); assert.equal(NUEVAS.filter(p => p.id.startsWith('regla-')).length, 3);
});
test('tercera tanda: el texto se lee sobre el fondo (7:1) y sobre la tarjeta (4.5:1)', () => {
  for (const p of NUEVAS) { assert.ok(C.ratio(p.ink, p.bg) >= 7, p.id + ' texto/fondo'); assert.ok(C.ratio(p.ink, p.surface) >= 4.5, p.id + ' texto/tarjeta'); }
});
test('regla 60-30-10: el secundario fijado es un color válido y las claras no son oscuras por error', () => {
  for (const p of P.LIST.filter(x => x.sec)) assert.match(p.sec, /^#[0-9a-f]{6}$/i, p.id);
  assert.deepEqual(P.LIST.filter(p => p.sec).map(p => p.id), ['regla-tormenta', 'regla-desierto', 'regla-polar']);
  for (const p of NUEVAS.filter(x => !x.dark)) assert.ok(C.ratio(p.bg, '#000000') > 3, p.id + ' fondo claro');
});
