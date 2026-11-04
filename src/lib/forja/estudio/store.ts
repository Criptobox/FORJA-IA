/** FORJA IA — Estudio de diseño: almacén de proyectos (persistente).
 *
 * Mismo patrón que el resto de FORJA: zustand + localStorage blindado contra
 * cuota (`safeLocalStorage`). Las operaciones son las puras de `proyecto.ts`. */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeLocalStorage } from "../store";
import { crearProyecto, type NuevoProyecto } from "./proyecto";
import type { ProyectoDiseno } from "./tipos";
import { MAX_VOTOS, type VotoGusto } from "./gustos";

/** Proyectos que se conservan (los más recientes). */
export const MAX_PROYECTOS = 30;

interface EstadoEstudio {
  proyectos: ProyectoDiseno[];
  activoId: string | null;
  crear: (n: NuevoProyecto) => ProyectoDiseno;
  /** aplica un cambio puro al proyecto `id` */
  cambiar: (id: string, f: (p: ProyectoDiseno) => ProyectoDiseno) => void;
  borrar: (id: string) => void;
  abrir: (id: string | null) => void;
  /** votos de gusto por id de versión (memoria de gustos, `gustos.ts`) */
  gustos: Record<string, VotoGusto>;
  /** vota una versión; `null` quita el voto */
  votar: (versionId: string, voto: VotoGusto | null) => void;
  olvidarGustos: () => void;
}

export const useEstudio = create<EstadoEstudio>()(
  persist(
    (set, get) => ({
      proyectos: [],
      activoId: null,
      crear: (n) => {
        const evitar = get().proyectos.slice(0, 3).map((p) => p.direccionId);
        const p = crearProyecto({ ...n, evitar: n.evitar ?? evitar });
        set((s) => ({ proyectos: [p, ...s.proyectos].slice(0, MAX_PROYECTOS), activoId: p.id }));
        return p;
      },
      cambiar: (id, f) =>
        set((s) => ({ proyectos: s.proyectos.map((p) => (p.id === id ? f(p) : p)) })),
      borrar: (id) =>
        set((s) => ({
          proyectos: s.proyectos.filter((p) => p.id !== id),
          activoId: s.activoId === id ? null : s.activoId,
        })),
      abrir: (id) => set({ activoId: id }),
      gustos: {},
      votar: (versionId, voto) =>
        set((s) => {
          const g = { ...s.gustos };
          if (voto) g[versionId] = voto;
          else delete g[versionId];
          // solo los más recientes: el gusto cambia y localStorage no es infinito
          const recientes = Object.entries(g)
            .sort((a, b) => b[1].cuando - a[1].cuando)
            .slice(0, MAX_VOTOS);
          return { gustos: Object.fromEntries(recientes) };
        }),
      olvidarGustos: () => set({ gustos: {} }),
    }),
    {
      name: "forja-estudio-v1",
      version: 1,
      storage: createJSONStorage(safeLocalStorage),
      // Una pantalla que se estaba generando cuando se cerró la pestaña no
      // sigue generándose: al volver queda como estaba o como error recuperable.
      merge: (guardado, actual) => {
        const g = (guardado ?? {}) as Partial<EstadoEstudio>;
        const proyectos = (g.proyectos ?? []).map((p) => ({
          ...p,
          pantallas: p.pantallas.map((s) =>
            s.estado === "generando"
              ? s.versiones.length
                ? { ...s, estado: "lista" as const, error: undefined }
                : { ...s, estado: "error" as const, error: "Se interrumpió al cerrar la página" }
              : s
          ),
        }));
        return { ...actual, ...g, proyectos };
      },
    }
  )
);

export function proyectoActivo(s: Pick<EstadoEstudio, "proyectos" | "activoId">): ProyectoDiseno | null {
  return s.proyectos.find((p) => p.id === s.activoId) ?? null;
}
