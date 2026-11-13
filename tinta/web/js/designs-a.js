/* ───────── CHAT ───────── */

D["chat.clean"] = t => [`
<div class="chat">
  <div class="row"><span class="av">${ic("face", 18)}</span><div><p class="b">Hola, ¿en qué te ayudo?</p><span class="ts">09:41</span></div></div>
  <div class="row me"><div><p class="b">Quiero ver las ofertas de hoy</p><span class="ts">09:42 · Leído</span></div></div>
</div>`, `
.chat{background:${t.c1};border-radius:${t.r};padding:16px;display:grid;gap:14px}
.row{display:flex;gap:8px;align-items:flex-end}.row.me{justify-content:flex-end}
.av{width:34px;height:34px;border-radius:50%;background:${t.pr};color:${t.onpr};display:grid;place-items:center;flex:none}
.b{background:${t.c0};color:#14161B;padding:10px 14px;border-radius:${t.rad}px ${t.rad}px ${t.rad}px 4px;font-size:14px;box-shadow:0 1px 2px rgba(0,0,0,.07)}
.me .b{background:${t.pr};color:${t.onpr};border-radius:${t.rad}px ${t.rad}px 4px ${t.rad}px;box-shadow:none}
.ts{display:block;font-size:11px;color:${t.c2};margin:4px 6px 0}.me .ts{text-align:right}`];

D["chat.user"] = t => [`
<div class="chat">
  <p class="b ai">Puedo ayudarte con tu pedido. ¿Cuál es el número?</p>
  <p class="b us">Es el 4821</p>
  <p class="b ai"><span class="typing"><i></i><i></i><i></i></span></p>
</div>`, `
.chat{display:grid;gap:8px;padding:4px}
.b{max-width:78%;padding:11px 15px;font-size:14px;line-height:1.35}
.ai{background:${t.c1};color:${t.c2};border-radius:${t.rad}px ${t.rad}px ${t.rad}px 4px;justify-self:start}
.us{background:${t.c0};color:${inkOn(t.c0)};border-radius:${t.rad}px ${t.rad}px 4px ${t.rad}px;justify-self:end}
.typing{display:inline-flex;gap:4px;align-items:center;height:14px}
.typing i{width:6px;height:6px;border-radius:50%;background:${t.c2};opacity:.45;animation:d 1.2s infinite}
.typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}
@keyframes d{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px);opacity:1}}
@media (prefers-reduced-motion:reduce){.typing i{animation:none}}`];

D["chat.input"] = t => [`
<div class="in">
  <button class="g" aria-label="Adjuntar">${ic("clip", 20)}</button>
  <span class="ph">Escribe un mensaje…</span>
  <button class="g" aria-label="Voz">${ic("mic", 20)}</button>
  <button class="s" aria-label="Enviar">${ic("send", 18)}</button>
</div>`, `
.in{display:flex;align-items:center;gap:6px;background:${t.c0};border:1px solid rgba(0,0,0,.08);border-radius:${t.pill};padding:6px 6px 6px 12px;box-shadow:0 4px 16px rgba(20,22,27,.08)}
.g{width:34px;height:34px;display:grid;place-items:center;color:${t.c2}}
.ph{flex:1;font-size:14px;color:${t.c2};padding:0 4px}
.s{width:40px;height:40px;border-radius:50%;background:${t.c1};color:${inkOn(t.c1)};display:grid;place-items:center}`];

D["chat.products"] = t => {
  const prod = (n, p, g) => `<div class="pd"><div class="im" style="background:${g}">${ic("image", 22)}</div><b>${n}</b><span>${p}</span></div>`;
  return [`
<div class="chat">
  <div class="row"><span class="av"></span><div class="b">Te muestro dos opciones en oferta:</div></div>
  <div class="pr">${prod("Auriculares", "$25", mix(t.c2, "#FFFFFF", .8))}${prod("Bocina", "$30", mix(t.c2, "#FFFFFF", .7))}</div>
  <div class="row me"><div class="b">Me gusta la bocina</div></div>
</div>`, `
.chat{display:grid;gap:10px;background:${t.c1};border-radius:${t.r};padding:16px}
.row{display:flex;gap:8px;align-items:flex-end}.row.me{justify-content:flex-end}
.av{width:34px;height:34px;border-radius:50%;background:${t.c2};flex:none}
.b{max-width:78%;padding:10px 14px;border-radius:${t.rad}px ${t.rad}px ${t.rad}px 4px;background:${t.c0};color:#14161B;font-size:14px;box-shadow:0 1px 2px rgba(0,0,0,.07)}
.me .b{border-radius:${t.rad}px ${t.rad}px 4px ${t.rad}px;background:${t.c2};color:${inkOn(t.c2)};box-shadow:none}
.pr{display:flex;gap:10px;margin-left:42px}
.pd{flex:1;background:${t.c0};border-radius:14px;padding:8px;display:grid;gap:2px;box-shadow:0 1px 2px rgba(0,0,0,.07)}
.im{height:64px;border-radius:10px;display:grid;place-items:center;color:${t.c2};margin-bottom:6px}
.pd b{font-size:13px;color:#14161B}.pd span{font-size:13px;font-weight:700;color:${t.c2}}`];
};

D["chat.quick"] = t => [`
<div class="w">
  <p class="b">¿Qué necesitas hoy?</p>
  <div class="chips">
    <button>${ic("tag", 15)}Ver ofertas</button>
    <button>${ic("bag", 15)}Mi pedido</button>
    <button>${ic("chat", 15)}Hablar con soporte</button>
  </div>
</div>`, `
.w{display:grid;gap:12px}
.b{justify-self:start;background:${t.c0};color:${t.c1};padding:11px 15px;border-radius:${t.rad}px ${t.rad}px ${t.rad}px 4px;font-size:14px;font-weight:600}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chips button{display:inline-flex;align-items:center;gap:6px;background:${t.c1};color:${inkOn(t.c1)};padding:9px 14px;border-radius:999px;font-size:13px;font-weight:600}
.chips button:first-child{background:${t.pr};color:${t.onpr}}`];

/* ───────── TARJETAS ───────── */

D["card.product"] = t => [`
<article class="c">
  <div class="ph"><button class="fav" aria-label="Favorito">${ic("heart", 18)}</button>
    <svg width="120" height="96" viewBox="0 0 120 96"><path d="M24 60V50a36 36 0 0172 0v10" fill="none" stroke="${t.c2}" stroke-width="7" stroke-linecap="round"/><rect x="14" y="56" width="22" height="32" rx="10" fill="${t.c2}"/><rect x="84" y="56" width="22" height="32" rx="10" fill="${t.c2}"/></svg></div>
  <div class="bd"><div><h3>Auriculares Air</h3><p>Cancelación de ruido</p></div><b class="pr">$120</b></div>
  <button class="add">${ic("plus", 16)} Añadir al carrito</button>
</article>`, `
.c{background:${t.c0};border-radius:${t.r};padding:10px;box-shadow:0 8px 24px rgba(20,22,27,.08);border:1px solid rgba(0,0,0,.05)}
.ph{position:relative;height:150px;border-radius:calc(${t.rad}px - 4px);background:linear-gradient(160deg,${t.c1},${mix(t.c1, t.c2, .18)});display:grid;place-items:center}
.fav{position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;background:#fff;color:#14161B;display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.12)}
.bd{display:flex;justify-content:space-between;align-items:flex-start;padding:12px 6px 4px}
h3{font-size:16px;color:#14161B}.bd p{font-size:12px;color:#6B7280;margin-top:2px}.pr{font-size:18px;color:${t.c2}}
.add{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin-top:8px;padding:12px;border-radius:calc(${t.rad}px - 4px);background:${t.c2};color:${inkOn(t.c2)};font-weight:700;font-size:14px}`];

D["card.photo"] = t => [`
<article class="c">
  <svg class="bgp" viewBox="0 0 320 220" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.c2}"/><stop offset="1" stop-color="${mix(t.c2, "#FFD9A8", .6)}"/></linearGradient></defs><rect width="320" height="220" fill="url(#sk)"/><circle cx="240" cy="70" r="26" fill="#FFE8C2" opacity=".9"/><path d="M0 170l70-70 55 55 60-80 135 120v25H0z" fill="${mix(t.c0, "#FFFFFF", .15)}" opacity=".95"/><path d="M0 195l90-55 70 45 70-40 90 60v15H0z" fill="${t.c0}"/></svg>
  <span class="tag">Destino</span>
  <div class="tx"><h3>Valle de Viñales</h3><p>3 días · desde $240</p></div>
  <button class="go" aria-label="Ver">${ic("chevR", 18)}</button>
</article>`, `
.c{position:relative;height:210px;border-radius:${t.r};overflow:hidden;color:${t.c1};box-shadow:0 10px 28px rgba(0,0,0,.22)}
.bgp{position:absolute;inset:0;width:100%;height:100%}
.c::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.62),transparent 60%)}
.tag{position:absolute;top:14px;left:14px;z-index:1;padding:5px 11px;border-radius:999px;background:rgba(255,255,255,.22);backdrop-filter:blur(8px);font-size:11px;font-weight:700;color:#fff}
.tx{position:absolute;left:16px;bottom:14px;z-index:1;color:#fff}.tx h3{font-size:19px}.tx p{font-size:12px;opacity:.85;margin-top:2px}
.go{position:absolute;right:14px;bottom:14px;z-index:1;width:38px;height:38px;border-radius:50%;background:#fff;color:#14161B;display:grid;place-items:center}`];

D["card.premium"] = t => [`
<article class="c">
  <div class="top"><span class="badge">${ic("spark", 13)} PRO</span><span class="pr">$9<small>/mes</small></span></div>
  <h3>Plan Creador</h3>
  <ul><li>${ic("check", 15)}Proyectos ilimitados</li><li>${ic("check", 15)}Exportar en alta calidad</li><li>${ic("check", 15)}Soporte prioritario</li></ul>
  <button class="cta">Empezar ahora</button>
</article>`, `
.c{background:linear-gradient(${t.c0},${t.c0}) padding-box,linear-gradient(135deg,${t.c2},${mix(t.c2, "#FFFFFF", .1)}33,${t.c2}) border-box;border:1px solid transparent;border-radius:${t.r};padding:18px;color:#fff;box-shadow:0 0 36px ${t.c2}40}
.top{display:flex;justify-content:space-between;align-items:center}
.badge{display:inline-flex;align-items:center;gap:5px;background:${t.c2}33;color:${mix(t.c2, "#FFFFFF", .55)};padding:5px 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.5px}
.pr{font-size:26px;font-weight:800}.pr small{font-size:12px;font-weight:500;opacity:.6}
h3{font-size:18px;margin:12px 0 10px}
ul{list-style:none;padding:0;display:grid;gap:8px;font-size:13px;color:#C9CEDB}
li{display:flex;gap:8px;align-items:center}li svg{color:${t.c2}}
.cta{width:100%;margin-top:16px;padding:12px;border-radius:calc(${t.rad}px - 4px);background:linear-gradient(135deg,${t.c2},${mix(t.c2, "#3B82F6", .5)});color:#fff;font-weight:700;font-size:14px}`];

D["card.category"] = t => [`
<article class="c">
  <svg class="il" viewBox="0 0 120 90"><circle cx="86" cy="34" r="26" fill="${t.c2}" opacity=".9"/><rect x="18" y="38" width="46" height="46" rx="14" fill="${t.c1}"/><circle cx="52" cy="22" r="11" fill="${mix(t.c2, "#FFFFFF", .55)}"/><path d="M30 70l12-14 10 10 8-8 12 12" fill="none" stroke="${t.c2}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
  <div class="bt"><div><h3>Diseño UI</h3><p>24 recursos</p></div><span class="ar">${ic("chevR", 18)}</span></div>
</article>`, `
.c{background:${t.c0};border-radius:${t.r};padding:14px 16px 16px}
.il{width:100%;height:96px;margin-bottom:6px}
.bt{display:flex;justify-content:space-between;align-items:center}
h3{font-size:17px;color:#14161B}.bt p{font-size:12px;color:#6B7280;margin-top:2px}
.ar{width:36px;height:36px;border-radius:50%;background:${t.c2};color:${inkOn(t.c2)};display:grid;place-items:center}`];

D["card.history"] = t => {
  const row = (i, a, b, c) => `<div class="r"><span class="ic">${ic(i, 20)}</span><div class="m"><b>${a}</b><small>${b}</small></div><span class="tm">${c}</span></div>`;
  return [`
<div class="l">${row("chat", "Ideas de logotipo", "Conversación · 12 mensajes", "Hoy")}${row("image", "Paleta para tienda", "Imagen generada", "Ayer")}${row("code", "Botón con degradado", "Código · CSS", "Lun")}</div>`, `
.l{background:${t.c0};border-radius:${t.r};padding:6px 14px;box-shadow:0 4px 18px rgba(20,22,27,.06);border:1px solid rgba(0,0,0,.05)}
.r{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #EEF0F3}.r:last-child{border:0}
.ic{width:40px;height:40px;border-radius:12px;background:${t.c1};color:${t.c2};display:grid;place-items:center;flex:none}
.m{flex:1;min-width:0}.m b{display:block;font-size:14px;color:#14161B}.m small{font-size:12px;color:#8A8F98}
.tm{font-size:11px;color:#8A8F98}`];
};

D["card.food"] = t => [`
<article class="c">
  <svg class="pl" viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="${mix(t.c1, "#FFFFFF", .8)}"/><circle cx="60" cy="60" r="44" fill="#fff" stroke="${mix(t.c1, "#FFFFFF", .5)}" stroke-width="2"/><circle cx="60" cy="60" r="30" fill="${t.c1}"/><circle cx="50" cy="52" r="7" fill="#fff" opacity=".35"/><circle cx="72" cy="68" r="5" fill="#14161B" opacity=".18"/><circle cx="64" cy="48" r="4" fill="#fff" opacity=".4"/></svg>
  <h3>Pizza margarita</h3>
  <div class="mt"><span>${icf("star", 13)} 4.8</span><span>${ic("clock", 13)} 25 min</span></div>
  <div class="ft"><b>$12.50</b><button class="ad" aria-label="Añadir">${ic("plus", 18)}</button></div>
</article>`, `
.c{background:${t.c0};border-radius:${t.r};padding:14px;text-align:center;box-shadow:0 8px 24px rgba(20,22,27,.08);border:1px solid rgba(0,0,0,.05)}
.pl{width:120px;height:120px;margin:-30px auto 6px;filter:drop-shadow(0 10px 14px rgba(0,0,0,.18))}
h3{font-size:16px;color:#14161B}
.mt{display:flex;justify-content:center;gap:14px;font-size:12px;color:#6B7280;margin-top:6px}.mt span{display:inline-flex;align-items:center;gap:4px}.mt svg{color:${t.c1}}
.ft{display:flex;justify-content:space-between;align-items:center;margin-top:12px;text-align:left}.ft b{font-size:19px;color:#14161B}
.ad{width:38px;height:38px;border-radius:50%;background:${t.c1};color:${inkOn(t.c1)};display:grid;place-items:center}`];

D["card.profile"] = t => {
  const themes = t.c.length >= 4 ? `<div class="th">${t.c.map(x => `<i style="background:${x}"></i>`).join("")}</div>` : "";
  return [`
<article class="c">
  <div class="bn"></div>
  <div class="av">${ic("user", 28)}</div>
  <h3>Lucía Ramos</h3><p>Diseñadora de producto</p>
  <div class="st"><div><b>1.5M</b><span>Seguidores</span></div><div><b>324</b><span>Siguiendo</span></div><div><b>89</b><span>Posts</span></div></div>
  <div class="bt"><button class="a">Seguir</button><button class="b">Mensaje</button></div>${themes}
</article>`, `
.c{background:${t.dark ? t.bg : "#fff"};border-radius:${t.r};text-align:center;padding-bottom:16px;overflow:hidden;box-shadow:0 8px 24px rgba(20,22,27,.08);border:1px solid rgba(0,0,0,.05);color:${t.tx}}
.bn{height:74px;background:linear-gradient(135deg,${t.pr},${mix(t.pr, "#FFFFFF", .35)})}
.av{width:62px;height:62px;border-radius:50%;margin:-31px auto 0;background:#fff;color:${t.pr};border:3px solid ${t.dark ? t.bg : "#fff"};display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.15)}
h3{font-size:17px;margin-top:8px}.c>p{font-size:12px;color:${t.mu}}
.st{display:flex;justify-content:center;gap:22px;margin:12px 0}.st div{display:grid}.st b{font-size:15px}.st span{font-size:11px;color:${t.mu}}
.bt{display:flex;gap:8px;justify-content:center;padding:0 16px}.bt button{flex:1;padding:10px;border-radius:999px;font-size:13px;font-weight:700}
.a{background:${t.pr};color:${t.onpr}}.b{border:1.5px solid ${t.pr};color:${t.pr}}
.th{display:flex;gap:8px;justify-content:center;margin-top:14px}.th i{width:18px;height:18px;border-radius:50%;box-shadow:0 0 0 2px ${t.dark ? t.bg : "#fff"},0 0 0 3px rgba(0,0,0,.12)}`];
};

D["card.business"] = t => [`
<article class="c">
  <div class="bn"></div>
  <div class="av">${ic("user", 26)}</div>
  <h3>Marco Díaz</h3><p>Director comercial · Nova Studio</p>
  <ul><li>${ic("mail", 16)}marco@nova.studio</li><li>${ic("phone", 16)}+34 600 123 456</li><li>${ic("pin", 16)}Madrid, España</li></ul>
  <button class="cta">Guardar contacto</button>
</article>`, `
.c{background:#fff;border-radius:${t.r};text-align:center;padding-bottom:16px;overflow:hidden;box-shadow:0 8px 24px rgba(20,22,27,.08);border:1px solid rgba(0,0,0,.05)}
.bn{height:62px;background:${t.c0}}
.av{width:56px;height:56px;border-radius:50%;margin:-28px auto 0;background:${t.c1};color:#fff;border:3px solid #fff;display:grid;place-items:center}
h3{font-size:16px;margin-top:8px;color:#14161B}.c>p{font-size:12px;color:#6B7280}
ul{list-style:none;padding:0;margin:12px 16px;display:grid;gap:6px;text-align:left}
li{display:flex;gap:10px;align-items:center;background:#F3F4F7;border-radius:10px;padding:8px 10px;font-size:12px;color:#14161B}li svg{color:${t.c0}}
.cta{width:calc(100% - 32px);padding:11px;border-radius:999px;background:${t.c2};color:${inkOn(t.c2)};font-weight:700;font-size:13px}`];

D["card.chatrow"] = t => {
  const row = (n, m, tm, b, col) => `<div class="r"><span class="av" style="background:${col}">${n[0]}</span><div class="m"><b>${n}</b><small>${m}</small></div><div class="rt"><span>${tm}</span>${b ? `<em>${b}</em>` : ""}</div></div>`;
  return [`
<div class="l">${row("Ana", "¿Quedamos mañana?", "09:41", 5, t.c1)}${row("Equipo Diseño", "Subí los archivos finales", "08:15", 0, mix(t.c1, "#14161B", .15))}${row("Carlos", "Gracias por la ayuda", "Ayer", 2, t.c2)}</div>`, `
.l{background:${t.c0};border-radius:${t.r};padding:4px 14px;box-shadow:0 4px 18px rgba(20,22,27,.06);border:1px solid rgba(0,0,0,.05)}
.r{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #EEF0F3}.r:last-child{border:0}
.av{width:42px;height:42px;border-radius:50%;color:#fff;display:grid;place-items:center;font-weight:700;flex:none}
.m{flex:1;min-width:0}.m b{display:block;font-size:14px;color:#14161B}.m small{font-size:12px;color:#8A8F98;white-space:nowrap}
.rt{display:grid;justify-items:end;gap:4px;font-size:11px;color:#8A8F98}
.rt em{font-style:normal;background:${t.c2};color:${inkOn(t.c2)};min-width:20px;height:20px;border-radius:10px;display:grid;place-items:center;font-size:11px;font-weight:700;padding:0 6px}`];
};

D["card.promo"] = t => [`
<article class="c">
  <span class="orb">${ic("spark", 26)}</span>
  <h3>Pásate a Pro</h3><p>Más velocidad, más almacenamiento y sin anuncios.</p>
  <button class="cta">Mejorar plan</button>
</article>`, `
.c{background:linear-gradient(135deg,${t.c1},${t.c0});border-radius:${t.r};padding:20px;text-align:center;color:${inkOn(t.c0)};box-shadow:0 12px 28px ${t.c0}55}
.orb{width:56px;height:56px;border-radius:50%;margin:0 auto 10px;background:rgba(255,255,255,.28);display:grid;place-items:center;color:#fff}
h3{font-size:19px}.c p{font-size:13px;opacity:.9;margin:4px 0 14px}
.cta{padding:11px 22px;border-radius:999px;background:${t.c2};color:${inkOn(t.c2)};font-weight:700;font-size:13px}`];

D["card.dropzone"] = t => [`
<div class="c">
  <span class="up">${ic("upload", 22)}</span>
  <h3>Suelta tus archivos aquí</h3><p>PNG, JPG o PDF · máximo 20 MB</p>
  <button class="cta">Elegir archivos</button>
</div>`, `
.c{background:${t.c0};border:2px dashed ${mix(t.c1, "#FFFFFF", .45)};border-radius:${t.r};padding:22px 16px;text-align:center}
.up{width:48px;height:48px;border-radius:50%;margin:0 auto 10px;background:${mix(t.c1, "#FFFFFF", .85)};color:${t.c1};display:grid;place-items:center}
h3{font-size:15px;color:#14161B}.c p{font-size:12px;color:${t.c2};margin:4px 0 14px}
.cta{padding:10px 20px;border-radius:999px;background:${t.c1};color:${inkOn(t.c1)};font-weight:700;font-size:13px}`];

D["card.kanban"] = t => [`
<article class="c">
  <div class="lb"><span style="background:${t.c0}">Diseño</span><span style="background:${t.c1}">Urgente</span><span style="background:${t.c2}">Web</span></div>
  <h3>Rediseñar pantalla de pagos</h3><p>Unificar botones y estados de error.</p>
  <div class="pg"><i style="width:66%"></i></div>
  <div class="ft"><div class="mt"><span>${ic("check", 14)}2/3</span><span>${ic("clip", 14)}4</span><span>${ic("chat", 14)}7</span></div><div class="avs"><i style="background:${t.c0}"></i><i style="background:${t.c1}"></i></div></div>
</article>`, `
.c{background:#fff;border-radius:${t.r};padding:14px;box-shadow:0 4px 16px rgba(20,22,27,.08);border:1px solid rgba(0,0,0,.05)}
.lb{display:flex;gap:6px;flex-wrap:wrap}.lb span{font-size:10px;font-weight:700;padding:3px 9px;border-radius:999px;color:#fff}
h3{font-size:15px;color:#14161B;margin-top:10px}.c p{font-size:12px;color:#6B7280;margin-top:3px}
.pg{height:6px;border-radius:3px;background:#EEF0F3;margin:12px 0}.pg i{display:block;height:100%;border-radius:3px;background:${t.c0}}
.ft{display:flex;justify-content:space-between;align-items:center}.mt{display:flex;gap:12px;font-size:12px;color:#8A8F98}.mt span{display:inline-flex;gap:4px;align-items:center}
.avs{display:flex}.avs i{width:24px;height:24px;border-radius:50%;border:2px solid #fff;margin-left:-8px}.avs i:first-child{margin:0}`];

D["card.wireframe"] = t => [`
<div class="c">
  <div class="img"><svg viewBox="0 0 100 60" preserveAspectRatio="none"><path d="M0 0L100 60M100 0L0 60" stroke="${t.c1}" stroke-width="1" opacity=".5" vector-effect="non-scaling-stroke"/></svg></div>
  <i class="ln a"></i><i class="ln b"></i><i class="ln c"></i>
  <span class="bt"></span>
</div>`, `
.c{border:2px solid ${t.c2};border-radius:${t.r};padding:10px;background:${t.c0};display:grid;gap:8px}
.img{height:72px;border-radius:8px;background:${mix(t.c1, "#FFFFFF", .8)};border:2px solid ${t.c2};overflow:hidden}.img svg{width:100%;height:100%}
.ln{display:block;height:9px;border-radius:5px;background:${t.c1}}.a{width:60%}.b{width:85%;opacity:.4}.c .c{width:45%;opacity:.4}
.bt{width:70px;height:24px;border-radius:12px;border:2px solid ${t.c2}}`];

D["card.contact"] = t => [`
<article class="c">
  <div class="bn"></div>
  <div class="row"><span class="av">${ic("user", 22)}</span><div><h3>Nombre Apellido</h3><p>Cargo · Empresa</p></div></div>
  <div class="bt"><button class="e">EDITAR</button><button class="s">COMPARTIR</button></div>
</article>`, `
.c{background:${t.c1 === "#FFFFFF" ? "#1F212B" : "#1F212B"};border-radius:${t.r};padding:12px;color:#fff;border:1px solid rgba(255,255,255,.08)}
.bn{height:60px;border-radius:calc(${t.rad}px - 6px);background:linear-gradient(135deg,${t.c1},${mix(t.c1, "#EC4899", .5)})}
.row{display:flex;align-items:flex-end;gap:12px;margin:-22px 6px 0}
.av{width:50px;height:50px;border-radius:50%;background:${t.c0};border:3px solid #1F212B;color:#fff;display:grid;place-items:center;flex:none}
h3{font-size:15px;margin:0}.row p{font-size:12px;color:#9BA3B4;margin:2px 0 0}.row>div{padding-bottom:2px}
.bt{display:flex;gap:8px;margin-top:14px}.bt button{flex:1;padding:10px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.4px}
.e{border:1.5px solid rgba(255,255,255,.25);color:#fff}.s{background:${t.c1};color:${inkOn(t.c1)}}`];

D["card.stack"] = t => [`
<div class="st"><div class="b"></div><div class="f"><span class="ic">${ic("spark", 20)}</span><h3>Destacada</h3><p>Tarjeta superpuesta con ligera rotación.</p></div></div>`, `
.st{position:relative;height:150px}
.b{position:absolute;left:0;top:0;width:66%;height:122px;border-radius:${t.r};background:${t.c0}}
.f{position:absolute;right:0;top:20px;width:66%;height:122px;border-radius:${t.r};background:#fff;border:1px solid ${mix(t.c1, "#FFFFFF", .6)};transform:rotate(3deg);box-shadow:0 14px 28px rgba(20,22,27,.18);padding:14px}
.ic{width:34px;height:34px;border-radius:10px;background:${t.c1};color:#fff;display:grid;place-items:center;margin-bottom:8px}
h3{font-size:15px;color:#14161B}.f p{font-size:12px;color:#6B7280;margin-top:3px}`];

D["card.tile"] = t => [`
<div class="g">
  <div class="t big" style="background:${t.c0}">${ic("tag", 26)}<b>Vender</b><small>Publica en 1 minuto</small></div>
  <div class="t" style="background:${t.c1}">${ic("star", 22)}<b>Sabores</b></div>
  <div class="t" style="background:${t.c2}">${ic("cart", 22)}<b>Pedidos</b></div>
</div>`, `
.g{display:grid;grid-template-columns:1.2fr 1fr;grid-template-rows:auto auto;gap:10px}
.t{border-radius:${t.r};padding:14px;color:#fff;display:grid;align-content:space-between;gap:12px;min-height:84px}
.t b{font-size:14px}.t small{font-size:11px;opacity:.85;margin-top:-8px}
.big{grid-row:span 2}`];

D["card.pastel"] = t => {
  const cell = (c, i, a, b) => `<div class="p" style="background:${c}">${ic(i, 22)}<b>${a}</b><small>${b}</small></div>`;
  return [`
<div class="g">${cell(t.c0, "flame", "Un café", "Algo cálido")}${cell(t.c1, "sun", "El finde", "Cuéntame el tuyo")}${cell(t.c2, "music", "Playlist", "Para concentrarte")}${cell(t.c3, "heart", "Cuidarte", "Pausa de 5 min")}</div>`, `
.g{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.p{border-radius:${t.r};padding:14px;display:grid;gap:2px;color:#14161B}.p svg{margin-bottom:8px;opacity:.75}
.p b{font-size:14px}.p small{font-size:11px;color:#14161B99}`];
};
