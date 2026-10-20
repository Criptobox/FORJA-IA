/** Forja IA — Arregla la tipificación de `@googleworkspace/drive-picker-element`.
 *
 * El paquete registra sus elementos personalizados (`<drive-picker>`,
 * `<drive-picker-docs-view>`) con `declare global { namespace JSX {...} }`
 * — el patrón de ANTES de React 19. Con `@types/react` 19 y
 * `"jsx": "react-jsx"`, TypeScript comprueba el JSX contra
 * `React.JSX.IntrinsicElements`, no contra el `JSX` global suelto, así que
 * esa declaración del paquete no llega a fundirse con nada y
 * `<drive-picker>` sale como "no existe" (verificado a mano: sin este
 * archivo, `tsc` falla con TS2339 en cualquier archivo que use el tag).
 *
 * Aquí se redeclaran los mismos dos elementos, con las mismas props del
 * paquete, pero en el sitio que React 19 sí mira.
 */
import type { DrivePickerDocsViewElementProps, DrivePickerElement, DrivePickerElementProps } from "@googleworkspace/drive-picker-element";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "drive-picker": DrivePickerElementProps & {
        ref?: React.RefObject<DrivePickerElement | null>;
        children?: React.ReactNode;
      };
      "drive-picker-docs-view": DrivePickerDocsViewElementProps;
    }
  }
}
