/* Pantallas de la app: además de «Inicio» (la que compones), Tinta genera las que enlaza la barra
   inferior —Explorar, Guardados y Perfil— con tus mismos bloques, tu paleta y contenido de tu idea.
   Además, las pantallas de recorrido (bienvenida, acceso, detalle, carrito, ¡listo!, ajustes y chat).
   Datos y reglas puras: crear.js dibuja, navega y exporta. */
(function (root) {
  'use strict';
  const IDS = ['inicio', 'explorar', 'guardados', 'perfil'];
  const LABELS = { inicio: 'Inicio', explorar: 'Explorar', guardados: 'Guardados', perfil: 'Perfil', bienvenida: 'Bienvenida', acceso: 'Acceso', detalle: 'Detalle', carrito: 'Carrito', listo: '¡Listo!', ajustes: 'Ajustes', chat: 'Chat' };
  /* Pantallas de recorrido (no están en la barra): se llega a ellas con botones (data-go) o tocando una tarjeta. */
  const FLOWS = ['bienvenida', 'acceso', 'detalle', 'carrito', 'listo', 'ajustes', 'chat'];
  const COMMERCE = ['comida', 'tienda', 'viajes'];
  const flowsFor = sectorId => FLOWS.filter(f => f !== 'carrito' || COMMERCE.includes(sectorId));
  /* Si el destino no existe en esta app, a dónde ir en su lugar. */
  const FALLBACK = { carrito: 'listo', listo: 'inicio', bienvenida: 'acceso', acceso: 'inicio', detalle: 'inicio', ajustes: 'perfil', chat: 'inicio', perfil: 'inicio', explorar: 'inicio', guardados: 'inicio' };
  function resolve(target, avail) { let t = target; for (let i = 0; i < 6 && t && !avail.includes(t); i++) t = FALLBACK[t] || 'inicio'; return avail.includes(t) ? t : 'inicio'; }
  const RULES = [
    ['inicio', /inicio|home|principal/], ['explorar', /explor|busc|descubr|search/],
    ['guardados', /guard|favorit|ideas|lista|saved|mis /], ['perfil', /perfil|cuenta|yo\b|profile|ajustes/]
  ];
  /* Qué pantalla abre cada botón de la barra. buttons: [{text, aria, cls}]. null = botón de acción (no navega). */
  function mapNav(buttons) {
    const out = buttons.map(b => {
      const label = (String(b.text || '') + ' ' + String(b.aria || '')).toLowerCase().trim();
      if (/\badd\b/.test(String(b.cls || '')) || /^(crear|añadir|nuevo|agregar)$/.test(String(b.aria || '').toLowerCase())) return { id: null, fixed: true };
      const hit = RULES.find(([, re]) => re.test(label));
      return { id: hit ? hit[0] : undefined, fixed: !!hit };
    });
    /* Botones sin texto (solo iconos): por posición entre las pantallas que aún no tiene ningún botón. */
    const used = new Set(out.filter(o => o.id).map(o => o.id)), free = IDS.filter(id => !used.has(id));
    return out.map(o => o.id === undefined ? (free.shift() || null) : o.id);
  }
  /* Plan de las pantallas generadas. ctx: { headerId, plainHeaderId, cardId, actionId, hasList, avatarId }.
     Cada elemento: { id, repeat, offset, role, screen } (offset desfasa el contenido para no repetir Inicio). */
  function plan(ctx) {
    const header = ctx.headerId ? [{ id: ctx.headerId, repeat: 1, offset: 0, role: 'header' }] : [];
    /* Guardados y Perfil no necesitan buscador: usan la cabecera sencilla si existe. */
    const plain = ctx.plainHeaderId ? [{ id: ctx.plainHeaderId, repeat: 1, offset: 0, role: 'header' }] : header;
    const card = n => ctx.cardId ? [{ id: ctx.cardId, repeat: n, offset: 3, role: 'cards' }] : [];
    /* El perfil no es el mismo en todas las apps: cada sector arma el suyo con piezas distintas
       (anillo y medidor de meta en fitness, cifras y movimientos en finanzas, portada y listas en música…). */
    const roleOf = id => /^(av-|lib-ava-)/.test(id) ? 'avatars' : /^pf-(aj-|editar|idioma)/.test(id) ? 'ajustes' : /^pf-/.test(id) ? 'perfil' : /^lib-lis-/.test(id) ? 'list' : 'widget';
    const opciones = PERFIL_BLOQUES[ctx.sectorId], sectorPerfil = opciones ? opciones[(ctx.semilla || 0) % opciones.length] : null;
    const perfilSector = sectorPerfil ? plain.concat(sectorPerfil.map(id => ({ id, repeat: 1, offset: 0, role: roleOf(id) })), ctx.actionId ? [{ id: ctx.actionId, repeat: 1, offset: 0, role: 'actions' }] : []) : null;
    return {
      explorar: header.concat(card(4)),
      guardados: plain.concat(ctx.cardId ? [{ id: ctx.cardId, repeat: 2, offset: 7, role: 'cards' }] : []),
      perfil: perfilSector || plain.concat((ctx.avatarId || ctx.hasAvatar) ? [{ id: ctx.avatarId || 'lib-ava-3', repeat: 1, offset: 0, role: 'avatars' }] : [], ctx.hasList ? [{ id: 'lib-lis-1', repeat: 1, offset: 0, role: 'list' }] : [], ctx.actionId ? [{ id: ctx.actionId, repeat: 1, offset: 0, role: 'actions' }] : [])
    };
  }
  /* Cada sector tiene dos perfiles; la idea (su «semilla») elige uno. Las piezas «pf-» son de «Perfil y ajustes». */
  const PERFIL_BLOQUES = {
    fitness: [['pf-tiles', 'w-semana', 'pf-aj-iconos'], ['av-anillo', 'w-gauge', 'w-semana', 'pf-aj-iconos']],
    finanzas: [['pf-saldo', 'lib-lis-2', 'pf-aj-simple'], ['pf-datos', 'r-stats3', 'pf-aj-iconos']],
    musica: [['pf-oscuro', 'lib-lis-3', 'pf-aj-iconos'], ['pf-bio', 'lib-lis-3', 'pf-aj-simple']],
    tienda: [['pf-portada', 'w-pasos', 'pf-aj-iconos'], ['pf-banda', 'pf-aj-atajos', 'pf-aj-simple']],
    comida: [['pf-banda', 'w-pasos', 'pf-aj-iconos'], ['pf-tiles', 'w-pasos', 'pf-aj-simple']],
    viajes: [['pf-bio', 'w-pasos', 'pf-aj-simple'], ['pf-portada', 'pf-aj-atajos', 'pf-aj-iconos']],
    salud: [['pf-datos', 'w-gauge', 'pf-aj-atajos'], ['pf-tiles', 'w-gauge', 'pf-aj-iconos']],
    educacion: [['pf-portada', 'w-gauge', 'pf-aj-atajos'], ['pf-oscuro', 'w-semana', 'pf-aj-iconos']]
  };
  /* Texto de la acción principal en cada pantalla generada. */
  const ACTION_TEXT = { explorar: null, guardados: null, perfil: 'Editar mi perfil' };
  root.TintaScreens = { PERFIL_BLOQUES, IDS, LABELS, FLOWS, COMMERCE, flowsFor, resolve, mapNav, plan, ACTION_TEXT };
  if (typeof module !== 'undefined') module.exports = root.TintaScreens;
})(typeof window !== 'undefined' ? window : globalThis);
