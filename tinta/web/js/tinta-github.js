/* Subir el proyecto a GitHub con un token propio. Sin servidor: la app habla directo con api.github.com (admite CORS).
   · verify()    → quién es el dueño del token y qué repositorios puede tocar.
   · repoInfo()  → rama por defecto y permisos del repositorio elegido.
   · push()      → sube todos los archivos en UN solo commit (blobs → árbol → commit → rama); si el repositorio está
                   vacío, crea primero el commit inicial. Nunca pisa archivos que no estén en la lista.
   · enablePages() → publica la rama como web (GitHub Pages) y devuelve la dirección.
   El token se guarda solo en este dispositivo (clave aparte, fuera de copias de seguridad y enlaces) y solo se envía a
   api.github.com. Núcleo sin DOM: recibe fetch y almacenamiento, así se prueba sin red. */
(function (root) {
  'use strict';
  const KEY = 'estilos-tinta-github-v1', API = 'https://api.github.com';
  const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/, REPO = /^[A-Za-z0-9._-]{1,100}$/, BRANCH = /^[A-Za-z0-9._\/-]{1,100}$/;
  const MAX_FILE = 20 * 1024 * 1024;
  const b64 = s => { const bytes = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };

  class GhError extends Error { constructor(msg, status, kind) { super(msg); this.status = status; this.kind = kind; } }
  /* Qué significa cada fallo, dicho para quien no es programador. */
  function explain(status, body, ctx) {
    const t = String(body || '').toLowerCase();
    if (status === 0) return ['No hubo respuesta de GitHub: revisa tu conexión.', 'red'];
    if (status === 401) return ['El token no es válido o caducó. Crea uno nuevo.', 'token'];
    if (status === 403 && /rate limit/.test(t)) return ['GitHub te limitó por hacer muchas peticiones. Espera unos minutos.', 'limite'];
    if (status === 403) return ['El token no tiene permiso para esto' + (ctx ? ' (' + ctx + ')' : '') + '. En «Permisos del repositorio» pon Contents: Read and write.', 'permiso'];
    if (status === 404) return ['GitHub no encuentra ese repositorio o el token no tiene acceso a él. Revisa el nombre y que el token incluya ese repositorio.', 'no-existe'];
    if (status === 409 && /empty/.test(t)) return ['El repositorio está vacío.', 'vacio'];
    if (status === 409) return ['La rama cambió mientras subía. Vuelve a intentarlo.', 'conflicto'];
    if (status === 422) return ['GitHub rechazó los datos' + (t ? ': ' + String(body).slice(0, 140) : '') + '.', 'datos'];
    return ['GitHub devolvió un error (' + status + ').', 'otro'];
  }

  function create(env) {
    const f = env.fetch, storage = env.storage; let data = null;
    const load = () => { if (data) return data; try { const r = JSON.parse(storage.getItem(KEY) || 'null'); data = r && r.v === 1 ? r : { v: 1, token: '', owner: '', repo: '', branch: '', dir: '' }; } catch (e) { data = { v: 1, token: '', owner: '', repo: '', branch: '', dir: '' }; } return data; };
    const persist = () => { try { storage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; } };
    async function call(method, path, body, ctx) {
      const d = load(); if (!d.token) throw new GhError('Falta el token de GitHub.', 401, 'token');
      const c = new AbortController(), t = setTimeout(() => c.abort(), 45000); let res, text = '';
      try {
        res = await f(API + path, { method, signal: c.signal, headers: { Authorization: 'Bearer ' + d.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
      } catch (e) { throw new GhError(explain(0)[0], 0, 'red'); } finally { clearTimeout(t); }
      if (res.status === 204) return null;
      if (!res.ok) { try { text = (await res.text()).slice(0, 300); } catch (e) { /* sin cuerpo */ } const [m, k] = explain(res.status, text, ctx); throw new GhError(m, res.status, k); }
      try { return await res.json(); } catch (e) { return null; }
    }
    const checkRepo = (owner, repo, branch) => {
      if (!OWNER.test(owner || '')) throw new GhError('El usuario u organización no es válido.', 0, 'datos');
      if (!REPO.test(repo || '') || repo === '.' || repo === '..') throw new GhError('El nombre del repositorio no es válido.', 0, 'datos');
      if (branch && (!BRANCH.test(branch) || branch.includes('..') || branch.startsWith('/') || branch.endsWith('/'))) throw new GhError('El nombre de la rama no es válido.', 0, 'datos');
    };
    const cleanPath = p => String(p || '').replace(/\\/g, '/').replace(/^\/+/, '').split('/').filter(x => x && x !== '.' && x !== '..').join('/');
    return {
      load, persist,
      set(patch) { const d = load(); ['token', 'owner', 'repo', 'branch', 'dir'].forEach(k => { if (typeof patch[k] === 'string') d[k] = patch[k].trim().slice(0, 300); }); persist(); },
      clear() { data = { v: 1, token: '', owner: '', repo: '', branch: '', dir: '' }; persist(); },
      has: () => !!load().token,
      /* Dueño del token y repositorios a los que llega (un token de un solo repositorio lista solo ese). */
      async verify() {
        const me = await call('GET', '/user'), repos = await call('GET', '/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member');
        return { login: me.login, repos: (repos || []).filter(r => r.permissions ? r.permissions.push : true).map(r => ({ owner: r.owner.login, name: r.name, full: r.full_name, branch: r.default_branch, private: !!r.private, empty: r.size === 0 })) };
      },
      async repoInfo(owner, repo) { checkRepo(owner, repo); const r = await call('GET', '/repos/' + owner + '/' + repo, null, 'repositorio'); return { branch: r.default_branch || 'main', canPush: r.permissions ? !!r.permissions.push : true, private: !!r.private, empty: r.size === 0, url: r.html_url }; },
      /* Sube los archivos en un solo commit. files: [{path, content}] (texto). onStep(texto) informa del avance. */
      async push(opts) {
        const { owner, repo, files, message } = opts, onStep = opts.onStep || (() => {}); let branch = opts.branch || '';
        checkRepo(owner, repo, branch);
        if (!Array.isArray(files) || !files.length) throw new GhError('No hay archivos que subir.', 0, 'datos');
        const dir = cleanPath(opts.dir), list = files.map(x => ({ path: (dir ? dir + '/' : '') + cleanPath(x.path), content: String(x.content) }));
        if (list.some(x => !x.path || x.path.endsWith('/'))) throw new GhError('Hay un archivo con nombre no válido.', 0, 'datos');
        if (new Set(list.map(x => x.path)).size !== list.length) throw new GhError('Hay archivos repetidos.', 0, 'datos');
        const big = list.find(x => x.content.length > MAX_FILE); if (big) throw new GhError('«' + big.path + '» pesa demasiado (máx. 20 MB).', 0, 'datos');
        onStep('Comprobando el repositorio…'); const info = await this.repoInfo(owner, repo); if (!info.canPush) throw new GhError('Tu token solo puede leer este repositorio. Necesita Contents: Read and write.', 403, 'permiso');
        branch = branch || info.branch;
        const base = '/repos/' + owner + '/' + repo; let parent = null, baseTree = null;
        try { const ref = await call('GET', base + '/git/ref/heads/' + branch.split('/').map(encodeURIComponent).join('/'), null, 'rama'); parent = ref.object.sha; }
        catch (e) { if (e.status !== 404 && e.status !== 409) throw e; }
        if (!parent) {   /* rama nueva o repositorio vacío: se crea con un commit inicial (la API de Git no funciona sobre un repositorio vacío) */
          onStep('Preparando el repositorio vacío…');
          if (await probeEmpty(call, base)) { await call('PUT', base + '/contents/.gitkeep', { message: 'Inicio del repositorio', content: '', branch }, 'contenido'); const ref = await call('GET', base + '/git/ref/heads/' + branch, null, 'rama'); parent = ref.object.sha; }
          else { const def = await call('GET', base + '/git/ref/heads/' + info.branch, null, 'rama'); await call('POST', base + '/git/refs', { ref: 'refs/heads/' + branch, sha: def.object.sha }, 'rama'); parent = def.object.sha; }
        }
        const commit = await call('GET', base + '/git/commits/' + parent, null, 'commit'); baseTree = commit.tree.sha;
        const tree = []; let n = 0;
        for (const x of list) { onStep('Subiendo ' + (++n) + ' de ' + list.length + ': ' + x.path); const b = await call('POST', base + '/git/blobs', { content: b64(x.content), encoding: 'base64' }, 'archivos'); tree.push({ path: x.path, mode: '100644', type: 'blob', sha: b.sha }); }
        onStep('Creando el commit…');
        const t = await call('POST', base + '/git/trees', { base_tree: baseTree, tree }, 'archivos');
        const c = await call('POST', base + '/git/commits', { message: String(message || 'Proyecto creado con Estilos Tinta').slice(0, 200), tree: t.sha, parents: [parent] }, 'commit');
        await call('PATCH', base + '/git/refs/heads/' + branch.split('/').map(encodeURIComponent).join('/'), { sha: c.sha, force: false }, 'rama');
        const d = load(); d.owner = owner; d.repo = repo; d.branch = branch; d.dir = opts.dir || ''; persist();
        return { sha: c.sha, branch, url: 'https://github.com/' + owner + '/' + repo + '/commit/' + c.sha, repoUrl: 'https://github.com/' + owner + '/' + repo, files: list.length };
      },
      /* Publica la rama como web. Si ya estaba activo, solo informa de la dirección. */
      async enablePages(owner, repo, branch) {
        checkRepo(owner, repo, branch); const url = 'https://' + owner.toLowerCase() + '.github.io/' + (repo.toLowerCase() === owner.toLowerCase() + '.github.io' ? '' : repo + '/');
        try { await call('POST', '/repos/' + owner + '/' + repo + '/pages', { source: { branch, path: '/' } }, 'GitHub Pages'); return { url, created: true }; }
        catch (e) { if (e.status === 409 || e.status === 422) return { url, created: false }; throw e; }
      }
    };
  }
  /* Un repositorio recién creado sin commits contesta 409 «Git Repository is empty». */
  async function probeEmpty(call, base) { try { await call('GET', base + '/git/ref/heads/__no_existe__', null, 'rama'); return false; } catch (e) { return e.status === 409; } }

  const api = { create, GhError, explain, KEY, b64, OWNER, REPO, BRANCH };
  root.TintaGitHub = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
