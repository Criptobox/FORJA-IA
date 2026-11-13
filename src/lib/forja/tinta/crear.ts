/** FORJA IA — Crear una app con la biblioteca Tinta.
 *
 * El reparto que ahorra tokens: el modelo NO escribe HTML. Recibe las
 * instrucciones y el catálogo de Tinta, devuelve una receta corta (qué bloques,
 * paleta, letra y textos) y Tinta la convierte en la app completa —todas las
 * pantallas, enlazadas, con el contraste corregido— después de que el equipo de
 * agentes la trabaje a la vista. Una llamada (dos si la primera respuesta no
 * sirve) en vez de una por pantalla.
 *
 * La llamada al modelo es la del Estudio (`pedirAlModelo`): modelo elegido o
 * cadena Auto, salud compartida y registro de uso. Se inyecta para probar. */
import { ErrorTinta, type ClienteTinta, type RecetaTinta, type RespuestasTinta } from "./cliente";

export type PasoTinta = "arrancando" | "instrucciones" | "modelo" | "leyendo" | "corrigiendo" | "equipo" | "listo";

export const TEXTO_PASO: Record<PasoTinta, string> = {
  arrancando: "Abriendo la biblioteca Tinta…",
  instrucciones: "Preparando el catálogo para el modelo…",
  modelo: "El modelo elige las piezas…",
  leyendo: "Revisando la propuesta…",
  corrigiendo: "La propuesta tenía fallos: se la devuelvo corregida…",
  equipo: "El equipo de agentes está trabajando…",
  listo: "Listo",
};

export interface PedirModelo {
  (p: { sistema: string; usuario: string; modeloKey: string | null; signal: AbortSignal; maxTokens?: number }): Promise<{ texto: string; modelKey: string }>;
}

export interface ResultadoTinta {
  html: string;
  pantallas: { id: string; nombre: string }[];
  borrador: unknown;
  receta: RecetaTinta;
  /** qué versión eligió la persona tras la crítica */
  modo: RespuestasTinta["equipo"]["modo"];
  /** modelo que escribió la receta (proveedor::modelo) */
  modelKey: string;
  /** llamadas al modelo que costó (1, o 2 si hubo que corregir) */
  llamadas: number;
  avisos: string[];
}

export async function crearConTinta(o: {
  brief: string;
  modeloKey: string | null;
  signal: AbortSignal;
  cliente: ClienteTinta;
  pedirModelo: PedirModelo;
  /** se enseña al equipo de agentes; se oculta al terminar */
  mostrarEquipo?: (si: boolean) => void;
  onPaso?: (p: PasoTinta) => void;
}): Promise<ResultadoTinta> {
  const brief = o.brief.trim();
  if (!brief) throw new ErrorTinta("Describe qué quieres diseñar");
  const paso = (p: PasoTinta) => o.onPaso?.(p);
  paso("arrancando");
  await o.cliente.listo();
  paso("instrucciones");
  const ins = await o.cliente.pedir("instrucciones", { idea: brief }, { signal: o.signal });
  paso("modelo");
  let r = await o.pedirModelo({ sistema: ins.sistema, usuario: brief, modeloKey: o.modeloKey, signal: o.signal, maxTokens: 2048 });
  let llamadas = 1;
  paso("leyendo");
  let leido = await o.cliente.pedir("leer", { texto: r.texto }, { signal: o.signal });
  if (!leido.ok) {
    paso("corrigiendo");
    const usuario = `${brief}\n\nTu respuesta anterior fue:\n${r.texto.slice(0, 3000)}\n\n${leido.correccion}`;
    r = await o.pedirModelo({ sistema: ins.sistema, usuario, modeloKey: o.modeloKey, signal: o.signal, maxTokens: 2048 });
    llamadas++;
    leido = await o.cliente.pedir("leer", { texto: r.texto }, { signal: o.signal });
  }
  if (!leido.ok || !leido.receta) {
    throw new ErrorTinta(`El modelo no dio una propuesta válida: ${leido.errores.slice(0, 2).join(" ") || "sin JSON"}. Prueba con otro modelo.`);
  }
  paso("equipo");
  o.mostrarEquipo?.(true);
  try {
    const eq = await o.cliente.pedir("equipo", { receta: leido.receta, idea: brief }, { ms: 15 * 60_000, signal: o.signal });
    paso("listo");
    return { html: eq.html, pantallas: eq.pantallas, borrador: eq.borrador, receta: leido.receta, modo: eq.modo, modelKey: r.modelKey, llamadas, avisos: leido.avisos };
  } finally {
    o.mostrarEquipo?.(false);
  }
}
