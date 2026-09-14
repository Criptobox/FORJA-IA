/** Prism AI — El medidor de «esto lo ha hecho una IA».
 *
 * Prism ya traía una checklist anti-slop de cinco puntos… que **se
 * autoevaluaba el modelo**. Le pedíamos que se pusiera nota y la nota era
 * siempre buena. Es el mismo fallo sistémico de todo lo demás en este
 * proyecto: un dato que nadie comprueba.
 *
 * Esto lo comprueba. La página generada ya se ejecuta en un iframe y ya se
 * mide (scroll, texto pequeño, contraste); aquí se miden además las señas de
 * identidad de una página genérica, y se le devuelven al modelo por el mismo
 * camino que los errores de consola — que es el bucle que sí funciona.
 *
 * ——— Qué cuenta como seña y qué no ———
 *
 * Solo entra lo que se puede MEDIR en el DOM y admite una corrección concreta.
 * «Le falta personalidad» no es un hallazgo: no se puede comprobar y no se
 * puede arreglar. «Los catorce elementos redondeados comparten el mismo radio»
 * sí.
 *
 * Y hay dos señas —hero centrado, todo centrado— que en algunas direcciones
 * son una decisión legítima. Esas se dicen con su salvedad en vez de callarse:
 * un medidor que solo avisa de lo indiscutible no avisa de casi nada.
 */

/** Lo que el medidor recoge dentro de la página. Números y cadenas: nada de
 * juicios. El juicio se hace aquí fuera, donde se puede probar. */
export interface MedidasGenerico {
  /** la primera sección está centrada, tiene un h1 y una sola llamada a la acción */
  heroCentrado: boolean;
  /** grupos de 3 o más hermanos con el mismo alto y ancho y la misma forma */
  gruposIguales: number;
  /** tamaños de fuente DISTINTOS entre el texto visible */
  tamanos: number[];
  /** familia tipográfica calculada del titular principal y del cuerpo */
  familiaTitular: string;
  familiaCuerpo: string;
  /** radios de borde distintos en uso, y cuántos elementos comparten el más repetido */
  radios: number;
  radioMasRepetido: number;
  /** bloques de texto centrados y bloques de texto totales */
  centrados: number;
  bloques: number;
  /** textos de relleno encontrados, tal cual, para poder citarlos */
  relleno: string[];
  /** imágenes servidas por un generador de marcadores de posición */
  imagenesRelleno: string[];
  /** titulares que empiezan por emoji */
  emojiEnTitulos: number;
  /** elementos totales del cuerpo: para no juzgar una página de tres líneas */
  elementos: number;
  /** ids de `data-fx3d` presentes de verdad en la página pintada (p. ej.
   * "3d-malla"). Vive aquí porque comparte el mismo barrido del DOM — medirlo
   * aparte sería un segundo recorrido completo por lo mismo. */
  efectos3d: string[];
  /** ids de efectos 2D del kit (`data-fx="..."` o su clase suelta, p. ej.
   * "marquee") presentes de verdad en la página pintada. Mismo motivo que
   * `efectos3d`: un segundo barrido del DOM solo para esto sería tirar el
   * trabajo que ya hace este mismo recorrido. */
  efectos2d: string[];
}

export const MEDIDAS_VACIAS: MedidasGenerico = {
  heroCentrado: false,
  gruposIguales: 0,
  tamanos: [],
  familiaTitular: "",
  familiaCuerpo: "",
  radios: 0,
  radioMasRepetido: 0,
  centrados: 0,
  bloques: 0,
  relleno: [],
  imagenesRelleno: [],
  emojiEnTitulos: 0,
  elementos: 0,
  efectos3d: [],
  efectos2d: [],
};

/** Por debajo de esto no hay página que juzgar. Un ejemplo de tres párrafos no
 * es genérico, es corto — y acusarlo gastaría una vuelta de corrección en
 * arreglar algo que no está mal. */
export const MINIMO_ELEMENTOS = 25;

export interface SenaGenerica {
  id: string;
  detalle: string;
  /** qué hacer, en imperativo: es lo que se le manda al modelo */
  arreglo: string;
}

/** La primera familia de una lista CSS, normalizada. */
function familia(css: string): string {
  return (css || "")
    .split(",")[0]
    .replace(/["']/g, "")
    .trim()
    .toLowerCase();
}

/** Tipografías que un navegador pone cuando NADIE ha elegido ninguna. */
const POR_DEFECTO = new Set([
  "system-ui",
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
  "roboto",
  "helvetica",
  "helvetica neue",
  "arial",
  "sans-serif",
  "serif",
  "ui-sans-serif",
]);

/** Las señas, medidas. Cada una con lo que se ha visto y qué hacer con ello. */
export function senasGenericas(m: MedidasGenerico): SenaGenerica[] {
  const out: SenaGenerica[] = [];
  if (m.elementos < MINIMO_ELEMENTOS) return out;

  if (m.relleno.length) {
    out.push({
      id: "relleno",
      detalle: `Texto de relleno sin sustituir: ${m.relleno.slice(0, 3).map((t) => `«${t}»`).join(", ")}.`,
      arreglo:
        "Sustituye TODO el texto de relleno por copia real del encargo: nombres, cifras y frases que solo valgan para este proyecto.",
    });
  }
  if (m.imagenesRelleno.length) {
    out.push({
      id: "imagen-relleno",
      detalle: `${m.imagenesRelleno.length} imagen(es) de un generador de marcadores de posición.`,
      arreglo:
        "Quita las imágenes de relleno: usa SVG inline, gradientes o formas CSS propias del proyecto. Una imagen prestada de un servicio externo no se ve si no hay internet.",
    });
  }

  const distintos = new Set(m.tamanos.map((t) => Math.round(t)));
  const mayor = m.tamanos.length ? Math.max(...m.tamanos) : 0;
  const menor = m.tamanos.length ? Math.min(...m.tamanos) : 0;
  if (m.tamanos.length > 0 && (distintos.size < 4 || mayor / Math.max(1, menor) < 2)) {
    out.push({
      id: "sin-escala",
      detalle: `Solo ${distintos.size} tamaño(s) de letra distintos, del ${Math.round(menor)} al ${Math.round(mayor)} px.`,
      arreglo:
        "Monta una escala tipográfica de verdad: el titular principal al menos al doble del cuerpo, y al menos cuatro escalones (display, titular, subtítulo, cuerpo, apoyo).",
    });
  }

  const ft = familia(m.familiaTitular);
  const fc = familia(m.familiaCuerpo);
  if (ft && fc && ft === fc) {
    out.push({
      id: "sin-pareja",
      detalle: `Titulares y cuerpo usan la misma tipografía (${ft}).`,
      arreglo:
        "Usa la pareja tipográfica de la dirección: una fuente de display con carácter para los titulares y otra distinta para el cuerpo. Cárgalas de Google Fonts.",
    });
  } else if (ft && POR_DEFECTO.has(ft)) {
    out.push({
      id: "fuente-por-defecto",
      detalle: `El titular usa la tipografía por defecto del navegador (${ft}).`,
      arreglo:
        "Ninguna página con carácter usa la fuente que el navegador pone por defecto. Carga la fuente de display de la dirección.",
    });
  }

  if (m.gruposIguales > 0) {
    out.push({
      id: "tarjetas-iguales",
      detalle: `${m.gruposIguales} fila(s) de tarjetas idénticas en tamaño y forma.`,
      arreglo:
        "Rompe la retícula de tarjetas clonadas: cambia el peso de una, dale distinto tamaño a la principal, o cámbialas por una lista con aire. Tres cajas iguales es la composición por defecto de cualquier generador.",
    });
  }

  if (m.radios >= 1 && m.radioMasRepetido >= 8) {
    out.push({
      id: "radio-uniforme",
      detalle: `${m.radioMasRepetido} elementos comparten exactamente el mismo redondeo.`,
      arreglo:
        "El mismo radio en todo es la marca de agua de una plantilla. Usa los radios de la dirección con intención: distintos según la jerarquía, o ninguno si la dirección pide bordes rectos.",
    });
  }

  if (m.emojiEnTitulos >= 2) {
    out.push({
      id: "emoji-titulares",
      detalle: `${m.emojiEnTitulos} titulares empiezan por emoji.`,
      arreglo:
        "Quita los emoji de los titulares: son el adorno por defecto cuando no se ha decidido un sistema visual. Si hace falta un símbolo, dibújalo en SVG con el estilo del proyecto.",
    });
  }

  if (m.bloques >= 6 && m.centrados / m.bloques > 0.7) {
    out.push({
      id: "todo-centrado",
      detalle: `${m.centrados} de ${m.bloques} bloques de texto van centrados.`,
      arreglo:
        "Centrarlo todo aplana la jerarquía. Alinea a la izquierda el texto largo y reserva el centrado para lo que de verdad es un momento. (Si tu dirección pide simetría total, deja constancia y no lo cambies.)",
    });
  }

  if (m.heroCentrado) {
    out.push({
      id: "hero-centrado",
      detalle: "La portada es un titular centrado con un botón debajo.",
      arreglo:
        "Ese hero es la portada por defecto de todos los generadores. Prueba una composición asimétrica: titular enorme a un lado y algo vivo al otro —una demo, una imagen sangrada, datos reales—. (Si tu dirección la pide centrada, deja constancia y no lo cambies.)",
    });
  }

  return out;
}

/** Cuántas señas hay. Cero es lo normal en una página bien hecha: esto no
 * puntúa lo bonito, avisa de lo repetido. */
export function esGenerica(m: MedidasGenerico): boolean {
  return senasGenericas(m).length > 0;
}

/** El mensaje que se le devuelve al modelo. Mismo formato que el de los
 * errores de consola: lo que se ha visto y qué hacer con ello. */
/** Genérica a propósito, como el resto de funciones de esta sección: también
 * la usa `senasEfectosFueraDeDireccion` de `efectos.ts`, cuya seña no es
 * ninguna «página genérica» — es un efecto (2D o 3D) fuera de lo que su
 * dirección permite. Por eso el texto no nombra el motivo, solo dice lo que
 * se midió. */
export function promptDeGenerico(senas: SenaGenerica[], entry: string): string {
  if (!senas.length) return "";
  return [
    `He abierto ${entry} y la he medido. Esto es lo que he visto:`,
    "",
    ...senas.map((s, i) => `${i + 1}. ${s.detalle}\n   → ${s.arreglo}`),
    "",
    "Arregla SOLO eso, respetando la dirección de diseño del proyecto, y vuelve a entregar la página entera.",
    "Si alguna de esas señas es una decisión deliberada de la dirección, dilo en una línea y déjala como está.",
  ].join("\n");
}

/** Resumen para el aviso de pantalla. Genérico por el mismo motivo que
 * `promptDeGenerico` — ver su comentario. */
export function resumenGenerico(senas: SenaGenerica[]): string {
  if (!senas.length) return "Sin nada que corregir.";
  const n = senas.length;
  return `${n} cosa${n === 1 ? "" : "s"} que corregir: ${senas.map((s) => s.id).join(", ")}.`;
}

/** Cuando se acaban los intentos automáticos y la página SIGUE teniendo
 *  algo de esto sin arreglar: se dice, en vez de darla por pulida en
 *  silencio después del último intento que ni se llegó a comprobar.
 *
 * Genérica a propósito (no habla de «genérica» en el texto): la usa
 * también `senasEfectosFueraDeDireccion` de `efectos.ts`, que no tiene
 * nada que ver con el AI-slop — comparte el mecanismo, no el motivo. */
export function avisoIntentosAgotados(senas: SenaGenerica[]): string {
  return `Se acabaron los intentos automáticos y la página sigue con esto sin arreglar: ${senas.map((s) => s.id).join(", ")}. Pídeme que la corrija otra vez o dime qué cambiar.`;
}

/** Regla para la memoria de fallos del proyecto.
 *
 * Genérica a propósito (el nombre de la función es lo único que no lo es):
 * también la usa `senasEfectosFueraDeDireccion` de `efectos.ts`, y esa
 * seña no tiene nada de «página genérica» — es un efecto (2D o 3D) fuera de
 * lo que su dirección permite. El título usa `sena.detalle`, que cada seña
 * ya escribe con su propio motivo, en vez de un prefijo fijo que mentiría en
 * ese caso. */
export function reglaDeGenerico(sena: SenaGenerica): { titulo: string; regla: string } {
  return { titulo: sena.detalle, regla: sena.arreglo };
}

/* ------------------------------------------------------------------ */
/* el recolector que corre DENTRO del iframe                          */
/* ------------------------------------------------------------------ */

/** Solo MIDE. No juzga: el juicio está arriba, en TypeScript, con pruebas. */
export const GENERICO_SCRIPT = `function medirGenerico(){
  try{
    var rellenoRe = /lorem ipsum|dolor sit amet|texto de ejemplo|tu texto aqu|t[ií]tulo aqu|descripci[oó]n aqu|caracter[ií]stica [123]\\b|feature [123]\\b|placeholder|coming soon|pr[oó]ximamente aqu/i;
    var placeholderHosts = /(via\\.placeholder|placehold\\.co|placekitten|dummyimage|lorempixel|picsum\\.photos|unsplash\\.com\\/random)/i;
    var emojiRe = /^\\s*[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u;
    var body = document.body;
    if (!body) return null;
    var todos = body.querySelectorAll("*");
    function vis(el){
      var r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      var s = getComputedStyle(el);
      return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) !== 0;
    }
    function textoDirecto(el){
      var t = "";
      for (var i=0;i<el.childNodes.length;i++) if (el.childNodes[i].nodeType===3) t += el.childNodes[i].nodeValue;
      return t.replace(/\\s+/g," ").trim();
    }
    var tamanos = {}, relleno = [], centrados = 0, bloques = 0, radios = {}, emojiEnTitulos = 0;
    for (var i=0;i<todos.length;i++){
      var el = todos[i];
      if (!vis(el)) continue;
      var s = getComputedStyle(el);
      var t = textoDirecto(el);
      if (t.length > 2){
        tamanos[Math.round(parseFloat(s.fontSize))] = 1;
        bloques++;
        if (s.textAlign === "center") centrados++;
        if (rellenoRe.test(t) && relleno.length < 6) relleno.push(t.slice(0,60));
      }
      var br = parseFloat(s.borderTopLeftRadius) || 0;
      if (br > 0 && el.getBoundingClientRect().width > 40) radios[br] = (radios[br]||0) + 1;
      if (/^H[1-4]$/.test(el.tagName) && emojiRe.test(el.textContent||"")) emojiEnTitulos++;
    }
    var imgs = body.querySelectorAll("img"), imagenesRelleno = [];
    for (var k=0;k<imgs.length;k++){
      var src = imgs[k].getAttribute("src")||"";
      if (placeholderHosts.test(src) && imagenesRelleno.length < 6) imagenesRelleno.push(src.slice(0,80));
    }
    // grupos de 3+ hermanos clonados: mismo alto, mismo ancho, misma forma
    var gruposIguales = 0;
    var padres = body.querySelectorAll("div,section,ul,main,nav,article");
    for (var p=0;p<padres.length;p++){
      var hijos = [];
      for (var h=0; h<padres[p].children.length; h++) if (vis(padres[p].children[h])) hijos.push(padres[p].children[h]);
      if (hijos.length < 3) continue;
      var r0 = hijos[0].getBoundingClientRect();
      if (r0.height < 40 || r0.width < 60) continue;
      var iguales = true;
      for (var q=1;q<hijos.length;q++){
        var rq = hijos[q].getBoundingClientRect();
        if (Math.abs(rq.height-r0.height) > 4 || Math.abs(rq.width-r0.width) > 4){ iguales = false; break; }
      }
      // solo cuenta si además llevan texto dentro: una fila de iconos no es
      // una rejilla de tarjetas clonadas
      if (iguales && (hijos[0].textContent||"").trim().length > 20) gruposIguales++;
    }
    // hero: la primera sección visible con altura de portada
    var heroCentrado = false;
    var h1 = body.querySelector("h1");
    if (h1){
      var cont = h1.closest("section,header,div") || h1.parentElement;
      if (cont){
        var cs = getComputedStyle(cont);
        var ctas = cont.querySelectorAll('a[class],button,[role="button"]');
        heroCentrado = cs.textAlign === "center" && ctas.length === 1;
      }
    }
    var clavesRadio = Object.keys(radios);
    var masRepetido = 0;
    for (var z=0;z<clavesRadio.length;z++) masRepetido = Math.max(masRepetido, radios[clavesRadio[z]]);
    var h1s = body.querySelector("h1");
    // qué motor 3D está de verdad en la página pintada — no lo que el
    // modelo DIJO que iba a usar, lo que dejó en el DOM.
    var canvas3d = body.querySelectorAll("[data-fx3d]");
    var efectos3d = [];
    for (var c3=0;c3<canvas3d.length;c3++){
      var v3 = canvas3d[c3].getAttribute("data-fx3d");
      if (v3 && efectos3d.indexOf(v3) === -1) efectos3d.push(v3);
    }
    // lo mismo para los efectos 2D del kit: la mayoría se marcan con
    // data-fx="<id>" directo, y unos pocos (soloCss) solo con una clase
    // suelta, sin atributo.
    var efectos2d = [];
    function add2d(id){ if (efectos2d.indexOf(id) === -1) efectos2d.push(id); }
    var conDataFx = body.querySelectorAll("[data-fx]");
    // ids reales del catálogo con data-fx: "pin-inner"/"horizontal-track" son
    // marcas internas del propio efecto, no un efecto en sí, así que no están
    // aquí — y da igual si aparecen: no coinciden con nada en «evita».
    var idsDataFx = {reveal:1,stagger:1,split:1,pop:1,tilt:1,magnetic:1,spotlight:1,count:1,parallax:1,pin:1,horizontal:1,cursor:1,scramble:1};
    for (var df=0;df<conDataFx.length;df++){
      var vfx = conDataFx[df].getAttribute("data-fx");
      if (vfx && idsDataFx[vfx]) add2d(vfx);
    }
    var clasesSueltas = {"fx-marquee":"marquee","fx-noise":"noise","fx-grid":"grid","fx-dots":"grid","fx-underline":"underline","fx-sheen":"sheen","fx-float":"float","fx-blob":"blob"};
    for (var claseCss in clasesSueltas){
      if (body.querySelector("."+claseCss)) add2d(clasesSueltas[claseCss]);
    }
    // "mesh" aparte: comparte la clase fx-mesh con el motor 3D (el canvas la
    // usa para su propio tamaño/estilo) — solo cuenta como el efecto 2D
    // "mesh" si el elemento NO es un canvas del motor 3D.
    var conFxMesh = body.querySelectorAll(".fx-mesh");
    for (var fm=0;fm<conFxMesh.length;fm++){
      if (!conFxMesh[fm].hasAttribute("data-fx3d")) { add2d("mesh"); break; }
    }
    return {
      heroCentrado: heroCentrado,
      gruposIguales: gruposIguales,
      tamanos: Object.keys(tamanos).map(Number),
      familiaTitular: h1s ? getComputedStyle(h1s).fontFamily : "",
      familiaCuerpo: getComputedStyle(body).fontFamily,
      radios: clavesRadio.length,
      radioMasRepetido: masRepetido,
      centrados: centrados,
      bloques: bloques,
      relleno: relleno,
      imagenesRelleno: imagenesRelleno,
      emojiEnTitulos: emojiEnTitulos,
      efectos3d: efectos3d,
      efectos2d: efectos2d,
      elementos: todos.length
    };
  }catch(e){ return null; }
}`;
