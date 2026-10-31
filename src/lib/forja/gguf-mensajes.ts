/** Forja IA — Modelo local .gguf: lo que se puede decidir sin navegador.
 *
 * El motor (`gguf-local.ts`) corre llama.cpp compilado a WebAssembly dentro de
 * la pestaña. Aquí vive la parte pura: traducir la petición que la app ya
 * construye para cualquier proveedor OpenAI a lo que entiende wllama, elegir
 * el contexto y explicar los errores. Separado para poder probarlo con
 * vitest sin WebAssembly ni OPFS.
 */

/** Id del proveedor en toda la app. */
export const GGUF_PROVIDER_ID = "gguf";

/** wllama no lee un único ArrayBuffer de más de 2 GB: los modelos más grandes
 * hay que trocearlos con `llama-gguf-split` (00001-of-0000N). */
export const GGUF_MAX_TROZO = 2 * 1024 ** 3;

/** Contextos que se ofrecen. 8192 por defecto: el prompt de sistema de la app
 * (instrucciones, mapa, reglas, skills) ya ocupa unos 2.500 tokens, y con 4096
 * apenas quedaba sitio para la conversación. Con un modelo de 1-3B son unos
 * cientos de MB de memoria, que un portátil normal aguanta. */
export const GGUF_CONTEXTOS = [4096, 8192, 16384, 32768] as const;
export const GGUF_CONTEXTO_POR_DEFECTO = 8192;

/** Respuesta máxima si la petición no la fija: generar en CPU es lento, y una
 * respuesta sin techo puede tener la pestaña ocupada varios minutos. */
export const GGUF_MAX_TOKENS_POR_DEFECTO = 2048;

/** ¿Es un nombre de archivo GGUF? (o un trozo de uno partido). */
export function esArchivoGguf(nombre: string): boolean {
  return /\.gguf$/i.test(nombre.trim());
}

/** Los trozos de un modelo partido se llaman `x-00001-of-00003.gguf`. */
const TROZO = /^(.*)-(\d{5})-of-(\d{5})\.gguf$/i;

export interface GrupoGguf {
  /** Nombre con el que se ve y se elige el modelo (el del primer trozo). */
  nombre: string;
  /** Archivos en el orden en que hay que pasarlos a wllama. */
  archivos: string[];
  /** Trozos que faltan, si es un modelo partido incompleto. */
  faltan: number;
}

/** Agrupa archivos sueltos en modelos: un .gguf entero es un modelo; los
 * trozos `-0000k-of-0000n` se juntan bajo el nombre del primero. */
export function agruparGguf(nombres: readonly string[]): GrupoGguf[] {
  const sueltos: GrupoGguf[] = [];
  const partidos = new Map<string, { total: number; trozos: Map<number, string> }>();
  for (const n of nombres) {
    if (!esArchivoGguf(n)) continue;
    const m = n.match(TROZO);
    if (!m) {
      sueltos.push({ nombre: n, archivos: [n], faltan: 0 });
      continue;
    }
    const base = m[1];
    const total = Number(m[3]);
    const g = partidos.get(base) ?? { total, trozos: new Map<number, string>() };
    g.trozos.set(Number(m[2]), n);
    partidos.set(base, g);
  }
  const grupos = [...partidos.values()].map((g) => {
    const orden = [...g.trozos.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n);
    return { nombre: orden[0], archivos: orden, faltan: Math.max(0, g.total - g.trozos.size) };
  });
  return [...sueltos, ...grupos].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Nombre corto para la interfaz: sin `.gguf` ni el sufijo de trozo. */
export function nombreVisible(archivo: string): string {
  return archivo.replace(TROZO, "$1").replace(/\.gguf$/i, "");
}

/** Contexto efectivo: el pedido, sin pasar del que el modelo aprendió. */
export function contextoEfectivo(pedido: number, entrenado: number | undefined): number {
  const p = Number.isFinite(pedido) && pedido > 0 ? pedido : GGUF_CONTEXTO_POR_DEFECTO;
  return entrenado && entrenado > 0 ? Math.min(p, entrenado) : p;
}

type Parte = { type?: string; text?: string };

/** Mensaje tal como lo arma `streamChat` para el protocolo OpenAI. */
export interface MensajeOpenAI {
  role: string;
  content: string | unknown[] | null;
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
  reasoning_content?: string;
}

/** Mensaje en el formato de wllama (OpenAI sin extensiones de proveedor). */
export type MensajeWllama =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: unknown[] }
  | { role: "tool"; content: string; tool_call_id: string };

/** Aviso que sustituye a una imagen adjunta: este motor solo lee texto. */
export const AVISO_IMAGEN = "[Imagen adjunta: el modelo local no puede verla.]";

/** Texto de un contenido OpenAI: las partes de texto se juntan y cada imagen
 * se cambia por un aviso, para que el modelo sepa que había algo y no invente
 * qué era. */
export function textoDeContenido(content: MensajeOpenAI["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const trozos: string[] = [];
  for (const p of content as Parte[]) {
    if (p?.type === "text" && typeof p.text === "string") trozos.push(p.text);
    else if (p?.type === "image_url" || p?.type === "image") trozos.push(AVISO_IMAGEN);
  }
  return trozos.join("\n\n");
}

/** Traduce los mensajes de la app al formato de wllama. El razonamiento que
 * algunos proveedores exigen de vuelta (`reasoning_content`) no se reenvía:
 * llama.cpp lo volvería a meter en el prompt y solo gastaría contexto. */
export function mensajesParaWllama(msgs: readonly MensajeOpenAI[]): MensajeWllama[] {
  const out: MensajeWllama[] = [];
  for (const m of msgs) {
    const content = textoDeContenido(m.content);
    if (m.role === "tool" || m.tool_call_id) {
      out.push({ role: "tool", content, tool_call_id: m.tool_call_id ?? "" });
    } else if (m.role === "assistant") {
      const calls = Array.isArray(m.tool_calls) && m.tool_calls.length ? m.tool_calls : undefined;
      out.push(calls ? { role: "assistant", content, tool_calls: calls } : { role: "assistant", content });
    } else if (m.role === "system") {
      out.push({ role: "system", content });
    } else {
      out.push({ role: "user", content });
    }
  }
  return out;
}

/** Cuerpo OpenAI que `streamChat` ya construye para cualquier proveedor. */
export interface CuerpoOpenAI {
  messages: MensajeOpenAI[];
  temperature?: number;
  max_tokens?: number;
  tools?: unknown[];
}

/** Parámetros de `createChatCompletion` (sin `onData` ni `abortSignal`). */
export interface ParametrosWllama {
  messages: MensajeWllama[];
  temperature?: number;
  max_tokens: number;
  tools?: unknown[];
  stream: true;
  cache_prompt: true;
}

/** De la petición de la app a la de wllama. `max_tokens` siempre lleva techo
 * y nunca pasa de la mitad del contexto: si no, un historial largo deja sin
 * sitio la propia respuesta y llama.cpp corta a las pocas palabras. */
export function parametrosParaWllama(cuerpo: CuerpoOpenAI, nCtx: number): ParametrosWllama {
  const techo = Math.max(64, Math.floor(nCtx / 2));
  const pedido = cuerpo.max_tokens && cuerpo.max_tokens > 0 ? cuerpo.max_tokens : GGUF_MAX_TOKENS_POR_DEFECTO;
  return {
    messages: mensajesParaWllama(cuerpo.messages),
    ...(typeof cuerpo.temperature === "number" ? { temperature: cuerpo.temperature } : {}),
    max_tokens: Math.min(pedido, techo),
    ...(cuerpo.tools?.length ? { tools: cuerpo.tools } : {}),
    stream: true,
    // El prefijo que no cambia (sistema + historial) se reutiliza entre
    // turnos: sin esto cada mensaje vuelve a procesar todo el prompt.
    cache_prompt: true,
  };
}

/** Caracteres por token para estimar sin tokenizador (wllama 3 no lo expone).
 * Conservador: con texto en castellano y código, los tokenizadores de Llama y
 * Qwen rondan 3,5. Si llama.cpp dice que no cabe, el número real del error
 * corrige la proporción (ver `proporcionReal`). */
export const GGUF_CARACTERES_POR_TOKEN = 3.2;

/** Herramientas nativas solo a partir de este contexto: el catálogo ocupa unos
 * 5.000 tokens y el prompt de sistema de un encargo de página otros tantos.
 * Por debajo, el agente trabaja en su modo de texto, que no las necesita. */
export const GGUF_CONTEXTO_PARA_HERRAMIENTAS = 16384;

/** Bloques del prompt de sistema que se pueden quitar si no cabe, en orden: los
 * primeros son los que menos pierde la respuesta. La instrucción base, la
 * dirección de diseño, los datos que dio el usuario y el formato del modo
 * agente no están aquí: sin ellos la respuesta sería otra cosa. */
const BLOQUES_OPCIONALES: readonly { cabecera: RegExp; nombre: string }[] = [
  { cabecera: /^#{1,4} Skill activa:/, nombre: "skills activas" },
  { cabecera: /^#{1,4} EFECTOS\b/, nombre: "kit de efectos" },
  { cabecera: /^#{1,4} ICONOS\b/, nombre: "catálogo de iconos" },
  { cabecera: /^#{1,4} EVIDENCIA OBLIGATORIA/, nombre: "reglas de evidencia" },
  { cabecera: /^#{1,4} Acabado exigido/, nombre: "lista de acabados" },
  { cabecera: /^#{1,4} Sistema de composición visual/, nombre: "sistema de composición" },
  { cabecera: /^#{1,4} Esto es una tienda/, nombre: "guía de tienda" },
  { cabecera: /^#{1,4} Contenido \(/, nombre: "reglas de contenido" },
  { cabecera: /^#{1,4} PLANO DE CONTENIDO/, nombre: "plano de contenido" },
  { cabecera: /^#{1,4} Secciones obligatorias/, nombre: "lista de secciones" },
];

/** Tokens estimados de una petición: texto de los mensajes, herramientas y
 * lo que añade la plantilla de chat por mensaje. */
export function tokensEstimados(cuerpo: CuerpoOpenAI, caracteresPorToken = GGUF_CARACTERES_POR_TOKEN): number {
  return Math.ceil(caracteresDe(cuerpo) / caracteresPorToken) + cuerpo.messages.length * 8;
}

function caracteresDe(cuerpo: CuerpoOpenAI): number {
  let n = 0;
  for (const m of cuerpo.messages) {
    n += textoDeContenido(m.content).length;
    if (m.tool_calls) n += JSON.stringify(m.tool_calls).length;
  }
  if (cuerpo.tools?.length) n += JSON.stringify(cuerpo.tools).length;
  return n;
}

/** Proporción real a partir de lo que dijo llama.cpp («request (N tokens)»),
 * con un 5 % de margen. null si el error no trae el número. */
export function proporcionReal(cuerpo: CuerpoOpenAI, mensajeError: string): number | null {
  const m = mensajeError.match(/request \((\d+) tokens\)|n_prompt_tokens:\s*(\d+)/);
  const tokens = m ? Number(m[1] ?? m[2]) : 0;
  if (!tokens) return null;
  const sinPlantilla = Math.max(1, tokens - cuerpo.messages.length * 8);
  return (caracteresDe(cuerpo) / sinPlantilla) * 0.95;
}

export interface Aligerado {
  cuerpo: CuerpoOpenAI;
  /** Qué se quitó, en palabras, para decírselo al usuario. Vacío si cupo tal cual. */
  quitado: string[];
  tokens: number;
  cabe: boolean;
}

/** Quita de la petición lo que haga falta para que quepa en el contexto del
 * modelo local, en este orden: herramientas nativas, bloques opcionales del
 * prompt de sistema y, por último, los mensajes más viejos. El último mensaje
 * del usuario no se toca nunca. Deja sitio para la respuesta: un cuarto del
 * contexto, sin pasar de lo que pidió la app. */
export function aligerarParaContexto(
  cuerpo: CuerpoOpenAI,
  nCtx: number,
  caracteresPorToken = GGUF_CARACTERES_POR_TOKEN
): Aligerado {
  const pedido = cuerpo.max_tokens && cuerpo.max_tokens > 0 ? cuerpo.max_tokens : GGUF_MAX_TOKENS_POR_DEFECTO;
  const respuesta = Math.max(64, Math.min(pedido, Math.floor(nCtx / 4)));
  const presupuesto = nCtx - respuesta - 64;
  let c: CuerpoOpenAI = { ...cuerpo, messages: [...cuerpo.messages], max_tokens: respuesta };
  const quitado: string[] = [];
  const medir = () => tokensEstimados(c, caracteresPorToken);
  const listo = (): Aligerado => {
    const tokens = medir();
    return { cuerpo: c, quitado, tokens, cabe: tokens <= presupuesto };
  };
  if (medir() <= presupuesto) return listo();

  if (c.tools?.length) {
    c = { ...c, tools: undefined };
    quitado.push("herramientas nativas (el agente sigue en su modo de texto)");
    if (medir() <= presupuesto) return listo();
  }

  for (const b of BLOQUES_OPCIONALES) {
    let alguno = false;
    c = {
      ...c,
      messages: c.messages.map((m) => {
        if (m.role !== "system" || typeof m.content !== "string") return m;
        const trozos = m.content.split(/\n(?=#{1,4} )/);
        const quedan = trozos.filter((t) => !b.cabecera.test(t));
        if (quedan.length === trozos.length) return m;
        alguno = true;
        return { ...m, content: quedan.join("\n") };
      }),
    };
    if (alguno) {
      quitado.push(b.nombre);
      if (medir() <= presupuesto) return listo();
    }
  }

  // Mensajes viejos: de uno en uno desde el principio, sin dejar un resultado
  // de herramienta huérfano al frente. Ni el sistema ni la última pregunta.
  const ultimoUsuario = c.messages.map((m) => m.role).lastIndexOf("user");
  let viejos = 0;
  while (medir() > presupuesto) {
    const i = c.messages.findIndex((m) => m.role !== "system");
    if (i < 0 || i >= ultimoUsuario - viejos) break;
    const msgs = [...c.messages];
    msgs.splice(i, 1);
    viejos++;
    while (msgs[i] && (msgs[i].role === "tool" || msgs[i].tool_call_id) && i < ultimoUsuario - viejos) {
      msgs.splice(i, 1);
      viejos++;
    }
    c = { ...c, messages: msgs };
  }
  if (viejos) quitado.push(viejos === 1 ? "1 mensaje antiguo" : `${viejos} mensajes antiguos`);
  return listo();
}

/** ¿La plantilla de chat del modelo sabe de herramientas? Si la menciona, el
 * agente usa la llamada nativa (llama.cpp la valida con gramática); si no,
 * cae al camino XML, que cualquier modelo que siga instrucciones puede usar. */
export function plantillaConHerramientas(plantilla: string | null | undefined): boolean {
  return !!plantilla && /\btools?\b|tool_calls|<tool_call>/i.test(plantilla);
}

/** ¿El motor de llama.cpp se detuvo por dentro? wllama lo avisa como
 * «(ABORT) …» (abort() de C, GGML_ABORT, memoria agotada) o «exit(N)». Tras
 * eso el worker está muerto: hay que crearlo de nuevo. */
export function esAbortoDelMotor(err: unknown): boolean {
  const texto = err instanceof Error ? err.message : String(err ?? "");
  return /\(ABORT\)|Aborted\(|\bexit\(\d+\)/.test(texto);
}

/** Móvil o tableta: aquí WebGPU no es de fiar para un LLM (las GPUs admiten
 * búferes mucho más pequeños y una carga larga cuelga el navegador entero). */
export function esDispositivoMovil(ua: string, mobileHint?: boolean): boolean {
  return mobileHint === true || /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

/** Error de wllama → mensaje que dice qué hacer. `causa` es lo último que
 * llama.cpp escribió en su log antes de fallar, si se sabe. */
export function explicarErrorGguf(err: unknown, nCtx: number, causa?: string | null): string {
  const tipo = (err as { type?: string } | null)?.type;
  const texto = err instanceof Error ? err.message : String(err ?? "");
  const detalle = causa ? ` Detalle del motor: ${causa}` : "";
  if (esAbortoDelMotor(err)) {
    return (
      "El motor del modelo local se detuvo en este dispositivo: casi siempre es falta de memoria. " +
      "Prueba un modelo más pequeño (0,5-1,5B en Q4_K_M) o baja el contexto a 4.096 en Ajustes → " +
      "Proveedores → Modelo local, y pulsa «Regenerar»." +
      detalle
    );
  }
  // Antes que las demás: «Invalid» también casaría con «no se pudo cargar».
  if (/Invalid typed array length/i.test(texto)) {
    return (
      "El modelo local generó caracteres no válidos y el motor no pudo seguir. Pulsa «Regenerar»; " +
      "si se repite, prueba otra cuantización del modelo (Q4_K_M o Q5_K_M)."
    );
  }
  if (tipo === "kv_cache_full" || /context|n_ctx|kv cache|too long/i.test(texto)) {
    const pide = texto.match(/request \((\d+) tokens\)|n_prompt_tokens:\s*(\d+)/);
    const tokens = pide ? Number(pide[1] ?? pide[2]) : null;
    return (
      (tokens
        ? `La petición ocupa ${tokens} tokens y el contexto del modelo local es de ${nCtx}, aun quitando lo opcional. `
        : `La conversación no cabe en el contexto del modelo local (${nCtx} tokens). `) +
      "Empieza un hilo nuevo, resume la conversación o sube el contexto en Ajustes → Proveedores → Modelo local " +
      "(sin pasar del que admite el modelo)." +
      // Cola en el formato que la app ya reconoce como «no cabe» (decisiones.ts):
      // así aprende el límite de este modelo y recorta el historial en vez de
      // tratarlo como un proveedor caído.
      (tokens ? ` (maximum context length: limit ${nCtx}, requested ${tokens})` : " (maximum context length)")
    );
  }
  if (/memory|out of memory|allocate|Aborted\(\)|RangeError/i.test(texto)) {
    return (
      "El navegador se quedó sin memoria para el modelo local. Prueba un modelo más pequeño " +
      "(1-3B en Q4), baja el contexto o cierra otras pestañas."
    );
  }
  if (tipo === "load_error" || /load|magic|invalid|gguf/i.test(texto)) {
    return (
      "No se pudo cargar el archivo .gguf. Comprueba que el archivo está completo y que es un " +
      `modelo de texto compatible con llama.cpp. Detalle: ${texto}`
    );
  }
  return `El modelo local falló: ${texto || "error desconocido"}`;
}

/** «1,1 GB», «640 MB». */
export function tamanoLegible(bytes: number): string {
  const fmt = (n: number, unit: "gigabyte" | "megabyte") =>
    new Intl.NumberFormat("es", { style: "unit", unit, maximumFractionDigits: 1 }).format(n);
  return bytes >= 1024 ** 3 ? fmt(bytes / 1024 ** 3, "gigabyte") : fmt(bytes / 1024 ** 2, "megabyte");
}
