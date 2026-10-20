/** FORJA IA — Seguridad del autoaprendizaje de FORJA IA.
 *
 * El Apartado Aprender deja que el usuario alimente la IA con links de
 * sitios y repos. Eso es poderoso y ES seguro SI se cumplen estas capas:
 *
 *   1. VALIDACIÓN DE URL (aquí): solo https público, sin credenciales ni
 *      puertos raros, sin dominios opacos (acortadores), sin binarios.
 *      Protege contra SSRF (que el lector pida 127.0.0.1, la red interna
 *      o los metadatos 169.254.169.254 del hosting).
 *   2. APROBACIÓN HUMANA: ninguna fuente se aprende sola. El usuario la
 *      añade desde el Apartado y queda como «pendiente» hasta aprobarla.
 *      NUNCA se aceptan URLs que lleguen por chat (inyección de prompts:
 *      alguien podría hacer que la IA «aprenda» de una página envenenada).
 *   3. TEXTO, NUNCA HTML EJECUTADO: lo leído se reduce a texto plano con
 *      textoDesdeHtml() y se muestra escapado. Jamás innerHTML con
 *      contenido de terceros (XSS).
 *   4. PRESUPUESTOS: tope de fuentes por ciclo, tamaño por página y
 *      descanso mínimo entre ciclos. Un ciclo nunca se descontrola.
 *   5. DESTILACIÓN, NO COPIA: se almacenan reglas generales reescritas,
 *      con su origen anotado. No se guardan fragmentos literales.
 *
 * Las comprobaciones 1 y 3 corren AQUÍ; la 2 vive en fuentes-usuario.ts;
 * la 4 en autoaprendizaje.ts. La validación del host (ruta /api) debe
 * repetir la capa 1 en el servidor — ver LEEME-INTEGRACION.md.
 */

/** Verificación base de URL: protocolo y host público. */
export function urlSegura(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".localhost")) return false;
    if (/^127\./.test(h) || /^10\./.test(h)) return false;
    if (/^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    if (/^169\.254\./.test(h) || /^0\./.test(h)) return false;
    if (h === "0.0.0.0" || h === "[::1]") return false;
    return true;
  } catch {
    return false;
  }
}

/** Dominios que NO se aceptan ni pagando: acortadores (destino opaco,
 * no se puede auditar a dónde lleva) y rastreadores puros. */
export const DOMINIOS_BLOQUEADOS: string[] = [
  // acortadores: el destino real queda oculto
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "cutt.ly",
  "ow.ly", "buff.ly", "rebrand.ly", "shorturl.at", "rb.gy", "tiny.cc",
  // rastreadores / publicidad
  "doubleclick.net", "google-analytics.com", "googletagmanager.com",
  "adservice.google.com",
];

/** Extensiones de archivo que jamás se leen: la IA come TEXTO. */
const EXT_BINARIAS =
  /\.(zip|rar|7z|tar|gz|tgz|bz2|xz|exe|dmg|pkg|msi|apk|iso|bin|deb|rpm|mp4|mp3|mov|avi|mkv|webm|woff|woff2|ttf|otf|eot|psd|ai|sketch|fig|pdf|doc|docx|ppt|pptx|xls|xlsx|odt|ods|epub|mobi)$/i;

/** Dictamen completo de una URL para el aprendizaje. */
export interface DictamenUrl {
  ok: boolean;
  /** motivos por los que se rechaza (vacío si ok) */
  motivos: string[];
  /** avisos que no bloquean pero la UI muestra */
  avisos: string[];
}

const MAX_LARGO_URL = 800;

/** Validación de seguridad COMPLETA (capa 1). Úsala en el cliente ANTES de
 * guardar la fuente y OTRA VEZ en tu ruta /api antes de hacer fetch. */
export function urlAptaparaAprendizaje(url: string): DictamenUrl {
  const motivos: string[] = [];
  const avisos: string[] = [];

  if (!url || url.length > MAX_LARGO_URL) {
    motivos.push(`URL vacía o demasiado larga (máx. ${MAX_LARGO_URL} caracteres).`);
    return { ok: false, motivos, avisos };
  }
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, motivos: ["No es una URL válida."], avisos };
  }

  if (u.protocol !== "https:") {
    motivos.push("Solo se acepta https (el contenido viaja cifrado).");
  }
  if (u.username || u.password) {
    motivos.push("La URL contiene usuario/contraseña: no se acepta.");
  }
  if (u.port) {
    motivos.push(`Puerto no estándar (${u.port}) no permitido: solo 443.`);
  }

  const h = u.hostname.toLowerCase();
  if (!urlSegura(url)) {
    motivos.push(
      "Host no público (localhost, red privada o dirección de metadatos): bloqueado por SSRF."
    );
  }
  if (h.startsWith("xn--") || h.includes(".xn--")) {
    avisos.push("Dominio internacionalizado (punycode): verifica que es el real.");
  }
  if (DOMINIOS_BLOQUEADOS.some((d) => h === d || h.endsWith("." + d))) {
    motivos.push("Dominio en la lista de bloqueados (acortador o rastreador).");
  }
  if (EXT_BINARIAS.test(u.pathname)) {
    motivos.push("Parece un archivo binario: solo se leen textos (html, md, txt…).");
  }

  return { ok: motivos.length === 0, motivos, avisos };
}

/** ¿El content-type de la respuesta es comestible? (el host lo comprueba
 * antes de pasar el cuerpo al ciclo). */
export function tipoContenidoAceptado(contentType: string): boolean {
  const ct = contentType.toLowerCase();
  return (
    ct.includes("text/html") ||
    ct.includes("text/plain") ||
    ct.includes("text/markdown") ||
    ct.includes("application/json") ||
    ct.includes("application/xml") ||
    ct.includes("text/xml")
  );
}

/** Convierte HTML crudo en texto plano SEGURO (capa 3, anti-XSS).
 * Elimina por completo scripts, estilos, iframes, svg y comentarios, y
 * deja el contenido textual. El resultado se puede mostrar escapado o
 * pasárselo al extractor; NUNCA usar el HTML original en innerHTML. */
export function textoDesdeHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|noscript|iframe|object|embed|svg|template|form)[\s\S]*?<\/\1>/gi,
      " "
    )
    .replace(/<(p|div|li|h[1-6]|tr|section|article|header|footer|ul|ol|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/** Escapa texto para mostrarlo en HTML sin riesgo (snippets del informe). */
export function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ------------------- capa anti-inyección de prompts ---------------------- */

/** El contenido de una página es DATO, nunca instrucciones. Antes de dárselo
 * al extractor se neutraliza lo más común:
 *   · bytes de control y nulos;
 *   · etiquetas <regla> falsas (que una página «forje» reglas que el parser
 *     atribuiría al modelo);
 *   · frases clásicas de «ignora las instrucciones» (ES/EN) y encabezados
 *     de rol falseados («system:», «asistente:»).
 * La defensa de fondo sigue siendo el formato de salida cerrado del
 * extractor, la validación de cada regla y el informe visible al humano:
 * esta capa reduce ruido, no es la única barrera. */
const RX_INSTRUCCIONES_INJERTADAS: RegExp[] = [
  /\bignora(?:r)?\s+(?:todas\s+)?(?:las\s+)?(?:instrucciones|indicaciones|reglas|prompts?|sistema)\s+(?:anteriores|previas|previos|del\s+sistema)?/gi,
  /\b(?:disregard|ignore|forget)\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|prompts?|rules)/gi,
  /(?:^|\n)\s*(?:sistema|system|asistente|assistant)\s*:/gi,
  /\beres\s+un(?:a)?\s+(?:nueva|nuevo)\s+(?:ia|ai|instrucci[óo]n|versi[óo]n)/gi,
  /\b(?:you are|from now on you are)\s+(?:a\s+)?(?:new|the new)\s+/gi,
];

const MARCADOR_NEUTRALIZADO = "[texto neutralizado]";

/** Limpieza anti-inyección del contenido leído. Siempre se ejecuta en el
 * ciclo de aprendizaje, sea de fuentes semilla o del usuario. */
export function limpiarTextoParaExtractor(texto: string): string {
  let t = texto
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/<\/?regla\b[^>]*>/gi, " ");
  for (const rx of RX_INSTRUCCIONES_INJERTADAS) {
    t = t.replace(rx, MARCADOR_NEUTRALIZADO);
  }
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

/* ----------------------------- presupuestos ---------------------------- */

/** Presupuestos duros del aprendizaje. Son constantes deliberadas: si
 * algún día se parametrizan, que sigan siendo topes bajos por diseño. */
export const PRESUPUESTO_APRENDIZAJE = {
  /** fuentes por ciclo (semilla + usuario combinadas) */
  fuentesPorCiclo: 3,
  /** caracteres de contenido por página que llegan al extractor */
  maxCharsPorPagina: 40_000,
  /** bytes máximos de descarga por página (2 MB) — el host lo aplica */
  maxBytesPorPagina: 2_000_000,
  /** minutos de descanso mínimo entre ciclos */
  minutosEntreCiclos: 15,
  /** segundos de timeout recomendados por página (el host lo aplica) */
  timeoutSegundos: 12,
} as const;

/** ¿Ha pasado suficiente descanso desde el último ciclo? */
export function intervaloSuficiente(ultimoCicloIso: string | undefined, ahora = new Date()): boolean {
  if (!ultimoCicloIso) return true;
  const t = new Date(ultimoCicloIso).getTime();
  if (Number.isNaN(t)) return true;
  return ahora.getTime() - t >= PRESUPUESTO_APRENDIZAJE.minutosEntreCiclos * 60_000;
}
