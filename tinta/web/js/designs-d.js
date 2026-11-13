/* ───────── LISTAS ───────── */

D["list.settings"] = t => {
  const row = (i, col, n, r) => `<div class="r"><span class="ic" style="background:${col}">${ic(i, 18)}</span><b>${n}</b>${r}</div>`;
  const sw = on => `<span class="sw${on ? " on" : ""}"><i></i></span>`;
  return [`
<div class="l"><div class="g">${row("wifi", t.c1, "Wi-Fi", `<small>Casa_5G</small>${ic("chevR", 16)}`)}${row("bell", t.c2, "Notificaciones", sw(true))}${row("moon", "#6366F1", "Modo oscuro", sw(false))}</div></div>`, `
.g{background:${t.c0};border-radius:${t.r};padding:4px 14px;box-shadow:0 4px 18px rgba(20,22,27,.06);border:1px solid rgba(0,0,0,.05)}
.r{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #EEF0F3;color:#9AA0AA}.r:last-child{border:0}
.ic{width:32px;height:32px;border-radius:9px;color:#fff;display:grid;place-items:center;flex:none}
.r b{flex:1;font-size:14px;font-weight:600;color:#14161B}.r small{font-size:13px}
.sw{width:44px;height:26px;border-radius:13px;background:#D5D8DE;position:relative}.sw i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .2s}
.sw.on{background:#22C55E}.sw.on i{left:21px}`];
};

D["list.tx"] = t => {
  const row = (i, n, d, a, pos) => `<div class="r"><span class="ic">${ic(i, 18)}</span><div class="m"><b>${n}</b><small>${d}</small></div><span class="am ${pos ? "p" : ""}">${a}</span></div>`;
  return [`
<div class="l">${row("bag", "Supermercado", "Hoy · 18:20", "−$42.10")}${row("arrowDown", "Nómina", "Ayer · 09:00", "+$1,850.00", 1)}${row("music", "Suscripción", "Lun · 07:12", "−$9.99")}</div>`, `
.l{background:${t.c0};border-radius:${t.r};padding:4px 14px;box-shadow:0 4px 18px rgba(20,22,27,.06);border:1px solid rgba(0,0,0,.05)}
.r{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #EEF0F3}.r:last-child{border:0}
.ic{width:40px;height:40px;border-radius:50%;background:${t.c1}1A;color:${t.c1};display:grid;place-items:center;flex:none}
.m{flex:1;display:grid}.m b{font-size:14px;color:#14161B}.m small{font-size:12px;color:#8A8F98}
.am{font-size:14px;font-weight:800;color:#14161B}.p{color:#16A34A}`];
};

D["list.music"] = t => {
  const row = (g, n, a, d, on) => `<div class="r${on ? " on" : ""}"><span class="cv" style="background:${g}">${on ? '<i class="eq"><u></u><u></u><u></u></i>' : ""}</span><div class="m"><b>${n}</b><small>${a}</small></div><span class="d">${d}</span></div>`;
  return [`
<div class="l">${row("linear-gradient(135deg," + t.c1 + "," + mix(t.c1, "#EC4899", .6) + ")", "Neón de madrugada", "Lumen", "3:42", 1)}${row("linear-gradient(135deg,#0EA5E9,#6366F1)", "Mareas", "Orilla", "2:58")}${row("linear-gradient(135deg,#F59E0B,#EF4444)", "Solsticio", "Verano Azul", "4:10")}</div>`, `
.l{background:${t.c0};border-radius:${t.r};padding:8px;border:1px solid rgba(255,255,255,.07)}
.r{display:flex;align-items:center;gap:12px;padding:8px;border-radius:12px}.on{background:${t.c1}22}
.cv{position:relative;width:44px;height:44px;border-radius:10px;flex:none;display:grid;place-items:center}
.m{flex:1;display:grid}.m b{font-size:14px;color:${t.c2}}.on .m b{color:${mix(t.c1, "#FFFFFF", .45)}}.m small{font-size:12px;color:#9BA3B4}.d{font-size:12px;color:#9BA3B4}
.eq{display:flex;gap:2px;align-items:flex-end;height:16px}.eq u{width:3px;background:#fff;border-radius:2px;animation:e 1s ease-in-out infinite}.eq u:nth-child(1){height:8px}.eq u:nth-child(2){height:16px;animation-delay:.2s}.eq u:nth-child(3){height:11px;animation-delay:.4s}
@keyframes e{50%{transform:scaleY(.4)}}.eq u{transform-origin:bottom}@media (prefers-reduced-motion:reduce){.eq u{animation:none}}`];
};

D["list.notif"] = t => {
  const row = (c, i, txt, tm, un) => `<div class="r${un ? " un" : ""}"><span class="av" style="background:${c}">${ic(i, 18)}</span><div class="m"><p>${txt}</p><small>${tm}</small></div>${un ? "<i></i>" : ""}</div>`;
  return [`
<div class="l">${row(t.c1, "heart", "<b>Ana</b> le gustó tu publicación", "Hace 5 min", 1)}${row(t.c2, "users", "<b>Carlos</b> empezó a seguirte", "Hace 1 h", 1)}${row("#9CA3AF", "chat", "<b>Equipo</b> comentó tu diseño", "Ayer")}</div>`, `
.l{background:${t.c0};border-radius:${t.r};overflow:hidden;border:1px solid rgba(0,0,0,.05);box-shadow:0 4px 18px rgba(20,22,27,.06)}
.r{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid #EEF0F3}.r:last-child{border:0}.un{background:${t.c1}0D}
.av{width:38px;height:38px;border-radius:50%;color:#fff;display:grid;place-items:center;flex:none}
.m{flex:1}.m p{font-size:13px;color:#14161B;line-height:1.35}.m small{font-size:11px;color:#8A8F98}
.r>i{width:9px;height:9px;border-radius:50%;background:${t.c1}}`];
};

/* ───────── HOJAS Y DIÁLOGOS ───────── */
const SCRIM = "background:rgba(20,22,27,.45);border-radius:22px;";

D["sheet.bottom"] = t => [`
<div class="sc"><div class="sh"><i class="hd"></i><h3>Ordenar por</h3>
  <button class="o on">${ic("check", 18, 2.6)}Más relevantes</button><button class="o">Precio: menor a mayor</button><button class="o">Más recientes</button>
  <button class="cta">Aplicar</button></div></div>`, `
.sc{${SCRIM}height:300px;display:flex;align-items:flex-end;overflow:hidden}
.sh{width:100%;background:${t.c0};border-radius:${t.r} ${t.r} 0 0;padding:10px 18px 18px;display:grid;gap:6px}
.hd{width:40px;height:5px;border-radius:3px;background:#D5D8DE;margin:0 auto 8px}h3{font-size:17px;color:#14161B;margin-bottom:4px}
.o{display:flex;align-items:center;gap:8px;text-align:left;padding:12px 14px;border-radius:12px;background:#F3F4F7;font-size:14px;color:#14161B;font-weight:600}
.o.on{background:${t.c1}1A;color:${t.c1}}
.cta{margin-top:6px;padding:14px;border-radius:999px;background:${t.c1};color:${inkOn(t.c1)};font-weight:700;font-size:15px}`];

D["sheet.confirm"] = t => [`
<div class="sc"><div class="dg"><span class="ic">${ic("trash", 22)}</span><h3>¿Eliminar proyecto?</h3><p>Esta acción no se puede deshacer.</p><div class="bt"><button class="c">Cancelar</button><button class="d">Eliminar</button></div></div></div>`, `
.sc{${SCRIM}height:260px;display:grid;place-items:center;padding:16px}
.dg{width:100%;background:${t.c0};border-radius:${t.r};padding:20px;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,.25)}
.ic{width:52px;height:52px;border-radius:50%;background:#FEE2E2;color:#DC2626;display:grid;place-items:center;margin:0 auto 10px}
h3{font-size:17px;color:#14161B}p{font-size:13px;color:#6B7280;margin:4px 0 16px}
.bt{display:flex;gap:8px}.bt button{flex:1;padding:12px;border-radius:999px;font-weight:700;font-size:14px}.c{background:#F0F1F4;color:#14161B}.d{background:#DC2626;color:#fff}`];

D["sheet.actions"] = t => [`
<div class="sc"><div class="g"><button>${ic("share", 18)}Compartir</button><button>${ic("copy", 18)}Duplicar</button><button>${ic("edit", 18)}Renombrar</button><button class="x">${ic("trash", 18)}Eliminar</button></div><button class="cc">Cancelar</button></div>`, `
.sc{${SCRIM}height:300px;display:grid;align-content:end;gap:8px;padding:12px}
.g{background:${t.c0};border-radius:${t.r};overflow:hidden}
.g button{display:flex;align-items:center;gap:12px;width:100%;padding:15px 18px;font-size:15px;font-weight:600;color:#14161B;border-bottom:1px solid #EEF0F3;text-align:left}.g button:last-child{border:0}.g svg{color:${t.c1}}
.x,.x svg{color:#DC2626!important}.cc{background:${t.c0};border-radius:${t.r};padding:15px;font-weight:800;font-size:15px;color:${t.c1}}`];

D["sheet.success"] = t => [`
<div class="sc"><div class="dg"><span class="ck">${ic("check", 30, 3)}</span><h3>¡Pedido confirmado!</h3><p>Te avisaremos cuando salga de camino.</p><button>Ver pedido</button></div></div>`, `
.sc{${SCRIM}height:270px;display:grid;place-items:center;padding:16px}
.dg{width:100%;background:${t.c0};border-radius:${t.r};padding:24px 20px;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,.25)}
.ck{width:64px;height:64px;border-radius:50%;background:${t.c1};color:${inkOn(t.c1)};display:grid;place-items:center;margin:0 auto 12px;box-shadow:0 0 0 8px ${t.c1}22,0 0 0 16px ${t.c1}10}
h3{font-size:18px;color:#14161B}p{font-size:13px;color:#6B7280;margin:4px 0 16px}
button{padding:12px 28px;border-radius:999px;background:${t.c1};color:${inkOn(t.c1)};font-weight:700;font-size:14px}`];

/* ───────── DATOS ───────── */

D["data.stat"] = t => [`
<div class="c"><div class="tp"><span>Ingresos</span><em>${ic("arrowUp", 12, 3)}12.4%</em></div><b>$24,380</b>
<svg viewBox="0 0 200 50" preserveAspectRatio="none"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.c1}" stop-opacity=".3"/><stop offset="1" stop-color="${t.c1}" stop-opacity="0"/></linearGradient></defs><path d="M0 40C20 38 30 24 50 28s30 14 50 6 30-22 50-16 30 8 50-12V50H0z" fill="url(#a)"/><path d="M0 40C20 38 30 24 50 28s30 14 50 6 30-22 50-16 30 8 50-12" fill="none" stroke="${t.c1}" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg></div>`, `
.c{background:${t.c0};border-radius:${t.r};padding:16px 16px 10px;box-shadow:0 4px 18px rgba(20,22,27,.06);border:1px solid rgba(0,0,0,.05)}
.tp{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#6B7280}
em{font-style:normal;display:inline-flex;align-items:center;gap:2px;background:#DCFCE7;color:#15803D;font-size:11px;font-weight:800;padding:3px 8px;border-radius:999px}
b{display:block;font-size:30px;letter-spacing:-.8px;color:#14161B;margin:4px 0 6px}.c>svg{width:100%;height:56px;display:block}`];

D["data.ring"] = t => [`
<div class="c"><svg viewBox="0 0 80 80" width="96" height="96"><circle cx="40" cy="40" r="32" fill="none" stroke="${t.c1}22" stroke-width="9"/><circle cx="40" cy="40" r="32" fill="none" stroke="${t.c1}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(0.72 * 201).toFixed(1)} 201" transform="rotate(-90 40 40)"/><text x="40" y="45" text-anchor="middle" font-size="17" font-weight="800" fill="#14161B" font-family="inherit">72%</text></svg>
<div class="m"><b>Meta diaria</b><span>7,200 de 10,000 pasos</span><small>${ic("flame", 13)} Racha de 5 días</small></div></div>`, `
.c{display:flex;align-items:center;gap:16px;background:${t.c0};border-radius:${t.r};padding:16px;box-shadow:0 4px 18px rgba(20,22,27,.06);border:1px solid rgba(0,0,0,.05)}
.m{display:grid;gap:3px}.m b{font-size:16px;color:#14161B}.m span{font-size:12px;color:#6B7280}.m small{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:${t.c2};margin-top:4px}`];

D["data.bars"] = t => {
  const d = [["L", 40], ["M", 62], ["X", 48], ["J", 86], ["V", 58], ["S", 30], ["D", 44]];
  return [`
<div class="c"><div class="tp"><b>Esta semana</b><small>+8%</small></div><div class="bs">${d.map(([l, h], i) => `<div class="b"><i class="${i === 3 ? "on" : ""}" style="height:${h}px"></i><span>${l}</span></div>`).join("")}</div></div>`, `
.c{background:${t.c0};border-radius:${t.r};padding:16px;box-shadow:0 4px 18px rgba(20,22,27,.06);border:1px solid rgba(0,0,0,.05)}
.tp{display:flex;justify-content:space-between;align-items:center}.tp b{font-size:15px;color:#14161B}.tp small{font-size:12px;font-weight:800;color:#16A34A}
.bs{display:flex;justify-content:space-between;align-items:flex-end;height:112px;margin-top:10px}.b{display:grid;justify-items:center;gap:6px;flex:1}
.b i{width:22px;border-radius:8px;background:${t.c1}33}.b i.on{background:${t.c1}}.b span{font-size:11px;color:#8A8F98}`];
};

D["data.balance"] = t => [`
<div class="c"><small>Saldo total</small><b>$12,480.50</b><div class="cd"><span>•••• 4821</span><span>12/28</span></div>
<div class="ac"><button>${ic("arrowUp", 16, 2.6)}Enviar</button><button>${ic("arrowDown", 16, 2.6)}Recibir</button><button>${ic("plus", 16, 2.6)}Añadir</button></div></div>`, `
.c{background:linear-gradient(135deg,${t.c0},${mix(t.c0, t.c1, .6)});border-radius:${t.r};padding:18px;color:${inkOn(t.c0)};box-shadow:0 14px 30px ${t.c0}55}
small{font-size:12px;opacity:.8}b{display:block;font-size:30px;letter-spacing:-.8px;margin:2px 0 14px}
.cd{display:flex;justify-content:space-between;font-size:12px;opacity:.85;font-family:ui-monospace,monospace}
.ac{display:flex;gap:8px;margin-top:16px}.ac button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:4px;padding:10px;border-radius:999px;background:rgba(255,255,255,.2);color:inherit;font-size:12px;font-weight:700}`];

D["data.streak"] = t => [`
<div class="c"><div class="tp"><span class="fl">${ic("flame", 22)}</span><div><b>7 días seguidos</b><small>¡Vas genial!</small></div></div>
<div class="ds">${["L", "M", "X", "J", "V", "S", "D"].map((d, i) => `<div class="d${i < 5 ? " on" : ""}">${i < 5 ? ic("check", 14, 3) : ""}<span>${d}</span></div>`).join("")}</div></div>`, `
.c{background:${t.c0};border-radius:${t.r};padding:16px;box-shadow:0 4px 18px rgba(20,22,27,.06);border:1px solid rgba(0,0,0,.05)}
.tp{display:flex;align-items:center;gap:12px}.fl{width:44px;height:44px;border-radius:14px;background:${t.c1}22;color:${t.c1};display:grid;place-items:center}
.tp b{display:block;font-size:15px;color:#14161B}.tp small{font-size:12px;color:#6B7280}
.ds{display:flex;justify-content:space-between;margin-top:16px}.d{display:grid;justify-items:center;gap:6px}
.d::before{content:"";display:none}.d svg{width:28px;height:28px;padding:7px;border-radius:50%;background:${t.c1};color:${inkOn(t.c1)}}
.d:not(.on)::before{display:block;width:28px;height:28px;border-radius:50%;background:#EEF0F3}.d span{font-size:11px;color:#8A8F98}`];

/* ───────── FORMULARIOS ───────── */

D["form.login"] = t => [`
<form class="f" onsubmit="return false"><h3>Inicia sesión</h3>
<label><span>Correo</span><div class="in">${ic("mail", 18)}<i>lucia@correo.com</i></div></label>
<label><span>Contraseña</span><div class="in">${ic("lock", 18)}<i>••••••••</i>${ic("eye", 18)}</div></label>
<a>¿Olvidaste tu contraseña?</a><button class="cta">Entrar</button></form>`, `
.f{background:${t.c0};border-radius:${t.r};padding:18px;display:grid;gap:12px;box-shadow:0 8px 24px rgba(20,22,27,.08);border:1px solid rgba(0,0,0,.05)}
h3{font-size:19px;color:#14161B}label{display:grid;gap:6px}label span{font-size:12px;font-weight:700;color:#4B5563}
.in{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:calc(${t.rad}px - 4px);background:#F3F4F7;color:#9AA0AA;border:1.5px solid transparent}.in i{flex:1;font-style:normal;font-size:14px;color:#14161B}
a{justify-self:end;font-size:12px;font-weight:700;color:${t.c1}}
.cta{padding:14px;border-radius:calc(${t.rad}px - 4px);background:${t.c1};color:${inkOn(t.c1)};font-weight:700;font-size:15px}`];

D["form.otp"] = t => [`
<div class="c"><h3>Verifica tu código</h3><p>Enviamos 4 dígitos a +34 ••• 456</p><div class="bx"><b>4</b><b>8</b><b class="cur"></b><b></b></div><small>Reenviar en <em>0:24</em></small></div>`, `
.c{text-align:center;background:${t.c0};border-radius:${t.r};padding:20px;box-shadow:0 8px 24px rgba(20,22,27,.08);border:1px solid rgba(0,0,0,.05)}
h3{font-size:18px;color:#14161B}p{font-size:13px;color:#6B7280;margin:4px 0 16px}
.bx{display:flex;gap:10px;justify-content:center}.bx b{width:52px;height:60px;border-radius:14px;background:#F3F4F7;display:grid;place-items:center;font-size:24px;color:#14161B;border:2px solid transparent}
.bx .cur{border-color:${t.c1};background:#fff;box-shadow:0 0 0 4px ${t.c1}22}small{display:block;margin-top:16px;font-size:12px;color:#6B7280}em{font-style:normal;font-weight:800;color:${t.c1}}`];

D["form.toggles"] = t => {
  const sw = on => `<span class="sw${on ? " on" : ""}"><i></i></span>`;
  const row = (n, d, on) => `<div class="r"><div><b>${n}</b><small>${d}</small></div>${sw(on)}</div>`;
  return [`<div class="l">${row("Notificaciones push", "Avisos de actividad", 1)}${row("Correos semanales", "Resumen de novedades", 0)}${row("Sonidos", "Efectos en la app", 1)}</div>`, `
.l{background:${t.c0};border-radius:${t.r};padding:4px 16px;box-shadow:0 4px 18px rgba(20,22,27,.06);border:1px solid rgba(0,0,0,.05)}
.r{display:flex;justify-content:space-between;align-items:center;padding:13px 0;border-bottom:1px solid #EEF0F3}.r:last-child{border:0}
.r b{display:block;font-size:14px;color:#14161B}.r small{font-size:12px;color:#8A8F98}
.sw{width:48px;height:28px;border-radius:14px;background:#D5D8DE;position:relative;flex:none}.sw i{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25)}
.sw.on{background:${t.c1}}.sw.on i{left:23px}`];
};

D["form.segment"] = t => [`
<div class="sg"><button class="on">Día</button><button>Semana</button><button>Mes</button></div>`, `
.sg{display:flex;background:${t.c0};border-radius:${t.pill};padding:4px}
button{flex:1;padding:10px;border-radius:${t.pill};font-size:14px;font-weight:700;color:${mix(t.c0, t.c2, .65)}}
.on{background:${t.c1};color:${inkOn(t.c1)};box-shadow:0 4px 10px ${t.c1}55}`];

D["form.field"] = t => [`
<div class="w">
  <label><span>Nombre</span><div class="in">Lucía Ramos</div></label>
  <label><span>Correo</span><div class="in ok"><i>lucia@correo.com</i>${ic("check", 18, 3)}</div><small class="g">Correo verificado</small></label>
  <label><span>Teléfono</span><div class="in er"><i>612 34</i>${ic("alert", 18)}</div><small class="e">Faltan dígitos en el número</small></label>
</div>`, `
.w{display:grid;gap:12px}label{display:grid;gap:5px}label span{font-size:12px;font-weight:700;color:#4B5563}
.in{display:flex;align-items:center;gap:8px;padding:12px 14px;border-radius:calc(${t.rad}px - 4px);background:#fff;border:1.5px solid #D5D8DE;font-size:14px;color:#14161B}.in i{flex:1;font-style:normal}
.ok{border-color:#16A34A}.ok svg{color:#16A34A}.er{border-color:#DC2626;background:#FEF2F2}.er svg{color:#DC2626}
small{font-size:12px}.g{color:#16A34A}.e{color:#DC2626}`];

/* ───────── AVISOS ───────── */

D["notice.toast"] = t => [`
<div class="t">${ic("check", 18, 3)}<span>Elemento eliminado</span><button>Deshacer</button></div>`, `
.t{display:flex;align-items:center;gap:10px;background:${t.c0};color:${t.c2};padding:12px 14px;border-radius:${t.r};box-shadow:0 12px 28px rgba(0,0,0,.3)}
.t svg{color:#22C55E}.t span{flex:1;font-size:14px;font-weight:600}button{font-size:13px;font-weight:800;color:${t.c1}}`];

D["notice.banner"] = t => {
  const b = (i, c, bg, a, d) => `<div class="b" style="background:${bg};color:${c}">${ic(i, 20)}<div><b>${a}</b><small>${d}</small></div></div>`;
  return [`<div class="w">${b("check", "#166534", "#DCFCE7", "Pago recibido", "Tu pedido está en camino.")}${b("alert", "#92400E", "#FEF3C7", "Batería baja", "Conecta el cargador pronto.")}${b("info", "#991B1B", "#FEE2E2", "Sin conexión", "Revisa tu red e inténtalo de nuevo.")}</div>`, `
.w{display:grid;gap:8px}.b{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:${t.r}}.b svg{margin-top:1px}
.b b{display:block;font-size:14px}.b small{font-size:12px;opacity:.85}`];
};

D["notice.empty"] = t => [`
<div class="c"><svg viewBox="0 0 120 90" width="140" height="105"><rect x="16" y="22" width="88" height="56" rx="12" fill="${t.c1}1F"/><rect x="26" y="34" width="44" height="7" rx="3.5" fill="${t.c1}66"/><rect x="26" y="48" width="64" height="6" rx="3" fill="${t.c1}33"/><circle cx="92" cy="26" r="14" fill="${t.c1}"/><path d="M86 26h12M92 20v12" stroke="${inkOn(t.c1)}" stroke-width="3" stroke-linecap="round"/></svg><h3>Aún no hay nada aquí</h3><p>Cuando guardes algo aparecerá en esta lista.</p><button>Crear el primero</button></div>`, `
.c{text-align:center;display:grid;justify-items:center;gap:4px;padding:8px}
h3{font-size:17px;color:${t.c0}}p{font-size:13px;color:#6B7280;margin-bottom:10px}
button{padding:11px 22px;border-radius:999px;background:${t.c1};color:${inkOn(t.c1)};font-weight:700;font-size:14px}`];

D["notice.badges"] = t => [`
<div class="w"><div class="r"><span class="ib">${ic("bell", 22)}<em>3</em></span><span class="ib">${ic("chat", 22)}<em class="d"></em></span><span class="ib">${ic("cart", 22)}<em>12</em></span></div>
<div class="r"><span class="p n">Nuevo</span><span class="p g"><i></i>En línea</span><span class="p w2">Pendiente</span><span class="p x">Agotado</span></div></div>`, `
.w{display:grid;gap:16px}.r{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.ib{position:relative;width:46px;height:46px;border-radius:14px;background:${t.c0};color:#14161B;display:grid;place-items:center;box-shadow:0 2px 10px rgba(0,0,0,.07)}
em{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;border-radius:10px;background:${t.c1};color:${inkOn(t.c1)};font-style:normal;font-size:11px;font-weight:800;display:grid;place-items:center;padding:0 5px;border:2px solid #fff}
em.d{min-width:12px;width:12px;height:12px;top:-3px;right:-3px;padding:0}
.p{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:999px;font-size:12px;font-weight:700}
.n{background:${t.c1};color:${inkOn(t.c1)}}.g{background:#DCFCE7;color:#166534}.g i{width:7px;height:7px;border-radius:50%;background:#22C55E}.w2{background:#FEF3C7;color:#92400E}.x{background:#F0F1F4;color:#6B7280}`];

/* ───────── EXTRAS: tarjetas, botones, barras, encabezados, plantillas ───────── */

D["card.review"] = t => [`
<article class="c"><div class="tp"><span class="av">${ic("user", 20)}</span><div class="m"><b>María G.</b><small>Compra verificada</small></div>${stars(5, t.c1)}</div>
<p>Calidad excelente y llegó antes de lo previsto. Lo volvería a comprar sin dudar.</p><small class="dt">Hace 2 días · ${ic("heart", 12)} 18</small></article>`, `
.c{background:${t.c0};border-radius:${t.r};padding:16px;box-shadow:0 4px 18px rgba(20,22,27,.06);border:1px solid rgba(0,0,0,.05)}
.tp{display:flex;align-items:center;gap:10px}.av{width:40px;height:40px;border-radius:50%;background:${t.c1}22;color:${t.c1};display:grid;place-items:center}
.m{flex:1;display:grid}.m b{font-size:14px;color:#14161B}.m small{font-size:11px;color:#16A34A}
p{font-size:13px;line-height:1.5;color:#374151;margin:12px 0 8px}.dt{display:flex;gap:4px;align-items:center;font-size:11px;color:#9AA0AA}`];

D["card.ticket"] = t => [`
<article class="c"><div class="tp"><small>CONCIERTO</small><h3>Noche de Jazz</h3><div class="rw"><span>${ic("calendar", 14)}12 Dic</span><span>${ic("clock", 14)}20:30</span><span>${ic("pin", 14)}Sala Sol</span></div></div>
<div class="cut"><i></i><u></u><i></i></div>
<div class="bt"><div class="qr">${Array.from({ length: 25 }, (_, i) => `<b class="${(i * 7 + 3) % 3 === 0 ? "k" : ""}"></b>`).join("")}</div><div><small>Entrada</small><strong>A-142</strong></div></div></article>`, `
.c{background:${t.c0};border-radius:${t.r};box-shadow:0 10px 28px rgba(20,22,27,.12);overflow:hidden}
.tp{padding:16px 16px 14px;background:linear-gradient(135deg,${t.c1},${mix(t.c1, "#EC4899", .5)});color:${inkOn(t.c1)}}.tp small{font-size:10px;font-weight:800;letter-spacing:1.5px;opacity:.85}
h3{font-size:20px;margin:4px 0 10px}.rw{display:flex;gap:12px;font-size:12px}.rw span{display:inline-flex;align-items:center;gap:4px}
.cut{display:flex;align-items:center;margin:-1px 0}.cut i{width:16px;height:16px;border-radius:50%;background:#F3F5F8;margin:0 -8px;flex:none}.cut u{flex:1;border-top:2px dashed #D5D8DE;margin:0 12px}
.bt{display:flex;align-items:center;justify-content:space-between;padding:12px 18px 16px}.bt small{display:block;font-size:11px;color:#8A8F98}.bt strong{font-size:22px;color:#14161B}
.qr{display:grid;grid-template-columns:repeat(5,8px);gap:2px}.qr b{width:8px;height:8px;background:#E5E7EB;border-radius:1px}.qr .k{background:#14161B}`];

D["card.player"] = t => [`
<article class="c"><div class="cv"><svg viewBox="0 0 60 60" width="60" height="60"><circle cx="30" cy="30" r="26" fill="#fff" opacity=".25"/><circle cx="30" cy="30" r="9" fill="#fff"/></svg></div>
<div class="m"><b>Neón de madrugada</b><small>Lumen</small></div>
<div class="pg"><i></i></div><div class="tm"><span>1:24</span><span>3:42</span></div>
<div class="ct"><button>${ic("back", 20)}</button><button class="pl">${ic("play", 22)}</button><button>${ic("chevR", 20)}</button></div></article>`, `
.c{background:${t.c0};border-radius:${t.r};padding:16px;color:#fff;border:1px solid rgba(255,255,255,.07)}
.cv{height:110px;border-radius:calc(${t.rad}px - 4px);background:linear-gradient(135deg,${t.c1},${mix(t.c1, "#EC4899", .6)});display:grid;place-items:center}
.m{display:grid;margin:12px 0 10px}.m b{font-size:16px}.m small{font-size:12px;color:#9BA3B4}
.pg{height:4px;border-radius:2px;background:rgba(255,255,255,.14)}.pg i{display:block;width:38%;height:100%;border-radius:2px;background:${t.c1}}
.tm{display:flex;justify-content:space-between;font-size:11px;color:#9BA3B4;margin-top:6px}
.ct{display:flex;justify-content:center;align-items:center;gap:22px;margin-top:8px}.ct button{color:#fff}.pl{width:50px;height:50px;border-radius:50%;background:${t.c1};display:grid;place-items:center}`];

D["btn.loading"] = t => [`
<div class="w"><button class="b"><i class="sp"></i>Procesando…</button><button class="b ok">${ic("check", 18, 3)}¡Listo!</button></div>`, `
.w{display:grid;gap:10px}.b{display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;border-radius:${t.r};background:${t.c0};color:${inkOn(t.c0)};font-weight:700;font-size:15px}
.sp{width:16px;height:16px;border-radius:50%;border:2.5px solid currentColor;border-right-color:transparent;animation:s .8s linear infinite}
.ok{background:#16A34A;color:#fff}@keyframes s{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.sp{animation:none}}`];

D["btn.social"] = t => [`
<div class="w"><button class="b p">${ic("mail", 18)}Continuar con correo</button><button class="b">${ic("phone", 18)}Continuar con teléfono</button><button class="b">${ic("lock", 18)}Acceso con llave</button><small>o</small></div>`, `
.w{display:grid;gap:9px;justify-items:stretch;text-align:center}small{display:none}
.b{display:flex;align-items:center;justify-content:center;gap:10px;padding:13px;border-radius:${t.pill};border:1.5px solid ${t.c1};background:${t.c0};color:${t.c2};font-weight:700;font-size:14px}
.p{background:${t.c1};color:${inkOn(t.c1)}}`];

D["bar.tabs"] = t => [`
<nav class="tb"><a class="on">Para ti</a><a>Siguiendo</a><a>Tendencias</a></nav>`, `
.tb{display:flex;gap:22px;border-bottom:1.5px solid ${t.c2}22}
a{position:relative;padding:10px 2px 12px;font-size:14px;font-weight:700;color:${t.c2}}
.on{color:${t.c0}}.on::after{content:"";position:absolute;left:0;right:0;bottom:-1.5px;height:3px;border-radius:2px;background:${t.c1}}`];

D["bar.dot"] = t => [`
<nav class="nb"><a class="on">${ic("home", 22)}<i></i></a><a>${ic("search", 22)}</a><a>${ic("heart", 22)}</a><a>${ic("user", 22)}</a></nav>`, `
.nb{display:flex;justify-content:space-around;background:${t.c0};border-radius:${t.r};padding:14px 8px 12px;box-shadow:0 6px 20px rgba(20,22,27,.1)}
a{display:grid;justify-items:center;gap:6px;color:${t.c2};width:48px}a i{width:5px;height:5px;border-radius:50%;background:transparent}
.on{color:${t.c1}}.on i{background:${t.c1}}`];

D["head.large"] = t => [`
<header><div class="tp"><h1>Mensajes</h1><button aria-label="Nuevo mensaje">${ic("edit", 20)}</button></div><div class="se">${ic("search", 18)}Buscar</div><div class="st"><span style="background:${t.c1}">${ic("plus", 18, 2.6)}</span><span style="background:#F59E0B"></span><span style="background:#10B981"></span><span style="background:#6366F1"></span></div></header>`, `
header{display:grid;gap:12px}.tp{display:flex;justify-content:space-between;align-items:center}h1{font-size:32px;font-weight:800;letter-spacing:-1px;color:${t.c0}}
button{width:42px;height:42px;border-radius:50%;background:${t.c1};color:${inkOn(t.c1)};display:grid;place-items:center}
.se{display:flex;gap:8px;align-items:center;padding:11px 14px;border-radius:12px;background:#F0F1F4;color:${t.c2};font-size:14px}
.st{display:flex;gap:12px}.st span{width:50px;height:50px;border-radius:50%;display:grid;place-items:center;color:#fff;box-shadow:0 0 0 2.5px #fff,0 0 0 4.5px #D5D8DE}.st span:first-child{box-shadow:none}`];

D["tpl.profile"] = t => [`
<div class="s"><div class="hd"><span class="av">${ic("user", 30)}</span><h3>Lucía Ramos</h3><small>lucia@correo.com</small></div>
<div class="st"><div><b>128</b><span>Pedidos</span></div><div><b>34</b><span>Favoritos</span></div><div><b>4.9</b><span>Valoración</span></div></div>
<div class="ls"><div>${ic("card", 18)}<b>Métodos de pago</b>${ic("chevR", 16)}</div><div>${ic("pin", 18)}<b>Direcciones</b>${ic("chevR", 16)}</div><div>${ic("sliders", 18)}<b>Ajustes</b>${ic("chevR", 16)}</div></div></div>`, `
${PHONE(t, t.c0)}
.hd{display:grid;justify-items:center;gap:2px;padding-top:4px}.av{width:68px;height:68px;border-radius:50%;background:${t.c1};color:${inkOn(t.c1)};display:grid;place-items:center;margin-bottom:6px;box-shadow:0 0 0 4px ${t.c1}33}
h3{font-size:18px;color:${t.c2}}.hd small{font-size:12px;color:#8A8F98}
.st{display:flex;justify-content:space-around;background:#fff;border-radius:18px;padding:12px;box-shadow:0 2px 10px rgba(0,0,0,.05)}.st div{display:grid;text-align:center}.st b{font-size:17px;color:${t.c1}}.st span{font-size:11px;color:#8A8F98}
.ls{background:#fff;border-radius:18px;padding:2px 14px;box-shadow:0 2px 10px rgba(0,0,0,.05)}.ls div{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #EEF0F3;color:${t.c1}}.ls div:last-child{border:0}.ls b{flex:1;font-size:14px;color:${t.c2}}.ls div svg:last-child{color:#B6BBC4}`];

D["tpl.aichat"] = t => [`
<div class="s"><div class="hd"><span class="av">${ic("spark", 18)}</span><div><b>Asistente</b><small>En línea</small></div></div>
<div class="ms"><p class="a">Hola, soy tu asistente. ¿En qué te ayudo hoy?</p><p class="u">Resume mi semana</p><p class="a">Completaste 12 tareas y mejoraste un 8%.</p></div>
<div class="in"><span>Escribe aquí…</span><button>${ic("arrowUp", 16, 2.8)}</button></div></div>`, `
${PHONE(t, t.c0)}
.s{grid-template-rows:auto 1fr auto}
.hd{display:flex;align-items:center;gap:10px}.av{width:38px;height:38px;border-radius:50%;background:${t.c1};color:${inkOn(t.c1)};display:grid;place-items:center}.hd b{display:block;font-size:15px;color:${t.c2}}.hd small{font-size:11px;color:#22C55E}
.ms{display:grid;gap:8px;align-content:start}.ms p{max-width:80%;padding:10px 13px;font-size:13px;line-height:1.4}
.a{background:#fff;color:${t.c2};border-radius:16px 16px 16px 4px;box-shadow:0 1px 3px rgba(0,0,0,.06)}.u{justify-self:end;background:${t.c1};color:${inkOn(t.c1)};border-radius:16px 16px 4px 16px}
.in{display:flex;align-items:center;justify-content:space-between;background:#fff;border-radius:999px;padding:5px 5px 5px 16px;font-size:13px;color:#9AA0AA;box-shadow:0 2px 10px rgba(0,0,0,.06)}
.in button{width:34px;height:34px;border-radius:50%;background:${t.c1};color:${inkOn(t.c1)};display:grid;place-items:center}`];
