/** Forja IA — Lo que se comprueba ANTES de publicar (Plan Maestro 2026 §41, Sprint 8).
 *
 * Publicar en Netlify subía el ZIP tal cual. Nada impedía sacar a una URL
 * pública una página con una clave de API dentro del código, con un
 * `<script src="app.js">` que no existe o con «Teléfono: pendiente» a la
 * vista de todo el mundo.
 *
 * El plan pide una cadena antes de publicar:
 *
 *   BUILD → PRUEBAS → SEGURIDAD → SEO → ACCESIBILIDAD → RENDIMIENTO → DATOS → PUBLICAR
 *
 * No se reinventa ninguna comprobación: todo sale del verificador que ya usa
 * el agente (`web-verifier.ts`, la herramienta `verify_project`), de la
 * auditoría estática (`web-audit.ts`) y de la ejecución real de la página
 * (`runProjectInMemory`). Aquí solo se ordenan en etapas y se decide qué
 * BLOQUEA y qué solo avisa.
 *
 * ——— Qué bloquea ———
 *
 * Solo lo que publicaría algo roto o peligroso: no hay página de entrada, un
 * archivo local enlazado que no existe, errores al ejecutarla, o una
 * credencial en el código. Lo demás (SEO, accesibilidad, rendimiento, datos
 * pendientes) avisa: es tu web y tú decides. Y un bloqueo tampoco es una
 * cárcel: se puede publicar igualmente marcándolo a propósito (§66, la
 * decisión es del usuario).
 *
 * Funciones puras: se prueban sin navegador.
 */
import type { VerificationFinding, WebVerification } from "./web-verifier";
import { auditarWeb, type CategoriaAuditoria } from "./web-audit";
import { htmlATexto } from "./html-a-texto";

export type EtapaId = "build" | "pruebas" | "seguridad" | "seo" | "accesibilidad" | "rendimiento" | "datos";
export type EstadoEtapa = "ok" | "aviso" | "bloquea" | "sin-dato";

export interface Etapa {
  id: EtapaId;
  nombre: string;
  estado: EstadoEtapa;
  /** qué se encontró, legible */
  detalles: string[];
}

export interface PuertaPublicacion {
  etapas: Etapa[];
  /** hay algo que bloquea (se puede publicar igualmente, a propósito) */
  bloquea: boolean;
  avisos: number;
}

const NOMBRE: Record<EtapaId, string> = {
  build: "Build",
  pruebas: "Pruebas",
  seguridad: "Seguridad",
  seo: "SEO",
  accesibilidad: "Accesibilidad",
  rendimiento: "Rendimiento",
  datos: "Datos del negocio",
};

const ORDEN: EtapaId[] = ["build", "pruebas", "seguridad", "seo", "accesibilidad", "rendimiento", "datos"];

/** Hallazgos del verificador por etapa. Lo que no está aquí se ignora
 *  (p. ej. `inline-handler`, que es un consejo de estilo). */
const ETAPA_DE: Record<string, EtapaId> = {
  "empty-project": "build",
  "missing-entry": "build",
  "missing-package": "build",
  "missing-local-asset": "build",
  "runtime-error": "pruebas",
  "runtime-missing": "pruebas",
  "possible-secret": "seguridad",
  "html-lang": "accesibilidad",
  "img-alt": "accesibilidad",
  "interactive-name": "accesibilidad",
  "html-title": "seo",
  viewport: "rendimiento",
};

/** Marcas de contenido sin terminar que no deberían salir a una URL pública. */
const PENDIENTE =
  /\b(pendiente|por confirmar|por definir|lorem ipsum|tu (?:tel[eé]fono|correo|direcci[oó]n) aqu[ií]|xxx[-\s]?xxx|\+?1?\s?555[-\s]\d{3,4})\b/gi;

/** Frases con datos sin completar en el texto VISIBLE de las páginas. */
export function datosPendientes(files: Record<string, string>): string[] {
  const out = new Set<string>();
  for (const [ruta, contenido] of Object.entries(files)) {
    if (!/\.html?$/i.test(ruta)) continue;
    const texto = htmlATexto(contenido, 200_000);
    for (const m of texto.matchAll(PENDIENTE)) {
      const i = m.index ?? 0;
      const frase = texto.slice(Math.max(0, i - 30), i + m[0].length + 20).replace(/\s+/g, " ").trim();
      out.add(frase);
      if (out.size >= 6) return [...out];
    }
  }
  return [...out];
}

function peor(a: EstadoEtapa, b: EstadoEtapa): EstadoEtapa {
  const rango: Record<EstadoEtapa, number> = { "sin-dato": 0, ok: 1, aviso: 2, bloquea: 3 };
  return rango[b] > rango[a] ? b : a;
}

/**
 * Ordena en etapas lo que dijo el verificador (con la ejecución real ya
 * dentro), la auditoría estática del HTML de entrada y los datos pendientes.
 */
export function puertaPublicacion(
  verificacion: WebVerification,
  htmlEntrada: string | null,
  pendientes: readonly string[]
): PuertaPublicacion {
  const etapas = new Map<EtapaId, Etapa>(
    ORDEN.map((id) => [id, { id, nombre: NOMBRE[id], estado: "ok" as EstadoEtapa, detalles: [] }])
  );
  const anotar = (id: EtapaId, estado: EstadoEtapa, detalle: string) => {
    const e = etapas.get(id);
    if (!e) return;
    // «sin dato» sustituye a un «ok» (sin evidencia no hay OK), pero no a un
    // aviso ni a un bloqueo, que sí son evidencia.
    e.estado = estado === "sin-dato" ? (e.estado === "ok" ? "sin-dato" : e.estado) : peor(e.estado, estado);
    if (detalle && !e.detalles.includes(detalle) && e.detalles.length < 5) e.detalles.push(detalle);
  };

  for (const f of verificacion.findings as VerificationFinding[]) {
    const id = f.id.startsWith("visual-") ? (f.id === "visual-missing" || f.id === "visual-no-evidence" ? null : "accesibilidad") : ETAPA_DE[f.id];
    if (!id) continue;
    // Bloquea lo que rompe o expone; en «pruebas», solo errores reales al
    // ejecutar (no la falta de evidencia, que es cosa nuestra).
    const bloqueante = f.severity === "error" && (id === "build" || id === "seguridad" || f.id === "runtime-error");
    anotar(id, bloqueante ? "bloquea" : f.id === "runtime-missing" ? "sin-dato" : "aviso", f.message);
  }

  // SEO y rendimiento, con su categoría (el verificador las aplana)
  if (htmlEntrada) {
    for (const h of auditarWeb(htmlEntrada).hallazgos) {
      const id: EtapaId = ({ seo: "seo", rendimiento: "rendimiento", accesibilidad: "accesibilidad" } as Record<CategoriaAuditoria, EtapaId>)[h.categoria];
      if (h.severidad === "warning") anotar(id, "aviso", h.mensaje);
    }
  }

  for (const p of pendientes) anotar("datos", "aviso", `«${p}»`);

  const lista = ORDEN.map((id) => etapas.get(id)).filter((e): e is Etapa => !!e);
  return {
    etapas: lista,
    bloquea: lista.some((e) => e.estado === "bloquea"),
    avisos: lista.filter((e) => e.estado === "aviso").length,
  };
}
