const test = require('node:test'), assert = require('node:assert/strict');
const W = '../../web/js/', E = require(W + 'tinta-equipo.js'), T = require(W + 'tinta-templates.js'), Sec = require(W + 'tinta-sectors.js'), P = require(W + 'tinta-palettes.js'), F = require(W + 'tinta-fonts.js'), B = require(W + 'tinta-backgrounds.js'), Tax = require(W + 'tinta-taxonomy.js'), Art = require(W + 'tinta-equipo-art.js');
const ids = new Set(); T.LIST.forEach(t => t.blocks.forEach(b => ids.add(b.id))); ids.add('h-minimal');
const role = id => ({ h: 'header', c: 'cards', a: 'actions', n: 'nav' })[id[0]] || 'cards', byId = Object.fromEntries([...ids].map(id => [id, { id, role: role(id) }]));
const env = { sectorOf: Sec.detect, templates: T.LIST, problems: t => T.problems(t, byId), palettes: P.LIST, fonts: F.LIST, backgrounds: B.LIST, roleOf: id => byId[id] && byId[id].role, byId, family: p => Tax.paletteFamily(p) };

test('ocho especialistas, cada uno con su figura y su objeto de trabajo', () => {
  assert.equal(E.AGENTS.length, 8); assert.deepEqual(E.AGENTS.map(a => a.role), ['research', 'architect', 'ux', 'ui', 'writer', 'a11y', 'dev', 'critic']);
  E.AGENTS.forEach(a => { const s = Art.cubo(a.col, a.m, a.hat, a.role); assert.match(s, /<svg/); assert.match(s, /class="prop[ "]/); });
});
test('el plan parte de una plantilla válida del sector y fija paleta y letra', () => {
  const p = E.plan(env, 'Una app para mi cafetería con pedidos y barra inferior');
  assert.equal(p.sid, 'comida'); assert.deepEqual(T.problems(p.A, byId), []); assert.ok(P.get(p.A.palette) && F.get(p.A.font)); assert.equal(p.A.fromRecipe, true); assert.equal(p.A.keepBrief, true); assert.match(p.A.brief, /cafetería/);
});
test('el Crítico propone una versión distinta, válida y con razones', () => {
  for (const idea of ['Una app para mi cafetería', 'Mis finanzas personales', 'Gimnasio con rutinas', 'Algo totalmente distinto sin sector claro']) {
    const p = E.plan(env, idea); assert.deepEqual(T.problems(p.B, byId), [], idea); assert.deepEqual(T.problems(p.M, byId), [], idea);
    const a = P.get(p.A.palette), b = P.get(p.B.palette); assert.notEqual(!!a.dark, !!b.dark, 'modo contrario: ' + idea); assert.notEqual(p.A.palette, p.B.palette);
    assert.match(p.critique, /^No estoy de acuerdo: .+\. Te propongo una versión (clara|oscura)/); assert.ok(p.critique.length < 260);
  }
});
test('Mezclar = estructura del equipo + estilo del Crítico', () => {
  const p = E.plan(env, 'Una tienda de ropa con catálogo'); assert.deepEqual(p.M.blocks, p.A.blocks); assert.equal(p.M.palette, p.B.palette); assert.equal(p.M.mode, p.B.mode);
});
test('una propuesta de IA manda sobre la estructura', () => {
  const ai = { name: 'Propuesta de tu IA', blocks: [{ id: 'h-search' }, { id: 'c-coffee', repeat: 3 }, { id: 'a-coral' }, { id: 'n-soft' }], texts: { 'h-search': ['Hola'] } };
  const p = E.plan(env, 'cafetería', ai); assert.equal(p.aiUsed, true); assert.deepEqual(p.A.blocks.map(b => b.id), ['h-search', 'c-coffee', 'a-coral', 'n-soft']); assert.deepEqual(p.A.texts, { 'h-search': ['Hola'] });
});
