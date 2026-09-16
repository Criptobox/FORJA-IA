/** FORJA IA — PERFORMANCE GATE + REPRESENTATION (v4.5.0, correcciones §10 y §20).
 *
 * ─── §10: decidir la representación ───
 * FORJA debe saber cuándo usar 2D, 2.5D, 3D o WebGL. NO usar 3D porque sí.
 *
 *   2D      → marketing, contenido, documentación, sitios simples
 *   2.5D    → SaaS, portfolio, agencia, product, landing pages
 *             (layers, perspective, floating, parallax, tilt)
 *   3D      → product showcase, creative studio, architecture, fashion,
 *             gaming, technology, automotive
 *   WebGL   → SOLO cuando el beneficio visual justifica costo, peso,
 *             complejidad y performance
 *
 * Y SIEMPRE la cascada de fallback:
 *
 *   WebGL → 3D/CSS → 2.5D → 2D
 *
 * ─── §20: la puerta de rendimiento ───
 * Antes de activar WebGL/3D/large video/complex parallax/continuous
 * animation se evalúan: device capability, asset weight, number of animated
 * nodes, GPU cost, mobile performance. Si el beneficio no justifica el
 * costo: degradación AUTOMÁTICA por la cascada.
 *
 * El objetivo del usuario («lo más barato posible») coincide aquí con el
 * plan: WebGL externo se evita por defecto; 3D CSS logra el 90% del efecto
 * con 0 dependencias y 0 KB de librería.
 *
 * Reglas de la casa: sin red, sin React, TypeScript estricto, nunca lanza.
 */

/* -------------------------------- tipos ------------------------------------ */

export type RepresentacionEspacial = "2d" | "2.5d" | "3d" | "webgl";

/** La cascada de fallback del doc (de mayor a menor coste). */
export const CASCADA: ReadonlyArray<RepresentacionEspacial> = ["webgl", "3d", "2.5d", "2d"];

export interface EntradaPuerta {
  /** modo mínimo que preserva la intención de la experiencia; evita degradar 2.5D a 2D sin necesidad */
  modoMinimo?: RepresentacionEspacial;
  /** ¿la intención exige WebGL de verdad (video, partículas masivas, shaders)? */
  intencionExigeWebgl: boolean;
  /** peso estimado de activos añadidos por el modo, en KB */
  pesoActivosKb: number;
  /** nº de nodos animados simultáneos previstos */
  nodosAnimados: number;
  /** coste de GPU estimado por el patrón de animación */
  costeGpu: "alto" | "medio" | "bajo";
  /** ¿la experiencia es mobile-first (el usuario manda, pero se avisa)? */
  movilPrimero: boolean;
}

export interface DecisionPuerta {
  modo: RepresentacionEspacial;
  /** si hubo degradación: de qué modo venimos */
  degradadoDe?: RepresentacionEspacial;
  razon: string;
  /** los costes que justificaron (o no) el modo */
  evaluacion: string[];
}

/** Umbral del doc §20: nodos animados a partir de los que el coste empieza
 * a pesar en móvil. */
export const UMBRAL_NODOS_MOVIL = 12;
/** KB de activos a partir de los que el peso empieza a pesar. */
export const UMBRAL_PESO_KB = 150;

/* -------------------------------- lógica ----------------------------------- */

/** Evalúa la puerta: si el beneficio no justifica el costo, degrada por la
 * cascada. Automática (doc §20: «esto debe ser automático»). */
export function evaluarPuerta(entrada: EntradaPuerta, deseado: RepresentacionEspacial): DecisionPuerta {
  const orden: Record<RepresentacionEspacial, number> = { webgl: 0, "3d": 1, "2.5d": 2, "2d": 3 };
  const minimo = entrada.modoMinimo ?? "2d";
  // La receta puede exigir 2.5D/3D aunque el brief no use la palabra técnica.
  if (orden[deseado] > orden[minimo]) {
    deseado = minimo;
  }
  const ev: string[] = [];
  const idx = CASCADA.indexOf(deseado);
  let modo = CASCADA[idx < 0 ? CASCADA.length - 1 : idx];
  let degradadoDe: RepresentacionEspacial | undefined;

  ev.push(`modo deseado: ${deseado.toUpperCase()}`);
  ev.push(`peso de activos: ${entrada.pesoActivosKb} KB (umbral ${UMBRAL_PESO_KB}) · nodos animados: ${entrada.nodosAnimados} (umbral móvil ${UMBRAL_NODOS_MOVIL}) · GPU ${entrada.costeGpu}`);

  // degradaciones por la cascada, en orden
  const degradar = (hasta: RepresentacionEspacial, motivo: string): void => {
    if (CASCADA.indexOf(modo) > CASCADA.indexOf(hasta)) return;
    degradadoDe = modo;
    modo = hasta;
    ev.push(`degradación automática: ${motivo}`);
  };

  if (entrada.intencionExigeWebgl && entrada.pesoActivosKb > UMBRAL_PESO_KB * 2 && entrada.costeGpu === "alto") {
    degradar("3d", "WebGL solo cuando el beneficio justifica costo/peso/complejidad/performance (§10)");
  }
  if (modo === "webgl" && entrada.pesoActivosKb > UMBRAL_PESO_KB) {
    degradar("3d", `${entrada.pesoActivosKb} KB de activos no justificados por la intención`);
  }
  if (entrada.movilPrimero && entrada.nodosAnimados > UMBRAL_NODOS_MOVIL) {
    degradar("2.5d", `${entrada.nodosAnimados} nodos animados pesan en móvil (§20)`);
  }
  if (entrada.costeGpu === "alto" && modo === "3d" && entrada.movilPrimero) {
    degradar("2.5d", "coste de GPU alto con audiencia móvil");
  }
  if (modo === "2.5d" && minimo !== "2.5d" && minimo !== "3d" && minimo !== "webgl" && entrada.costeGpu === "bajo" && entrada.nodosAnimados <= 3 && entrada.pesoActivosKb === 0) {
    degradar("2d", "el efecto cabe en jerarquía y acabado: ni capas hace falta");
  }

  if (!degradadoDe) ev.push("el beneficio justifica el coste: modo confirmado");
  return {
    modo,
    degradadoDe,
    razon: degradadoDe ? `${degradadoDe.toUpperCase()} → ${modo.toUpperCase()} (puerta de rendimiento §20)` : `${modo.toUpperCase()} confirmado`,
    evaluacion: ev,
  };
}

/** El modo NATURAL de una intención (§10: cuándo encaja cada nivel). */
export function modoDeseado(intencion: string): RepresentacionEspacial {
  const m = (intencion || "").toLowerCase();
  if (/\b(webgl|shaders?|particulas|partículas|simulaci[óo]n|three\.?js)\b/.test(m)) return "webgl";
  if (/\b(3d|modelo 3d|objeto 3d|rotar|escaparate|showcase|automoci[óo]n|gaming|arquitectura)\b/.test(m)) return "3d";
  if (/\b(saas|portfolio|agencia|producto|landing|premium|parallax|capas|profundidad)\b/.test(m)) return "2.5d";
  return "2d";
}

/* ------------------------------- salidas ----------------------------------- */

export function seccionPuerta(d: DecisionPuerta): string {
  return [
    `# REPRESENTACIÓN + PERFORMANCE GATE (correcciones §10/§20)`,
    ...d.evaluacion.map((e) => `- ${e}`),
    `Decisión: ${d.razon}`,
    d.modo === "webgl"
      ? `WebGL activado: con fallback degradado y lazy-load del canvas.`
      : d.modo === "3d"
        ? `3D con CSS (transform-style: preserve-3d + perspective): 0 dependencias, 0 KB de librería.`
        : d.modo === "2.5d"
          ? `2.5D: capas + perspective + floating. Sin WebGL, sin librerías.`
          : `2D: jerarquía y acabado. El coste se invierte en contenido.`,
    `Fallback obligatorio: WebGL → 3D/CSS → 2.5D → 2D (prefers-reduced-motion incluido).`,
  ].join("\n");
}
