import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  EFECTOS,
  EFECTOS_POR_DIRECCION,
  FX_ASENTAR,
  FX_CSS,
  FX_CSS_PATH,
  FX_JS,
  FX_JS_PATH,
  MAX_EFECTOS,
  conKit,
  efectoPorId,
  efectosDe,
  faltanDelKit,
  promptEfectos,
  usaKit,
} from "../../src/lib/prism/efectos";
import { DIRECCIONES, aDesignMd, promptDireccion } from "../../src/lib/prism/design-directions";

const leer = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("kit de efectos", () => {
  it("lo empaquetado es exactamente lo que hay en assets/", () => {
    // Si alguien edita el CSS y no ejecuta `npm run efectos`, la app sigue
    // sirviendo el de antes. Esto es lo que lo caza.
    expect(FX_CSS).toBe(leer("assets/prism-fx.css"));
    expect(FX_JS).toBe(leer("assets/prism-fx.js"));
  });

  it("no depende de ningún CDN ni pide red", () => {
    // El motivo entero de tener kit propio. Un `https://` aquí sería volver
    // al problema: página rota en silencio el día que ese dominio no está.
    // Ojo: el CSS lleva `http://www.w3.org/2000/svg` dentro del data-URI del
    // grano. Eso es un espacio de nombres XML, no una descarga — el navegador
    // no lo pide nunca. Lo que se prohíbe es cargar algo de fuera.
    for (const fuente of [FX_CSS, FX_JS]) {
      expect(fuente).not.toMatch(/url\(\s*["']?https?:/);
      expect(fuente).not.toMatch(/@import/);
      expect(fuente).not.toMatch(/\bfetch\(|XMLHttpRequest|importScripts|<script/);
    }
  });

  it("el JS no toca almacenamiento: en la vista previa lanzaría SecurityError", () => {
    expect(FX_JS).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
  });

  it("nada se esconde sin JavaScript: el CSS solo oculta bajo .fx-on", () => {
    // La regla de oro del kit. Cada `opacity:0` tiene que estar detrás de la
    // clase que el script pone SOLO cuando puede animar.
    // sin comentarios: si no, el texto de un comentario acaba contado como
    // parte del selector y la comprobación falla (o pasa) por el motivo que no es
    const css = FX_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const bloque of css.split("}")) {
      if (!/opacity\s*:\s*0\b/.test(bloque)) continue;
      // cada selector de la lista por separado: con mirar el bloque entero,
      // bastaba con que UNO de los cinco llevara la clase para dar el resto
      // por bueno — y ahí es donde se colaría el fallo
      for (const sel of bloque.split("{")[0].split(",")) {
        const s = sel.trim();
        if (!s) continue;
        const permitido = s.includes(".fx-on") || s.includes("::after") || s.includes("::before");
        expect(permitido, `oculta sin .fx-on: ${s}`).toBe(true);
      }
    }
  });

  it("respeta a quien pidió menos movimiento, en el CSS y en el JS", () => {
    expect(FX_CSS).toContain("prefers-reduced-motion: reduce");
    expect(FX_JS).toContain("prefers-reduced-motion: reduce");
  });

  it("hay red de seguridad: si el observer no dispara, se revela igual", () => {
    // Un efecto perdido es una molestia; contenido invisible es un fallo.
    expect(FX_JS).toMatch(/setTimeout[\s\S]{0,200}fx-in/);
  });

  it("cada dirección tiene efectos propios y prohibidos, y no se contradicen", () => {
    for (const d of DIRECCIONES) {
      const m = EFECTOS_POR_DIRECCION[d.id];
      expect(m, `${d.id} sin efectos declarados`).toBeTruthy();
      expect(m.usa.length).toBeGreaterThanOrEqual(3);
      expect(m.evita.length).toBeGreaterThanOrEqual(3);
      for (const id of [...m.usa, ...m.evita]) {
        expect(efectoPorId(id), `${d.id}: efecto inexistente «${id}»`).toBeTruthy();
      }
      // lo mismo no puede estar permitido y prohibido a la vez
      expect(m.usa.filter((x) => m.evita.includes(x))).toEqual([]);
    }
  });

  it("las direcciones NO comparten la misma receta", () => {
    // Si todas usaran lo mismo, el kit sería otra plantilla más: es justo lo
    // que esto viene a evitar.
    const recetas = DIRECCIONES.map((d) => EFECTOS_POR_DIRECCION[d.id].usa.join(","));
    expect(new Set(recetas).size).toBe(DIRECCIONES.length);
  });

  it("una dirección desconocida se queda sin efectos en vez de heredar unos genéricos", () => {
    expect(efectosDe("no-existe")).toEqual({ usa: [], evita: [] });
    expect(promptEfectos("no-existe")).toBe("");
  });

  it("el bloque del prompt dice qué enlazar, cuántos usar y qué está prohibido", () => {
    const p = promptEfectos("tech");
    expect(p).toContain(FX_CSS_PATH);
    expect(p).toContain(FX_JS_PATH);
    expect(p).toContain("NO lo escribas");
    expect(p).toContain(String(MAX_EFECTOS));
    expect(p).toContain("PROHIBIDOS");
    expect(p).toContain("float"); // prohibido en tech
    // y prohíbe expresamente la salida fácil
    expect(p).toMatch(/CDN/);
  });

  it("el bloque cabe en un prompt: no puede engordar sin que se note", () => {
    for (const d of DIRECCIONES) {
      expect(promptEfectos(d.id).length, `${d.id} demasiado largo`).toBeLessThan(1200);
    }
  });

  it("la dirección inyecta sus efectos en el prompt de sistema", () => {
    const bloque = promptDireccion({ direccion: DIRECCIONES[0], origen: "sistema" });
    expect(bloque).toContain("EFECTOS");
    expect(bloque).toContain(FX_CSS_PATH);
  });

  it("el DESIGN.md del proyecto deja escrito qué efectos son suyos", () => {
    const md = aDesignMd(DIRECCIONES[3]); // brutalista
    expect(md).toContain("## Efectos");
    expect(md).toContain("marquee");
    expect(md).toContain("Prohibidos");
  });

  it("el catálogo no tiene ids repetidos y todos explican cómo se usan", () => {
    expect(new Set(EFECTOS.map((e) => e.id)).size).toBe(EFECTOS.length);
    for (const e of EFECTOS) expect(e.uso.length).toBeGreaterThan(10);
  });
});

describe("el kit viaja con el proyecto", () => {
  const html = `<link rel="stylesheet" href="${FX_CSS_PATH}"><script src="${FX_JS_PATH}"></script>`;

  it("se detecta el enlace en sus tres formas", () => {
    expect(usaKit([html])).toEqual({ css: true, js: true });
    expect(usaKit([`<link href="./${FX_CSS_PATH}">`]).css).toBe(true);
    expect(usaKit([`<script src="/${FX_JS_PATH}">`]).js).toBe(true);
  });

  it("una página que no lo enlaza NO se llena de archivos que no pidió", () => {
    const files = { "index.html": "<h1>hola</h1>" };
    expect(conKit(files)).toEqual(files);
    expect(faltanDelKit(["index.html"], ["<h1>hola</h1>"])).toEqual([]);
  });

  it("si lo enlaza y no está, se añade con el contenido real del kit", () => {
    const out = conKit({ "index.html": html });
    expect(Object.keys(out).sort()).toEqual(["index.html", FX_CSS_PATH, FX_JS_PATH].sort());
    expect(out[FX_CSS_PATH]).toBe(FX_CSS);
    expect(out[FX_JS_PATH]).toBe(FX_JS);
  });

  it("nunca pisa una versión que ya venga en el proyecto", () => {
    // el modelo (o el usuario en el Sandbox) manda sobre lo nuestro
    const mio = "/* el mío */";
    const out = conKit({ "index.html": html, [FX_CSS_PATH]: mio });
    expect(out[FX_CSS_PATH]).toBe(mio);
    expect(out[FX_JS_PATH]).toBe(FX_JS);
  });

  it("solo se añade la mitad que falta", () => {
    const soloCss = `<link rel="stylesheet" href="${FX_CSS_PATH}">`;
    const out = conKit({ "index.html": soloCss });
    expect(out[FX_CSS_PATH]).toBe(FX_CSS);
    expect(out[FX_JS_PATH]).toBeUndefined();
  });
});

describe("medir una página con efectos", () => {
  it("el asentador es JavaScript válido y marca todo como ya entrado", () => {
    expect(() => new Function(FX_ASENTAR)).not.toThrow();
    expect(FX_ASENTAR).toContain("[data-fx]");
    expect(FX_ASENTAR).toContain("fx-in");
    // apaga las transiciones: con una corriendo, medir justo después seguiría
    // leyendo opacidad 0 y daría media página por invisible
    expect(FX_ASENTAR).toContain("fx-medir");
    expect(FX_CSS).toContain("html.fx-medir");
  });

  it("medir se deshace: el usuario tiene que ver SUS efectos, no los del medidor", () => {
    expect(FX_ASENTAR).toContain("function desasentarFx");
    const qa = leer("src/lib/prism/visual-qa.ts");
    expect(qa).toContain("desasentarFx(tocadosFx)");
    // y se deshace DESPUÉS de recoger los problemas, no antes
    expect(qa.indexOf("desasentarFx(tocadosFx)")).toBeGreaterThan(qa.indexOf("var tocadosFx"));
  });

  it("el QA visual y el barrido de botones lo llaman antes de mirar", () => {
    // Sin esto medirían solo el primer pantallazo y dirían «sin problemas»
    // de lo que nunca miraron: parece una comprobación y no lo es.
    const qa = leer("src/lib/prism/visual-qa.ts");
    const pilot = leer("src/lib/prism/sandbox-pilot.ts");
    expect(qa).toContain("${FX_ASENTAR}");
    expect(qa).toMatch(/function medir\(\)\{[\s\S]{0,400}asentarFx\(\)/);
    expect(pilot).toContain("${FX_ASENTAR}");
    expect(pilot).toMatch(/function enumeraBotones\(\)\{[\s\S]{0,300}asentarFx\(\)/);
  });
});
