/** FORJA IA — Design System Bridge (v4.0.0, fase 9 del plan maestro).
 *
 * El puente completo del plan:
 *
 *   FORJA ADN  →  DESIGN.md  →  tokens.css  →  OpenDesign Design System
 *                →  skills    →  artifact
 *
 * y al revés: FORJA AUDITA que el resultado respeta el sistema. Este módulo
 * define el objeto `DesignSystem` intermedio (lo que un design system real
 * de OpenDesign esperaría encontrar) y la auditoría determinista que
 * comprueba, sobre el HTML generado, que colores, tipografías, espaciado y
 * accesibilidad del sistema se respetan. Sin red, sin modelo: puro.
 *
 * Regla del plan: «El Design System debe establecer reglas, no matar la
 * creatividad» — la auditoría solo marca hallazgos de SISTEMA (incoherencia
 * con lo declarado), nunca de gusto.
 */

import type { AdnVisual2 } from "./tipos-v4";
import { sanearAdn2 } from "./adn2";
import { designMdDesdeAdn2, tokensCssDesdeAdn2 } from "./exportadores-adn";
import type { HallazgoVision } from "./vision";

/* ------------------------------- tipos ------------------------------------ */

/** El objeto design-system intermedio: lo que FORJA entrega al runtime
 * (OpenDesign) y contra lo que audita. Estructura plana y serializable. */
export interface DesignSystemPrisma {
  nombre: string;
  /** DESIGN.md completo (fuente de verdad) */
  designMd: string;
  /** tokens.css completo */
  tokensCss: string;
  /** colores del sistema, normalizados a minúsculas hex */
  colores: string[];
  /** familias tipográficas declaradas */
  fuentes: string[];
  /** escala de espaciado en px */
  espaciado: number[];
  /** reglas de accesibilidad exigidas */
  accesibilidad: string[];
  /** reglas de motion */
  motion: string[];
  /** origen: qué ADN lo generó (resumen de identidad) */
  identidad: string;
}

/** Un hallazgo de auditoría de sistema. */
export interface HallazgoSistema extends HallazgoVision {
  /** qué regla del sistema se incumple */
  reglaSistema: string;
  /** causa probable (mismo contrato que el revisor visual) */
  causaProbable: string;
  /** corrección propuesta */
  correccion: string;
}

/* --------------------------- creación del sistema ------------------------- */

/** Extrae todos los hex citados en una lista de decisiones. */
function hexesDe(xs: string[]): string[] {
  const out: string[] = [];
  const vistos = new Set<string>();
  for (const x of xs) {
    for (const m of x.matchAll(/#[0-9a-f]{6}\b/gi)) {
      const h = m[0].toLowerCase();
      if (!vistos.has(h)) {
        vistos.add(h);
        out.push(h);
      }
    }
  }
  return out;
}

/** Crea el Design System desde un ADN 2.0. Determinista: mismo ADN → mismo
 * sistema (requisito de reproducibilidad del plan). */
export function crearDesignSystem(adn: AdnVisual2, nombreProyecto = "prisma"): DesignSystemPrisma {
  const a = sanearAdn2(adn);
  const colores = hexesDe([...a.color, ...a.composicion]);
  const fuentes: string[] = [];
  const vistos = new Set<string>();
  for (const t of a.tipografia) {
    for (const m of t.matchAll(/"([A-Za-zÀ-ÿ0-9 _-]{2,32})"/g)) {
      const f = m[1].trim();
      const clave = f.toLowerCase();
      if (!vistos.has(clave)) {
        vistos.add(clave);
        fuentes.push(f);
      }
    }
  }
  return {
    nombre: nombreProyecto,
    designMd: "", // se rellena abajo (evita dependencia circular en la inicialización)
    tokensCss: "",
    colores,
    fuentes,
    espaciado: [4, 8, 12, 16, 24, 32, 48, 64, 96],
    accesibilidad: [...a.accesibilidad],
    motion: [...a.movimiento],
    identidad: a.identidad,
  };
}

/** Versión completa: sistema con DESIGN.md y tokens.css generados. */
export function designSystemCompleto(
  adn: AdnVisual2,
  nombreProyecto = "prisma",
  fecha = ""
): DesignSystemPrisma {
  const ds = crearDesignSystem(adn, nombreProyecto);
  ds.tokensCss = tokensCssDesdeAdn2(adn, nombreProyecto);
  ds.designMd = designMdDesdeAdn2(adn, { nombreProyecto, fecha: fecha || undefined });
  return ds;
}

/* ----------------------------- auditoría ---------------------------------- */

function colorHexEn(texto: string): string[] {
  return [...texto.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase());
}

/** Audita un HTML contra el sistema: devuelve hallazgos de incoherencia.
 * Determinista y tolerante: solo marca lo que el sistema DECLARÓ. */
export function auditarContraDesignSystem(html: string, ds: DesignSystemPrisma): HallazgoSistema[] {
  const out: HallazgoSistema[] = [];
  if (!html) return out;

  // 1. Colores fuera del sistema (si el sistema declaró colores)
  if (ds.colores.length) {
    const usados = [...new Set(colorHexEn(html))];
    const permitidos = new Set([...ds.colores, "#ffffff", "#000000", "#14181f"]);
    const fuera = usados.filter((c) => !permitidos.has(c));
    if (fuera.length) {
      out.push({
        severidad: "aviso",
        categoria: "visual",
        titulo: `${fuera.length} color(es) fuera del design system`,
        detalle: `Usados: ${fuera.slice(0, 6).join(", ")}. Declarados: ${ds.colores.join(", ")}.`,
        causaProbable: "el Codificador improvisó tonos en vez de usar los tokens",
        correccion: `sustituir por los tokens declarados (var(--color-dominante) / var(--color-acento))`,
        reglaSistema: "color: solo los colores del sistema",
      });
    }
  }

  // 2. Fuentes fuera del sistema (si declaró)
  if (ds.fuentes.length) {
    const familiaUsada = html.match(/font-family\s*:\s*([^;}]+)/i)?.[1] ?? "";
    if (familiaUsada) {
      const citaAlguna = ds.fuentes.some((f) => familiaUsada.toLowerCase().includes(f.toLowerCase()));
      if (!citaAlguna) {
        out.push({
          severidad: "aviso",
          categoria: "estandares",
          titulo: "Tipografía fuera del sistema",
          detalle: `font-family «${familiaUsada.trim().slice(0, 60)}» no declara ninguna fuente del sistema (${ds.fuentes.join(", ")}).`,
          causaProbable: "fallback por defecto del generador",
          correccion: `usar var(--font-display) / var(--font-texto) del sistema`,
          reglaSistema: "tipografía: solo las familias declaradas",
        });
      }
    }
  }

  // 3. Azul por defecto = prohibición global del sistema
  if (/#3b82f6|#2563eb|#1d4ed8|rgb\(\s*59\s*,\s*130\s*,\s*246/i.test(html)) {
    out.push({
      severidad: "critico",
      categoria: "visual",
      titulo: "Azul por defecto de Tailwind en la entrega",
      detalle: "El sistema prohíbe el azul por defecto como identidad (ADN 2.0 / anti-patrones).",
      causaProbable: "plantilla base del modelo",
      correccion: "sustituir por el acento del sistema",
      reglaSistema: "color: prohibido el azul por defecto",
    });
  }

  // 4. Espaciado: escala 4px — detecta paddings/margins con valores raros
  const valoresRaros = [...html.matchAll(/(?:padding|margin)[^:;{}]*:\s*[^;{}]*?\b(\d{1,3})px/gi)]
    .map((m) => Number(m[1]))
    .filter((n) => n > 0 && n % 4 !== 0);
  if (valoresRaros.length >= 3) {
    out.push({
      severidad: "mejora",
      categoria: "estandares",
      titulo: `Espaciado fuera de la escala 4px (${valoresRaros.slice(0, 4).join("px, ")}px…)`,
      detalle: "El sistema declara escala de espaciado en múltiplos de 4.",
      causaProbable: "valores ajustados a ojo",
      correccion: "redondear a la escala (--espacio-*)",
      reglaSistema: "espaciado: múltiplos de 4",
    });
  }

  // 5. Accesibilidad mínima declarada
  if (!/<html[^>]*\slang=/i.test(html)) {
    out.push({
      severidad: "aviso",
      categoria: "accesibilidad",
      titulo: "Sin lang en <html>",
      detalle: "La accesibilidad mínima del sistema exige idioma declarado.",
      causaProbable: "plantilla base",
      correccion: "añadir lang=\"es\" (o el idioma del proyecto)",
      reglaSistema: "accesibilidad: mínimos del ADN",
    });
  }

  // 6. Motion: si el sistema pide respetar reduced-motion, verificar
  if (ds.motion.some((m) => /reduced-motion/i.test(m)) && /@keyframes|transition\s*:/i.test(html)) {
    if (!/prefers-reduced-motion/i.test(html)) {
      out.push({
        severidad: "aviso",
        categoria: "accesibilidad",
        titulo: "Animaciones sin prefers-reduced-motion",
        detalle: "El sistema de motion exige respetar prefers-reduced-motion.",
        causaProbable: "se animó sin la guarda",
        correccion: "añadir @media (prefers-reduced-motion: reduce) { … animation: none }",
        reglaSistema: "motion: respetar reduced-motion",
      });
    }
  }

  return out.slice(0, 10);
}

/** Resumen de sistema para el prompt del Revisor (compacto). */
export function resumenDesignSystem(ds: DesignSystemPrisma): string {
  return [
    `Design system «${ds.nombre}»`,
    `Identidad: ${ds.identidad || "—"}`,
    `Colores: ${ds.colores.join(", ") || "(derivados de tokens.css)"}`,
    `Fuentes: ${ds.fuentes.join(", ") || "(según ADN)"}`,
    `Escala de espaciado: ${ds.espaciado.join("/")}`,
    `Accesibilidad: ${ds.accesibilidad.join("; ") || "AA estándar"}`,
  ].join("\n");
}
