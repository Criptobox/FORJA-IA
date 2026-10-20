/** FORJA IA — Conocimiento del usuario: aquí se «entrena» FORJA IA a mano.
 *
 * Tercer nivel de entrenamiento (el primero son los prompts maestros, el
 * segundo el catálogo de habilidades): reglas y preferencias que el usuario
 * enseña y que viajan a TODOS los roles con prioridad sobre lo demás.
 *
 * Dos fuentes alimentan esta memoria:
 *   1. Manual: el usuario escribe «mi marca usa Inter y violeta #7C3AED» y
 *      queda como regla permanente.
 *   2. Automática: tras cada proyecto aprobado, aprendeDeExito() guarda qué
 *      decisiones sobrevivieron al Revisor sin correcciones.
 *
 * Persistencia: el núcleo no toca storage directamente. La función de carga
 * se inyecta (igual que la llamada al modelo) para que el módulo funcione en
 * Node, en el navegador o en tests: quien integre la conecta a su store
 * (zustand en FORJA IA) con las mismas claves.
 */

export interface ReglaAprendida {
  id: string;
  /** la regla en una frase, escrita para el modelo, no para el usuario */
  texto: string;
  /** de dónde salió */
  origen: "manual" | "exito";
  /** fecha ISO de creación */
  creada: string;
  /** usos desde que existe; las más usadas viajan primero */
  usos: number;
}

export interface MemoriaForja {
  reglas: ReglaAprendida[];
}

export const MEMORIA_DEFECTO: MemoriaForja = { reglas: [] };

/** Tope de memoria. La ventana de los modelos gratis manda: si se llena,
 * primero salen las menos usadas (y por eso contamos usos). */
export const MAX_REGLAS = 40;

export const CLAVE_MEMORIA = "forja.memoria";

/** Añade (o fusiona) una regla. Si ya existe una con el mismo texto, sube su
 * prioridad tocando usos en lugar de duplicar. Devuelve la memoria nueva. */
export function aprender(
  memoria: MemoriaForja,
  texto: string,
  origen: ReglaAprendida["origen"]
): MemoriaForja {
  const limpio = texto.trim().replace(/\s+/g, " ").slice(0, 220);
  if (!limpio) return memoria;
  const igual = memoria.reglas.find((r) => r.texto.toLowerCase() === limpio.toLowerCase());
  if (igual) {
    return {
      reglas: memoria.reglas.map((r) =>
        r.id === igual.id ? { ...r, usos: r.usos + 1 } : r
      ),
    };
  }
  const nueva: ReglaAprendida = {
    id: `r_${Date.now().toString(36)}_${memoria.reglas.length}`,
    texto: limpio,
    origen,
    creada: new Date().toISOString(),
    usos: 1,
  };
  const reglas = [nueva, ...memoria.reglas];
  if (reglas.length > MAX_REGLAS) {
    // fuera las menos usadas de origen éxito; las manuales siempre quedan
    const manuales = reglas.filter((r) => r.origen === "manual");
    const exito = reglas
      .filter((r) => r.origen === "exito")
      .sort((a, b) => a.usos - b.usos)
      .slice(0, MAX_REGLAS - manuales.length);
    reglas.length = 0;
    reglas.push(...manuales, ...exito);
  }
  return { reglas };
}

/** Tras un proyecto APROBADO: convierte las decisiones que nadie corrigió en
 * conocimiento. `decisiones` salen del bloque <decisiones> del Codificador;
 * solo sobreviven las que el Revisor no tocó. */
export function aprenderDeExito(
  memoria: MemoriaForja,
  decisiones: string[]
): MemoriaForja {
  let out = memoria;
  for (const d of decisiones.slice(0, 5)) {
    if (d.trim().length < 8) continue;
    out = aprender(out, `Preferencia validada en proyectos previos: ${d.trim()}`, "exito");
  }
  return out;
}

/** Las reglas que viajan en esta petición, ordenadas: manuales primero (son
 * ley), luego éxitos por usos. Recorta a 10: más reglas empiezan a competir
 * entre sí y el modelo obedece peor. */
export function reglasParaPrompt(memoria: MemoriaForja): string[] {
  const manuales = memoria.reglas.filter((r) => r.origen === "manual");
  const exito = memoria.reglas
    .filter((r) => r.origen === "exito")
    .sort((a, b) => b.usos - a.usos);
  return [...manuales, ...exito].slice(0, 10).map((r) => r.texto);
}

/** Las reglas también van al Codificador y al Revisor, pero filtradas: las
 * de estilo visual solo interesan al Diseñador; las de calidad, a todos. */
export function esReglaDeCalidad(texto: string): boolean {
  return /(accesibilidad|sem[aá]ntic|contraste|responsive|rendimiento|test|validar|bug|error)/i.test(
    texto
  );
}
