/** Forja IA — Estados compartidos: cargando, error y vacío, con sus reglas a11y.
 *
 * Antes de esto cada panel pintaba su «cargando…» a su manera: un spinner aquí,
 * tres puntos allá, y el lector de pantalla enterándose de la mitad. Este
 * módulo fija la CONFIGURACIÓN (qué role y aria-live lleva cada estado y qué
 * título por defecto) y `ui/estado-panel.tsx` la dibuja. La separación no es
 * capricho: la config es pura y se prueba en vitest; el dibujo se prueba en e2e.
 *
 * Regla a11y (que no es negociable):
 *  - «cargando» → role="status" + aria-live="polite": se anuncia sin gritar.
 *  - «error»    → role="alert": sí interrumpe, un error no puede pasar de largo.
 *  - «vacío»    → nada de roles: es contenido visible, no un aviso. Un panel
 *    vacío anunciado a los cuatro vientos es ruido para quien usa lector.
 */
export type EstadoVariante = "cargando" | "error" | "vacio";

export interface AccesibilidadEstado {
  /** role ARIA del contenedor, o null si el estado no debe anunciarse */
  rol: "status" | "alert" | null;
  /** aria-live del contenedor, o null (siempre acompaña a rol) */
  ariaLive: "polite" | "assertive" | null;
}

/** Los roles de cada variante, decididos una vez y probados. */
export function accesibilidadEstado(variante: EstadoVariante): AccesibilidadEstado {
  switch (variante) {
    case "cargando":
      return { rol: "status", ariaLive: "polite" };
    case "error":
      // «assertive» + alert: quien usa lector no se pierde un fallo, pero
      // tampoco se encadena con otros avisos pendientes
      return { rol: "alert", ariaLive: "assertive" };
    case "vacio":
      return { rol: null, ariaLive: null };
  }
}

/** Título por defecto por variante. Cada panel puede sobreescribirlo con
 *  contexto real («Sin modelos conectados») — el default existe para que el
 *  olvido no se pinte como un hueco mudo. */
export function tituloPorDefecto(variante: EstadoVariante): string {
  switch (variante) {
    case "cargando":
      return "Cargando…";
    case "error":
      return "Algo falló";
    case "vacio":
      return "Nada por aquí todavía";
  }
}

/** ¿La variante ofrece botón de acción? El error casi siempre quiere
 *  «Reintentar»; cargando nunca (no hay nada que reintentar a mitad de carga). */
export function admiteAccion(variante: EstadoVariante): boolean {
  return variante !== "cargando";
}
