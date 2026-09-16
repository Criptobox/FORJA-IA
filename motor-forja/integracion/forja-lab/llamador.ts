/** FORJA IA Lab — El LlamadaModelo del preview: conecta el núcleo FORJA con
 * el motor de modelos disponible en el servidor (z-ai-web-dev-sdk).
 *
 * v4.2 — BLINDAJE COMPLETO + SALUD + FÁBRICA POR GENERACIÓN:
 *
 *   · max_tokens por rol: el Codificador pide 16.384 — una página completa
 *     no cabe en 4k y el corte por max_tokens pasa igual de pagado que de
 *     gratis. Desde v4.2 el techo CONCRETO llega en cada llamada resuelto
 *     desde ConfigForja.maxTokensPorRol (el núcleo lo calcula con
 *     techoTokens()); aquí solo se respeta.
 *   · finish_reason: el transporte extrae el campo crudo del protocolo
 *     OpenAI (choices[0].finish_reason) y motivo-parada.ts lo traduce.
 *     Si el proveedor contesta "length", el adaptador pide CONTINUACIÓN
 *     hasta 2 veces y concatena. Y si aun así quedó roto, el NÚCLEO tiene
 *     su segundo cinturón estructural (continuacion-nucleo.ts).
 *   · Errores de red: hasta 3 intentos por proveedor con backoff
 *     exponencial + jitter (0.6s, 1.2s…).
 *   · SALUD (v4.2): el adaptador alimenta un libro de salud compartido del
 *     proceso (salud-proveedores.ts) con latencias y fallos medidos. Con un
 *     solo eslabón no hay cadena que reordenar, pero la evidencia queda
 *     registrada para el panel y para cuando el Lab tenga suplentes.
 *   · TELEMETRÍA (v4.2): crearLlamadorLab({ onEvento }) acepta un puente
 *     por generación — la ruta de chat le pasa crearTelemetriaForja
 *     (observabilidad.ts) y cada generación queda registrada: reintentos,
 *     failovers, continuaciones, tokens y latencias. llamarMotor sigue
 *     exportado como instancia por defecto (solo log de servidor).
 *
 * El módulo FORJA no sabe de proveedores: recibe esta función por parámetro.
 * Aquí todas las llamadas van al motor conectado del sandbox, sea cual sea
 * el (providerId, modelId) configurado por rol.
 */

import ZAI from "z-ai-web-dev-sdk";
import type { LlamadaModelo } from "@/lib/prism/forja/tipos";
import {
  crearAdaptadorForja,
  type EventoAdaptador,
  type TransporteModelo,
} from "@/lib/prism/forja/adaptador-resiliente";
import { crearSaludProveedores, type SaludProveedores } from "@/lib/prism/forja/salud-proveedores";

/** Instancia única reutilizada entre llamadas (mejor latencia). */
let zaiInstancia: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function zai() {
  if (!zaiInstancia) zaiInstancia = await ZAI.create();
  return zaiInstancia;
}

/** El transporte CRUDO: una llamada, sin defensas. Extrae el texto y el
 *  finish_reason crudo — la traducción vive en motivo-parada.ts. */
const transporteMotor: TransporteModelo = async (args) => {
  const cliente = await zai();
  const mensajes: { role: "assistant" | "user"; content: string }[] = [
    { role: "assistant", content: args.system },
    { role: "user", content: args.user },
  ];
  const completion = await cliente.chat.completions.create({
    messages: mensajes,
    max_tokens: args.maxTokens,
    thinking: { type: "disabled" },
  });
  const eleccion = completion.choices?.[0];
  const texto = eleccion?.message?.content ?? "";
  // el campo que antes se ignoraba: por qué paró el modelo, según el proveedor
  const motivoParada = eleccion?.finish_reason;
  return { texto, motivoParada };
};

/** El libro de salud COMPARTIDO del proceso: una instancia (no una por
 * llamada) para que la evidencia de latencia acumule entre generaciones. */
export const saludLab: SaludProveedores = crearSaludProveedores();

/** Log de servidor de los eventos del adaptador (la telemetría por
 * generación la aporta el llamador vía crearTelemetriaForja). Exportado:
 * la ruta de chat lo compone con el puente para dejar TANTO el registro
 * como la línea en vivo. */
export function logEvento(e: EventoAdaptador): void {
  const sello = new Date().toISOString().slice(11, 19);
  switch (e.tipo) {
    case "red-reintento":
      console.warn(
        `[FORJA ${sello}] red · reintento ${e.intento} en ${e.esperaMs}ms (${e.motivo})`
      );
      break;
    case "failover":
      console.warn(`[FORJA ${sello}] failover ${e.desde} → ${e.hacia}`);
      break;
    case "continuacion":
      console.warn(`[FORJA ${sello}] salida corta (length) · continuación ${e.n}`);
      break;
    case "truncado-final":
      console.warn(
        `[FORJA ${sello}] truncado tras continuaciones — el segundo cinturón del núcleo lo recoge`
      );
      break;
    case "exito":
      console.log(
        `[FORJA ${sello}] ok ${e.providerId}:${e.modelId} · ${e.ms}ms${
          e.tokensSalida ? ` · ${e.tokensSalida} tokens` : ""
        }${e.continuaciones ? ` · ${e.continuaciones} continuación(es)` : ""}`
      );
      break;
    case "cadena-agotada":
      console.error(`[FORJA ${sello}] cadena agotada: ${e.ultimoError}`);
      break;
  }
}

/** v4.2 — FÁBRICA del llamador blindado. Una instancia POR GENERACIÓN
 * permite enchufar el puente de telemetría de esa generación (el registro
 * de observabilidad se crea por petición). La salud es siempre la global.
 *
 * ```ts
 * // en una ruta de chat:
 * const registro = crearRegistro(projectId);
 * const llamarModelo = crearLlamadorLab({
 *   onEvento: crearTelemetriaForja(registro, { tambien: logEvento }),
 * });
 * ```
 */
export function crearLlamadorLab(
  opciones: { onEvento?: (e: EventoAdaptador) => void } = {}
): LlamadaModelo {
  return crearAdaptadorForja(transporteMotor, {
    intentosRed: 3,
    backoffBaseMs: 600,
    maxContinuaciones: 2,
    salud: saludLab,
    onEvento: opciones.onEvento,
  });
}

/** El LlamadaModelo blindado por defecto que el núcleo recibe. Misma firma
 * de siempre: la tubería se defiende sola y la evidencia queda en el log
 * del server. (Las generaciones serias usan crearLlamadorLab + registro.) */
export const llamarMotor: LlamadaModelo = crearLlamadorLab({
  onEvento: logEvento,
});
