/** FORJA IA — FORJA WEB diseña las apps con Tinta, dentro del chat.
 *
 * Con FORJA WEB elegido en el selector de modelo, pedir una app («hazme una
 * app para mi cafetería») ya no hace que el modelo escriba cientos de líneas
 * de HTML: el modelo elige piezas de la biblioteca Tinta (una receta corta),
 * el equipo de agentes la trabaja a la vista y la app completa —todas sus
 * pantallas— sale en la vista previa del chat. Sin botones aparte: es el
 * mismo chat y el mismo selector.
 *
 * Después se sigue hablando en el mismo chat: «ponla en modo oscuro», «quita
 * la barra de búsqueda», «cambia los textos a inglés»… El modelo recibe la
 * receta ACTUAL, devuelve la receta completa con el cambio, Tinta la redibuja
 * al momento y la vista previa se actualiza. Si solo se pregunta algo, el
 * modelo contesta sin receta y la app no se toca.
 *
 * Qué va por aquí y qué no:
 *  · App nueva con FORJA WEB → Tinta (si no es una app de gestión de datos:
 *    tareas, CRM, inventario… necesitan lógica y van por el camino de código).
 *  · Cualquier mensaje después, en una conversación que ya tiene app de Tinta
 *    → cambio sobre esa app.
 *  · Webs y landings → el sistema de FORJA WEB de siempre.
 *
 * Esta parte es pura: el motor (iframe) y la llamada al modelo se inyectan. */
import { esEncargoUINueva } from "../design-directions";
import { esEncargoDeApp } from "../modo-app";
import { ErrorTinta, type ClienteTinta, type RecetaTinta } from "./cliente";
import type { PedirModelo } from "./crear";
import { AYUDA_SIN_IA, cambioLocal, recetaDePlantilla } from "./cambios-locales";

/** «modelo» de lo que se hace sin IA: la biblioteca. */
export const MODELO_LOCAL = "forja::tinta";
import type { PasoCreacion, ProgresoCreacion } from "../progreso-creacion";

/** La app de Tinta que vive en un mensaje del chat. */
export interface AppTinta {
  receta: RecetaTinta;
  /** HTML completo. Solo lo guarda la versión más reciente (pesa); las
   *  anteriores conservan la receta, que basta para volver a dibujarlas. */
  html?: string;
  pantallas: { id: string; nombre: string }[];
  /** borrador del editor de Tinta (con lo tocado a mano); como el HTML, solo
   *  en la versión vigente */
  borrador?: unknown;
  /** modelo real que escribió la receta (no se enseña: responde «Forja IA») */
  modelo: string;
  llamadas: number;
  /** 1 la primera, y +1 en cada cambio */
  version: number;
}

/** Apps de trabajo con datos: necesitan lógica, no solo pantallas. */
const APP_FUNCIONAL =
  /\b(tareas?|to-?do|kanban|gestor|gesti[oó]n de|crud|crm|erp|inventario|stock|contabilidad|facturaci[oó]n|base de datos|backoffice|panel de (?:control|administraci[oó]n|admin)|administrador de|calculadora|juego|login real|con servidor|con backend)\b/i;

/** Pide expresamente código a mano: se respeta. */
const PIDE_CODIGO = /\b(con c[oó]digo|escribe el c[oó]digo|sin tinta|en react|en vue|en svelte|en angular|con next)\b/i;

export interface EntradaTinta {
  texto: string;
  /** la conversación ya tiene una app de Tinta */
  hayApp: boolean;
  /** imágenes adjuntas: Tinta no las ve, mejor el camino normal */
  imagenes: number;
  /** no hay ninguna IA conectada: todo lo que sea crear lo hace Tinta */
  sinIA?: boolean;
}

/** ¿Este mensaje con FORJA WEB lo resuelve Tinta? */
export function usaTinta(e: EntradaTinta): boolean {
  const t = (e.texto ?? "").trim();
  if (!t || e.imagenes > 0 || PIDE_CODIGO.test(t)) return false;
  if (e.hayApp) return true;
  if (e.sinIA) return esEncargoUINueva(t);
  return esEncargoUINueva(t) && esEncargoDeApp(t) && !APP_FUNCIONAL.test(t);
}

/** La receta en el formato que escribe el modelo (el del catálogo), para
 *  dársela como «pantalla actual» y que devuelva la misma con el cambio. */
export function recetaParaModelo(r: RecetaTinta): string {
  const o: Record<string, unknown> = {
    idea: r.brief,
    bloques: r.blocks.map((b) => (b.repeat ? { id: b.id, copias: b.repeat } : { id: b.id })),
    paleta: r.palette ?? null,
    tipografia: r.font ?? null,
    fondo: r.background ?? null,
    modo: r.mode === "dark" ? "oscuro" : "claro",
  };
  if (r.texts && Object.keys(r.texts).length) o.textos = r.texts;
  return JSON.stringify(o);
}

/** Lo que se enseña de la respuesta del modelo: su frase, sin la receta. */
export function textoVisible(texto: string): string {
  let t = String(texto ?? "");
  // fuera los bloques ```…``` (cerrados o no)
  let out = "";
  let i = 0;
  while (i < t.length) {
    const a = t.indexOf("```", i);
    if (a < 0) {
      out += t.slice(i);
      break;
    }
    out += t.slice(i, a);
    const b = t.indexOf("```", a + 3);
    if (b < 0) break;
    i = b + 3;
  }
  t = out;
  // receta suelta sin cerca: se corta desde la primera llave
  const llave = t.indexOf("{");
  if (llave >= 0 && /"(bloques|blocks)"/.test(t.slice(llave))) t = t.slice(0, llave);
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

export type PasoTurno = "arrancando" | "modelo" | "corrigiendo" | "equipo" | "dibujando" | "listo";

export interface ResultadoTurno {
  /** la frase del modelo, sin la receta */
  texto: string;
  /** la app nueva; ausente si el modelo solo conversó */
  app?: Omit<AppTinta, "version">;
  /** modelo real que respondió */
  modelo: string;
  avisos: string[];
}

/** Un turno del chat. Sin gastar IA siempre que se pueda:
 *  · primera versión: el equipo de agentes elige el diseño por sector, en local;
 *  · cambio: se aplica en local si se entiende (`cambios-locales.ts`);
 *  · solo si no se entiende y hay una IA conectada, se le pide la receta. */
export async function turnoTinta(o: {
  pedido: string;
  anterior?: AppTinta | null;
  /** hay alguna IA conectada para lo que no se entienda en local */
  hayModelo: boolean;
  modeloKey: string | null;
  signal: AbortSignal;
  cliente: ClienteTinta;
  pedirModelo: PedirModelo;
  mostrarEquipo?: (si: boolean) => void;
  onPaso?: (p: PasoTurno) => void;
}): Promise<ResultadoTurno> {
  const pedido = o.pedido.trim();
  if (!pedido) throw new ErrorTinta("Escribe qué quieres");
  const paso = (p: PasoTurno) => o.onPaso?.(p);
  const ant = o.anterior ?? null;
  paso("arrancando");
  await o.cliente.listo();

  const conEquipo = async (idea: string): Promise<Omit<AppTinta, "version">> => {
    paso("equipo");
    o.mostrarEquipo?.(true);
    try {
      const eq = await o.cliente.pedir("equipo", { idea }, { ms: 15 * 60_000, signal: o.signal });
      const receta = recetaDePlantilla(eq.plantilla, idea);
      if (!receta) throw new ErrorTinta("El equipo no devolvió un diseño. Vuelve a intentarlo.");
      paso("listo");
      return { receta, html: eq.html, pantallas: eq.pantallas, borrador: eq.borrador, modelo: MODELO_LOCAL, llamadas: 0 };
    } finally {
      o.mostrarEquipo?.(false);
    }
  };

  if (!ant) {
    const app = await conEquipo(pedido);
    return { texto: "Diseñada por el equipo con la biblioteca de Forja, sin gastar IA.", app, modelo: MODELO_LOCAL, avisos: [] };
  }

  const cat = await o.cliente.pedir("catalogo", {}, { signal: o.signal });
  const local = cambioLocal(pedido, ant.receta, cat);
  if (local?.rehacer) {
    const app = await conEquipo(ant.receta.brief || pedido);
    return { texto: "Otra propuesta del equipo, sin gastar IA.", app, modelo: MODELO_LOCAL, avisos: [] };
  }
  if (local) {
    paso("dibujando");
    const d = await o.cliente.pedir(
      "dibujar",
      {
        receta: local.receta,
        idea: local.receta.brief,
        ...(ant.borrador ? { borrador: ant.borrador } : {}),
        ...(local.textos ? { textos: local.textos } : {}),
      },
      { signal: o.signal }
    );
    paso("listo");
    return {
      texto: `Hecho, sin gastar IA: ${local.hechos.join(" · ")}.`,
      app: { receta: local.receta, html: d.html, pantallas: d.pantallas, borrador: d.borrador, modelo: MODELO_LOCAL, llamadas: 0 },
      modelo: MODELO_LOCAL,
      avisos: [],
    };
  }
  if (!o.hayModelo) {
    paso("listo");
    return { texto: AYUDA_SIN_IA, modelo: MODELO_LOCAL, avisos: [] };
  }

  // Lo que no se entiende en local, a la IA: recibe la receta actual.
  const ins = await o.cliente.pedir("instrucciones", { idea: `${ant.receta.brief}. ${pedido}`, actual: recetaParaModelo(ant.receta) }, { signal: o.signal });
  const usuario = `Lo que pide ahora la persona sobre su app: ${pedido}\n\nSi es un cambio, responde con una frase y la receta COMPLETA con el cambio aplicado (parte de la PANTALLA ACTUAL). Si solo pregunta, responde sin JSON.`;
  paso("modelo");
  let r = await o.pedirModelo({ sistema: ins.sistema, usuario, modeloKey: o.modeloKey, signal: o.signal, maxTokens: 2048 });
  let llamadas = 1;
  // Una respuesta sin JSON es conversación: la app no se toca.
  if (!r.texto.includes("{")) {
    paso("listo");
    return { texto: r.texto.trim() || "¿Qué quieres cambiar de la app?", modelo: r.modelKey, avisos: [] };
  }
  let leido = await o.cliente.pedir("leer", { texto: r.texto }, { signal: o.signal });
  if (!leido.ok) {
    paso("corrigiendo");
    const otra = `${usuario}\n\nTu respuesta anterior fue:\n${r.texto.slice(0, 3000)}\n\n${leido.correccion}`;
    r = await o.pedirModelo({ sistema: ins.sistema, usuario: otra, modeloKey: o.modeloKey, signal: o.signal, maxTokens: 2048 });
    llamadas++;
    leido = await o.cliente.pedir("leer", { texto: r.texto }, { signal: o.signal });
  }
  if (!leido.ok || !leido.receta) {
    throw new ErrorTinta(
      `La IA no devolvió un diseño válido (${leido.errores.slice(0, 2).join(" ") || "sin receta"}). Vuelve a intentarlo o prueba con otro modelo en Ajustes.`
    );
  }
  const receta = leido.receta;
  paso("dibujando");
  const d = await o.cliente.pedir("dibujar", { receta, idea: receta.brief || ant.receta.brief }, { signal: o.signal });
  paso("listo");
  return { texto: textoVisible(r.texto) || "Hecho.", app: { receta, html: d.html, pantallas: d.pantallas, borrador: d.borrador, modelo: r.modelKey, llamadas }, modelo: r.modelKey, avisos: leido.avisos };
}

/** La última app de Tinta de la conversación (la que se está editando). */
export function ultimaApp<M extends { role: string; error?: boolean; tintaApp?: AppTinta }>(mensajes: M[]): AppTinta | null {
  for (let i = mensajes.length - 1; i >= 0; i--) {
    const m = mensajes[i];
    if (m.role === "assistant" && !m.error && m.tintaApp) return m.tintaApp;
  }
  return null;
}

/** El resumen bajo la respuesta: qué cambió, en una línea. */
export function resumenApp(app: Pick<AppTinta, "pantallas" | "version">): string {
  const n = app.pantallas.length;
  return app.version === 1
    ? `Listo: ${n} ${n === 1 ? "pantalla" : "pantallas"} con la biblioteca de diseño de Forja. Pídeme cambios aquí mismo y la vista previa se actualiza.`
    : `Versión ${app.version} · ${n} ${n === 1 ? "pantalla" : "pantallas"}.`;
}

/** El panel «Creando tu app» del chat, con los pasos reales de Tinta. */
export function progresoTinta(p: { paso: PasoTurno; cambio: boolean }): ProgresoCreacion {
  const orden: PasoTurno[] = p.cambio
    ? ["arrancando", "modelo", "dibujando", "listo"]
    : ["arrancando", "modelo", "equipo", "listo"];
  const enCurso = p.paso === "corrigiendo" ? "modelo" : p.paso;
  const i = Math.max(0, orden.indexOf(enCurso));
  const titulos = p.cambio
    ? ["Abriendo tu app", "Aplicando tu cambio a la receta", "Redibujando la app", "Vista previa actualizada"]
    : ["Abriendo la biblioteca de diseño", "Eligiendo las piezas de la app", "El equipo de agentes la diseña", "Vista previa lista"];
  const ids: PasoCreacion["id"][] = ["modelo", "pensando", "escribiendo", "entrega"];
  const pasos: PasoCreacion[] = [
    { id: "encargo", titulo: p.cambio ? "Tu cambio" : "Tu encargo", estado: "done", meta: p.cambio ? "" : "app" },
    ...titulos.map((titulo, k) => ({
      id: ids[k],
      titulo,
      estado: (k < i ? "done" : k === i ? (p.paso === "listo" ? "done" : "running") : "pending") as PasoCreacion["estado"],
      meta: k === 1 && p.paso === "corrigiendo" ? "ajustando" : "",
    })),
  ];
  return {
    pasos,
    actual: i + 1,
    loader: p.paso === "equipo" || p.paso === "dibujando" ? "trabajando" : "pensando",
    archivos: [],
    terminado: false,
  };
}
