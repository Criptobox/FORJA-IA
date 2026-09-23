/** FORJA IA — Fase de maqueta de FORJA IA: ideas primero, código después.
 *
 * La queja clásica de los generadores de webs: tiran código de algo que
 * nunca pediste ver. FORJA IA v2 trabaja como un estudio de diseño:
 *
 *   1. El Diseñador entrega 3 DIRECCIONES (ideas con nombre y concepto)
 *      junto a la ficha de la dirección recomendada.
 *   2. El Codificador construye una MAQUETA: una página HTML autocontenida
 *      que se ve como la web final (layout, paleta, tipografía reales) pero
 *      sin lógica de negocio, con textos provisionales marcados.
 *   3. El usuario la ve en la vista previa en vivo y decide:
 *        · «Aprobado»            → el núcleo continúa al código real
 *        · «Ajusta: …»           → se re-maqueta con el feedback (máx 2)
 *        · «Usa la dirección 2»  → se re-maqueta con esa idea
 *        · «Directo»             → se salta la propuesta y tira código
 *
 * Por qué una maqueta y no la web entera: es UNA llamada, se genera en
 * segundos, es barata de corregir y obliga a validar el diseño ANTES de
 * invertir rondas de código. Es el mismo flujo de un estudio profesional:
 * concepto → propuesta visual → producción.
 *
 * El módulo no decide cuándo maquetar (eso es debeMaquetar() en tipos.ts,
 * según perfil y modo de la petición): aquí solo vive el «cómo».
 */

import type {
  ConfigForja,
  LlamadaModelo,
  PeticionForja,
  PropuestaMaqueta,
  RolForja,
} from "./tipos";
import { MAX_AJUSTES_MAQUETA, parseDirecciones } from "./tipos";
import { extraerCodigo } from "./nucleo-extractos";
import { EQUIPO_FORJA } from "./equipo";
import { adnDesdePeticion, parseAdn, sanearAdn, seccionAdn } from "./adn-visual";
import { detectarGenericidad, resumenAntiGenerico, seccionAntiGenerico } from "./antigenerico";
import type { ModeloDeRol } from "./tipos";
import { claveMaqueta } from "./cache-fichas";
import type { CacheGeneracion } from "./cache-fichas";
import { seleccionarExperiencia, seccionContratoExperiencia, cssDeterminista, scriptDeterminista } from "./motor-creativo";
import { htmlPrimitiva } from "./primitivas";
import { htmlObjeto3d } from "./objeto-3d";
import { textoAdn } from "./adn-visual";

/** Prompt de sistema para el rol que maqueta (el Codificador, porque la
 * maqueta ES código: HTML+CSS real, solo que de una página y sin lógica).
 *
 * v4.5 — CORRECCIÓN §15: el prompt ya no se concentra solo en layout/
 * paleta/tipografía/secciones/jerarquía/hover/responsive/a11y. El mensaje
 * lleva OBLIGATORIAMENTE el contrato de experiencia: EXPERIENCE DNA ·
 * EXPERIENCE RECIPE · SPATIAL PLAN · MOTION PLAN · HERO TYPE · SURFACE
 * SYSTEM · INTERACTION SYSTEM · RESPONSIVE EXPERIENCE. El maquetador
 * EJECUTA la dirección creativa; no la inventa. */
export const PROMPT_MAQUETA = `## Quién eres
Eres el maquetador de FORJA IA. Recibes una FICHA DE DISEÑO y el CONTRATO
DE EXPERIENCIA y construyes una MAQUETA NAVEGABLE: una única página HTML
que se ve como la web final para que el usuario decida si le gusta ANTES de
producir el código real.

## Qué es una maqueta (y qué no)
- SÍ: layout completo, paleta exacta, tipografía exacta, todas las secciones
  de la ficha en su orden, jerarquía visual real, hover/focus básicos.
- NO: formularios que envían, carritos, llamadas a APIs, JavaScript de
  negocio, textos definitivos.
- Los textos que inventes deben ser REALISTAS y concretos (nada de
  «Lorem ipsum» ni «Su texto aquí»): venden el diseño.
- Marca lo provisional con un comentario HTML <!-- provisional --> al inicio
  del bloque (nunca visible en pantalla).

## El contrato de experiencia MANDA (v4.5/v4.6)
- EXPERIENCE RECIPE: ejecuta la receta (hero, composición, superficies,
  movimiento, interacción, objeto) tal como está definida.
- SPATIAL PLAN: la página es una escena por capas con z-index semántico;
  usa perspective y translateZ cuando el plan lo diga.
- OBJETO 3D FORJADO (v4.6): si el contrato trae «OBJETO 3D FORJADO», el
  mensaje lleva su HTML (<div class="f3d">…) y su CSS listos: cópialos
  LITERALMENTE en el hero. PROHIBIDO re-inventar el objeto, convertirlo
  en imagen o simplificarlo a un div con border-radius.
- PRIMITIVAS COMPILADAS (v4.6): si el contrato trae la biblioteca, el
  mensaje lleva la CSS «Primitivas compiladas FORJA» y el HTML de ejemplo
  de cada una: usa esas piezas con ese clases y esa mecánica; cambia SOLO
  los textos. PROHIBIDO re-escribir la mecánica (perderías la a11y y el
  reduced-motion que ya nacieron auditados).
- MOTION PLAN: respeta los tiempos POR CATEGORÍA (micro 150-300ms,
  componente 250-600ms, reveal 500-1000ms, escena 800-1600ms) y SIEMPRE
  @media (prefers-reduced-motion: reduce).
- HERO TYPE: el tipo de hero está decidido. PROHIBIDO el hero por defecto
  (centrado + h1 gigante + párrafo + botón) si el tipo es otro.
- SURFACE SYSTEM: usa los DESIGN TOKENS que recibes (--radius-*, --depth-*,
  --motion-*, --shadow-*, --surface-*) y pega el bloque :root tal cual.
- INTERACTION SYSTEM: magnetic/tilt/expandable solo donde el ADN los pide.
- RESPONSIVE EXPERIENCE: aplica el plan (qué se mantiene/reduce/reordena/
  elimina/transforma por breakpoint), no solo width: 100%.
- No abuses de glassmorphism: el vidrio es acento, no sistema.

## Reglas inquebrantables
1. UN solo archivo HTML autocontenido: <style> dentro, cero dependencias
   salvo Google Fonts si la ficha lo pide.
2. Cumple la ficha AL DETALLE: si dice azul #1D4ED8, es #1D4ED8.
3. Mobile first y responsive (media queries a 768px y 1024px).
4. Añade una banda fija discreta arriba a la derecha:
   <div id="d1-maqueta" style="position:fixed;top:10px;right:10px;z-index:9999;
   background:#0F172A;color:#F8FAFC;font:600 11px/1 system-ui;padding:6px 10px;
   border-radius:999px;opacity:.85;pointer-events:none">MAQUETA · FORJA IA</div>
5. Accesibilidad mínima: contraste 4.5:1 en texto, alt en imágenes, un solo
   h1, <html lang="es">, meta viewport y <title>: el Inspector los comprueba.
6. El HTML debe verse bien al abrirlo directamente en un iframe o pestaña.
7. EXTENSIÓN: la manda el PLANO DE CONTENIDO del mensaje, no tu criterio.
   Ahorra en CSS (clases reutilizadas, sin utilidades repetidas), NUNCA en
   contenido. Una sección de menos, una colección por debajo de su mínimo o
   un texto de relleno son DEFECTOS que el QA de detalle mide y devuelve.
   Si algo no cabe, quita decoración; jamás secciones, piezas ni responsive.
8. El mensaje incluye el bloque «Anti-genérico», el ADN con sus
   PROHIBICIONES y el CONTRATO DE EXPERIENCIA: son reglas duras. Un diseño
   que parezca plantilla de IA o que ignore la familia de experiencia se
   rechaza igual que uno roto.
9. PLANO DE CONTENIDO (v4.7): trae las secciones obligatorias en orden, el
   mínimo de piezas REALES de cada colección y los HECHOS declarados por el
   usuario (precios, horarios, teléfono, ciudad, cantidades). Los hechos son
   DATOS: se copian tal cual. Contradecirlos o inventar un precio distinto
   es un defecto grave. Lo que el brief no diga, invéntalo realista y
   específico — nombres, cifras, plazos —, nunca «Lorem ipsum».
10. ACABADO: estados :hover, :focus-visible y :active visibles (no solo
   opacidad); imágenes con aspect-ratio y object-fit; iconos como SVG inline
   con currentColor (nunca emojis); cifras con font-variant-numeric:
   tabular-nums; cada sección con su atributo id enlazado desde la navegación.

## Formato de salida OBLIGATORIO
\`\`\`html maqueta.html
[el archivo completo]
\`\`\`
Nada más: ni explicaciones, ni comentarios fuera del archivo.`;

/** Mensaje de usuario para construir la maqueta. Incluye el ADN visual como
 * sección mandatoria (v2.4) y —v4.5, corrección §15— el CONTRATO DE
 * EXPERIENCIA completo (familia, receta, planes espacial/movimiento, hero,
 * superficies, interacción, responsive y tokens), todo DETERMINISTA:
 * determinarlo aquí cuesta 0 tokens y el maquetador deja de improvisar. */
export function mensajeMaqueta(p: PeticionForja, fichaTexto: string, feedback: string | null): string {
  const adn = sanearAdn(parseAdn(fichaTexto) ?? adnDesdePeticion(p.mensaje));
  // v4.6 — la selección se calcula UNA vez y alimenta TODO: contrato,
  // CSS determinista, objeto 3D, HTML de primitivas y script capado.
  //
  // v4.7 — CORREGIDO (dos bugs de una vez):
  //  (a) hasta v4.6 la dirección creativa se decidía SOLO con `p.mensaje`:
  //      la ficha del Diseñador y el ADN visual —personalidad, sensación,
  //      lenguaje, prohibiciones— no entraban como señal, así que el ADN
  //      del Diseñador y el ADN de experiencia podían contradecirse y el
  //      maquetador acababa con dos jefes.
  //  (b) el feedback de «Ajusta: …» tampoco entraba, de modo que si el
  //      usuario pedía «quita el objeto 3D, menos movimiento» el contrato
  //      determinista seguía exigiéndolo — y ganaba él, porque es más
  //      largo, más explícito y viene con CSS. El ajuste se evaporaba.
  // Ahora las tres fuentes componen el CORPUS DE SEÑALES.
  const seleccion = seleccionarExperiencia(corpusDeSenales(p, fichaTexto, adn, feedback), {
    mensajeOriginal: p.mensaje,
  });
  const contrato = seccionContratoExperiencia(seleccion);
  const cssForjado = cssDeterminista(seleccion);
  const scriptForjado = scriptDeterminista(seleccion);
  const htmlObjeto = seleccion.objeto ? htmlObjeto3d(seleccion.objeto.id) : "";
  const htmlPrimitivas = seleccion.primitivas.primitivas
    .map((id) => htmlPrimitiva(id, [], ""))
    .filter(Boolean)
    .join("\n");
  const ajuste = feedback
    ? `\n\n## Ajuste pedido por el usuario\nRehaz la maqueta aplicando EXACTAMENTE esto, sin perder lo que ya estaba bien:\n«${feedback.slice(0, 600)}»`
    : "";
  return `# Ficha de diseño aprobada como base de la maqueta\n${fichaTexto}\n\n${seccionAdn(adn)}\n\n${seccionAntiGenerico()}\n\n${contrato}${
    htmlObjeto
      ? `\n\n# OBJETO 3D FORJADO — HTML EXACTO a incluir en el hero (tal cual)\n${htmlObjeto}`
      : ""
  }${
    htmlPrimitivas
      ? `\n\n# PRIMITIVAS COMPILADAS — HTML de ejemplo de cada pieza (misma estructura y clases; cambia solo el contenido)\n${htmlPrimitivas}`
      : ""
  }\n\n# CSS determinista de la experiencia (INCLUIRLA tal cual en el <style> y añadir la tuya ENCIMA)\n${cssForjado}${
    scriptForjado
      ? `\n\n# SCRIPTS CAPADOS de las primitivas (pegar al final del <body> tal cual)\n${scriptForjado}`
      : ""
  }\n\n# Petición original del usuario\n${p.mensaje}${ajuste}${
    p.codigoActual
      ? `\n\n# Contexto: código existente del proyecto (respeta su contenido y datos)\n${p.codigoActual.slice(0, 6000)}`
      : ""
  }`;
}

/** v4.7 — El CORPUS DE SEÑALES con el que se decide la experiencia: el
 * brief, la ficha aprobada, el ADN visual y el ajuste pedido. Todo lo que
 * el usuario y el Diseñador ya dijeron cuenta como intención; hasta v4.6
 * solo contaba el mensaje original.
 *
 * El mensaje original sigue viajando aparte (`mensajeOriginal`) porque el
 * plano de contenido extrae de ÉL los hechos del brief: mezclarlo con la
 * ficha produciría precios y horarios fantasma. */
export function corpusDeSenales(
  p: PeticionForja,
  fichaTexto: string,
  adn: ReturnType<typeof sanearAdn> | null,
  feedback: string | null
): string {
  const partes: string[] = [p.mensaje ?? ""];
  if (adn) partes.push(textoAdn(adn));
  // de la ficha interesan estructura e interacción: son decisiones, no prosa
  const estructura = /##\s*Estructura[\s\S]{0,900}/i.exec(fichaTexto ?? "")?.[0] ?? "";
  const interaccion = /##\s*Interacci[oó]n[\s\S]{0,500}/i.exec(fichaTexto ?? "")?.[0] ?? "";
  partes.push(estructura, interaccion);
  // el ajuste pesa: se repite para que domine las señales anteriores
  if (feedback) partes.push(feedback, feedback);
  return partes.filter(Boolean).join("\n").slice(0, 6000);
}

/** Extrae las notas provisionales: qué debe revisar el usuario en la maqueta. */
function notasDeMaqueta(_fichaTexto: string): string {
  const pendientes = [
    "Los textos son provisionales pero realistas: revisa el tono y los datos (precios, horarios, nombre de la marca).",
    "Las imágenes son placeholders decorativos: las reales se ponen en el código final.",
    "Si prefieres otra de las ideas listadas, pídelo («usa la dirección 2») y re-maqueto.",
  ];
  return pendientes.map((p) => `- ${p}`).join("\n");
}

/** Dependencias para construir la propuesta (igual filosofía de inyección
 * que DependenciasForja en nucleo.ts: sin red ni storage propias). */
export interface DependenciasMaqueta {
  llamarModelo: LlamadaModelo;
  /** cómo resolver el rol maquetador si la config no tiene modelo asignado */
  fallback: ModeloDeRol;
  cfg: ConfigForja;
  /** progreso para la UI en vivo */
  onProgreso?: (evento: EventoMaqueta) => void;
  /** v4.2 — caché de generaciones: la MAQUETA INICIAL (sin feedback) se
   * reusa si la pareja petición+ficha ya se maquetó. Los ajustes nunca se
   * cachean: cada feedback es único. Opcional. */
  cache?: CacheGeneracion;
}

export type EventoMaqueta =
  | { tipo: "maqueta-inicio"; modelo: string }
  | { tipo: "fragmento"; texto: string }
  | { tipo: "maqueta-fin"; ok: boolean };

/** Construye la PropuestaMaqueta completa a partir de la ficha del Diseñador.
 * `fichaTexto` debe venir del Diseñador EN MODO MAQUETA (con el bloque
 * <direcciones>). Si el parse de direcciones sale vacío (modelo despistado),
 * se sintetiza una dirección única desde la ficha para no romper el flujo. */
export async function construirPropuesta(
  p: PeticionForja,
  fichaTexto: string,
  deps: DependenciasMaqueta,
  /** función de llamada ya preparada por el núcleo (traza y modelo por rol) */
  llamada: (rol: RolForja, system: string, user: string, ronda: number) => Promise<string>
): Promise<PropuestaMaqueta> {
  const direcciones = parseDirecciones(fichaTexto);
  let html = "";
  // v4.2 — CACHÉ: la maqueta SIN feedback depende solo de (petición, ficha);
  // si ya se maquetó esa pareja, no se paga la llamada.
  const cache = deps.cache;
  const claveCache = cache ? claveMaqueta(p, fichaTexto) : "";
  const cacheada = claveCache && cache ? (cache.obtener(claveCache) ?? null) : null;
  try {
    const modelo = deps.cfg.porRol.codificador ?? deps.fallback;
    deps.onProgreso?.({
      tipo: "maqueta-inicio",
      modelo: `${modelo.providerId}:${modelo.modelId}`,
    });
    if (cacheada) {
      html = cacheada;
    } else {
      const texto = await llamada(
        "codificador",
        PROMPT_MAQUETA,
        mensajeMaqueta(p, fichaTexto, null),
        1
      );
      html = extraerCodigo(texto);
      if (claveCache && cache && html.trim().length > 200) {
        cache.guardar(claveCache, html);
      }
    }
    deps.onProgreso?.({ tipo: "maqueta-fin", ok: html.length > 0 });
  } catch {
    deps.onProgreso?.({ tipo: "maqueta-fin", ok: false });
  }
  const informe = detectarGenericidad(html);
  return {
    direcciones,
    html,
    eleccion: 1,
    /** «propuesta» aunque el html haya fallado: la propuesta (ideas) sigue
     * en pie y el usuario puede elegir dirección o pedir «directo». */
    estado: "propuesta",
    notas:
      (informe.nivel === "alto" && html
        ? `- ⚠ ${resumenAntiGenerico(informe)}: la maqueta cae en patrones de plantilla de IA; el Revisor y el Juez de Originalidad lo auditarán. Pide «Ajusta: …» para salir del patrón.\n`
        : "") + notasDeMaqueta(fichaTexto),
    ajustes: 0,
    genericidad: informe,
  };
}

/** Re-maqueta con feedback del usuario o con otra dirección elegida.
 * Devuelve la propuesta ACTUALIZADA (mismo objeto conceptual, nuevo html). */
export async function ajustarPropuesta(
  p: PeticionForja,
  fichaTexto: string,
  propuesta: PropuestaMaqueta,
  feedback: string,
  deps: DependenciasMaqueta,
  llamada: (rol: RolForja, system: string, user: string, ronda: number) => Promise<string>
): Promise<PropuestaMaqueta> {
  if (propuesta.ajustes >= MAX_AJUSTES_MAQUETA) {
    return {
      ...propuesta,
      notas:
        `- Tope de ${MAX_AJUSTES_MAQUETA} ajustes alcanzado. Si aún no convence, pide «directo» y el equipo codifica la dirección ${propuesta.eleccion} con tus últimas notas.\n${propuesta.notas}`,
    };
  }
  // si el usuario eligió otra dirección, se inyecta como feedback explícito
  const eleccion = /direcci[oó]n\s*([123])/i.exec(feedback);
  const nuevaEleccion = eleccion
    ? (Math.min(3, Math.max(1, Number(eleccion[1]))) as 1 | 2 | 3)
    : propuesta.eleccion;
  const feedbackFinal = eleccion
    ? `Cambia a la DIRECCIÓN ${nuevaEleccion} («${
        propuesta.direcciones.find((d) => d.n === nuevaEleccion)?.nombre ?? ""
      }»). Reinterpreta la maqueta siguiendo ese concepto: ${feedback.replace(eleccion[0], "").trim()}`
    : feedback;
  let html = propuesta.html;
  try {
    const modelo = deps.cfg.porRol.codificador ?? deps.fallback;
    deps.onProgreso?.({
      tipo: "maqueta-inicio",
      modelo: `${modelo.providerId}:${modelo.modelId}`,
    });
    const texto = await llamada(
      "codificador",
      PROMPT_MAQUETA,
      mensajeMaqueta(p, fichaTexto, feedbackFinal),
      propuesta.ajustes + 2
    );
    html = extraerCodigo(texto) || html;
    deps.onProgreso?.({ tipo: "maqueta-fin", ok: html !== propuesta.html });
  } catch {
    deps.onProgreso?.({ tipo: "maqueta-fin", ok: false });
    /* red o cuota caída: se devuelve la propuesta anterior intacta */
  }
  return {
    ...propuesta,
    direcciones: propuesta.direcciones.length
      ? propuesta.direcciones
      : parseDirecciones(fichaTexto),
    html,
    eleccion: nuevaEleccion,
    estado: "ajustada",
    ajustes: propuesta.ajustes + 1,
    genericidad: detectarGenericidad(html),
  };
}

/** Texto que acompaña a la maqueta en el chat: qué se propuso y qué decidir. */
export function respuestaDePropuesta(propuesta: PropuestaMaqueta): string {
  const ideas = propuesta.direcciones.length
    ? propuesta.direcciones
        .map(
          (d) =>
            `${d.n}. **${d.nombre}** — ${d.concepto}${
              d.paleta ? `\n   Paleta: ${d.paleta}` : ""
            }${d.tipografia ? `\n   Tipografía: ${d.tipografia}` : ""}`
        )
        .join("\n")
    : "- (el Diseñador no detalló direcciones; la maqueta sigue la ficha)";
  const maquetada = propuesta.direcciones.find((d) => d.n === propuesta.eleccion);
  const estadoHtml = propuesta.html
    ? "Tienes la maqueta navegable en la vista previa."
    : "No pude generar la maqueta visual ahora mismo (cuota o red); igualmente puedes elegir idea y sigo.";
  return `## Propuesta de diseño de FORJA IA

Antes de tirar código, aquí van las ideas ${EQUIPO_FORJA.disenador.nombre.toLowerCase()} propuso:
${ideas}

### Maqueta actual: dirección ${propuesta.eleccion}${maquetada ? ` — «${maquetada.nombre}»` : ""}
${estadoHtml}

### Qué revisar
${propuesta.notas}

**Dime una de estas cosas para continuar:**
- «Aprobado» → el equipo codifica esta maqueta con su bucle de revisión.
- «Ajusta: …» → corrijo la maqueta (máx. ${MAX_AJUSTES_MAQUETA} ajustes).
- «Usa la dirección 2/3» → re-maqueto con otra idea.
- «Directo» → salto la propuesta y codifico ya.`;
}
