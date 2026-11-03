/** FORJA IA — Estudio de diseño: skills de pantalla (fase 4).
 *
 * Patrones de pantalla de producto adaptados de las skills `app-*` y `flow-*`
 * y de la guía `product-ui` de Open Design Agent Kit
 * (github.com/feimacode/open-design-agent-kit, MIT — ver
 * docs/estudio-disenio/AVISOS-SKILLS.md). Solo se usan las que el kit
 * escribió él mismo: el resto de su catálogo viene de nexu-io/open-design,
 * que es Apache-2.0, y no se ha copiado.
 *
 * Por qué condensadas: las originales tienen unos 7.000 caracteres cada una
 * y piden herramientas del kit (MCP, `data-od-*`, semillas). Un modelo gratis
 * con 8k de contexto no puede con eso y el sistema de diseño del proyecto,
 * así que cada skill se queda en lo que cambia el resultado: qué lleva la
 * pantalla, qué estados tiene y qué se comprueba. Máximo `LIMITE_SKILL`
 * caracteres por skill y dos por pantalla.
 *
 * Cada skill trae además `comprobar(html)`: lo que su autocomprobación pide,
 * medido sin modelo. Esos fallos entran en la crítica y en «Corregir con IA». */

import type { Pantalla, ProyectoDiseno } from "./tipos";

/** Techo por skill: lo que cabe sin desplazar el sistema de diseño. */
export const LIMITE_SKILL = 650;
/** Skills de patrón por pantalla (más la base de producto). */
export const MAX_SKILLS_PANTALLA = 2;

export const ORIGEN_SKILLS = {
  repo: "https://github.com/feimacode/open-design-agent-kit",
  licencia: "MIT",
  autor: "Iven Xu (feimacode)",
} as const;

export interface SkillPantalla {
  id: string;
  nombre: string;
  /** ruta de la skill original dentro del kit */
  original: string;
  /** cuándo se activa sola (nombre + propósito de la pantalla, sin tildes) */
  disparadores: RegExp;
  /** solo en proyectos de app (p. ej. «Inicio» en una web es portada, no marco) */
  soloApp?: boolean;
  /** el bloque que viaja en el pedido */
  texto: string;
  /** fallos que su autocomprobación pide evitar; [] = cumple */
  comprobar: (html: string, tipo: ProyectoDiseno["tipo"]) => string[];
}

/* ------------------------------ utilidades ------------------------------ */

export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Solo el marcado y el texto visible: fuera <style>, <script> y comentarios.
 * No es un saneador (el HTML nunca se pinta desde aquí): solo prepara el
 * texto para las comprobaciones. Aun así tolera cierres como `</script >` o
 * `</script foo>`, y un bloque sin cerrar se quita hasta el final. */
function cuerpo(html: string): string {
  return html
    .replace(/<style\b[\s\S]*?(?:<\/style\b[^>]*>|$)/gi, " ")
    .replace(/<script\b[\s\S]*?(?:<\/script\b[^>]*>|$)/gi, " ")
    .replace(/<!--[\s\S]*?(?:--!?>|$)/g, " ");
}

function texto(html: string): string {
  return normalizar(cuerpo(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

const TIPOS_SIN_ETIQUETA = /type\s*=\s*["']?(hidden|submit|button|reset|image)\b/i;

/** Campos de formulario sin etiqueta: ni <label for>, ni dentro de <label>,
 * ni aria-label(ledby), ni title. El placeholder NO cuenta como etiqueta. */
export function camposSinEtiqueta(html: string): number {
  const c = cuerpo(html);
  const conFor = new Set<string>();
  for (const m of c.matchAll(/<label\b[^>]*\bfor\s*=\s*["']([^"']+)["']/gi)) conFor.add(m[1]);
  // tramos dentro de <label>…</label>: lo que haya ahí ya está etiquetado
  const dentro: [number, number][] = [];
  for (const m of c.matchAll(/<label\b[^>]*>[\s\S]*?<\/label>/gi)) dentro.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
  let sin = 0;
  for (const m of c.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
    const tag = m[0];
    if (m[1].toLowerCase() === "input" && TIPOS_SIN_ETIQUETA.test(tag)) continue;
    if (/\baria-label(ledby)?\s*=|\btitle\s*=/i.test(tag)) continue;
    const id = tag.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
    if (id && conFor.has(id)) continue;
    const pos = m.index ?? 0;
    if (dentro.some(([a, b]) => pos > a && pos < b)) continue;
    sin++;
  }
  return sin;
}

const LOREM = /lorem ipsum|\b(item|elemento|producto|usuario) [123]\b/;

/* -------------------------------- catálogo -------------------------------- */

export const SKILLS_PANTALLA: SkillPantalla[] = [
  {
    id: "producto",
    nombre: "Pantalla de producto",
    original: "craft/product-ui.md",
    disparadores: /^$/, // base: la activa `skillsParaPantalla`, no una palabra
    texto: `[Skill: pantalla de producto]
No es una página de marketing: ni hero, ni eslogan, ni testimonios. Lo primero es el trabajo (la tabla, el formulario, la ficha) y el título dice dónde está el usuario («Facturas»), no un lema.
Una zona principal que ocupa el ancho libre y como mucho una secundaria (filtros o detalle). Un solo scroll por eje.
Cada registro muestra, en este orden: nombre (lo más fuerte), estado como insignia con palabra (no solo color), 1-3 datos clave más pequeños y UNA acción principal; el resto en un menú «⋯».
Una sola densidad por pantalla. Datos realistas del sector, nunca «Elemento 1» ni lorem ipsum.`,
    comprobar: (html) => (LOREM.test(texto(html)) ? ["Hay texto de relleno (lorem ipsum o «Elemento 1»): pon datos realistas del producto."] : []),
  },
  {
    id: "marco-app",
    nombre: "Marco y navegación",
    original: "skills/app-shell/SKILL.md",
    disparadores: /\b(inicio(?! de sesion)|home|principal|panel|dashboard|escritorio|resumen|navegacion|menu)\b/,
    soloApp: true,
    texto: `[Skill: marco de la app]
Navegación con 3-7 lugares nombrados con sustantivos («Pedidos», no «Gestionar pedidos»), en el orden en que se usan; Ajustes y ayuda al final o en el menú de cuenta.
Móvil: barra inferior de 3-5 pestañas; escritorio: barra lateral de 240-280 px. Nunca las dos a la vez.
El lugar actual lleva aria-current="page" y una marca visible que no sea solo color. Cada elemento tiene texto, el icono es opcional.
Esta misma navegación (nombres y orden) se repite igual en todas las pantallas.
A 390 px nada se desplaza en horizontal.`,
    comprobar: (html) => {
      const c = cuerpo(html);
      const out: string[] = [];
      if (!/<nav\b/i.test(c)) out.push("Falta la navegación principal (<nav>) del marco de la app.");
      else if (!/aria-current\s*=/i.test(c)) out.push('La navegación no marca el lugar actual: añade aria-current="page" y un estilo visible.');
      return out;
    },
  },
  {
    id: "tabla",
    nombre: "Listado / tabla",
    original: "skills/app-table/SKILL.md",
    disparadores: /\b(mis|lista|listado|tabla|historial|pedidos|facturas|clientes|catalogo|inventario|registros|transacciones|movimientos|tareas|contactos|archivos)\b/,
    texto: `[Skill: listado]
Columnas: nombre primero (lo más fuerte), estado como insignia con palabra, 2-4 datos clave y acciones de fila al final.
Al menos 8 filas realistas y variadas (nombres largos y cortos, todos los estados, algún campo vacío). Números alineados a la derecha con font-variant-numeric: tabular-nums.
Encima: buscar, 1-2 filtros con su valor y la acción de crear a la derecha. Una columna ordenada con flecha y aria-sort. Paginación que cuenta las filas que se ven.
En móvil cada fila pasa a tarjeta (nombre, estado, un dato); la página nunca se desplaza en horizontal.
Diseña también el estado vacío: qué habrá aquí y el botón de crear.`,
    comprobar: (html) => {
      const c = cuerpo(html);
      const out: string[] = [];
      if (/<table\b/i.test(c)) {
        if (!/<th\b/i.test(c)) out.push("La tabla no tiene cabeceras <th>: cada columna debe decir qué contiene.");
        if (!/tabular-nums/i.test(html)) out.push("Las cifras de la tabla no usan font-variant-numeric: tabular-nums.");
      } else if (!/<(ul|ol)\b|role\s*=\s*["']list/i.test(c)) {
        out.push("Es un listado pero no hay lista ni tabla: usa <table> (escritorio) o <ul> de tarjetas.");
      }
      return out;
    },
  },
  {
    id: "formulario",
    nombre: "Formulario",
    original: "skills/app-form/SKILL.md",
    disparadores: /\b(formulario|crear|nuevo|nueva|editar|alta|checkout|pago|pagar|reserva|reservar|solicitud|presupuesto|datos de envio)\b/,
    texto: `[Skill: formulario]
Solo los campos que hacen falta, agrupados bajo 2-4 encabezados cortos; marca la minoría («Opcional»).
Una columna, etiqueta visible ENCIMA de cada campo (el placeholder es un ejemplo, nunca la etiqueta), ayuda debajo si el formato no es obvio; el ancho del campo se ajusta al dato.
Al final, el botón principal con el resultado («Crear factura») y luego «Cancelar». Lo destructivo, aparte y en color de peligro.
Estados: error (resumen arriba + mensaje junto al campo que diga cómo arreglarlo, sin perder lo escrito), enviando («Guardando…», mismo ancho) y éxito con el siguiente paso.`,
    comprobar: (html) => {
      const c = cuerpo(html);
      if (!/<(input|select|textarea)\b/i.test(c)) return ["Es un formulario pero no tiene campos (<input>, <select>, <textarea>)."];
      const n = camposSinEtiqueta(html);
      return n ? [`${n} campo(s) sin etiqueta visible: pon un <label for> encima de cada uno (el placeholder no vale).`] : [];
    },
  },
  {
    id: "detalle",
    nombre: "Ficha de detalle",
    original: "skills/app-detail/SKILL.md",
    disparadores: /\b(detalle|ficha|vista de|expediente|articulo)\b/,
    texto: `[Skill: ficha de detalle]
Cabecera: enlace para volver al listado, nombre del registro, su estado como insignia, 2-3 datos clave, la acción principal y un menú «⋯» para el resto. La acción encaja con el estado (abierto → «Resolver», resuelto → «Reabrir»).
Cuerpo: dos columnas en escritorio (contenido + panel de propiedades de 280-320 px) o pestañas si hay varios conjuntos grandes. Propiedades como lista de definición; un valor vacío dice «Sin definir» con forma de ponerlo.
Relacionados como listas cortas con «Ver todo». Actividad de más nueva a más antigua: quién, qué y cuándo.
En móvil el panel baja bajo el contenido.`,
    comprobar: (html) => {
      const t = texto(html);
      const c = cuerpo(html);
      return /volver|atras|aria-label\s*=\s*["'](breadcrumb|migas)/i.test(t + c) || /breadcrumb/i.test(c)
        ? []
        : ["La ficha no tiene forma de volver al listado (enlace «Volver» o migas de pan)."];
    },
  },
  {
    id: "busqueda",
    nombre: "Búsqueda",
    original: "skills/app-search/SKILL.md",
    disparadores: /\b(busca|buscar|busqueda|buscador|search|explorar|descubrir|filtrar|filtros)\b/,
    texto: `[Skill: búsqueda]
Arriba, un campo de búsqueda ancho con la consulta escrita y un botón para borrarla.
Filtros como chips o panel corto con su valor y cuántos resultados tiene cada uno (que cuadren con lo que se ve).
Resultados agrupados por tipo si hay varios; cada uno con título (resaltando los términos buscados), tipo, una línea de contexto y dónde está.
Sin consulta: búsquedas recientes y sugerencias, nunca una página en blanco.
Sin resultados: repite la consulta, sugiere otra ortografía o quitar filtros.`,
    comprobar: (html) =>
      /type\s*=\s*["']?search|role\s*=\s*["']search|<search\b/i.test(cuerpo(html))
        ? []
        : ['Falta el campo de búsqueda: usa <input type="search"> con etiqueta dentro de role="search".'],
  },
  {
    id: "ajustes",
    nombre: "Ajustes y cuenta",
    original: "skills/app-settings/SKILL.md + flow-settings",
    disparadores: /\b(ajustes|configuracion|preferencias|settings|mi cuenta|tu cuenta|perfil|privacidad|notificaciones)\b/,
    texto: `[Skill: ajustes]
Secciones en el orden en que se buscan: Perfil, Notificaciones, Seguridad, Plan, Integraciones y, al final, la zona de peligro. Solo las que el producto necesita.
Cada ajuste: etiqueta, una línea de qué hace y su control. Los interruptores se aplican al momento y dicen «Activado/Desactivado» con texto, no solo color; los campos de texto guardan con un «Guardar cambios» por sección.
Zona de peligro aparte y con borde: «Eliminar cuenta» en color de peligro, con confirmación que nombra lo que se borra.
Estados: guardado («Guardado» junto al botón) y error con el arreglo, sin perder los valores.`,
    comprobar: (html, tipo) =>
      tipo === "app" && !/eliminar|borrar|cerrar (la |mi )?cuenta|dar(se)? de baja/.test(texto(html))
        ? ["Falta la zona de peligro (eliminar la cuenta) al final de los ajustes: las tiendas de apps la exigen."]
        : [],
  },
  {
    id: "acceso",
    nombre: "Acceso y registro",
    original: "skills/flow-sign-in/SKILL.md",
    disparadores: /\b(login|acceso|acceder|entrar|iniciar sesion|inicio de sesion|registro|registrarse|crear cuenta|sign ?in|sign ?up|contrasena|verificacion|codigo de verificacion)\b/,
    texto: `[Skill: acceso]
Correo y contraseña (o los proveedores que diga el encargo), con enlaces a «Crear cuenta» y «¿Has olvidado la contraseña?».
Registro con los mínimos campos y enlace a las condiciones. Los botones sociales («Continuar con Google/Apple») del mismo tamaño, todos arriba o todos abajo del formulario, nunca mezclados.
Estados: error de credenciales (sin decir cuál falla y sin borrar el correo), correo ya registrado con enlace a entrar, y «Revisa tu correo» tras pedir el cambio de contraseña.
Campos con autocomplete correcto (email, current-password, new-password, one-time-code).`,
    comprobar: (html) => {
      const c = cuerpo(html);
      const out: string[] = [];
      if (!/type\s*=\s*["']?(email|password)|autocomplete\s*=\s*["']?(email|username|current-password)/i.test(c))
        out.push('La pantalla de acceso no tiene campos de correo/contraseña (type="email", type="password").');
      if (/type\s*=\s*["']?password/i.test(c) && !/olvid|recuperar|restablecer/.test(texto(html)))
        out.push("Falta el enlace «¿Has olvidado la contraseña?».");
      if (/type\s*=\s*["']?password/i.test(c) && !/autocomplete\s*=/i.test(c))
        out.push('Los campos de acceso no llevan autocomplete (email, current-password…).');
      return out;
    },
  },
  {
    id: "bienvenida",
    nombre: "Bienvenida / onboarding",
    original: "skills/flow-onboarding/SKILL.md",
    disparadores: /\b(bienvenida|onboarding|primeros pasos|tutorial|introduccion|empezar|comenzar|objetivos)\b/,
    texto: `[Skill: bienvenida]
Qué hace la app por esta persona en una frase, una acción principal y un enlace «Ya tengo cuenta».
Si hay pasos: indicador de progreso y forma de volver atrás en cada uno (menos el primero), y «Omitir» como opción real.
Elección de objetivos: 2-6 opciones que de verdad cambian la app.
Nunca pedir un permiso sin explicar antes por qué, en palabras del usuario; «Ahora no» es una opción válida.
El último paso lleva a una pantalla de inicio ya adaptada a lo elegido.`,
    comprobar: (html) =>
      /omitir|saltar|ahora no|mas tarde|ya tengo cuenta|iniciar sesion/.test(texto(html))
        ? []
        : ["La bienvenida no deja saltar ni entrar con cuenta: añade «Omitir» o «Ya tengo cuenta»."],
  },
  {
    id: "planes",
    nombre: "Planes y precios",
    original: "skills/flow-paywall/SKILL.md",
    disparadores: /\b(planes|precios|tarifas|suscripcion|suscribirse|premium|plan pro|paywall|pricing|mejorar plan|hazte pro)\b/,
    texto: `[Skill: planes]
2-3 planes con el recomendado marcado; precio por periodo y total junto al botón, y cómo se convierte la prueba gratis, en palabras claras.
En apps: «Restaurar compras», enlaces a Condiciones y Privacidad, y un botón de cerrar visible.
Sin urgencia falsa, sin extras marcados por defecto y sin textos para rechazar que culpan al usuario («No, no quiero ahorrar»).
Una salida honesta para seguir gratis.`,
    comprobar: (html, tipo) => {
      const t = texto(html);
      const out: string[] = [];
      if (!/(\/|al|por) ?(mes|ano)|mensual|anual|\/mes|\/ano/.test(t)) out.push("Los precios no dicen el periodo («/mes», «al año»).");
      if (tipo === "app" && !/restaurar/.test(t)) out.push("Falta «Restaurar compras» (lo exigen las tiendas de apps).");
      if (/no,? (no )?quiero (ahorrar|mejorar|ganar)/.test(t)) out.push("El texto para rechazar culpa al usuario: usa «Ahora no» o «Seguir gratis».");
      return out;
    },
  },
  {
    id: "asistente",
    nombre: "Asistente con IA",
    original: "skills/flow-ai-chat/SKILL.md",
    disparadores: /\b(chat|asistente|copiloto|bot|ia|conversacion|mensajes|preguntar)\b/,
    texto: `[Skill: asistente con IA]
Vacío: qué puede hacer aquí en una línea, 3-4 preguntas sugeridas del sector del producto y el cuadro de escribir.
Respondiendo: el mensaje del usuario, la respuesta llegando con un botón «Detener» visible y el cuadro bloqueado.
Error: causa en palabras claras y «Reintentar», sin perder el mensaje.
Resultado: la respuesta como tarjeta con acciones (guardar, compartir, editar) y botones de valoración.
Di qué no puede hacer y de dónde saca la información; si cita, muestra las fuentes. El último mensaje siempre a la vista.`,
    comprobar: (html) =>
      /<textarea\b|<input\b[^>]*type\s*=\s*["']?text/i.test(cuerpo(html))
        ? []
        : ["El asistente no tiene cuadro para escribir (<textarea> o campo de texto con etiqueta)."],
  },
];

const POR_ID = new Map(SKILLS_PANTALLA.map((s) => [s.id, s]));

export function skillPorId(id: string): SkillPantalla | undefined {
  return POR_ID.get(id);
}

/* ------------------------------- selección -------------------------------- */

/** Skills de patrón que encajan con una pantalla, por nombre y propósito.
 * Gana la que coincide en el NOMBRE; a igualdad, el orden del catálogo. */
export function skillsAutomaticas(
  pantalla: Pick<Pantalla, "nombre" | "proposito">,
  tipo: ProyectoDiseno["tipo"]
): string[] {
  const nombre = normalizar(pantalla.nombre);
  const proposito = normalizar(pantalla.proposito);
  const puntuadas: { id: string; puntos: number; orden: number }[] = [];
  SKILLS_PANTALLA.forEach((s, orden) => {
    if (s.id === "producto" || (s.soloApp && tipo !== "app")) return;
    const puntos = (s.disparadores.test(nombre) ? 2 : 0) + (s.disparadores.test(proposito) ? 1 : 0);
    if (puntos) puntuadas.push({ id: s.id, puntos, orden });
  });
  return puntuadas
    .sort((a, b) => b.puntos - a.puntos || a.orden - b.orden)
    .slice(0, MAX_SKILLS_PANTALLA)
    .map((x) => x.id);
}

/** Las skills que viajan con una pantalla: las elegidas a mano si las hay
 * (`pantalla.skills`), si no las automáticas; más la base «producto» en las
 * apps o cuando hay algún patrón de producto (una web de portada no la lleva). */
export function skillsDePantalla(
  pantalla: Pick<Pantalla, "nombre" | "proposito" | "skills">,
  tipo: ProyectoDiseno["tipo"]
): string[] {
  const elegidas = pantalla.skills
    ? pantalla.skills.filter((id) => POR_ID.has(id)).slice(0, MAX_SKILLS_PANTALLA + 1)
    : skillsAutomaticas(pantalla, tipo);
  if (pantalla.skills) return [...new Set(elegidas)];
  const base = tipo === "app" || elegidas.length > 0 ? ["producto"] : [];
  return [...new Set([...base, ...elegidas])];
}

/** El bloque para el pedido. Vacío si no hay skills. */
export function bloqueSkills(ids: readonly string[]): string {
  const textos = ids.map((id) => POR_ID.get(id)?.texto).filter((x): x is string => Boolean(x));
  if (!textos.length) return "";
  return ["## Patrones de esta pantalla (síguelos, adaptados al sistema de diseño)", ...textos].join("\n");
}

/** Fallos de los patrones activos en un HTML (sin repetir). */
export function comprobarSkills(html: string, ids: readonly string[], tipo: ProyectoDiseno["tipo"]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const s = POR_ID.get(id);
    if (!s) continue;
    for (const f of s.comprobar(html, tipo)) if (!out.includes(f)) out.push(f);
  }
  return out;
}

/** Activa o quita una skill a mano (la pantalla deja de elegirlas sola).
 * Con el cupo lleno, añadir no hace nada: hay que quitar otra antes. */
export function alternarSkill(
  pantalla: Pick<Pantalla, "nombre" | "proposito" | "skills">,
  tipo: ProyectoDiseno["tipo"],
  id: string
): string[] {
  const actual = skillsDePantalla(pantalla, tipo);
  if (actual.includes(id)) return actual.filter((x) => x !== id);
  if (!POR_ID.has(id) || actual.length >= MAX_SKILLS_PANTALLA + 1) return actual;
  return [...actual, id];
}
