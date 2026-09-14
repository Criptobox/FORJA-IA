/** Prism AI — Cuando el encargo es una tienda, menú o catálogo: exige que
 * de verdad SE PUEDA comprar o pedir, no solo enseñar productos en una foto.
 *
 * Reportado por el usuario: al pedir una tienda o un menú de restaurante,
 * la página salía "a medias" — bonita, pero con un carrito decorativo y
 * botones de "Pedir" sin acción. La causa: la skill de desarrollador web
 * (`skills-data.ts`) solo pide una página responsive con animaciones y
 * hover — nada dice que el carrito tenga que sumar de verdad, que una
 * tarjeta de producto lleve a su detalle, o que un botón de pedir tenga
 * que hacer algo. Sin esa instrucción explícita, el modelo entrega la
 * landing estática que ya sabe hacer, no la app funcional que se pidió.
 *
 * Esto detecta esa intención y añade la instrucción que falta — SOLO
 * cuando el encargo es de este tipo: una carta de presentación o un
 * blog no necesitan carrito ni reseñas, y pedírselo sería ruido.
 */

const SENALES =
  /\b(tienda|ecommerce|e-commerce|carrito|cat[áa]logo|men[úu] (de|del)?|carta de platos|restaurante|cafeter[íi]a|delivery|a domicilio|marketplace|reservas?|pedidos?|checkout)\b/i;

/** ¿El encargo pide una tienda, menú o catálogo — algo que se compra o pide? */
export function esEncargoDeTiendaOCatalogo(prompt: string): boolean {
  const t = prompt ?? "";
  if (!t.trim()) return false;
  return SENALES.test(t);
}

/** La instrucción que exige funcionalidad real, no solo la vista. Se añade
 * como AMPLIACIÓN de la skill de desarrollador web, no como su sustituta. */
export const INSTRUCCION_TIENDA_INTERACTIVA = `### Esto es una tienda, menú o catálogo: tiene que FUNCIONAR, no solo enseñarse
No basta con una landing bonita con fotos de productos. El HTML debe incluir,
con JavaScript real (estado en variables o localStorage, sin backend):
- Al menos 6-8 productos/platos reales del rubro del encargo, cada uno con
  nombre, precio, descripción corta e imagen (emoji grande, SVG propio o
  gradiente — nunca una URL externa que pueda no cargar).
- Cada tarjeta de producto es CLICABLE: abre una vista de detalle (modal o
  sección) con descripción ampliada, ingredientes/especificaciones si
  aplica, precio, y también se puede añadir al carrito desde ahí.
- Un carrito de verdad: icono con contador de artículos, panel/drawer que
  lista lo añadido con cantidad (+/-) y botón quitar, subtotal y total que
  se recalculan al momento.
- Un flujo de pedido/checkout que TERMINA: al confirmar, se muestra una
  confirmación real (número de pedido, resumen, próximos pasos) — nunca un
  botón decorativo sin acción.
- Una sección de reseñas/valoraciones con ejemplos realistas (nombre,
  estrellas, comentario) — por producto si aplica, o generales del negocio.
Todo esto con \`addEventListener\` de verdad, no \`href="#"\` ni botones sin
manejador. Si algo de esto queda a medias, el encargo no está terminado.`;
