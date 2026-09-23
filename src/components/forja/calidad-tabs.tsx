"use client";
/** FORJA IA — Estudio, pestañas «Jueces · Evidencia» y «Anti-genérico».
 * La evidencia es 100 % determinista (sin red): chequeos estáticos +
 * genericidad + auditoría contra el design system del ADN — el mismo paquete
 * de evidencia que reciben los jueces 2.0. El informe anti-genérico usa las
 * 3 capas reales del módulo. */
import { useMemo, useState } from "react";
import { Eye, Gavel, ShieldAlert } from "lucide-react";
import { Chip, CodeBlock, Salida } from "./ui-forja";
import type { Motor } from "@/lib/forja/motor-client";

const HTML_MUESTRA = `<!doctype html><html lang="es"><head><title>Servicios</title></head>
<body style="font-family:Arial"><div style="background:linear-gradient(135deg,#3B82F6,#8B5CF6)">
<h1>Bienvenido</h1><p>Soluciones innovadores para tus necesidades</p>
<div style="display:flex"><div class="card"><h2>Servicio 1</h2></div>
<div class="card"><h2>Servicio 2</h2></div><div class="card"><h2>Servicio 3</h2></div></div>
</div></body></html>`;

export function JuecesTab({ motor }: { motor: Motor }) {
  const [html, setHtml] = useState(HTML_MUESTRA);
  const [mensaje, setMensaje] = useState("Landing para un estudio de arquitectura");

  const ev = useMemo(() => {
    if (!motor || !html || html.length < 60) return null;
    try {
      const a1 = motor.adnDesdePeticion(mensaje);
      const adn = motor.adn2DesdeAdn1(a1, mensaje);
      const ds = motor.crearDesignSystem(adn, "Estudio");
      const hallazgos = motor.chequeosEstaticos(html) as any[];
      const genericidad = motor.detectarGenericidad(html);
      const sistema = motor.auditarContraDesignSystem(html, ds) as any[];
      const evidencia = motor.evidenciaDeterminista(hallazgos, genericidad, sistema) as Record<
        "visual" | "ux" | "originalidad",
        any
      >;
      // el paquete de evidencia se serializa a texto: lo que reciben los jueces
      const bloque = (nombre: string, e: any) =>
        [
          `### ${nombre}`,
          ...funcionaFallaConserva(e),
        ].join("\n");
      const textoEvidencia = [
        bloque("Juez Visual", evidencia.visual),
        bloque("Juez UX/Accesibilidad", evidencia.ux),
        bloque("Juez de Originalidad", evidencia.originalidad),
      ].join("\n\n");
      const promptMuestra = motor.promptJuez2("visual", html.slice(0, 400), textoEvidencia, adn);
      return { hallazgos, genericidad, sistema, evidencia: textoEvidencia, promptMuestra: String(promptMuestra), adn };
    } catch (e) {
      return { error: String(e) };
    }
  }, [motor, html, mensaje]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Gavel className="size-4 text-orange-500" />
          <h3 className="text-sm font-semibold">Evidencia determinista para los jueces 2.0</h3>
        </div>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Tres capas sin red: <b>chequeos estáticos</b> (bugs reales),{" "}
          <b>anti-genérico</b> (síntomas de plantilla) y <b>auditoría contra el
          design system</b> que sale del ADN. Con esa evidencia trabajan el Juez
          Visual, el de UX/Accesibilidad y el de Originalidad — aquí ves el
          paquete completo y el prompt que recibiría cada juez.
        </p>
        <InputPeque value={mensaje} onChange={setMensaje} etiqueta="Petición (da el ADN y el design system)" />
        <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={8} className="font-mono w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-[12.5px] outline-none focus:border-orange-500/40" />
        <div className="flex flex-wrap gap-1.5">
          {ev && !("error" in ev) && (
            <>
              <Chip tono="neutral">chequeos: {ev.hallazgos.length}</Chip>
              <Chip tono={ev.genericidad.sintomas.length ? "aviso" : "ok"}>
                genericidad: {ev.genericidad.nivel} ({ev.genericidad.sintomas.length} síntomas)
              </Chip>
              <Chip tono="neutral">design system: {ev.sistema.length} hallazgos</Chip>
            </>
          )}
        </div>
        {ev && "error" in ev && <Salida texto={"error: " + ev.error} />}
      </div>
      <div className="space-y-3">
        {ev && !("error" in ev) && (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                <Eye className="size-3.5 text-orange-500" /> Paquete de evidencia
              </div>
              <CodeBlock texto={ev.evidencia} maxAlto="15rem" />
            </div>
            <div className="space-y-1.5">
              <div className="text-[12px] font-semibold">Prompt que recibe el Juez Visual (visión A)</div>
              <CodeBlock texto={ev.promptMuestra.slice(0, 1800)} maxAlto="13rem" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AntigenericoTab({ motor }: { motor: Motor }) {
  const [html, setHtml] = useState(HTML_MUESTRA);

  const informe = useMemo(() => {
    if (!motor || !html || html.length < 60) return null;
    try {
      return motor.detectarGenericidad(html);
    } catch {
      return null;
    }
  }, [motor, html]);

  const texto = informe ? String(motor.textoInformeAntiGenerico(informe)) : "";
  const catalogo = motor?.CATALOGO_ANTIPATRONES ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-orange-500" />
          <h3 className="text-sm font-semibold">Detector anti-genérico (3 capas)</h3>
        </div>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          ¿Podría cambiarse el logo y venderse como plantilla? El detector busca
          síntomas concretos: azul-violeta por defecto, «soluciones innovadoras»,
          cards en fila de 3, títulos que podrían estar en cualquier web… Pega
          tu HTML y mira la puntuación de identidad.
        </p>
        <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={10} className="font-mono w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-[12.5px] outline-none focus:border-orange-500/40" />
        {informe && (
          <div className="flex items-center gap-1.5">
            <Chip tono={informe.sintomas.length ? "aviso" : "ok"}>
              identidad: {informe.puntuacionIdentidad}/100
            </Chip>
            <Chip tono={informe.nivel === "bajo" ? "ok" : "aviso"}>nivel: {informe.nivel}</Chip>
          </div>
        )}
      </div>
      <div className="space-y-3">
        {informe && <CodeBlock texto={texto} maxAlto="16rem" />}
        {catalogo.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[12px] font-semibold">Catálogo de antipatrones ({catalogo.length})</div>
            <Salida
              texto={catalogo
                .map((a) => `· ${a.nombre} — alternativa: ${a.alternativa}`)
                .join("\n")
                .slice(0, 1400)}
              maxAlto="12rem"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function InputPeque({
  value,
  onChange,
  etiqueta,
}: {
  value: string;
  onChange: (v: string) => void;
  etiqueta: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{etiqueta}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border/60 bg-transparent px-2.5 py-1.5 text-[12.5px] outline-none focus:ring-2 focus:ring-ring/40"
      />
    </label>
  );
}

/** Serializa un EvidenciaJuez (funciona/falla/conservar + originalidad) a texto. */
function funcionaFallaConserva(e: any): string[] {
  const lista = (clave: string, xs: string[] | undefined) =>
    xs?.length ? [`${clave}:`, ...xs.map((x) => `  · ${x}`)] : [];
  return [
    ...lista("qué funciona", e?.funciona),
    ...lista("qué falla", e?.falla),
    ...lista("qué conservar", e?.conservar),
    ...lista("patrones genéricos", e?.patronesGenericos),
    ...lista("diferenciadores", e?.diferenciadores),
    ...lista("riesgos", e?.riesgos),
  ];
}
