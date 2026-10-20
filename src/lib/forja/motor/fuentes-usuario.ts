/** FORJA IA — Fuentes de aprendizaje elegidas por el usuario (el «Apartado»).
 *
 * La petición del usuario: «que lo de aprender sea un apartado donde se le
 * ponga links de sitios, repos y cosas así, para que se alimente». Este
 * archivo es el almacén y las reglas de ese apartado:
 *
 *   · el usuario pega una URL → se NORMALIZA (quita rastreo, convierte
 *     repos de GitHub a su README raw) y se VALIDA con seguridad-web.ts;
 *   · ninguna fuente se guarda sin pasar por la validación;
 *   · el chat solo puede PROPONER fuentes: la aprobación humana ocurre
 *     en el panel (así una página web maliciosa no puede hacer que la IA
 *     «aprenda» de otra página — inyección de prompts cortada de raíz);
 *   · cada fuente guarda sus estadísticas (lecturas, reglas aportadas)
 *     y se puede pausar, editar u OLVIDAR (borra sus reglas del almacén);
 *   · persistencia igual que el resto: serializar/deserializar con clave
 *     propia — el host la guarda en su store.
 *
 * Los módulos NUNCA tocan la red ni el storage: el host conecta esto a su
 * UI y a su cron (ver LEEME-INTEGRACION.md, paso 6).
 */

import { urlAptaparaAprendizaje, type DictamenUrl } from "./seguridad-web";
import type { ConocimientoGlobal } from "./conocimiento-global";
import type { FuenteForja } from "./fuentes";

export type TipoFuenteUsuario =
  | "web" // cualquier página: guía, artículo, portafolio
  | "repo" // repo de GitHub → se lee su README (raw)
  | "raw"; // texto/markdown directo (README suelto, .md, .txt, gist)

export interface FuenteUsuario {
  id: string;
  nombre: string;
  /** URL ya normalizada y validada (la que lee el ciclo) */
  url: string;
  tipo: TipoFuenteUsuario;
  /** pausada = sigue en la lista pero no entra en los ciclos */
  activa: boolean;
  /** 3 = me la fío mucho, 2 = normal (defecto), 1 = solo de referencia */
  calidad: 1 | 2 | 3;
  /** guía opcional del usuario: qué quiere aprender de esta fuente */
  nota?: string;
  /** CONTRAEJEMPLO (v3.0): fuente marcada como «página mala». El ciclo no
   * destila de ella lo que HACE sino lo que hay que EVITAR: cada regla sale
   * con capa "fallo" (la capa de oro: no repetir). Es la mitad que faltaba
   * del aprendizaje: saber reconocer lo genérico. */
  contraejemplo?: boolean;
  alta: string;
  lecturas: number;
  reglasAportadas: number;
}

/** Tope de fuentes del usuario: un catálogo curado es mejor entrenador
 * que un vertedero de enlaces. */
export const MAX_FUENTES_USUARIO = 30;

export const CLAVE_FUENTES_USUARIO = "forja.fuentes-usuario";

export const FUENTES_USUARIO_DEFECTO: FuenteUsuario[] = [];

/* ---------------------- normalización de la entrada --------------------- */

/** Parámetros de rastreo que se quitan al normalizar (privacidad: la URL
 * guardada no lleva tus clicks a nadie). */
const PARAMETROS_RASTREO = /^(utm_|fbclid$|gclid$|dclid$|mc_[a-z]+$|ref$|ref_src$|igshid$)/i;

export interface PropuestaFuente {
  url: string;
  tipo: TipoFuenteUsuario;
  nombre: string;
}

/** Normaliza la URL pegada por el usuario:
 *   · añade https:// si falta;
 *   · quita utm_*, fbclid y similares, y el fragmento (#…);
 *   · github.com/usuario/repo            → README raw del repo (tipo «repo»)
 *   · github.com/usuario/repo/blob/...   → URL raw equivalente (tipo «raw»)
 *   · .md/.txt directos                  → tipo «raw»
 * Devuelve null si ni siquiera parece una URL limpia. */
export function normalizarUrlFuente(entrada: string): PropuestaFuente | null {
  const limpia = entrada.trim();
  if (!limpia || /\s/.test(limpia)) return null;
  const conEsquema = /^https?:\/\//i.test(limpia) ? limpia : `https://${limpia}`;
  let u: URL;
  try {
    u = new URL(conEsquema);
  } catch {
    return null;
  }
  if (!u.hostname.includes(".")) return null; // «miweb» a secas, sin dominio

  const sobran: string[] = [];
  u.searchParams.forEach((_v, k) => {
    if (PARAMETROS_RASTREO.test(k)) sobran.push(k);
  });
  for (const k of sobran) u.searchParams.delete(k);
  u.hash = "";

  const h = u.hostname.toLowerCase().replace(/^www\./, "");

  // GitHub: repo (con o sin /tree/rama) → README del default branch.
  // raw.githubusercontent.com acepta «HEAD» como ref estable.
  const mRepo = u.pathname.match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/(?:tree|blob)\/[^/]+)?\/?$/);
  if (h === "github.com" && mRepo) {
    const [, owner, repo] = mRepo;
    return {
      url: `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`,
      tipo: "repo",
      nombre: `GitHub · ${owner}/${repo}`,
    };
  }
  // GitHub: archivo suelto (blob o raw) → raw directo
  const mBlob = u.pathname.match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/(?:blob|raw)\/(.+)$/);
  if (h === "github.com" && mBlob) {
    const [, owner, repo, resto] = mBlob;
    const archivo = resto.split("/").pop() ?? "archivo";
    return {
      url: `https://raw.githubusercontent.com/${owner}/${repo}/${resto}`,
      tipo: "raw",
      nombre: `GitHub · ${owner}/${repo}/${archivo}`.slice(0, 70),
    };
  }

  const segmentos = u.pathname.split("/").filter(Boolean).filter((s) => s.length < 50);
  const ultimo = segmentos[segmentos.length - 1];
  const detalle = ultimo
    ? ultimo.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ")
    : "";
  return {
    url: u.toString(),
    tipo: /\.(md|txt|markdown)$/i.test(u.pathname) ? "raw" : "web",
    nombre: `${h}${detalle ? ` · ${detalle}` : ""}`.slice(0, 70),
  };
}

function crearId(): string {
  return `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/* -------------------------- validación completa -------------------------- */

export interface DictamenFuente extends DictamenUrl {
  /** la URL ya normalizada (solo fiable si ok) */
  propuesta?: PropuestaFuente;
}

/** Dictamen de una entrada del usuario: normaliza + valida contra toda la
 * capa 1 de seguridad (https público, sin acortadores, sin binarios…).
 * Úsalo en el panel para pintar el porqué del rechazo ANTES de guardar,
 * y repite la comprobación en tu ruta /api antes de leer (LEEME paso 6). */
export function dictamenFuente(entrada: string): DictamenFuente {
  const propuesta = normalizarUrlFuente(entrada);
  if (!propuesta) {
    return {
      ok: false,
      motivos: ["No parece un enlace válido (¿tiene espacios o falta el dominio?)."],
      avisos: [],
    };
  }
  const d = urlAptaparaAprendizaje(propuesta.url);
  return { ...d, propuesta };
}

/* ------------------------------- gestión -------------------------------- */

export interface OpcionesAlta {
  nombre?: string;
  nota?: string;
  calidad?: 1 | 2 | 3;
  /** defecto: true (se aprueba al darla de alta desde el panel) */
  activa?: boolean;
  /** true = fuente de páginas MALAS: destila qué evitar (capa fallo) */
  contraejemplo?: boolean;
}

export type ResultadoAlta =
  | { lista: FuenteUsuario[]; fuente: FuenteUsuario; error?: never }
  | { lista: FuenteUsuario[]; fuente?: never; error: string };

/** Añade una fuente validada a la lista. Inmutable: devuelve lista nueva. */
export function anadirFuente(
  lista: FuenteUsuario[],
  entrada: string,
  opciones: OpcionesAlta = {}
): ResultadoAlta {
  const d = dictamenFuente(entrada);
  if (!d.ok || !d.propuesta) {
    return { lista, error: d.motivos.join(" ") || "Enlace rechazado por seguridad." };
  }
  if (lista.some((f) => f.url === d.propuesta!.url)) {
    return { lista, error: "Esa fuente ya estaba en tu lista." };
  }
  if (lista.length >= MAX_FUENTES_USUARIO) {
    return {
      lista,
      error: `Tope de ${MAX_FUENTES_USUARIO} fuentes alcanzado: pausa o quita alguna para añadir otra.`,
    };
  }
  const fuente: FuenteUsuario = {
    id: crearId(),
    nombre: (opciones.nombre?.trim() || d.propuesta.nombre).slice(0, 80),
    url: d.propuesta.url,
    tipo: d.propuesta.tipo,
    activa: opciones.activa ?? true,
    calidad: opciones.calidad ?? 2,
    nota: opciones.nota?.trim() ? opciones.nota.trim().slice(0, 200) : undefined,
    contraejemplo: opciones.contraejemplo === true ? true : undefined,
    alta: new Date().toISOString(),
    lecturas: 0,
    reglasAportadas: 0,
  };
  return { lista: [...lista, fuente], fuente };
}

/** Quita la fuente de la lista. OJO: sus reglas aprendidas siguen en el
 * almacén — para borrarlas también llama a olvidarReglasDeFuente(). */
export function quitarFuente(lista: FuenteUsuario[], id: string): FuenteUsuario[] {
  return lista.filter((f) => f.id !== id);
}

/** Pausa/reactiva. Sin argumento, alterna. */
export function alternarFuente(lista: FuenteUsuario[], id: string, activa?: boolean): FuenteUsuario[] {
  return lista.map((f) => (f.id === id ? { ...f, activa: activa ?? !f.activa } : f));
}

/** Edita nombre, nota, calidad o el rol de contraejemplo (lo que la UI
 * permite tocar). */
export function editarFuente(
  lista: FuenteUsuario[],
  id: string,
  cambios: Partial<Pick<FuenteUsuario, "nombre" | "nota" | "calidad" | "contraejemplo">>
): FuenteUsuario[] {
  return lista.map((f) =>
    f.id === id
      ? {
          ...f,
          nombre: cambios.nombre?.trim() ? cambios.nombre.trim().slice(0, 80) : f.nombre,
          nota: cambios.nota !== undefined ? (cambios.nota.trim() ? cambios.nota.trim().slice(0, 200) : undefined) : f.nota,
          calidad: cambios.calidad ?? f.calidad,
          contraejemplo: cambios.contraejemplo !== undefined ? (cambios.contraejemplo || undefined) : f.contraejemplo,
        }
      : f
  );
}

/** Las que entran en los ciclos de aprendizaje. */
export function fuentesActivas(lista: FuenteUsuario[]): FuenteUsuario[] {
  return lista.filter((f) => f.activa);
}

/** El host lo llama tras un ciclo para actualizar estadísticas del panel:
 * pasa cuántas reglas aportó cada fuente (0 si leyó y no aportó nada). */
export function registrarLecturasFuentes(
  lista: FuenteUsuario[],
  reglasPorFuente: Record<string, number>
): FuenteUsuario[] {
  return lista.map((f) =>
    reglasPorFuente[f.id] !== undefined
      ? {
          ...f,
          lecturas: f.lecturas + 1,
          reglasAportadas: f.reglasAportadas + reglasPorFuente[f.id],
        }
      : f
  );
}

/* ---------------------------- olvido (derecho) --------------------------- */

/** Borra del almacén SOLO las reglas que salieron de una fuente. Es el
 * botón «olvidar» del panel: derecho de la fuente a desaparecer. */
export function olvidarReglasDeFuente(almacen: ConocimientoGlobal, idOrigen: string): ConocimientoGlobal {
  return { ...almacen, reglas: almacen.reglas.filter((r) => r.origen !== idOrigen) };
}

/** Borra TODO el conocimiento de la web (no toca la memoria del usuario). */
export function olvidarTodoElConocimiento(almacen: ConocimientoGlobal): ConocimientoGlobal {
  return { ...almacen, reglas: [], ultimaLectura: {} };
}

/* ------------------------ puente con el ciclo --------------------------- */

/** Qué buscar por defecto según el tipo de fuente que el usuario añadió. */
const EXTRACCION_DEFECTO: Record<TipoFuenteUsuario, string> = {
  web:
    "Reglas de diseño que esta página ejemplifique: jerarquía, color, tipografía, " +
    "espaciado, patrones de composición y accesibilidad. Si el texto no aporta " +
    "criterio de diseño web, devuelve CERO reglas.",
  repo:
    "Principios que aparecen en el README/código: cómo estructuran interfaces, " +
    "naming, patrones de UI y criterios de calidad. Reglas generales, nunca frases copiadas.",
  raw:
    "Principios del texto reescritos como reglas imperativas de diseño web, medibles " +
    "y generales. Si no aporta criterio de diseño, devuelve CERO reglas.",
};

/** Instrucción para fuentes CONTRAEJEMPLO: no destilar lo que la página
 * hace, sino reconocer y anotar los patrones que la hacen genérica. */
const EXTRACCION_CONTRAEJEMPLO =
  "ESTA FUENTE ES UN CONTRAEJEMPLO: es una página MALA o genérica que sirve " +
  "de ejemplo de lo que NO hacer. NO destiles sus aciertos. Identifica los " +
  "patrones que la delatan como plantilla (composición por defecto, jerarquía " +
  "plana, decoración sin idea, dashboards de cajitas, gradientes y blobs, " +
  "tipografía sin intención) y escríbelos como REGLAS DE EVITACIÓN " +
  "imperativas y generales: «Evita …». Toda regla debe ser aplicable a otra " +
  "web como aviso, no como copia de esta página.";

/** Convierte una fuente del panel al formato que el ciclo de aprendizaje
 * consume (FuenteForja). La nota del usuario se convierte en guía del extractor
 * y el rol de contraejemplo cambia POR COMPLETO qué se destila. */
export function comoFuenteCiclo(f: FuenteUsuario): FuenteForja {
  const base = f.nota
    ? `${EXTRACCION_DEFECTO[f.tipo]} Guía del usuario: ${f.nota}`
    : EXTRACCION_DEFECTO[f.tipo];
  return {
    id: f.id,
    nombre: f.nombre,
    url: f.url,
    tipo: "personalizada",
    calidad: f.calidad,
    extraer: f.contraejemplo ? `${base} ${EXTRACCION_CONTRAEJEMPLO}` : base,
    consultaAmpliacion: "",
  };
}

/* ------------------------------ persistencia ---------------------------- */

export function serializarFuentes(lista: FuenteUsuario[]): string {
  return JSON.stringify(lista);
}

/** Revalida TODO al cargar: una fuente corrupta o que hoy no pasaría el
 * dictamen de seguridad (p. ej. nuevo dominio bloqueado) no se carga. */
export function deserializarFuentes(s: string | null | undefined): FuenteUsuario[] {
  if (!s) return FUENTES_USUARIO_DEFECTO;
  try {
    const p = JSON.parse(s) as unknown;
    if (!Array.isArray(p)) return FUENTES_USUARIO_DEFECTO;
    const validas: FuenteUsuario[] = [];
    for (const crudo of p) {
      const f = crudo as Partial<FuenteUsuario>;
      if (
        typeof f?.id !== "string" ||
        typeof f?.url !== "string" ||
        typeof f?.nombre !== "string" ||
        (f.tipo !== "web" && f.tipo !== "repo" && f.tipo !== "raw") ||
        (f.calidad !== 1 && f.calidad !== 2 && f.calidad !== 3)
      ) {
        continue;
      }
      if (!urlAptaparaAprendizaje(f.url).ok) continue;
      validas.push({
        id: f.id,
        nombre: f.nombre,
        url: f.url,
        tipo: f.tipo,
        activa: f.activa !== false,
        calidad: f.calidad,
        nota: typeof f.nota === "string" ? f.nota : undefined,
        contraejemplo: f.contraejemplo === true ? true : undefined,
        alta: typeof f.alta === "string" ? f.alta : new Date().toISOString(),
        lecturas: typeof f.lecturas === "number" ? f.lecturas : 0,
        reglasAportadas: typeof f.reglasAportadas === "number" ? f.reglasAportadas : 0,
      });
      if (validas.length >= MAX_FUENTES_USUARIO) break;
    }
    return validas;
  } catch {
    return FUENTES_USUARIO_DEFECTO;
  }
}

/* ------------------------- texto del panel (UI) ------------------------- */

/** Texto de estado del Apartado, listo para pintar en la UI o devolver al
 * chat cuando alguien pregunta qué fuentes hay. */
export function textoPanelFuentes(lista: FuenteUsuario[], ultimoCicloIso?: string): string {
  if (lista.length === 0) {
    return (
      "Tu Apartado de Aprendizaje está vacío. Añade sitios, repos de GitHub o " +
      "documentos (.md/.txt) y FORJA IA destilará reglas de diseño de ellos en cada ciclo."
    );
  }
  const linea = (f: FuenteUsuario) =>
    `- ${f.activa ? "●" : "○"}${f.contraejemplo ? " ⚠" : ""} ${f.nombre} [${f.tipo}] — ${f.reglasAportadas} reglas · ${f.lecturas} lecturas` +
    (f.contraejemplo ? " — contraejemplo (aprende lo que EVITAR)" : "") +
    (f.nota ? ` — «${f.nota}»` : "");
  const activas = lista.filter((f) => f.activa).map(linea);
  const pausadas = lista.filter((f) => !f.activa).map(linea);
  const cuando = ultimoCicloIso
    ? `Último ciclo de aprendizaje: ${new Date(ultimoCicloIso).toLocaleString("es")}.`
    : "Todavía no ha habido ciclos de aprendizaje.";
  return [
    `Apartado de Aprendizaje — ${activas.length} activa(s) de ${lista.length} (tope ${MAX_FUENTES_USUARIO}).`,
    cuando,
    activas.length ? "\nActivas:" : "",
    ...activas,
    pausadas.length ? "\nPausadas (no entran en los ciclos):" : "",
    ...pausadas,
    "\nAprobar, pausar o borrar se hace desde el panel; el chat solo propone.",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------- órdenes desde el chat (acotadas) -------------------- */

/** Lo que el chat PUEDE hacer con fuentes. Deliberadamente mínimo:
 * proponer y listar. Añadir en firme, pausar o borrar solo en el panel —
 * así ni una página envenenada puede ordenarle a la IA que cambie sus
 * propias fuentes (inyección de prompts). */
export type OrdenFuentes =
  | { tipo: "proponer"; url: string }
  | { tipo: "listar" }
  | { tipo: "ninguna" };

const RX_SOLO_URL = /^https?:\/\/\S+$/i;
const RX_PROPONER =
  /(?:anade|añade|agrega|aprende de|aprender de|mira esta|mira este|lee esta|lee este|usa esta|usa este)\s+(?:esta|este|la|el|un|una|mi)?\s*(?:fuente|pagina|página|sitio|web|repo|repositorio|enlace|link|doc|documento|guia|guía)?\s*:?\s*(https?:\/\/[^\s]+)/i;
const RX_LISTAR =
  /(?:muestra|lista|listar|ensename|enséñame|cuales son|cuáles son|que fuentes|qué fuentes)\s+(?:las\s+)?fuentes|^\s*fuentes\s*$|(?:qué|cuales|cuáles)\s+fuentes\s+tienes|tienes\s+fuentes|mis\s+fuentes/i;

/** Detecta si un mensaje del usuario es una orden sobre fuentes. */
export function interpretarOrdenFuentes(mensaje: string): OrdenFuentes {
  const texto = mensaje.trim();
  if (!texto) return { tipo: "ninguna" };
  if (RX_SOLO_URL.test(texto)) return { tipo: "proponer", url: texto };
  const m = texto.match(RX_PROPONER);
  if (m?.[1]) return { tipo: "proponer", url: m[1] };
  if (RX_LISTAR.test(texto)) return { tipo: "listar" };
  return { tipo: "ninguna" };
}

/** Respuesta del chat para una orden de fuentes. Para «proponer», la UI
 * debe mostrar TAMBIÉN el botón que abre el panel con la URL pre-cargada:
 * la fuente solo se guarda cuando el humano la aprueba ahí. */
export function responderOrdenFuentes(
  orden: OrdenFuentes,
  lista: FuenteUsuario[],
  ultimoCicloIso?: string
): string | null {
  if (orden.tipo === "ninguna") return null;
  if (orden.tipo === "listar") return textoPanelFuentes(lista, ultimoCicloIso);
  const d = dictamenFuente(orden.url);
  if (!d.ok || !d.propuesta) {
    return `No puedo proponer esa fuente: ${d.motivos.join(" ")}`;
  }
  return [
    "Propongo añadir esta fuente al Apartado de Aprendizaje:",
    `- ${d.propuesta.nombre} (${d.propuesta.tipo}) — ${d.propuesta.url}`,
    d.avisos.length ? `Avisos: ${d.avisos.join(" ")}` : "",
    "Apruébala en el panel de Aprendizaje y la leeré en el próximo ciclo. Por seguridad, una fuente solo se acepta con tu aprobación ahí — nunca porque llegue por el chat.",
  ]
    .filter(Boolean)
    .join("\n");
}
