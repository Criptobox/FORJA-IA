/** FORJA IA — FORJA Adapter Layer hacia OpenDesign (v4.0.0, fase 2 del plan).
 *
 * La regla de integración principal del plan maestro:
 *
 *   FORJA decide  →  OpenDesign ejecuta  →  FORJA evalúa
 *
 * Este adaptador es la ÚNICA puerta entre FORJA IA y la infraestructura de
 * OpenDesign (daemon, agentes, skills, design systems, preview, export).
 * FORJA no conoce detalles internos del daemon: solo este contrato.
 *
 * Contrato (fase 2 del plan):
 *
 *   FORJA INPUT (PeticionForja + ADN 2.0 + dirección)
 *       ↓  peticionARequest()
 *   OpenDesignRequest (brief + design-system + skills + prompts)
 *       ↓  runtime.ejecutar()   ← daemon real | RuntimeLocal (sin red)
 *   OpenDesignArtifact (html, tokens, trazas)
 *       ↓  artifactAEvaluacion()
 *   FORJA Evaluation (inspector + anti-genérico + auditoría de sistema)
 *
 * `RuntimeLocal` implementa la MISMA interfaz que el daemon de OpenDesign
 * pero 100% determinista y sin red: compone HTML real desde el ADN 2.0 y la
 * dirección elegida. Así el MVP (sección 32 del plan) funciona HOY, y el día
 * que exista el fork de OpenDesign se enchufa su runtime sin tocar nada más.
 */

import type { DireccionDiseno, PeticionForja } from "./tipos";
import type { AdnVisual2 } from "./tipos-v4";
import { seccionAdn2 } from "./adn2";
import {
  type DesignSystemPrisma,
  auditarContraDesignSystem,
  resumenDesignSystem,
} from "./bridge-design-system";
import { detectarGenericidad } from "./antigenerico";
import { chequeosEstaticos, type HallazgoVision } from "./vision";
import { idV4 } from "./tipos-v4";

/* ------------------------------- contratos -------------------------------- */

/** Lo que FORJA pide al runtime. Todo dentro es texto y datos planos:
 * si OpenDesign cambia por dentro, esto NO cambia. */
export interface OpenDesignRequest {
  requestId: string;
  projectId: string;
  /** brief en texto (mensaje del usuario + contexto) */
  brief: string;
  /** dirección creativa elegida (nombre + concepto) */
  direccion: string;
  /** design system derivado del ADN 2.0 */
  designSystem: DesignSystemPrisma;
  /** skills a aplicar (ids del catálogo de FORJA) */
  skills: string[];
  /** prompts de los roles (diseñador/codificador/revisor) ya compuestos */
  prompts: { rol: string; system: string; user: string }[];
  /** máximos de seguridad del plan */
  limites: { maxIteraciones: number; maxCaracteres: number };
}

/** Lo que el runtime devuelve. */
export interface OpenDesignArtifact {
  requestId: string;
  /** HTML final autocontenido */
  html: string;
  tokensCss: string;
  designMd: string;
  /** quién/qué produjo el artefacto (agente o «runtime-local») */
  productor: string;
  /** trazas del runtime (pasos, duraciones) */
  trazas: string[];
  ok: boolean;
  error: string;
}

/** La interfaz que OpenDesign implementa. El módulo define el contrato; el
 * host pone el motor (BYOK, agentes, daemon…). Igual que LlamadaModelo. */
export interface RuntimeOpenDesign {
  readonly nombre: string;
  readonly tipo: "opendesign" | "local";
  ejecutar(req: OpenDesignRequest): Promise<OpenDesignArtifact>;
  /** skills disponibles en el runtime (si el runtime tiene catálogo propio) */
  skills?: () => string[];
  /** preview sandboxed (URL de vista previa) — el runtime real la da; el
   * local devuelve un data: URL corto solo para trazas, NO para renderizar */
  preview?: (artifact: OpenDesignArtifact) => string;
  /** exportación (zip/git/deploy) — el runtime real la implementa */
  exportar?: (artifact: OpenDesignArtifact) => { destino: string; ok: boolean };
}

/** Resultado de la evaluación FORJA sobre un artefacto. */
export interface EvaluacionPrisma {
  /** hallazgos del inspector estático */
  inspector: HallazgoVision[];
  /** auditoría contra el design system */
  sistema: ReturnType<typeof auditarContraDesignSystem>;
  /** informe anti-genérico (capa 1) */
  genericidad: ReturnType<typeof detectarGenericidad>;
  /** veredicto agregado del plan: PASS / WARN / FAIL */
  veredicto: "PASS" | "WARN" | "FAIL";
  resumen: string;
}

/* --------------------- FORJA INPUT → OpenDesignRequest ------------------- */

/** Convierte una petición FORJA en una request de OpenDesign. Aquí se
 * materializa el reparto del plan: FORJA decide (ADN, dirección, skills,
 * prohibiciones) y lo empaqueta para que OTRO ejecute. */
export function peticionARequest(
  p: PeticionForja,
  adn2: AdnVisual2,
  direccion: DireccionDiseno | null,
  ds: DesignSystemPrisma,
  projectId = "prisma"
): OpenDesignRequest {
  const secciones = [
    `# Brief`,
    p.mensaje.slice(0, 1200),
    p.codigoActual ? `\n# Código actual del proyecto\n(presente: ${p.codigoActual.length} caracteres; es una edición)` : "",
    p.reglasAprendidas?.length ? `\n# Reglas aprendidas del usuario\n- ${p.reglasAprendidas.slice(0, 8).join("\n- ")}` : "",
    p.conocimientoGlobal?.length ? `\n# Conocimiento destilado\n- ${p.conocimientoGlobal.slice(0, 6).join("\n- ")}` : "",
    `\n${seccionAdn2(adn2)}`,
    direccion ? `\n# Dirección creativa elegida\n${direccion.nombre} — ${direccion.concepto}` : "",
  ].filter(Boolean);

  const userCodificador = [
    `Construye la página completa (HTML autocontenido) para este brief.`,
    ...peticionARequest_restricciones(ds),
    `Entrega: un solo archivo HTML con CSS embebido. Sin redes externas obligatorias.`,
  ].join("\n");

  return {
    requestId: idV4("req"),
    projectId,
    brief: secciones.join("\n").slice(0, 6000),
    direccion: direccion ? `${direccion.nombre} — ${direccion.concepto}` : "(sin dirección previa)",
    designSystem: ds,
    skills: [],
    prompts: [
      { rol: "codificador", system: "Eres el Codificador de FORJA IA. Cumples el ADN y el design system al pie de la letra.", user: userCodificador },
      { rol: "revisor", system: "Eres el Revisor de FORJA IA. Auditas contra el ADN, el inspector y el informe anti-genérico.", user: `Audita la entrega contra:\n${resumenDesignSystem(ds)}` },
    ],
    limites: { maxIteraciones: 3, maxCaracteres: 120000 },
  };
}

function peticionARequest_restricciones(ds: DesignSystemPrisma): string[] {
  const out = [`Design system «${ds.nombre}»: ${resumenDesignSystem(ds).replace(/\n/g, " · ")}`];
  if (ds.colores.length) out.push(`Usa SOLO estos colores (más blanco/negro): ${ds.colores.join(", ")}.`);
  return out;
}

/* ------------------- OpenDesignArtifact → FORJA Evaluation ---------------- */

/** Evalúa un artefacto con las herramientas deterministas de FORJA:
 * inspector (17 chequeos), auditoría de sistema y anti-genérico capa 1.
 * Es la mitad de «FORJA evalúa»; la otra mitad es el Revisor con modelo. */
export function artifactAEvaluacion(artifact: OpenDesignArtifact, ds: DesignSystemPrisma): EvaluacionPrisma {
  const inspector = artifact.ok ? chequeosEstaticos(artifact.html) : [];
  const sistema = artifact.ok ? auditarContraDesignSystem(artifact.html, ds) : [];
  const genericidad = artifact.ok ? detectarGenericidad(artifact.html) : {
    sintomas: [], nivel: "bajo" as const, motivo: "", puntuacionIdentidad: 100, recordatorio: [],
  };
  const criticos = inspector.filter((h) => h.severidad === "critico").length;
  const sistemaCriticos = sistema.filter((h) => h.severidad === "critico").length;
  const veredicto: EvaluacionPrisma["veredicto"] =
    !artifact.ok || criticos > 0 || sistemaCriticos > 0
      ? "FAIL"
      : genericidad.nivel === "alto" || inspector.filter((h) => h.severidad === "aviso").length >= 3 || sistema.length >= 3
        ? "WARN"
        : "PASS";
  const resumen =
    veredicto === "PASS"
      ? `Entrega limpia: ${inspector.length} hallazgo(s) menor(es), identidad ${genericidad.puntuacionIdentidad}/100.`
      : veredicto === "WARN"
        ? `Entrega con reparos: ${inspector.length} hallazgo(s) del inspector, ${sistema.length} de sistema, genericidad ${genericidad.nivel}.`
        : `Entrega rechazada: ${criticos + sistemaCriticos} hallazgo(s) crítico(s).`;
  return { inspector, sistema, genericidad, veredicto, resumen };
}

/* ------------------------------ RuntimeLocal ------------------------------- */

/** Runtime de respaldo: compone HTML real desde el ADN 2.0 + dirección,
 * sin modelo y sin red. No es «la página bonita final» (eso la hace el
 * Codificador con modelo o el daemon de OpenDesign), pero cumple el sistema
 * (tokens, estructura, accesibilidad mínima) y permite que el MVP corra
 * offline de punta a punta. Determinista: mismo input → mismo HTML. */
export class RuntimeLocal implements RuntimeOpenDesign {
  readonly nombre = "runtime-local";
  readonly tipo = "local" as const;

  async ejecutar(req: OpenDesignRequest): Promise<OpenDesignArtifact> {
    const t0 = trazas();
    const ds = req.designSystem;
    const titulo = primeraLinea(req.brief).slice(0, 60) || "Proyecto FORJA";
    const html = [
      `<!doctype html>`,
      `<html lang="es">`,
      `<head>`,
      `<meta charset="utf-8">`,
      `<meta name="viewport" content="width=device-width, initial-scale=1">`,
      `<title>${escapar(titulo)}</title>`,
      `<style>`,
      ds.tokensCss.replace(":root", ":root").slice(0, 4000),
      `*{box-sizing:border-box;margin:0}`,
      `body{font-family:var(--font-texto);color:var(--color-dominante);background:#fff;line-height:1.6}`,
      `.envoltura{max-width:72rem;margin:0 auto;padding:var(--espacio-64) var(--espacio-24)}`,
      `h1,h2{font-family:var(--font-display);line-height:1.15}`,
      `h1{font-size:calc(2rem * var(--escala-modular))}`,
      `.accion{background:var(--color-acento);color:#fff;border:0;padding:var(--espacio-12) var(--espacio-24);border-radius:var(--radio);font-weight:600}`,
      `.accion:focus-visible{outline:3px solid var(--color-acento);outline-offset:2px}`,
      `.seccion{padding:var(--espacio-96) 0;border-top:1px solid #eee}`,
      `@media (prefers-reduced-motion: reduce){*{animation:none;transition:none}}`,
      `</style>`,
      `</head>`,
      `<body>`,
      `<main class="envoltura">`,
      `<header><h1>${escapar(titulo)}</h1><p>${escapar(req.direccion).slice(0, 160)}</p>`,
      `<button class="accion" type="button">Empezar</button></header>`,
      `<section class="seccion" aria-labelledby="t-sys"><h2 id="t-sys">Sistema</h2>`,
      `<p>Design system «${escapar(ds.nombre)}» — identidad: ${escapar(ds.identidad || "definida en DESIGN.md")}</p></section>`,
      `</main>`,
      `</body>`,
      `</html>`,
    ].join("\n");
    return {
      requestId: req.requestId,
      html,
      tokensCss: ds.tokensCss,
      designMd: ds.designMd,
      productor: this.nombre,
      trazas: [`html compuesto localmente en ${trazas() - t0}ms`, `tokens: ${ds.colores.length} colores`],
      ok: true,
      error: "",
    };
  }
}

/* ---------------------------- ejecutar en runtime -------------------------- */

/** Ejecuta una request en un runtime con guarda de fallos: si el runtime
 * lanza, el módulo NO lanza (devuelve artifact.ok=false con el error). */
export async function ejecutarEnRuntime(runtime: RuntimeOpenDesign, req: OpenDesignRequest): Promise<OpenDesignArtifact> {
  try {
    return await runtime.ejecutar(req);
  } catch (e) {
    return {
      requestId: req.requestId,
      html: "",
      tokensCss: req.designSystem.tokensCss,
      designMd: req.designSystem.designMd,
      productor: runtime.nombre,
      trazas: ["el runtime lanzó un error"],
      ok: false,
      error: e instanceof Error ? e.message : String(e).slice(0, 200),
    };
  }
}

/* ------------------------------- utilidades -------------------------------- */

function trazas(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? Math.round(performance.now())
    : Date.now() % 1000000;
}

function primeraLinea(brief: string): string {
  const l = brief.split("\n").find((x) => x.trim().length > 8 && !x.startsWith("#") && !x.startsWith("·"));
  return (l ?? "").replace(/[#*]/g, "").trim();
}

function escapar(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
