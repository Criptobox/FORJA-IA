const test = require('node:test'), assert = require('node:assert/strict');
const W = '../../web/js/', R = require(W + 'tinta-receta.js'), T = require(W + 'tinta-templates.js'), Sec = require(W + 'tinta-sectors.js'), P = require(W + 'tinta-palettes.js'), F = require(W + 'tinta-fonts.js'), B = require(W + 'tinta-backgrounds.js');
const ids = new Set(); T.LIST.forEach(t => t.blocks.forEach(b => ids.add(b.id)));
const role = id => ({ h: 'header', c: 'cards', a: 'actions', n: 'nav' })[id[0]] || 'cards';
const blocks = [...ids].map(id => ({ id, role: role(id), name: 'Bloque ' + id, desc: '' }));
const env = { blocks, defaults: { header: 'h-minimal', nav: 'n-soft' }, palettes: P.LIST, fonts: F.LIST, backgrounds: B.LIST, templates: T.LIST, sectorOf: Sec.detect };
const r = R.create(env), good = { idea: 'Cafetería', bloques: [{ id: 'h-search' }, { id: 'c-coffee', copias: 3 }, { id: 'a-coral' }, { id: 'n-soft' }], paleta: P.LIST[0].id, tipografia: F.LIST[0].id, fondo: null, modo: 'oscuro', textos: { 'h-search': ['Hola', '<b>Buenas</b>'] } };

test('el prompt es compacto y trae el catálogo y las reglas', () => {
  const p = r.prompt('Una cafetería con pedidos');
  assert.match(p, /h-search/); assert.match(p, /paletas:/); assert.match(p, /SOLO con este JSON/); assert.ok(p.length < 9000, 'longitud ' + p.length);
});
test('el catálogo pone primero los bloques del sector', () => {
  const t = T.LIST.find(x => x.sector === 'comida'), line = r.catalogText('mi cafeteria de barrio').split('\n').find(l => l.startsWith('tarjetas:'));
  assert.ok(line.includes(t.blocks.find(b => b.id[0] === 'c').id));
});
test('respuesta correcta → receta', () => {
  const x = r.parse('Claro, aquí tienes:\n```json\n' + JSON.stringify(good) + '\n```\nEspero que te guste');
  assert.equal(x.ok, true); assert.deepEqual(x.recipe.blocks.map(b => b.id), ['h-search', 'c-coffee', 'a-coral', 'n-soft']); assert.equal(x.recipe.blocks[1].repeat, 3);
  assert.equal(x.recipe.mode, 'dark'); assert.equal(x.recipe.palette, P.LIST[0].id); assert.deepEqual(x.recipe.texts['h-search'], ['Hola', 'Buenas']); assert.equal(x.recipe.sector, 'comida');
});
test('tolera comas sobrantes, comentarios y comillas tipográficas', () => {
  const t = '{ "bloques": [ {"id":"h-search"}, {"id":"c-coffee",}, {"id":"n-soft"}, ], // nota\n “idea”: "x" }';
  assert.equal(r.parse(t).ok, true);
});
test('repara: ids inventados, cabecera y barra faltantes, orden, copias de más', () => {
  const x = r.parse(JSON.stringify({ bloques: [{ id: 'c-coffee', copias: 99 }, { id: 'inventado' }, { id: 'a-coral' }, { id: 'n-soft' }, { id: 'h-search' }, { id: 'c-coffee' }] }));
  assert.equal(x.ok, true); assert.deepEqual(x.recipe.blocks.map(b => b.id), ['h-search', 'c-coffee', 'a-coral', 'n-soft']); assert.equal(x.recipe.blocks[1].repeat, 6); assert.ok(x.warnings.length >= 2);
  const y = r.parse(JSON.stringify({ bloques: ['c-coffee'] })); assert.equal(y.ok, true); assert.equal(y.recipe.blocks[0].id, 'h-minimal'); assert.equal(y.recipe.blocks.at(-1).id, 'n-soft');
});
test('rechaza lo inservible con mensajes claros', () => {
  for (const t of ['hola', '{"x":1}', '{"bloques":[{"id":"nada"}]}', '{"bloques":[{"id":"h-search"},{"id":"n-soft"}]}']) { const x = r.parse(t); assert.equal(x.ok, false); assert.ok(x.errors.length); assert.match(r.fixPrompt(x), /SOLO con el JSON/); }
});
test('ignora paleta/fuente/fondo/texto inexistentes sin romper', () => {
  const x = r.parse(JSON.stringify({ ...good, paleta: 'no-existe', tipografia: 'x', fondo: 'y', textos: { 'no-esta': ['a'], 'c-coffee': [1, 'ok', {}] } }));
  assert.equal(x.ok, true); assert.equal(x.recipe.palette, undefined); assert.deepEqual(x.recipe.texts, { 'c-coffee': ['1', 'ok'] }); assert.ok(x.warnings.length >= 4);
});
test('la receta es una plantilla válida', () => {
  const x = r.parse(JSON.stringify(good)), tpl = r.toTemplate(x.recipe), byId = Object.fromEntries(blocks.map(b => [b.id, b]));
  assert.deepEqual(T.problems(tpl, byId), []);
});
test('acepta ids en claves en inglés', () => {
  const x = r.parse(JSON.stringify({ brief: 'x', blocks: [{ id: 'h-search' }, { id: 'c-coffee', repeat: 2 }, { id: 'n-soft' }], palette: P.LIST[1].id, mode: 'light' }));
  assert.equal(x.ok, true); assert.equal(x.recipe.mode, 'light'); assert.equal(x.recipe.blocks[1].repeat, 2);
});
