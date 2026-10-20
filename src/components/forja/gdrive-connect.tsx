"use client";
/** Forja IA — Conectar cuentas de Google Drive con Google Identity Services.
 *
 * Nada de ventana emergente propia ni de escuchar `postMessage`: GIS abre
 * y cierra su propio popup, y la promesa de `requestGoogleToken` se
 * resuelve o rechaza cuando termina. Eso también quita de en medio el
 * "redirect_uri_mismatch" que sufrió un usuario real con el flujo de
 * servidor anterior — GIS valida contra el origen (un dominio entero), no
 * contra una ruta que tenga que coincidir carácter por carácter.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { GDRIVE_SCOPE } from "@/lib/forja/gdrive-oauth";
import { requestGoogleToken } from "@/lib/forja/gdrive-gis";
import {
  GD_ACCOUNTS_EVENT,
  gdCredsSource,
  gdClearCreds,
  gdFetchAbout,
  gdGetAccounts,
  gdGetCreds,
  gdRemoveAccount,
  gdSetCreds,
  gdUpsertAccount,
  type GDriveAccount,
  type GDriveCreds,
  type GDriveCredsSource,
} from "@/lib/forja/gdrive";

export function useGdriveAccounts(): {
  accounts: GDriveAccount[];
  busy: boolean;
  connect: () => void;
  disconnect: (email: string) => void;
  refresh: () => void;
} {
  const [accounts, setAccounts] = useState<GDriveAccount[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setAccounts(gdGetAccounts());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(GD_ACCOUNTS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(GD_ACCOUNTS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
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
    const creds = gdGetCreds();
    if (!creds) {
      toast.error("Faltan las credenciales de Google", { description: "Pega tu Client ID y API Key primero." });
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        // select_account: deja elegir (o añadir) cuenta, para poder
        // conectar varias en vez de reusar siempre la misma sesión.
        const { accessToken, expiresIn } = await requestGoogleToken({
          clientId: creds.clientId,
          scope: GDRIVE_SCOPE,
          interactive: true,
        });
        const about = await gdFetchAbout(accessToken);
        const account: GDriveAccount = {
          email: about.email,
          name: about.name || about.email,
          avatar: about.avatar,
          accessToken,
          expiresAt: Date.now() + expiresIn * 1000,
          quota: about.quota,
        };
        gdUpsertAccount(account);
        refresh();
        toast.success(`Conectado: ${account.email}`);
      } catch (e) {
        toast.error("No se pudo conectar Google Drive", {
          description: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setBusy(false);
      }
    })();
  }, [refresh]);

  return { accounts, busy, connect, disconnect, refresh };
}

export interface GdriveCredsStatus {
  configured: boolean;
  source: GDriveCredsSource;
}

/** Lee las credenciales guardadas (localStorage o variables de entorno del
 * despliegue) — sin servidor de por medio, porque ninguna de las dos es
 * secreta. */
export function useGdriveCredsStatus(): {
  status: GdriveCredsStatus;
  save: (creds: GDriveCreds) => void;
  forget: () => void;
} {
  const [status, setStatus] = useState<GdriveCredsStatus>({ configured: false, source: null });

  const reload = useCallback(() => {
    const source = gdCredsSource();
    setStatus({ configured: source !== null, source });
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(GD_ACCOUNTS_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(GD_ACCOUNTS_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, [reload]);

  const save = useCallback(
    (creds: GDriveCreds) => {
      gdSetCreds(creds);
      reload();
    },
    [reload]
  );

  const forget = useCallback(() => {
    gdClearCreds();
    reload();
  }, [reload]);

  return { status, save, forget };
}
