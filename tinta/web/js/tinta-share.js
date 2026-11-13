/* Compartir una pantalla de Tinta con un enlace.
   El borrador va comprimido (deflate) y codificado en base64url dentro del «#»: el fragmento
   no se envía a ningún servidor. Las imágenes subidas NO viajan (pesan demasiado); para eso
   están «Descargar JSON» y las copias de seguridad. Formato: #t1=… (comprimido) · #t0=… (sin comprimir). */
(function (root) {
  'use strict';
  const MAX_JSON = 3000000;           /* tope tras descomprimir: evita enlaces que se expanden sin control */
  const LONG_LINK = 6000;             /* por encima, muchas apps de mensajería recortan el enlace */
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64 = t => { const s = atob(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4)); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  async function read(stream, cap) {
    const rd = stream.getReader(), parts = []; let n = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; n += value.length; if (cap && n > cap) { try { rd.cancel(); } catch (e) { /* ignorar */ } throw new Error('demasiado grande'); } parts.push(value); }
    const out = new Uint8Array(n); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; }); return out;
  }
  /* Solo lo que define la pantalla; nunca imágenes (assets). */
  const pick = d => ({ brief: d.brief, selected: d.selected, choices: d.choices, content: d.content, repeat: d.repeat, motion: d.motion, palette: d.palette, visual: d.visual, background: d.background, mode: d.mode, navStyle: d.navStyle, font: d.font, multi: d.multi, flows: d.flows, ui: d.ui, buttonStyles: d.buttonStyles, cardStyles: d.cardStyles, assets: {} });
  async function encode(draft) {
    const raw = new TextEncoder().encode(JSON.stringify(pick(draft)));
    if (typeof CompressionStream !== 'function') return { code: 't0=' + b64(raw), compressed: false };
    const cs = new CompressionStream('deflate-raw'), w = cs.writable.getWriter(); w.write(raw); w.close();
    return { code: 't1=' + b64(await read(cs.readable)), compressed: true };
  }
  const isShareHash = h => /^#t[01]=[A-Za-z0-9_-]+$/.test(h || '');
  async function decode(hash) {
    const m = /^#(t[01])=([A-Za-z0-9_-]+)$/.exec(hash || ''); if (!m) return null;
    const bytes = unb64(m[2]);
    let text;
    if (m[1] === 't0') { if (bytes.length > MAX_JSON) throw new Error('demasiado grande'); text = new TextDecoder().decode(bytes); }
    else {
      if (typeof DecompressionStream !== 'function') throw new Error('sin descompresión');
      const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter();
      w.write(bytes).catch(() => {}); w.close().catch(() => {});
      text = new TextDecoder().decode(await read(ds.readable, MAX_JSON));
    }
    const obj = JSON.parse(text); return obj && typeof obj === 'object' ? obj : null;
  }
  root.TintaShare = { encode, decode, isShareHash, LONG_LINK };
  if (typeof module !== 'undefined') module.exports = root.TintaShare;
})(typeof window !== 'undefined' ? window : globalThis);
