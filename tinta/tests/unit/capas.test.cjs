const test = require('node:test'), assert = require('node:assert/strict');
const B = require('../../web/js/tinta-backgrounds.js'), V = require('../../web/js/tinta-visual.js'), Art = require('../../web/js/tinta-art.js'), Tax = require('../../web/js/tinta-taxonomy.js');
test('20 fondos válidos: solo gradientes y colores, sin recursos externos', () => {
  assert.equal(B.LIST.length, 20); assert.equal(new Set(B.LIST.map(b => b.id)).size, 20); assert.ok(B.LIST.every(B.valid));
  assert.ok(B.LIST.every(b => !/url\(|@import|<|javascript:/i.test(b.bg)));
  assert.equal(B.LIST.filter(b => b.dark).length, 5); assert.ok(B.LIST.every(b => B.GROUPS.some(g => g.id === b.group)));
});
test('11 estilos visuales con CSS equilibrado y sin recursos externos', () => {
  assert.equal(V.LIST.length, 11); assert.equal(new Set(V.LIST.map(v => v.id)).size, 11);
  for (const v of V.LIST) { const css = v.css(v.accent); assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, v.id); assert.ok(!/url\(|@import|<script/i.test(css), v.id); assert.match(v.accent, /^#[0-9a-f]{6}$/i); assert.ok(V.GROUPS.some(g => g.id === v.group), v.id); }
});
test('41 ilustraciones SVG de 240×140 sin texto, imágenes, enlaces ni scripts', () => {
  const nombres = Object.keys(Art.ART).filter(k => Art.ART[k]); assert.equal(nombres.length, 41);
  for (const k of nombres) { const s = Art.ART[k](Art.colors({})); assert.ok(/^<svg viewBox="0 0 240 140" aria-hidden="true">/.test(s) && s.endsWith('</svg>'), k); assert.ok(!/<script|<text|<image|onload|onclick|href|javascript:|<foreignObject/i.test(s), k); }
});
test('Art.colors descarta colores inválidos y usa los de reserva', () => {
  const c = Art.colors({ a: 'red;x', b: '#112233' }); assert.match(c.a, /^#[0-9a-f]{6}$/i); assert.equal(c.b, '#112233');
});
test('18 categorías de la biblioteca con id único y subcategorías sin repetir', () => {
  assert.equal(Tax.CATEGORIES.length, 18); assert.equal(new Set(Tax.CATEGORIES.map(c => c.id)).size, 18);
  for (const c of Tax.CATEGORIES) { const subs = Tax.subsFor(c, []); assert.equal(new Set(subs.map(s => s.id)).size, subs.length, c.id); }
});
test('figuras 3D: 14 personajes y robots cubo, SVG seguros y con ids que no se repiten entre figuras', () => {
  const F = require('../../web/js/tinta-figuras.js'), claves = Object.keys(F.FIG); assert.equal(claves.length, 14);
  const a = F.draw('calabaza'), b = F.draw('calabaza'), ids = s => [...s.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  assert.ok(ids(a).length > 0 && ids(a).every(i => !ids(b).includes(i)), 'cada dibujo usa ids propios');
  for (const k of claves) { const s = F.draw(k); assert.ok(/^<svg viewBox="0 0 200 220" role="img" aria-label="[^"]+">/.test(s) && s.endsWith('</svg>'), k); assert.ok(!/<script|<text|<image|onload|onclick|href|javascript:|<foreignObject/i.test(s), k); }
  for (const m of ['feliz', 'triste', 'calma', 'picaro']) assert.match(F.cubo('#ff6a1a', m, true), /^<svg/);
  assert.equal(F.length, 5); assert.ok(F.every(b => b.role === 'avatars' && b.noDark && /^av-fig-/.test(b.id)));
});

test('12 tipografías válidas: familias conocidas, sin recursos externos y normalizadas', () => {
  const F = require('../../web/js/tinta-fonts.js');
  assert.equal(F.LIST.length, 12); assert.equal(new Set(F.LIST.map(f => f.id)).size, 12); assert.ok(F.LIST.every(F.valid));
  assert.ok(F.LIST.every(f => F.GROUPS.some(g => g.id === f.group)) && F.GROUPS.every(g => F.LIST.some(f => f.group === g.id)));
  assert.equal(F.normalize('editorial'), 'editorial'); assert.equal(F.normalize('Comic; background:url(x)'), null); assert.equal(F.normalize(3), null);
  for (const f of F.LIST) { const css = F.css(f); assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, f.id); assert.ok(!/url\(|@import|<script/i.test(css), f.id); assert.match(css, /^:host\{font-family:/); }
});
