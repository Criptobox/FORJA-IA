/** FORJA IA — Estudio de diseño: almacén de la Biblioteca.
 *
 * Lo ligero (nombre, paleta, origen) en localStorage con zustand; la imagen
 * en IndexedDB (`attachment-blob.ts`, el mismo almacén que los adjuntos del
 * chat), que no tiene el tope de unos pocos MB de localStorage. */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { deleteBlob, getBlob, putBlob } from "../attachment-blob";
import { safeLocalStorage } from "../store";
import { idEstudio } from "./proyecto";
import type { OrigenReferencia, Referencia } from "./tipos";

export const MAX_REFERENCIAS = 120;

export interface NuevaReferencia {
  nombre: string;
  origen: OrigenReferencia;
  dataUrl: string;
  paleta: string[];
  ancho?: number;
  alto?: number;
  proyectoId?: string;
}

interface EstadoBiblioteca {
  referencias: Referencia[];
  /** guarda la imagen y la referencia; false si IndexedDB no aceptó la imagen */
  agregar: (n: NuevaReferencia) => Promise<Referencia | null>;
  renombrar: (id: string, nombre: string) => void;
  borrar: (id: string) => Promise<void>;
}

export const useBiblioteca = create<EstadoBiblioteca>()(
  persist(
    (set, get) => ({
      referencias: [],
      agregar: async (n) => {
        const id = idEstudio("ref");
        const ok = await putBlob(id, n.dataUrl);
        if (!ok) return null;
        const r: Referencia = {
          id,
          nombre: n.nombre.trim() || "Referencia",
          origen: n.origen,
          paleta: n.paleta,
          blobId: id,
          ancho: n.ancho,
          alto: n.alto,
          creada: Date.now(),
          proyectoId: n.proyectoId,
        };
        const todas = [r, ...get().referencias];
        // Si se pasa del tope, las más viejas salen y su imagen también.
        for (const vieja of todas.slice(MAX_REFERENCIAS)) void deleteBlob(vieja.blobId);
        set({ referencias: todas.slice(0, MAX_REFERENCIAS) });
        return r;
      },
      renombrar: (id, nombre) =>
        set((s) => ({ referencias: s.referencias.map((r) => (r.id === id ? { ...r, nombre } : r)) })),
      borrar: async (id) => {
        const r = get().referencias.find((x) => x.id === id);
        set((s) => ({ referencias: s.referencias.filter((x) => x.id !== id) }));
        if (r) await deleteBlob(r.blobId);
      },
    }),
    { name: "forja-estudio-biblioteca-v1", version: 1, storage: createJSONStorage(safeLocalStorage) }
  )
);

/** Imagen (data URL) de una referencia, o null si ya no está en IndexedDB. */
export function imagenDe(r: Pick<Referencia, "blobId">): Promise<string | null> {
  return getBlob(r.blobId);
}
