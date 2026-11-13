/* Equipo de diseño: ocho especialistas que trabajan tu idea paso a paso y te enseñan lo que decidió cada uno.
   Motor local (reglas de Tinta) con la IA conectada como opción: si hay una, propone la estructura; si no, lo hace Tinta.
   · plan(env, idea)        → versión del equipo (A), versión del Crítico (B) y las objeciones, con razones reales.
   · mount(host)            → pantalla animada: cada agente muestra lo que hizo de verdad (pantallas, bloques, paleta,
                              textos, contrastes corregidos, tamaño del HTML) y al final eliges Equipo, Mezclar o Crítico.
   El motor no toca el DOM; la pantalla solo existe en mount(). */
(function (root) {
  'use strict';
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const SECTOR_PALETTE = { comida: 'mandarina', tienda: 'lavanda', finanzas: 'azul-cobalto', fitness: 'aqua', viajes: 'cielo', salud: 'aqua', musica: 'amatista', educacion: 'azul-cobalto' };
  const SECTOR_FONT = { comida: 'redondeada', finanzas: 'geometrica', musica: 'geometrica', educacion: 'humanista', viajes: 'humanista' };

  /* ───────── Los ocho especialistas ───────── */
  const AGENTS = [
    { role: 'research', n: 'El Investigador', c: '#3b6cf0', col: '#4d7cff', m: 'feliz', work: 'Leyendo tu idea y detectando el sector' },
    { role: 'architect', n: 'El Arquitecto', c: '#e2832d', col: '#ff8a2a', m: 'calma', work: 'Decidiendo qué pantallas necesita' },
    { role: 'ux', n: 'El Diseñador UX', c: '#d49b00', col: '#f2c230', m: 'picaro', work: 'Eligiendo los bloques de «Inicio»' },
    { role: 'ui', n: 'El Diseñador UI', c: '#8a4be0', col: '#a366f0', m: 'feliz', work: 'Probando paletas y tipografías' },
    { role: 'writer', n: 'El UX Writer', c: '#239950', col: '#3ec46d', m: 'calma', work: 'Escribiendo los textos de cada pantalla' },
    { role: 'a11y', n: 'Accesibilidad', c: '#d24545', col: '#ee5a5a', m: 'triste', work: 'Midiendo contrastes' },
    { role: 'dev', n: 'Frontend Dev', c: '#118f88', col: '#2cc2b8', m: 'feliz', work: 'Preparando el código' },
    { role: 'critic', n: 'El Crítico', c: '#e27416', col: '#8f8f99', m: 'picaro', hat: 1, work: 'Buscando qué mejorar' }
  ];

  /* ───────── Motor ───────── */
  function rankTemplates(env, idea, sectorId) {
    const words = new Set(norm(idea).split(/[^a-z0-9]+/).filter(w => w.length > 3));
    const ok = env.templates.filter(t => !env.problems(t).length);
    const pool = sectorId ? ok.filter(t => t.sector === sectorId) : ok;
    const score = t => norm(t.name + ' ' + t.desc + ' ' + t.brief).split(/[^a-z0-9]+/).filter(w => words.has(w)).length;
    return (pool.length ? pool : ok).map((t, k) => ({ t, k, s: score(t) })).sort((a, b) => b.s - a.s || a.k - b.k).map(x => x.t);
  }
  const palOf = (env, id) => env.palettes.find(p => p.id === id) || null;
  const fontOk = (env, id) => !!id && env.fonts.some(f => f.id === id);
  const homeLength = t => t.blocks.reduce((n, b) => n + (b.repeat || 1), 0);

  function plan(env, idea, aiTemplate) {
    const sector = env.sectorOf(idea), sid = sector ? sector.id : null, ranked = rankTemplates(env, idea, sid);
    const base = aiTemplate || ranked[0];
    const defPal = palOf(env, base.palette) || palOf(env, SECTOR_PALETTE[sid]) || env.palettes.find(p => !p.dark) || env.palettes[0];
    const font = fontOk(env, base.font) ? base.font : (fontOk(env, SECTOR_FONT[sid]) ? SECTOR_FONT[sid] : 'jakarta');
    const A = { id: 'equipo-a', sector: sid, name: base.name || 'Pantalla del equipo', brief: String(idea || '').trim() || base.brief, blocks: base.blocks.map(b => ({ ...b })), palette: defPal.id, font, background: base.background || null, mode: base.mode || null, texts: base.texts, fromRecipe: true, keepBrief: true };
    /* El Crítico: busca lo típico, lo largo y lo repetido, y propone otra versión. */
    const dark = !!defPal.dark || A.mode === 'dark', points = [], B = { ...A, id: 'equipo-b', blocks: A.blocks.map(b => ({ ...b })) };
    const header = B.blocks.find(b => env.roleOf(b.id) === 'header');
    if (header && /search|buscar/.test(header.id) && env.byId['h-minimal']) { B.blocks[B.blocks.indexOf(header)] = { id: 'h-minimal' }; points.push('la cabecera con buscador es la típica' + (sector ? ' de ' + norm(sector.name).split(' ')[0] : '')); }
    if (SECTOR_PALETTE[sid] === defPal.id) points.push('la paleta ' + defPal.name + ' es la que usa casi todo el sector');
    if (homeLength(A) > 6) { B.blocks.forEach(b => { if (b.repeat > 2) b.repeat = 2; }); points.push('la pantalla de Inicio es larga (' + homeLength(A) + ' bloques)'); }
    const fam = env.family(defPal), alt = env.palettes.filter(p => !!p.dark === !dark && p.id !== defPal.id), pick = alt.find(p => env.family(p) === fam) || alt[0] || defPal;
    B.palette = pick.id; B.mode = dark ? 'light' : 'dark'; B.font = A.font === 'editorial' ? 'jakarta' : 'editorial';
    if (!points.length) points.push('las dos opciones de color más parecidas que tiene el sector son demasiado seguras');
    const critique = 'No estoy de acuerdo: ' + points.slice(0, 2).join(' y ') + '. Te propongo una versión ' + (dark ? 'clara' : 'oscura') + (header && B.blocks[0].id !== header.id ? ' con cabecera simple' : '') + '.';
    /* Mezclar: la estructura del equipo con el estilo del Crítico. */
    const M = { ...A, id: 'equipo-m', blocks: A.blocks.map(b => ({ ...b })), palette: B.palette, mode: B.mode, font: B.font };
    return { sector, sid, A, B, M, critique, affine: ranked.length, aiUsed: !!aiTemplate };
  }

  /* ───────── Pantalla ───────── */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function mount(host) {
    const dlg = host.dialog; let state = null, timer = null, speed = 1, paused = false, step = 0, mode = 1, toastT = 0;
    const Art = root.TintaEquipoArt;
    dlg.innerHTML = '<main class="app"><div class="aura" id="eqAura"></div><div class="top"><div class="header-row"><span class="eyebrow">Estudio en vivo</span><div class="controls"><button type="button" class="pill-btn" data-eq="pause">Ⅱ Pausar</button><button type="button" class="pill-btn" data-eq="speed">⚡ 1x</button><button type="button" class="pill-btn" data-eq="replay">↻ Repetir</button><button type="button" class="pill-btn" data-eq="close" aria-label="Cerrar">✕</button></div></div><h1>Tu app, en equipo</h1><div class="idea"><span class="idea-icon">💬</span><div><b>Idea:</b> <span id="eqIdea"></span></div></div><div class="progress-wrap"><div class="bar" role="progressbar" aria-label="Progreso del equipo" aria-valuemin="0" aria-valuemax="8" aria-valuenow="0"><i id="eqBar"></i></div><div class="meta"><span id="eqM1" aria-live="polite">Iniciando…</span><span id="eqM2">0 de 8</span></div></div></div><div class="team-heading"><div><span class="section-kicker">Workspace en vivo</span><h2>Equipo creativo</h2></div><span class="live-tag"><i></i> 8 especialistas</span></div><section class="team" id="eqTeam" aria-label="Actividad de los ocho especialistas"><div class="spine-track"><div class="spine-fill" id="eqSpine"></div></div></section><section class="choose" id="eqChoose"><div class="seg" id="eqSeg"><div class="seg-pill" id="eqPill"></div><button type="button" data-idx="0">Equipo</button><button type="button" data-idx="1" class="on">Mezclar</button><button type="button" data-idx="2">Crítico</button></div><div class="ab"><div class="ver active" id="eqCardA" data-mode="0" role="button" tabindex="0"><b>Versión del equipo <span>☀️</span></b><div class="sw" id="eqSwA"></div><div class="skel" id="eqSkA"><u></u><u></u><u></u><u></u></div><span id="eqTxtA"></span></div><div class="ver active" id="eqCardB" data-mode="2" role="button" tabindex="0"><b>Versión del Crítico <span>🌙</span></b><div class="sw" id="eqSwB"></div><div class="skel" id="eqSkB"><u></u><u></u><u></u><u></u></div><span id="eqTxtB"></span></div></div><button type="button" class="go" id="eqGo"></button><p class="demo-note" id="eqNote"></p></section><div class="toast" id="eqToast" role="status" aria-live="polite"></div></main>';
    const $ = id => dlg.querySelector('#' + id), team = $('eqTeam');
    AGENTS.forEach((a, i) => {
      const d = document.createElement('article'); d.className = 'ag wait'; d.dataset.role = a.role; d.id = 'eqA' + i; d.style.setProperty('--c', a.c); d.style.animationDelay = (i * 0.06) + 's';
      d.innerHTML = '<div class="av">' + Art.cubo(a.col, a.m, a.hat, a.role) + '</div><div class="ag-body"><h3><span class="ag-title">' + (i + 1) + '. ' + a.n + '</span><span class="chip">En espera</span></h3><p></p></div>';
      d.addEventListener('pointermove', e => { const r = d.getBoundingClientRect(); d.style.setProperty('--ry', (((e.clientX - r.left) / r.width - .5) * 8).toFixed(2) + 'deg'); d.style.setProperty('--rx', ((-((e.clientY - r.top) / r.height - .5)) * 8).toFixed(2) + 'deg'); });
      d.addEventListener('pointerleave', () => { d.style.setProperty('--ry', '0deg'); d.style.setProperty('--rx', '0deg'); });
      team.appendChild(d);
    });
    const toast = msg => { const t = $('eqToast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800); };
    const aura = c => $('eqAura').style.setProperty('--active-glow', c);

    function setAgent(i, st) {
      const d = $('eqA' + i), a = AGENTS[i], rep = state.report[i], was = d.classList.contains('done'), chip = d.querySelector('.chip'), p = d.querySelector('p');
      d.className = 'ag ' + st; if (st === 'disagree') d.classList.add('done');
      if (st === 'wait') { chip.className = 'chip'; chip.textContent = 'En espera'; p.textContent = ''; }
      if (st === 'work') { chip.className = 'chip'; chip.innerHTML = 'Trabajando<span class="dots"><i></i><i></i><i></i></span>'; p.innerHTML = esc(rep.work || a.work) + '<div class="mini"><i></i></div>'; aura(a.c + '38'); }
      if (st === 'done') { chip.className = 'chip'; chip.textContent = '✓ Listo'; if (!was) { d.classList.add('just-done'); chip.classList.add('pop'); setTimeout(() => d.classList.remove('just-done'), 700); } p.innerHTML = '<span class="out">' + esc(rep.out) + '</span>'; }
      if (st === 'disagree') { chip.className = 'chip pop'; chip.textContent = '⚡ Opina distinto'; p.innerHTML = '<span class="out">' + esc(rep.out) + '</span><div class="say">' + esc(state.plan.critique) + '</div>'; aura('#e2741640'); }
    }
    function show(n) {
      step = n; AGENTS.forEach((a, i) => setAgent(i, i < n ? (i === 7 ? 'disagree' : 'done') : i === n && n < 8 ? 'work' : 'wait'));
      const pct = Math.min(n, 8) / 8 * 100; $('eqBar').style.width = pct + '%'; $('eqSpine').style.height = pct + '%'; $('eqM2').textContent = Math.min(n, 8) + ' de 8'; dlg.querySelector('.bar').setAttribute('aria-valuenow', String(Math.min(n, 8)));
      $('eqM1').textContent = n >= 8 ? '✨ Equipo terminado' : 'Trabajando en equipo…'; if (n >= 8) aura('rgba(255, 98, 59, 0.25)');
      $('eqChoose').classList.toggle('on', n >= 8); if (n >= 8) setTimeout(() => $('eqChoose').scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 250);
    }
    function tick() { if (timer) clearInterval(timer); timer = null; if (paused || step >= 8) return; timer = setInterval(() => { show(step + 1); if (step >= 8) { clearInterval(timer); timer = null; } }, speed === 1 ? 1850 : 900); }
    const sw = (id, p) => { $(id).innerHTML = [p.bg, p.surface, p.accent, p.accent2, p.ink].map(c => '<i style="background:' + c + '"></i>').join(''); };
    const sk = (id, p) => { const e = $(id); e.style.setProperty('--bgv', p.bg); e.style.setProperty('--cv', p.line); e.style.setProperty('--sv', p.surface); e.style.setProperty('--av', p.accent); };
    const CTA = ['Crear mi app con la versión del equipo', 'Crear mi app (mezcla recomendada)', 'Crear mi app con la versión del Crítico'];
    function select(idx) {
      mode = idx; dlg.querySelectorAll('#eqSeg button').forEach((b, i) => b.classList.toggle('on', i === idx)); $('eqPill').style.transform = 'translateX(' + (idx * 100) + '%)'; $('eqGo').innerHTML = CTA[idx] + ' <span aria-hidden="true">↗</span>';
      $('eqCardA').classList.toggle('active', idx !== 2); $('eqCardA').classList.toggle('dimmed', idx === 2); $('eqCardB').classList.toggle('active', idx !== 0); $('eqCardB').classList.toggle('dimmed', idx === 0);
    }
    function confetti(x, y) {
      const cols = ['#ff623b', '#ff9a6c', '#3b6cf0', '#239950', '#f2c230', '#a366f0'];
      for (let i = 0; i < 28; i++) { const el = document.createElement('div'); el.className = 'confetti'; el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.background = cols[i % cols.length]; dlg.appendChild(el); const ang = Math.PI * 2 * i / 28, v = 60 + Math.random() * 100;
        el.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + Math.cos(ang) * v + 'px,' + (Math.sin(ang) * v + 80) + 'px) scale(.4)', opacity: 0 }], { duration: 800 + Math.random() * 300, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' }).onfinish = () => el.remove(); }
    }
    function start() { paused = false; dlg.querySelector('[data-eq=pause]').textContent = 'Ⅱ Pausar'; show(0); tick(); }
    function load(plan, report) {
      state = { plan, report }; $('eqIdea').textContent = plan.A.brief; const pa = host.palette(plan.A.palette), pb = host.palette(plan.B.palette);
      sw('eqSwA', pa); sk('eqSkA', pa); sw('eqSwB', pb); sk('eqSkB', pb); $('eqTxtA').textContent = report.metrics.A; $('eqTxtB').textContent = report.metrics.B;
      $('eqCardA').querySelector('b span').textContent = pa.dark ? '🌙' : '☀️'; $('eqCardB').querySelector('b span').textContent = pb.dark ? '🌙' : '☀️';
      $('eqNote').textContent = plan.aiUsed ? 'La estructura la propuso tu IA conectada; el resto lo hizo el equipo de Tinta.' : 'Hecho por el motor de Tinta, sin conexión. Si conectas una IA, ella propone la estructura.';
      select(1); start();
    }
    dlg.addEventListener('click', ev => {
      const b = ev.target.closest('[data-eq]'), seg = ev.target.closest('#eqSeg button'), card = ev.target.closest('.ver');
      if (seg) return select(+seg.dataset.idx); if (card) return select(+card.dataset.mode);
      if (ev.target.closest('#eqGo')) { const r = $('eqGo').getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2); const t = [state.plan.A, state.plan.M, state.plan.B][mode]; setTimeout(() => host.apply(t, mode), 450); return; }
      if (!b) return; const k = b.dataset.eq;
      if (k === 'close') { stop(); host.close(); }
      if (k === 'pause') { paused = !paused; b.textContent = paused ? '▶ Continuar' : 'Ⅱ Pausar'; dlg.querySelectorAll('.ag').forEach(c => { c.style.animationPlayState = paused ? 'paused' : ''; }); toast(paused ? 'Pausado' : 'En marcha'); tick(); }
      if (k === 'speed') { speed = speed === 1 ? 2 : 1; b.textContent = '⚡ ' + speed + 'x'; dlg.getAnimations({ subtree: true }).forEach(a => { try { a.playbackRate = speed; } catch (e) { /* sin ajuste */ } }); toast(speed === 2 ? 'Movimiento acelerado' : 'Movimiento normal'); tick(); }
      if (k === 'replay') { dlg.scrollTo({ top: 0, behavior: 'smooth' }); start(); toast('Repitiendo el trabajo del equipo'); }
    });
    dlg.addEventListener('keydown', ev => { const card = ev.target.closest && ev.target.closest('.ver'); if (card && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); card.click(); } });
    function stop() { if (timer) clearInterval(timer); timer = null; }
    dlg.addEventListener('close', stop);
    return { load, stop, show, setAgent, toast, get step() { return step; } };
  }

  const api = { AGENTS, plan, rankTemplates, mount, SECTOR_PALETTE, SECTOR_FONT };
  root.TintaEquipo = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
