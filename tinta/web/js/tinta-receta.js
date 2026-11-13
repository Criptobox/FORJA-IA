/* Receta de pantalla: lo único que un modelo de IA (aunque sea gratis y pequeño) tiene que escribir.
   El modelo NO escribe HTML ni CSS: elige bloques, colores y letra del catálogo de Tinta y redacta algunos textos.
   La app valida la respuesta, repara lo que se pueda (falta cabecera o barra, ids inventados, copias de más) y arma la
   pantalla con sus propios bloques, así el diseño y el contraste salen siempre bien.
   · create(env) → { prompt(idea), parse(texto), fixPrompt(resultado), catalogText(idea) }
   Módulo puro (sin DOM ni red): env trae el catálogo (bloques, paletas, tipografías, fondos, plantillas, sectores). */
(function (root) {
  'use strict';
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const ROLE_NAME = { header: 'cabeceras', cards: 'tarjetas', actions: 'botones', nav: 'barras', data: 'datos', widgets: 'widgets', list: 'listas', forms: 'formularios', inputs: 'campos', notices: 'avisos' };
  const ROLE_CAP = { cards: 26, header: 14, nav: 14, actions: 8 }, DEF_CAP = 6;
  const MAX_BLOCKS = 14, MAX_TEXTS = 8, MAX_TEXT_LEN = 120;

  /* Saca el JSON de la respuesta de un chat: con o sin ```json, con texto alrededor, comillas tipográficas o comas sobrantes. */
  function extractJSON(text) {
    const src = String(text || '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    const cands = [];
    const fence = [...src.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/g)].map(m => m[1]);
    cands.push(...fence);
    for (let i = 0; i < src.length && cands.length < 8; i++) {   /* primer objeto con llaves equilibradas */
      if (src[i] !== '{') continue;
      let depth = 0, str = false, esc = false;
      for (let j = i; j < src.length; j++) {
        const c = src[j];
        if (str) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') str = false; continue; }
        if (c === '"') str = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) { cands.push(src.slice(i, j + 1)); i = j; break; }
      }
    }
    for (const c of cands) {
      const t = c.trim(); if (!t) continue;
      for (const v of [t, t.replace(/\/\/[^\n]*/g, '').replace(/,\s*([}\]])/g, '$1')]) {
        try { const o = JSON.parse(v); if (o && typeof o === 'object' && !Array.isArray(o)) return o; } catch (e) { /* siguiente intento */ }
      }
    }
    return null;
  }
  const pick = (o, names) => { for (const n of names) if (o[n] !== undefined && o[n] !== null) return o[n]; return undefined; };

  function create(env) {
    const blocks = env.blocks || [], byId = Object.fromEntries(blocks.map(b => [b.id, b]));
    const def = env.defaults || { header: 'h-minimal', nav: 'n-soft' };
    const idsOf = list => new Set((list || []).map(x => x.id));
    const palettes = idsOf(env.palettes), fonts = idsOf(env.fonts), bgs = idsOf(env.backgrounds);
    const sectorOf = idea => { const s = env.sectorOf ? env.sectorOf(idea) : null; return s && s.id ? s.id : null; };

    /* Bloques ordenados por relevancia para esta idea: los de plantillas del mismo sector, luego los que comparten palabras. */
    function ranked(idea) {
      const sec = sectorOf(idea), words = norm(idea).split(/[^a-z0-9]+/).filter(w => w.length > 3), used = new Map();
      (env.templates || []).forEach(t => { if (t.sector === sec) t.blocks.forEach(b => used.set(b.id, (used.get(b.id) || 0) + 1)); });
      const score = b => (used.get(b.id) || 0) * 10 + words.filter(w => norm(b.name + ' ' + (b.desc || '')).includes(w)).length * 3;
      return blocks.filter(b => b.role !== 'flow').map((b, i) => ({ b, s: score(b), i })).sort((x, y) => y.s - x.s || x.i - y.i).map(x => x.b);
    }
    function catalogText(idea) {
      const by = {}; ranked(idea).forEach(b => { (by[b.role] = by[b.role] || []).push(b); });
      const lines = [];
      ['header', 'cards', 'actions', 'nav'].concat(Object.keys(by).filter(r => !['header', 'cards', 'actions', 'nav', 'avatars', 'sheets'].includes(r))).forEach(r => {
        if (!by[r]) return; const cap = ROLE_CAP[r] || DEF_CAP;
        lines.push((ROLE_NAME[r] || r) + ': ' + by[r].slice(0, cap).map(b => b.id + '=' + String(b.name).slice(0, 34)).join('; '));
      });
      lines.push('paletas: ' + (env.palettes || []).map(p => p.id).join(', '));
      lines.push('tipografias: ' + (env.fonts || []).map(p => p.id).join(', '));
      lines.push('fondos: ' + (env.backgrounds || []).map(p => p.id).join(', '));
      return lines.join('\n');
    }
    function prompt(idea) {
      const brief = String(idea || '').trim().slice(0, 400) || 'Una app móvil';
      return [
        'Eres diseñador de interfaces. Diseña UNA pantalla de inicio de app móvil eligiendo piezas de un catálogo. NO escribas HTML ni CSS.',
        'IDEA: ' + brief,
        '',
        'CATÁLOGO (id=nombre). Usa SOLO estos ids:',
        catalogText(brief),
        '',
        'REGLAS',
        '- "bloques": de arriba abajo, entre 4 y ' + MAX_BLOCKS + '. Exactamente 1 cabecera primero, al menos 1 tarjeta, 1 barra al final.',
        '- Una tarjeta puede llevar "copias" de 2 a 6 para repetirla (lista de productos, platos, rutinas…).',
        '- Elige "paleta", "tipografia" y "fondo" que encajen con la idea (puedes poner null). "modo": "claro" u "oscuro".',
        '- "textos" es opcional: por id de bloque, hasta ' + MAX_TEXTS + ' frases cortas en español, en el orden en que aparecen (título, subtítulo, botón…).',
        '',
        'Responde SOLO con este JSON, sin explicación:',
        '{"idea":"…","bloques":[{"id":"…"},{"id":"…","copias":3},{"id":"…"}],"paleta":"…","tipografia":"…","fondo":null,"modo":"claro","textos":{"id-del-bloque":["Título","Subtítulo"]}}'
      ].join('\n');
    }

    /* Lee y valida la respuesta. ok=false solo si no hay nada aprovechable; todo lo demás se repara y se avisa. */
    function parse(text) {
      const warnings = [], errors = [], o = extractJSON(text);
      if (!o) return { ok: false, errors: ['No encontré un JSON en la respuesta. Pídele que responda solo con el JSON.'], warnings, recipe: null };
      const rawBlocks = pick(o, ['bloques', 'blocks', 'pantalla', 'screen']);
      if (!Array.isArray(rawBlocks) || !rawBlocks.length) return { ok: false, errors: ['Falta la lista «bloques» con los ids del catálogo.'], warnings, recipe: null };
      const out = [], seen = new Set();
      rawBlocks.slice(0, 40).forEach(rb => {
        const id = typeof rb === 'string' ? rb : rb && rb.id, rep = rb && typeof rb === 'object' ? pick(rb, ['copias', 'repeat', 'repetir']) : undefined;
        if (!byId[id]) { warnings.push('Id desconocido: «' + String(id).slice(0, 40) + '», se quitó.'); return; }
        if (seen.has(id)) { warnings.push('«' + id + '» estaba repetido, se dejó una vez.'); return; }
        seen.add(id); const item = { id };
        if (rep !== undefined) { const n = Math.round(Number(rep)); if (byId[id].role === 'cards' && n >= 2) item.repeat = Math.min(6, n); else if (n > 1) warnings.push('«' + id + '» no admite copias.'); }
        out.push(item);
      });
      if (!out.length) return { ok: false, errors: ['Ninguno de los ids de «bloques» existe en el catálogo.'], warnings, recipe: null };
      const role = x => byId[x.id].role, headers = out.filter(x => role(x) === 'header'), navs = out.filter(x => role(x) === 'nav');
      const body = out.filter(x => !['header', 'nav'].includes(role(x)));
      let header = headers[0], nav = navs[navs.length - 1];
      if (headers.length > 1) warnings.push('Había ' + headers.length + ' cabeceras; se dejó la primera.');
      if (navs.length > 1) warnings.push('Había ' + navs.length + ' barras; se dejó la última.');
      if (!header && byId[def.header]) { header = { id: def.header }; warnings.push('No había cabecera; se añadió una sencilla.'); }
      if (!nav && byId[def.nav]) { nav = { id: def.nav }; warnings.push('No había barra inferior; se añadió una.'); }
      if (!body.some(x => role(x) === 'cards')) return { ok: false, errors: ['Faltan tarjetas: añade al menos un bloque de tarjetas.'], warnings, recipe: null };
      const finalBlocks = [header, ...body.slice(0, MAX_BLOCKS - 2), nav].filter(Boolean);
      if (body.length > MAX_BLOCKS - 2) warnings.push('Demasiados bloques; se dejaron ' + (MAX_BLOCKS - 2) + '.');
      const r = { brief: String(pick(o, ['idea', 'brief', 'descripcion']) || '').replace(/[<>]/g, '').trim().slice(0, 200), blocks: finalBlocks };
      const optional = (names, set, label) => { const v = pick(o, names); if (v === undefined || v === null || v === '' || v === 'null') return null; if (set.has(v)) return v; warnings.push(label + ' «' + String(v).slice(0, 40) + '» no existe; se ignoró.'); return null; };
      const pal = optional(['paleta', 'palette'], palettes, 'La paleta'), fnt = optional(['tipografia', 'fuente', 'font'], fonts, 'La tipografía'), bg = optional(['fondo', 'background'], bgs, 'El fondo');
      if (pal) r.palette = pal; if (fnt) r.font = fnt; if (bg) r.background = bg;
      const m = norm(pick(o, ['modo', 'mode']));
      if (m === 'oscuro' || m === 'dark') r.mode = 'dark'; else if (m === 'claro' || m === 'light') r.mode = 'light';
      const texts = pick(o, ['textos', 'content', 'texts']);
      if (texts && typeof texts === 'object' && !Array.isArray(texts)) {
        const tx = {}; Object.keys(texts).forEach(id => {
          if (!seen.has(id) || !Array.isArray(texts[id])) { warnings.push('Textos de «' + id.slice(0, 40) + '» ignorados: ese bloque no está en la pantalla.'); return; }
          const arr = texts[id].filter(v => typeof v === 'string' || typeof v === 'number').slice(0, MAX_TEXTS).map(v => String(v).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LEN));
          if (arr.some(Boolean)) tx[id] = arr;
        });
        if (Object.keys(tx).length) r.texts = tx;
      }
      const sec = sectorOf(r.brief + ' ' + (pick(o, ['sector']) || '')); if (sec) r.sector = sec;
      return { ok: true, errors, warnings, recipe: r };
    }
    /* Mensaje corto para pegarlo al chat cuando la respuesta no sirvió. */
    function fixPrompt(res) {
      const list = (res && res.errors && res.errors.length ? res.errors : (res && res.warnings) || []).slice(0, 6).map(e => '- ' + e).join('\n');
      return 'Tu respuesta no se pudo usar:\n' + (list || '- No era un JSON válido.') + '\nResponde otra vez SOLO con el JSON corregido (sin explicación), usando solo ids del catálogo.';
    }
    /* La receta como plantilla de Tinta: la app la aplica igual que cualquier plantilla. */
    function toTemplate(r) {
      return { id: 'receta-ia', sector: r.sector || null, name: 'Pantalla con IA', brief: r.brief, blocks: r.blocks.map(b => b.repeat ? { id: b.id, repeat: b.repeat } : { id: b.id }), palette: r.palette, font: r.font, background: r.background, mode: r.mode, texts: r.texts };
    }
    /* Instrucciones fijas del chat de diseño: conversar y, cuando piden crear o cambiar una pantalla, devolver la receta. */
    function chatSystem(idea, current) {
      return [
        'Eres el asistente de diseño de Estilos Tinta, una herramienta que arma apps móviles con piezas de un catálogo. Hablas en español, claro y breve (máximo 4 frases).',
        'Si la persona pide crear o cambiar una app o pantalla, responde con una frase corta y UN bloque ```json con la receta (formato abajo). Si solo conversa o pregunta, responde sin JSON. No escribas HTML ni CSS.',
        '',
        'CATÁLOGO (id=nombre). Usa SOLO estos ids:',
        catalogText(String(idea || '')),
        '',
        'REGLAS DE LA RECETA',
        '- "bloques": de arriba abajo, entre 4 y ' + MAX_BLOCKS + '. Exactamente 1 cabecera primero, al menos 1 tarjeta, 1 barra al final.',
        '- Una tarjeta puede llevar "copias" de 2 a 6.',
        '- "paleta", "tipografia" y "fondo" del catálogo (o null). "modo": "claro" u "oscuro".',
        '- "textos" es opcional: por id de bloque, hasta ' + MAX_TEXTS + ' frases cortas en español.',
        '- Al cambiar una pantalla, devuelve la receta COMPLETA con el cambio aplicado.',
        'Formato: {"idea":"…","bloques":[{"id":"…"},{"id":"…","copias":3}],"paleta":"…","tipografia":"…","fondo":null,"modo":"claro","textos":{"id-del-bloque":["Título"]}}',
        current ? '\nPANTALLA ACTUAL DE LA PERSONA: ' + String(current).slice(0, 400) : ''
      ].join('\n').trim();
    }
    return { prompt, parse, fixPrompt, catalogText, toTemplate, chatSystem };
  }
  const api = { create, extractJSON };
  root.TintaReceta = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
