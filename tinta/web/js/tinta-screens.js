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
    return {
      explorar: header.concat(card(4)),
      guardados: plain.concat(ctx.cardId ? [{ id: ctx.cardId, repeat: 2, offset: 7, role: 'cards' }] : []),
      perfil: plain.concat((ctx.avatarId || ctx.hasAvatar) ? [{ id: ctx.avatarId || 'lib-ava-3', repeat: 1, offset: 0, role: 'avatars' }] : [], ctx.hasList ? [{ id: 'lib-lis-1', repeat: 1, offset: 0, role: 'list' }] : [], ctx.actionId ? [{ id: ctx.actionId, repeat: 1, offset: 0, role: 'actions' }] : [])
    };
  }
  /* Texto de la acción principal en cada pantalla generada. */
  const ACTION_TEXT = { explorar: null, guardados: null, perfil: 'Editar mi perfil' };
  root.TintaScreens = { IDS, LABELS, FLOWS, COMMERCE, flowsFor, resolve, mapNav, plan, ACTION_TEXT };
  if (typeof module !== 'undefined') module.exports = root.TintaScreens;
})(typeof window !== 'undefined' ? window : globalThis);
