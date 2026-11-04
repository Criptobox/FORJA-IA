"use client";
/** FORJA IA — Estudio de diseño: el hook que genera pantallas.
 *
 * Orquesta: prompt → modelo (con failover) → extraer HTML → nueva versión.
 * Las pantallas se generan de una en una (cola): con modelos gratis, pedir
 * seis a la vez solo consigue seis errores de cuota. Lo que se lleva escrito
 * se pinta en vivo (`parciales`), sin tocar el almacenamiento hasta el final. */

import { useCallback, useRef, useState } from "react";
import { codigoParaEditar, extraerPantalla, htmlDeVersion, htmlParcial } from "./html";
import { criticar } from "./critica";
import { bloqueGustos } from "./gustos";
import { necesitaRevision, PEDIDO_REVISION, problemasDeRevision } from "./revisor";
import { skillsDePantalla } from "./skills";
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
  | { tipo: "corregir"; problemas: string[]; /** la pidió el revisor, no la persona */ automatica?: boolean };

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
    async (brief: string, tipo: TipoProyecto, cuantas?: number): Promise<PantallaPlan[]> => {
      const ac = new AbortController();
      abortRef.current = ac;
      setOcupado(true);
      try {
        const r = await pedirAlModelo({
          sistema: "Eres un diseñador de producto. Respondes solo con la lista pedida, sin introducción.",
          usuario: promptPlan(brief, tipo, cuantas),
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
    /** Genera una versión. Devuelve los problemas que el revisor quiere
     * corregir (o null si la pantalla salió bien o no toca revisar). */
    async (proyectoId: string, pantallaId: string, modo: ModoGeneracion, ac: AbortController): Promise<string[] | null> => {
      const st = useEstudio.getState();
      const p = st.proyectos.find((x) => x.id === proyectoId);
      const s = p?.pantallas.find((x) => x.id === pantallaId);
      if (!p || !s) return null;
      // la memoria de gustos: una línea, y solo en lo que se diseña de cero
      const gustos = bloqueGustos(Object.values(st.gustos));
      const d = direccionDe(p);
      const v = versionActual(s);
      const codigo = v ? codigoParaEditar(v) : "";
      const usuario =
        modo.tipo === "nueva" || !v
          ? pedidoPantalla(p, s, gustos)
          : modo.tipo === "iterar"
            ? pedidoIterar(s, codigo, modo.cambio)
            : modo.tipo === "variante"
              ? pedidoVariante(p, s, codigo, gustos)
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
                  pedido:
                    modo.tipo === "iterar"
                      ? `${ETIQUETA.iterar}: ${modo.cambio}`
                      : modo.tipo === "corregir" && modo.automatica
                        ? PEDIDO_REVISION
                        : ETIQUETA[modo.tipo],
                  archivos: ext.archivos,
                  entrada: ext.entrada,
                  modelo: r.modelKey,
                })
              : { ...x, estado: x.versiones.length ? "lista" : "error", error: "El modelo no devolvió HTML. Prueba otra vez u otro modelo." }
          )
        );
        // El revisor: solo lo recién diseñado (nueva o variante), nunca una
        // corrección (así no hay bucle), y solo si la crítica —que no gasta
        // tokens— encuentra fallos que merezcan una llamada.
        if (ext && (modo.tipo === "nueva" || modo.tipo === "variante") && p.revisarAntes !== false) {
          const html = htmlDeVersion(ext, d);
          const c = criticar(html, skillsDePantalla(s, p.tipo), p.tipo);
          if (necesitaRevision(c)) return problemasDeRevision(c);
        }
        return null;
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
        return null;
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
            const problemas = await generarUna(proyectoId, id, modo, ac);
            // una sola pasada de corrección, con la lista corta del revisor
            if (problemas?.length && !ac.signal.aborted) {
              await generarUna(proyectoId, id, { tipo: "corregir", problemas, automatica: true }, ac);
            }
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
