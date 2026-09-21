"use client";

/** FORJA IA — Panel del Apartado de Aprendizaje (UI de Ajustes).
 * Cópialo a tu proyecto (p. ej. src/components/d1/PanelAprendizaje.tsx) y
 * móntalo donde quieras: <PanelAprendizaje />.
 *
 * Qué hace:
 *   · dictamen de la URL EN VIVO mientras escribes (misma capa de seguridad
 *     que el servidor, importada del módulo d1 — funciones puras, sin red);
 *   · alta de fuentes con nota y calidad, pausar/reactivar, quitar,
 *     «olvidar reglas de esta fuente» y «olvidar todo»;
 *   · botón «Aprender ahora» que llama a /api/forja/aprender y muestra el
 *     informe (o el aviso de descanso de 15 min);
 *   · estadísticas por fuente: lecturas y reglas aportadas.
 *
 * Autenticación: el componente envía cookies same-origin (tu ruta valida
 * `forja_admin` o tu sesión real en app/api/forja/_base.ts).
 *
 * Estilo: clases Tailwind de un tema oscuro neutro — adapta los colores a
 * tu app en un minuto (busca `bg-white/5`, `border-white/10`).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { dictamenFuente, MAX_FUENTES_USUARIO, type FuenteUsuario } from "@/lib/prism/forja/fuentes-usuario";

const CALIDADES: Array<{ v: 1 | 2 | 3; t: string }> = [
  { v: 3, t: "Me fío mucho" },
  { v: 2, t: "Normal" },
  { v: 1, t: "Solo referencia" },
];

interface RespuestaLista {
  fuentes: FuenteUsuario[];
  ultimoCiclo: string | null;
  totalReglas: number;
}

export default function PanelAprendizaje({
  apiFuentes = "/api/forja/fuentes",
  apiAprender = "/api/forja/aprender",
}: {
  apiFuentes?: string;
  apiAprender?: string;
}) {
  const [datos, setDatos] = useState<RespuestaLista | null>(null);
  const [entrada, setEntrada] = useState("");
  const [nota, setNota] = useState("");
  const [calidad, setCalidad] = useState<1 | 2 | 3>(2);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "error" | "ok"; texto: string } | null>(null);
  const [informe, setInforme] = useState<string | null>(null);
  const [aprendiendo, setAprendiendo] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(apiFuentes);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDatos((await res.json()) as RespuestaLista);
    } catch (e) {
      setAviso({ tipo: "error", texto: `No se pudo cargar el Apartado (${e instanceof Error ? e.message : "red"}). ¿Configuraste FORJA_ADMIN_SECRET?` });
    }
  }, [apiFuentes]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // dictamen en vivo: la MISMA validación que aplica el servidor, sin red
  const dictamen = useMemo(() => (entrada.trim() ? dictamenFuente(entrada) : null), [entrada]);

  async function enviar(metodo: "POST" | "PATCH" | "DELETE", cuerpo: unknown, api = apiFuentes): Promise<boolean> {
    setCargando(true);
    setAviso(null);
    try {
      const res = await fetch(api, {
        method: metodo,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; informe?: string };
      if (!res.ok) {
        setAviso({ tipo: "error", texto: data.error ?? `Error ${res.status}` });
        return false;
      }
      if (data.informe !== undefined) setInforme(data.informe);
      await cargar();
      return true;
    } catch (e) {
      setAviso({ tipo: "error", texto: e instanceof Error ? e.message : "Fallo de red" });
      return false;
    } finally {
      setCargando(false);
    }
  }

  const fuentes = datos?.fuentes ?? [];
  const activas = fuentes.filter((f) => f.activa).length;

  return (
    <section className="mx-auto w-full max-w-2xl space-y-4 text-sm">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">📚 Apartado de Aprendizaje</h2>
        <span className="text-xs text-white/50">
          {activas} activa(s) de {fuentes.length} · tope {MAX_FUENTES_USUARIO}
          {datos ? ` · ${datos.totalReglas} reglas aprendidas` : ""}
        </span>
      </header>

      {/* ── alta de fuente con dictamen en vivo ── */}
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4">
        <input
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder="Pega un link: sitio, repo de GitHub o documento .md/.txt"
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-sky-400/60"
        />
        {dictamen && !dictamen.ok && (
          <p className="text-xs text-amber-300/90">⚠️ {dictamen.motivos.join(" ")}</p>
        )}
        {dictamen?.ok && dictamen.propuesta && (
          <p className="text-xs text-emerald-300/90">
            ✓ {dictamen.propuesta.nombre} · se leerá como «{dictamen.propuesta.tipo}»
          </p>
        )}
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Nota (opcional): qué quieres que aprenda de aquí"
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-sky-400/60"
        />
        <div className="flex items-center gap-2">
          <select
            value={calidad}
            onChange={(e) => setCalidad(Number(e.target.value) as 1 | 2 | 3)}
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-2"
          >
            {CALIDADES.map((c) => (
              <option key={c.v} value={c.v}>
                {c.t}
              </option>
            ))}
          </select>
          <button
            disabled={cargando || !dictamen?.ok}
            onClick={() => void enviar("POST", { entrada, nota: nota || undefined, calidad }).then((ok) => {
              if (ok) {
                setEntrada("");
                setNota("");
                setAviso({ tipo: "ok", texto: "Fuente añadida: entra en el próximo ciclo." });
              }
            })}
            className="rounded-lg bg-sky-500/90 px-4 py-2 font-medium text-black disabled:opacity-40"
          >
            Añadir fuente
          </button>
        </div>
      </div>

      {aviso && (
        <p className={aviso.tipo === "error" ? "text-amber-300/90" : "text-emerald-300/90"}>
          {aviso.texto}
        </p>
      )}

      {/* ── lista de fuentes ── */}
      <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
        {fuentes.length === 0 && (
          <li className="p-4 text-white/50">
            Vacío. Añade fuentes arriba: en cada ciclo, FORJA IA leerá tus
            fuentes activas primero y destilará reglas de diseño de ellas.
          </li>
        )}
        {fuentes.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate">
                <span className={f.activa ? "text-emerald-400" : "text-white/30"}>●</span>{" "}
                <span className={f.activa ? "" : "text-white/50 line-through"}>{f.nombre}</span>{" "}
                <span className="rounded bg-white/10 px-1 text-xs">{f.tipo}</span>
              </p>
              <p className="truncate text-xs text-white/40">
                {f.reglasAportadas} reglas · {f.lecturas} lecturas{f.nota ? ` — «${f.nota}»` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                disabled={cargando}
                onClick={() => void enviar("PATCH", { id: f.id, activa: !f.activa })}
                className="rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/10"
              >
                {f.activa ? "Pausar" : "Activar"}
              </button>
              <button
                disabled={cargando}
                onClick={() => {
                  if (confirm("¿Quitar la fuente y OLVIDAR las reglas que aprendió de ella?")) {
                    void enviar("DELETE", { id: f.id, olvidarReglas: true });
                  }
                }}
                className="rounded-md border border-white/10 px-2 py-1 text-xs text-rose-300/90 hover:bg-white/10"
              >
                Olvidar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* ── ciclo de aprendizaje ── */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-white/50">
          Último ciclo: {datos?.ultimoCiclo ? new Date(datos.ultimoCiclo).toLocaleString("es") : "nunca"}
        </p>
        <div className="flex gap-2">
          <button
            disabled={cargando || aprendiendo}
            onClick={async () => {
              setAprendiendo(true);
              await enviar("POST", {}, apiAprender);
              setAprendiendo(false);
            }}
            className="rounded-lg bg-sky-500/90 px-4 py-2 font-medium text-black disabled:opacity-40"
          >
            {aprendiendo ? "Aprendiendo…" : "Aprender ahora"}
          </button>
          <button
            disabled={cargando}
            onClick={() => {
              if (confirm("¿Borrar TODAS las reglas aprendidas de la web? (tu memoria personal no se toca)")) {
                void enviar("DELETE", { todo: true }).then(() => setInforme(null));
              }
            }}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/10"
          >
            Olvidar todo
          </button>
        </div>
      </div>

      {informe && (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/40 p-4 text-xs leading-relaxed">
          {informe}
        </pre>
      )}
    </section>
  );
}
