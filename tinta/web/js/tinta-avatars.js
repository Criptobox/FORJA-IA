/* Avatares: un personaje ilustrado por sector (chef, comprador, asesor, entrenadora, viajero, doctora, DJ, estudiante),
   con 4 tonos de piel y 4 de pelo que rotan por copia, y 6 diseños de perfil que los usan.
   Son SVG planos de 120×120 sin texto ni scripts; los colores de la ropa y el fondo toman tu paleta. */
const TINTA_AVATARS = (() => {
  const SK = ['#f3cba7', '#dca17a', '#b87a52', '#8a5636'], HAIR = ['#2b2118', '#5a3a22', '#c89b52', '#6e6e6e'];
  const HEX = /^#[0-9a-f]{6}$/i, DEF = { a: '#d98b5f', b: '#f3c9a5', i: '#4a3a2e', p: '#fff7ea' };
  const colors = c => ({ a: c && HEX.test(c.a) ? c.a : DEF.a, b: c && HEX.test(c.b) ? c.b : DEF.b, i: c && HEX.test(c.i) ? c.i : DEF.i, p: c && HEX.test(c.p) ? c.p : DEF.p });
  const short = h => `<path d="M36 54c0-19 11-30 24-30s24 11 24 30c-6-9-14-12-24-12s-18 3-24 12Z" fill="${h}"/>`;
  const bob = h => `<path d="M33 58c-4-27 12-36 27-36s31 9 27 36c-2-6-4-14-8-18-7 6-21 6-37 0-4 4-6 12-9 18Z" fill="${h}"/>`;
  /* Cada personaje: pelo/gorro (detrás de la cara) y accesorio delantero. */
  const CHAR = {
    chef: { top: h => short(h) + '<path d="M36 40c-5-11 4-19 13-15 4-8 18-8 22 0 9-4 18 4 13 15 0 4-2 6-4 7H40c-2-1-4-3-4-7Z" fill="#fff"/><rect x="40" y="43" width="40" height="7" rx="2" fill="#efede6"/>', front: () => '<path d="M45 90h30l5 30H40Z" fill="#fff" opacity=".92"/>' },
    shopper: { top: h => bob(h), front: c => `<path d="M80 100c2-9 14-9 16 0" fill="none" stroke="${c.i}" stroke-width="3"/><path d="M78 100h20l4 20H74Z" fill="${c.p}" stroke="${c.i}" stroke-width="2"/>` },
    business: { top: h => short(h), front: c => `<path d="M46 84l14 13 14-13-5-4H51Z" fill="#fff"/><path d="M56 88h8l3 14-7 10-7-10Z" fill="${c.i}"/>` },
    coach: { top: h => short(h) + '<rect x="35" y="40" width="50" height="8" rx="4" fill="#ff704b"/>', front: () => '' },
    traveler: { top: h => short(h) + '<ellipse cx="60" cy="38" rx="42" ry="9" fill="#e3b866"/><path d="M41 38c0-15 8-24 19-24s19 9 19 24Z" fill="#edc67a"/><rect x="41" y="33" width="38" height="5" fill="#c9553a"/>', front: c => `<path d="M42 90l6 30M78 90l-6 30" stroke="${c.i}" stroke-width="5" stroke-linecap="round"/>` },
    doctor: { top: h => bob(h), front: () => '<path d="M14 124c2-28 20-40 46-40s44 12 46 40H92L60 100 28 124Z" fill="#fff"/><path d="M45 92c0 14 8 20 16 20" fill="none" stroke="#243b44" stroke-width="3"/><circle cx="61" cy="112" r="4" fill="#5aa7a0"/>' },
    dj: { top: h => short(h), front: c => `<path d="M32 56a28 28 0 0 1 56 0" fill="none" stroke="${c.i}" stroke-width="6"/><rect x="26" y="52" width="12" height="20" rx="6" fill="${c.a}"/><rect x="82" y="52" width="12" height="20" rx="6" fill="${c.a}"/>` },
    student: { top: h => short(h), front: () => '<path d="M60 18 22 33l38 15 38-15Z" fill="#242421"/><path d="M44 44v8c0 5 7 8 16 8s16-3 16-8v-8l-16 6Z" fill="#33322d"/><path d="M96 35v18" stroke="#f0b94a" stroke-width="3" stroke-linecap="round"/><circle cx="96" cy="55" r="4" fill="#f0b94a"/>' }
  };
  const BY_SECTOR = { comida: 'chef', tienda: 'shopper', finanzas: 'business', fitness: 'coach', viajes: 'traveler', salud: 'doctor', musica: 'dj', educacion: 'student' };
  const shade = h => '#' + [1, 3, 5].map(k => Math.max(0, Math.round(parseInt(h.slice(k, k + 2), 16) * .86)).toString(16).padStart(2, '0')).join('');
  function person(kind, i, c) {
    const ch = CHAR[kind] || CHAR.business, sk = SK[((i % 4) + 4) % 4], hr = HAIR[((i + 1) % 4 + 4) % 4], k = colors(c);
    return `<svg viewBox="0 0 120 120" aria-hidden="true"><rect width="120" height="120" fill="${k.b}"/><path d="M14 124c2-28 20-40 46-40s44 12 46 40Z" fill="${k.a}"/><rect x="52" y="68" width="16" height="20" rx="6" fill="${shade(sk)}"/><circle cx="60" cy="54" r="24" fill="${sk}"/>${ch.top(hr)}<circle cx="51" cy="56" r="2.4" fill="#2b2118"/><circle cx="69" cy="56" r="2.4" fill="#2b2118"/><path d="M52 66q8 7 16 0" fill="none" stroke="#7a3a2a" stroke-width="2.4" stroke-linecap="round"/>${ch.front(k)}</svg>`;
  }
  /* SVG del avatar i-ésimo del sector (o null si no hay personaje para ese sector). */
  const pick = (sectorId, i, c) => BY_SECTOR[sectorId] ? person(BY_SECTOR[sectorId], i, c) : null;
  const defaultArt = k => person(k, 0, null);
  const A = k => defaultArt(k);
  const SOFT = 'background:linear-gradient(140deg,#fff,#f6f4ed);border:1px solid #fff;box-shadow:5px 8px 15px #514a3210;';
  const AV = (sz, ex = '') => `.av{position:relative;width:${sz}px;height:${sz}px;border-radius:50%;overflow:hidden;flex:none;${ex}}.av>svg{display:block;width:100%;height:100%;border-radius:50%}`;
  const BLOCKS = [
    { id: 'av-perfil', role: 'avatars', name: 'Perfil centrado', desc: 'Avatar grande, nombre, rol y tres cifras.', color: '#efe9dd', glyph: '◯',
      html: `<article class="prof"><div class="av">${A('business')}<i class="dot"></i></div><h2>Alex Rivera</h2><p>Cuenta Premium</p><div class="stats"><div><b>128</b><small>Pedidos</small></div><div><b>24</b><small>Favoritos</small></div><div><b>4.9</b><small>Valoración</small></div></div></article>`,
      css: `.prof{${SOFT}border-radius:28px;padding:22px 16px 18px;display:grid;justify-items:center;gap:6px;text-align:center}${AV(104, 'box-shadow:0 8px 18px #514a3224;border:3px solid #fff')}.dot{position:absolute;right:6px;bottom:8px;width:16px;height:16px;border-radius:50%;background:#2fbf71;border:3px solid #fff}.prof h2{font-size:20px;font-weight:600;letter-spacing:-.5px;margin-top:8px}.prof p{font-size:12px;color:#6f6a5c}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;margin-top:12px;padding-top:14px;border-top:1px solid #e7e3d8}.stats b{display:block;font-size:17px}.stats small{font-size:10px;color:#6f6a5c}` },
    { id: 'av-fila', role: 'avatars', name: 'Persona en fila', desc: 'Avatar pequeño, nombre, rol y botón de seguir.', color: '#e7e1f2', glyph: '◔',
      html: `<article class="row"><div class="av">${A('student')}</div><div class="mid"><h3>Marta Soler</h3><p>Profesora</p></div><button>Seguir</button></article>`,
      css: `.row{${SOFT}border-radius:22px;display:grid;grid-template-columns:52px 1fr auto;align-items:center;gap:12px;padding:12px 14px}${AV(52)}.mid h3{font-size:15px;font-weight:600;letter-spacing:-.3px}.mid p{font-size:11px;color:#6f6a5c;margin-top:2px}.row button{background:#242421;color:#fff;border-radius:999px;padding:9px 16px;font-size:11px;font-weight:600}` },
    { id: 'av-anillo', role: 'avatars', name: 'Con anillo y estado', desc: 'Anillo de color, punto de conexión y nombre.', color: '#f2e1d8', glyph: '◎',
      html: `<article class="ring"><div class="halo"><div class="av">${A('coach')}</div><i class="on"></i></div><h3>Diego Paz</h3><p>Entrenador</p></article>`,
      css: `.ring{${SOFT}border-radius:26px;padding:18px 14px;display:grid;justify-items:center;gap:4px;text-align:center}.halo{position:relative;width:96px;height:96px;border-radius:50%;padding:4px;background:conic-gradient(#ff704b,#ffb347,#ff704b)}.halo .av{width:100%;height:100%;border:3px solid #fff;box-sizing:border-box}${AV(88)}.on{position:absolute;right:4px;bottom:6px;width:16px;height:16px;border-radius:50%;background:#2fbf71;border:3px solid #fff}.ring h3{font-size:16px;font-weight:600;margin-top:8px}.ring p{font-size:11px;color:#6f6a5c}` },
    { id: 'av-grupo', role: 'avatars', name: 'Equipo apilado', desc: 'Cuatro avatares superpuestos y el resto del grupo.', color: '#e0eceb', glyph: '∴',
      html: `<article class="group"><div class="stack"><div class="av">${A('doctor')}</div><div class="av">${A('chef')}</div><div class="av">${A('dj')}</div><div class="av">${A('traveler')}</div><b>+12</b></div><div class="txt"><b>Tu equipo</b><small>16 personas conectadas</small></div></article>`,
      css: `.group{${SOFT}border-radius:24px;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px}.stack{display:flex;align-items:center}.stack .av{width:44px;height:44px;margin-left:-12px;border:3px solid #fff;box-sizing:border-box;border-radius:50%;overflow:hidden;flex:none;position:relative}.stack .av:first-child{margin-left:0}.av>svg{display:block;width:100%;height:100%;border-radius:50%}.stack b{margin-left:-12px;width:44px;height:44px;border-radius:50%;background:#242421;color:#fff;display:grid;place-items:center;font-size:12px;border:3px solid #fff;box-sizing:border-box}.txt{text-align:right}.txt b{display:block;font-size:14px;font-weight:600}.txt small{display:block;font-size:10px;color:#6f6a5c;margin-top:2px}` },
    { id: 'av-portada', role: 'avatars', name: 'Tarjeta con portada', desc: 'Portada de color con el avatar superpuesto y botón.', color: '#dfe8f3', glyph: '▭',
      html: `<article class="cover"><div class="banner"></div><div class="av">${A('traveler')}</div><div class="body"><h2>Lucía Vega</h2><p>Viajera frecuente</p><button>Ver perfil</button></div></article>`,
      css: `.cover{${SOFT}border-radius:28px;overflow:hidden;text-align:center}.banner{height:78px;background:linear-gradient(135deg,#0e7490,#34c3d9)}${AV(84, 'margin:-42px auto 0;border:4px solid #fff;box-sizing:border-box')}.body{padding:10px 16px 18px;display:grid;gap:4px;justify-items:center}.body h2{font-size:18px;font-weight:600;letter-spacing:-.4px}.body p{font-size:11px;color:#6f6a5c}.body button{margin-top:10px;background:#242421;color:#fff;border-radius:999px;padding:10px 22px;font-size:12px;font-weight:600}` },
    { id: 'av-iniciales', role: 'avatars', name: 'Monograma', desc: 'Iniciales en un círculo de color: sin foto ni ilustración.', color: '#ece9e1', glyph: 'Aa',
      html: `<article class="mono"><div class="ini">AL</div><div class="mid"><h3>Ana López</h3><p>Miembro desde 2024</p></div></article>`,
      css: `.mono{${SOFT}border-radius:22px;display:flex;align-items:center;gap:14px;padding:14px 16px}.ini{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#ff8a5c,#ffb08f);color:#2a1408;display:grid;place-items:center;font-weight:700;font-size:17px;letter-spacing:.5px;flex:none}.mid h3{font-size:15px;font-weight:600;letter-spacing:-.3px}.mid p{font-size:11px;color:#6f6a5c;margin-top:2px}` }
  ];
  BLOCKS.pick = pick; BLOCKS.BY_SECTOR = BY_SECTOR; BLOCKS.person = person; BLOCKS.colors = colors;
  return BLOCKS;
})();
