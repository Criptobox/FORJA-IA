"use client";
/** Panel visible de conexión y uso de MEGA. */
import { useEffect, useRef, useState } from "react";
import { Check, FolderOpen, Loader2, LogIn, LogOut, RefreshCw, ShieldCheck, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { connectMega, disconnectMega, megaAccountInfo, megaConnectionState, createMegaProvider } from "@/lib/forja/mega-provider";
import type { StorageItem } from "@/lib/forja/storage-providers";

function fmt(n: number) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v < 10 && i ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export function MegaPanel() {
  const [state, setState] = useState(megaConnectionState());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactor, setTwoFactor] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<StorageItem[]>([]);
  const [quota, setQuota] = useState<{ spaceUsed: number; spaceTotal: number } | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const next = megaConnectionState();
    setState(next);
    if (!next.connected) { setItems([]); setQuota(null); return; }
    try {
      const provider = createMegaProvider();
      setItems(await provider.list());
      setQuota(await megaAccountInfo());
    } catch (e) {
      toast.error("No se pudo leer MEGA", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  useEffect(() => { void refresh(); }, []);

  const login = async () => {
    setBusy(true);
    try {
      const next = await connectMega(email, password, twoFactor);
      setPassword("");
      setTwoFactor("");
      setState(next);
      toast.success(`MEGA conectado: ${next.email}`);
      await refresh();
    } catch (e) {
      toast.error("No se pudo conectar MEGA", { description: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(false); }
  };

  const logout = () => {
    disconnectMega();
    setState({ connected: false });
    setItems([]);
    setQuota(null);
    toast.info("MEGA desconectado");
  };

  if (state.connected) {
    const pct = quota?.spaceTotal ? Math.round((quota.spaceUsed / quota.spaceTotal) * 100) : null;
    return (
      <div className="space-y-3 rounded-xl border border-border/60 p-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-500">🟣</div>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">MEGA</p><p className="truncate text-[11px] text-muted-foreground">{state.email}</p></div>
          <span className="flex items-center gap-1 text-[10px] text-emerald-500"><Check className="size-3" /> Conectado</span>
        </div>
        {quota && <div><div className="mb-1 flex justify-between text-[10px] text-muted-foreground"><span>{fmt(quota.spaceUsed)} usados</span><span>{fmt(quota.spaceTotal)}{pct !== null ? ` · ${pct}%` : ""}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-purple-500" style={{ width: `${Math.min(100, pct ?? 0)}%` }} /></div></div>}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-2"><div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-medium">Raíz de MEGA</span><div className="flex gap-1"><Button variant="ghost" size="sm" className="h-7" onClick={() => uploadRef.current?.click()}><UploadCloud className="mr-1 size-3.5" /> Subir</Button><Button variant="ghost" size="sm" className="h-7" onClick={() => void refresh()}><RefreshCw className="size-3.5" /></Button></div></div>{items.length === 0 ? <p className="text-[11px] text-muted-foreground">La raíz está vacía.</p> : <div className="max-h-40 space-y-1 overflow-auto">{items.slice(0, 30).map((item) => <div key={item.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-[11px]"><FolderOpen className="size-3.5 text-muted-foreground" /> <span className="truncate">{item.name}</span><span className="ml-auto text-[9px] text-muted-foreground">{item.kind}</span></div>)}</div>}</div>
        <input ref={uploadRef} type="file" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; setBusy(true); try { await createMegaProvider().write(file.name, new Uint8Array(await file.arrayBuffer())); toast.success(`Subido a MEGA: ${file.name}`); await refresh(); } catch (err) { toast.error("No se pudo subir a MEGA", { description: err instanceof Error ? err.message : String(err) }); } finally { setBusy(false); } }} />
        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span>Uso previsto: repos, código, componentes y recetas.</span><Button variant="outline" size="sm" className="h-7" onClick={logout}><LogOut className="mr-1 size-3" /> Desconectar</Button></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/60 p-3">
      <div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-500">🟣</div><div><p className="text-sm font-semibold">Conectar MEGA</p><p className="text-[11px] text-muted-foreground">Código, repositorios, componentes y recetas de Forja.</p></div></div>
      <div className="grid gap-2 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="mega-email" className="text-[10px]">Correo MEGA</Label><Input id="mega-email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" placeholder="tu@email.com" className="h-8 text-xs" /></div><div className="space-y-1"><Label htmlFor="mega-password" className="text-[10px]">Contraseña</Label><Input id="mega-password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="h-8 text-xs" /></div></div>
      <Input value={twoFactor} onChange={e => setTwoFactor(e.target.value)} inputMode="numeric" placeholder="Código 2FA (si tienes) · opcional" className="h-8 text-xs" />
      <Button className="h-8 w-full text-xs" disabled={busy || !email.trim() || !password} onClick={() => void login()}>{busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <LogIn className="mr-1 size-3.5" />} Conectar MEGA</Button>
      <div className="flex items-start gap-2 rounded-lg bg-purple-500/5 px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-purple-500" /><span>La contraseña se usa únicamente para iniciar sesión. Forja no la guarda en localStorage. La sesión queda en memoria de esta pestaña.</span></div>
      <p className="text-[9.5px] text-muted-foreground">MEGAJS se descarga como parte de Forja (no de un CDN externo) la primera vez que pulsas Conectar.</p>
    </div>
  );
}
