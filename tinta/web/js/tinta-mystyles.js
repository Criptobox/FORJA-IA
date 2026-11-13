/* Mis estilos: crear, editar y borrar estilos propios de la biblioteca.
   Se guardan en el mismo almacén que la biblioteca clásica ('estilos-user-v2': added / edits / deleted),
   así que los estilos creados en una u otra se ven en las dos. Aquí solo hay lógica pura y almacenamiento;
   crear.js pone la pantalla. El código propio se saneará al dibujarlo (tinta-library.js: sin scripts). */
(function (root) {
  'use strict';
  const KEY = 'estilos-user-v2', FAV = 'estilos-favs-v1', RECENT = 'estilos-recent';
  /* Categorías que se pueden crear y la familia de diseños base de cada una (como la biblioteca clásica). */
  const TABS = { Tarjetas: 'card', Botones: 'btn', Encabezados: 'head', Barras: 'bar', Entradas: 'input', Listas: 'list', Formularios: 'form', Datos: 'data', Avisos: 'notice', Hojas: 'sheet', Chat: 'chat', Avatares: 'avatar' };
  const HEX6 = /^#[0-9a-f]{6}$/i;
  const clean = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const newId = () => 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const safeId = id => String(id == null ? '' : id).replace(/[^\w-]/g, '').slice(0, 60);
  /* Diseños base disponibles para una categoría, dado el registro de diseños D. */
  const variants = (tab, D) => { const f = TABS[tab]; return f && D ? Object.keys(D).filter(k => k.indexOf(f + '.') === 0) : []; };
  function colors(raw) {
    const list = Array.isArray(raw) ? raw : String(raw || '').split(/[\s,;]+/);
    return list.map(c => String(c).trim()).filter(Boolean).map(c => c[0] === '#' ? c : '#' + c)
      .map(c => /^#[0-9a-f]{3}$/i.test(c) ? '#' + c.slice(1).split('').map(x => x + x).join('') : c).filter(c => HEX6.test(c)).map(c => c.toLowerCase()).slice(0, 6);
  }
  /* Devuelve { entry } o { error }. D es opcional (sin él no se valida el diseño base). */
  function normalize(raw, D) {
    if (!raw || typeof raw !== 'object') return { error: 'Faltan los datos del estilo.' };
    const name = clean(raw.name, 80), tab = clean(raw.tab, 30);
    if (!name) return { error: 'Ponle un nombre a tu estilo.' };
    if (!TABS[tab]) return { error: 'Elige una categoría válida.' };
    const cols = colors(raw.colors);
    if (!cols.length) return { error: 'Añade al menos un color en formato #RRGGBB.' };
    const radius = /^\d{1,2}%?$/.test(String(raw.radius).trim()) ? String(raw.radius).trim() : '16';
    const v = clean(raw.v, 40);
    if (v && D && !variants(tab, D).includes(v)) return { error: 'Ese diseño base no pertenece a la categoría.' };
    const code = clean(raw.code, 4000);
    return { entry: { id: safeId(raw.id) || newId(), tab, name, ref: clean(raw.ref, 80), desc: clean(raw.desc, 400), colors: cols, radius, tip: clean(raw.tip, 300), mode: raw.mode === 'dark' ? 'dark' : 'light', v, code } };
  }
  /* Almacén: se conservan edits, deleted y cualquier otra clave de la biblioteca clásica. */
  function read() {
    try { const u = JSON.parse(localStorage.getItem(KEY) || '{}'); const o = u && typeof u === 'object' && !Array.isArray(u) ? u : {}; return { ...o, added: Array.isArray(o.added) ? o.added : [], edits: o.edits && typeof o.edits === 'object' && !Array.isArray(o.edits) ? o.edits : {}, deleted: Array.isArray(o.deleted) ? o.deleted : [] }; }
    catch (e) { return { added: [], edits: {}, deleted: [] }; }
  }
  function write(user) { try { localStorage.setItem(KEY, JSON.stringify(user)); return true; } catch (e) { return false; } }
  const MAX_MINE = 200;
  function save(raw, D) {
    const r = normalize(raw, D); if (r.error) return { error: r.error };
    const user = read(), i = user.added.findIndex(x => x && x.id === r.entry.id);
    if (i >= 0) user.added[i] = r.entry; else { if (user.added.length >= MAX_MINE) return { error: 'Ya tienes ' + MAX_MINE + ' estilos propios. Elimina alguno antes de crear otro.' }; user.added.push(r.entry); }
    return write(user) ? { entry: r.entry, updated: i >= 0 } : { error: 'No se pudo guardar: el almacenamiento está lleno o bloqueado.' };
  }
  function remove(id) {
    id = safeId(id); const user = read(); const before = user.added.length;
    user.added = user.added.filter(x => !(x && x.id === id));
    if (user.added.length === before) return { error: 'Ese estilo no es tuyo o ya no existe.' };
    if (!write(user)) return { error: 'No se pudo guardar el cambio.' };
    [FAV, RECENT].forEach(k => { try { const l = JSON.parse(localStorage.getItem(k) || '[]'); if (Array.isArray(l)) localStorage.setItem(k, JSON.stringify(l.filter(x => safeId(x) !== id))); } catch (e) { /* sin acceso */ } });
    return { removed: id };
  }
  root.TintaMyStyles = { TABS, variants, colors, normalize, read, save, remove, MAX_MINE };
  if (typeof module !== 'undefined') module.exports = root.TintaMyStyles;
})(typeof window !== 'undefined' ? window : globalThis);
