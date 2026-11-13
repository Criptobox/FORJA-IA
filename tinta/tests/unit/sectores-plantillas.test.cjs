const test = require('node:test'), assert = require('node:assert/strict');
const S = require('../../web/js/tinta-sectors.js'), T = require('../../web/js/tinta-templates.js');
test('cada sector se reconoce por su palabra principal, y todas sus palabras activan algún sector', () => {
  assert.equal(S.SECTORS.length, 8);
  for (const s of S.SECTORS) { assert.equal(S.detect('Una app de ' + s.words[0]).id, s.id, s.id); for (const w of s.words) assert.ok(S.detect('Una app de ' + w), s.id + ' · ' + w); }
  assert.equal(S.detect('Mi cafetería').id, 'comida'); assert.equal(S.detect('MI CAFETERÍA').id, 'comida');
});
test('sin palabras del sector no se detecta nada', () => { assert.equal(S.detect('zzz'), null); assert.equal(S.detect(''), null); });
test('hay 48 plantillas con id único y su idea activa su sector', () => {
  assert.equal(T.LIST.length, 48); assert.equal(new Set(T.LIST.map(t => t.id)).size, 48);
  for (const t of T.LIST) assert.equal((S.detect(t.brief) || {}).id, t.sector, t.id);
});
test('problems exige un encabezado, una barra, tarjetas y copias entre 2 y 6', () => {
  const cat = { h1: { role: 'header' }, h2: { role: 'header' }, n1: { role: 'nav' }, c1: { role: 'cards' }, a1: { role: 'actions' } };
  const ok = t => T.problems({ blocks: t }, cat);
  assert.deepEqual(ok([{ id: 'h1' }, { id: 'c1' }, { id: 'n1' }]), []);
  assert.ok(ok([{ id: 'c1' }, { id: 'n1' }]).some(m => /encabezado/.test(m)), 'sin encabezado');
  assert.ok(ok([{ id: 'h1' }, { id: 'h2' }, { id: 'c1' }, { id: 'n1' }]).some(m => /encabezado/.test(m)), 'dos encabezados');
  assert.ok(ok([{ id: 'h1' }, { id: 'c1' }]).some(m => /barra/.test(m)), 'sin barra');
  assert.ok(ok([{ id: 'h1' }, { id: 'n1' }]).some(m => /tarjetas/.test(m)), 'sin tarjetas');
  assert.ok(ok([{ id: 'h1' }, { id: 'c1', repeat: 9 }, { id: 'n1' }]).length >= 1, 'demasiadas copias');
  assert.ok(ok([{ id: 'h1' }, { id: 'a1', repeat: 2 }, { id: 'c1' }, { id: 'n1' }]).length >= 1, 'copias solo en tarjetas');
  assert.ok(ok([{ id: 'h1' }, { id: 'nada' }, { id: 'c1' }, { id: 'n1' }]).some(m => /desconocido/.test(m)), 'bloque que no existe');
  assert.ok(ok([{ id: 'h1' }, { id: 'c1' }, { id: 'c1' }, { id: 'n1' }]).some(m => /repetidos/.test(m)), 'bloques repetidos');
});
