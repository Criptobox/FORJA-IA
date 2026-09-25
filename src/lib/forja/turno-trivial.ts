/** Forja IA — Un saludo no es un encargo.
 *
 * Escribías «Hola» en una conversación donde ya habías pedido una página, y el
 * modelo contestaba con el bucle del agente entero: plan, pasos, y «he
 * actualizado index.html». Nadie le había pedido que tocara nada.
 *
 * No es culpa del modelo. Con el modo agente encendido, TODOS los turnos
 * llevaban delante la plantilla del agente —«estructuras tu respuesta
 * EXACTAMENTE con estas etiquetas», «continúa OBLIGATORIAMENTE»— más el
 * catálogo de herramientas. La regla que decía «si la tarea es trivial,
 * responde normal» era la número 4 de cinco, enterrada bajo dos mayúsculas
 * imperativas. Pedirle a un modelo gratis de 8k que se acuerde de esa línea
 * es confiar en la suerte; decidirlo aquí es determinista.
 *
 * Así que en un turno trivial no se manda la plantilla ni las herramientas.
 * El modelo no tiene con qué montar un plan y contesta como una persona.
 *
 * El riesgo de esta función es al revés de lo que parece: dar por trivial un
 * encargo de verdad sería quitarle el agente a quien lo necesita. Por eso todo
 * lo dudoso cuenta como NO trivial.
 */
import { classifyTask } from "./task-router";

/** Más de esto ya no es un saludo, sea lo que sea. */
const MAX_PALABRAS = 8;

/** Saludos y cortesías, como mensaje ENTERO. */
const CORTESIA =
  /^(hola|holas|buenas|buenos dias|buenas tardes|buenas noches|hey|ey|hi|hello|que tal|como estas|como va|todo bien|gracias|muchas gracias|mil gracias|ok|oka|okey|vale|perfecto|genial|entendido|listo|adios|chao|hasta luego|nos vemos|buen dia|saludos|test|prueba|probando)$/;

/** Señales de que hay un encargo, por corto que sea el mensaje. */
const HAY_ENCARGO =
  /(https?:\/\/|```|<[a-z]+>|\.(html?|css|js|ts|json|md|py|zip)\b|\barregl|\bcorrig|\bcambi|\bañad|\banade|\bagreg|\bquita|\bborra|\bcrea|\bhaz|\bhaz?me|\bpon|\bmejor|\bsigue|\bcontinua|\brevisa|\bexplica|\bresume|\btraduce|\bgenera|\bescrib|\bdiseñ|\bimplementa|\bactualiza|\binstala|\bprueba a\b)/;

/** Deja solo lo comparable: minúsculas, sin tildes, sin signos ni emoji. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ¿Este turno es un saludo o una cortesía, y no un encargo?
 *
 * Solo dice que sí cuando está claro: mensaje corto, sin nada que huela a
 * tarea, y que el clasificador tampoco reconoce como web/código/datos/etc.
 */
export function esTurnoTrivial(texto: string): boolean {
  const t = (texto ?? "").trim();
  if (!t) return false; // un mensaje vacío no se manda; no es asunto de aquí
  if (t.length > 80) return false;

  const n = normalizar(t);
  if (!n) return false; // solo signos o emoji: no se decide nada
  if (n.split(" ").length > MAX_PALABRAS) return false;
  if (HAY_ENCARGO.test(n)) return false;
  // el clasificador manda: si huele a web, código, datos, escritura o
  // razonamiento, esto no es un saludo
  if (classifyTask(t).kind !== "chat") return false;

  return CORTESIA.test(n);
}

/* ------------------------------------------------------------------ */
/* el historial de un saludo, sin código                              */
/* ------------------------------------------------------------------ */

/** Un bloque más corto que esto se deja: no pesa y puede ser la respuesta. */
const MIN_CODIGO_SALUDO = 300;

/** Lo que queda en lugar de cada bloque. Dice QUÉ había (para que el modelo
 *  pueda mencionarlo) y que en este turno no se reescribe. */
export function marcadorSaludo(lang: string, lineas: number, cortado: boolean): string {
  const que = lang ? `${lang}, ` : "";
  return `[código omitido (${que}${lineas} líneas${cortado ? ", se cortó a mitad" : ""}): este turno es un saludo — no lo reescribas; si quedó cortado, ofrece continuarlo]`;
}

/**
 * En un turno trivial, el código del historial no viaja.
 *
 * Quitar la plantilla del agente y el mapa no bastaba: el modelo seguía viendo
 * la página del turno anterior en el historial y, si se había cortado,
 * contestaba al «hola» reescribiéndola entera (miles de tokens de salida que
 * nadie pidió, y cortados otra vez en el mismo sitio). Sin el código delante
 * no tiene qué reescribir. Se cubren también los bloques SIN cerrar, que son
 * justo los de una respuesta cortada.
 *
 * La pregunta viva (`protegido`) no se toca.
 */
export function historialSinCodigo<T extends { role: string; content: string }>(
  mensajes: readonly T[],
  protegido = -1
): { mensajes: T[]; ahorrados: number } {
  let ahorrados = 0;
  const out = mensajes.map((m, i) => {
    if (i === protegido || m.role !== "assistant" || !m.content.includes("```")) return m;
    const lineas = m.content.split("\n");
    const res: string[] = [];
    for (let k = 0; k < lineas.length; k++) {
      const abre = lineas[k].match(/^[ \t]*```([^\n`]*)$/);
      if (!abre) {
        res.push(lineas[k]);
        continue;
      }
      let fin = k + 1;
      while (fin < lineas.length && !/^[ \t]*```\s*$/.test(lineas[fin])) fin++;
      const cortado = fin >= lineas.length;
      const cuerpo = lineas.slice(k + 1, fin);
      const texto = cuerpo.join("\n");
      if (texto.length < MIN_CODIGO_SALUDO) {
        res.push(...lineas.slice(k, Math.min(fin + 1, lineas.length)));
      } else {
        const lang = (abre[1] ?? "").trim().split(/\s+/)[0] ?? "";
        const nuevo = marcadorSaludo(lang, cuerpo.length, cortado);
        ahorrados += texto.length - nuevo.length;
        res.push(nuevo);
      }
      k = fin;
    }
    const content = res.join("\n");
    return content === m.content ? m : { ...m, content };
  });
  return { mensajes: out, ahorrados: Math.max(0, ahorrados) };
}
