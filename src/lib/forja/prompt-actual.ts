"use client";
/** Forja IA — Las piezas del prompt tal y como están AHORA MISMO.
 *
 * Vive fuera de `chat-app` porque hay dos sitios que necesitan lo mismo: el
 * que manda el mensaje y el medidor de Ajustes. Si cada uno se lo montara por
 * su cuenta, el medidor enseñaría un número que no es el que viaja — y un
 * número falso es peor que no enseñar ninguno.
 */
import { useForja } from "./store";
import { reglasActivas, useFailures } from "./failures";
import { agentPrompt } from "./agent-loop";
import { textoDeModos } from "./agent-modes";
import { isForjaWebKey } from "./types";
import { analyzeSkillPermissions, renderPermisosPrompt } from "./skill-permissions";
import { buildPassport, renderPassportForPrompt } from "./passport";
import { deriveMapFromMessages, renderMapForPrompt } from "./project-map";
import type { EntradaPrompt } from "./presupuesto";
import { esTurnoTrivial } from "./turno-trivial";
import { renderReglasParaPrompt } from "./reglas-no";
import { CONTEXTO_VACIO, type ContextoUsado } from "./contexto-usado";
import { MAX_FILES_PROMPT, MAX_NOTES_PROMPT } from "./project-map";
import { leerMemoria, renderMemoriaParaPrompt } from "./memoria-proyecto";
import { buscarContexto, renderContextoParaPrompt } from "./auto-contexto";
import {
  elegirDireccion,
  esEncargoUINueva,
  promptDireccion,
} from "./design-directions";
import { INSTRUCCION_EVIDENCIA } from "./evidencia";
import { INSTRUCCION_VARIOS_ARCHIVOS, pideVariosArchivos } from "./multi-archivo";
import { esEncargoDeTiendaOCatalogo, INSTRUCCION_TIENDA_INTERACTIVA } from "./catalogo-interactivo";
import { buildDesignArchitecture, designArchitecturePrompt } from "./design-architect";

/** Textos de los estilos de salida. Fuera de la función para que se puedan
 *  medir sin montar nada. */
export const TEXTO_ESTILO = {
  conciso:
    "[Estilo: conciso] Responde TERSE y directo: sin relleno, sin preámbulos ni despedidas, sin repetir la pregunta. Frases cortas. El código y los datos técnicos se conservan exactos.",
  detallado:
    "[Estilo: detallado] Responde de forma completa y pedagógica: explica el razonamiento paso a paso, incluye ejemplos y advierte los errores comunes.",
} as const;

/** Bloque del preset «FORJA WEB» (Cerebro + Knowledge Base + Research +
 * Diseño + Arquitectura + Código + QA + Reparación). Se suma al bloque del
 * agente, no lo sustituye — necesita el mismo bucle plan→ejecutar→revisar,
 * solo que con un flujo obligatorio delante.
 *
 * El usuario pidió explícito que esto no fuera "cajas bonitas": el flujo
 * tiene que ejecutarse de verdad, y cuando algo falle, el modelo tiene que
 * arreglar el archivo original — no crear un "fix.ts"/"patch-final.js" al
 * lado. Esto último ya no es solo una instrucción: `tool-runner.ts`
 * RECHAZA esos nombres en `write_file` cuando el archivo es nuevo (busca
 * `esNombreDeParche`), así que el prompt se lo explica para que no
 * reintente lo mismo. */
export const FORJA_WEB_PROMPT = [
  "[FORJA WEB — sistema completo]",
  "Flujo obligatorio para construir la web. No te lo saltes, no lo des por hecho sin haberlo pasado, y no anuncies un paso que no vas a ejecutar:",
  "1. Conocimiento: antes de diseñar o escribir código, llama a «kb_search» con lo que necesites (referencia visual, componente, tecnología). Si no hay nada indexado, sigue sin fingir que existe.",
  "2. Diseño: decide la dirección visual con lo que encontraste, o con buen criterio si la Knowledge Base no tenía nada.",
  "3. Arquitectura: antes de escribir, decide qué archivos hacen falta y para qué sirve cada uno.",
  "4. Código: escribe el proyecto con las herramientas de archivo, siguiendo esa arquitectura.",
  "5. QA: pasa «verify_project» (ejecuta el proyecto de verdad y mide) antes de darlo por terminado. No declares terminado un proyecto sin esa verificación.",
  "6. Reparación: si «verify_project» encuentra un fallo, localiza el archivo y la línea responsables (usa «read_file» si hace falta) y corrige ESE MISMO archivo con «edit_file» o «apply_patch». PROHIBIDO crear un archivo nuevo para el arreglo («fix.ts», «patch-final.js», «temporary-fix.html»…): el sistema rechaza esos nombres en «write_file» — localiza y corrige el original.",
  "7. Nueva prueba: tras cada reparación, vuelve a pasar «verify_project» — no des el trabajo por bueno con la palabra del paso anterior.",
  "8. Entrega: usa «check_definition_of_done» antes de decir que está listo para publicarse.",
].join("\n");

export function entradaPromptActual(sessionId?: string): EntradaPrompt {
  const st = useForja.getState();

  const estilo =
    st.settings.outputStyle === "conciso"
      ? TEXTO_ESTILO.conciso
      : st.settings.outputStyle === "detallado"
        ? TEXTO_ESTILO.detallado
        : null;

  const modos = textoDeModos(st.settings.agentModes ?? []) || null;

  // Se necesita ya aquí (antes de lo que hasta ahora era su primer uso, más
  // abajo) porque `skills` también lo consulta: la skill de desarrollador
  // web manda SIEMPRE un único archivo, y eso es justo lo que hay que
  // ampliar cuando el encargo pide un proyecto de varios archivos.
  const sesionActual = sessionId ? st.sessions.find((s) => s.id === sessionId) : null;
  const ultimoDelUsuario = [...(sesionActual?.messages ?? [])]
    .reverse()
    .find((m) => m.role === "user");
  const trivial = esTurnoTrivial(ultimoDelUsuario?.content ?? "");
  const promptUsuario = ultimoDelUsuario?.content ?? "";

  const activas = st.skills.filter((s) => s.enabled);
  const skills = activas.length
    ? [
        activas.map((s) => `### Skill activa: ${s.name}\n${s.instructions}`).join("\n\n"),
        // Solo si de verdad se pidió un proyecto de varios archivos: el
        // resto de encargos se quedan en un solo archivo, que es lo que
        // hace que la vista previa en vivo funcione sin fricción.
        !trivial && pideVariosArchivos(promptUsuario) ? INSTRUCCION_VARIOS_ARCHIVOS : null,
        // Solo para tienda/menú/catálogo: sin esto la skill de desarrollador
        // web entrega una landing bonita pero sin carrito, detalle de
        // producto ni pedido que de verdad funcionen.
        !trivial && esEncargoDeTiendaOCatalogo(promptUsuario) ? INSTRUCCION_TIENDA_INTERACTIVA : null,
      ]
        .filter(Boolean)
        .join("\n\n")
    : null;
  // Límites de las skills: lo que declaren con permisos sensibles se le
  // recuerda al modelo como techo — una skill no manda por encima del usuario.
  const permisos = activas.length
    ? renderPermisosPrompt(
        activas.map((s) => s.name),
        activas.map((s) => s.permissions ?? analyzeSkillPermissions(s.instructions))
      )
    : null;

  // Memoria de fallos: reglas aprendidas de errores verificables de intentos
  // anteriores. El agente las consulta antes de actuar, que es donde sirven.
  //
  // Y la plantilla del agente NO viaja en un turno trivial. Con ella delante,
  // un «Hola» en una conversación sobre una web salía contestado con plan,
  // pasos y un «he actualizado index.html» que nadie pidió: el modelo tiene
  // una plantilla que rellenar y la rellena. Sin ella, contesta como una
  // persona. Ver `turno-trivial.ts`.
  // FORJA WEB fuerza el modo agente aunque el interruptor de Ajustes esté
  // apagado: elegirlo YA es la señal de que se quiere el sistema completo,
  // no un interruptor aparte que haya que recordar encender (`use-generation.ts`
  // aplica la misma regla al decidir si se pasa el catálogo de herramientas).
  const modeloActual = sesionActual?.modelKey ?? st.settings.defaultModelKey ?? null;
  const forjaWebActivo = isForjaWebKey(modeloActual);
  const agente =
    (st.settings.agentMode || forjaWebActivo) && !trivial
      ? [
          agentPrompt(st.settings.agentMaxLoops, reglasActivas(useFailures.getState().entries)),
          // Evidence Mode (plan técnico §5): afirmaciones sobre el código con
          // fuente (archivo:línea) o admisión explícita de que no la hay.
          INSTRUCCION_EVIDENCIA,
        ].join("\n\n")
      : null;

  let ficha: string | null = null;
  let mapa: string | null = null;
  // Las reglas «no tocar» viajan SIEMPRE, también en turnos triviales: son una
  // restricción, no contexto. Quitarlas para ahorrar cuatro líneas es dejar al
  // agente sin la única barandilla que el usuario puso a mano.
  const reglas = renderReglasParaPrompt(sesionActual?.reglasNo);
  const session = sesionActual;
  // En un turno trivial tampoco viajan la ficha ni el mapa del proyecto.
  //
  // No es solo ahorro de tokens: el mapa termina con «Al pedir cambios: entrega
  // SOLO el/los archivos que modifiques (completos)», que es una instrucción de
  // ESCRIBIR ARCHIVOS. Con un «hola» delante, el modelo la obedecía y devolvía
  // otra vez la página del turno anterior. Quitar el bloque del agente no
  // bastaba: la orden de entregar archivos seguía llegando por aquí.
  if (session && !trivial) {
    const map = session.projectMap ?? deriveMapFromMessages(session.messages);
    ficha = renderPassportForPrompt(buildPassport(map));
    mapa = renderMapForPrompt(map);
  }

  // ——— Auto Context (plan técnico §2) ———
  // Antes de enviar, buscar qué es pertinente: keywords del prompt contra los
  // archivos disponibles, el mapa y la memoria estructurada del proyecto.
  // Lo que encuentra viaja como bloque del prompt y se cuenta para el HUD.
  const memoria = sessionId ? leerMemoria(sessionId) : null;
  const contexto = buscarContexto(ultimoDelUsuario?.content ?? "", {
    archivosDisponibles: session?.projectMap?.files.map((f) => f.name) ?? [],
    mapa: session?.projectMap ?? null,
    memoria,
    reglas: sesionActual?.reglasNo ?? [],
  });
  const bloqueContexto = !trivial ? renderContextoParaPrompt(contexto) : null;
  // La memoria completa (renderMemoriaParaPrompt) solo se añade si el Auto
  // Context no encontró nada específico: dos bloques que dicen lo mismo es ruido.
  const bloqueMemoria =
    !bloqueContexto && !trivial ? renderMemoriaParaPrompt(memoria ?? { decisiones: [], errores: [], tareas: [], disenos: [], reglas: [] }) : null;
  const contextoFinal = bloqueContexto ?? bloqueMemoria;

  // ——— Dirección de diseño (Pilar 2) ———
  // Solo para encargos de UI nueva, no para retoques: «cambia el botón» no
  // tiene que reelegir la identidad visual del proyecto. La elección respeta
  // lo que el prompt traiga («minimalista») y, si no trae nada, rota evitando
  // las direcciones ya usadas en este proyecto (variación forzada).
  //
  // Bajo FORJA WEB también hace falta una dirección aunque el prompt no use
  // verbos de "crear UI" (p.ej. "arréglame esta web"): el Design Architect de
  // más abajo necesita una, y tiene que ser la MISMA que esta — reelegirla
  // por separado (como hacía la versión anterior) podía darle al modelo dos
  // paletas/tipografías distintas en el mismo prompt.
  let diseno: string | null = null;
  let disenoId: string | undefined = undefined;
  let eleccionDireccion: ReturnType<typeof elegirDireccion> | null = null;
  if (!trivial && (esEncargoUINueva(promptUsuario) || forjaWebActivo)) {
    eleccionDireccion = elegirDireccion(
      promptUsuario,
      (memoria?.disenos ?? []).slice(0, 4).map((d) => d.direccion)
    );
    disenoId = eleccionDireccion.direccion.nombre;
    // Bajo FORJA WEB, el bloque del Design Architect (más abajo) ya incluye
    // paleta, tipografía y composición de esta misma dirección — repetirlo
    // aquí sería la misma información dos veces en el mismo prompt.
    if (!forjaWebActivo) {
      diseno = promptDireccion(eleccionDireccion);
    }
  }

  // ——— FORJA WEB: arquitectura de diseño del Cerebro ———
  // Usa la MISMA dirección ya elegida arriba (`directionId`) — nunca una
  // reelección independiente con `previousDirectionIds` vacío, que siempre
  // caería en la misma primera opción del catálogo (ver `design-architect.ts`).
  const cerebroArquitectura =
    forjaWebActivo && !trivial
      ? designArchitecturePrompt(
          buildDesignArchitecture({
            brief: promptUsuario,
            directionId: eleccionDireccion?.direccion.id,
          })
        )
      : null;
  const forjaWeb =
    forjaWebActivo && !trivial
      ? [FORJA_WEB_PROMPT, cerebroArquitectura].filter(Boolean).join("\n\n")
      : null;

  // ——— Qué contexto viaja de verdad ———
  // Se cuenta AQUÍ, junto a las piezas, y con los mismos topes que se aplican
  // al construirlas. Un contador que lo calculara por su cuenta se
  // desincronizaría a la primera pieza nueva y enseñaría un número falso, que
  // es peor que no enseñar nada (la lección está escrita en `presupuesto.ts`).
  const mapUsado = mapa ? (session?.projectMap ?? deriveMapFromMessages(session?.messages ?? [])) : null;
  const usado: ContextoUsado = {
    ...CONTEXTO_VACIO,
    archivos: mapUsado ? mapUsado.files.slice(0, MAX_FILES_PROMPT).map((f) => f.name) : [],
    notas: mapUsado ? Math.min(mapUsado.notes?.length ?? 0, MAX_NOTES_PROMPT) : 0,
    reglas: reglas ? (sesionActual?.reglasNo ?? []).length : 0,
    skills: activas.map((s) => s.name),
    fallos: agente ? reglasActivas(useFailures.getState().entries).length : 0,
    memorias: contextoFinal
      ? contexto.decisiones.length + contexto.errores.length
      : 0,
    diseno: disenoId,
  };

  return {
    usado,
    sistema: st.settings.systemPrompt.trim(),
    estilo,
    modos,
    skills,
    permisos,
    agente,
    forjaWeb,
    ficha,
    mapa,
    contexto: contextoFinal,
    diseno,
    reglas,
    ahorro: !!st.settings.ahorro,
  };
}

/** Cuánto ocupa una skill concreta dentro del prompt, con su cabecera.
 *  Es lo que se enseña al lado de cada una para que se vea el precio. */
export function costeDeSkill(nombre: string, instrucciones: string): number {
  return `### Skill activa: ${nombre}\n${instrucciones}`.length;
}
