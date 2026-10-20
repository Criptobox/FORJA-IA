/** Forja IA — El contrato de diseño del proyecto (Plan Maestro 2026 §5).
 *
 * Una vez que un proyecto tiene dirección visual, esa dirección manda: el
 * plan lo dice como regla negativa, «NO cambiar la identidad aprobada sin
 * autorización». Hasta ahora no se cumplía por dos motivos:
 *
 *  1. La memoria guardaba el NOMBRE de la dirección («Editorial de revista») y
 *     la rotación comparaba con el ID («editorial»). Nunca coincidían: ni se
 *     evitaba repetir, ni se sabía cuál era la del proyecto.
 *  2. Un retoque («cambia el botón») no llevaba ningún dato de diseño, así que
 *     el modelo podía inventarse un azul nuevo en mitad de una paleta terracota.
 *
 * Aquí se lee la dirección fijada de la memoria y se da una versión compacta
 * para los retoques: solo los tokens (paleta, tipografía, forma), ~500
 * caracteres en vez de los ~4.000 del bloque completo.
 *
 * Funciones puras: se prueban sin navegador.
 */
import { direccionPorId, idPorNombre, type DireccionVisual } from "./design-directions";
import type { DisenoUsado } from "./memoria-proyecto";
import { normalizar } from "./turno-trivial";

/** El id de una entrada de la memoria, venga guardada con id o con nombre
 *  (las memorias antiguas guardaban el nombre legible). */
export function idDeDiseno(d: Pick<DisenoUsado, "direccion">): string | null {
  const v = (d.direccion ?? "").trim();
  if (!v) return null;
  if (direccionPorId(v)) return v;
  return idPorNombre(v);
}

/** Ids de las direcciones recientes, para la rotación. */
export function idsRecientes(disenos: readonly DisenoUsado[], cuantos = 4): string[] {
  return disenos
    .slice(0, cuantos)
    .map(idDeDiseno)
    .filter((x): x is string => !!x);
}

/** La dirección fijada del proyecto: la última usada que sea una dirección
 *  del catálogo. Las entradas que no lo son (un turno con «referencia
 *  adjunta») se saltan: no borran la identidad que ya había. */
export function direccionDelProyecto(disenos: readonly DisenoUsado[]): DireccionVisual | null {
  for (const d of disenos) {
    const id = idDeDiseno(d);
    if (id) return direccionPorId(id);
  }
  return null;
}

/** ¿El usuario pide expresamente cambiar de estilo o empezar otro proyecto?
 *  Es la «autorización» del plan para romper el contrato. */
export function pideCambioDeEstilo(texto: string): boolean {
  const n = normalizar(texto ?? "");
  return /\b(otro estilo|otra estetica|otra direccion|otro diseno|nuevo estilo|nueva estetica|nueva direccion|cambia el estilo|cambia la estetica|cambia la direccion|cambia el diseno|redisena|rediseno|desde cero|otra web|nueva web|otro proyecto|nuevo proyecto|otra pagina distinta)\b/.test(
    n
  );
}

/** Tokens de la dirección fijada, para retoques. Corto a propósito. */
export function contratoCompacto(d: DireccionVisual): string {
  return [
    `## CONTRATO DE DISEÑO del proyecto — ${d.nombre} (${d.id})`,
    "Es la identidad ya fijada. Todo cambio la respeta: no introduzcas colores, fuentes ni radios que no estén aquí.",
    `Paleta (OKLCH): fondo ${d.paleta.fondo} · superficie ${d.paleta.superficie} · texto ${d.paleta.texto} · secundario ${d.paleta.textoSuave} · acento ${d.paleta.acento} · acento2 ${d.paleta.acento2}.`,
    `Tipografía: ${d.fuentes.display} (display) + ${d.fuentes.cuerpo} (cuerpo) + ${d.fuentes.mono} (mono).`,
    `Radios: ${d.radios}. Sombras: ${d.sombras}. Espaciado: ${d.espaciado}.`,
  ].join("\n");
}
