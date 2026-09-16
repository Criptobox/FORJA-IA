"use client";
/** FORJA IA — Estudio, pestaña «Ficha → Maqueta»: el pipeline REAL del núcleo
 * (ejecutarForja) corriendo en el navegador con transporte de forja (simulado,
 * determinista): ADN → ficha del Diseñador → código del Codificador guiado por
 * tokens.css reales → Revisor. Caché por hash incluida: la misma petición no
 * paga dos veces. */
import { useMemo, useRef, useState } from "react";
import { BadgeCheck, Flame, RefreshCw, ScrollText, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, CodeBlock, Salida } from "./ui-forja";
import type { Motor } from "@/lib/prism/motor-client";
import { paginaCompletaDesdeMensaje } from "@/lib/prism/forja-pagina-demo";

/* el caché vive a nivel de módulo: sobrevive a cambios de pestaña */
let cacheGlobal: any = null;

export function FichaTab({ motor, cfgUsuario }: { motor: Motor; cfgUsuario: any }) {
  const [mensaje, setMensaje] = useState("Landing para una panadería artesanal en Valencia");
  const [ocupado, setOcupado] = useState(false);
  const [r, setR] = useState<any>(null);
  const [pasada, setPasada] = useState<1 | 2>(1);
  const [llamadas, setLlamadas] = useState<{ disenador: number; codificador: number; revisor: number }>({ disenador: 0, codificador: 0, revisor: 0 });
  const [deltaDisenador, setDeltaDisenador] = useState<number | null>(null);
  const [log, setLog] = useState("");
  const [verCodigo, setVerCodigo] = useState(false);
  const cuenta = useRef({ disenador: 0, codificador: 0, revisor: 0 });

  const adn = useMemo(
    () => (motor ? motor.adn2DesdeAdn1(null, mensaje) : null),
    [motor, mensaje]
  );

  const forjar = async (repetir = false) => {
    if (!motor || ocupado) return;
    setOcupado(true);
    setLog("");
    if (!repetir) {
      cuenta.current = { disenador: 0, codificador: 0, revisor: 0 };
      setPasada(1);
      setDeltaDisenador(null);
    } else {
      setPasada(2);
    }
    const antes = { ...cuenta.current };
    try {
      const { ejecutarForja, crearCacheMemoria, tokensCssDesdeAdn2, textoAdn2 } = motor;
      if (!cacheGlobal) cacheGlobal = crearCacheMemoria(8);
      const cache = cacheGlobal;
      const adnLocal = motor.adn2DesdeAdn1(null, mensaje);
      const nombre = nombreProyecto(mensaje);
      const tokens = tokensCssDesdeAdn2(adnLocal, nombre);
      const fichaTexto = fichaDesdeAdn(textoAdn2(adnLocal), mensaje);
      const { html: pagina, plano } = paginaCompletaDesdeMensaje(motor, mensaje, adnLocal, tokens, nombre);

      const mock = async (a: any) => {
        const rol = a?.rol ?? "codificador";
        cuenta.current[rol as keyof typeof cuenta.current]++;
        if (rol === "disenador") return fichaTexto;
        if (rol === "codificador") return "```html\n" + pagina + "\n```";
        return "<veredicto>aprobado</veredicto><resumen>La página respeta ficha y tokens.</resumen>";
      };
      const pasos: string[] = [];
      const deps = () => ({
        llamarModelo: mock,
        memoria: { reglas: [] },
        cache,
        onProgreso: (e: any) => {
          const linea =
            e?.tipo === "rol-inicio"
              ? `▸ ${e.rol} (ronda ${e.ronda ?? 1})`
              : e?.tipo === "continuacion-nucleo"
                ? `▸ continuación de núcleo ×${e.n}`
                : null;
          if (linea && !pasos.includes(linea)) pasos.push(linea);
        },
      });
      const cfg = { porRol: {}, habilidades: [], perfil: "ligero", ...(cfgUsuario ?? {}) };
      const res = await ejecutarForja({ mensaje }, cfg, deps(), { providerId: "forja-estudio", modelId: "taller" });
      setR(res);
      setLlamadas({ ...cuenta.current });
      setDeltaDisenador(cuenta.current.disenador - antes.disenador);
      setLog(pasos.join("\n") + `\n▸ estado final: ${res.estado}\n▸ plano de contenido: ${plano.resumen}`);
    } catch (e) {
      setLog("error: " + String(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Flame className="size-4 text-orange-500" />
          <h3 className="text-sm font-semibold">El pipeline real, en tu navegador</h3>
        </div>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Petición → <b>ADN</b> (determinista) → <b>ficha</b> del Diseñador →{" "}
          <b>código</b> del Codificador guiado por <code>tokens.css</code> generado
          desde el ADN → <b>Revisor</b>. Sin red: el transporte simula los roles
          para que veas el motor de verdad, con el presupuesto por rol de tus{" "}
          <b>Ajustes</b> aplicado.
        </p>
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-[12.5px] outline-none focus:border-orange-500/40"
          placeholder="¿Qué página forjamos? Sé concreto: tipo de negocio, público, tono…"
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => forjar(false)} disabled={ocupado} size="sm" className="gap-2">
            <Wand2 className="size-3.5" /> Forjar ficha + maqueta
          </Button>
          <Button onClick={() => forjar(true)} disabled={ocupado || !r} size="sm" variant="outline" className="gap-2">
            <RefreshCw className="size-3.5" /> Repetir (caché)
          </Button>
          {pasada === 2 && (
            <Chip tono="ok">
              <BadgeCheck className="size-3" /> 2ª pasada
            </Chip>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tono="fuego">Diseñador: {llamadas.disenador}</Chip>
          <Chip tono="fuego">Codificador: {llamadas.codificador}</Chip>
          <Chip tono="fuego">Revisor: {llamadas.revisor}</Chip>
          {pasada === 2 && deltaDisenador === 0 && (
            <Chip tono="ok">ficha servida del caché — 0 llamadas nuevas</Chip>
          )}
        </div>
        <Salida texto={log} maxAlto="7rem" />
        {r?.respuesta && (
          <div className="rounded-xl border border-border/60 bg-card/50 p-3 text-[12.5px] leading-relaxed text-foreground/85">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <ScrollText className="size-3" /> Respuesta del núcleo
            </div>
            {String(r.respuesta).slice(0, 600)}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {r?.codigo ? (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Maqueta forjada</h3>
              <Button size="sm" variant="ghost" onClick={() => setVerCodigo(!verCodigo)} className="h-8 px-2.5 text-[12px] sm:h-7 sm:px-2 sm:text-[11.5px]">
                {verCodigo ? "Ver página" : "Ver código"}
              </Button>
            </div>
            {verCodigo ? (
              <CodeBlock texto={r.codigo} maxAlto="26rem" />
            ) : (
              <iframe
                title="Maqueta FORJA IA"
                srcDoc={r.codigo}
                sandbox="allow-same-origin"
                className="h-[20rem] w-full rounded-xl border border-border/60 bg-white sm:h-[26rem]"
              />
            )}
          </>
        ) : (
          <div className="flex h-full min-h-[16rem] items-center justify-center rounded-xl border border-dashed border-border/60 text-center text-[12.5px] text-muted-foreground">
            <div className="max-w-[16rem] space-y-1.5 p-4">
              <Flame className="mx-auto size-5 text-orange-500/60" />
              <p>Aún no hay maqueta. Escribe una petición y calienta el yunque.</p>
              {adn && (
                <p className="text-[11px] text-muted-foreground/70">
                  Identidad preliminar del ADN: «{String(adn.identidad).slice(0, 90)}»
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── helpers deterministas del taller ─────────────────────────── */

function nombreProyecto(mensaje: string): string {
  const m = mensaje.toLowerCase();
  const conocido = ["panadería", "panaderia", "cafetería", "cafeteria", "restaurante", "barbería", "barberia", "taller", "estudio", "clínica", "clinica", "boutique", "gimnasio", "librería", "libreria"].find((k) => m.includes(k));
  return conocido ? conocido.charAt(0).toUpperCase() + conocido.slice(1) : "Forja";
}

function fichaDesdeAdn(textoAdn: string, mensaje: string): string {
  return [
    "## Ficha de diseño",
    `Petición: ${mensaje}`,
    "",
    textoAdn,
    "",
    "## Restricciones",
    "- Nada de plantilla reconocible: prohibiciones del ADN mandan.",
    "- Una sola página, autocontenida, sin dependencias externas.",
  ].join("\n");
}

/* la maqueta ya no la construye este componente: `paginaCompletaDesdeMensaje`
 * (forja-pagina-demo.ts) usa el plano de contenido real del motor
 * (construirPlanoContenido) para que salgan las secciones que el brief pide
 * de verdad, no una plantilla fija de 3 tarjetas. */
