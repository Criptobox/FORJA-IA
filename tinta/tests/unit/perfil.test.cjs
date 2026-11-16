const test = require('node:test'), assert = require('node:assert/strict');
const S = require('../../web/js/tinta-screens.js');
const ctx = (sectorId, semilla = 0) => ({ headerId: 'h-search', plainHeaderId: 'h-minimal', cardId: 'c-coral', actionId: 'a-coral', hasList: true, avatarId: 'av-perfil', sectorId, semilla });

test('el perfil no es igual en todas las apps: cada sector arma el suyo', () => {
  const firmas = new Set(Object.keys(S.PERFIL_BLOQUES).map(id => S.plan(ctx(id)).perfil.map(b => b.id).join('+')));
  assert.ok(firmas.size >= 6, 'composiciones distintas: ' + firmas.size);
  // y la idea elige entre las dos de cada sector
  for (const id of Object.keys(S.PERFIL_BLOQUES)) assert.notEqual(S.plan(ctx(id, 0)).perfil.map(b => b.id).join(), S.plan(ctx(id, 1)).perfil.map(b => b.id).join(), id);
});
test('cada perfil lleva cabecera, una persona, algo propio del sector y la acción', () => {
  for (const id of Object.keys(S.PERFIL_BLOQUES)) for (const semilla of [0, 1]) {
    const p = S.plan(ctx(id, semilla)).perfil, ids = p.map(b => b.id);
    assert.equal(p[0].role, 'header', id);
    assert.ok(p.some(b => b.role === 'avatars' || b.role === 'perfil'), id + ': persona');
    assert.ok(p.length >= 4, id + ': piezas');
    assert.equal(p[p.length - 1].id, 'a-coral', id + ': acción al final');
    assert.equal(new Set(ids).size, ids.length, id + ': sin repetidos');
  }
});
test('sin sector conocido sigue el perfil de siempre (persona + lista + acción)', () => {
  const ids = S.plan(ctx(undefined)).perfil.map(b => b.id);
  assert.deepEqual(ids, ['h-minimal', 'av-perfil', 'lib-lis-1', 'a-coral']);
});
