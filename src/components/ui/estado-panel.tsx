"use client";
/** Forja IA — EstadoPanel: el estado de un panel, dibujado igual en todos lados.
 *
 * Componente hermano de la config pura `lib/forja/estados.ts` (allí viven los
 * roles ARIA y los títulos por defecto, probados; aquí solo el dibujo). Un
 * panel que carga, falla o queda vacío YA NO puede inventarse su propio
 * spinner: manda esta pieza, y el lector de pantalla se entera igual que tú.
 *
 * Los colores vienen de los tokens semánticos de `lib/design-tokens.ts`
 * (auditados contra WCAG AA): el rojo del error es el mismo rojo que miden los
 * tests de contraste, no un rojo suelto de la jornada.
 */
import type { ComponentType, ReactNode } from "react";
import { Inbox, Loader2, TriangleAlert, type LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  accesibilidadEstado,
  admiteAccion,
  tituloPorDefecto,
  type EstadoVariante,
} from "@/lib/forja/estados";

export interface AccionPanel {
  etiqueta: string;
  alPulsar: () => void;
}

interface EstadoPanelProps {
  variante: EstadoVariante;
  /** sobreescribe el título por defecto de la variante */
  titulo?: string;
  /** el «por qué» y, cuando se sabe, el «qué hacer» */
  descripcion?: ReactNode;
  /** botón único de acción (p. ej. Reintentar). Solo en error/vacío */
  accion?: AccionPanel;
  /** versión densa para cabeceras y filas */
  compacto?: boolean;
  className?: string;
}

const ICONOS: Record<EstadoVariante, ComponentType<LucideProps>> = {
  cargando: Loader2,
  error: TriangleAlert,
  vacio: Inbox,
};

const COLOR_ICONO: Record<EstadoVariante, string> = {
  cargando: "text-muted-foreground",
  // tokens semánticos auditados (ver design-tokens.ts): peligro y aviso
  error: "text-red-600 dark:text-red-400",
  vacio: "text-muted-foreground/70",
};

export function EstadoPanel({
  variante,
  titulo,
  descripcion,
  accion,
  compacto = false,
  className,
}: EstadoPanelProps) {
  const a11y = accesibilidadEstado(variante);
  const Icono = ICONOS[variante];
  const texto = titulo ?? tituloPorDefecto(variante);

  return (
    <div
      role={a11y.rol ?? undefined}
      aria-live={a11y.ariaLive ?? undefined}
      className={cn(
        "flex min-w-0 flex-col items-center justify-center gap-2 text-center",
        compacto ? "gap-1 py-4" : "py-10",
        className
      )}
    >
      <Icono
        className={cn(COLOR_ICONO[variante], compacto ? "size-5" : "size-8", variante === "cargando" && "animate-spin")}
        aria-hidden="true"
      />
      <p className={cn("font-medium", compacto ? "text-xs" : "text-sm")}>{texto}</p>
      {descripcion && (
        <p className="max-w-sm text-xs text-muted-foreground">{descripcion}</p>
      )}
      {accion && admiteAccion(variante) && (
        <button
          type="button"
          onClick={accion.alPulsar}
          className="mt-1 inline-flex h-8 items-center rounded-md border border-border/60 bg-card/60 px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {accion.etiqueta}
        </button>
      )}
    </div>
  );
}
