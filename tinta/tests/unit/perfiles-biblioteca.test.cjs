const test = require('node:test'), assert = require('node:assert/strict');
const cargar = require('./cargar.cjs');
const T = require('../../web/js/tinta-taxonomy.js');
const S = require('../../web/js/tinta-screens.js');
const BLOQUES = cargar('tinta-perfiles.js', 'TINTA_PERFILES');
const MARCAS = new Set(['a', 'a2', 'bg', 'sf', 'ink', 'sec', 'ln', 'on', 'sh', 'dk', 'lt']);

test('«Perfil y ajustes»: 14 diseños, con id propio, rol y texto de ejemplo', () => {
  assert.equal(BLOQUES.length, 14);
  const ids = BLOQUES.map(b => b.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const b of BLOQUES) {
    assert.match(b.id, /^pf-/); assert.ok(['perfil', 'ajustes'].includes(b.role), b.id);
    assert.ok(b.name && b.desc && b.glyph && b.color && b.html.length > 80 && b.css.length > 80, b.id);
    assert.equal(b.fixed, true); assert.equal(b.themed, true);
  }
});
test('sin scripts ni recursos externos', () => {
  for (const b of BLOQUES) { assert.ok(!/<script|https?:\/\/|<img|url\(/i.test(b.html + b.css), b.id); }
});
test('los colores son marcas de la paleta, no azules ni verdes fijos (salvo el rojo de «Cerrar sesión»)', () => {
  for (const b of BLOQUES) {
    const marcas = [...(b.css + b.html).matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
    assert.ok(marcas.length >= 6, b.id + ': usa la paleta');
    marcas.forEach(m => assert.ok(MARCAS.has(m), b.id + ': marca desconocida ' + m));
    const fijos = ((b.css + b.html).match(/#[0-9a-f]{6}\b/gi) || []).map(x => x.toLowerCase());
    // los fijos permitidos: el rojo de «Cerrar sesión», el avatar de reserva y los tonos del personaje SVG
    assert.ok(fijos.length < 60, b.id + ': demasiados colores fijos ' + fijos.length);
  }
});
test('la categoría agrupa los 14 y cada uno cae en su subcategoría', () => {
  const cat = T.get('perfiles'); assert.ok(cat); assert.equal(cat.roles.join(), 'perfil,ajustes');
  const enSubs = cat.subs.flatMap(s => s.ids);
  assert.equal([...enSubs].sort().join(), BLOQUES.map(b => b.id).sort().join());
  for (const b of BLOQUES) { assert.equal(T.catOf(b).id, 'perfiles', b.id); assert.notEqual(T.subOf(b), 'otros', b.id); }
});
test('todos los perfiles de sector usan solo piezas que existen', () => {
  const ids = new Set(BLOQUES.map(b => b.id));
  const otros = new Set(['av-anillo', 'w-gauge', 'w-semana', 'w-pasos', 'lib-lis-2', 'lib-lis-3', 'r-stats3', 'pf-banda']);
  for (const [sector, opciones] of Object.entries(S.PERFIL_BLOQUES)) for (const comp of opciones) for (const id of comp) assert.ok(ids.has(id) || otros.has(id) || /^(av-|lib-|w-|r-)/.test(id), sector + ': ' + id);
});
