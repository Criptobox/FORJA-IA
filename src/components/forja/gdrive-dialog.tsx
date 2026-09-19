"use client";
/** Forja IA — Panel "Drive": cuentas de Google Drive conectadas, su
 * almacenamiento y una vista previa de lo que hay en cada una.
 *
 * Fase 1 del plan de Knowledge Base (docs/knowledge-base-plan.md): solo
 * conectar cuentas y verlas. Subir/clasificar recursos, detectar
 * duplicados y el research agent llegan en fases siguientes — a propósito,
 * para no meter todo de golpe sin poder probarlo por partes.
 */
import { useEffect, useState } from "react";
import { Cloud, ExternalLink, FileText, HardDrive, Loader2, LogOut, RefreshCw } from "lucide-react";
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

function GDriveCredsForm({ onSaved }: { onSaved: () => void }) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const redirectUri = `${origin}/api/gdrive/oauth/callback`;

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
        : «Crear credenciales» → «ID de cliente de OAuth» → tipo «Aplicación web» → añade este URI de
        redirección exacto:
      </p>
      <code className="block break-all rounded-md bg-muted px-2 py-1.5 text-[11px]">{redirectUri}</code>
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

function AccountCard({ account, onDisconnect }: { account: GDriveAccount; onDisconnect: (email: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const pct = quotaPercent(account.quota);

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 px-3 py-3">
      <div className="flex items-center gap-2.5">
        {account.avatar ? (
          <img src={account.avatar} alt="" className="size-8 rounded-full" width={32} height={32} />
        ) : (
          <Cloud className="size-8 rounded-full bg-muted p-1.5" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{account.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{account.email}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-[11px] text-muted-foreground hover:text-red-500"
          onClick={() => onDisconnect(account.email)}
        >
          <LogOut className="size-3.5" /> Desconectar
        </Button>
      </div>

      <div className="mt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", barColor(pct))}
            style={{ width: `${pct ?? 8}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {account.quota.limit
            ? `${formatBytes(account.quota.usage)} de ${formatBytes(account.quota.limit)} usados`
            : `${formatBytes(account.quota.usage)} usados · sin límite`}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 text-[11px] text-forja-violet underline underline-offset-2"
      >
        {expanded ? "Ocultar archivos" : "Ver archivos de esta cuenta"}
      </button>
      {expanded && <AccountFiles account={account} />}
    </div>
  );
}

export function GDriveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { accounts, busy, connect, disconnect } = useGdriveAccounts();
  const { status, reload } = useGdriveCredsStatus();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/60 px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <HardDrive className="size-4" /> Drive
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            Cuentas de Google Drive conectadas: almacenamiento y datos que Forja puede consultar.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {status && !status.configured && <GDriveCredsForm onSaved={reload} />}

          {status?.configured && (
            <Button
              type="button"
              size="sm"
              onClick={connect}
              disabled={busy}
              className="h-8 gap-1.5 forja-gradient-bg border-0 text-white hover:opacity-90"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Cloud className="size-3.5" />}
              {busy ? "Conectando…" : "Conectar cuenta de Google"}
            </Button>
          )}

          {accounts.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">
              Todavía no hay ninguna cuenta de Google Drive conectada.
            </p>
          ) : (
            <div className="space-y-2.5">
              {accounts.map((a) => (
                <AccountCard key={a.email} account={a} onDisconnect={disconnect} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
