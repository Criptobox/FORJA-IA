/* Copia de seguridad completa de Tinta. Un solo archivo JSON con tus proyectos, estilos propios,
   favoritos, recientes, preferencias y lo guardado en el Editor. Restaurar es NO destructivo:
   añade lo que falta como copias nuevas y nunca borra ni sobrescribe lo que ya tienes.
   Todo lo que entra se valida (formato, tamaño, tipos) antes de tocar el almacenamiento. */
(function (root) {
  'use strict';
  const FORMAT = 'estilos-backup', VERSION = 1, MAX_BYTES = 8 * 1024 * 1024, MAX_PROJECTS = 30, MAX_RECENT = 24, MAX_FAVS = 500;
  const K = { draft: 'estilos-tinta-prototype-v1', projects: 'estilos-tinta-projects-v1', user: 'estilos-user-v2', favs: 'estilos-favs-v1', recent: 'estilos-recent', theme: 'estilos-tinta-ui-theme-v1', studioProjects: 'estilos-studio-projects-v1', studio: 'estilos-studio-v1', builder: 'estilos-builder-v1', themes: 'estilos-themes-v1' };
  const rec = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const fail = m => { throw new Error(m); };
  const safeId = id => String(id == null ? '' : id).replace(/[^\w-]/g, '').slice(0, 60);
  const newId = p => p + (root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  const parse = (store, k) => { try { const t = store.get(k); return t == null ? undefined : JSON.parse(t); } catch (e) { return undefined; } };
  const put = (store, k, v) => store.set(k, JSON.stringify(v));

  /* Lee todo lo que hay guardado y lo empaqueta. store = { get(k), set(k,v) } */
  function create(store, version) {
    const data = {}; Object.values(K).forEach(k => { if (k === K.theme) { const t = store.get(k); if (t === 'dark' || t === 'light') data[k] = t; return; } const v = parse(store, k); if (v !== undefined && v !== null) data[k] = v; });   /* el tema se guarda como texto plano */
    return { app: 'estilos', format: FORMAT, version: VERSION, appVersion: String(version || ''), exported: new Date().toISOString(), data };
  }
  const projectOk = p => rec(p) && typeof p.id === 'string' && typeof p.name === 'string' && rec(p.draft) && Array.isArray(p.draft.selected) && p.draft.selected.every(x => typeof x === 'string');

  /* Valida el texto de un archivo y devuelve { data, summary }. Lanza Error con un mensaje claro. */
  function inspect(text) {
    if (typeof text !== 'string' || !text.trim()) fail('El archivo está vacío.');
    if (text.length > MAX_BYTES) fail('El archivo pesa más de 8 MB: no parece una copia de Estilos.');
    let raw; try { raw = JSON.parse(text); } catch (e) { fail('El archivo no es un JSON válido.'); }
    if (!rec(raw) || raw.format !== FORMAT || raw.app !== 'estilos') fail('No es una copia de seguridad de Estilos.');
    if (raw.version !== VERSION) fail('Esta copia es de una versión más nueva y no se puede leer aquí.');
    if (!rec(raw.data)) fail('La copia no contiene datos.');
    const d = {}, s = { projects: 0, styles: 0, edits: 0, deleted: 0, favs: 0, recent: 0, studioProjects: 0, draft: false, theme: false, builder: false };
    Object.keys(raw.data).forEach(k => { if (!Object.values(K).includes(k)) return; d[k] = raw.data[k]; });
    if (d[K.projects] !== undefined) { if (!Array.isArray(d[K.projects])) fail('Los proyectos de la copia no son válidos.'); d[K.projects] = d[K.projects].filter(projectOk).slice(0, MAX_PROJECTS); s.projects = d[K.projects].length; }
    if (d[K.user] !== undefined) { if (!rec(d[K.user])) fail('Los estilos de la copia no son válidos.'); const u = d[K.user]; s.styles = Array.isArray(u.added) ? u.added.length : 0; s.edits = rec(u.edits) ? Object.keys(u.edits).length : 0; s.deleted = Array.isArray(u.deleted) ? u.deleted.length : 0; }
    if (d[K.favs] !== undefined) { if (!Array.isArray(d[K.favs])) fail('Los favoritos de la copia no son válidos.'); s.favs = d[K.favs].length; }
    if (d[K.recent] !== undefined) { if (!Array.isArray(d[K.recent])) fail('Los recientes de la copia no son válidos.'); s.recent = d[K.recent].length; }
    if (d[K.studioProjects] !== undefined) { if (!Array.isArray(d[K.studioProjects])) fail('Los proyectos del Editor no son válidos.'); s.studioProjects = d[K.studioProjects].length; }
    if (d[K.draft] !== undefined) { if (!rec(d[K.draft]) || !Array.isArray(d[K.draft].selected)) fail('El borrador de la copia no es válido.'); s.draft = d[K.draft].selected.length > 0; }
    s.theme = d[K.theme] === 'dark' || d[K.theme] === 'light'; s.builder = d[K.builder] !== undefined;
    return { data: d, summary: s, exported: typeof raw.exported === 'string' ? raw.exported.slice(0, 40) : '' };
  }

  /* Añade lo que falta. Devuelve un informe con lo que se añadió y lo que ya existía. opts.normalizeStyle(raw) → {entry}|{error} */
  function merge(data, store, opts) {
    opts = opts || {}; const r = { projects: 0, styles: 0, favs: 0, recent: 0, studioProjects: 0, draft: 'conservado', skipped: 0, theme: false, builder: false };
    /* Estilos propios: ids libres se conservan; si chocan con uno distinto, se renombra el id. */
    if (rec(data[K.user])) {
      const cur = parse(store, K.user), user = rec(cur) ? cur : {}; user.added = Array.isArray(user.added) ? user.added : []; user.edits = rec(user.edits) ? user.edits : {}; user.deleted = Array.isArray(user.deleted) ? user.deleted : [];
      const incoming = data[K.user], have = new Set(user.added.map(x => x && x.id));
      (Array.isArray(incoming.added) ? incoming.added : []).slice(0, 200).forEach(raw => {
        const n = opts.normalizeStyle ? opts.normalizeStyle(raw) : { entry: raw }; if (!n || n.error || !n.entry) { r.skipped++; return; }
        const same = user.added.find(x => x && x.id === n.entry.id && JSON.stringify(x) === JSON.stringify(n.entry)); if (same) { r.skipped++; return; }
        if (have.has(n.entry.id)) n.entry.id = newId('u'); have.add(n.entry.id); user.added.push(n.entry); r.styles++;
      });
      if (rec(incoming.edits)) Object.keys(incoming.edits).forEach(id => { if (!(id in user.edits) && rec(incoming.edits[id])) user.edits[id] = incoming.edits[id]; });
      if (Array.isArray(incoming.deleted)) incoming.deleted.forEach(id => { const x = safeId(id); if (x && !user.deleted.includes(x)) user.deleted.push(x); });
      put(store, K.user, user);
    }
    const union = (k, max) => { if (!Array.isArray(data[k])) return 0; const cur = parse(store, k), list = Array.isArray(cur) ? cur.map(safeId).filter(Boolean) : [], before = list.length; data[k].map(safeId).filter(Boolean).forEach(x => { if (!list.includes(x)) list.push(x); }); const out = list.slice(0, max); put(store, k, out); return Math.max(0, out.length - before); };
    r.favs = union(K.favs, MAX_FAVS); r.recent = union(K.recent, MAX_RECENT);
    /* Proyectos de Tinta: copias nuevas (id nuevo) hasta el máximo; no se pisa ninguna. */
    const pcur = parse(store, K.projects), plist = Array.isArray(pcur) ? pcur.filter(projectOk) : [];
    const sameProject = p => plist.some(x => x.name === String(p.name).slice(0, 80) && JSON.stringify(x.draft) === JSON.stringify(p.draft));
    (Array.isArray(data[K.projects]) ? data[K.projects] : []).forEach(p => { if (sameProject(p)) { r.skipped++; return; } if (plist.length >= MAX_PROJECTS) { r.skipped++; return; } plist.push({ id: newId('t-'), name: String(p.name).slice(0, 80), updated: typeof p.updated === 'string' ? p.updated.slice(0, 40) : new Date().toISOString(), draft: p.draft }); r.projects++; });
    /* Borrador: si el actual está vacío se adopta; si no, entra como un proyecto más. */
    if (rec(data[K.draft]) && Array.isArray(data[K.draft].selected) && data[K.draft].selected.length) {
      const dcur = parse(store, K.draft), empty = !rec(dcur) || !Array.isArray(dcur.selected) || !dcur.selected.length;
      if (empty) { put(store, K.draft, data[K.draft]); r.draft = 'adoptado'; }
      else if (JSON.stringify(dcur) === JSON.stringify(data[K.draft]) || plist.some(x => JSON.stringify(x.draft) === JSON.stringify(data[K.draft]))) { r.skipped++; }   /* ya está: no se duplica */
      else if (plist.length < MAX_PROJECTS) { plist.push({ id: newId('t-'), name: 'Borrador de la copia', updated: new Date().toISOString(), draft: data[K.draft] }); r.draft = 'como proyecto'; r.projects++; }
    }
    if (Array.isArray(data[K.projects]) || r.draft === 'como proyecto') put(store, K.projects, plist);
    /* Proyectos del Editor: por id, sin pisar. */
    if (Array.isArray(data[K.studioProjects])) {
      const scur = parse(store, K.studioProjects), sl = Array.isArray(scur) ? scur : [], ids = new Set(sl.map(p => p && p.id));
      data[K.studioProjects].forEach(p => { if (rec(p) && typeof p.id === 'string' && typeof p.name === 'string' && rec(p.state) && !ids.has(p.id) && sl.length < MAX_PROJECTS) { sl.push(p); ids.add(p.id); r.studioProjects++; } });
      put(store, K.studioProjects, sl);
    }
    /* Preferencias y constructor: solo si no hay nada guardado. */
    if ((data[K.theme] === 'dark' || data[K.theme] === 'light') && store.get(K.theme) == null) { store.set(K.theme, data[K.theme]); r.theme = true; }
    [K.builder, K.themes, K.studio].forEach(k => { if (data[k] !== undefined && store.get(k) == null) { put(store, k, data[k]); if (k === K.builder) r.builder = true; } });
    return r;
  }
  root.TintaBackup = { FORMAT, VERSION, MAX_BYTES, K, create, inspect, merge };
  if (typeof module !== 'undefined') module.exports = root.TintaBackup;
})(typeof window !== 'undefined' ? window : globalThis);
