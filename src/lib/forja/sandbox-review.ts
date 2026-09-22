/** Forja IA — Revisión del proyecto del Sandbox.
 *
 * Analiza TODO el proyecto cargado (ZIP, repo local o semilla) y devuelve una
 * lista de problemas ordenados por gravedad, pensada para responder a una
 * pregunta concreta: «¿esto está listo para subirlo a GitHub?».
 *
 * Todo es estático y puro (sin DOM, sin red): se puede probar en Node y se
 * ejecuta entero en tu dispositivo. Nada del proyecto sale de aquí.
 *
 * Familias de comprobaciones:
 *   secreto    — claves de API, tokens y claves privadas incrustadas (lo más grave)
 *   privado    — archivos que no deberían acabar en un repo público (.env, *.pem…)
 *   ref        — enlaces locales rotos en HTML/CSS (href, src, url(), @import)
 *   sintaxis   — JSON inválido, llaves/paréntesis desbalanceados en JS y CSS
 *   html       — doctype, charset, viewport, title, lang, alt en imágenes
 *   riesgo     — eval, innerHTML, http:// sin cifrar, debugger
 *   git        — tamaños, colisiones de mayúsculas, rutas inválidas en Windows
 *   proyecto   — falta README, .gitignore, LICENSE o página de entrada
 *   estilo     — TODO/FIXME, console.log, BOM, CRLF
 */

import { extOf, isHtmlPath, isTextPath, localRef, resolvePath } from "./sandbox";
import { isRelativeSpecifier, specifiersOf } from "./sandbox-modules";

export type ReviewLevel = "error" | "warn" | "info";

export type ReviewFamily =
  | "secreto"
  | "privado"
  | "ref"
  | "sintaxis"
  | "html"
  | "riesgo"
  | "git"
  | "proyecto"
  | "estilo";

export interface Diagnostic {
  level: ReviewLevel;
  family: ReviewFamily;
  /** archivo al que apunta; "" = el proyecto entero */
  file: string;
  /** línea 1-based dentro del archivo, si aplica */
  line?: number;
  message: string;
  /** qué hacer para arreglarlo */
  hint?: string;
}

export interface ReviewReport {
  diagnostics: Diagnostic[];
  counts: Record<ReviewLevel, number>;
  /** archivos de texto analizados */
  scanned: number;
  /** total de archivos del proyecto */
  total: number;
  /** true si no hay ningún «error»: se puede subir con tranquilidad */
  ready: boolean;
}

/** Un archivo del proyecto tal y como lo ve la revisión. */
export interface ReviewFile {
  path: string;
  /** contenido de texto, o null si es binario */
  text: string | null;
  /** tamaño en bytes del archivo real */
  size: number;
  /** bytes crudos, si se tienen: permite buscar credenciales dentro de los
   * binarios (un PDF, una imagen con metadatos). Opcional porque hay orígenes
   * —un repo en la nube sin descargar— donde no están disponibles. */
  bytes?: Uint8Array;
}

const LEVEL_RANK: Record<ReviewLevel, number> = { error: 0, warn: 1, info: 2 };

/* ------------------------------------------------------------------ */
/* utilidades                                                          */
/* ------------------------------------------------------------------ */

/** Línea 1-based en la que cae el índice de carácter dado. */
export function lineAt(text: string, index: number): number {
  let line = 1;
  const end = Math.min(index, text.length);
  for (let i = 0; i < end; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** Sustituye el interior de cadenas, plantillas, regex y comentarios por espacios
 * (misma longitud y mismos saltos de línea) para poder contar delimitadores sin
 * falsos positivos.
 *
 * Las plantillas se tratan DE VERDAD: un `` ` `` con `${…}` no acaba en el
 * primer backtick — el código dentro de la interpolación se cuenta como código
 * (puede tener sus propios paréntesis) y el texto literal se enmascara, con
 * anidamiento recursivo (`` `a ${ x ? `b` : `${c}` } d` ``). Sin esto, un solo
 * template anidado desalineaba el balance de TODO lo que venía después y el
 * revisor acusaba paréntesis fantasma en archivos perfectamente válidos. */
export function maskJs(code: string): string {
  const out = code.split("");
  const blank = (from: number, to: number) => {
    for (let i = Math.max(0, from); i < to && i < out.length; i++) {
      if (out[i] !== "\n") out[i] = " ";
    }
  };

  /** Índice del «/» que cierra un posible regex abierto en `from`, o -1.
   *  No decide si lo que hay ES un regex: solo dice dónde acabaría si lo fuera. */
  const cierreRegex = (from: number, to: number): number => {
    let j = from + 1;
    let enClase = false;
    while (j < to) {
      const d = code[j];
      if (d === "\\") {
        j += 2;
        continue;
      }
      if (d === "\n") return -1;
      if (d === "[") enClase = true;
      else if (d === "]") enClase = false;
      else if (d === "/" && !enClase) return j;
      j++;
    }
    return -1;
  };

  /** Tras qué contexto un «/» huele a regex y no a división.
   *
   *  La ambigüedad dura de JS: `(x)/2` es división pero `for(...)/re/` es un
   *  regex (el «/» abre el cuerpo del for). Se resuelve con CONTEXTO:
   *  - si el último «(» abierto venía tras for/if/while/switch/with/catch, el
   *    «)» que lo cierra deja el turno en posición de ENUNCIO → regex;
   *  - tras palabras que solo pueden preceder un valor unario → regex;
   *  - tras operadores o inicio → regex. Con cualquier otra cosa (identificador,
   *  «)» de expresión, «]», comilla…) → división. */
  class ContextoRegex {
    palabra = ""; // último identificador visto en código
    trasCabecera = false; // acabamos de cerrar el «(» de una cabecera de bloque
    pilas: string[] = []; // palabra previa a cada «(» abierto
    static CABECERAS = new Set(["for", "if", "while", "switch", "with", "catch"]);
    static VALOR = new Set([
      "return", "typeof", "instanceof", "in", "of", "new", "delete",
      "void", "throw", "case", "do", "else", "yield", "await",
    ]);
    posibleRegex(prev: string): boolean {
      if (this.trasCabecera) return true;
      if (prev === "" || /[(,=:[!&|?{};+\-*%~^<>]/.test(prev)) return true;
      return ContextoRegex.VALOR.has(this.palabra);
    }
    /** Anota el carácter c consumido como código (no se llama con «/» de regex). */
    ver(c: string) {
      if (/[A-Za-z0-9_$]/.test(c)) {
        this.palabra = (this.palabra + c).slice(-40);
        this.trasCabecera = false;
        return;
      }
      if (c === "(") this.pilas.push(this.palabra);
      else if (c === ")") {
        const cabeza = this.pilas.pop() ?? "";
        this.trasCabecera = ContextoRegex.CABECERAS.has(cabeza);
      } else {
        this.trasCabecera = false;
      }
      this.palabra = "";
    }
  }

  /** Salta una cadena «"» o «'» empezando en `i` (code[i] es la comilla).
   *  Devuelve el índice QUE SIGUE a la comilla de cierre (o al salto de línea). */
  const saltoCadena = (i: number, to: number): number => {
    const q = code[i];
    let j = i + 1;
    while (j < to) {
      if (code[j] === "\\") {
        j += 2;
        continue;
      }
      if (code[j] === q || code[j] === "\n") break;
      j++;
    }
    return Math.min(j + 1, to);
  };

  /** Salta una plantilla empezando en `i` (code[i] es el backtick), sin
   *  enmascarar nada: para medir dónde acaba. Anida por `${…}`. */
  const saltoTemplate = (i: number, to: number): number => {
    let j = i + 1;
    while (j < to) {
      if (code[j] === "\\") {
        j += 2;
        continue;
      }
      if (code[j] === "`") return j + 1;
      if (code[j] === "$" && code[j + 1] === "{") {
        const close = matchingBrace(j + 1, to);
        if (close < 0) return to;
        j = close + 1;
        continue;
      }
      j++;
    }
    return to;
  };

  /** Índice del «}» que cierra el «{» que está en `from`, o -1. Salta
   *  cadenas, plantillas, comentarios y posibles regex por el camino. */
  function matchingBrace(from: number, to: number): number {
    let depth = 0;
    let prev = "{";
    const ctx = new ContextoRegex();
    let i = from;
    while (i < to) {
      const c = code[i];
      if (c === '"' || c === "'") {
        i = saltoCadena(i, to);
        ctx.ver(c);
        continue;
      }
      if (c === "`") {
        i = saltoTemplate(i, to);
        ctx.ver(c);
        continue;
      }
      if (c === "/" && code[i + 1] === "/") {
        const j = code.indexOf("\n", i);
        i = j < 0 ? to : j;
        continue;
      }
      if (c === "/" && code[i + 1] === "*") {
        const j = code.indexOf("*/", i + 2);
        i = j < 0 ? to : j + 2;
        continue;
      }
      if (c === "/" && ctx.posibleRegex(prev)) {
        const end = cierreRegex(i, to);
        if (end > 0) {
          prev = "/";
          ctx.ver("x"); // el regex consume el turno como un valor
          i = end + 1;
          continue;
        }
      }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return i;
      }
      if (!/\s/.test(c)) prev = c;
      ctx.ver(c);
      i++;
    }
    return -1;
  }

  /** Procesa el trozo [from, to) como código. `prevIn` es el último carácter
   *  significativo anterior (para el heuristic de regex). */
  const procesar = (from: number, to: number, prevIn: string): void => {
    let prevSignificant = prevIn;
    const ctx = new ContextoRegex();
    let i = from;
    while (i < to) {
      const c = code[i];
      const next = code[i + 1];
      if (c === "/" && next === "/") {
        let j = i + 2;
        while (j < to && code[j] !== "\n") j++;
        blank(i, j);
        i = j;
        continue;
      }
      if (c === "/" && next === "*") {
        const j = code.indexOf("*/", i + 2);
        const end = j < 0 ? to : j + 2;
        blank(i, end);
        i = end;
        continue;
      }
      if (c === '"' || c === "'") {
        const j = saltoCadena(i, to);
        blank(i + 1, j - 1); // se conservan las comillas: no afectan al balance
        i = j;
        prevSignificant = c;
        ctx.ver(c);
        continue;
      }
      if (c === "`") {
        // Plantilla: el texto literal se enmascara; cada ${…} se procesa
        // como código (recursión: puede llevar sus propias plantillas).
        let j = i + 1;
        while (j < to) {
          if (code[j] === "\\") {
            blank(j, Math.min(j + 2, to));
            j += 2;
            continue;
          }
          if (code[j] === "`") break;
          if (code[j] === "$" && code[j + 1] === "{") {
            const close = matchingBrace(j + 1, to);
            if (close < 0) {
              // ${ sin cerrar: lo que queda de la plantilla es texto
              blank(j, to);
              j = to;
              break;
            }
            procesar(j + 2, close, "{");
            j = close + 1;
            continue;
          }
          blank(j, j + 1);
          j++;
        }
        i = Math.min(j + 1, to);
        prevSignificant = "`";
        ctx.ver("`");
        continue;
      }
      if (c === "/" && ctx.posibleRegex(prevSignificant)) {
        const end = cierreRegex(i, to);
        if (end > 0) {
          blank(i + 1, end);
          i = end + 1;
          prevSignificant = "/";
          ctx.ver("x"); // el regex consume el turno como un valor
          continue;
        }
      }
      if (!/\s/.test(c)) prevSignificant = c;
      ctx.ver(c);
      i++;
    }
  };

  procesar(0, code.length, "");
  return out.join("");
}

/** Igual que maskJs pero para CSS: solo comentarios de bloque y cadenas. */
export function maskCss(code: string): string {
  const out = code.split("");
  const blank = (from: number, to: number) => {
    for (let i = Math.max(0, from); i < to && i < out.length; i++) {
      if (out[i] !== "\n") out[i] = " ";
    }
  };
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === "/" && code[i + 1] === "*") {
      const j = code.indexOf("*/", i + 2);
      const end = j < 0 ? code.length : j + 2;
      blank(i, end);
      i = end;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < code.length) {
        if (code[j] === "\\") {
          j += 2;
          continue;
        }
        if (code[j] === c || code[j] === "\n") break;
        j++;
      }
      blank(i + 1, j);
      i = Math.min(j + 1, code.length);
      continue;
    }
    i++;
  }
  return out.join("");
}

/** Equilibrio de (), [] y {} sobre código ya enmascarado.
 * Devuelve el primer desequilibrio encontrado, o null si todo cuadra. */
export function findUnbalanced(
  masked: string
): { index: number; expected: string; found: string } | null {
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: { ch: string; index: number }[] = [];
  for (let i = 0; i < masked.length; i++) {
    const c = masked[i];
    if (c === "(" || c === "[" || c === "{") stack.push({ ch: c, index: i });
    else if (c === ")" || c === "]" || c === "}") {
      const top = stack.pop();
      if (!top) return { index: i, expected: "", found: c };
      if (top.ch !== pairs[c]) return { index: i, expected: top.ch, found: c };
    }
  }
  const left = stack.pop();
  return left ? { index: left.index, expected: left.ch, found: "" } : null;
}

/* ------------------------------------------------------------------ */
/* secretos                                                            */
/* ------------------------------------------------------------------ */

/** Prefijos inequívocos de credenciales reales de servicios conocidos. */
const SECRET_RULES: { name: string; re: RegExp }[] = [
  { name: "clave de OpenAI", re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g },
  { name: "clave de Anthropic", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: "clave de OpenRouter", re: /\bsk-or-v1-[A-Za-z0-9]{32,}/g },
  { name: "clave de Google", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: "token de GitHub", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/g },
  { name: "token de GitHub de permisos finos", re: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g },
  { name: "token de Slack", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g },
  { name: "clave de acceso de AWS", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "clave secreta de Stripe", re: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}/g },
  { name: "token de Hugging Face", re: /\bhf_[A-Za-z0-9]{30,}\b/g },
  { name: "token de bot de Telegram", re: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g },
  { name: "clave privada", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g },
];

/** Asignaciones genéricas del tipo apiKey = "…" con un valor que parece real. */
const GENERIC_SECRET =
  /\b(api[_-]?key|apikey|api[_-]?secret|access[_-]?token|auth[_-]?token|secret[_-]?key|client[_-]?secret|password|passwd|contrase(?:n|ñ)a)\b\s*[:=]\s*["'`]([^"'`\n]{8,})["'`]/gi;

/** Valores que claramente son un hueco por rellenar, no una credencial. */
const PLACEHOLDER = new RegExp(
  "^(?:" +
    "x+|\\*+|\\.+|-+|_+|0+|<.*>|\\{.*\\}|\\$\\{.*\\}|%[a-z_]+%" +
    "|(?:tu|su|mi|your|my|the)[-_ .a-z]*" +
    "|(?:pon|poner|cambia|cambiar|rellena|replace|change|insert|add)[-_ .a-z]*" +
    "|(?:example|ejemplo|sample|demo|dummy|fake|test|placeholder|changeme|todo|none|null" +
    "|undefined|empty|secret|password|apikey|api_key|token|clave|key|value|valor|string" +
    "|abc123|123456|password123)[-_.a-z0-9]*" +
    ")$",
  "i"
);

function looksPlaceholder(value: string): boolean {
  const v = value.trim();
  if (!v || PLACEHOLDER.test(v)) return true;
  if (/^(?:process\.env|import\.meta\.env|os\.environ|Deno\.env)\b/.test(v)) return true;
  if (v.includes("…") || v.includes("...")) return true;
  // sin variedad de caracteres es casi seguro un hueco («aaaaaaaa»)
  return new Set(v).size <= 3;
}

/** Entropía de Shannon por carácter: distingue un token real de una frase. */
export function entropy(s: string): number {
  if (!s.length) return 0;
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of freq.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/** Extrae las cadenas de texto imprimible de un binario, como hace «strings».
 * Sirve para encontrar una credencial guardada dentro de un PDF, un .docx sin
 * comprimir o los metadatos de una imagen. No abre formatos comprimidos: lo que
 * esté deflateado dentro del archivo no se ve, y eso se dice en la pista. */
export function printableStrings(bytes: Uint8Array, minLen = 8, maxBytes = 2_000_000): string {
  const out: string[] = [];
  let actual = "";
  const n = Math.min(bytes.length, maxBytes);
  for (let i = 0; i < n; i++) {
    const b = bytes[i];
    // ASCII imprimible; se corta en cualquier otra cosa
    if (b >= 0x20 && b <= 0x7e) {
      actual += String.fromCharCode(b);
    } else {
      if (actual.length >= minLen) out.push(actual);
      actual = "";
    }
  }
  if (actual.length >= minLen) out.push(actual);
  return out.join("\n");
}

/* ------------------------------------------------------------------ */
/* archivos que no deberían subirse                                    */
/* ------------------------------------------------------------------ */

const PRIVATE_RULES: { re: RegExp; level: ReviewLevel; what: string; hint: string }[] = [
  {
    re: /(^|\/)\.env(?!\.example|\.sample|\.template)([.\w-]*)$/i,
    level: "error",
    what: "variables de entorno con posibles credenciales",
    hint: "Añádelo a .gitignore y sube solo un .env.example con los valores vacíos.",
  },
  {
    re: /\.(pem|p12|pfx|jks|keystore)$/i,
    level: "error",
    what: "certificado o material criptográfico",
    hint: "Bórralo del proyecto y añádelo a .gitignore.",
  },
  {
    re: /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/i,
    level: "error",
    what: "clave SSH privada",
    hint: "Bórrala del proyecto y, si alguna vez se subió, revócala.",
  },
  {
    re: /(^|\/)\.npmrc$/i,
    level: "warn",
    what: "configuración de npm (suele llevar _authToken)",
    hint: "Comprueba que no contiene tokens antes de subirlo.",
  },
  {
    re: /(^|\/)(\.git|node_modules|\.next|dist|build|vendor|__pycache__|\.venv)\//i,
    level: "warn",
    what: "carpeta generada o de dependencias",
    hint: "No hace falta en el repositorio: añádela a .gitignore.",
  },
  {
    re: /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/i,
    level: "info",
    what: "archivo basura del sistema operativo",
    hint: "Añádelo a .gitignore para que no viaje en los commits.",
  },
  {
    re: /\.(log|sqlite|sqlite3)$/i,
    level: "info",
    what: "registro o base de datos local",
    hint: "Suele ser ruido en el repositorio: considera ignorarlo.",
  },
  {
    re: /(^|\/)(\.idea|\.vscode)\//i,
    level: "info",
    what: "configuración personal del editor",
    hint: "Normalmente se ignora, salvo que el equipo la comparta a propósito.",
  },
];

/* ------------------------------------------------------------------ */
/* referencias locales                                                 */
/* ------------------------------------------------------------------ */

export interface RefHit {
  /** ruta ya resuelta respecto a la raíz del proyecto */
  target: string;
  /** texto original de la referencia */
  raw: string;
  index: number;
  attr: string;
}

const HTML_REF_ATTR = /\b(src|href|poster|data-src|srcset)\s*=\s*["']([^"']+)["']/gi;
const CSS_URL = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
const CSS_IMPORT = /@import\s+(?:url\(\s*)?["']?([^"')]+)["']?\s*\)?\s*;/gi;

/** Extrae las referencias locales de un HTML o CSS, ya resueltas a la raíz. */
export function extractRefs(path: string, text: string): RefHit[] {
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const hits: RefHit[] = [];
  const add = (raw: string, index: number, attr: string) => {
    const local = localRef(raw);
    if (!local) return;
    hits.push({ target: resolvePath(dir, local), raw, index, attr });
  };
  const ext = extOf(path);
  if (ext === "html" || ext === "htm") {
    for (const m of text.matchAll(HTML_REF_ATTR)) {
      const attr = m[1].toLowerCase();
      if (attr === "srcset") {
        // «a.png 1x, b.png 2x» → cada candidato por separado
        for (const part of m[2].split(",")) add(part.trim().split(/\s+/)[0], m.index ?? 0, attr);
      } else {
        add(m[2], m.index ?? 0, attr);
      }
    }
    // <style> embebido dentro del HTML
    for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
      const base = (m.index ?? 0) + m[0].indexOf(m[1]);
      for (const u of m[1].matchAll(CSS_URL)) add(u[1], base + (u.index ?? 0), "url()");
    }
  } else if (ext === "css") {
    for (const m of text.matchAll(CSS_IMPORT)) {
      /* `@import "tailwindcss"` (sin ./ ../ / ni extensión .css) es un import
       * de PAQUETE: lo resuelve el build (PostCSS, Lightning CSS, Vite) desde
       * node_modules, no un archivo del proyecto. Marcarlo de «enlace roto»
       * daba falsos positivos en cualquier proyecto Tailwind 4. Sí son
       * locales los que apuntan con ruta relativa o a un .css propio. */
      const r = m[1].trim();
      const esRuta = /^\.{0,2}\//.test(r);
      const primerSegmentoConPunto = (r.split("/")[0] ?? "").includes(".");
      if (!esRuta && !primerSegmentoConPunto) continue;
      add(m[1], m.index ?? 0, "@import");
    }
    for (const m of text.matchAll(CSS_URL)) add(m[1], m.index ?? 0, "url()");
  }
  return hits;
}

/* ------------------------------------------------------------------ */
/* revisión completa                                                   */
/* ------------------------------------------------------------------ */

const MAX_PER_RULE = 20; // no inundar el panel con el mismo aviso repetido
const MAX_PER_FILE_RULE = 20; // tope del mismo aviso dentro de un solo archivo
const BIG_FILE = 50 * 1024 * 1024; // GitHub avisa por encima de esto
const HUGE_FILE = 100 * 1024 * 1024; // GitHub lo rechaza
const WINDOWS_INVALID = /[<>:"|?*]/;

/** http:// que de verdad descarga algo. Quedan fuera el desarrollo local y los
 * identificadores de espacio de nombres y DTD (xmlns de los SVG, DOCTYPE…),
 * que nunca se piden por red aunque lo parezcan. */
const HTTP_INSECURE = new RegExp(
  "[\"'(]http://(?!" +
    "localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0|\\[::1\\]" +
    "|(?:www\\.)?w3\\.org/|purl\\.org/|ns\\.adobe\\.com/|schemas\\.[a-z]" +
    "|(?:www\\.)?inkscape\\.org/|sodipodi\\.sourceforge\\.net/|xml\\.apache\\.org/" +
    "|(?:www\\.)?openarchives\\.org/|creativecommons\\.org/ns" +
    ")",
  "g"
);

/** Identidad estable de un hallazgo, para saber si uno es «el mismo de antes».
 * No entra el nivel: lo que importa es qué se encontró y dónde. */
export function diagnosticKey(d: Diagnostic): string {
  return `${d.family}|${d.file}|${d.line ?? 0}|${d.message}`;
}

/** Claves de los hallazgos que bloquean (los de nivel error) de un informe. */
export function blockingKeys(report: ReviewReport): Set<string> {
  return new Set(
    report.diagnostics.filter((d) => d.level === "error").map(diagnosticKey)
  );
}

/** Comprobaciones que miran el proyecto entero, no un archivo suelto.
 * Solo dependen de la lista de rutas, así que son baratas de rehacer. */
export function projectDiagnostics(paths: string[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const known = new Set(paths);
  const files = paths;
  const push = (d: Diagnostic) => diagnostics.push(d);

  /* --- comprobaciones a nivel de proyecto --- */
  if (files.length && !paths.some(isHtmlPath)) {
    push({
      level: "warn",
      family: "proyecto",
      file: "",
      message: "El proyecto no tiene ninguna página HTML.",
      hint: "El Sandbox ejecuta webs estáticas: añade un index.html para poder probarlo aquí.",
    });
  }
  if (files.length && !paths.some((p) => /^readme(\.md|\.txt)?$/i.test(p))) {
    push({
      level: "info",
      family: "proyecto",
      file: "",
      message: "No hay README en la raíz.",
      hint: "GitHub lo muestra como portada del repositorio: explica qué es y cómo se usa.",
    });
  }
  if (files.length && !known.has(".gitignore")) {
    push({
      level: "warn",
      family: "proyecto",
      file: "",
      message: "No hay .gitignore.",
      hint: "Sin él es fácil subir sin querer .env, node_modules o archivos temporales.",
    });
  }
  if (files.length && !paths.some((p) => /^licen[cs]e(\.md|\.txt)?$/i.test(p))) {
    push({
      level: "info",
      family: "proyecto",
      file: "",
      message: "No hay archivo de licencia.",
      hint: "Sin licencia nadie sabe con qué permisos puede usar tu código.",
    });
  }

  /* --- colisiones de mayúsculas (rompen el clon en Windows y macOS) --- */
  const byLower = new Map<string, string[]>();
  for (const p of paths) {
    const k = p.toLowerCase();
    byLower.set(k, [...(byLower.get(k) ?? []), p]);
  }
  for (const group of byLower.values()) {
    if (group.length > 1) {
      push({
        level: "error",
        family: "git",
        file: group[0],
        message: `Varios archivos con el mismo nombre salvo mayúsculas: ${group.join(", ")}.`,
        hint: "En Windows y macOS se pisan entre sí al clonar. Renombra uno.",
      });
    }
  }

  return diagnostics;
}

/** Comprobaciones de UN archivo. Puras: dependen solo de su contenido y del
 * conjunto de rutas del proyecto (que hace falta para los enlaces locales).
 * Al ser puras se pueden cachear, que es lo que hace createReviewer. */
export function fileDiagnostics(f: ReviewFile, known: Set<string>): Diagnostic[] {
  const out: Diagnostic[] = [];
  const push = (d: Diagnostic) => out.push(d);
  const ruleCount = new Map<string, number>();
  // Tope POR ARCHIVO: acota el caso patológico (un .js minificado con miles de
  // coincidencias) sin depender del orden en que se recorra el proyecto. El
  // tope global se aplica después, al montar el informe.
  const budget = (key: string): boolean => {
    const n = (ruleCount.get(key) ?? 0) + 1;
    ruleCount.set(key, n);
    return n <= MAX_PER_FILE_RULE;
  };
  {
    const { path, text, size } = f;

    /* rutas y tamaños */
    if (WINDOWS_INVALID.test(path)) {
      push({
        level: "error",
        family: "git",
        file: path,
        message: "La ruta tiene caracteres que Windows no admite.",
        hint: 'Evita < > : " | ? * en los nombres de archivo.',
      });
    }
    if (size > HUGE_FILE) {
      push({
        level: "error",
        family: "git",
        file: path,
        message: `Archivo de ${Math.round(size / 1048576)} MB: GitHub rechaza los mayores de 100 MB.`,
        hint: "Usa Git LFS o deja el archivo fuera del repositorio.",
      });
    } else if (size > BIG_FILE) {
      push({
        level: "warn",
        family: "git",
        file: path,
        message: `Archivo de ${Math.round(size / 1048576)} MB: GitHub avisa por encima de 50 MB.`,
        hint: "Comprímelo o considera Git LFS si va a cambiar a menudo.",
      });
    }

    for (const rule of PRIVATE_RULES) {
      if (rule.re.test(path) && budget(`priv:${rule.what}`)) {
        push({
          level: rule.level,
          family: "privado",
          file: path,
          message: `No conviene subir esto a GitHub: ${rule.what}.`,
          hint: rule.hint,
        });
      }
    }

    // Un binario no tiene texto que analizar, pero sí puede llevar una
    // credencial dentro: se le pasan las cadenas imprimibles por las mismas
    // reglas de secretos antes de darlo por revisado.
    if (text === null) {
      if (f.bytes && f.bytes.length) {
        const cadenas = printableStrings(f.bytes);
        for (const rule of SECRET_RULES) {
          for (const m of cadenas.matchAll(rule.re)) {
            void m;
            if (!budget(`bin:${rule.name}`)) break;
            push({
              level: "error",
              family: "secreto",
              file: path,
              message: `Parece una ${rule.name} guardada dentro de este archivo binario.`,
              hint: "Ábrelo y quítala antes de subir. Si el archivo va comprimido por dentro, revísalo también a mano: aquí solo se ve el texto sin comprimir.",
            });
          }
        }
      }
      return out;
    }

    /* --- secretos --- */
    for (const rule of SECRET_RULES) {
      for (const m of text.matchAll(rule.re)) {
        if (!budget(`sec:${rule.name}`)) break;
        push({
          level: "error",
          family: "secreto",
          file: path,
          line: lineAt(text, m.index ?? 0),
          message: `Parece una ${rule.name} incrustada en el código.`,
          hint: "Bórrala antes de subir y revócala en el proveedor: los repos públicos se rastrean en segundos.",
        });
      }
    }
    for (const m of text.matchAll(GENERIC_SECRET)) {
      const value = m[2];
      if (looksPlaceholder(value) || entropy(value) < 3) continue;
      if (!budget("sec:generico")) break;
      push({
        level: "warn",
        family: "secreto",
        file: path,
        line: lineAt(text, m.index ?? 0),
        message: `«${m[1]}» tiene un valor que parece una credencial real.`,
        hint: "Léelo de una variable de entorno en vez de escribirlo en el código.",
      });
    }

    /* --- referencias locales rotas --- */
    if (isHtmlPath(path) || extOf(path) === "css") {
      const seen = new Set<string>();
      for (const hit of extractRefs(path, text)) {
        if (known.has(hit.target) || seen.has(hit.target)) continue;
        seen.add(hit.target);
        if (!budget("ref")) break;
        push({
          level: "error",
          family: "ref",
          file: path,
          line: lineAt(text, hit.index),
          message: `${hit.attr}="${hit.raw}" apunta a «${hit.target}», que no está en el proyecto.`,
          hint: "Corrige la ruta o añade el archivo: al publicarlo se verá como un recurso roto.",
        });
      }
    }

    /* --- sintaxis --- */
    const ext = extOf(path);
    if (ext === "json") {
      try {
        JSON.parse(text);
      } catch (e) {
        push({
          level: "error",
          family: "sintaxis",
          file: path,
          message: `JSON inválido: ${e instanceof Error ? e.message : String(e)}`,
          hint: "Revisa comas sobrantes, comillas simples o comentarios (JSON no los admite).",
        });
      }
    }
    if (ext === "js" || ext === "mjs") {
      for (const spec of specifiersOf(text)) {
        if (isRelativeSpecifier(spec) || /^(https?:|data:|blob:|forja:)/i.test(spec)) continue;
        if (!budget("modulo:bare")) break;
        push({
          level: "info",
          family: "riesgo",
          file: path,
          line: lineAt(text, text.indexOf(spec)),
          message: `Importa el paquete «${spec}».`,
          hint: "El Sandbox no instala dependencias: eso solo funcionará donde hagas el build.",
        });
      }
    }
    if (ext === "js" || ext === "mjs" || ext === "cjs" || ext === "jsx") {
      const bad = findUnbalanced(maskJs(text));
      if (bad) {
        push({
          level: "error",
          family: "sintaxis",
          file: path,
          line: lineAt(text, bad.index),
          message: bad.found
            ? `Cierre «${bad.found}» sin su apertura correspondiente.`
            : `«${bad.expected}» abierto y nunca cerrado.`,
          hint: "Los delimitadores no cuadran: el navegador no llegará a ejecutar el archivo.",
        });
      }
    }
    if (ext === "css") {
      const bad = findUnbalanced(maskCss(text).replace(/[()[\]]/g, " "));
      if (bad) {
        push({
          level: "error",
          family: "sintaxis",
          file: path,
          line: lineAt(text, bad.index),
          message: bad.found ? "Hay un «}» de más." : "Hay un bloque «{» sin cerrar.",
          hint: "A partir de ahí el navegador descarta el resto de la hoja de estilos.",
        });
      }
    }

    /* --- HTML --- */
    if (isHtmlPath(path)) {
      const head = text.slice(0, 4000);
      if (!/<!doctype\s+html/i.test(head)) {
        push({
          level: "warn",
          family: "html",
          file: path,
          line: 1,
          message: "Falta <!doctype html> al principio.",
          hint: "Sin él los navegadores entran en «modo peculiar» y el diseño puede descolocarse.",
        });
      }
      if (!/<meta[^>]+charset/i.test(head)) {
        push({
          level: "warn",
          family: "html",
          file: path,
          line: 1,
          message: 'Falta <meta charset="utf-8">.',
          hint: "Sin ello los acentos y las eñes pueden verse como símbolos raros.",
        });
      }
      if (!/<meta[^>]+name\s*=\s*["']viewport/i.test(head)) {
        push({
          level: "warn",
          family: "html",
          file: path,
          line: 1,
          message: "Falta la etiqueta viewport.",
          hint: 'Añade <meta name="viewport" content="width=device-width, initial-scale=1"> o se verá diminuto en el móvil.',
        });
      }
      const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (!title || !title[1].trim()) {
        push({
          level: "warn",
          family: "html",
          file: path,
          line: title ? lineAt(text, title.index ?? 0) : 1,
          message: "La página no tiene <title> con texto.",
          hint: "Es lo que se ve en la pestaña del navegador y en los resultados de búsqueda.",
        });
      }
      if (!/<html[^>]+lang\s*=/i.test(head)) {
        push({
          level: "info",
          family: "html",
          file: path,
          line: 1,
          message: 'Al <html> le falta el atributo lang (por ejemplo lang="es").',
          hint: "Ayuda a los lectores de pantalla y al traductor del navegador.",
        });
      }
      for (const m of text.matchAll(/<img\b[^>]*>/gi)) {
        if (/\balt\s*=/i.test(m[0])) continue;
        if (!budget("html:alt")) break;
        push({
          level: "info",
          family: "html",
          file: path,
          line: lineAt(text, m.index ?? 0),
          message: "Imagen sin atributo alt.",
          hint: 'Describe la imagen para quien use un lector de pantalla (alt="" si es decorativa).',
        });
      }
    }

    /* --- riesgos --- */
    if (isTextPath(path) && ext !== "md") {
      for (const m of text.matchAll(/\bdebugger\b\s*;?/g)) {
        if (!budget("riesgo:debugger")) break;
        push({
          level: "warn",
          family: "riesgo",
          file: path,
          line: lineAt(text, m.index ?? 0),
          message: "Queda un «debugger» en el código.",
          hint: "Detiene la página en seco si alguien tiene abiertas las herramientas de desarrollo.",
        });
      }
      for (const m of text.matchAll(/\beval\s*\(/g)) {
        if (!budget("riesgo:eval")) break;
        push({
          level: "warn",
          family: "riesgo",
          file: path,
          line: lineAt(text, m.index ?? 0),
          message: "Uso de eval().",
          hint: "Ejecuta texto como código: si viene de fuera, es una puerta abierta.",
        });
      }
      for (const m of text.matchAll(/\.innerHTML\s*=(?!=)/g)) {
        if (!budget("riesgo:innerHTML")) break;
        push({
          level: "info",
          family: "riesgo",
          file: path,
          line: lineAt(text, m.index ?? 0),
          message: "Asignación a innerHTML.",
          hint: "Con contenido de terceros permite inyectar scripts: usa textContent si es solo texto.",
        });
      }
      for (const m of text.matchAll(HTTP_INSECURE)) {
        if (!budget("riesgo:http")) break;
        push({
          level: "warn",
          family: "riesgo",
          file: path,
          line: lineAt(text, m.index ?? 0),
          message: "Recurso enlazado por http:// sin cifrar.",
          hint: "En una página servida por https el navegador lo bloqueará: cámbialo a https://.",
        });
      }
    }

    /* --- estilo --- */
    if (text.charCodeAt(0) === 0xfeff) {
      push({
        level: "info",
        family: "estilo",
        file: path,
        line: 1,
        message: "El archivo empieza con BOM (marca de orden de bytes).",
        hint: "Puede colarse como carácter invisible al principio de la página.",
      });
    }
    if (text.includes("\r\n") && budget("estilo:crlf")) {
      push({
        level: "info",
        family: "estilo",
        file: path,
        message: "Saltos de línea de Windows (CRLF).",
        hint: "Git puede marcar el archivo entero como modificado. Normaliza a LF o configura core.autocrlf.",
      });
    }
    for (const m of text.matchAll(/\b(TODO|FIXME|XXX|HACK)\b/g)) {
      if (!budget("estilo:todo")) break;
      push({
        level: "info",
        family: "estilo",
        file: path,
        line: lineAt(text, m.index ?? 0),
        message: `Queda un ${m[1]} pendiente.`,
        hint: "Resuélvelo o anótalo como incidencia antes de publicar.",
      });
    }
    if (ext === "js" || ext === "mjs" || ext === "cjs") {
      for (const m of text.matchAll(/\bconsole\.(log|debug)\s*\(/g)) {
        if (!budget("estilo:console")) break;
        push({
          level: "info",
          family: "estilo",
          file: path,
          line: lineAt(text, m.index ?? 0),
          message: `Queda un console.${m[1]}().`,
          hint: "Está bien mientras desarrollas; quítalo antes de publicar si ya no aporta.",
        });
      }
    }
  
  }
  return out;
}

/** Clave de la regla que produjo un hallazgo: la pista es constante por regla,
 * así que sirve para agrupar sin arrastrar metadatos por todo el motor. */
function ruleKeyOf(d: Diagnostic): string {
  return `${d.family}|${d.hint ?? d.message}`;
}

/** Monta el informe a partir de los hallazgos ya calculados. */
export function assembleReport(
  perFile: Diagnostic[],
  project: Diagnostic[],
  scanned: number,
  total: number
): ReviewReport {
  const ruleCount = new Map<string, number>();
  const diagnostics: Diagnostic[] = [];
  for (const d of [...project, ...perFile]) {
    const k = ruleKeyOf(d);
    const n = (ruleCount.get(k) ?? 0) + 1;
    ruleCount.set(k, n);
    if (n <= MAX_PER_RULE) diagnostics.push(d);
  }

  diagnostics.sort(
    (a, b) =>
      LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
      a.file.localeCompare(b.file) ||
      (a.line ?? 0) - (b.line ?? 0)
  );

  const counts: Record<ReviewLevel, number> = { error: 0, warn: 0, info: 0 };
  for (const d of diagnostics) counts[d.level]++;

  return { diagnostics, counts, scanned, total, ready: counts.error === 0 };
}

export function reviewProject(files: ReviewFile[]): ReviewReport {
  const known = new Set(files.map((f) => f.path));
  const perFile = files.flatMap((f) => fileDiagnostics(f, known));
  return assembleReport(
    perFile,
    projectDiagnostics(files.map((f) => f.path)),
    files.filter((f) => f.text !== null).length,
    files.length
  );
}

/* ------------------------------------------------------------------ */
/* revisión incremental                                                */
/* ------------------------------------------------------------------ */

export interface Reviewer {
  review: (files: ReviewFile[]) => ReviewReport;
  /** archivos reanalizados en la última llamada (el resto salió de la caché) */
  lastAnalyzed: number;
  reset: () => void;
}

interface CacheEntry {
  text: string | null;
  size: number;
  /** versión del conjunto de rutas con la que se calculó */
  pathsVersion: number;
  diagnostics: Diagnostic[];
}

/**
 * Revisor que recuerda lo que ya analizó.
 *
 * El motor es puro, así que los hallazgos de un archivo solo cambian si cambia
 * su contenido o si cambia el conjunto de rutas del proyecto (de eso dependen
 * los enlaces locales rotos). Mientras escribes, lo segundo no pasa: se
 * reanaliza el archivo que tocas y los demás salen de la caché.
 *
 * Sin esto, revisar un repo de 1500 archivos costaba ~390 ms en el hilo
 * principal cada vez que parabas de teclear.
 */
export function createReviewer(): Reviewer {
  let cache = new Map<string, CacheEntry>();
  let pathsKey = "";
  let pathsVersion = 0;
  let lastAnalyzed = 0;

  const reviewer: Reviewer = {
    lastAnalyzed: 0,
    reset() {
      cache = new Map();
      pathsKey = "";
      pathsVersion = 0;
      reviewer.lastAnalyzed = 0;
    },
    review(files: ReviewFile[]): ReviewReport {
      const paths = files.map((f) => f.path);
      const clave = paths.join("\n");
      if (clave !== pathsKey) {
        pathsKey = clave;
        pathsVersion++;
      }
      const known = new Set(paths);

      lastAnalyzed = 0;
      const perFile: Diagnostic[] = [];
      const vivos = new Set<string>();
      for (const f of files) {
        vivos.add(f.path);
        const prev = cache.get(f.path);
        if (
          prev &&
          prev.text === f.text &&
          prev.size === f.size &&
          prev.pathsVersion === pathsVersion
        ) {
          perFile.push(...prev.diagnostics);
          continue;
        }
        const d = fileDiagnostics(f, known);
        cache.set(f.path, {
          text: f.text,
          size: f.size,
          pathsVersion,
          diagnostics: d,
        });
        lastAnalyzed++;
        perFile.push(...d);
      }
      // los archivos borrados no deben quedarse ocupando memoria
      for (const p of [...cache.keys()]) if (!vivos.has(p)) cache.delete(p);

      reviewer.lastAnalyzed = lastAnalyzed;
      return assembleReport(
        perFile,
        projectDiagnostics(paths),
        files.filter((f) => f.text !== null).length,
        files.length
      );
    },
  };
  return reviewer;
}
