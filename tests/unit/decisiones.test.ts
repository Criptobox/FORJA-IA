/** Forja IA — Las decisiones del failover, probadas sin navegador.
 *
 * Vivían dentro del `useCallback` de `runGeneration`, enredadas con React y
 * los toasts, así que la única forma de probarlas era abrir Chromium: cada
 * arreglo costaba tres minutos de Playwright para comprobar algo que es una
 * función pura. Aquí cuestan milisegundos.
 */
import { describe, it, expect } from "vitest";
import {
  decidirTrasError,
  decidirTrasCuotaEnTexto,
  decidirTrasVacio,
  siguienteIndice,
  esPasajero,
  motivoDelFallo,
  tituloFailover,
  tituloSinAlternativa,
  type EstadoIntento,
  esModeloMuerto,
  esDemasiadoGrande,
  esPeticionInvalida,
  limiteDelMensaje,
  esLimiteLocal,
} from "../../src/lib/forja/decisiones";

const CADENA = [
  { providerId: "groq", modelId: "a" },
  { providerId: "groq", modelId: "b" },
  { providerId: "gemini", modelId: "c" },
];

const base = (over: Partial<EstadoIntento> = {}): EstadoIntento => ({
  status: 500,
  mensajeCuota: false,
  auto: true,
  depth: 0,
  maxSaltos: 4,
  indice: 0,
  cadena: CADENA,
  parcial: "",
  rescatable: false,
  ...over,
});

describe("esPasajero", () => {
  it("sin respuesta, timeout y 5xx sí", () => {
    expect(esPasajero(0)).toBe(true);
    expect(esPasajero(408)).toBe(true);
    expect(esPasajero(503)).toBe(true);
  });
  it("un 400 o un 404 no: ahí el problema es la petición, no el momento", () => {
    expect(esPasajero(400)).toBe(false);
    expect(esPasajero(404)).toBe(false);
    expect(esPasajero(401)).toBe(false);
  });
});

describe("siguienteIndice", () => {
  it("un fallo normal pasa al siguiente de la lista", () => {
    expect(siguienteIndice({ status: 500, mensajeCuota: false, indice: 0, cadena: CADENA })).toBe(1);
  });

  it("un fallo de cuota SALTA de proveedor: dar tumbos entre los modelos de uno que ya dijo que no queda es gastar intentos", () => {
    expect(siguienteIndice({ status: 402, mensajeCuota: false, indice: 0, cadena: CADENA })).toBe(2);
    expect(siguienteIndice({ status: 429, mensajeCuota: false, indice: 0, cadena: CADENA })).toBe(2);
    expect(siguienteIndice({ status: 200, mensajeCuota: true, indice: 0, cadena: CADENA })).toBe(2);
  });

  it("al final de la cadena no hay siguiente", () => {
    expect(siguienteIndice({ status: 500, mensajeCuota: false, indice: 2, cadena: CADENA })).toBe(-1);
  });
});

describe("decidirTrasError", () => {
  it("Auto avanza ante cualquier fallo: para eso se eligió", () => {
    expect(decidirTrasError(base({ status: 400 }))).toEqual({ tipo: "siguiente", indice: 1 });
  });

  it("un modelo manual también avanza: lo único que para es culpa nuestra", () => {
    // Antes esto decía «solo avanza en fallos pasajeros», y por eso un 413 de
    // Groq o un 400 de un router dejaban la conversación muerta. Ahora avanza
    // en todo salvo cuando la petición estaba mal HECHA por nosotros.
    const manual = base({ auto: false });
    expect(decidirTrasError({ ...manual, status: 503 })).toEqual({ tipo: "siguiente", indice: 1 });
    expect(decidirTrasError({ ...manual, status: 413 })).toEqual({ tipo: "siguiente", indice: 1 });
    expect(
      decidirTrasError({ ...manual, status: 400, peticionInvalida: true })
    ).toEqual({ tipo: "parar" });
  });

  it("agotada la cadena y sin cuota, se busca otro proveedor", () => {
    expect(decidirTrasError(base({ indice: 2, status: 402 }))).toEqual({ tipo: "failover" });
  });

  it("un trabajo a medias merece el salto aunque el fallo no sea de cuota", () => {
    expect(
      decidirTrasError(base({ indice: 2, status: 0, parcial: "media web", rescatable: true }))
    ).toEqual({ tipo: "failover" });
  });

  it("sin nada que rescatar, se busca fuera: hay proveedores conectados", () => {
    // Aquí se paraba. Con un error cualquiera y la cadena agotada, la app se
    // rendía teniendo a dónde ir — que es de lo que vinieron las capturas.
    expect(decidirTrasError(base({ indice: 2, status: 400 }))).toEqual({ tipo: "failover" });
  });

  it("…salvo si la petición estaba mal hecha, que entonces sí para", () => {
    expect(
      decidirTrasError(base({ indice: 2, status: 400, peticionInvalida: true }))
    ).toEqual({ tipo: "parar" });
  });

  it("el tope de saltos se respeta: no se encadena para siempre", () => {
    expect(
      decidirTrasError(base({ indice: 2, status: 402, depth: 4, maxSaltos: 4 }))
    ).toEqual({ tipo: "parar" });
  });

  it("pero mientras quede tope, el segundo salto SÍ se permite", () => {
    // el fallo original: `depth === 0` cerraba la puerta al segundo salto
    expect(decidirTrasError(base({ indice: 2, status: 402, depth: 1 }))).toEqual({
      tipo: "failover",
    });
  });
});

describe("decidirTrasCuotaEnTexto", () => {
  it("salta al siguiente proveedor, no al siguiente modelo del mismo", () => {
    expect(decidirTrasCuotaEnTexto(base({ indice: 0 }))).toEqual({ tipo: "siguiente", indice: 2 });
  });
  it("y si no queda proveedor, busca fuera", () => {
    expect(decidirTrasCuotaEnTexto(base({ indice: 2 }))).toEqual({ tipo: "failover" });
  });
});

describe("decidirTrasVacio", () => {
  it("una respuesta vacía avanza al siguiente de la cadena", () => {
    expect(decidirTrasVacio(base({ indice: 0 }))).toEqual({ tipo: "siguiente", indice: 1 });
  });
  it("y al final de la cadena, busca otro proveedor", () => {
    expect(decidirTrasVacio(base({ indice: 2 }))).toEqual({ tipo: "failover" });
  });
  it("con el tope agotado, para", () => {
    expect(decidirTrasVacio(base({ indice: 2, depth: 4, maxSaltos: 4 }))).toEqual({ tipo: "parar" });
  });
});

/** El caso reportado: eliges Gemini a mano, contesta 503 «high demand», la
 *  cadena es de un solo modelo, y ahí se quedaba el error en pantalla. Tener
 *  otros proveedores conectados y no usarlos cuando el tuyo está caído es
 *  justo lo que el failover existe para evitar. */
describe("un fallo pasajero sin cadena salta de proveedor, no se para", () => {
  const base: EstadoIntento = {
    status: 503,
    mensajeCuota: false,
    auto: false,
    depth: 0,
    maxSaltos: 4,
    indice: 0,
    cadena: [{ providerId: "gemini", modelId: "gemini-3.7-flash" }],
    parcial: "",
    rescatable: false,
  };

  it("un 503 con la cadena agotada va a failover", () => {
    expect(decidirTrasError(base).tipo).toBe("failover");
  });

  it("una petición caída (status 0) también", () => {
    expect(decidirTrasError({ ...base, status: 0 }).tipo).toBe("failover");
  });

  it("y un 400 o un 404 TAMBIÉN: un modelo caído no es motivo para rendirse", () => {
    // Lo contrario de lo que decía esta prueba antes. El cambio es a propósito:
    // enumerar los fallos «buenos» dejaba fuera todos los que aún no habían
    // aparecido, y cada uno nuevo era un callejón sin salida.
    expect(decidirTrasError({ ...base, status: 400 }).tipo).toBe("failover");
    expect(decidirTrasError({ ...base, status: 404 }).tipo).toBe("failover");
    // lo que sí para, y es lo único
    expect(
      decidirTrasError({ ...base, status: 400, peticionInvalida: true }).tipo
    ).toBe("parar");
  });

  it("y el tope de saltos sigue mandando", () => {
    expect(decidirTrasError({ ...base, depth: 4 }).tipo).toBe("parar");
  });
});

/** «Cuota gratis agotada» se decía en TODOS los avisos del failover, también
 *  con un 503 y con una clave de pago. A quien tiene Gemini Pro eso le manda a
 *  mirar su facturación por un problema que está en el proveedor. */
describe("el aviso del failover dice la causa real", () => {
  it("un 503 es «no responde», no «cuota»", () => {
    expect(motivoDelFallo(503, false)).toBe("caido");
    expect(tituloFailover("caido", "Google Gemini")).toBe("Google Gemini no está respondiendo");
    expect(tituloSinAlternativa("caido", "Google Gemini")).not.toMatch(/cuota/i);
  });

  it("un 402 o un 429 sí son cuota", () => {
    expect(motivoDelFallo(402, false)).toBe("cuota");
    expect(motivoDelFallo(429, false)).toBe("cuota");
    expect(tituloFailover("cuota", "OpenRouter")).toMatch(/cuota/i);
  });

  it("el aviso de cuota escrito en el cuerpo también cuenta", () => {
    expect(motivoDelFallo(200, true)).toBe("cuota");
  });

  it("un 400 no es ni cuota ni caída", () => {
    expect(motivoDelFallo(400, false)).toBe("otro");
    expect(tituloFailover("otro", "X")).not.toMatch(/cuota/i);
  });
});

/** ——— El modelo que ya no existe ———
 *
 * Caso real, con captura: Auto eligió `google/gemini-2.0-flash-exp:free` en
 * OpenRouter, llegó «404 No endpoints found» y la app **se paró en seco**,
 * teniendo otros cuatro proveedores conectados. Un 404 no es pasajero, cierto,
 * pero es justo el fallo que se arregla probando otro modelo: la petición
 * estaba bien y lo que falta es el modelo.
 */
describe("un modelo retirado no es un callejón sin salida", () => {
  const base = {
    mensajeCuota: false,
    depth: 0,
    maxSaltos: 3,
    indice: 0,
    parcial: "",
    rescatable: false,
  };
  const uno = [{ providerId: "openrouter", modelId: "google/gemini-2.0-flash-exp:free" }];
  const dos = [...uno, { providerId: "gemini", modelId: "gemini-3.8-flash" }];

  it("reconoce las frases con las que lo dicen los proveedores", () => {
    expect(esModeloMuerto(404, "OpenRouter 404: No endpoints found for google/x:free")).toBe(true);
    expect(esModeloMuerto(400, "The model `gpt-9` does not exist")).toBe(true);
    expect(esModeloMuerto(400, "model_not_found")).toBe(true);
    expect(esModeloMuerto(404, "cualquier cosa")).toBe(true);
  });

  it("y NO confunde con un fallo normal ni con una petición mal hecha", () => {
    expect(esModeloMuerto(400, "Invalid JSON in request body")).toBe(false);
    expect(esModeloMuerto(429, "rate limit")).toBe(false);
    expect(esModeloMuerto(503, "high demand")).toBe(false);
  });

  it("con cadena, salta al siguiente modelo aunque el modelo sea manual", () => {
    const d = decidirTrasError({
      ...base,
      status: 404,
      modeloMuerto: true,
      auto: false,
      cadena: dos,
    });
    expect(d).toEqual({ tipo: "siguiente", indice: 1 });
  });

  it("SIN cadena busca fuera, que es lo que no hacía", () => {
    // Este es el caso de la captura: Auto, último de la cadena, 404.
    const d = decidirTrasError({
      ...base,
      status: 404,
      modeloMuerto: true,
      auto: true,
      cadena: uno,
    });
    expect(d.tipo, "un modelo retirado no vuelve por esperar").toBe("failover");
  });

  it("y ya no hace falta la marca: por defecto se busca otro", () => {
    // Cuando se escribió esta prueba, sin `modeloMuerto` el 404 devolvía
    // «parar». Al invertir la polaridad dejó de hacer falta la marca para no
    // rendirse; la marca sigue valiendo para DECIR que el modelo está
    // retirado en vez de «falló», y para apartarlo de futuras elecciones.
    const d = decidirTrasError({ ...base, status: 404, auto: true, cadena: uno });
    expect(d.tipo).toBe("failover");
  });

  it("una petición inválida SÍ se para: ahí probar otro esconde tu error", () => {
    const d = decidirTrasError({
      ...base,
      status: 400,
      modeloMuerto: false,
      // el 400 por sí solo ya no basta para parar (un router devuelve 400 con
      // el fallo de OTRO): hay que reconocer que la petición estaba mal hecha
      peticionInvalida: true,
      auto: false,
      cadena: dos,
    });
    expect(d.tipo).toBe("parar");
  });

  it("el aviso dice que el modelo está retirado, no que la clave falló", () => {
    expect(motivoDelFallo(404, false, true)).toBe("retirado");
    expect(tituloFailover("retirado", "OpenRouter")).toMatch(/ya no existe/);
    expect(tituloSinAlternativa("retirado", "OpenRouter")).toMatch(/ya no existe/);
    // y sin la marca sigue diciendo lo de siempre
    expect(motivoDelFallo(503, false, false)).toBe("caido");
  });
});

/** ——— Tres capturas, tres errores distintos, tres callejones ———
 *
 * El mismo día llegaron tres pantallazos seguidos: un 404 de OpenRouter, un
 * 413 de Groq por tamaño y un 400 «Provider returned error». Los tres códigos
 * distintos, los tres terminando la conversación con cuatro proveedores
 * conectados al lado.
 *
 * La causa no era cada error: era la POLARIDAD. `decidirTrasError` enumeraba
 * los fallos que merecen reintento y paraba en todo lo demás, así que cada
 * error nuevo del mundo entraba por defecto en «ríndete». Ahora se enumera lo
 * contrario, y lo único que para es una petición mal hecha por nosotros.
 */
describe("la polaridad: solo para lo que es culpa nuestra", () => {
  const base = {
    mensajeCuota: false,
    depth: 0,
    maxSaltos: 3,
    indice: 0,
    parcial: "",
    rescatable: false,
    auto: true,
  };
  const uno = [{ providerId: "groq", modelId: "qwen/qwen3.8-27b" }];
  const dos = [...uno, { providerId: "gemini", modelId: "gemini-3.8-flash" }];

  const GROQ_413 =
    "Groq 413: Request too large for model `qwen/qwen3.8-27b` in organization `org_x` service tier `on_demand` on input tokens per minute (ITPM): Limit 7000, Requested 21138, please reduce your message size and try again.";
  const ROUTER_400 = "OpenRouter 400: Provider returned error";

  it("el 413 de Groq se reconoce como «no te cabe», no como fallo del modelo", () => {
    expect(esDemasiadoGrande(413, GROQ_413)).toBe(true);
    expect(esDemasiadoGrande(400, "maximum context length is 8192 tokens")).toBe(true);
    expect(esDemasiadoGrande(500, "internal error")).toBe(false);
  });

  it("y se le saca el número que el proveedor dijo, sin adivinar el que no", () => {
    expect(limiteDelMensaje(GROQ_413)).toEqual({ limite: 7000, pedido: 21138 });
    expect(limiteDelMensaje("Request too large, try again")).toBeNull();
  });

  it("el 400 del router NO es culpa de la petición: el que falló fue el de detrás", () => {
    expect(esPeticionInvalida(400, ROUTER_400)).toBe(false);
    expect(esPeticionInvalida(400, "Invalid JSON in request body")).toBe(true);
    expect(esPeticionInvalida(422, "unsupported parameter: top_k")).toBe(true);
    // un mensaje demasiado grande nunca es «petición inválida», aunque venga con 400
    expect(esPeticionInvalida(400, "maximum context length is 8192")).toBe(false);
  });

  it("los tres casos de las capturas siguen, en vez de pararse", () => {
    for (const [status, msg] of [
      [404, "OpenRouter 404: No endpoints found for google/gemini-2.0-flash-exp:free"],
      [413, GROQ_413],
      [400, ROUTER_400],
    ] as const) {
      const conCadena = decidirTrasError({
        ...base,
        status,
        cadena: dos,
        modeloMuerto: esModeloMuerto(status, msg),
        peticionInvalida: esPeticionInvalida(status, msg),
      });
      expect(conCadena, `${status} con cadena`).toEqual({ tipo: "siguiente", indice: 1 });

      const sinCadena = decidirTrasError({
        ...base,
        status,
        cadena: uno,
        modeloMuerto: esModeloMuerto(status, msg),
        peticionInvalida: esPeticionInvalida(status, msg),
      });
      expect(sinCadena.tipo, `${status} sin cadena`).toBe("failover");
    }
  });

  it("una petición mal hecha SÍ para, aunque haya diez modelos esperando", () => {
    const d = decidirTrasError({
      ...base,
      status: 400,
      cadena: dos,
      peticionInvalida: true,
    });
    expect(d.tipo, "probar otro escondería nuestro error").toBe("parar");
  });

  it("el aviso del tamaño no dice «falló»: dice que no cabe", () => {
    expect(motivoDelFallo(413, false, false, true)).toBe("grande");
    expect(tituloFailover("grande", "Groq")).toMatch(/no le cabe/);
  });
});

describe("límites propios (presupuesto, techo, veto) — Plan Maestro 2026 §61", () => {
  const cadena = [
    { providerId: "deepseek", modelId: "deepseek-chat" },
    { providerId: "openai", modelId: "gpt-x" },
    { providerId: "groq", modelId: "llama-free" },
  ];
  const base = {
    status: 0,
    mensajeCuota: false,
    auto: true,
    depth: 0,
    maxSaltos: 3,
    indice: 0,
    cadena,
    parcial: "",
    rescatable: false,
  };

  it("reconoce los tres cortes locales por su texto, y nada más", () => {
    expect(esLimiteLocal("Presupuesto de hoy alcanzado (1,00 $ de 1,00 $): FORJA pasa a solo modelos gratis.")).toBe(true);
    expect(esLimiteLocal("Presupuesto mensual alcanzado (5,00 $ de 5,00 $)")).toBe(true);
    expect(esLimiteLocal("Has llegado al techo de 200 llamadas de pago hoy.")).toBe(true);
    expect(esLimiteLocal("«OpenAI» está vetado: tú decidiste que no reciba nada.")).toBe(true);
    expect(esLimiteLocal("503 Service Unavailable")).toBe(false);
  });

  it("salta al siguiente GRATIS de la cadena, no al siguiente de pago", () => {
    const d = decidirTrasError({
      ...base,
      limiteLocal: true,
      esGratis: (c) => c.modelId.endsWith("-free"),
    });
    expect(d).toEqual({ tipo: "siguiente", indice: 2 });
  });

  it("sin gratis en la cadena, sale al failover (que solo elige gratis)", () => {
    const d = decidirTrasError({ ...base, limiteLocal: true, esGratis: () => false });
    expect(d).toEqual({ tipo: "failover" });
  });

  it("el motivo y los titulares no dicen que el proveedor esté caído", () => {
    expect(motivoDelFallo(0, false, false, false, true)).toBe("limite");
    expect(tituloFailover("limite", "DeepSeek")).not.toMatch(/no está respondiendo/);
    expect(tituloSinAlternativa("limite", "DeepSeek")).toMatch(/gratis/);
  });
});
