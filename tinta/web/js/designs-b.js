/* ───────── AVATARES ───────── */

D["avatar.robot"] = t => {
  const bot = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${t.c0}"/><path d="M32 12v6" stroke="${t.c1}" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="10" r="3" fill="${t.c1}"/><rect x="14" y="18" width="36" height="28" rx="11" fill="${t.c1}"/><rect x="19" y="24" width="26" height="15" rx="7" fill="${t.c2}"/><circle cx="26.5" cy="31.5" r="3" fill="${t.c1}"/><circle cx="37.5" cy="31.5" r="3" fill="${t.c1}"/><rect x="22" y="48" width="20" height="8" rx="4" fill="${t.c1}" opacity=".5"/></svg>`;
  return [`<div class="r">${bot(88)}${bot(56)}${bot(36)}<div class="m"><b>Aria</b><span>Asistente</span></div></div>`, `
.r{display:flex;align-items:center;gap:14px}.m{display:grid;margin-left:4px}.m b{font-size:15px;color:#14161B}.m span{font-size:12px;color:#6B7280}`];
};

D["avatar.orb"] = t => [`
<div class="r"><span class="o big"></span><span class="o"></span><span class="o sm"></span><div class="m"><b>Nova</b><span>Pensando…</span></div></div>`, `
.r{display:flex;align-items:center;gap:16px}
.o{position:relative;width:56px;height:56px;border-radius:50%;background:radial-gradient(circle at 30% 28%,#fff8 0,transparent 38%),conic-gradient(from 200deg,${t.c0},${t.c1},${t.c2},${t.c0});box-shadow:0 0 28px ${t.c1}88;animation:p 3s ease-in-out infinite}
.big{width:84px;height:84px}.sm{width:34px;height:34px;box-shadow:0 0 14px ${t.c1}88}
.m{display:grid}.m b{font-size:15px;color:#fff}.m span{font-size:12px;color:#9BA3B4}
@keyframes p{50%{transform:scale(1.06);filter:hue-rotate(20deg)}}
@media (prefers-reduced-motion:reduce){.o{animation:none}}`];

D["avatar.photo"] = t => {
  const ph = (g, s, extra) => `<span class="a" style="width:${s}px;height:${s}px;background:${g}">${ic("user", s * .5)}${extra || ""}</span>`;
  return [`
<div class="r">
  ${ph("linear-gradient(135deg," + t.c1 + "," + mix(t.c1, "#9CA3AF", .5) + ")", 64, '<i class="on"></i>')}
  <div class="stk">${ph("linear-gradient(135deg,#CBD5E1,#94A3B8)", 40)}${ph("linear-gradient(135deg,#FDE68A,#F59E0B)", 40)}${ph("linear-gradient(135deg,#A7F3D0,#10B981)", 40)}<span class="a more">+3</span></div>
</div>`, `
.r{display:flex;align-items:center;gap:22px}
.a{position:relative;display:grid;place-items:center;border-radius:50%;color:${t.c2};border:2.5px solid ${t.c0};box-shadow:0 0 0 1.5px ${t.c1}}
.on{position:absolute;right:1px;bottom:1px;width:13px;height:13px;border-radius:50%;background:#22C55E;border:2.5px solid #fff}
.stk{display:flex}.stk .a{width:40px;height:40px;margin-left:-12px;color:#fff;box-shadow:none;border-color:#fff}.stk .a:first-child{margin:0}
.more{background:${t.c2};font-size:12px;font-weight:700}`];
};

D["avatar.badge"] = t => [`
<div class="r">
  <div class="w"><span class="a">${ic("user", 28)}</span><span class="pl">${ic("plus", 14, 3)}</span></div>
  <div class="w"><span class="a ring">${ic("user", 28)}</span></div>
  <div class="w"><span class="a">${ic("user", 28)}<i class="st"></i></span></div>
</div>`, `
.r{display:flex;gap:22px;align-items:center}.w{position:relative}
.a{position:relative;width:60px;height:60px;border-radius:50%;background:${t.c0};color:${inkOn(t.c0)};display:grid;place-items:center}
.pl{position:absolute;right:-3px;bottom:-3px;width:24px;height:24px;border-radius:50%;background:${t.c2};color:#fff;border:2.5px solid #fff;display:grid;place-items:center}
.ring{box-shadow:0 0 0 3px #fff,0 0 0 5px ${t.c0}}
.st{position:absolute;right:2px;bottom:2px;width:14px;height:14px;border-radius:50%;background:#22C55E;border:2.5px solid #fff}`];

D["avatar.coach"] = t => [`
<div class="c"><span class="a">${ic("user", 26)}</span><div class="m"><b>Coach Leo</b><span>Entrenador personal</span></div><span class="pill">${ic("flame", 14)}12 días</span></div>`, `
.c{display:flex;align-items:center;gap:12px;background:${t.c0};border-radius:${t.r};padding:12px 14px;border:1px solid rgba(255,255,255,.08)}
.a{width:48px;height:48px;border-radius:50%;background:${t.c1};color:${inkOn(t.c1)};display:grid;place-items:center;flex:none}
.m{flex:1;display:grid}.m b{font-size:15px;color:${t.c2}}.m span{font-size:12px;color:#9BA3B4}
.pill{display:inline-flex;align-items:center;gap:4px;background:${t.c1}26;color:${t.c1};padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700}`];

/* ───────── PLANTILLAS (pantallas de móvil) ───────── */
const PHONE = (t, bg) => `.s{background:${bg};border-radius:28px;padding:16px;min-height:318px;display:grid;align-content:start;gap:12px;border:1px solid rgba(0,0,0,.08);box-shadow:0 14px 34px rgba(20,22,27,.12)}`;

D["tpl.store"] = t => [`
<div class="s">
  <div class="hd"><span class="b">${ic("menu", 20)}</span><b>Tienda</b><span class="b">${ic("bag", 20)}<i></i></span></div>
  <div class="se">${ic("search", 18)}Buscar productos</div>
  <div class="bn"><div><small>-30%</small><b>Colección de otoño</b></div><span>${ic("chevR", 18)}</span></div>
  <div class="g">
    <div class="p"><div class="im"></div><b>Silla Nordic</b><span>$89</span></div>
    <div class="p"><div class="im" style="background:${mix(t.c1, t.c0, .75)}"></div><b>Lámpara Arc</b><span>$45</span></div>
  </div>
</div>`, `
${PHONE(t, t.c0)}
.hd{display:flex;justify-content:space-between;align-items:center;color:${t.c2}}.hd b{font-size:16px}
.b{position:relative;width:36px;height:36px;border-radius:12px;background:${mix(t.c0, t.c2, .08)};display:grid;place-items:center}.b i{position:absolute;top:7px;right:7px;width:8px;height:8px;border-radius:50%;background:${t.c1}}
.se{display:flex;align-items:center;gap:8px;padding:11px 14px;border-radius:999px;background:${mix(t.c0, t.c2, .08)};color:${mix(t.c0, t.c2, .5)};font-size:13px}
.bn{display:flex;justify-content:space-between;align-items:center;padding:16px;border-radius:18px;background:${t.c1};color:${inkOn(t.c1)}}.bn small{font-size:11px;font-weight:700;opacity:.85;display:block}.bn b{font-size:16px}
.bn span{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.25);display:grid;place-items:center}
.g{display:grid;grid-template-columns:1fr 1fr;gap:10px}.p{display:grid;gap:3px;color:${t.c2};font-size:13px}.p span{font-weight:700;color:${t.c1}}
.im{height:76px;border-radius:14px;background:${mix(t.c1, t.c0, .85)}}`];

D["tpl.travel"] = t => [`
<div class="s">
  <div class="hd"><div><small>Hola, Lucía</small><b>¿A dónde vamos?</b></div><span class="av">${ic("user", 18)}</span></div>
  <div class="se">${ic("search", 18)}Buscar destino</div>
  <div class="ch"><span class="on">Playa</span><span>Montaña</span><span>Ciudad</span></div>
  <div class="cd"><svg viewBox="0 0 300 110" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.c1}"/><stop offset="1" stop-color="${mix(t.c1, "#FFFFFF", .6)}"/></linearGradient></defs><rect width="300" height="110" fill="url(#g)"/><circle cx="230" cy="32" r="16" fill="#fff" opacity=".8"/><path d="M0 84q40-24 80 0t80 0 80 0 60 0v26H0z" fill="#fff" opacity=".55"/><path d="M0 96q40-18 80 0t80 0 80 0 60 0v14H0z" fill="${t.c2}" opacity=".35"/></svg><div class="tx"><b>Varadero</b><small>5 noches · $480</small></div></div>
</div>`, `
${PHONE(t, t.c0)}
.hd{display:flex;justify-content:space-between;align-items:center;color:${t.c2}}.hd small{display:block;font-size:12px;opacity:.7}.hd b{font-size:19px}
.av{width:38px;height:38px;border-radius:50%;background:${t.c1};color:#fff;display:grid;place-items:center}
.se{display:flex;align-items:center;gap:8px;padding:11px 14px;border-radius:999px;background:#fff;color:${mix("#FFFFFF", t.c2, .5)};font-size:13px;box-shadow:0 2px 10px rgba(0,0,0,.06)}
.ch{display:flex;gap:8px}.ch span{padding:7px 14px;border-radius:999px;background:#fff;color:${t.c2};font-size:12px;font-weight:600}.ch .on{background:${t.c2};color:#fff}
.cd{position:relative;height:120px;border-radius:20px;overflow:hidden}.cd svg{position:absolute;inset:0;width:100%;height:100%}
.tx{position:absolute;left:14px;bottom:12px;color:#fff;display:grid}.tx b{font-size:16px}.tx small{font-size:11px;opacity:.9}`];

D["tpl.pdp"] = t => [`
<div class="s">
  <div class="ph"><svg width="110" height="90" viewBox="0 0 120 96"><path d="M24 60V50a36 36 0 0172 0v10" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><rect x="14" y="56" width="22" height="32" rx="10" fill="#fff"/><rect x="84" y="56" width="22" height="32" rx="10" fill="#fff"/></svg></div>
  <div class="nm"><b>Auriculares Pro</b><span>$59</span></div>
  <div class="cl"><i style="background:${t.c1}"></i><i style="background:${t.c2}"></i><i style="background:#E5E7EB"></i></div>
  <div class="bu"><div class="q"><button>${ic("minus", 14, 2.6)}</button><b>1</b><button>${ic("plus", 14, 2.6)}</button></div><button class="add">Añadir al carrito</button></div>
</div>`, `
.s{background:${t.c0};border-radius:${t.r};padding:12px;display:grid;gap:10px;box-shadow:0 8px 24px rgba(20,22,27,.08);border:1px solid rgba(0,0,0,.05)}
.ph{height:132px;border-radius:calc(${t.rad}px);background:linear-gradient(135deg,${t.c1},${mix(t.c1, "#FFFFFF", .5)});display:grid;place-items:center}
.nm{display:flex;justify-content:space-between;align-items:baseline;color:${t.c2}}.nm b{font-size:16px}.nm span{font-size:18px;font-weight:800;color:${t.c1}}
.cl{display:flex;gap:8px}.cl i{width:22px;height:22px;border-radius:50%;box-shadow:0 0 0 2px #fff,0 0 0 3px #D1D5DB}.cl i:first-child{box-shadow:0 0 0 2px #fff,0 0 0 4px ${t.c1}}
.bu{display:flex;gap:10px;align-items:center}
.q{display:flex;align-items:center;gap:10px;background:#F0F1F4;border-radius:999px;padding:4px 6px}.q b{min-width:14px;text-align:center;font-size:14px;color:#14161B}
.q button{width:28px;height:28px;border-radius:50%;background:${t.c2};color:#fff;display:grid;place-items:center}
.add{flex:1;padding:13px;border-radius:calc(${t.rad}px);background:${t.c1};color:${inkOn(t.c1)};font-weight:700;font-size:14px}`];

D["tpl.cart"] = t => {
  const it = (n, p, q, c) => `<div class="it"><span class="th" style="background:${c}">${ic("bag", 20)}</span><div class="in"><b>${n}</b><small>${p}</small></div><div class="q"><button>${ic("minus", 12, 3)}</button><b>${q}</b><button>${ic("plus", 12, 3)}</button></div></div>`;
  return [`
<div class="s">${it("Auriculares", "$25", 1, mix(t.c1, "#FFFFFF", .85))}${it("Bocina", "$30", 2, mix(t.c1, "#FFFFFF", .75))}
  <div class="rw"><span>Subtotal</span><b>$85</b></div><div class="rw"><span>Descuento</span><b class="of">−$10</b></div><div class="rw tt"><span>Total</span><b>$75</b></div>
  <button class="ck">Pagar $75</button></div>`, `
.s{background:${t.c0};border-radius:${t.r};padding:14px;box-shadow:0 8px 24px rgba(20,22,27,.08);border:1px solid rgba(0,0,0,.05)}
.it{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #EEF0F3}
.th{width:48px;height:48px;border-radius:12px;display:grid;place-items:center;color:${t.c1};flex:none}.in{flex:1;display:grid}.in b{font-size:14px;color:#14161B}.in small{font-size:13px;font-weight:700;color:${t.c1}}
.q{display:flex;align-items:center;gap:8px;background:#F0F1F4;border-radius:999px;padding:3px 5px}.q b{min-width:12px;text-align:center;font-size:13px;color:#14161B}.q button{width:22px;height:22px;border-radius:50%;background:#14161B;color:#fff;display:grid;place-items:center}
.rw{display:flex;justify-content:space-between;padding:7px 0;font-size:14px;color:#4B5563}.of{color:#16A34A}.tt{border-top:1px solid #EEF0F3;margin-top:4px;font-size:16px;color:#14161B}
.ck{width:100%;margin-top:8px;padding:14px;border-radius:calc(${t.rad}px);background:${t.c1};color:${inkOn(t.c1)};font-weight:700}`];
};

D["tpl.activity"] = t => [`
<div class="s">
  <div class="hd"><b>Actividad</b><span class="b">${ic("bell", 18)}</span></div>
  <div class="mp"><svg viewBox="0 0 280 120" preserveAspectRatio="xMidYMid slice"><rect width="280" height="120" fill="${mix(t.c0, "#FFFFFF", .45)}"/><path d="M-10 90C50 30 90 100 150 50s90-20 140-40" fill="none" stroke="${t.c1}" stroke-width="5" stroke-linecap="round"/><circle cx="150" cy="50" r="8" fill="${t.c1}"/><circle cx="150" cy="50" r="16" fill="${t.c1}" opacity=".18"/></svg></div>
  <div class="st"><div><b>5,2</b><small>km</small></div><div><b>28:40</b><small>tiempo</small></div><div><b>312</b><small>kcal</small></div></div>
  <button class="go">${ic("play", 16)} Empezar</button>
</div>`, `
${PHONE(t, t.c0)}
.hd{display:flex;justify-content:space-between;align-items:center;color:${t.c1}}.hd b{font-size:20px}
.b{width:36px;height:36px;border-radius:50%;background:#fff;display:grid;place-items:center}
.mp{height:110px;border-radius:20px;overflow:hidden}.mp svg{width:100%;height:100%}
.st{display:flex;justify-content:space-between;background:#fff;border-radius:18px;padding:14px 18px}.st div{display:grid;text-align:center}.st b{font-size:18px;color:${t.c1}}.st small{font-size:11px;color:${t.c2}}
.go{display:flex;align-items:center;justify-content:center;gap:8px;padding:15px;border-radius:999px;background:${t.c1};color:${inkOn(t.c1)};font-weight:700;font-size:15px}`];

D["tpl.welcome"] = t => [`
<div class="s">
  <div class="art"><span class="o"></span><span class="o2"></span><span class="o3"></span></div>
  <h3>Todo tu día,<br><em>en un solo lugar</em></h3>
  <p>Organiza tareas, notas y metas sin esfuerzo.</p>
  <button class="cta">Empezar ${ic("chevR", 16, 2.6)}</button>
  <div class="dt"><i class="on"></i><i></i><i></i></div>
</div>`, `
${PHONE(t, t.c0)}
.s{align-content:center;justify-items:center;text-align:center;gap:10px}
.art{position:relative;width:150px;height:120px;margin-bottom:8px}
.o{position:absolute;left:10px;top:20px;width:92px;height:92px;border-radius:50%;background:${t.c1}}
.o2{position:absolute;right:6px;top:0;width:58px;height:58px;border-radius:50%;background:${t.c2};opacity:.9}
.o3{position:absolute;right:26px;bottom:2px;width:30px;height:30px;border-radius:50%;background:${t.c1};opacity:.45}
h3{font-size:22px;line-height:1.2;color:${t.c2}}h3 em{font-style:normal;color:${t.c1}}.s>p{font-size:13px;color:#9BA3B4}
.cta{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:13px 28px;border-radius:999px;background:${t.c1};color:${inkOn(t.c1)};font-weight:700;font-size:14px}
.dt{display:flex;gap:6px;margin-top:8px}.dt i{width:7px;height:7px;border-radius:50%;background:#FFFFFF33}.dt .on{width:22px;border-radius:4px;background:${t.c1}}`];

/* ───────── BARRAS DE NAVEGACIÓN ───────── */
const BAR_BASE = `.nb a,.nb button{display:grid;place-items:center;gap:2px;color:#8A8F98;font-size:10px;font-weight:600;text-decoration:none}`;

D["bar.separate"] = t => [`
<div class="w"><nav class="nb"><a class="on">${ic("home")}</a><a>${ic("clock")}</a><a>${ic("bell")}</a><a>${ic("users")}</a></nav><button class="fab" aria-label="Nuevo">${ic("plus", 24, 2.6)}</button></div>`, `
.w{display:flex;gap:10px;align-items:center}
.nb{flex:1;display:flex;justify-content:space-around;align-items:center;background:${t.c0};border-radius:${t.pill};padding:15px 10px;box-shadow:0 6px 20px rgba(20,22,27,.1)}
.nb a{color:#9AA0AA}.nb .on{color:${t.c2}}
.fab{flex:none;width:54px;height:54px;border-radius:50%;background:${t.c1};color:${inkOn(t.c1)};display:grid;place-items:center;box-shadow:0 8px 18px ${t.c1}66}`];

D["bar.minimal"] = t => [`
<nav class="nb"><a class="on">${ic("home")}</a><a>${ic("clock")}</a><a>${ic("pin")}</a><a>${ic("info")}</a></nav>`, `
.nb{display:flex;justify-content:center;gap:34px;background:${t.c0};border-radius:${t.pill};padding:15px 22px;box-shadow:0 6px 20px rgba(20,22,27,.1)}
.nb a{color:${t.c2}}.nb .on{color:${t.c1}}`];

D["bar.gradient"] = t => [`
<nav class="nb"><a>${ic("home")}</a><a>${ic("grid")}</a><button class="go" aria-label="Intercambiar">${ic("swap", 22)}</button><a>${ic("wallet")}</a><a>${ic("user")}</a></nav>`, `
.nb{display:flex;justify-content:space-around;align-items:center;background:${t.c2};border-radius:${t.pill};padding:9px 8px;box-shadow:0 6px 20px rgba(20,22,27,.12)}
.nb a{color:#9AA0AA;padding:8px}
.go{width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,${t.c0},${t.c1});color:#fff;display:grid;place-items:center;box-shadow:0 8px 18px ${t.c0}66}`];

D["bar.dual"] = t => [`
<div class="w"><nav class="nb"><a class="home">${ic("home", 20)}</a><a>${ic("heart", 20)}</a></nav><nav class="nb"><a class="act">${ic("spark", 20)}</a><a>${ic("grid", 20)}</a><a>${ic("sliders", 20)}</a></nav></div>`, `
.w{display:flex;gap:10px}
.nb{display:flex;align-items:center;gap:14px;background:${t.c0};border-radius:${t.pill};padding:7px 8px;box-shadow:0 6px 20px rgba(20,22,27,.1)}
.nb a{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;color:#9AA0AA}
.home{background:${t.c1};color:${inkOn(t.c1)}!important}.act{background:${t.c2};color:${inkOn(t.c2)}!important}`];

D["bar.raised"] = t => [`
<nav class="nb"><a class="on">${ic("home", 20)}<span>Inicio</span></a><a>${ic("grid", 20)}<span>Canales</span></a><button class="up" aria-label="Nuevo">${ic("plus", 26, 2.6)}</button><a>${ic("chat", 20)}<span>Chat IA</span></a><a>${ic("user", 20)}<span>Cuenta</span></a></nav>`, `
.nb{display:flex;justify-content:space-around;align-items:flex-end;background:${t.c0};border-radius:${t.pill};padding:12px 8px 10px;box-shadow:0 6px 20px rgba(20,22,27,.1)}
.nb a{display:grid;place-items:center;gap:3px;color:${t.c2};font-size:10px;font-weight:600}.on{color:${t.c1}!important}
.up{width:54px;height:54px;border-radius:50%;background:${t.c1};color:${inkOn(t.c1)};display:grid;place-items:center;margin-top:-30px;border:4px solid ${t.c0};box-shadow:0 8px 16px ${t.c1}66}`];

D["bar.pill"] = t => [`
<nav class="nb"><a class="on">${ic("home", 20)}Inicio</a><a>${ic("grid", 20)}</a><a>${ic("user", 20)}</a></nav>`, `
.nb{display:flex;justify-content:space-around;align-items:center;background:${t.c1};border-radius:${t.pill};padding:9px}
.nb a{display:inline-flex;align-items:center;gap:7px;color:#C9CEDB;font-size:13px;font-weight:600;padding:10px 14px;border-radius:999px}
.on{background:${t.c0};color:${inkOn(t.c0)}!important}`];

D["bar.notch"] = t => [`
<div class="w"><nav class="nb"><a>${ic("home", 22)}</a><a>${ic("grid", 22)}</a><i></i><a>${ic("heart", 22)}</a><a>${ic("user", 22)}</a></nav><button class="fab" aria-label="Nuevo">${ic("plus", 26, 2.6)}</button></div>`, `
.w{position:relative;padding-top:16px}
.nb{display:flex;justify-content:space-around;align-items:center;background:${t.c0};border-radius:24px;padding:16px 8px;color:${inkOn(t.c0)};-webkit-mask:radial-gradient(circle 33px at 50% 0,transparent 97%,#000 100%);mask:radial-gradient(circle 33px at 50% 0,transparent 97%,#000 100%);margin-top:0}
.nb a{color:${inkOn(t.c0)};opacity:.7}.nb i{width:54px}
.fab{position:absolute;left:50%;top:-4px;transform:translateX(-50%);width:54px;height:54px;border-radius:50%;background:${t.c1};color:${t.c0};display:grid;place-items:center;box-shadow:0 8px 18px rgba(0,0,0,.25)}`];

D["bar.float"] = t => [`
<nav class="nb"><a class="on"><span>${ic("home", 22)}</span></a><a>${ic("grid", 22)}</a><a>${ic("plus", 22)}</a><a>${ic("heart", 22)}</a><a>${ic("user", 22)}</a></nav>`, `
.nb{display:flex;justify-content:space-around;align-items:center;background:${t.c0};border-radius:24px;padding:18px 8px;margin-top:22px;color:${inkOn(t.c0)}}
.nb a{opacity:.7;width:44px;height:26px;display:grid;place-items:center}
.nb .on{opacity:1;position:relative}.nb .on span{position:absolute;top:-34px;width:52px;height:52px;border-radius:50%;background:${t.c1};color:${t.c0};display:grid;place-items:center;border:5px solid #F3F5F8;box-shadow:0 8px 16px rgba(0,0,0,.2)}`];

D["bar.glow"] = t => [`
<nav class="nb"><a>${ic("home", 22)}</a><a>${ic("search", 22)}</a><a>${ic("plus", 22)}</a><a class="on">${ic("chat", 22)}</a><a>${ic("user", 22)}</a></nav>`, `
.nb{display:flex;justify-content:space-around;align-items:center;background:${t.c0};border-radius:24px;padding:10px 8px;border:1px solid rgba(255,255,255,.08)}
.nb a{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;color:${t.c2}}
.on{background:${t.c1};color:#fff!important;box-shadow:0 0 22px ${t.c1}}`];

D["bar.plain"] = t => [`
<nav class="nb"><a class="on">${ic("home", 22)}<span>Inicio</span></a><a>${ic("search", 22)}<span>Buscar</span></a><a>${ic("play", 22)}<span>Vídeos</span></a><a>${ic("star", 22)}<span>Favoritos</span></a></nav>`, `
.nb{display:flex;justify-content:space-around;background:${t.c0};border-radius:${t.pill};padding:10px 8px;box-shadow:0 6px 20px rgba(20,22,27,.1)}
.nb a{display:grid;place-items:center;gap:3px;color:${t.c2};font-size:10px;font-weight:600;padding:6px 12px;border-radius:999px}
.on{background:${t.c1};color:${inkOn(t.c1)}!important}`];

/* ───────── BOTONES ───────── */

D["btn.primary"] = t => [`
<div class="w"><button class="b">Continuar</button><div class="r"><button class="b press">Pulsado</button><button class="b" disabled>Desactivado</button></div></div>`, `
.w{display:grid;gap:10px}.r{display:flex;gap:10px}.r .b{flex:1}
.b{background:${t.c0};color:${inkOn(t.c0)};padding:14px 18px;border-radius:${t.r};font-weight:700;font-size:15px;box-shadow:0 6px 14px ${t.c0}44;transition:transform .1s}
.b:active,.press{transform:scale(.97);background:${mix(t.c0, "#000000", .18)}}
.b:disabled{background:#E5E7EB;color:#9CA3AF;box-shadow:none;cursor:not-allowed}`];

D["btn.pill"] = t => [`
<div class="w"><button class="b">Pedir ahora ${ic("chevR", 18, 2.6)}</button><button class="b s">${ic("cart", 18)} Añadir</button></div>`, `
.w{display:grid;gap:10px}
.b{display:flex;align-items:center;justify-content:center;gap:8px;background:${t.c0};color:${inkOn(t.c0)};padding:15px 22px;border-radius:999px;font-weight:700;font-size:15px;box-shadow:0 8px 18px ${t.c0}55;width:100%}
.s{background:${mix(t.c0, "#FFFFFF", .85)};color:${t.c0};box-shadow:none}`];

D["btn.glow"] = t => [`
<div class="w"><button class="b">Desbloquear</button></div>`, `
.w{display:grid}
.b{background:linear-gradient(135deg,${t.c0},${mix(t.c0, "#A855F7", .45)});color:#fff;padding:15px 18px;border-radius:${t.r};font-weight:700;font-size:15px;box-shadow:0 0 0 1px rgba(255,255,255,.12) inset,0 10px 30px ${t.c0}88}`];

D["btn.link"] = t => [`
<div class="w"><div class="rw"><b>Populares</b><a href="#">Ver todo ${ic("chevR", 15, 2.6)}</a></div><div class="rw"><span>¿Olvidaste tu contraseña?</span><a href="#" class="m">Recuperar</a></div></div>`, `
.w{display:grid;gap:14px}.rw{display:flex;justify-content:space-between;align-items:center;font-size:14px;color:#14161B}.rw span{color:${t.c1}}
a{display:inline-flex;align-items:center;gap:2px;color:${t.c0};font-weight:700;text-decoration:none}.m{text-decoration:underline;text-underline-offset:3px}`];

D["btn.stepper"] = t => [`
<div class="s"><button aria-label="Menos">${ic("minus", 16, 2.6)}</button><b>2</b><button aria-label="Más">${ic("plus", 16, 2.6)}</button></div>`, `
.s{display:inline-flex;align-items:center;gap:14px;background:${t.c0};border-radius:999px;padding:6px 8px}
.s b{min-width:22px;text-align:center;font-size:16px;color:#14161B}
.s button{width:36px;height:36px;border-radius:50%;background:${t.c1};color:${inkOn(t.c1)};display:grid;place-items:center}`];

D["btn.chips"] = t => [`
<div class="w"><button class="c on">${ic("check", 14, 3)}Todos</button><button class="c">Ropa</button><button class="c">Calzado</button><button class="c">Accesorios</button></div>`, `
.w{display:flex;flex-wrap:wrap;gap:8px}
.c{display:inline-flex;align-items:center;gap:5px;padding:9px 16px;border-radius:${t.pill};background:${t.c1};color:${t.c2};font-size:13px;font-weight:600}
.on{background:${t.c0};color:${inkOn(t.c0)}}`];

D["btn.fab"] = t => [`
<div class="w"><button class="f l">${ic("plus", 28, 2.6)}</button><button class="f">${ic("plus", 22, 2.6)}</button><button class="f s">${ic("plus", 18, 2.6)}</button><button class="f x">${ic("edit", 18)} Nuevo</button></div>`, `
.w{display:flex;align-items:center;gap:14px}
.f{width:48px;height:48px;border-radius:50%;background:${t.c0};color:${inkOn(t.c0)};display:grid;place-items:center;box-shadow:0 8px 18px rgba(0,0,0,.22)}
.l{width:62px;height:62px;background:${t.c1}}.s{width:36px;height:36px;box-shadow:0 4px 10px rgba(0,0,0,.2)}
.x{width:auto;border-radius:999px;padding:0 18px;display:inline-flex;gap:8px;font-weight:700;font-size:14px;height:48px}`];

D["btn.ghost"] = t => [`
<div class="w"><button class="g">Cancelar</button><button class="g d">${ic("heart", 16)} Guardar</button></div>`, `
.w{display:flex;gap:10px}
.g{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:13px;border-radius:${t.r};border:1.5px solid ${t.c1};color:${t.c1};font-weight:700;font-size:14px;background:transparent}
.d{background:${t.c1}14}`];
