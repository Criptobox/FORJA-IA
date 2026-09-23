"use client";
/** Forja IA — Panel del editor de estilos de la vista previa: controles del
 *  elemento seleccionado y tokens de :root (ver `editor-estilos.ts`). */
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { aHex, type SeleccionEstilo } from "@/lib/forja/editor-estilos";

/* ------------------------------------------------------------------ */
/* Panel del editor de estilos                                         */
/* ------------------------------------------------------------------ */

const PESOS = ["300", "400", "500", "600", "700", "800", "900"];

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5 text-[10px] text-muted-foreground">
      {etiqueta}
      {children}
    </label>
  );
}

const claseInput = "h-7 w-full min-w-0 rounded-md border border-border/60 bg-background px-1.5 text-[11px] text-foreground";

function ColorCampo({ valor, onCambio, etiqueta }: { valor: string; onCambio: (v: string) => void; etiqueta: string }) {
  const hex = aHex(valor);
  return (
    <div className="flex items-center gap-1">
      <input
        type="color"
        aria-label={etiqueta}
        value={hex ?? "#ffffff"}
        onChange={(e) => onCambio(e.target.value)}
        title={hex ? hex : "Transparente o en otro espacio de color: elige uno para fijarlo"}
        className={cn(
          "h-7 w-8 shrink-0 cursor-pointer rounded border border-border/60 bg-transparent p-0.5",
          !hex && "opacity-40 [background:repeating-conic-gradient(#ccc_0_25%,transparent_0_50%)_0_0/8px_8px]"
        )}
      />
      <input aria-label={`${etiqueta} (valor)`} value={valor} onChange={(e) => onCambio(e.target.value)} className={claseInput} />
    </div>
  );
}

export function PanelEstilos({
  seleccion,
  tokens,
  valor,
  onCambio,
  pendientes,
  onGuardar,
  onDescartar,
}: {
  seleccion: SeleccionEstilo | null;
  tokens: Record<string, string>;
  valor: (selector: string, prop: string, delPiloto?: string) => string;
  onCambio: (selector: string, prop: string, valor: string) => void;
  pendientes: number;
  onGuardar: () => void;
  onDescartar: () => void;
}) {
  const sel = seleccion?.selector;
  const px = (v: string) => (v ? String(Math.round(parseFloat(v))) : "");
  const listaTokens = Object.entries(tokens);
  return (
    <div className="max-h-[45%] shrink-0 overflow-y-auto border-b border-border/60 bg-muted/30 px-3 py-2" aria-label="Editor de estilos">
      {sel && seleccion ? (
        <>
          <p className="mb-1.5 truncate font-mono text-[10px] text-muted-foreground" title={sel}>
            &lt;{seleccion.etiqueta}&gt; · {sel}
          </p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 sm:grid-cols-4">
            <Campo etiqueta="Color">
              <ColorCampo etiqueta="Color del texto" valor={valor(sel, "color", seleccion.estilos.color)} onCambio={(v) => onCambio(sel, "color", v)} />
            </Campo>
            <Campo etiqueta="Fondo">
              <ColorCampo etiqueta="Color de fondo" valor={valor(sel, "background-color", seleccion.estilos["background-color"])} onCambio={(v) => onCambio(sel, "background-color", v)} />
            </Campo>
            <Campo etiqueta="Tamaño (px)">
              <input
                type="number"
                min={8}
                max={200}
                aria-label="Tamaño de letra"
                value={px(valor(sel, "font-size", seleccion.estilos["font-size"]))}
                onChange={(e) => onCambio(sel, "font-size", e.target.value ? `${e.target.value}px` : "")}
                className={claseInput}
              />
            </Campo>
            <Campo etiqueta="Peso">
              <select
                aria-label="Peso de la letra"
                value={valor(sel, "font-weight", seleccion.estilos["font-weight"])}
                onChange={(e) => onCambio(sel, "font-weight", e.target.value)}
                className={claseInput}
              >
                {[...new Set([valor(sel, "font-weight", seleccion.estilos["font-weight"]), ...PESOS])].filter(Boolean).map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Relleno">
              <input aria-label="Relleno" value={valor(sel, "padding", seleccion.estilos.padding)} onChange={(e) => onCambio(sel, "padding", e.target.value)} className={claseInput} />
            </Campo>
            <Campo etiqueta="Radio (px)">
              <input
                type="number"
                min={0}
                max={200}
                aria-label="Radio de las esquinas"
                value={px(valor(sel, "border-radius", seleccion.estilos["border-radius"]))}
                onChange={(e) => onCambio(sel, "border-radius", e.target.value ? `${e.target.value}px` : "")}
                className={claseInput}
              />
            </Campo>
            <Campo etiqueta="Alineación">
              <select
                aria-label="Alineación del texto"
                value={valor(sel, "text-align", seleccion.estilos["text-align"])}
                onChange={(e) => onCambio(sel, "text-align", e.target.value)}
                className={claseInput}
              >
                {[...new Set([valor(sel, "text-align", seleccion.estilos["text-align"]), "left", "center", "right", "justify"])].filter(Boolean).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Interletrado">
              <input aria-label="Interletrado" value={valor(sel, "letter-spacing", seleccion.estilos["letter-spacing"])} onChange={(e) => onCambio(sel, "letter-spacing", e.target.value)} className={claseInput} />
            </Campo>
          </div>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">Toca un elemento de la página para cambiar su estilo, o ajusta los tokens de abajo.</p>
      )}

      {listaTokens.length > 0 && (
        <details className="mt-2" open={!sel}>
          <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Tokens de la página ({listaTokens.length})
          </summary>
          <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {listaTokens.map(([nombre, v]) => (
              <Campo key={nombre} etiqueta={nombre}>
                <ColorCampo etiqueta={`Token ${nombre}`} valor={valor(":root", nombre, v)} onCambio={(nv) => onCambio(":root", nombre, nv)} />
              </Campo>
            ))}
          </div>
        </details>
      )}

      <div className="mt-2 flex items-center justify-end gap-2">
        {pendientes > 0 && <span className="mr-auto text-[10px] text-muted-foreground">{pendientes} elemento(s) con cambios sin guardar</span>}
        <Button size="sm" variant="ghost" className="h-7 text-[11px]" disabled={!pendientes} onClick={onDescartar}>
          Descartar
        </Button>
        <Button size="sm" className="h-7 text-[11px]" disabled={!pendientes} onClick={onGuardar}>
          Guardar en el código
        </Button>
      </div>
    </div>
  );
}
