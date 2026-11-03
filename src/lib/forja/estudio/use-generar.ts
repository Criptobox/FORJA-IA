"use client";
/** FORJA IA — Estudio de diseño: el hook que genera pantallas.
 *
 * Orquesta: prompt → modelo (con failover) → extraer HTML → nueva versión.
 * Las pantallas se generan de una en una (cola): con modelos gratis, pedir
 * seis a la vez solo consigue seis errores de cuota. Lo que se lleva escrito
 * se pinta en vivo (`parciales`), sin tocar el almacenamiento hasta el final. */

import { useCallback, useRef, useState } from "react";
import { codigoParaEditar, extraerPantalla, htmlParcial } from "./html";
import { pedirAlModelo } from "./generador";
import {
  pedidoCorregir,
  pedidoIterar,
  pedidoPantalla,
  pedidoVariante,
  leerPlan,
  promptPlan,
  promptSistema,
} from "./prompts";
import { actualizarPantalla, conNuevaVersion, direccionDe, versionActual } from "./proyecto";
import { useEstudio } from "./store";
import { bloqueReferencias, referenciasDe } from "./biblioteca";
import { imagenDe, useBiblioteca } from "./biblioteca-store";
import { visionPorNombre } from "../capacidades";
import { isAutoKey, splitModelKey } from "../types";
import type { PantallaPlan, TipoProyecto } from "./tipos";

export type ModoGeneracion =
  | { tipo: "nueva" }
  | { tipo: "iterar"; cambio: string }
  | { tipo: "variante" }
  | { tipo: "corregir"; problemas: string[] };

const ETIQUETA: Record<ModoGeneracion["tipo"], string> = {
  nueva: "Generada",
  iterar: "Cambio",
  variante: "Variante",
  corregir: "Corrección",
};

function esAbort(e: unknown): boolean {
  return e instanceof DOMException ? e.name === "AbortError" : /abort/i.test(String((e as Error)?.message ?? e));
}

export function useGenerar(modeloKey: string | null) {
  const [parciales, setParciales] = useState<Record<string, string>>({});
  const [modelos, setModelos] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const colaRef = useRef<Promise<void>>(Promise.resolve());

  const detener = useCallback(() => abortRef.current?.abort(), []);

  const planificar = useCallback(
    async (brief: string, tipo: TipoProyecto): Promise<PantallaPlan[]> => {
      const ac = new AbortController();
      abortRef.current = ac;
      setOcupado(true);
      try {
        const r = await pedirAlModelo({
          sistema: "Eres un diseñador de producto. Respondes solo con la lista pedida, sin introducción.",
          usuario: promptPlan(brief, tipo),
          modeloKey,
          signal: ac.signal,
          maxTokens: 800,
        });
        return leerPlan(r.texto, tipo);
      } finally {
        setOcupado(false);
        abortRef.current = null;
      }
    },
    [modeloKey]
  );

  const generarUna = useCallback(
    async (proyectoId: string, pantallaId: string, modo: ModoGeneracion, ac: AbortController) => {
      const st = useEstudio.getState();
      const p = st.proyectos.find((x) => x.id === proyectoId);
      const s = p?.pantallas.find((x) => x.id === pantallaId);
      if (!p || !s) return;
      const d = direccionDe(p);
      const v = versionActual(s);
      const codigo = v ? codigoParaEditar(v) : "";
      const usuario =
        modo.tipo === "nueva" || !v
          ? pedidoPantalla(p, s)
          : modo.tipo === "iterar"
            ? pedidoIterar(s, codigo, modo.cambio)
            : modo.tipo === "variante"
              ? pedidoVariante(p, s, codigo)
              : pedidoCorregir(s, codigo, modo.problemas);

      st.cambiar(proyectoId, (pp) =>
        actualizarPantalla(pp, pantallaId, (x) => ({ ...x, estado: "generando", error: undefined }))
      );
      // Referencias de la Biblioteca: como texto siempre; como imágenes solo
      // si el modelo elegido parece ver (o con Auto, que ordena por visión).
      const refs = referenciasDe(p.referencias, useBiblioteca.getState().referencias).slice(0, 4);
      const elegido = modeloKey && !isAutoKey(modeloKey) ? splitModelKey(modeloKey) : null;
      const adjuntar = refs.length > 0 && (!elegido || visionPorNombre(elegido.modelId));
      const imagenes = adjuntar
        ? (await Promise.all(refs.map(async (x) => ({ nombre: x.nombre, dataUrl: (await imagenDe(x)) ?? "" })))).filter((x) => x.dataUrl)
        : [];
      try {
        const r = await pedirAlModelo({
          sistema: promptSistema(p, d, bloqueReferencias(refs, imagenes.length)),
          imagenes,
          usuario,
          modeloKey,
          signal: ac.signal,
          onTexto: (t) => setParciales((m) => ({ ...m, [pantallaId]: htmlParcial(t) })),
          onModelo: (k) => setModelos((m) => ({ ...m, [pantallaId]: k })),
        });
        const ext = extraerPantalla(r.texto);
        useEstudio.getState().cambiar(proyectoId, (pp) =>
          actualizarPantalla(pp, pantallaId, (x) =>
            ext
              ? conNuevaVersion(x, {
                  pedido: modo.tipo === "iterar" ? `${ETIQUETA.iterar}: ${modo.cambio}` : ETIQUETA[modo.tipo],
                  archivos: ext.archivos,
                  entrada: ext.entrada,
                  modelo: r.modelKey,
                })
              : { ...x, estado: x.versiones.length ? "lista" : "error", error: "El modelo no devolvió HTML. Prueba otra vez u otro modelo." }
          )
        );
      } catch (e) {
        const cancelado = esAbort(e);
        useEstudio.getState().cambiar(proyectoId, (pp) =>
          actualizarPantalla(pp, pantallaId, (x) => ({
            ...x,
            estado: x.versiones.length ? "lista" : cancelado ? "vacia" : "error",
            error: cancelado ? undefined : e instanceof Error ? e.message : String(e),
          }))
        );
        if (cancelado) throw e;
      } finally {
        setParciales((m) => {
          const { [pantallaId]: _fuera, ...resto } = m;
          return resto;
        });
      }
    },
    [modeloKey]
  );

  /** Encola una o varias pantallas; se generan de una en una. */
  const generar = useCallback(
    (proyectoId: string, pantallaIds: string[], modo: ModoGeneracion = { tipo: "nueva" }) => {
      if (!pantallaIds.length) return colaRef.current;
      colaRef.current = colaRef.current.then(async () => {
        const ac = new AbortController();
        abortRef.current = ac;
        setOcupado(true);
        // marcar todas como en cola desde el principio: se ve qué viene
        try {
          for (const id of pantallaIds) {
            if (ac.signal.aborted) break;
            await generarUna(proyectoId, id, modo, ac);
          }
        } catch {
          /* cancelado: el resto de la cola no se genera */
        } finally {
          setOcupado(false);
          abortRef.current = null;
        }
      });
      return colaRef.current;
    },
    [generarUna]
  );

  return { parciales, modelos, ocupado, planificar, generar, detener };
}
