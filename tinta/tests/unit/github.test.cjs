const test = require('node:test'), assert = require('node:assert/strict');
const G = require('../../web/js/tinta-github.js');
const mem = () => { const s = {}; return { getItem: k => s[k] ?? null, setItem: (k, v) => { s[k] = String(v); }, s }; };
const R = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => typeof body === 'string' ? body : JSON.stringify(body), json: async () => (typeof body === 'string' ? JSON.parse(body) : body) });
/* GitHub falso en memoria: repos con ramas, commits, árboles y blobs. */
function fakeGitHub(opts = {}) {
  const st = { blobs: {}, trees: {}, commits: {}, refs: {}, log: [], pages: null, empty: !!opts.empty, n: 0, files: {} };
  const sha = () => (++st.n).toString(16).padStart(40, '0');
  const fetch = async (url, init) => {
    const u = new URL(url), p = u.pathname, m = init.method, body = init.body ? JSON.parse(init.body) : null; st.log.push(m + ' ' + p);
    if (init.headers.Authorization !== 'Bearer ' + (opts.token || 'ghp_ok')) return R(401, { message: 'Bad credentials' });
    if (p === '/user') return R(200, { login: 'ana' });
    if (p === '/user/repos') return R(200, [{ owner: { login: 'ana' }, name: 'mi-app', full_name: 'ana/mi-app', default_branch: 'main', private: false, size: st.empty ? 0 : 5, permissions: { push: true } }, { owner: { login: 'otro' }, name: 'ajeno', full_name: 'otro/ajeno', default_branch: 'main', size: 3, permissions: { push: false } }]);
    const mm = p.match(/^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/); if (!mm) return R(404, 'x'); const [, o, r, rest = ''] = mm;
    if (r === 'no-existe') return R(404, { message: 'Not Found' }); if (r === 'solo-lectura' && m !== 'GET') return R(403, { message: 'Resource not accessible by personal access token' });
    if (!rest) return R(200, { default_branch: 'main', permissions: { push: r !== 'solo-lectura' }, size: st.empty ? 0 : 5, private: false, html_url: 'https://github.com/' + o + '/' + r });
    if (rest === '/contents/.gitkeep' && m === 'PUT') { st.empty = false; const c = sha(), t = sha(); st.trees[t] = {}; st.commits[c] = { tree: t }; st.refs['heads/' + body.branch] = c; return R(201, {}); }
    let x; if ((x = rest.match(/^\/git\/ref\/(.+)$/)) && m === 'GET') { if (st.empty) return R(409, { message: 'Git Repository is empty.' }); const v = st.refs[x[1]]; return v ? R(200, { object: { sha: v } }) : R(404, { message: 'Not Found' }); }
    if (rest === '/git/refs' && m === 'POST') { st.refs[body.ref.replace('refs/', '')] = body.sha; return R(201, {}); }
    if ((x = rest.match(/^\/git\/commits\/(.+)$/)) && m === 'GET') return R(200, { tree: { sha: st.commits[x[1]].tree } });
    if (rest === '/git/blobs') { const s = sha(); st.blobs[s] = Buffer.from(body.content, 'base64').toString('utf8'); return R(201, { sha: s }); }
    if (rest === '/git/trees') { const s = sha(); st.trees[s] = { ...st.trees[body.base_tree] }; body.tree.forEach(e => { st.trees[s][e.path] = st.blobs[e.sha]; }); return R(201, { sha: s }); }
    if (rest === '/git/commits') { const s = sha(); st.commits[s] = { tree: body.tree, parents: body.parents, message: body.message }; return R(201, { sha: s }); }
    if ((x = rest.match(/^\/git\/refs\/(.+)$/)) && m === 'PATCH') { if (body.sha === undefined) return R(422, 'x'); st.refs[x[1]] = body.sha; return R(200, {}); }
    if (rest === '/pages' && m === 'POST') { if (st.pages) return R(409, { message: 'already' }); st.pages = body; return R(201, {}); }
    return R(404, 'sin ruta ' + rest);
  };
  return { fetch, st };
}
const make = (gh, st = mem()) => G.create({ fetch: gh.fetch, storage: st });

test('verify: quién eres y solo los repositorios donde puedes escribir', async () => {
  const g = make(fakeGitHub()); g.set({ token: ' ghp_ok ' }); const v = await g.verify(); assert.equal(v.login, 'ana'); assert.deepEqual(v.repos.map(r => r.full), ['ana/mi-app']);
});
test('un token malo da un error claro', async () => {
  const g = make(fakeGitHub()); g.set({ token: 'malo' }); await assert.rejects(g.verify(), e => e.kind === 'token' && /no es válido/.test(e.message));
  await assert.rejects(make(fakeGitHub()).verify(), e => e.kind === 'token');
});
test('push: todo en UN commit, con los archivos y la carpeta', async () => {
  const gh = fakeGitHub(); gh.st.refs['heads/main'] = 'a'.padStart(40, '0'); gh.st.commits['a'.padStart(40, '0')] = { tree: 'b'.padStart(40, '0') }; gh.st.trees['b'.padStart(40, '0')] = { 'viejo.txt': 'queda' };
  const g = make(gh); g.set({ token: 'ghp_ok' }); const steps = [];
  const r = await g.push({ owner: 'ana', repo: 'mi-app', dir: 'web', files: [{ path: 'index.html', content: '<h1>Hola ñandú ✓</h1>' }, { path: 'README.md', content: '# x' }], message: 'Mi app', onStep: s => steps.push(s) });
  assert.equal(r.files, 2); assert.match(r.url, /commit\//); const tree = gh.st.trees[gh.st.commits[r.sha].tree];
  assert.equal(tree['web/index.html'], '<h1>Hola ñandú ✓</h1>'); assert.equal(tree['viejo.txt'], 'queda', 'no pisa lo que ya había'); assert.equal(gh.st.commits[r.sha].parents[0], 'a'.padStart(40, '0')); assert.equal(gh.st.commits[r.sha].message, 'Mi app');
  assert.equal(gh.st.log.filter(l => l === 'POST /repos/ana/mi-app/git/commits').length, 1); assert.ok(steps.some(s => /Subiendo 2 de 2/.test(s)));
  assert.equal(JSON.parse(g.load() && JSON.stringify(g.load())).repo, 'mi-app', 'recuerda el destino');
});
test('push en un repositorio vacío: crea el commit inicial y sigue', async () => {
  const gh = fakeGitHub({ empty: true }), g = make(gh); g.set({ token: 'ghp_ok' });
  const r = await g.push({ owner: 'ana', repo: 'mi-app', files: [{ path: 'index.html', content: 'hola' }] });
  assert.equal(gh.st.trees[gh.st.commits[r.sha].tree]['index.html'], 'hola'); assert.ok(gh.st.log.includes('PUT /repos/ana/mi-app/contents/.gitkeep'));
});
test('push en una rama nueva: la crea desde la principal', async () => {
  const gh = fakeGitHub(); const c = 'c'.padStart(40, '0'); gh.st.refs['heads/main'] = c; gh.st.commits[c] = { tree: 'd'.padStart(40, '0') }; gh.st.trees['d'.padStart(40, '0')] = {};
  const g = make(gh); g.set({ token: 'ghp_ok' }); const r = await g.push({ owner: 'ana', repo: 'mi-app', branch: 'diseno', files: [{ path: 'a.txt', content: 'x' }] });
  assert.equal(r.branch, 'diseno'); assert.equal(gh.st.refs['heads/diseno'], r.sha); assert.equal(gh.st.refs['heads/main'], c, 'main no se toca');
});
test('errores: repo inexistente, solo lectura y datos no válidos', async () => {
  const g = make(fakeGitHub()); g.set({ token: 'ghp_ok' }); const f = [{ path: 'a', content: 'x' }];
  await assert.rejects(g.push({ owner: 'ana', repo: 'no-existe', files: f }), e => e.kind === 'no-existe');
  await assert.rejects(g.push({ owner: 'ana', repo: 'solo-lectura', files: f }), e => e.kind === 'permiso' && /Contents/.test(e.message));
  for (const bad of [{ owner: 'a b', repo: 'x' }, { owner: 'ana', repo: '../x' }, { owner: 'ana', repo: 'x', branch: 'a..b' }, { owner: 'ana', repo: 'x', files: [] }, { owner: 'ana', repo: 'x', files: [{ path: '..', content: '' }] }, { owner: 'ana', repo: 'x', files: [{ path: 'a', content: '' }, { path: '/a', content: '' }] }]) await assert.rejects(g.push({ files: f, ...bad }), e => e instanceof G.GhError, JSON.stringify(bad));
});
test('rutas con ../ no se escapan de la carpeta', async () => {
  const gh = fakeGitHub(); gh.st.refs['heads/main'] = 'e'.padStart(40, '0'); gh.st.commits['e'.padStart(40, '0')] = { tree: 'f'.padStart(40, '0') }; gh.st.trees['f'.padStart(40, '0')] = {};
  const g = make(gh); g.set({ token: 'ghp_ok' }); const r = await g.push({ owner: 'ana', repo: 'mi-app', dir: '../../x', files: [{ path: '../../index.html', content: 'ok' }] });
  assert.deepEqual(Object.keys(gh.st.trees[gh.st.commits[r.sha].tree]), ['x/index.html']);
});
test('Pages: activa y da la dirección; si ya estaba, solo informa', async () => {
  const gh = fakeGitHub(), g = make(gh); g.set({ token: 'ghp_ok' });
  const a = await g.enablePages('Ana', 'Mi-App', 'main'); assert.equal(a.url, 'https://ana.github.io/Mi-App/'); assert.equal(a.created, true); assert.deepEqual(gh.st.pages, { source: { branch: 'main', path: '/' } });
  assert.equal((await g.enablePages('Ana', 'Mi-App', 'main')).created, false);
});
test('el token se guarda aparte y se borra del todo', () => {
  const st = mem(), g = make(fakeGitHub(), st); g.set({ token: 'ghp_ok', owner: 'ana', repo: 'mi-app' }); assert.ok(st.s[G.KEY].includes('ghp_ok')); assert.equal(Object.keys(st.s).length, 1);
  g.clear(); assert.ok(!st.s[G.KEY].includes('ghp_ok')); assert.equal(g.has(), false);
});
