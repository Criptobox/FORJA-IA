/** FORJA IA — La Arena de FORJA IA: dos equipos compiten, un juez decide.
 *
 * La idea del usuario: «dos equipos FORJA compiten y un juez elige la mejor
 * web». Así funciona:
 *
 *   1. DOS EQUIPOS resuelven la MISMA petición en paralelo, cada uno con su
 *      ConfigForja (modelos por rol, habilidades, memoria): el Equipo A con tu
 *      config de siempre y el Equipo B con la que le pases.
 *   2. MODO «maquetas» (defecto, económico): solo compite la fase de diseño
 *      — dos fichas, dos maquetas — y SOLO el ganador pasa a producción.
 *      Coste ≈ 1× producción + 1× fase de diseño + 1 llamada del juez.
 *      MODO «completa»: ambos equipos entregan código final y el juez
 *      compara entregas. Coste ≈ 2× una petición normal + el juez.
 *   3. EL JUEZ puntúa 5 criterios (jerarquía, color, tipografía,
 *      accesibilidad, originalidad) de 0 a 10 y explica su veredicto.
 *   4. EL USUARIO MANDA: la UI muestra las DOS propuestas; si prefieres la
 *      perdedora, continúas con ella igualmente (el estado del ganador es
 *      solo la recomendación del juez, nunca una decisión forzada).
 *
 * El veredicto llega por etiquetas <puntuacion …> (tolerante, sin JSON,
 * igual que el resto del módulo: pensado para modelos gratuitos).
 */

import type {
  ConfigForja,
  LlamadaModelo,
  ModeloDeRol,
  PeticionForja,
  PropuestaMaqueta,
  ResultadoForja,
} from "./tipos";
import { debeMaquetar } from "./tipos";
import { ejecutarForja, type DependenciasForja, type EventoForja } from "./nucleo";
import type { LeccionArena } from "./conocimiento-global";

export type { LeccionArena };

/* ------------------------------ contrato -------------------------------- */

export type ModoArena = "maquetas" | "completa";

/** Criterios fijos del juez. Cinco, como los dedos de una mano: se pueden
 * memorizar en el informe y evitan que el juez improvise escalas. */
export const CRITERIOS_ARENA = [
  "jerarquia",
  "color",
  "tipografia",
  "accesibilidad",
  "originalidad",
] as const;

export type CriterioArena = (typeof CRITERIOS_ARENA)[number];

/** Puntuación de un equipo: 5 criterios × 0..10 + el total (0..50). */
export interface PuntuacionArena {
  jerarquia: number;
  color: number;
  tipografia: number;
  accesibilidad: number;
  originalidad: number;
  total: number;
}

export interface VeredictoArena {
  ganador: "A" | "B" | "empate";
  A: PuntuacionArena;
  B: PuntuacionArena;
  /** el porqué del juez, para humanos (3-5 frases) */
  razones: string;
}

/** Tipos de lección del juez (v2.4 «El Genoma Visual»):
 *  · destacar — qué hizo MUY BIEN el ganador (→ experimento con puntuación)
 *  · conservar — qué hizo BIEN el perdedor y merece conservarse (→ patrón)
 *  · evitar — qué patrón produjo un diseño inferior (→ fallo: oro puro)
 * El juez ya no solo puntúa: GENERA CONOCIMIENTO para la siguiente
 * generación. Ahí empieza la evolución de diseño. */
export type TipoLeccionArena = LeccionArena["tipo"];

export interface ConfigArena {
  /** configuración del Equipo B (el A usa tu ConfigForja de siempre) */
  equipoB: ConfigForja;
  /** dependencias del Equipo B (llamadora y memoria propias; puedes darle
   * la MISMA memoria si quieres que los dos aprendan de sus éxitos) */
  depsB: DependenciasForja;
  /** modelo juez. Si falta, usa el `fallback` (el modelo activo del chat). */
  juez?: ModeloDeRol;
  /** «maquetas» (defecto, recomendado) o «completa». Si la petición no
   * lleva maqueta (edición o perfil ligero), «maquetas» se ignora y se
   * compite en «completa». */
  modo?: ModoArena;
  /** lo que MÁS te importa, en tus palabras: «que sea rápido en móvil»,
   * «sin azul genérico»… El juez lo pondera dentro del criterio que toque. */
  criteriosDelUsuario?: string;
}

export interface ResultadoArena {
  equipoA: ResultadoForja;
  equipoB: ResultadoForja;
  veredicto: VeredictoArena;
  /** el resultado del ganador, tal cual (con su maqueta o su código) para
   * la UI. En empate sigue el Equipo A (y el usuario puede elegir otro). */
  ganadorResultado: ResultadoForja;
  /** config del ganador: la que hay que pasar a continuarForja/ajustarMaquetaForja
   * para continuar con ese equipo */
  ganadorConfig: ConfigForja;
  modo: ModoArena;
  /** lo que la Arena aprendió para la siguiente generación (v2.4). El host
   * lo persiste con registrarLeccionesArena() (conocimiento-global.ts). */
  lecciones: LeccionArena[];
  /** texto final con el duelo completo, listo para el chat */
  respuesta: string;
}

/* ------------------------------ el juez --------------------------------- */

const MAX_HTML_JUZGADO = 7000;
const MAX_CODIGO_JUZGADO = 9000;

export function promptJuez(criteriosDelUsuario?: string): string {
  return `## Quién eres
Eres el JUEZ de la Arena de FORJA IA: un director de arte senior imparcial.
La misma petición se la han resuelto DOS equipos (A y B); tú la puntúas con
criterio, sin favoritismos y sin saber nada más de ellos.

## Criterios (0 a 10 cada uno; 5 = mediocre, 9-10 = excepcional, sé exigente)
- jerarquia: en 10 segundos se entiende qué mirar primero, segundo y tercero.
- color: paleta coherente, contraste real, el acento solo en lo importante.
- tipografia: pareja tipográfica con intención y escala con ritmo claro.
- accesibilidad: foco visible, contrastes AA, labels/aria correctos, orden de lectura.
- originalidad: personalidad propia SIN sacrificar usabilidad ni claridad.${
    criteriosDelUsuario?.trim()
      ? `\n\n## Peso extra del dueño del proyecto\n«${criteriosDelUsuario.trim().slice(0, 200)}» — si afecta a un criterio, se lo suma o resta ahí, y si es un criterio nuevo, refléjalo en el más cercano.`
      : ""
  }

## Cómo juzgas
- Juzgas lo que ves (ficha de diseño y maqueta/código entregado), no promesas.
- Empata criterios solo si de verdad son equivalentes; no repartas 7s por comodidad.
- Penaliza con firmeza: placeholders sin estilo, jerarquía plana, color por defecto del navegador, textos falsos sin contenido real.

## Salida OBLIGATORIA (etiquetas exactas, sin JSON y sin markdown dentro)
<puntuacion equipo="A" criterio="jerarquia">7</puntuacion>
<puntuacion equipo="A" criterio="color">6</puntuacion>
<puntuacion equipo="A" criterio="tipografia">7</puntuacion>
<puntuacion equipo="A" criterio="accesibilidad">8</puntuacion>
<puntuacion equipo="A" criterio="originalidad">5</puntuacion>
<puntuacion equipo="B" criterio="jerarquia">8</puntuacion>
… (las 10 líneas: 5 criterios × 2 equipos)
<ganador>A</ganador>
<razones>3 a 5 frases: por qué gana el que gana, qué le faltó al otro y qué copiaría del perdedor.</razones>

## Después, las LECCIONES para la siguiente generación
Del veredicto sacas 2 a 4 lecciones REUTILIZABLES (a nivel de patrón, no de
píxel) con estas etiquetas exactas:
<lecciones>
<leccion tipo="destacar" equipo="B">qué hizo muy bien el ganador y se repetirá</leccion>
<leccion tipo="conservar" equipo="A">qué hizo bien el perdedor y merece conservarse</leccion>
<leccion tipo="evitar" equipo="A">qué patrón del perdedor produjo el resultado inferior</leccion>
</lecciones>
Reglas de las lecciones: una línea cada una (máx. 200 caracteres), concreta
(«la jerarquía del hero guiaba la mirada en 3 pasos») y generalizable
(«evitar el carrusel automático del hero», no «evitar el azul del equipo A»).`;
}

/** Cuerpo que recibe el juez: el brief y las dos propuestas en paralelo. */
function mensajeJuez(
  peticion: PeticionForja,
  modo: ModoArena,
  ma: { ficha: string; maqueta?: PropuestaMaqueta | null; codigo?: string },
  mb: { ficha: string; maqueta?: PropuestaMaqueta | null; codigo?: string }
): string {
  const bloque = (nombre: "A" | "B", m: typeof ma): string => {
    const artefacto =
      modo === "maquetas"
        ? `# Maqueta HTML (recortada)\n${(m.maqueta?.html || "(sin maqueta HTML)").slice(0, MAX_HTML_JUZGADO)}`
        : `# Código entregado (recortado)\n${(m.codigo || "(sin código)").slice(0, MAX_CODIGO_JUZGADO)}`;
    return [
      `## EQUIPO ${nombre}`,
      `# Ficha de diseño`,
      m.ficha,
      artefacto,
      "",
    ].join("\n");
  };
  return [
    `# Petición original del usuario\n${peticion.mensaje}`,
    peticion.codigoActual ? `(Proyecto existente: es una edición sobre código actual.)` : "",
    bloque("A", ma),
    bloque("B", mb),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Parser tolerante del veredicto del juez: acepta atributos en cualquier
 * orden, alias de criterio, decimales y faltantes (los faltantes = 5). */
export function parseVeredictoArena(texto: string): VeredictoArena {
  const valor = (crudo: string): number => {
    const n = Math.round(Number(crudo));
    return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 5;
  };
  const notas: Record<string, Partial<Record<CriterioArena, number>>> = { A: {}, B: {} };
  const re =
    /<puntuacion\s+(?:equipo="(A|B)"\s+criterio="([a-záéíóú]+)"|criterio="([a-záéíóú]+)"\s+equipo="(A|B)")\s*>\s*([\d.]+)\s*<\/puntuacion>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    const equipo = (m[1] ?? m[4])?.toUpperCase();
    const criterio = normalizarCriterio(m[2] ?? m[3] ?? "");
    if (equipo !== "A" && equipo !== "B") continue;
    if (!criterio) continue;
    notas[equipo][criterio] = valor(m[5]);
  }
  const puntuacion = (equipo: "A" | "B"): PuntuacionArena => {
    const n = notas[equipo];
    const p = {
      jerarquia: n.jerarquia ?? 5,
      color: n.color ?? 5,
      tipografia: n.tipografia ?? 5,
      accesibilidad: n.accesibilidad ?? 5,
      originalidad: n.originalidad ?? 5,
      total: 0,
    };
    p.total = CRITERIOS_ARENA.reduce((s, c) => s + p[c], 0);
    return p;
  };

  const A = puntuacion("A");
  const B = puntuacion("B");
  const razones = (texto.match(/<razones>([\s\S]*?)<\/razones>/i)?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);

  let ganador: VeredictoArena["ganador"];
  if (A.total > B.total) ganador = "A";
  else if (B.total > A.total) ganador = "B";
  else {
    const etiqueta = texto.match(/<ganador>\s*(A|B|empate)\s*<\/ganador>/i)?.[1]?.toLowerCase();
    ganador = etiqueta === "a" ? "A" : etiqueta === "b" ? "B" : "empate";
  }
  return { ganador, A, B, razones };
}

/** Parser tolerante de las lecciones del juez: atributos en cualquier orden,
 * tildes opcionales, recorte a 220 y tope de 6 lecciones. */
export function parseLeccionesArena(texto: string): LeccionArena[] {
  if (!texto) return [];
  const bloque = texto.match(/<lecciones>([\s\S]*?)<\/lecciones>/i);
  const fuente = bloque ? bloque[1] : texto;
  const out: LeccionArena[] = [];
  const re = /<leccion\s+([\s\S]*?)>([\s\S]*?)<\/leccion>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fuente)) !== null && out.length < 6) {
    const attrs = m[1];
    const tipoCrudo = attrs.match(/tipo\s*=\s*"?([a-z_áéíóú]+)"?/i)?.[1] ?? "";
    const tipo = tipoCrudo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") as LeccionArena["tipo"];
    if (tipo !== "destacar" && tipo !== "conservar" && tipo !== "evitar") continue;
    const equipoCrudo = attrs.match(/equipo\s*=\s*"?(A|B)"?/i)?.[1]?.toUpperCase();
    const cuerpo = m[2].replace(/\s+/g, " ").trim().slice(0, 220);
    if (cuerpo.length < 15) continue;
    out.push({ tipo, texto: cuerpo, equipo: equipoCrudo as "A" | "B" | undefined });
  }
  return out;
}

function normalizarCriterio(s: string): CriterioArena | undefined {
  const t = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (CRITERIOS_ARENA as readonly string[]).find((c) => c === t) as CriterioArena | undefined;
}

/* ---------------------------- la competición ----------------------------- */

/** Ejecuta la Arena completa. Es la función que el chat-client llama cuando
 * el usuario activa el duelo (o siempre, si le sobra cuota y le gusta el
 * espectáculo).
 *
 * Recomendación de uso (LEEME §7): muestra `respuesta` en el chat, la
 * maqueta/código del ganador en la vista previa, y guarda AMBOS resultados
 * para que el usuario pueda continuar con el perdedor si prefiere su idea. */
export async function arenaForja(
  peticion: PeticionForja,
  cfgA: ConfigForja,
  depsA: DependenciasForja,
  arena: ConfigArena,
  fallback: ModeloDeRol
): Promise<ResultadoArena> {
  const modo: ModoArena =
    arena.modo ?? (debeMaquetar(peticion, cfgA) ? "maquetas" : "completa");
  const peticionArena: PeticionForja =
    modo === "maquetas" ? { ...peticion, modo: "maqueta" } : { ...peticion, modo: "directo" };

  const envolver = (equipo: "A" | "B", deps: DependenciasForja): DependenciasForja => ({
    ...deps,
    onProgreso: deps.onProgreso
      ? (ev: EventoForja) => deps.onProgreso?.({ tipo: "arena", equipo, evento: ev })
      : undefined,
  });

  const [resA, resB] = await Promise.all([
    ejecutarForja(peticionArena, cfgA, envolver("A", depsA), fallback),
    ejecutarForja(peticionArena, arena.equipoB, envolver("B", arena.depsB), fallback),
  ]);

  const ma = {
    ficha: resA.fichaTexto,
    maqueta: resA.maqueta,
    codigo: resA.codigo,
  };
  const mb = {
    ficha: resB.fichaTexto,
    maqueta: resB.maqueta,
    codigo: resB.codigo,
  };

  const juez = arena.juez ?? fallback;
  const { veredicto, lecciones } = await puntuar(
    peticion,
    modo,
    ma,
    mb,
    juez,
    depsA.llamarModelo,
    arena.criteriosDelUsuario
  );

  const ganadorResultado = veredicto.ganador === "B" ? resB : resA;
  const ganadorConfig = veredicto.ganador === "B" ? arena.equipoB : cfgA;

  return {
    equipoA: resA,
    equipoB: resB,
    veredicto,
    ganadorResultado,
    ganadorConfig,
    modo,
    lecciones,
    respuesta: construirRespuestaArena(modo, veredicto, resA, resB, lecciones),
  };
}

async function puntuar(
  peticion: PeticionForja,
  modo: ModoArena,
  ma: { ficha: string; maqueta?: PropuestaMaqueta | null; codigo?: string },
  mb: { ficha: string; maqueta?: PropuestaMaqueta | null; codigo?: string },
  juez: ModeloDeRol,
  llamar: LlamadaModelo,
  criteriosDelUsuario?: string
): Promise<{ veredicto: VeredictoArena; lecciones: LeccionArena[] }> {
  try {
    const texto = await llamar({
      providerId: juez.providerId,
      modelId: juez.modelId,
      system: promptJuez(criteriosDelUsuario),
      user: mensajeJuez(peticion, modo, ma, mb),
      temperatura: 0.2,
    });
    const v = parseVeredictoArena(texto);
    // guarda: si el juez devolvió papeles en blanco (todo 5/5 sin razones),
    // es mejor un empate honesto que una confianza falsa (y sin lecciones:
    // no se enseña de un veredicto que no existe)
    if (!v.razones && v.A.total === 25 && v.B.total === 25) {
      return {
        veredicto: {
          ...v,
          ganador: "empate",
          razones: "El juez no devolvió un veredicto legible: empate por defecto. Puedes continuar con cualquiera de los dos equipos.",
        },
        lecciones: [],
      };
    }
    return { veredicto: v, lecciones: parseLeccionesArena(texto) };
  } catch {
    return {
      veredicto: {
        ganador: "empate",
        A: puntuacionNeutra(),
        B: puntuacionNeutra(),
        razones: "El juez no pudo puntuar (cuota o respuesta vacía): empate. Elige tú la propuesta que más te guste — ambas están completas.",
      },
      lecciones: [],
    };
  }
}

function puntuacionNeutra(): PuntuacionArena {
  return { jerarquia: 5, color: 5, tipografia: 5, accesibilidad: 5, originalidad: 5, total: 25 };
}

/* ------------------------------ respuesta -------------------------------- */

function construirRespuestaArena(
  modo: ModoArena,
  veredicto: VeredictoArena,
  resA: ResultadoForja,
  resB: ResultadoForja,
  lecciones: LeccionArena[] = []
): string {
  const nombre = (r: ResultadoForja): string => {
    const primera = r.maqueta?.direcciones?.[0]?.nombre;
    return primera ? `«${primera}»` : r.ficha?.tipoWeb || "propuesta";
  };
  const fila = (c: CriterioArena): string =>
    `| ${c.charAt(0).toUpperCase() + c.slice(1)} | ${veredicto.A[c]} | ${veredicto.B[c]} |`;

  const titular =
    veredicto.ganador === "empate"
      ? "⚖️ **Empate** — el juez no vio diferencias decisivas."
      : `🏆 **Gana el Equipo ${veredicto.ganador}** con ${nombre(veredicto.ganador === "A" ? resA : resB)}.`;

  const modoTexto =
    modo === "maquetas"
      ? "Duelo de DISEÑO: dos equipos propusieron, maquetaron y solo el ganador pasa a producción."
      : "Duelo COMPLETO: los dos equipos entregaron código final y el juez comparó las entregas.";

  const veredictoTexto = veredicto.razones || "Sin razones del juez (respuesta vacía).";

  const aprendido = lecciones.length
    ? `\n\n### Lo que FORJA IA aprendió en este duelo\n${lecciones
        .map((l) => {
          const icono = l.tipo === "destacar" ? "✦" : l.tipo === "conservar" ? "⊕" : "✕";
          const tipo =
            l.tipo === "destacar"
              ? "Destacar"
              : l.tipo === "conservar"
                ? "Conservar"
                : "Evitar";
          const de = l.equipo ? ` (Equipo ${l.equipo})` : "";
          return `- ${icono} **${tipo}**${de}: ${l.texto}`;
        })
        .join("\n")}\nEstas lecciones entran al conocimiento como experimentos, patrones y fallos: la siguiente generación de diseños parte de aquí.`
    : "";

  return `## La Arena de FORJA IA

${modoTexto}

| Criterio | Equipo A | Equipo B |
|---|---|---|
${CRITERIOS_ARENA.map(fila).join("\n")}
| **Total** | **${veredicto.A.total}/50** | **${veredicto.B.total}/50** |

${titular}

**Por qué:** ${veredictoTexto}${aprendido}

Las dos propuestas están guardadas: puedes seguir con el ganador o decirme «sigo con el equipo ${veredicto.ganador === "A" ? "B" : "A"}» y trabajo con esa. Y si el ganador tiene maqueta, apruébala o ajústala como siempre.`;
}
