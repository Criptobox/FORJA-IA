/** Forja IA — Cuánto contexto necesita cada turno (Plan Maestro 2026 §7).
 *
 * Hasta ahora el prompt solo distinguía dos casos: el turno trivial («hola»),
 * que no llevaba nada, y todos los demás, que lo llevaban todo. Una pregunta
 * como «¿qué hace esta función?» recibía el mismo bloque de dirección de
 * diseño que «hazme una landing», y eso son miles de caracteres que el modelo
 * lee para nada.
 *
 * Aquí se decide el nivel del turno:
 *
 *   L0 — trivial: saludo o cortesía (`turno-trivial.ts`).
 *   L1 — pregunta: explicar o consultar, sin pedir cambios.
 *   L2 — retoque: cambiar algo concreto de lo que ya existe.
 *   L3 — feature: crear una UI nueva o añadir una funcionalidad.
 *   L4 — proyecto: arquitectura, refactor o migración de todo el proyecto.
 *   L5 — auditoría: revisar el proyecto entero con evidencia e historial.
 *
 * ——— La regla de esta casa ———
 *
 * El error caro es el de bajar de nivel: quitarle a un encargo de verdad el
 * contexto que necesita. Por eso, ante la duda, se sube. Un mensaje que no
 * encaja claramente en L1 o L2 es L3, que es lo que se mandaba antes.
 *
 * Función pura: se prueba sin navegador.
 */
import { esEncargoUINueva } from "./design-directions";
import { normalizar } from "./turno-trivial";

export type NivelContexto = 0 | 1 | 2 | 3 | 4 | 5;

export const ETIQUETA_NIVEL: Record<NivelContexto, string> = {
  0: "L0 · trivial",
  1: "L1 · pregunta",
  2: "L2 · retoque",
  3: "L3 · feature",
  4: "L4 · proyecto",
  5: "L5 · auditoría",
};

// Los patrones se aplican sobre el texto `normalizar()`-ado: minúsculas, sin
// tildes ni signos. Por eso no llevan acentos.
const AUDITORIA =
  /\b(audita|auditoria|auditar|revisa (todo|toda|el proyecto|la web entera|la app entera)|analiza (todo|el proyecto|toda la)|diagnostico completo|informe de calidad|regresion completa|haz un repaso completo)\b/;
const PROYECTO =
  /\b(arquitectura|refactoriza|refactorizar|refactor|reestructura|reestructurar|reorganiza|migra|migrar|todo el proyecto|toda la aplicacion|toda la app|separa en (modulos|componentes|archivos))\b/;
const FEATURE =
  /\b(anade|agrega|incorpora|implementa|mete|integra)\b.{0,30}\b(seccion|pagina|pantalla|vista|funcionalidad|feature|modal|formulario|carrito|login|registro|buscador|filtro|dashboard|panel|mapa|galeria|blog|checkout|pago|pasarela)\b/;
const RETOQUE =
  /\b(cambia|cambiar|arregla|arreglar|corrige|corregir|ajusta|ajustar|pon|ponle|quita|quitar|borra|mueve|sube|baja|agranda|achica|reduce|aumenta|centra|alinea|oscurece|aclara|renombra|sustituye|reemplaza|actualiza|no funciona|no se ve|falla|se rompe|esta roto|bug)\b/;
const PREGUNTA_INICIO =
  /^(que|como|por que|porque|cual|cuales|donde|cuando|cuanto|cuantos|explica|explicame|dime|me explicas|sabes|puedes explicar|para que|en que)\b/;

export interface EntradaNivel {
  /** último mensaje del usuario */
  texto: string;
  /** decidido fuera (`esTurnoTrivial`) para no repetir la lógica */
  trivial: boolean;
}

export function nivelDeContexto({ texto, trivial }: EntradaNivel): NivelContexto {
  if (trivial) return 0;
  const crudo = (texto ?? "").trim();
  if (!crudo) return 3;
  const n = normalizar(crudo);

  if (AUDITORIA.test(n)) return 5;
  if (PROYECTO.test(n)) return 4;
  if (esEncargoUINueva(crudo) || FEATURE.test(n)) return 3;
  if (RETOQUE.test(n)) return 2;
  // Pregunta: empieza como pregunta o termina en «?», y no pide cambios
  // (eso ya lo habría cogido RETOQUE arriba). Un bloque de código pegado
  // suele ser «arregla esto» aunque no lo diga: se queda en L3.
  const pareceCodigo = /```|<[a-z][\s\S]*>|\{[\s\S]*\}/i.test(crudo);
  if (!pareceCodigo && (PREGUNTA_INICIO.test(n) || /\?\s*$/.test(crudo))) return 1;
  return 3;
}

/** Qué piezas pesadas del prompt viajan en cada nivel.
 *
 * - `diseno`: «completo» es el bloque entero de dirección (~4.000
 *   caracteres), «contrato» es la versión compacta con los tokens de la
 *   dirección ya fijada (~500) y «nada» es no mandar ningún bloque de diseño.
 * - `arquitecturaWeb`: el bloque del Design Architect de FORJA WEB (~2.200).
 * - `memoriaCompleta`: la memoria del proyecto entera además del Auto Context.
 */
export interface PiezasPorNivel {
  diseno: "completo" | "contrato" | "nada";
  arquitecturaWeb: boolean;
  memoriaCompleta: boolean;
}

export function piezasPorNivel(nivel: NivelContexto): PiezasPorNivel {
  switch (nivel) {
    case 0:
      return { diseno: "nada", arquitecturaWeb: false, memoriaCompleta: false };
    case 1:
      return { diseno: "nada", arquitecturaWeb: false, memoriaCompleta: false };
    case 2:
      return { diseno: "contrato", arquitecturaWeb: false, memoriaCompleta: false };
    case 3:
      return { diseno: "completo", arquitecturaWeb: true, memoriaCompleta: false };
    case 4:
    case 5:
      return { diseno: "completo", arquitecturaWeb: true, memoriaCompleta: true };
  }
}
