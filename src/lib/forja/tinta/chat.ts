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
 * Solo se ofrece cuando Tinta tiene piezas para ese sector (cafetería, tienda,
 * gimnasio, viajes…) y la app no es claramente de gestión de datos (tareas,
 * CRM, inventario…): para eso el camino bueno es el código.
 *
 * Las webs (landing, portfolio…) siguen con la propuesta de diseño de siempre:
 * Tinta arma pantallas de app móvil, no páginas. */
import { esEncargoUINueva } from "../design-directions";
import { esEncargoDeApp } from "../modo-app";

/** Sectores que conoce la biblioteca Tinta (palabras de `web/js/tinta-sectors.js`
 *  en Estilos). Fuera de ellos Tinta no tiene piezas afines y no se ofrece. */
const SECTORES_TINTA =
  /\b(caf[eé]s?|cafeter[ií]as?|restaurantes?|comida|pizzer[ií]as?|pizzas?|pedidos?|men[uú]|panader[ií]as?|bar|sushi|hamburgues[ae]s?|hamburgueser[ií]as?|delivery|tiendas?|ropa|comprar|compras?|productos?|cat[aá]logo|carrito|moda|zapatillas|ecommerce|env[ií]os?|finanzas|dinero|banco|ahorro|inversi[oó]n|gastos|presupuesto|billetera|pagos|fintech|cripto|seguros?|p[oó]liza|fitness|gimnasio|gym|entrenamientos?|ejercicios?|rutinas?|yoga|running|deportes?|correr|viajes?|hotel(?:es)?|vuelos?|turismo|destinos?|reservas?|vacaciones|hospedaje|salud|m[eé]dicos?|cl[ií]nicas?|citas|bienestar|meditaci[oó]n|terapia|mascotas?|perros?|veterinari[ao]s?|farmacias?|doctor(?:es)?|nutrici[oó]n|m[uú]sica|canci[oó]n|canciones|podcasts?|playlists?|artistas?|conciertos?|reproductor|cursos?|educaci[oó]n|escuelas?|aprender|clases|estudiar|universidad|idiomas|academias?|tutor(?:es)?)\b/i;

/** Apps de trabajo con datos (lo que hace bien el Modo App): ahí no se ofrece
 *  Tinta, que da pantallas diseñadas pero no lógica. */
const APP_FUNCIONAL =
  /\b(tareas?|to-?do|kanban|gestor|gesti[oó]n de|crud|crm|erp|inventario|stock|contabilidad|facturaci[oó]n|base de datos|backoffice|panel de (?:control|administraci[oó]n|admin)|administrador de|calculadora|juego)\b/i;

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
  if (APP_FUNCIONAL.test(t) || !SECTORES_TINTA.test(t)) return false;
  if (e.imagenes > 0) return false; // una referencia visual pide otro camino
  if (SIN_PREGUNTA.test(t)) return false;
  return true;
}

export const TEXTO_OFERTA_TINTA = "¿Cómo construimos la app? Elige: diseño con la biblioteca Tinta (pantallas listas, muy pocos tokens) o app funcional con código.";
