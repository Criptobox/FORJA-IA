/** Teclado de un grupo de radio (patrón WAI-ARIA «radio group»).
 *
 * Un `role="radiogroup"` promete flechas: ←/↑ y →/↓ mueven y eligen, Inicio y
 * Fin saltan a los extremos, y Tab entra y sale del grupo en una sola parada
 * (solo el elegido es tabulable). Devuelve el índice nuevo, o null si la
 * tecla no es del grupo y debe seguir su camino. */
export function indiceRadioTrasTecla(tecla: string, actual: number, total: number): number | null {
  if (total <= 0) return null;
  const i = actual < 0 ? 0 : actual;
  switch (tecla) {
    case "ArrowRight":
    case "ArrowDown":
      return (i + 1) % total;
    case "ArrowLeft":
    case "ArrowUp":
      return (i - 1 + total) % total;
    case "Home":
      return 0;
    case "End":
      return total - 1;
    default:
      return null;
  }
}

/** Manejador listo para el `onKeyDown` del contenedor `role="radiogroup"`:
 * elige la opción nueva y le pasa el foco. */
export function teclasDeRadio<T>(
  e: React.KeyboardEvent<HTMLElement>,
  opciones: readonly T[],
  actual: number,
  elegir: (v: T) => void
): void {
  const j = indiceRadioTrasTecla(e.key, actual, opciones.length);
  if (j === null) return;
  e.preventDefault();
  elegir(opciones[j]);
  e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[j]?.focus();
}
