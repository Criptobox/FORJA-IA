/* Imagen de un componente de Tinta (SVG o PNG) a partir del contenido de su Shadow DOM.
   El SVG lleva el componente en un <foreignObject> (XHTML bien formado). Es inerte: se eliminan
   scripts, manejadores on* y enlaces javascript:, porque un SVG abierto suelto SÍ ejecutaría código.
   El PNG se genera dibujando ese mismo SVG en un canvas al doble de resolución. */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/1999/xhtml';
  const slug = s => String(s || 'diseno').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'diseno';
  /* Limpia y serializa HTML como XHTML. */
  function xhtml(inner) {
    const doc = new DOMParser().parseFromString('<!doctype html><body>' + inner + '</body>', 'text/html');
    doc.querySelectorAll('script,iframe,object,embed,link,meta,base,form').forEach(n => n.remove());
    doc.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => {
      const name = a.name.toLowerCase(), v = a.value.replace(/[\s\u0000-\u001f]/g, '').toLowerCase();
      if (name.startsWith('on') || ((name === 'href' || name === 'src' || name === 'xlink:href' || name === 'action') && /^(javascript|vbscript|data:text\/html)/.test(v))) n.removeAttribute(a.name);
    }));
    return new XMLSerializer().serializeToString(doc.body).replace(/^<body[^>]*>/, '').replace(/<\/body>$/, '');
  }
  /* shadowHtml: contenido del Shadow DOM (con su <style>). Devuelve { svg, w, h }. */
  function svg({ shadowHtml, width = 340, height = 200, bg = '#f3f1ed', pad = 24 }) {
    const body = xhtml('<div class="th" style="width:' + width + 'px">' + String(shadowHtml).replace(/:host\b/g, '.th') + '</div>');
    const w = width + pad * 2, h = height + pad * 2;
    return { w, h, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><rect width="100%" height="100%" rx="20" fill="' + bg + '"/><foreignObject x="' + pad + '" y="' + pad + '" width="' + width + '" height="' + height + '"><div xmlns="' + NS + '">' + body + '</div></foreignObject></svg>' };
  }
  const loadImage = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('imagen')); i.src = src; });
  async function png({ svg: text, w, h }) {
    const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text)), c = document.createElement('canvas'), k = 2;
    c.width = w * k; c.height = h * k; const g = c.getContext('2d'); g.scale(k, k); g.drawImage(img, 0, 0, w, h);
    return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('png')), 'image/png'));
  }
  root.TintaImage = { slug, xhtml, svg, png };
  if (typeof module !== 'undefined') module.exports = root.TintaImage;
})(typeof window !== 'undefined' ? window : globalThis);
