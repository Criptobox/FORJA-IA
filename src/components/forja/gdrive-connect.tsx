"use client";
/** Forja IA — Conectar cuentas de Google Drive (OAuth, un clic por cuenta).
 * A diferencia de GitHub, Google no registra una app automáticamente: hace
 * falta un Client ID / Secret creado por la propia persona en su Google
 * Cloud (gratis) — ver `GDriveCredsForm` más abajo. */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { accessCodeHeaders } from "@/lib/forja/chat-client";
import { GD_OAUTH_MSG } from "@/lib/forja/gdrive-oauth";
import { GD_ACCOUNTS_EVENT, gdGetAccounts, gdRemoveAccount, gdUpsertAccount, type GDriveAccount } from "@/lib/forja/gdrive";

export function useGdriveAccounts(): {
  accounts: GDriveAccount[];
  busy: boolean;
  connect: () => void;
  disconnect: (email: string) => void;
  refresh: () => void;
} {
  const [accounts, setAccounts] = useState<GDriveAccount[]>([]);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<number | null>(null);
  const gotMessageRef = useRef(false);

  const refresh = useCallback(() => {
    setAccounts(gdGetAccounts());
  }, []);

  useEffect(() => {
    refresh();
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as {
        type?: string;
        accessToken?: string;
        refreshToken?: string;
        expiresIn?: number;
        email?: string;
        name?: string;
        avatar?: string;
        quota?: GDriveAccount["quota"];
        error?: string;
      };
      if (!d || d.type !== GD_OAUTH_MSG) return;
      gotMessageRef.current = true;
      setBusy(false);
      if (d.error) {
        const hint = /redirect_uri/i.test(d.error)
          ? ` Revisa que el URI de redirección en Google Cloud sea EXACTO: ${window.location.origin}/api/gdrive/oauth/callback`
          : "";
        toast.error("No se pudo conectar Google Drive", { description: d.error + hint, duration: 12000 });
        return;
      }
      if (!d.accessToken || !d.email) return;
      const account: GDriveAccount = {
        email: d.email,
        name: d.name || d.email,
        avatar: d.avatar || "",
        accessToken: d.accessToken,
        refreshToken: d.refreshToken || "",
        expiresAt: Date.now() + (d.expiresIn ?? 3600) * 1000,
        quota: d.quota ?? { limit: null, usage: 0, usageInDrive: 0 },
      };
      gdUpsertAccount(account);
      refresh();
      toast.success(`Conectado: ${account.email}`);
    };
    const onEv = () => refresh();
    window.addEventListener("message", onMsg);
    window.addEventListener(GD_ACCOUNTS_EVENT, onEv);
    window.addEventListener("storage", onEv);
    return () => {
      window.removeEventListener("message", onMsg);
      window.removeEventListener(GD_ACCOUNTS_EVENT, onEv);
      window.removeEventListener("storage", onEv);
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [refresh]);

  const disconnect = useCallback(
    (email: string) => {
      gdRemoveAccount(email);
      refresh();
      toast.info("Cuenta de Google Drive desconectada");
    },
    [refresh]
  );

  const connect = useCallback(() => {
    setBusy(true);
    gotMessageRef.current = false;
    const url = "/api/gdrive/oauth/start";
    const w = window.open(url, "forja-gdrive", "popup=yes,width=620,height=740") || window.open(url, "_blank");
    if (!w) {
      setBusy(false);
      toast.error("Permite ventanas emergentes para conectar Google Drive");
      return;
    }
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => {
      if (w.closed) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
        setBusy(false);
        // Si la ventana se cerró sin que llegara ni éxito ni error, lo más
        // probable es que Google haya cortado el flujo ANTES de volver a
        // Forja (por ejemplo "redirect_uri_mismatch": el URI que registraste
        // en Google Cloud no es carácter por carácter igual al de aquí).
        if (!gotMessageRef.current) {
          const uri = `${window.location.origin}/api/gdrive/oauth/callback`;
          toast.error("La ventana se cerró sin conectar", {
            description: `Revisa que el URI de redirección en Google Cloud sea EXACTO: ${uri}`,
            duration: 12000,
          });
        }
      }
    }, 500);
  }, []);

  return { accounts, busy, connect, disconnect, refresh };
}

export interface GdriveCredsStatus {
  configured: boolean;
  source: "env" | "cookie" | null;
}

/** Consulta si ya hay Client ID/Secret guardados (env del despliegue o
 * cookie pegada a mano) sin exponer el secret al cliente. */
export function useGdriveCredsStatus(): {
  status: GdriveCredsStatus | null;
  reload: () => void;
  forget: () => Promise<void>;
} {
  const [status, setStatus] = useState<GdriveCredsStatus | null>(null);
  const reload = useCallback(() => {
    void fetch("/api/gdrive/oauth/creds", { headers: accessCodeHeaders() })
      .then((r) => r.json())
      .then((j: GdriveCredsStatus) => setStatus(j))
      .catch(() => setStatus({ configured: false, source: null }));
  }, []);
  useEffect(() => reload(), [reload]);

  const forget = useCallback(async () => {
    await fetch("/api/gdrive/oauth/creds", { method: "DELETE", headers: accessCodeHeaders() });
    reload();
  }, [reload]);

  return { status, reload, forget };
}
