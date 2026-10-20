"use client";
/** FORJA IA — Estudio, pestaña «ADN 2.0»: la identidad del proyecto en 14
 * dimensiones, extraída de la petición de forma determinista (sin red), con
 * los EXPORTADORES reales del módulo: DESIGN.md, tokens.css y las reglas
 * que viajan al Codificador. */
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, CodeBlock, descargar } from "./ui-forja";
import type { Motor } from "@/lib/forja/motor-client";

export function AdnTab({ motor }: { motor: Motor }) {
  const [mensaje, setMensaje] = useState("Editorial técnica para desarrolladores: silenciosa, precisa, oscura");
  const [nombre, setNombre] = useState("Signal");

  const adn = useMemo<any>(() => {
    if (!motor) return null;
    const a1 = motor.adnDesdePeticion(mensaje);
    return motor.adn2DesdeAdn1(a1, mensaje);
  }, [motor, mensaje]);

  const docs = useMemo(() => {
    if (!motor || !adn) return null;
    const meta = { nombreProyecto: nombre || "Forja" };
    return {
      design: motor.designMdDesdeAdn2(adn, meta) as string,
      tokens: motor.tokensCssDesdeAdn2(adn, meta.nombreProyecto) as string,
      reglas: (motor.reglasCritiqueDesdeAdn2(adn) as string[]).map((x) => `- ${x}`).join("\n"),
      restricciones: (motor.restriccionesCodificadorDesdeAdn2(adn) as string[]).map((x) => `- ${x}`).join("\n"),
      texto: motor.textoAdn2(adn) as string,
    };
  }, [motor, adn, nombre]);

  const DIMS: { clave: string; titulo: string }[] = [
    { clave: "personalidad", titulo: "Personalidad" },
    { clave: "composicion", titulo: "Composición" },
    { clave: "tipografia", titulo: "Tipografía" },
    { clave: "color", titulo: "Color" },
    { clave: "espaciado", titulo: "Espaciado" },
    { clave: "movimiento", titulo: "Movimiento" },
    { clave: "representacion", titulo: "Representación" },
    { clave: "interaccion", titulo: "Interacción" },
    { clave: "lenguaje", titulo: "Lenguaje visual" },
    { clave: "prohibiciones", titulo: "Prohibiciones" },
    { clave: "referencias", titulo: "Referencias" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
        <Input value={mensaje} onChange={(e) => setMensaje(e.target.value)} className="text-[13px]" placeholder="Describe el proyecto: la petición alimenta el ADN" />
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="text-[13px]" placeholder="Nombre del proyecto" />
      </div>

      {adn && (
        <>
          <div className="rounded-xl border border-orange-500/25 bg-orange-500/5 p-3">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-orange-600 dark:text-orange-400">Identidad</div>
            <p className="text-[13.5px] font-medium leading-snug">«{String(adn.identidad)}»</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(adn.sensacion ?? []).map((e: any, i: number) => (
                <Chip key={i} tono={e.valor >= 7 ? "fuego" : "neutral"}>
                  {e.eje} {e.valor}/10
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {DIMS.map(({ clave, titulo }) => {
              const vals: string[] = adn[clave] ?? [];
              return (
                <div key={clave} className="rounded-xl border border-border/60 bg-card/50 p-2.5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11.5px] font-semibold">{titulo}</span>
                    <span className="text-[10px] text-muted-foreground">{vals.length}</span>
                  </div>
                  <ul className="space-y-0.5 text-[11.5px] leading-snug text-muted-foreground">
                    {vals.slice(0, 3).map((v, i) => (
                      <li key={i} className="truncate" title={v}>· {v}</li>
                    ))}
                    {vals.length > 3 && <li className="text-[10.5px] opacity-70">+{vals.length - 3} más</li>}
                    {vals.length === 0 && <li className="opacity-60">—</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}

      {docs && (
        <div className="grid gap-3 lg:grid-cols-2">
          <BloqueExport
            titulo="DESIGN.md"
            texto={docs.design}
            onDescargar={() => descargar("DESIGN.md", docs.design, "text/markdown")}
          />
          <BloqueExport
            titulo="tokens.css"
            texto={docs.tokens}
            onDescargar={() => descargar("tokens.css", docs.tokens, "text/css")}
          />
          <BloqueExport titulo="Reglas para el Codificador" texto={docs.restricciones} />
          <BloqueExport titulo="Reglas de critique (jueces)" texto={docs.reglas} />
        </div>
      )}
    </div>
  );
}

function BloqueExport({
  titulo,
  texto,
  onDescargar,
}: {
  titulo: string;
  texto: string;
  onDescargar?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold">{titulo}</span>
        {onDescargar && (
          <Button size="sm" variant="ghost" onClick={onDescargar} className="h-7 gap-1.5 px-2 text-[11.5px]">
            <Download className="size-3" /> Descargar
          </Button>
        )}
      </div>
      <CodeBlock texto={texto} maxAlto="14rem" />
    </div>
  );
}
