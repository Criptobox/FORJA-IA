/* Almacén de fotos de Tinta. Las fotos incorporadas (data:image/…;base64) pesaban dentro del borrador y de los proyectos, que
   viven en localStorage (≈5 MB). Aquí las fotos grandes pasan a IndexedDB y el texto guardado solo lleva una referencia
   «idb:<id>». En memoria la app sigue trabajando con la foto completa: exportar, compartir y deshacer no cambian.
   · packText(texto): al guardar, cambia las fotos grandes por referencias y las escribe en IndexedDB.
   · unpackText(texto): al leer, devuelve las fotos desde la memoria (cargadas en el arranque).
   · boot(fn): si hay referencias guardadas, carga esas fotos antes de arrancar la app; si no hay ninguna, arranca de inmediato.
   Sin IndexedDB (modo privado, iframe aislado…) todo sigue como antes: las fotos se guardan dentro del texto. */
(function (root) {
  'use strict';
  const MIN = 30000;                     /* solo se externalizan fotos de más de ~30 KB */
  const REF = /^idb:([a-z0-9-]{6,80})$/;
  const KEYS = ['estilos-tinta-prototype-v1', 'estilos-tinta-projects-v1'];
  /* Hash de 53 bits (cyrb53) + longitud: identifica la foto sin guardar duplicados. */
  function hash(s) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + '-' + s.length.toString(36);
  }
  /* Adaptador por defecto: IndexedDB. Otro adaptador (en memoria) se usa en las pruebas. */
  function idbAdapter(factory) {
    const NAME = 'estilos-tinta-fotos', STORE = 'fotos';
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      if (!factory) return rej(new Error('Sin IndexedDB'));
      let req; try { req = factory.open(NAME, 1); } catch (e) { return rej(e); }
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' }); };
      req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error || new Error('No se pudo abrir IndexedDB')); req.onblocked = () => rej(new Error('IndexedDB bloqueada'));
    }));
    const run = (mode, fn) => open().then(db => new Promise((res, rej) => { const tx = db.transaction(STORE, mode), st = tx.objectStore(STORE); let out; try { out = fn(st); } catch (e) { return rej(e); } tx.oncomplete = () => res(out && out.result !== undefined ? out.result : out); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('Transacción cancelada')); }));
    return {
      open,
      put: (id, data) => run('readwrite', st => st.put({ id, data, t: Date.now() })),
      getMany: ids => open().then(db => new Promise((res, rej) => { const out = {}, tx = db.transaction(STORE, 'readonly'), st = tx.objectStore(STORE); ids.forEach(id => { const r = st.get(id); r.onsuccess = () => { if (r.result) out[id] = r.result.data; }; }); tx.oncomplete = () => res(out); tx.onerror = () => rej(tx.error); })),
      keys: () => open().then(db => new Promise((res, rej) => { const tx = db.transaction(STORE, 'readonly'), r = tx.objectStore(STORE).getAllKeys(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); })),
      del: id => run('readwrite', st => st.delete(id))
    };
  }
  function create(adapter, opts) {
    opts = opts || {};
    const min = opts.min == null ? MIN : opts.min, cache = new Map(), pending = new Set(); let available = false, onChange = null, failed = 0;
    /* Recorre cualquier JSON y aplica fn a cada foto {src:…} (también dentro de listas, donde puede devolver null). */
    function walk(node, fn, depth) {
      if (!node || typeof node !== 'object' || depth > 12) return;
      if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) { const it = node[i]; if (it && typeof it === 'object' && typeof it.src === 'string') { const r = fn(it); if (r === null) node[i] = null; } else walk(it, fn, depth + 1); } return; }
      for (const k of Object.keys(node)) walk(node[k], fn, depth + 1);
    }
    const refsIn = text => { const out = new Set(); if (typeof text !== 'string' || !text.includes('idb:')) return out; for (const m of text.matchAll(/"src":"idb:([a-z0-9-]{6,80})"/g)) out.add(m[1]); return out; };
    function store(id, data) { if (cache.has(id) || pending.has(id)) { cache.set(id, data); return; } cache.set(id, data); pending.add(id); adapter.put(id, data).then(() => { pending.delete(id); }).catch(() => { pending.delete(id); failed++; if (onChange) onChange('fallo'); }); }
    const self = {
      hash, refsIn, KEYS,
      get available() { return available; },
      set onChange(fn) { onChange = fn; },
      /* Al guardar: las fotos grandes (data URL) se escriben en el almacén y el texto lleva solo la referencia. */
      packText(text) {
        if (!available || failed || typeof text !== 'string' || !text.includes('"src":"data:image/')) return text;
        let data; try { data = JSON.parse(text); } catch (e) { return text; }
        walk(data, it => { if (typeof it.src === 'string' && it.src.startsWith('data:image/') && it.src.length >= min) { const id = hash(it.src); store(id, it.src); it.src = 'idb:' + id; } }, 0);
        return JSON.stringify(data);
      },
      /* Al leer: las referencias vuelven a ser la foto completa; una referencia sin foto se descarta. */
      unpackText(text) {
        if (typeof text !== 'string' || !text.includes('"src":"idb:')) return text;
        let data; try { data = JSON.parse(text); } catch (e) { return text; }
        walk(data, it => { const m = REF.exec(it.src); if (!m) return; const full = cache.get(m[1]); if (full) it.src = full; else return null; }, 0);
        return JSON.stringify(data);
      },
      /* Arranque: con referencias guardadas, carga esas fotos antes de llamar a fn; sin ellas, llama a fn de inmediato. */
      boot(fn, read) {
        let ids = new Set(); try { KEYS.forEach(k => refsIn(read(k)).forEach(i => ids.add(i))); } catch (e) { /* sin acceso al almacenamiento */ }
        const go = () => { try { fn(); } catch (e) { setTimeout(() => { throw e; }); } };
        const ready = adapter.open().then(() => { available = true; });
        ready.then(() => setTimeout(() => self.gc(read), 4000)).catch(() => {});
        if (!ids.size) { ready.catch(() => {}); go(); return; }
        ready.then(() => adapter.getMany([...ids])).then(found => { Object.entries(found).forEach(([id, d]) => cache.set(id, d)); }).catch(() => {}).then(go);
      },
      /* Quita del almacén las fotos que ya no usa ningún borrador ni proyecto. */
      gc(read) {
        if (!available) return Promise.resolve(0);
        const used = new Set(); try { KEYS.forEach(k => refsIn(read(k)).forEach(i => used.add(i))); } catch (e) { return Promise.resolve(0); }
        return adapter.keys().then(keys => Promise.all(keys.filter(k => !used.has(k) && !pending.has(k)).map(k => adapter.del(k).then(() => { cache.delete(k); return 1; }).catch(() => 0)))).then(a => a.reduce((x, y) => x + y, 0)).catch(() => 0);
      },
      cacheSize: () => cache.size, pendingCount: () => pending.size
    };
    return self;
  }
  const api = { create, idbAdapter, hash, MIN, REF };
  let idb = null; try { idb = (typeof indexedDB !== 'undefined') ? indexedDB : null; } catch (e) { idb = null; }
  root.TintaStore = Object.assign(create(idbAdapter(idb)), api);
  if (typeof module !== 'undefined') module.exports = root.TintaStore;
})(typeof window !== 'undefined' ? window : globalThis);
