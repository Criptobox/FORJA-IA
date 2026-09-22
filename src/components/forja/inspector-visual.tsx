"use client";
/** Forja IA — Inspector Visual: auditoría de la interfaz sobre el DOM vivo.
 *
 * Monta las reglas puras de `lib/forja/inspector-checks.ts` sobre la página
 * real: desbordes, botones mudos, imágenes sin alt, contraste y objetivos de
 * toque. La filosofía es la del repo: se mide, no se mira — lo que aquí se
 * lista tiene números detrás (rectángulos, ratios WCAG), no impresiones.
 *
 * Se abre desde Panel del sistema → pestaña Inspector. Escanea al abrir y con
 * «Volver a analizar». Los hallazgos se anuncian con aria-live="polite":
 * quien usa lector se entera de que el escaneo acabó sin que se le interrumpa.
 */
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ScanSearch } from "lucide-react";
import { EstadoPanel } from "@/components/ui/estado-panel";
import {
  inspeccionar,
  colorOpaco,
  reglasInspector,
  type ElementoInspeccionable,
  type ResumenInspector,
  type ReglaId,
  type Severidad,
} from "@/lib/forja/inspector-checks";
import { cn } from "@/lib/utils";

const COLOR_SEVERIDAD: Record<Severidad, string> = {
  // mismos tonos que auditan los tests de design-tokens (peligro/aviso/info)
  alta: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  media: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  baja: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
};

const ORDEN_SEVERIDAD: Severidad[] = ["alta", "media", "baja"];

/** Los objetivos interactivos que valen la pena auditar: elementos que SON
 *  controles o que lo declaran. Un div con cursor:pointer es sospecha, no
 *  prueba — solo los roles reales entran en la regla de nombre y de toque. */
const ETIQUETAS_OBJETIVO = new Set(["BUTTON", "A", "SUMMARY", "DETAILS"]);
const ROLES_OBJETIVO = new Set(["button", "link", "tab", "menuitem", "checkbox", "switch"]);

function esObjetivo(el: Element): boolean {
  if (ETIQUETAS_OBJETIVO.has(el.tagName)) return true;
  const rol = el.getAttribute("role");
  return rol !== null && ROLES_OBJETIVO.has(rol);
}

/** ¿Un ancestro recorta lo que se salga? Mismo criterio que responsive.spec:
 *  lo recortado no puede pintarse fuera, y contarlo sería un falso positivo. */
function loRecortaAlguien(el: Element): boolean {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const st = window.getComputedStyle(p);
    if (st.overflowX !== "visible" || st.overflowY !== "visible") return true;
  }
  return false;
}

/** Fondo EFECTIVO: el primero opaco subiendo por los ancestros. Un botón con
 *  fondo transparente se compara contra lo que de verdad hay detrás. */
function fondoEfectivo(el: Element): string | null {
  for (let p: Element | null = el; p; p = p.parentElement) {
    const opaco = colorOpaco(window.getComputedStyle(p).backgroundColor);
    if (opaco) return opaco;
    if (p === document.body) break;
  }
  return null;
}

/** ¿Tiene nodos de texto propios? (el contraste se mide en texto real) */
function tieneTextoDirecto(el: Element): boolean {
  for (const nodo of el.childNodes) {
    if (nodo.nodeType === Node.TEXT_NODE && (nodo.textContent ?? "").trim()) return true;
  }
  return false;
}

/** Traduce un Element del DOM a la descripción mínima que entienden las reglas. */
function describir(el: Element, _vw: number, _vh: number): ElementoInspeccionable {
  const st = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const ariaLabel = el.getAttribute("aria-label") ?? "";
  const title = el.getAttribute("title") ?? "";
  const texto = el.textContent ?? "";
  const rol = el.getAttribute("role");
  const esImagen = el.tagName === "IMG" || rol === "img";
  const objetivo = esObjetivo(el);
  const pista = `· ${el.getAttribute("class")?.split(/\s+/)[0] ?? ""}`.slice(0, 60);

  return {
    etiqueta: el.tagName,
    rol,
    // orden de resolución del nombre: aria-label > title > texto propio
    nombreAccesible: ariaLabel || title || texto,
    esImagen,
    alt: el.getAttribute("alt"),
    clickeable: objetivo,
    rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
    recortado: loRecortaAlguien(el),
    colorTexto: colorOpaco(st.color),
    colorFondo: fondoEfectivo(el),
    px: parseFloat(st.fontSize) || 0,
    peso: parseInt(st.fontWeight, 10) || 400,
    textoDirecto: tieneTextoDirecto(el),
    pista,
  };
}

/** Elementos que se auditan: los que pueden disparar ALGUNA regla. Todo el
 *  árbol entero sería 10.000 nodos de ruido; aquí solo entran objetivos
 *  interactivos, imágenes y elementos con texto propio. */
function elementosAuditables(): Element[] {
  return Array.from(document.querySelectorAll("body *")).filter((el) => {
    if (el.closest("[data-inspector-skip]")) return false;
    return esObjetivo(el) || el.tagName === "IMG" || tieneTextoDirecto(el);
  });
}

export function InspectorVisualBody() {
  const [escaneando, setEscaneando] = useState(true);
  const [resultado, setResultado] = useState<ResumenInspector | null>(null);
  const [cuando, setCuando] = useState<string>("");

  const escanear = useCallback(() => {
    setEscaneando(true);
    // un frame para que el propio diálogo pinte: auditar antes de existir
    // es medir decoraciones fantasma
    requestAnimationFrame(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const elementos = elementosAuditables().map((el) => describir(el, vw, vh));
      setResultado(inspeccionar(elementos, { ancho: vw, alto: vh }));
      setCuando(new Date().toLocaleTimeString());
      setEscaneando(false);
    });
  }, []);

  useEffect(() => {
    escanear();
  }, [escanear]);

  const reglas = reglasInspector();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Cabecera de la pestaña: botón + severidades con números reales */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <button
          type="button"
          onClick={escanear}
          aria-label="Volver a analizar la interfaz"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 bg-card/60 px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <RefreshCw className={cn("size-3.5", escaneando && "animate-spin")} aria-hidden="true" />
          Volver a analizar
        </button>
        {resultado && (
          <span className="flex flex-wrap items-center gap-1.5" aria-live="polite">
            {ORDEN_SEVERIDAD.map((sev) => {
              const n = resultado.porSeveridad[sev];
              if (n === 0) return null;
              return (
                <span
                  key={sev}
                  className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", COLOR_SEVERIDAD[sev])}
                >
                  {n} {sev === "alta" ? "altas" : sev === "media" ? "medias" : "bajas"}
                </span>
              );
            })}
            <span className="text-xs text-muted-foreground">
              {resultado.examinados} elementos · {cuando}
            </span>
          </span>
        )}
      </div>

      {/* Cuerpo: escaneando → cargando; sin hallazgos → vacío «todo en orden»;
          hallazgos → tarjetas por regla, las graves primero */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4" data-inspector-skip>
        {escaneando && (
          <EstadoPanel variante="cargando" titulo="Analizando la interfaz…" descripcion="Midiendo desbordes, nombres accesibles, contraste y objetivos de toque sobre el DOM vivo." />
        )}
        {!escaneando && resultado && resultado.hallazgos.length === 0 && (
          <EstadoPanel
            variante="vacio"
            titulo="Todo en orden"
            descripcion={`Ningún problema medible en ${resultado.examinados} elementos examinados. Las cinco reglas corrieron sobre la página actual.`}
          />
        )}
        {!escaneando && resultado && resultado.hallazgos.length > 0 && (
          <div className="flex flex-col gap-3">
            {reglas
              .filter((r) => resultado.porRegla[r.id] > 0)
              .sort((a, b) => ORDEN_SEVERIDAD.indexOf(a.severidad) - ORDEN_SEVERIDAD.indexOf(b.severidad))
              .map((regla) => {
                const items = resultado.hallazgos.filter((h) => h.regla === regla.id);
                return (
                  <section
                    key={regla.id}
                    className="rounded-lg border border-border/60 bg-card/60"
                    aria-label={`${regla.titulo}: ${items.length} hallazgos`}
                  >
                    <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 px-3 py-2">
                      <div className="min-w-0">
                        <h3 className="flex items-center gap-1.5 text-sm font-medium">
                          <ScanSearch className="size-3.5 text-muted-foreground" aria-hidden="true" />
                          {regla.titulo}
                          <span className="rounded-full bg-muted px-1.5 text-[11px] font-mono text-muted-foreground">
                            {items.length}
                          </span>
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">{regla.explicacion}</p>
                      </div>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", COLOR_SEVERIDAD[regla.severidad])}>
                        {regla.severidad}
                      </span>
                    </header>
                    <ul className="divide-y divide-border/30">
                      {items.slice(0, 8).map((h, i) => (
                        <li key={i} className="px-3 py-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                          {h.detalle}
                          {i === 7 && items.length > 8 && (
                            <span className="font-sans"> · y {items.length - 8} más</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
          </div>
        )}
      </div>

      <footer className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Audita solo lo visible AHORA: abre pestañas y diálogos y vuelve a analizar. Los adornos
        recortados por un ancestro no cuentan como desborde (mismo criterio que los tests e2e).
      </footer>
    </div>
  );
}

/** Tipo exportado para que el panel de sistema liste las reglas si mañana
 *  quiere una pestaña «qué mira esto». De momento solo mantiene el vínculo
 *  tipado entre panel y regla (ReglaId). */
export type { ReglaId };
