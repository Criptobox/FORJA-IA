"use client";
/** Forja IA — "Elegir en Drive": el selector visual oficial de Google
 * (`@googleworkspace/drive-picker-element`) en vez de la lista plana de
 * "archivos recientes". Reutiliza el token que ya tiene la cuenta (sin
 * pedir permiso otra vez) y deja elegir carpetas o archivos concretos con
 * la UI real de Drive.
 *
 * Usa el elemento personalizado en crudo, no el envoltorio de React del
 * paquete: ese envoltorio tipa sus eventos (`onPicked`, `onOauthError`)
 * contra los espacios de nombres `google.picker`/`google.accounts`, que
 * este proyecto no tiene instalados (no hay paquete `@types` para ellos) —
 * intentarlo directo rompe `tsc`. Con el elemento crudo + `addEventListener`
 * imperativo se evita ese tipado frágil por completo; ver
 * `gdrive-picker-types.d.ts` para el arreglo de los tags en sí.
 */
import { useEffect, useRef, useState } from "react";
import { FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { DrivePickerElement } from "@googleworkspace/drive-picker-element";
import type { GDriveCreds } from "@/lib/forja/gdrive";

export interface GDrivePickedFile {
  id: string;
  name: string;
  mimeType: string;
  url?: string;
  sizeBytes?: number;
}

function DrivePickerOverlay({
  creds,
  accessToken,
  onPicked,
  onClose,
}: {
  creds: GDriveCreds;
  accessToken: string;
  onPicked: (files: GDrivePickedFile[]) => void;
  onClose: () => void;
}) {
  const ref = useRef<DrivePickerElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("@googleworkspace/drive-picker-element").then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const el = ref.current;
    if (!el) return;
    const onPickedEvt = (e: Event) => {
      const detail = (e as CustomEvent).detail as { docs?: GDrivePickedFile[] } | undefined;
      onPicked(detail?.docs ?? []);
      onClose();
    };
    const onCanceled = () => onClose();
    const onOauthError = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message?: string; error?: string } | undefined;
      toast.error("Error del selector de Drive", { description: detail?.message || detail?.error });
      onClose();
    };
    const onPickerError = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message?: string } | undefined;
      toast.error("El selector de Drive falló", { description: detail?.message });
      onClose();
    };
    el.addEventListener("picker-picked", onPickedEvt);
    el.addEventListener("picker-canceled", onCanceled);
    el.addEventListener("picker-oauth-error", onOauthError);
    el.addEventListener("picker-error", onPickerError);
    el.visible = true;
    return () => {
      el.removeEventListener("picker-picked", onPickedEvt);
      el.removeEventListener("picker-canceled", onCanceled);
      el.removeEventListener("picker-oauth-error", onOauthError);
      el.removeEventListener("picker-error", onPickerError);
    };
  }, [ready, onPicked, onClose]);

  if (!ready) return null;

  return (
    <drive-picker
      ref={ref}
      client-id={creds.clientId}
      developer-key={creds.apiKey}
      app-id={creds.appId}
      oauth-token={accessToken}
      multiselect
    >
      <drive-picker-docs-view include-folders="true" select-folder-enabled="true" />
    </drive-picker>
  );
}

export function GDrivePickerButton({
  creds,
  accessToken,
  onPicked,
}: {
  creds: GDriveCreds;
  accessToken: string;
  onPicked: (files: GDrivePickedFile[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 gap-1 text-[10.5px]"
        onClick={() => setOpen(true)}
        disabled={open}
      >
        {open ? <Loader2 className="size-3 animate-spin" /> : <FolderOpen className="size-3" />}
        Elegir en Drive
      </Button>
      {open && (
        <DrivePickerOverlay
          creds={creds}
          accessToken={accessToken}
          onPicked={(files) => {
            onPicked(files);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
