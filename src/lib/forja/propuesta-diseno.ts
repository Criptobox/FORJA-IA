/** Forja IA — Propuesta de diseño antes de construir (Plan Maestro 2026 §4, Sprint 4).
 *
 * «Design First, Code Second». Cuando se pide una web nueva, el chat la
 * construía directamente con la dirección que elegía el sistema. Si no gustaba,
 * había que rehacerla entera: miles de tokens por página para descubrir que el
 * estilo no era.
 *
 * Ahora, antes de construir, se enseña una PROPUESTA con:
 *  · tres direcciones visuales para comparar (paleta, tipografía, forma y
 *    composición), la recomendada primero;
 *  · las secciones que tendrá la página (el mismo plano de contenido que
 *    luego viaja al modelo);
 *  · los datos que el encargo trae y los que faltan. Los que faltan NO se
 *    inventan: salen marcados como pendientes (§21, anti-alucinación).
 *
 * El usuario elige una dirección (o pide construir sin propuesta), puede
 * añadir ajustes, y solo entonces se construye. La dirección elegida queda
 * fijada como contrato del proyecto (`contrato-diseno.ts`).
 *
 * **Coste de la propuesta: cero tokens.** Todo sale del catálogo de
 * direcciones y del plano de contenido, que son deterministas. No hay llamada
 * al modelo hasta que el usuario dice «construye».
 *
 * Funciones puras: se prueban sin navegador.
 */
import { DIRECCIONES, direccionPorId, elegirDireccion, esEncargoUINueva, type DireccionVisual } from "./design-directions";
import { esEncargoDeApp } from "./modo-app";
import { planoDelEncargo } from "./motor-chat";
import { normalizar } from "./turno-trivial";

export interface VarianteDireccion {
  id: string;
  nombre: string;
  cuando: string;
  paleta: DireccionVisual["paleta"];
  fuentes: DireccionVisual["fuentes"];
  radios: string;
  composicion: string;
  /** la que el sistema recomienda (la que habría usado sin propuesta) */
  recomendada: boolean;
  /** el encargo la pedía con palabras («minimalista», «cálido»…) */
  pedidaPorElUsuario: boolean;
}

export interface DatoEncargo {
  campo: string;
  /** lo que dio el usuario, o null si falta */
  valor: string | null;
}

export interface PropuestaDiseno {
  variantes: VarianteDireccion[];
  secciones: string[];
  datos: DatoEncargo[];
  /** id de la dirección elegida; ausente mientras se decide */
  elegida?: string;
  /** «directo»: el usuario pidió construir sin elegir */
  resuelta?: "elegida" | "directo";
}

/** Señales de que el usuario no quiere propuesta este turno. */
const SIN_PROPUESTA = /\b(directo|directamente|sin propuesta|sin preguntar|ya mismo|tal cual)\b/;

export interface EntradaDebeProponer {
  texto: string;
  /** hay una dirección ya fijada en el proyecto */
  hayDireccionFijada: boolean;
  /** el usuario pide cambiar de estilo (rompe el contrato) */
  pideCambioDeEstilo: boolean;
  /** imágenes adjuntas: una referencia visual ya es la dirección */
  imagenes: number;
  /** ajuste de Ajustes → Chat */
  activada: boolean;
}

/** ¿Toca enseñar una propuesta antes de construir? Solo en webs NUEVAS. */
export function debeProponer(e: EntradaDebeProponer): boolean {
  if (!e.activada) return false;
  const t = e.texto ?? "";
  if (!esEncargoUINueva(t)) return false;
  // Las apps tienen pantallas, no las secciones de una landing: el plano
  // de contenido no aplica y la propuesta enseñaría algo que no se construye.
  if (esEncargoDeApp(t)) return false;
  if (e.imagenes > 0) return false;
  if (SIN_PROPUESTA.test(normalizar(t))) return false;
  // Proyecto con identidad fijada: ya se decidió, salvo que pida otra.
  if (e.hayDireccionFijada && !e.pideCambioDeEstilo) return false;
  return true;
}

function variante(d: DireccionVisual, recomendada: boolean, pedida: boolean): VarianteDireccion {
  return {
    id: d.id,
    nombre: d.nombre,
    cuando: d.cuando,
    paleta: d.paleta,
    fuentes: d.fuentes,
    radios: d.radios,
    composicion: d.composicion,
    recomendada,
    pedidaPorElUsuario: pedida,
  };
}

/** Datos de contacto y negocio que una web suele necesitar. Los que el
 *  encargo no trae se enseñan como pendientes. */
function datosDelEncargo(texto: string): DatoEncargo[] {
  const h = planoDelEncargo(texto).hechos;
  const uno = (xs: string[]) => (xs.length ? xs.slice(0, 3).join(", ") : null);
  return [
    { campo: "Nombre", valor: h.marca || null },
    { campo: "Ubicación", valor: uno(h.ciudades) },
    { campo: "Horario", valor: uno(h.horarios) },
    { campo: "Teléfono", valor: uno(h.telefonos) },
    { campo: "Correo", valor: uno(h.correos) },
    { campo: "Precios", valor: uno(h.precios) },
  ];
}

/**
 * Tres direcciones para comparar: la recomendada (la misma que el sistema
 * habría usado) y dos más que no se hayan usado hace poco. Mismo encargo,
 * misma propuesta.
 */
export function construirPropuesta(texto: string, recientes: readonly string[] = []): PropuestaDiseno {
  const eleccion = elegirDireccion(texto, recientes);
  const primera = eleccion.direccion;
  // hash del encargo para que las alternativas varíen entre encargos pero
  // sean estables para el mismo
  let h = 7;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  const resto = DIRECCIONES.filter((d) => d.id !== primera.id);
  const frescas = resto.filter((d) => !recientes.includes(d.id));
  const pool = frescas.length >= 2 ? frescas : resto;
  const a = pool[h % pool.length];
  const b = pool[(h + 1 + Math.floor(pool.length / 2)) % pool.length];
  const otras = [a, ...(b.id !== a.id ? [b] : [pool[(h + 1) % pool.length]])].filter(
    (d, i, arr) => d.id !== primera.id && arr.findIndex((x) => x.id === d.id) === i
  );

  return {
    variantes: [
      variante(primera, true, eleccion.origen === "usuario"),
      ...otras.slice(0, 2).map((d) => variante(d, false, false)),
    ],
    secciones: planoDelEncargo(texto).secciones.map((s) => s.nombre),
    datos: datosDelEncargo(texto),
  };
}

/** Los datos que faltan, para decirle al modelo que NO los invente. */
export function datosPendientes(p: PropuestaDiseno): string[] {
  return p.datos.filter((d) => !d.valor).map((d) => d.campo.toLowerCase());
}

/** Instrucción que acompaña a la construcción tras elegir. Corta. */
export function instruccionPendientes(pendientes: readonly string[]): string | null {
  if (!pendientes.length) return null;
  return (
    `## DATOS QUE EL USUARIO NO HA DADO (no los inventes)\n` +
    `Faltan: ${pendientes.join(", ")}. Donde vayan, pon un marcador visible y honesto ` +
    `(«Teléfono: pendiente», «Horario por confirmar»), nunca un número, correo o dirección inventados.`
  );
}

/** La dirección elegida, si existe en el catálogo. */
export function direccionElegida(id: string | undefined): DireccionVisual | null {
  return id ? direccionPorId(id) : null;
}
