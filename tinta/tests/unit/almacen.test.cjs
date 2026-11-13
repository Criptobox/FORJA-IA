/* Almacén de fotos: las fotos grandes pasan a un almacén aparte y el texto guardado lleva solo referencias. */
const test = require('node:test'), assert = require('node:assert/strict');
const S = require('../../web/js/tinta-store.js');
const memoria = (opts = {}) => { const db = new Map(); return { db, open: () => opts.noOpen ? Promise.reject(new Error('sin IDB')) : Promise.resolve(), put: (id, d) => opts.failPut ? Promise.reject(new Error('lleno')) : (db.set(id, d), Promise.resolve()), getMany: ids => Promise.resolve(Object.fromEntries(ids.filter(i => db.has(i)).map(i => [i, db.get(i)]))), keys: () => Promise.resolve([...db.keys()]), del: id => (db.delete(id), Promise.resolve()) }; };
const foto = n => 'data:image/jpeg;base64,' + 'A'.repeat(n);
const borrador = (...srcs) => JSON.stringify({ brief: 'x', assets: { 'c-coffee': { images: srcs.map(s => s === null ? null : { src: s, alt: 'foto' }), links: [] } } });
const listo = (s, read) => new Promise(r => s.boot(r, read || (() => null)));

test('hash: igual para la misma foto, distinto si cambia, y trae la longitud', () => {
  assert.equal(S.hash(foto(100)), S.hash(foto(100))); assert.notEqual(S.hash(foto(100)), S.hash(foto(101)));
  assert.match(S.hash('abc'), /^[a-z0-9]+-[a-z0-9]+$/);
});
test('las fotos grandes pasan al almacén y el texto lleva solo la referencia', async () => {
  const ad = memoria(), s = S.create(ad); await listo(s);
  assert.equal(s.available, true);
  const out = s.packText(borrador(foto(40000)));
  assert.ok(!out.includes('data:image'), 'sin la foto dentro'); assert.match(out, /"src":"idb:[a-z0-9-]+"/);
  assert.equal(out.length < 400, true); assert.equal(ad.db.size, 1);
});
test('las fotos pequeñas se quedan dentro del texto', async () => {
  const ad = memoria(), s = S.create(ad); await listo(s);
  const t = borrador(foto(500)); assert.equal(s.packText(t), t); assert.equal(ad.db.size, 0);
});
test('ida y vuelta: leer devuelve la misma foto completa', async () => {
  const ad = memoria(), s = S.create(ad); await listo(s);
  const original = borrador(foto(40000), foto(41000)), guardado = s.packText(original);
  assert.deepEqual(JSON.parse(s.unpackText(guardado)), JSON.parse(original));
});
test('una foto repetida se guarda una sola vez', async () => {
  const ad = memoria(), s = S.create(ad); await listo(s);
  s.packText(borrador(foto(40000), foto(40000))); s.packText(borrador(foto(40000))); assert.equal(ad.db.size, 1);
});
test('al arrancar con referencias se cargan sus fotos antes de empezar', async () => {
  const ad = memoria(), a = S.create(ad); await listo(a);
  const guardado = a.packText(borrador(foto(40000)));
  const b = S.create(ad); let leyo = null; await listo(b, k => k === S.KEYS[0] ? guardado : null);
  assert.equal(JSON.parse(b.unpackText(guardado)).assets['c-coffee'].images[0].src, foto(40000));
});
test('una referencia sin foto se descarta (la entrada queda en null) en vez de romper el borrador', async () => {
  const s = S.create(memoria()); await listo(s);
  const out = JSON.parse(s.unpackText(borrador('idb:no-existe-1')));
  assert.deepEqual(out.assets['c-coffee'].images, [null]);
});
test('sin almacén (IndexedDB no disponible) todo sigue guardándose dentro del texto', async () => {
  const s = S.create(memoria({ noOpen: true })); await listo(s); await new Promise(r => setTimeout(r, 5));
  const t = borrador(foto(40000)); assert.equal(s.available, false); assert.equal(s.packText(t), t);
});
test('si el almacén falla al escribir, se deja de externalizar y se avisa', async () => {
  const s = S.create(memoria({ failPut: true })); await listo(s); let avisos = 0; s.onChange = () => avisos++;
  s.packText(borrador(foto(40000))); await new Promise(r => setTimeout(r, 10));
  assert.equal(avisos, 1); const t = borrador(foto(40001)); assert.equal(s.packText(t), t, 'ya no externaliza');
});
test('sin referencias guardadas la app arranca de inmediato, sin esperar al almacén', () => {
  const s = S.create(memoria()); let arrancó = false; s.boot(() => { arrancó = true; }, () => borrador(foto(100))); assert.equal(arrancó, true);
});
test('la limpieza borra las fotos que ya no usa ningún borrador', async () => {
  const ad = memoria(), s = S.create(ad); await listo(s);
  const usado = s.packText(borrador(foto(40000))); s.packText(borrador(foto(50000))); assert.equal(ad.db.size, 2);
  const n = await s.gc(k => k === S.KEYS[0] ? usado : null); assert.equal(n, 1); assert.equal(ad.db.size, 1);
});
test('lo que no es JSON o no trae fotos pasa sin cambios', async () => {
  const s = S.create(memoria()); await listo(s);
  for (const t of ['no json "src":"data:image/', '[]', '', 'idb:suelto']) assert.equal(s.unpackText(t), t), assert.equal(s.packText(t), t);
});
