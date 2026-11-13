/** FORJA IA — Tinta en el chat.
 *
 * Al pedir una APP nueva en el chat («hazme una app para mi cafetería»), antes
 * de gastar nada se ofrecen dos caminos, sin tokens:
 *
 *  · **Diseño con Tinta**: el modelo solo elige piezas de la biblioteca (una
 *    receta corta), el equipo de agentes la trabaja a la vista y sale la app
 *    completa con todas sus pantallas. Muy pocos tokens. Es diseño navegable,
 *    no lógica: no guarda datos ni tiene cuentas.
 *  · **App funcional con código**: lo de siempre (Modo App), la IA escribe los
 *    módulos con estado, rutas y persistencia.
 *
 * Las webs (landing, portfolio…) siguen con la propuesta de diseño de siempre:
 * Tinta arma pantallas de app móvil, no páginas. */
import { esEncargoUINueva } from "../design-directions";
import { esEncargoDeApp } from "../modo-app";

/** Señales de que no se quiere la pregunta este turno (las mismas que la propuesta). */
const SIN_PREGUNTA = /\b(directo|directamente|sin propuesta|sin preguntar|ya mismo|tal cual)\b/i;

export type EstadoOfertaTinta = "pendiente" | "creando" | "hecha" | "descartada" | "error";

/** La tarjeta del chat. Vive en el mensaje: es local, no viaja al modelo. */
export interface OfertaTinta {
  estado: EstadoOfertaTinta;
  /** texto del paso mientras se crea */
  paso?: string;
  proyectoId?: string;
  pantallas?: number;
  modelo?: string;
  llamadas?: number;
  error?: string;
}

export function debeOfrecerTinta(e: { texto: string; activada: boolean; imagenes: number }): boolean {
  if (!e.activada) return false;
  const t = e.texto ?? "";
  if (!esEncargoUINueva(t) || !esEncargoDeApp(t)) return false;
  if (e.imagenes > 0) return false; // una referencia visual pide otro camino
  if (SIN_PREGUNTA.test(t)) return false;
  return true;
}

export const TEXTO_OFERTA_TINTA = "¿Cómo construimos la app? Elige: diseño con la biblioteca Tinta (pantallas listas, muy pocos tokens) o app funcional con código.";
