/** Forja IA — Base de diseño para las páginas que escribe la IA.
 *
 * Las páginas «básicas» no fallan por falta de ideas sino de oficio: sin
 * escala de espaciado ni de tipografía, sin estados (hover, foco), sin modo
 * oscuro, sin las secciones que lleva una web de verdad. Esta base se le da al
 * modelo UNA vez, corta (~600 tokens), para que no la reinvente en cada web:
 *  · los tokens de diseño (escala de texto, espaciado, radios, sombras,
 *    movimiento, colores claro/oscuro), tomados de Astryx, el sistema de
 *    diseño de Meta (https://github.com/meta/astryx, licencia MIT; aviso en
 *    THIRD_PARTY_NOTICES.md), reducidos a HTML/CSS plano;
 *  · una lista de los detalles que suelen faltar.
 *
 * Solo se añade cuando se construye una página (no en retoques ni charlas), así
 * que no cuesta tokens donde no hace falta. */

/** Tokens listos para pegar en un `<style>`. La IA cambia `--color-accent` (y lo
 *  que necesite) por la marca del negocio; el resto da el oficio de base. */
export const ASTRYX_TOKENS_CSS = `:root{color-scheme:light dark;
--color-bg:light-dark(#f1f1f1,#1b1b1b);--color-card:light-dark(#fff,#262626);--color-text:light-dark(#000,#fff);--color-text-2:light-dark(#474747,#c6c6c6);--color-border:light-dark(#00000014,#ffffff1a);--color-accent:light-dark(#1b1b1b,#f1f1f1);--color-on-accent:light-dark(#fff,#1b1b1b);
--text-sm:.75rem;--text-base:.875rem;--text-lg:1.0625rem;--text-xl:1.25rem;--text-2xl:1.5rem;--text-3xl:1.8125rem;--text-4xl:2.1875rem;--text-5xl:2.625rem;
--space-1:.25rem;--space-2:.5rem;--space-3:.75rem;--space-4:1rem;--space-6:1.5rem;--space-8:2rem;--space-12:3rem;--space-16:4rem;
--radius-inner:.375rem;--radius-element:.625rem;--radius-container:.75rem;--radius-page:1.75rem;--radius-full:9999px;
--shadow-low:0 2px 4px #0000000d,0 4px 8px #0000001a;--shadow-med:0 2px 4px #0000000d,0 4px 12px #0000001a;--shadow-high:0 4px 6px #0000001a,0 12px 24px #00000026;
--dur-fast:125ms;--dur-med:300ms;--dur-slow:700ms;--ease:cubic-bezier(.2,0,0,1)}`;

/** Lo que suele faltar en una web «básica». Corto a propósito. */
export const DETALLES_WEB = [
  "Estructura completa: cabecera fija, portada con una sola acción clara, prueba social (opiniones/cifras), secciones de valor, precios o menú, preguntas frecuentes, llamada a la acción final y pie con contacto, horario, redes y aviso legal.",
  "Textos reales del negocio, nunca «lorem ipsum»; si falta un dato (teléfono, dirección, precio), déjalo como «Pendiente: …» visible, no lo inventes.",
  "Cada elemento interactivo con estados: hover, :focus-visible (aro de 2px), active y disabled. Objetivos táctiles ≥ 44 px.",
  "Mobile-first: sin scroll horizontal a 360 px, rejillas que se apilan, imágenes con aspect-ratio y loading=lazy, alt descriptivo.",
  "Contraste ≥ 4,5:1 (texto sobre imagen, con capa oscura); jerarquía con la escala de texto, máximo dos familias, líneas ≤ 70 caracteres.",
  "Ritmo vertical con la escala de espaciado (--space-*): mismas separaciones entre secciones, nada a ojo.",
  "Movimiento sutil con --dur-* y --ease; respeta prefers-reduced-motion. Modo claro y oscuro con light-dark().",
  "Formularios con label, validación y mensaje de éxito/error; autocomplete correcto. Estados vacío, cargando y error si hay datos dinámicos.",
  "Meta: lang, title, description, Open Graph, favicon (data URI) y JSON-LD (LocalBusiness/Restaurant/Product) si aplica.",
] as const;

/** El bloque que se añade al prompt al construir una página. */
export function astryxPrompt(): string {
  return [
    "[BASE DE DISEÑO — oficio mínimo de toda página]",
    "Empieza el <style> con estos tokens (de Astryx, MIT) y úsalos en vez de números sueltos; cambia solo --color-accent y lo que pida la marca:",
    ASTRYX_TOKENS_CSS,
    "Que no falte:",
    ...DETALLES_WEB.map((d) => `- ${d}`),
  ].join("\n");
}
