/* Novena tanda: app de mascotas en turquesa (zip «estilos completos», perro sobre fondo turquesa): cabecera con perro y aviso,
   pestañas Accesorios/Amigos, tarjetas de amigos con nombre, datos de la mascota y barra de cuatro botones redondos.
   5 bloques (1 cabecera, 1 barra y 3 tarjetas). Tres perros dibujados en SVG propio (TintaArt), sin fotos. Colores propios (noDark). */
const TINTA_REFS9 = (() => {
  const I = (n, s = 18) => (typeof ic === 'function' ? ic(n, s) : '');
  const art = k => (typeof TintaArt !== 'undefined' && TintaArt.get(k)) || '<svg viewBox="0 0 240 140" aria-hidden="true"><rect width="240" height="140" fill="#12bfa9"/></svg>';
  const T = '#0a7f72', TL = '#12bfa9', INK = '#12302c';
  const MEDIA = '.media{overflow:hidden;display:block}.media>svg{width:100%;height:100%;display:block}';
  const PAW = s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="6.5" cy="10" rx="2.1" ry="2.8"/><ellipse cx="17.5" cy="10" rx="2.1" ry="2.8"/><ellipse cx="10" cy="5.8" rx="2" ry="2.7"/><ellipse cx="14" cy="5.8" rx="2" ry="2.7"/><path d="M12 11c-3.4 0-6 3.1-6 5.6 0 1.8 1.4 2.6 3 2.6 1 0 1.9-.4 3-.4s2 .4 3 .4c1.6 0 3-.8 3-2.6 0-2.5-2.6-5.6-6-5.6Z"/></svg>`;
  const BLOCKS = [
    { id: 'n-ma-circulos', role: 'nav', noDark: true, name: 'Cuatro botones redondos', desc: 'Cuatro círculos flotantes: añadir en turquesa, favoritos, mascotas y perfil.', color: '#12bfa9', glyph: '○○',
      html: `<nav class="nav nr"><button class="on" aria-label="Añadir">${I('plus', 24)}</button><button aria-label="Favoritos">${I('heart', 22)}</button><button aria-label="Mascotas">${PAW(22)}</button><button aria-label="Perfil">${I('user', 22)}</button></nav>`,
      css: `.nr{display:flex;justify-content:space-between;gap:10px}.nr button{flex:1;aspect-ratio:1/1;max-width:62px;border-radius:50%;background:#fff;color:${INK};display:grid;place-items:center;box-shadow:0 14px 24px -12px #0a7f7299}.nr .on{background:${T};color:#fff}` },
    { id: 'r-ma-hero', role: 'header', keepArt: true, noDark: true, fixed: true, name: 'Cabecera con perro', desc: 'Perro grande sobre turquesa con aviso redondo y el nombre de la mascota.', color: '#12bfa9', glyph: '🐶',
      html: `<header class="hr"><div class="media">${art('dogwhite')}</div><button class="bl" aria-label="Avisos">${I('bell', 20)}<i></i></button><span class="nm">${I('face', 18)}<b>Tom</b></span></header>`,
      css: `.hr{position:relative;border-radius:30px;overflow:hidden;background:linear-gradient(160deg,${TL},#0b8f80);height:250px;box-shadow:0 18px 30px -16px #0a7f72cc}${MEDIA}.media{position:absolute;inset:18px 0 0 0}.media svg{transform:translate(16%,-6%) scale(1.22)}.bl{position:absolute;left:14px;top:14px;width:46px;height:46px;border-radius:50%;background:#fff;color:${INK};display:grid;place-items:center}.bl i{position:absolute;right:2px;bottom:2px;width:13px;height:13px;border-radius:50%;background:${TL};border:2px solid #fff}.nm{position:absolute;left:14px;bottom:14px;display:inline-flex;align-items:center;gap:10px;background:#fff;color:${INK};border-radius:99px;padding:9px 22px 9px 14px;font-size:16px}` },
    { id: 'r-ma-pestanas', role: 'cards', noDark: true, fixed: true, keepButtons: true, name: 'Pestañas de la mascota', desc: 'Dos pastillas grandes: Accesorios en turquesa y Amigos en blanco.', color: '#d6f4ef', glyph: '◖◗',
      html: `<article class="pt"><button class="on">ACCESORIOS</button><button>AMIGOS</button></article>`,
      css: `.pt{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pt button{border-radius:99px;padding:14px;font-size:13px;font-weight:800;letter-spacing:.3px;background:#fff;color:${INK};box-shadow:0 10px 18px -12px #0a7f7288}.pt .on{background:${T};color:#fff}` },
    { id: 'r-ma-amigo', role: 'cards', noDark: true, name: 'Amigo con nombre', desc: 'Perro sobre turquesa con una etiqueta con su nombre.', color: '#12bfa9',
      glyph: '◐', artKeys: ['doggolden', 'dogmaltese', 'dogwhite', 'doggolden'],
      copies: [['Jack'], ['Poppy'], ['Luna'], ['Max']],
      html: `<article class="am"><div class="media">${art('doggolden')}</div><span class="tg">${I('face', 14)}<b>Jack</b></span></article>`,
      css: `.am{position:relative;border-radius:28px;overflow:hidden;background:linear-gradient(160deg,${TL},#0b8f80);aspect-ratio:1/1.05;box-shadow:0 14px 24px -14px #0a7f72cc}${MEDIA}.media{position:absolute;inset:8px 0 22px 0}.media svg{transform:scale(1.15)}.tg{position:absolute;left:10px;right:10px;bottom:10px;display:flex;align-items:center;justify-content:center;gap:6px;background:${T};color:#fff;border-radius:99px;padding:7px 10px;font-size:12.5px}` },
    { id: 'r-ma-datos', role: 'cards', keepArt: true, noDark: true, fixed: true, name: 'Datos de la mascota', desc: 'Nombre, raza y tres datos: edad, peso y vacunas.', color: '#d6f4ef', glyph: '☰',
      html: `<article class="dm"><div class="tp"><div><h2>Tom</h2><small>Samoyedo · macho</small></div><span class="av">${PAW(22)}</span></div><div class="gr">${[['Edad', '3 años'], ['Peso', '24 kg'], ['Vacunas', 'Al día']].map(([t, v]) => `<div><small>${t}</small><b>${v}</b></div>`).join('')}</div></article>`,
      css: `.dm{background:#fff;border-radius:26px;padding:16px;display:grid;gap:12px;box-shadow:0 14px 24px -18px #0a7f7299}.tp{display:flex;justify-content:space-between;align-items:center}.tp h2{font-size:22px;letter-spacing:-.6px;color:${INK}}.tp small{font-size:12px;color:#4f6a66}.av{width:44px;height:44px;border-radius:50%;background:#d6f4ef;color:${T};display:grid;place-items:center}.gr{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.gr div{background:#eef9f7;border-radius:16px;padding:10px;display:grid;gap:2px}.gr small{font-size:11px;color:#4f6a66}.gr b{font-size:14px;color:${INK}}` }
  ];
  return BLOCKS;
})();
