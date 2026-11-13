const test = require('node:test'), assert = require('node:assert/strict'), cargar = require('./cargar.cjs');
const H = cargar('tinta-history.js', 'TintaHistory'), plano = x => JSON.parse(JSON.stringify(x)); /* los objetos de vm vienen de otro contexto: se comparan como JSON */
test('deshacer y rehacer devuelven los borradores y las etiquetas', () => {
  const h = H.create(); h.reset({ a: 1 }); h.record({ a: 2 }, { label: 'dos' });
  assert.deepEqual(plano(h.status()), { canUndo: true, canRedo: false, undoLabel: 'dos', redoLabel: '', undoCount: 1, redoCount: 0, trimmed: false });
  assert.deepEqual(plano(h.undo()), { draft: { a: 1 }, label: 'dos' }); assert.equal(h.status().canRedo, true); assert.deepEqual(plano(h.redo()), { draft: { a: 2 }, label: 'dos' });
  assert.equal(h.redo(), null);
});
test('el límite de pasos recorta lo más antiguo', () => {
  const h = H.create({ limit: 3 }); h.reset({ a: 0 }); for (let i = 1; i <= 8; i++) h.record({ a: i }, { label: 'n' + i });
  const s = h.status(); assert.equal(s.undoCount, 3); assert.equal(s.trimmed, true); assert.equal(s.undoLabel, 'n8');
  let ultimo; for (let i = 0; i < 3; i++) ultimo = h.undo(); assert.deepEqual(plano(ultimo.draft), { a: 5 }); assert.equal(h.undo(), null);
});
test('un presupuesto de bytes pequeño también recorta', () => {
  const h = H.create({ maxBytes: 2000 }); h.reset({ foto: 'x' }); for (let i = 1; i <= 10; i++) h.record({ foto: 'x'.repeat(400 * i) }, { label: 'f' + i });
  assert.equal(h.status().trimmed, true); assert.ok(h.status().undoCount < 10);
});
test('registrar sin cambios no crea pasos y al registrar se pierde lo rehecho', () => {
  const h = H.create(); h.reset({ a: 1 }); h.record({ a: 1 }, { label: 'igual' }); assert.equal(h.status().undoCount, 0);
  h.record({ a: 2 }, { label: 'dos' }); h.undo(); h.record({ a: 3 }, { label: 'tres' }); assert.equal(h.status().canRedo, false);
});
