"use client";
/** Forja IA — Panel "Drive": cuentas de Google Drive conectadas, su
 * almacenamiento y una vista previa de lo que hay en cada una.
 *
 * Fase 1 del plan de Knowledge Base (docs/PLAN-V10-KNOWLEDGE-BASE.md): solo
 * conectar cuentas y verlas. Subir/clasificar recursos, detectar
 * duplicados y el research agent llegan en fases siguientes — a propósito,
 * para no meter todo de golpe sin poder probarlo por partes.
 *
 * La conexión usa Google Identity Services en vez de un intercambio OAuth
 * de servidor (ver gdrive-gis.ts): más fácil de configurar (Client ID +
 * API Key, sin secret) y sin la trampa del "redirect_uri_mismatch" que
 * sufrió un usuario real con el flujo anterior.
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
import { formatBytes, quotaPercent } from "@/lib/forja/gdrive-oauth";
import { gdGetCreds, gdListRecentFiles, type GDriveAccount, type GDriveCreds, type GDriveFile } from "@/lib/forja/gdrive";
import { kbHasResource, kbUpsertResource } from "@/lib/forja/kb-index";
import { useGdriveAccounts, useGdriveCredsStatus, type GdriveCredsStatus } from "./gdrive-connect";
import { GDrivePickerButton } from "./gdrive-picker-button";
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
      toast.error("No se pudo copiar automáticamente", { description: "Selecciona el texto y cópialo a mano." });
      return;
    }
    setCopied(true);
    toast.success("Copiado");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button type="button" variant="ghost" size="sm" className="h-6 shrink-0 gap-1 text-[10.5px]" onClick={() => void copy()}>
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      Copiar
    </Button>
  );
}

/** Solo el ORIGEN (dominio), sin ruta: a diferencia del "URI de
 * redirección" del flujo anterior, esto es lo único que hay que pegar en
 * Google Cloud → "Authorized JavaScript origins", y no tiene que coincidir
 * carácter por carácter con ninguna ruta — mucho más difícil de fallar. */
function AuthorizedOriginBlock() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div>
      <div className="flex items-center gap-2 rounded-md bg-muted px-2 py-1.5">
        <code className="block flex-1 truncate text-[11px]">{origin}</code>
        <CopyButton text={origin} />
      </div>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[10.5px] text-muted-foreground">
        <li>Va en «Authorized JavaScript origins», NO en «Authorized redirect URIs» — no hace falta ninguna ruta.</li>
        <li>Es solo el dominio: sin barra final, con https.</li>
        <li>Si tu app cambia de dominio, vuelve a copiarlo.</li>
      </ul>
    </div>
  );
}

function GDriveCredsForm({ onSaved }: { onSaved: (creds: GDriveCreds) => void }) {
  const [clientId, setClientId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [appId, setAppId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const save = () => {
    if (!clientId.trim() || !apiKey.trim()) return;
    onSaved({ clientId: clientId.trim(), apiKey: apiKey.trim(), appId: appId.trim() || undefined });
    toast.success("Credenciales de Google guardadas");
    setClientId("");
    setApiKey("");
    setAppId("");
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-card/40 px-3 py-3">
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        Cada persona crea su propio cliente OAuth (gratis, dos minutos) en{" "}
        <a
          href="https://console.cloud.google.com/apis/credentials"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-forja-violet underline underline-offset-2"
        >
          Google Cloud Console <ExternalLink className="size-3" />
        </a>
        : «Crear credenciales» → «ID de cliente de OAuth» (tipo «Aplicación web») y también una «Clave de
        API». Añade este origen:
      </p>
      <AuthorizedOriginBlock />
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
          <Label htmlFor="gd-api-key" className="text-[11px]">API Key</Label>
          <Input
            id="gd-api-key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza…"
            className="h-8 font-mono text-xs"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="text-[10.5px] text-muted-foreground underline underline-offset-2"
      >
        {showAdvanced ? "Ocultar avanzado" : "Avanzado: ID de la app (opcional)"}
      </button>
      {showAdvanced && (
        <div className="space-y-1">
          <Label htmlFor="gd-app-id" className="text-[11px]">ID de la app (número de proyecto)</Label>
          <Input
            id="gd-app-id"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            placeholder="123456789012"
            className="h-8 font-mono text-xs"
          />
        </div>
      )}
      <Button
        type="button"
        size="sm"
        className="h-8 text-[11px]"
        disabled={!clientId.trim() || !apiKey.trim()}
        onClick={save}
      >
        Guardar credenciales
      </Button>
    </div>
  );
}

/** Las credenciales no son secretas, pero se mantienen ocultas por
 * limpieza visual — siempre accesibles para revisar el origen exacto o
 * empezar de cero si algo no encaja. */
function ConfiguredCredsPanel({ status, onForget }: { status: GdriveCredsStatus; onForget: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-[11.5px] text-muted-foreground hover:text-foreground"
      >
        <Settings2 className="size-3.5" />
        Credenciales de Google {status.source === "env" ? "(fijadas por el despliegue)" : "guardadas"}
        <span className="ml-auto text-[10.5px] underline underline-offset-2">{open ? "Ocultar" : "Ver / cambiar"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Si la conexión falla, revisa que este origen esté en «Authorized JavaScript origins» de tu cliente
            OAuth:
          </p>
          <AuthorizedOriginBlock />
          {status.source === "local" && (
            <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={onForget}>
              Olvidar y pegar otras credenciales
            </Button>
          )}
          {status.source === "env" && (
            <p className="text-[10.5px] text-muted-foreground">
              Están puestas por variables de entorno del despliegue (NEXT_PUBLIC_GOOGLE_CLIENT_ID/API_KEY);
              para cambiarlas hay que editarlas ahí.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AccountFiles({ account, creds }: { account: GDriveAccount; creds: GDriveCreds | null }) {
  const [files, setFiles] = useState<GDriveFile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const load = () => {
    if (!creds) {
      setError("Faltan las credenciales de Google — vuelve a pegarlas arriba.");
      return;
    }
    setLoading(true);
    setError(null);
    gdListRecentFiles(account, creds)
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
              <button
                type="button"
                disabled={addedIds.has(f.id) || kbHasResource(f.id)}
                onClick={() => {
                  kbUpsertResource({
                    id: f.id,
                    name: f.name,
                    mimeType: f.mimeType,
                    sizeBytes: f.size,
                    accountEmail: account.email,
                    webViewLink: f.webViewLink,
                    category: "",
                    tags: [],
                    technology: "",
                    license: "",
                    status: "nuevo",
                    indexedAt: new Date().toISOString(),
                  });
                  setAddedIds((prev) => new Set(prev).add(f.id));
                  toast.success("Añadido a la Knowledge Base");
                }}
                className="shrink-0 text-[10.5px] text-forja-violet underline underline-offset-2 disabled:text-muted-foreground disabled:no-underline"
                title={addedIds.has(f.id) || kbHasResource(f.id) ? "Ya está en la Knowledge Base" : "Añadir a la Knowledge Base"}
              >
                {addedIds.has(f.id) || kbHasResource(f.id) ? "Ya añadido" : "+ Añadir"}
              </button>
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
function AccountRow({
  account,
  creds,
  color,
  onDisconnect,
}: {
  account: GDriveAccount;
  creds: GDriveCreds | null;
  color: string;
  onDisconnect: (email: string) => void;
}) {
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

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-forja-violet underline underline-offset-2"
        >
          {expanded ? "Ocultar archivos" : "Ver archivos"}
        </button>
        {creds && (
          <GDrivePickerButton
            creds={creds}
            accessToken={account.accessToken}
            onPicked={(files) => {
              if (files.length === 0) return;
              const now = new Date().toISOString();
              let nuevos = 0;
              for (const f of files) {
                if (kbHasResource(f.id)) continue;
                kbUpsertResource({
                  id: f.id,
                  name: f.name,
                  mimeType: f.mimeType,
                  sizeBytes: f.sizeBytes ?? 0,
                  accountEmail: account.email,
                  webViewLink: f.url ?? "",
                  category: "",
                  tags: [],
                  technology: "",
                  license: "",
                  status: "nuevo",
                  indexedAt: now,
                });
                nuevos++;
              }
              toast.success(
                nuevos === 0
                  ? "Ya estaban en la Knowledge Base"
                  : nuevos === 1
                    ? "Añadido a la Knowledge Base"
                    : `${nuevos} recursos añadidos a la Knowledge Base`,
                { description: nuevos > 0 ? "Ábrela desde la barra lateral para ponerles categoría y etiquetas." : undefined }
              );
            }}
          />
        )}
        <button
          type="button"
          onClick={() => onDisconnect(account.email)}
          className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-500"
        >
          <LogOut className="size-3" /> Desconectar
        </button>
      </div>
      {expanded && <AccountFiles account={account} creds={creds} />}
    </div>
  );
}

export function GDriveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { accounts, busy, connect, disconnect } = useGdriveAccounts();
  const { status, save, forget } = useGdriveCredsStatus();
  const creds = gdGetCreds();

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
          {status.configured && (
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
          {!status.configured && <GDriveCredsForm onSaved={save} />}
          {status.configured && <ConfiguredCredsPanel status={status} onForget={forget} />}

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
                  creds={creds}
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
