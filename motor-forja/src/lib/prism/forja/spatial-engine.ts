/** FORJA IA — SPATIAL ENGINE (v4.5.0, correcciones §5).
 *
 * FORJA tiene composición pero necesita pensar en ESPACIO. Este motor es
 * responsable de: layers, z-index semántico, perspective, depth, scale,
 * rotation, floating, overlap, parallax, camera y object positioning.
 *
 * La página deja de ser solamente
 *
 *   section → container → heading + text + cards
 *
 * y puede ser una ESCENA:
 *
 *   scene
 *    ├── background layer
 *    ├── grid layer
 *    ├── typography layer
 *    ├── hero object
 *    ├── floating UI layer
 *    ├── metric cards
 *    └── navigation layer
 *
 * El plan es DETERMINISTA (§17): la parte creativa repetible — spacing,
 * radios, z-index, primitivas de movimiento — se construye aquí, no la
 * inventa el modelo. Menos tokens, más consistencia.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

import type { ExperienciaDna } from "./experience-dna";
import type { RecetaExperiencia } from "./experience-recipes";

/* -------------------------------- tipos ------------------------------------ */

export interface CapaEspacial {
  id: string;
  /** z-index semántico (no adivinado): el orden ES el significado */
  z: number;
  x: string;
  y: string;
  scale?: number;
  rotate?: number;
  /** profundidad extra para parallax (px de desplazamiento por scroll) */
  depth?: number;
  /** qué ES esta capa, para que el Codificador no lo invente */
  contenido: string;
}

export interface ObjetoFocal {
  type: "image" | "3d" | "product" | "ui" | "tipografia" | "escena";
  position: string;
  scale: number;
  /** cómo se trata: rotación sutil, tilt al hover, flotación ambiente… */
  tratamiento: string;
}

export interface PlanEspacial {
  /** 0..1 */
  depth: number;
  /** 0..1 */
  perspective: number;
  layers: CapaEspacial[];
  focalObject?: ObjetoFocal;
}

/* ------------------------------ construcción ------------------------------- */

const PERSPECTIVAS: Record<string, string> = {
  "1": "900px",
  "2": "1200px",
  "3": "1400px",
  "4": "1600px",
  "5": "1800px",
  "6": "2000px",
  "7": "2200px",
  "8": "2400px",
};

/** La escena completa según la profundidad pedida. Determinista: los
 * z-index salen del orden semántico (fondo < retícula < contenido <
 * objeto < UI flotante < navegación), no de números mágicos. */
export function construirPlanEspacial(e: ExperienciaDna, r: RecetaExperiencia): PlanEspacial {
  const capas: CapaEspacial[] = [];
  const profundidad = Math.max(0, Math.min(1, e.spatial.depth));
  const capasPedidas = Math.max(2, Math.min(7, r.composicion.capas || e.spatial.layers));

  // 1 · fondo (siempre)
  capas.push({ id: "fondo", z: 0, x: "0", y: "0", contenido: "fondo del lienzo (color o textura sutil)", depth: 0 });
  if (profundidad >= 0.5 && capasPedidas >= 4) {
    capas.push({ id: "reticula", z: 1, x: "0", y: "0", contenido: "retícula técnica o de fondo (líneas 1px, opacidad baja)", depth: Math.round(10 + profundidad * 30) });
  }
  if (profundidad >= 0.7 && capasPedidas >= 5) {
    capas.push({ id: "ambiente", z: 2, x: "8%", y: "12%", contenido: "elemento ambiental de fondo (forma/geometría, movimiento lento)", scale: 1.1, depth: Math.round(20 + profundidad * 40) });
  }

  // 2 · objeto focal (el corazón de la escena)
  const tieneObjeto = e.object.visualWeight >= 0.5 && r.objeto.tipo !== "tipografia";
  if (tieneObjeto) {
    capas.push({
      id: "objeto",
      z: 3,
      x: r.composicion.asimetrica ? "62%" : "50%",
      y: "42%",
      scale: e.object.visualWeight >= 0.8 ? 1.15 : 1,
      rotate: e.object.use3d ? -8 : 0,
      contenido: `objeto focal (${r.objeto.tipo})`,
      depth: Math.round(30 + profundidad * 60),
    });
  }

  // 3 · tipografía
  capas.push({
    id: "tipografia",
    z: 4,
    x: r.composicion.asimetrica ? "8%" : "50%",
    y: r.composicion.asimetrica ? "34%" : "38%",
    contenido: r.composicion.escalaTipografica === "enorme" ? "tipografía display oversized" : "tipografía display",
    depth: Math.round(10 + profundidad * 20),
  });

  // 4 · UI flotante / métricas / cards
  if (r.superficies.floatingCards || capasPedidas >= 5) {
    capas.push({ id: "ui-flotante", z: 5, x: "70%", y: "62%", contenido: r.superficies.floatingCards ? "cards flotantes (superficie elevada)" : "UI flotante de apoyo", depth: Math.round(24 + profundidad * 30) });
  }
  if (capasPedidas >= 6) {
    capas.push({ id: "metricas", z: 6, x: "12%", y: "68%", contenido: "métricas flotantes (números tabulares)", depth: Math.round(18 + profundidad * 22) });
  }

  // 5 · navegación (siempre arriba)
  capas.push({ id: "navegacion", z: 10, x: "0", y: "0", contenido: r.navegacion.minimal ? "navegación mínima (logo + 2 acciones)" : "navegación estándar" });

  const perspectiva = PERSPECTIVAS[String(Math.max(1, Math.min(8, capas.length)))] ?? "1600px";
  const objetoFocal: ObjetoFocal | undefined = tieneObjeto
    ? {
        type: r.objeto.tipo === "objeto-3d" ? "3d" : r.objeto.tipo === "ui-producto" ? "ui" : r.objeto.tipo === "escena" ? "escena" : "product",
        position: r.composicion.asimetrica ? "derecha-centro" : "centro",
        scale: e.object.visualWeight >= 0.8 ? 1.15 : 1,
        tratamiento: e.interaction.tilt ? "tilt 3D al puntero" : e.object.use3d ? "rotación sutil continua" : "flotación ambiente lenta",
      }
    : undefined;

  return {
    depth: profundidad,
    perspective: Math.max(0, Math.min(1, e.spatial.perspective)),
    layers: capas,
    focalObject: objetoFocal,
  };
}

/* ------------------------------- salidas ----------------------------------- */

/** Bloque para prompts: la ESCENA con sus capas y su perspectiva. */
export function seccionPlanEspacial(p: PlanEspacial, perspectivaPx?: string): string {
  const lineas = [
    `# SPATIAL PLAN (la página es una escena, corrección §5)`,
    `Profundidad ${pct(p.depth)} · perspectiva ${perspectivaPx ?? "1600px"} · parallax por capa (depth = desplazamiento al scroll)`,
    `Capas de fondo a frente (z-index semántico, no adivinar):`,
    ...p.layers.map(
      (l) =>
        `  z${String(l.z).padStart(2)} · ${l.id} — ${l.contenido} · posición ${l.x}/${l.y}${l.scale ? ` · escala ${l.scale}` : ""}${l.rotate ? ` · rotación ${l.rotate}deg` : ""}${l.depth ? ` · parallax ${l.depth}px` : ""}`
    ),
  ];
  if (p.focalObject) {
    lineas.push(
      `Objeto focal: ${p.focalObject.type} en ${p.focalObject.position}, escala ${p.focalObject.scale}, tratamiento: ${p.focalObject.tratamiento}.`,
      `REGLA: cada capa tiene UN trabajo; el overlap es intencional (nada flota sin causa).`,
      `REGLA: todo transform 3D lleva perspective en el contenedor y prefers-reduced-motion respetado.`
    );
  }
  return lineas.join("\n");
}

/** La CSS de perspectiva/rejilla que viaja al Codificador como base
 * determinista (§17: construir determinísticamente lo repetible). */
export function cssEscenario(p: PlanEspacial, perspectivaPx?: string): string {
  if (p.depth < 0.4) return "";
  const px = perspectivaPx ?? "1600px";
  const capa = p.layers.find((l) => l.id === "objeto");
  return [
    `/* Escenario espacial (generado por FORJA Spatial Engine) */`,
    `.escena { perspective: ${px}; transform-style: preserve-3d; }`,
    capa ? `.escena .objeto-focal { transform: translateZ(${Math.round(p.depth * 60)}px); will-change: transform; }` : "",
    p.layers.some((l) => l.id === "reticula") ? `.escena .capa-fondo { transform: translateZ(-${Math.round(p.depth * 40)}px); }` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
