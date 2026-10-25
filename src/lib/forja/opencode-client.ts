"use client";
/** Forja IA — Lado navegador del catálogo de OpenCode: caché, recarga y sincronización. */
import { useEffect } from "react";
import { useForja } from "./store";
import { accessCodeHeaders } from "./chat-client";
import { aplicarCatalogo, OPENCODE_FALLBACK, type OpenCodeFreeModel } from "./opencode-catalog";

export type CatalogoOpenCode = { live: boolean; models: OpenCodeFreeModel[]; fetchedAt: string };

const CLAVE_CATALOGO = "forja-opencode-catalog-v1";
const CLAVE_SYNC = "forja-opencode-synced-v1";
/** el catálogo se vuelve a pedir si lo guardado tiene más de media hora */
const TTL_MS = 30 * 60 * 1000;

function leer<T>(clave: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(clave) ?? "null") as T | null;
  } catch {
    return null;
  }
}
function guardar(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento: solo se pierde la caché */
  }
}

/** Lo último que se vio, al instante (para pintar antes de que llegue la red). */
export function catalogoGuardado(): CatalogoOpenCode | null {
  return leer<CatalogoOpenCode>(CLAVE_CATALOGO);
}

export async function cargarCatalogoOpenCode(forzar = false): Promise<CatalogoOpenCode> {
  const guardado = catalogoGuardado();
  if (!forzar && guardado?.live && Date.now() - new Date(guardado.fetchedAt).getTime() < TTL_MS) return guardado;
  try {
    const res = await fetch("/api/opencode-catalog", { headers: accessCodeHeaders(), signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as { live?: boolean; models?: OpenCodeFreeModel[]; fetchedAt?: string };
    const c: CatalogoOpenCode = {
      live: !!j.live,
      models: Array.isArray(j.models) && j.models.length ? j.models : OPENCODE_FALLBACK,
      fetchedAt: j.fetchedAt ?? new Date().toISOString(),
    };
    // solo se guarda lo vivo: la lista de emergencia no debe tapar a una buena
    if (c.live) guardar(CLAVE_CATALOGO, c);
    return c;
  } catch {
    return guardado ?? { live: false, models: OPENCODE_FALLBACK, fetchedAt: new Date().toISOString() };
  }
}

/** Mete en la lista del proveedor los gratis de hoy y quita los que dejaron de serlo. */
export function sincronizarModelos(actuales: string[], vivos: string[]): string[] {
  const r = aplicarCatalogo(actuales, leer<string[]>(CLAVE_SYNC) ?? [], vivos);
  guardar(CLAVE_SYNC, r.sincronizados);
  return r.models;
}

/** Mantiene al día el proveedor OpenCode mientras la app está abierta (al abrir y cada hora). */
export function useOpenCodeAutoSync() {
  const apiKey = useForja((s) => s.providers.opencode?.apiKey);
  const setProviderConfig = useForja((s) => s.setProviderConfig);
  useEffect(() => {
    if (!apiKey) return;
    let cancelado = false;
    const sync = async () => {
      const c = await cargarCatalogoOpenCode();
      if (cancelado || !c.live) return;
      const actuales = useForja.getState().providers.opencode?.models ?? [];
      const nuevos = sincronizarModelos(actuales, c.models.map((m) => m.id));
      if (nuevos.length !== actuales.length || nuevos.some((id, i) => id !== actuales[i])) {
        setProviderConfig("opencode", { models: nuevos });
      }
    };
    void sync();
    const t = setInterval(() => void sync(), 60 * 60 * 1000);
    return () => {
      cancelado = true;
      clearInterval(t);
    };
  }, [apiKey, setProviderConfig]);
}
