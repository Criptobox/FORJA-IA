/* Pantallas de recorrido: las que toda app necesita además de las pestañas de la barra.
   Bienvenida → Acceso → Inicio; una tarjeta → Detalle → Carrito → ¡Listo!; Perfil → Ajustes → Chat con la mascota.
   Cada una es un bloque de la biblioteca (rol «flow») con su propio diseño; Tinta las rellena con el contenido de
   tu sector y las enlaza con data-go (sin scripts dentro del bloque). Los textos salen de una plantilla única
   (build), así el orden de los campos editables siempre coincide. */
const TINTA_FLOWS = (() => {
  const I = (n, s = 18) => (typeof ic === 'function' ? ic(n, s) : '');
  const art = (typeof TintaArt !== 'undefined' && TintaArt.pick && TintaArt.pick('comida', 1)) || '<svg viewBox="0 0 240 140" aria-hidden="true"><rect width="240" height="140" fill="#f3e3d3"/></svg>';
  const robot = (typeof TINTA_MASCOTS !== 'undefined' && TINTA_MASCOTS.robot) ? TINTA_MASCOTS.robot('normal', false) : '';
  const back = '<button class="back" data-go="back" aria-label="Volver">' + I('back', 18) + '</button>';
  const SOFT = 'background:linear-gradient(140deg,#fff,#f6f4ed);border:1px solid #fff;box-shadow:5px 8px 15px #514a3210;';
  const BTN = '.go{display:block;width:100%;background:#242421;color:#fff;border-radius:999px;padding:15px 18px;font-size:14px;font-weight:600;text-align:center}';
  const TOP = '.top{display:flex;align-items:center;gap:10px;margin-bottom:14px}.top h2{font-size:20px;font-weight:600;letter-spacing:-.6px}.back{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:#fff;color:#242421;box-shadow:2px 3px 8px #514a3214;flex:none}';
  const money = s => { const n = parseFloat(String(s).replace(/[^\d.]/g, '')); return isFinite(n) ? n : 0; };
  const fmt = n => '$' + n.toFixed(2);

  /* Textos por defecto (cafetería) y plantillas: build(t) devuelve el HTML con esos textos. */
  const DEF = {
    bienvenida: { app: 'Tinta', title: 'Tu pausa favorita', text: 'Elige tu favorito y lo llevamos a tu mesa.', go: 'Empezar', link: 'Ya tengo cuenta' },
    acceso: { title: 'Hola de nuevo', text: 'Entra para seguir en Tinta.', forgot: '¿Olvidaste tu contraseña?', go: 'Entrar', or: 'o continúa con', g: 'Google', a: 'Apple', q: '¿No tienes cuenta?', reg: 'Regístrate', mail: 'Correo electrónico', pass: 'Contraseña' },
    detalle: { title: 'Café de la casa', tag: 'Recién preparado', text: 'Preparado al momento con ingredientes frescos. Hecho a diario por manos de barrio.', c1: 'Hecho hoy', c2: 'Listo en 10 min', c3: '4.8', price: '$4.50', qty: '1', go: 'Añadir al pedido' },
    carrito: { title: 'Tu pedido', items: [['Capuchino', '$4.50'], ['Croissant', '$6.90'], ['Combo desayuno', '$8.50']], sub: 'Subtotal', subv: '$19.90', ship: 'Envío', shipv: 'Gratis', total: 'Total', totalv: '$19.90', go: 'Pagar pedido' },
    listo: { title: '¡Pedido en camino!', text: 'Llegará en unos 25 minutos.', go: 'Volver al inicio', link: 'Ver mi pedido' },
    ajustes: { title: 'Ajustes', name: 'Tu cuenta', mail: 'hola@tinta.app', r1: 'Notificaciones', r2: 'Modo oscuro', r3: 'Idioma', r3v: 'Español', r4: 'Hablar con el asistente', r5: 'Privacidad', out: 'Cerrar sesión' },
    chat: { name: 'Tinta IA', status: 'En línea · responde al momento', q: '¿Qué me recomiendas para desayunar?', a: 'Te va a encantar el combo desayuno: capuchino y croissant recién horneado. ¿Lo añado a tu pedido?', chip1: 'Sí, añádelo', chip2: 'Ver el menú', ph: 'Escribe un mensaje…' }
  };
  const BUILD = {
    bienvenida: t => `<section class="wel"><div class="brand">${t.app}</div><div class="media">${art}</div><div class="dots" aria-hidden="true"><i class="on"></i><i></i><i></i></div><h1>${t.title}</h1><p>${t.text}</p><button class="go" data-go="acceso">${t.go}</button><button class="link" data-go="acceso">${t.link}</button></section>`,
    acceso: t => `<section class="log"><div class="lk" aria-hidden="true">${I('lock', 22)}</div><h1>${t.title}</h1><p>${t.text}</p><label><span class="sr">${t.mail}</span><input type="email" placeholder="${t.mail}" autocomplete="email"></label><label><span class="sr">${t.pass}</span><input type="password" placeholder="${t.pass}" autocomplete="current-password"></label><a class="forgot" href="#">${t.forgot}</a><button class="go" data-go="inicio">${t.go}</button><div class="or"><span>${t.or}</span></div><div class="soc"><button data-go="inicio">${t.g}</button><button data-go="inicio">${t.a}</button></div><p class="reg">${t.q} <a href="#" data-go="inicio">${t.reg}</a></p></section>`,
    detalle: t => `<section class="det"><div class="top">${back}<button class="like" aria-label="Guardar">${I('heart', 18)}</button></div><div class="media">${art}</div><span class="tag">${t.tag}</span><h1>${t.title}</h1><p>${t.text}</p><div class="chips"><span>${t.c1}</span><span>${t.c2}</span><span>★ ${t.c3}</span></div><div class="buy"><b>${t.price}</b><div class="qty"><button aria-label="Quitar uno">${I('minus', 16)}</button><span>${t.qty}</span><button aria-label="Añadir uno">${I('plus', 16)}</button></div></div><button class="go" data-go="carrito">${t.go}</button></section>`,
    carrito: t => `<section class="cart"><div class="top">${back}<h2>${t.title}</h2></div><ul>${t.items.map(([n, p], i) => `<li><span class="th th${i}" aria-hidden="true">${I('bag', 18)}</span><div><b>${n}</b><small>1 ×</small></div><span class="pr">${p}</span></li>`).join('')}</ul><dl><div><dt>${t.sub}</dt><dd>${t.subv}</dd></div><div><dt>${t.ship}</dt><dd>${t.shipv}</dd></div><div class="tot"><dt>${t.total}</dt><dd>${t.totalv}</dd></div></dl><button class="go" data-go="listo">${t.go}</button></section>`,
    listo: t => `<section class="ok"><div class="ring" aria-hidden="true"><span>${I('check', 40)}</span></div><h1>${t.title}</h1><p>${t.text}</p><button class="go" data-go="inicio">${t.go}</button><button class="link" data-go="inicio">${t.link}</button></section>`,
    ajustes: t => `<section class="set"><div class="top">${back}<h2>${t.title}</h2></div><div class="me"><span class="ini" aria-hidden="true">${I('user', 22)}</span><div><b>${t.name}</b><small>${t.mail}</small></div></div><ul><li>${I('bell', 18)}<span>${t.r1}</span><button role="switch" aria-checked="true" aria-label="${t.r1}"><i></i></button></li><li>${I('moon', 18)}<span>${t.r2}</span><button role="switch" aria-checked="false" aria-label="${t.r2}"><i></i></button></li><li>${I('info', 18)}<span>${t.r3}</span><em>${t.r3v}</em></li><li class="nav" data-go="chat">${I('chat', 18)}<span>${t.r4}</span>${I('chevR', 16)}</li><li>${I('lock', 18)}<span>${t.r5}</span>${I('chevR', 16)}</li></ul><button class="out" data-go="bienvenida">${t.out}</button></section>`,
    chat: t => `<section class="chat"><div class="top">${back}<div class="rb">${robot}</div><div><h2>${t.name}</h2><small>${t.status}</small></div></div><div class="msgs"><p class="me">${t.q}</p><div class="bot"><div class="rb sm">${robot}</div><p>${t.a}</p></div><div class="chips"><button>${t.chip1}</button><button>${t.chip2}</button></div></div><div class="bar"><input placeholder="${t.ph}" aria-label="${t.ph}"><button class="send" aria-label="Enviar">${I('send', 18)}</button></div></section>`
  };
  const CSS = {
    bienvenida: `.wel{${SOFT}border-radius:30px;padding:20px 18px 18px;display:grid;gap:10px;text-align:center}.brand{font-size:15px;font-weight:700;letter-spacing:-.3px}.media{border-radius:24px;overflow:hidden;aspect-ratio:12/9}.media>svg{width:100%;height:100%;display:block}.dots{display:flex;gap:6px;justify-content:center}.dots i{width:7px;height:7px;border-radius:9px;background:#d8d3c6}.dots i.on{width:22px;background:#ff704b}.wel h1{font-size:28px;font-weight:600;letter-spacing:-1.2px;line-height:1.05}.wel p{font-size:13px;color:#5f5a4d;margin-bottom:6px}${BTN}.link{background:none;font-size:13px;font-weight:600;color:#242421;padding:6px}`,
    acceso: `.log{${SOFT}border-radius:30px;padding:24px 18px;display:grid;gap:10px}.lk{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:#ffe7dd;color:#b8472a}.log h1{font-size:26px;font-weight:600;letter-spacing:-1px}.log>p{font-size:13px;color:#5f5a4d;margin-bottom:6px}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}input{width:100%;font:inherit;font-size:14px;padding:14px 16px;border-radius:16px;border:1px solid #e4e0d5;background:#fff;color:#242421}.forgot{justify-self:end;font-size:12px;color:#5f5a4d}${BTN}.or{display:flex;align-items:center;gap:10px;font-size:11px;color:#6f6a5c}.or::before,.or::after{content:"";flex:1;height:1px;background:#e4e0d5}.soc{display:grid;grid-template-columns:1fr 1fr;gap:8px}.soc button{background:#fff;border:1px solid #e4e0d5;border-radius:999px;padding:12px;font-size:13px;font-weight:600;color:#242421}.reg{text-align:center;font-size:12px;color:#5f5a4d}.reg a{color:#242421;font-weight:700}`,
    detalle: `.det{${SOFT}border-radius:30px;padding:14px 16px 18px;display:grid;gap:9px}${TOP}.top{justify-content:space-between;margin:0}.like{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:#fff;color:#c2335f}.media{border-radius:24px;overflow:hidden;aspect-ratio:12/8}.media>svg{width:100%;height:100%;display:block}.tag{justify-self:start;background:#ffe7dd;color:#8f3315;border-radius:999px;padding:5px 11px;font-size:11px;font-weight:600}.det h1{font-size:25px;font-weight:600;letter-spacing:-1px}.det p{font-size:13px;color:#5f5a4d;line-height:1.45}.chips{display:flex;flex-wrap:wrap;gap:6px}.chips span{border:1px solid #e4e0d5;border-radius:999px;padding:6px 10px;font-size:11px;color:#3f3b31;background:#fff}.buy{display:flex;align-items:center;justify-content:space-between;margin-top:4px}.buy b{font-size:24px;letter-spacing:-.8px}.qty{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e4e0d5;border-radius:999px;padding:5px}.qty button{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#f3f1ec;color:#242421}.qty span{font-weight:700;font-size:14px}${BTN}`,
    carrito: `.cart{${SOFT}border-radius:30px;padding:14px 16px 18px;display:grid;gap:10px}${TOP}.cart ul{list-style:none;padding:0;display:grid;gap:8px}.cart li{display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:10px;background:#fff;border-radius:18px;padding:10px;border:1px solid #efece4}.th{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;color:#242421}.th0{background:#ffe7dd}.th1{background:#e3f0ea}.th2{background:#e7e1f2}.cart li b{display:block;font-size:14px;font-weight:600}.cart li small{font-size:11px;color:#6f6a5c}.pr{font-weight:700;font-size:14px}dl{display:grid;gap:6px;margin:6px 0;padding-top:10px;border-top:1px dashed #ddd8cb}dl div{display:flex;justify-content:space-between;font-size:13px;color:#5f5a4d}dd{margin:0;font-weight:600;color:#242421}.tot{font-size:16px!important;color:#242421!important;font-weight:700}.tot dd{font-size:18px}${BTN}`,
    listo: `.ok{${SOFT}border-radius:30px;padding:34px 18px 20px;display:grid;justify-items:center;gap:10px;text-align:center}.ring{width:112px;height:112px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#dff5e8 55%,#eefaf3 56%);margin-bottom:6px}.ring span{width:72px;height:72px;border-radius:50%;display:grid;place-items:center;background:#1f8a4c;color:#fff;box-shadow:0 10px 22px #1f8a4c40}.ok h1{font-size:26px;font-weight:600;letter-spacing:-1px}.ok p{font-size:13px;color:#5f5a4d;margin-bottom:10px}${BTN}.link{background:none;font-size:13px;font-weight:600;color:#242421;padding:6px}@media(prefers-reduced-motion:no-preference){.ring span{animation:pop .6s cubic-bezier(.2,1.4,.4,1) both}@keyframes pop{from{transform:scale(.3);opacity:0}}}`,
    ajustes: `.set{${SOFT}border-radius:30px;padding:14px 16px 18px;display:grid;gap:10px}${TOP}.me{display:flex;align-items:center;gap:12px;background:#fff;border-radius:20px;padding:12px;border:1px solid #efece4}.ini{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:#ffe7dd;color:#8f3315}.me b{display:block;font-size:15px}.me small{font-size:11px;color:#6f6a5c}.set ul{list-style:none;padding:0;background:#fff;border-radius:20px;border:1px solid #efece4;overflow:hidden}.set li{display:flex;align-items:center;gap:12px;padding:13px 14px;font-size:14px;color:#242421}.set li+li{border-top:1px solid #f0ede5}.set li span{flex:1}.set li.nav{cursor:pointer}.set em{font-style:normal;font-size:12px;color:#6f6a5c}[role=switch]{width:44px;height:26px;border-radius:99px;background:#d8d3c6;position:relative;flex:none}[role=switch] i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s}[role=switch][aria-checked=true]{background:#1f8a4c}[role=switch][aria-checked=true] i{transform:translateX(18px)}.out{background:none;color:#b42318;font-weight:700;font-size:14px;padding:10px}`,
    chat: `.chat{background:linear-gradient(180deg,#fff,#f6f4ed);border:1px solid #fff;box-shadow:5px 8px 15px #514a3210;border-radius:30px;padding:14px 14px 12px;display:grid;gap:10px}${TOP}.top{margin:0;padding-bottom:10px;border-bottom:1px solid #efece4}.top h2{font-size:16px}.top small{font-size:11px;color:#1f7a4a}.rb{width:42px;height:42px;flex:none}.rb svg{width:100%;height:100%;display:block}.rb.sm{width:30px;height:30px;align-self:end}.msgs{display:grid;gap:10px;padding:6px 0}.msgs p{font-size:13px;line-height:1.4;padding:11px 13px;border-radius:18px;max-width:84%}.me{justify-self:end;background:#242421;color:#fff;border-bottom-right-radius:6px}.bot{display:flex;gap:8px}.bot p{background:#fff;border:1px solid #efece4;color:#242421;border-bottom-left-radius:6px}.chips{display:flex;gap:6px;padding-left:38px;flex-wrap:wrap}.chips button{background:#fff;border:1px solid #ffb08f;color:#8f3315;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:600}.bar{display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #e4e0d5;border-radius:999px;padding:5px 5px 5px 14px}.bar input{flex:1;border:0;font:inherit;font-size:13px;background:none;color:#242421;outline:0}.send{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#ff704b;color:#2a1408}@media(prefers-reduced-motion:no-preference){.msgs>*{animation:in .4s ease both}.bot{animation-delay:.25s!important}.chips{animation-delay:.45s!important}@keyframes in{from{opacity:0;transform:translateY(8px)}}}`
  };
  const META = {
    bienvenida: ['Bienvenida', 'Ilustración, título, puntos de avance y empezar.', '#f3e3d3', '☀'],
    acceso: ['Iniciar sesión', 'Correo, contraseña, entrar y acceso con Google o Apple.', '#ffe7dd', '⚿'],
    detalle: ['Detalle', 'Imagen grande, etiqueta, descripción, cantidad y precio.', '#efe9dd', '▣'],
    carrito: ['Carrito', 'Productos, subtotal, envío, total y pagar.', '#e3f0ea', '⊞'],
    listo: ['Confirmación', 'Check animado, mensaje y volver al inicio.', '#dff5e8', '✓'],
    ajustes: ['Ajustes', 'Cuenta, interruptores, idioma, asistente y cerrar sesión.', '#ece9e1', '⚙'],
    chat: ['Chat con asistente', 'La mascota robot responde con sugerencias rápidas.', '#e7e1f2', '✉']
  };
  const BLOCKS = Object.keys(BUILD).map(k => ({ id: 'f-' + k, role: 'flow', flow: k, name: META[k][0], desc: META[k][1], color: META[k][2], glyph: META[k][3], html: BUILD[k](DEF[k]), css: CSS[k] }));

  /* Textos de cada sector. S: sector de TintaSectors; app: nombre de la app. */
  const DONE = {
    comida: ['¡Pedido en camino!', 'Llegará en unos 25 minutos.', 'Ver mi pedido', 'Pagar pedido'],
    tienda: ['¡Compra confirmada!', 'Te avisaremos cuando salga tu pedido.', 'Ver mi compra', 'Pagar ahora'],
    viajes: ['¡Reserva confirmada!', 'Te enviamos los detalles a tu correo.', 'Ver mi reserva', 'Confirmar reserva'],
    salud: ['¡Cita agendada!', 'Te recordaremos un día antes.', 'Ver mis citas', 'Confirmar cita'],
    fitness: ['¡Entrenamiento completado!', 'Sumaste 320 kcal. Sigue así.', 'Ver mi progreso', 'Empezar'],
    educacion: ['¡Lección completada!', 'Llevas 5 días seguidos aprendiendo.', 'Ver mi avance', 'Continuar'],
    musica: ['¡Lista guardada!', 'Ya puedes escucharla sin conexión.', 'Ir a mi biblioteca', 'Guardar lista'],
    finanzas: ['¡Transferencia enviada!', 'El dinero llegará en unos segundos.', 'Ver movimiento', 'Enviar']
  };
  const CHAT = {
    comida: ['¿Qué me recomiendas para desayunar?', 'Te va a encantar el combo desayuno: capuchino y croissant recién horneado. ¿Lo añado a tu pedido?', 'Sí, añádelo', 'Ver el menú'],
    tienda: ['¿Tienen esta camiseta en talla M?', 'Sí, quedan 4 unidades en talla M y el envío llega mañana. ¿La añado al carrito?', 'Añadir al carrito', 'Ver tallas'],
    finanzas: ['¿Cuánto gasté este mes en comida?', 'Llevas $320 en comida, un 12 % menos que el mes pasado. ¡Vas muy bien!', 'Ver detalle', 'Crear presupuesto'],
    fitness: ['Quiero una rutina corta para hoy', 'Te preparé 20 minutos de fuerza para todo el cuerpo, sin equipo. ¿Empezamos?', 'Empezar ya', 'Otra rutina'],
    viajes: ['Ideas para un fin de semana', 'Lisboa tiene vuelos desde $120 y buen clima este mes. ¿Te muestro hoteles?', 'Ver hoteles', 'Otro destino'],
    salud: ['Necesito una cita de medicina general', 'Hay hueco mañana a las 10:30 con la Dra. Ruiz. ¿Te la reservo?', 'Reservar', 'Otro horario'],
    musica: ['Pon algo para concentrarme', 'Te armé una lista de lo-fi tranquilo de 2 horas. ¡Dale play cuando quieras!', 'Reproducir', 'Algo más movido'],
    educacion: ['No entiendo las fracciones', 'Vamos paso a paso: una fracción es una parte de un todo. ¿Vemos un ejemplo con una pizza?', 'Ver ejemplo', 'Hacer ejercicio']
  };
  const ITEMS = { comida: ['Capuchino', 'Croissant', 'Combo desayuno'], tienda: ['Camiseta de algodón', 'Zapatillas urbanas', 'Gorra clásica'], viajes: ['Vuelo a Lisboa', 'Hotel · 3 noches', 'Seguro de viaje'] };
  const at = (a, i) => (Array.isArray(a) && a.length ? a[i % a.length] : '');
  const price = p => Array.isArray(p) ? p.join('') : String(p || '');
  function texts(flow, S, app) {
    const d = DONE[S.id] || DONE.comida, c = CHAT[S.id] || CHAT.comida, slug = String(app || 'app').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '') || 'app';
    switch (flow) {
      case 'bienvenida': return { ...DEF.bienvenida, app, title: at(S.hero, 0) || at(S.titles, 0), text: at(S.texts, 1) };
      case 'acceso': return { ...DEF.acceso, text: 'Entra para seguir en ' + app + '.' };
      case 'detalle': return { ...DEF.detalle, title: at(S.titles, 0), tag: at(S.short, 0), text: at(S.texts, 0) + ' ' + at(S.texts, 3), c1: at(S.short, 1), c2: at(S.short, 2), c3: '4.8', price: price(at(S.pair, 0)), go: at(S.actions, S.id === 'comida' ? 2 : 0) };
      case 'carrito': {
        const names = ITEMS[S.id] || S.highlights || [], items = [0, 1, 2].map(i => [at(names, i), price(at(S.pair, i))]), sum = items.reduce((a, [, p]) => a + money(p), 0);
        return { ...DEF.carrito, title: S.id === 'viajes' ? 'Tu reserva' : S.id === 'comida' ? 'Tu pedido' : 'Tu carrito', items, subv: fmt(sum), totalv: fmt(sum), go: d[3] };
      }
      case 'listo': return { ...DEF.listo, title: d[0], text: d[1], link: d[2] };
      case 'ajustes': return { ...DEF.ajustes, mail: 'hola@' + slug + '.app' };
      case 'chat': return { ...DEF.chat, name: app + ' IA', q: c[0], a: c[1], chip1: c[2], chip2: c[3] };
    }
    return DEF[flow];
  }
  /* HTML del bloque con los textos del sector (para sacar los valores en el orden de los campos). */
  const html = (flow, S, app) => BUILD[flow](texts(flow, S, app));
  BLOCKS.html = html; BLOCKS.texts = texts; BLOCKS.DONE = DONE; BLOCKS.CHAT = CHAT;
  return BLOCKS;
})();
