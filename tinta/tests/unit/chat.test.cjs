const test = require('node:test'), assert = require('node:assert/strict');
const W = '../../web/js/', C = require(W + 'tinta-chat.js'), R = require(W + 'tinta-receta.js'), T = require(W + 'tinta-templates.js'), Sec = require(W + 'tinta-sectors.js'), P = require(W + 'tinta-palettes.js'), F = require(W + 'tinta-fonts.js'), B = require(W + 'tinta-backgrounds.js');
const mem = () => { const s = {}; return { getItem: k => s[k] ?? null, setItem: (k, v) => { s[k] = String(v); }, s }; };
test('guarda el historial en el dispositivo y lo recupera', () => {
  const st = mem(), c = C.create({ storage: st }); c.add('user', 'Una cafetería'); c.add('assistant', 'Claro'); const c2 = C.create({ storage: st });
  assert.deepEqual(c2.all().map(m => m.role + ':' + m.content), ['user:Una cafetería', 'assistant:Claro']); assert.ok(!/sk-|token/i.test(st.s[C.KEY]));
  c2.clear(); assert.equal(C.create({ storage: st }).all().length, 0);
});
test('ignora lo vacío, los roles raros y recorta lo largo y lo antiguo', () => {
  const c = C.create({ storage: mem() }); assert.equal(c.add('system', 'x'), false); assert.equal(c.add('user', '   '), false); c.add('user', 'x'.repeat(9000)); assert.equal(c.all()[0].content.length, C.MAX_LEN);
  for (let i = 0; i < 80; i++) c.add(i % 2 ? 'assistant' : 'user', 'm' + i); assert.equal(c.all().length, C.MAX_MSGS);
});
test('forModel: sistema + turnos alternados, empieza por el usuario y respeta el presupuesto', () => {
  const c = C.create({ storage: mem() }); c.add('assistant', 'hola'); c.add('user', 'a'); c.add('user', 'b'); c.add('assistant', 'r1'); c.add('user', 'c');
  const m = c.forModel('SISTEMA'); assert.equal(m[0].role, 'system'); assert.equal(m[0].content, 'SISTEMA'); assert.deepEqual(m.slice(1).map(x => x.role), ['user', 'assistant', 'user']); assert.match(m[1].content, /a\n\nb/);
  const g = C.create({ storage: mem() }); for (let i = 0; i < 30; i++) { g.add('user', 'u' + i + 'x'.repeat(900)); g.add('assistant', 'a' + i + 'x'.repeat(900)); }
  const big = g.forModel('s', { budget: 5000 }); assert.ok(big.slice(1).reduce((n, x) => n + x.content.length, 0) <= 7000); assert.equal(big[1].role, 'user');
});
test('el último mensaje del usuario sirve para elegir el catálogo', () => { const c = C.create({ storage: mem() }); c.add('user', 'una cafetería'); c.add('assistant', 'ok'); c.add('user', 'ahora oscura'); assert.match(c.lastIdea(), /cafetería.*oscura/); });
test('el prompt de sistema del chat trae catálogo, formato y la pantalla actual', () => {
  const ids = new Set(); T.LIST.forEach(t => t.blocks.forEach(b => ids.add(b.id)));
  const r = R.create({ blocks: [...ids].map(id => ({ id, role: ({ h: 'header', c: 'cards', a: 'actions', n: 'nav' })[id[0]] || 'cards', name: id })), palettes: P.LIST, fonts: F.LIST, backgrounds: B.LIST, templates: T.LIST, sectorOf: Sec.detect });
  const s = r.chatSystem('una cafetería con pedidos', 'h-search, c-coffee×2, n-soft; paleta mandarina');
  assert.match(s, /asistente de diseño/); assert.match(s, /h-search/); assert.match(s, /"bloques"/); assert.match(s, /PANTALLA ACTUAL.*mandarina/); assert.ok(s.length < 9000, 'longitud ' + s.length); assert.ok(!/PANTALLA ACTUAL/.test(r.chatSystem('x', '')));
});
