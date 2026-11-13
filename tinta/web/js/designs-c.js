/* ───────── PALETAS ───────── */
/* Asigna roles automáticamente (fondo, superficie, acento, texto) a partir de los colores. */
function roles(t) {
  const cs = t.c.slice();
  const byL = cs.slice().sort((x, y) => lum(x) - lum(y));
  const bg = t.dark ? byL[0] : byL[byL.length - 1];
  const rest = cs.filter(x => x !== bg);
  const accent = bestAccent(rest.length ? rest : cs);
  const others = rest.filter(x => x !== accent);
  const text = others.slice().sort((x, y) => contrast(y, bg) - contrast(x, bg))[0] || (t.dark ? "#FFFFFF" : "#14161B");
  const surface = others.filter(x => x !== text)[0] || mix(bg, text, .07);
  return { bg, accent, text, surface };
}

D["pal.sample"] = t => {
  const r = roles(t);
  const chip = (c, n) => `<div class="sw"><i style="background:${c}"></i><b>${c}</b>${n ? `<small>${n}</small>` : ""}</div>`;
  return [`
<div class="p">
  <div class="sws">${t.c.map((c, i) => chip(c)).join("")}</div>
  <div class="ex"><h3>Tarjeta de muestra</h3><p>Así se ve la paleta aplicada a un componente real.</p><button>Acción</button></div>
</div>`, `
.p{display:grid;gap:12px}
.sws{display:flex;gap:8px}.sw{flex:1;display:grid;gap:5px;min-width:0}
.sw i{height:46px;border-radius:12px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.1)}.sw b{font-size:10px;color:#4B5563;text-align:center;letter-spacing:.2px}
.ex{background:${r.bg};border-radius:${t.r};padding:16px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
h3{font-size:15px;color:${r.text}}.ex p{font-size:12px;color:${r.text};opacity:.68;margin:4px 0 12px;background:${r.surface === r.bg ? "transparent" : "transparent"}}
.ex button{background:${r.accent};color:${inkOn(r.accent)};padding:9px 18px;border-radius:999px;font-weight:700;font-size:13px}
.ex::after{content:"";display:block;height:8px;margin-top:14px;border-radius:4px;background:${r.surface}}`];
};

/* ───────── TIPOGRAFÍA ───────── */

D["type.accent"] = t => [`
<div><h1>Descubre el <em>mejor</em> diseño</h1><p>Una línea de apoyo que explica el título en una frase corta.</p></div>`, `
h1{font-size:28px;font-weight:800;line-height:1.12;letter-spacing:-.6px;color:${t.c0}}em{font-style:normal;color:${t.c1}}
p{font-size:14px;line-height:1.5;color:#6B7280;margin-top:10px}`];

D["type.section"] = t => [`
<div class="w"><div class="rw"><h2>Populares</h2><a>Ver todo</a></div><div class="rw"><h2>Para ti</h2><a>Ver todo</a></div></div>`, `
.w{display:grid;gap:14px}.rw{display:flex;justify-content:space-between;align-items:baseline}
h2{font-size:20px;font-weight:800;letter-spacing:-.3px;color:${t.c0}}a{font-size:13px;font-weight:600;color:${t.c1}}`];

D["type.price"] = t => [`
<div class="w"><span class="pr">$59<sup>.90</sup></span><s>$79.90</s><span class="off">-25%</span></div>`, `
.w{display:flex;align-items:baseline;gap:10px}
.pr{font-size:36px;font-weight:800;letter-spacing:-1px;color:${t.c0}}.pr sup{font-size:16px;vertical-align:top;position:relative;top:4px;color:${t.c1}}
s{font-size:14px;color:#9AA0AA}.off{align-self:center;background:${t.c1}1F;color:${t.c1};font-size:12px;font-weight:800;padding:4px 9px;border-radius:999px}`];

D["type.secondary"] = t => [`
<div class="w"><div class="rw"><span>Entrega estimada</span><b>2-3 días</b></div><div class="rw"><span>Envío</span><b>Gratis</b></div><small>Texto auxiliar en gris · 120 reseñas verificadas</small></div>`, `
.w{display:grid;gap:10px}.rw{display:flex;justify-content:space-between;font-size:14px}.rw span{color:${t.c0}}.rw b{color:${t.c1};font-weight:700}
small{font-size:12px;color:${t.c0};opacity:.9}`];

D["type.label"] = t => [`
<div><span class="eb">Nueva colección</span><h2>Primavera 2026</h2><p>Piezas ligeras, colores vivos y materiales reciclados.</p></div>`, `
.eb{display:inline-block;font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:${t.c0}}
h2{font-size:26px;font-weight:800;letter-spacing:-.5px;color:${t.c1};margin-top:6px}p{font-size:14px;color:#6B7280;margin-top:6px;line-height:1.5}`];

/* ───────── ENTRADAS ───────── */

D["input.search"] = t => [`
<div class="w"><div class="f">${ic("search", 18)}<span>Buscar productos…</span></div><button aria-label="Filtros">${ic("sliders", 18)}</button></div>`, `
.w{display:flex;gap:10px}.f{flex:1;display:flex;align-items:center;gap:10px;background:${t.c0};color:${t.c1};border-radius:${t.pill};padding:13px 16px;font-size:14px}.f span{color:${t.c1}}
button{width:48px;height:48px;border-radius:50%;background:${t.c2};color:${inkOn(t.c2)};display:grid;place-items:center;flex:none}`];

D["input.message"] = t => [`
<div class="f"><span class="tx">Cuéntame qué necesitas<i></i></span><span class="ct">0/500</span><button aria-label="Enviar">${ic("arrowUp", 18, 2.6)}</button></div>`, `
.f{display:flex;align-items:center;gap:10px;background:${t.c0};border:1.5px solid ${t.c1};border-radius:${t.pill};padding:6px 6px 6px 18px;box-shadow:0 0 0 4px ${t.c1}1F}
.tx{flex:1;font-size:14px;color:#14161B}.tx i{display:inline-block;width:2px;height:16px;background:${t.c1};vertical-align:-3px;margin-left:2px;animation:b 1s steps(1) infinite}
.ct{font-size:11px;color:${t.c2}}
button{width:38px;height:38px;border-radius:50%;background:${t.c1};color:${inkOn(t.c1)};display:grid;place-items:center}
@keyframes b{50%{opacity:0}}@media (prefers-reduced-motion:reduce){.tx i{animation:none}}`];

D["input.color"] = t => [`
<div class="w"><small>Color</small><div class="r">${t.c.map((c, i) => `<span class="s${i === 0 ? " on" : ""}" style="background:${c}">${i === 0 ? ic("check", 16, 3) : ""}</span>`).join("")}</div><b>${t.c0}</b></div>`, `
.w{display:grid;gap:10px}small{font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1px}
.r{display:flex;gap:12px}.s{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;color:${inkOn(t.c0)};box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}
.on{box-shadow:0 0 0 3px #fff,0 0 0 5px ${t.c0}}b{font-size:13px;color:#14161B;font-family:ui-monospace,monospace}`];

D["input.location"] = t => [`
<div class="f"><span class="pn">${ic("pin", 18)}</span><div class="m"><small>Entregar en</small><b>Av. Principal 123</b></div>${ic("chevD", 18)}</div>`, `
.f{display:flex;align-items:center;gap:12px;background:${t.c0};color:${t.c1};border-radius:${t.r};padding:12px 16px}
.pn{width:36px;height:36px;border-radius:50%;background:${t.c1}22;display:grid;place-items:center}
.m{flex:1;display:grid}.m small{font-size:11px;color:${t.c2}}.m b{font-size:14px}`];

D["input.pills"] = t => [`
<div class="w"><small>Talla</small><div class="r"><button>S</button><button class="on">M</button><button>L</button><button>XL</button></div></div>`, `
.w{display:grid;gap:10px}small{font-size:12px;font-weight:700;color:${t.c2 === "#FFFFFF" ? "#9BA3B4" : t.c2};text-transform:uppercase;letter-spacing:1px}
.r{display:flex;gap:8px}button{min-width:44px;height:44px;padding:0 14px;border-radius:999px;background:${t.c1};color:#C9CEDB;font-weight:700;font-size:14px}
.on{background:${t.c0};color:${inkOn(t.c0)};box-shadow:0 6px 16px ${t.c0}66}`];

D["input.voice"] = t => [`
<div class="w"><div class="wv">${[8, 16, 26, 14, 30, 20, 10, 24, 12, 18, 8].map(h => `<i style="height:${h}px"></i>`).join("")}</div><button aria-label="Hablar">${ic("mic", 26)}</button><small>Mantén pulsado para hablar</small></div>`, `
.w{display:grid;justify-items:center;gap:12px}
.wv{display:flex;align-items:center;gap:4px;height:34px}.wv i{width:4px;border-radius:2px;background:${t.c2}}
button{width:64px;height:64px;border-radius:50%;background:${t.c1};color:${inkOn(t.c1)};display:grid;place-items:center;box-shadow:0 0 0 8px ${t.c1}14,0 10px 24px rgba(0,0,0,.2)}
small{font-size:12px;color:${t.c2}}`];

/* ───────── ENCABEZADOS ───────── */

D["head.greet"] = t => [`
<header><span class="av">${ic("user", 22)}</span><div class="m"><small>Buenos días</small><b>Lucía</b></div><button aria-label="Avisos">${ic("bell", 20)}<i></i></button></header>`, `
header{display:flex;align-items:center;gap:12px}.av{width:46px;height:46px;border-radius:50%;background:${t.c1};color:${inkOn(t.c1)};display:grid;place-items:center}
.m{flex:1;display:grid}.m small{font-size:12px;color:${t.c2}}.m b{font-size:19px;color:${t.c0}}
button{position:relative;width:44px;height:44px;border-radius:50%;background:#fff;color:${t.c0};display:grid;place-items:center;box-shadow:0 2px 10px rgba(0,0,0,.08)}
button i{position:absolute;top:11px;right:12px;width:8px;height:8px;border-radius:50%;background:${t.c1};border:1.5px solid #fff}`];

D["head.title"] = t => [`
<header><button aria-label="Atrás">${ic("back", 20, 2.4)}</button><b>Detalles</b><button aria-label="Menú">${ic("dots", 20)}</button></header>`, `
header{display:flex;align-items:center;justify-content:space-between}b{font-size:17px;color:${t.c0}}
button{width:42px;height:42px;border-radius:14px;background:#F0F1F4;color:${t.c0};display:grid;place-items:center}`];

D["head.location"] = t => [`
<header><div class="rw"><div class="lc"><small>Ubicación</small><b>${ic("pin", 15)} Madrid, España ${ic("chevD", 14)}</b></div><button>${ic("bell", 20)}</button></div><div class="se">${ic("search", 18)}Busca tu comida favorita</div></header>`, `
header{display:grid;gap:14px}.rw{display:flex;justify-content:space-between;align-items:center}
.lc small{font-size:11px;color:${t.c2}}.lc b{display:flex;align-items:center;gap:4px;font-size:15px;color:${t.c0}}.lc svg:first-child{color:${t.c1}}
button{width:42px;height:42px;border-radius:50%;background:${t.c1};color:${inkOn(t.c1)};display:grid;place-items:center}
.se{display:flex;gap:10px;align-items:center;padding:13px 16px;border-radius:999px;background:#F0F1F4;color:${t.c2};font-size:14px}`];

D["head.seeall"] = t => [`
<header><div><h2>Colecciones</h2><small>24 nuevas esta semana</small></div><a>Ver todo ${ic("chevR", 16, 2.6)}</a></header>`, `
header{display:flex;justify-content:space-between;align-items:flex-end}h2{font-size:22px;font-weight:800;letter-spacing:-.4px;color:${t.c0}}small{font-size:12px;color:#8A8F98}
a{display:inline-flex;align-items:center;gap:2px;font-size:13px;font-weight:700;color:${t.c1}}`];
