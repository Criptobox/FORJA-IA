/** La versión de navegador del compilador de Vue (la que usa el Sandbox,
 *  `sandbox-moderno.ts`) tiene la misma API que el paquete: sin esto,
 *  TypeScript no sabe que esa ruta profunda existe. */
declare module "@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js" {
  export * from "@vue/compiler-sfc";
}
