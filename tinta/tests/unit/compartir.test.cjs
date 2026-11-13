const test = require('node:test'), assert = require('node:assert/strict');
const Sh = require('../../web/js/tinta-share.js'), B = require('../../web/js/tinta-backup.js');
test('un enlace compartido se decodifica a lo mismo que se codificó', async () => {
  const draft = { brief: 'Una cafetería', selected: ['h-minimal', 'c-coffee'], palette: 'tinta' };
  const { code, compressed } = await Sh.encode(draft); assert.match(code, /^t[01]=/); assert.equal(compressed, true);
  const vuelta = await Sh.decode('#' + code); assert.equal(vuelta.brief, draft.brief); assert.deepEqual(vuelta.selected, draft.selected);
});
test('enlaces corruptos o ajenos no devuelven pantallas', async () => {
  for (const mal of ['#t1=@@@', '#nada', '#t0=', '']) assert.equal(await Sh.decode(mal), null, mal);
  assert.equal(Sh.isShareHash('#t1=abc'), true); assert.equal(Sh.isShareHash('#bloques'), false);
});
test('una copia de seguridad que no es JSON se rechaza con un mensaje claro', () => {
  assert.throws(() => B.inspect('no json'), /JSON/); assert.ok(B.MAX_BYTES >= 8 * 1024 * 1024 || B.MAX_BYTES > 0);
});
