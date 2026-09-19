"use client";
/** Forja IA — Panel "Drive": cuentas de Google Drive conectadas, su
 * almacenamiento y una vista previa de lo que hay en cada una.
 *
 * Fase 1 del plan de Knowledge Base (docs/PLAN-V10-KNOWLEDGE-BASE.md): solo
 * conectar cuentas y verlas. Subir/clasificar recursos, detectar
 * duplicados y el research agent llegan en fases siguientes — a propósito,
 * para no meter todo de golpe sin poder probarlo por partes.
 */
import { useEffect, useState } from "react";
import { Check, Cloud, Copy, ExternalLink, FileText, HardDrive, Loader2, LogOut, RefreshCw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { accessCodeHeaders } from "@/lib/forja/chat-client";
import { formatBytes, quotaPercent } from "@/lib/forja/gdrive-oauth";
import { gdListRecentFiles, type GDriveAccount, type GDriveFile } from "@/lib/forja/gdrive";
import { useGdriveAccounts, useGdriveCredsStatus } from "./gdrive-connect";
import { cn } from "@/lib/utils";

function barColor(pct: number | null): string {
  if (pct === null) return "bg-emerald-500";
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}

/** Un color de acento distinto por cuenta, en el mismo tono "chip de
 * color + icono" que el panel de referencia — aquí sobre cuentas reales,
 * no sobre carpetas que todavía no existen. */
const CHIP_COLORS = [
  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard bloqueado (permiso, contexto no seguro): selecciona el
      // texto para que al menos se pueda copiar a mano.
      toast.error("No se pudo copiar automáticamente", { description: "Selecciona el texto y cópialo a mano." });
      return;
    }
    setCopied(true);
    toast.success("URI copiado");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button type="button" variant="ghost" size="sm" className="h-6 shrink-0 gap-1 text-[10.5px]" onClick={() => void copy()}>
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      Copiar
    </Button>
  );
}

function RedirectUriBlock() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const redirectUri = `${origin}/api/gdrive/oauth/callback`;
  return (
    <div>
      <div className="flex items-center gap-2 rounded-md bg-muted px-2 py-1.5">
        <code className="block flex-1 truncate text-[11px]">{redirectUri}</code>
        <CopyButton text={redirectUri} />
      </div>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[10.5px] text-muted-foreground">
        <li>Tiene que ser tipo «Aplicación web», no «Aplicación de escritorio».</li>
        <li>Cópialo tal cual: con https, sin espacios ni barra final de más.</li>
        <li>Si tu app cambia de dominio, este URI cambia — vuelve a copiarlo.</li>
      </ul>
    </div>
  );
}

function GDriveCredsForm({ onSaved }: { onSaved: () => void }) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!clientId.trim() || !clientSecret.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/gdrive/oauth/creds", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...accessCodeHeaders() },
        body: JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "No se pudieron guardar las credenciales");
      toast.success("Credenciales de Google guardadas");
      setClientId("");
      setClientSecret("");
      onSaved();
    } catch (e) {
      toast.error("No se pudo guardar", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-card/40 px-3 py-3">
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        Google no deja registrar una app automáticamente como GitHub: cada persona crea su propio cliente
        OAuth (gratis, dos minutos) en{" "}
        <a
          href="https://console.cloud.google.com/apis/credentials"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-forja-violet underline underline-offset-2"
        >
          Google Cloud Console <ExternalLink className="size-3" />
        </a>
        : «Crear credenciales» → «ID de cliente de OAuth» → añade este URI de redirección exacto:
      </p>
      <RedirectUriBlock />
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="gd-client-id" className="text-[11px]">Client ID</Label>
          <Input
            id="gd-client-id"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="123456-abc.apps.googleusercontent.com"
            className="h-8 font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gd-client-secret" className="text-[11px]">Client Secret</Label>
          <Input
            id="gd-client-secret"
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="GOCSPX-…"
            className="h-8 font-mono text-xs"
          />
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        className="h-8 text-[11px]"
        disabled={!clientId.trim() || !clientSecret.trim() || saving}
        onClick={() => void save()}
      >
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
        Guardar credenciales
      </Button>
    </div>
  );
}

/** Una vez configuradas, las credenciales quedan ocultas por defecto (el
 * secret no vuelve a mostrarse) pero siempre accesibles: si la conexión
 * falla por un URI mal copiado, hace falta poder volver a verlo y, si hace
 * falta, empezar de cero sin tocar variables de entorno. */
function ConfiguredCredsPanel({ source, onForget }: { source: "env" | "cookie" | null; onForget: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-[11.5px] text-muted-foreground hover:text-foreground"
      >
        <Settings2 className="size-3.5" />
        Credenciales de Google {source === "env" ? "(fijadas por el despliegue)" : "guardadas"}
        <span className="ml-auto text-[10.5px] underline underline-offset-2">{open ? "Ocultar" : "Ver / cambiar"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Si la conexión falla, lo más común es que este URI no coincida carácter por carácter con el que
            pusiste en Google Cloud:
          </p>
          <RedirectUriBlock />
          {source === "cookie" && (
            <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={onForget}>
              Olvidar y pegar otras credenciales
            </Button>
          )}
          {source === "env" && (
            <p className="text-[10.5px] text-muted-foreground">
              Están puestas por variables de entorno del despliegue (GOOGLE_CLIENT_ID/SECRET); para cambiarlas
              hay que editarlas ahí.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AccountFiles({ account }: { account: GDriveAccount }) {
  const [files, setFiles] = useState<GDriveFile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    gdListRecentFiles(account)
      .then(setFiles)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Solo al montar / cambiar de cuenta: recargar en cada render de `load`
    // (que se redefine siempre) provocaría un bucle de peticiones a Drive.
  }, [account.email]);

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground">Archivos recientes</p>
        <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-[10.5px]" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Actualizar
        </Button>
      </div>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      {!error && files && files.length === 0 && (
        <p className="text-[11px] text-muted-foreground">Esta cuenta no tiene archivos todavía.</p>
      )}
      {files && files.length > 0 && (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 px-2.5 py-1.5 text-[11.5px]">
              {f.iconLink ? (
                <img src={f.iconLink} alt="" className="size-3.5 shrink-0" width={14} height={14} />
              ) : (
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <a
                href={f.webViewLink}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate hover:underline"
                title={f.name}
              >
                {f.name}
              </a>
              <span className="shrink-0 text-[10.5px] text-muted-foreground">{formatBytes(f.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Fila compacta al estilo del panel "Tus Google Drives" de referencia:
 * chip de color + nombre a la izquierda, barra de almacenamiento a la
 * derecha con el dato debajo — pero sobre cuentas de verdad, no sobre
 * carpetas de una Knowledge Base que todavía no existe (eso es la Fase 2). */
function AccountRow({ account, color, onDisconnect }: { account: GDriveAccount; color: string; onDisconnect: (email: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const pct = quotaPercent(account.quota);

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", color)}>
          {account.avatar ? (
            <img src={account.avatar} alt="" className="size-9 rounded-lg object-cover" width={36} height={36} />
          ) : (
            <Cloud className="size-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{account.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{account.email}</p>
        </div>
        <div className="w-28 shrink-0 sm:w-36">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full transition-all", barColor(pct))} style={{ width: `${pct ?? 8}%` }} />
          </div>
          <p className="mt-1 text-right text-[10px] text-muted-foreground">
            {account.quota.limit
              ? `${formatBytes(account.quota.usage)} / ${formatBytes(account.quota.limit)}`
              : `${formatBytes(account.quota.usage)} · sin límite`}
          </p>
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-forja-violet underline underline-offset-2"
        >
          {expanded ? "Ocultar archivos" : "Ver archivos"}
        </button>
        <button
          type="button"
          onClick={() => onDisconnect(account.email)}
          className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-500"
        >
          <LogOut className="size-3" /> Desconectar
        </button>
      </div>
      {expanded && <AccountFiles account={account} />}
    </div>
  );
}

export function GDriveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { accounts, busy, connect, disconnect } = useGdriveAccounts();
  const { status, reload, forget } = useGdriveCredsStatus();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/60 px-4 py-3 pr-10">
          <DialogTitle className="flex items-center gap-2 text-base">
            <HardDrive className="size-4" /> Tus Google Drives
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            {accounts.length > 0
              ? `${accounts.length} ${accounts.length === 1 ? "cuenta conectada" : "cuentas conectadas"}`
              : "Sin cuentas conectadas todavía"}
          </DialogDescription>
          {status?.configured && (
            <Button
              type="button"
              size="sm"
              onClick={connect}
              disabled={busy}
              className="mt-1 h-8 w-fit gap-1.5 forja-gradient-bg border-0 text-white hover:opacity-90"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Cloud className="size-3.5" />}
              {busy ? "Conectando…" : "Conectar cuenta"}
            </Button>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {status && !status.configured && <GDriveCredsForm onSaved={reload} />}
          {status?.configured && <ConfiguredCredsPanel source={status.source} onForget={() => void forget()} />}

          {accounts.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">
              Todavía no hay ninguna cuenta de Google Drive conectada.
            </p>
          ) : (
            <div className="space-y-2.5">
              {accounts.map((a, i) => (
                <AccountRow
                  key={a.email}
                  account={a}
                  color={CHIP_COLORS[i % CHIP_COLORS.length]!}
                  onDisconnect={disconnect}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
