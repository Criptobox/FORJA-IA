const test = require('node:test'), assert = require('node:assert/strict'), cargar = require('./cargar.cjs');
const U = cargar('util.js', '({ esc, safeColor, safeId, lum, contrast, inkOn })');
test('esc escapa los cinco caracteres peligrosos y acepta null', () => {
  assert.equal(U.esc('<a href="x" onclick=\'y\'>&</a>'), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  assert.equal(U.esc(null), ''); assert.equal(U.esc(undefined), ''); assert.equal(U.esc(0), '0');
});
test('safeColor solo acepta hexadecimales y descarta inyecciones', () => {
  assert.equal(U.safeColor('#abc'), '#ABC'); assert.equal(U.safeColor('ff8800'), '#FF8800'); assert.equal(U.safeColor('#11223344'), '#11223344');
  for (const mal of ['red', 'red;background:url(//x)', 'javascript:alert(1)', '#12', '#12345', '<script>', '']) assert.equal(U.safeColor(mal), '#888888', mal);
  assert.equal(U.safeColor('nada', '#000000'), '#000000');
});
test('safeId deja solo letras, números, guion y guion bajo (máx. 60)', () => {
  assert.equal(U.safeId('a b/c<d>-e_1'), 'abcd-e_1'); assert.equal(U.safeId(null), ''); assert.equal(U.safeId('x'.repeat(100)).length, 60);
});
test('contraste WCAG: negro sobre blanco es 21, igual es 1 y es simétrico', () => {
  assert.equal(Math.round(U.contrast('#000000', '#ffffff')), 21); assert.equal(U.contrast('#777777', '#777777'), 1);
  assert.equal(U.contrast('#123456', '#fedcba'), U.contrast('#fedcba', '#123456'));
  assert.ok(U.lum('#ffffff') > U.lum('#808080') && U.lum('#808080') > U.lum('#000000'));
});
test('inkOn elige el texto con más contraste', () => {
  assert.equal(U.inkOn('#000000'), '#FFFFFF'); assert.equal(U.inkOn('#ffffff'), '#111318'); assert.equal(U.inkOn('#ffe14d'), '#111318');
});
