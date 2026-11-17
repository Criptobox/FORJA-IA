/** Forja IA — Por qué te contestó esto.
 *
 * Forja ya medía casi todo: qué contexto viajó, cuántos tokens dijo el
 * proveedor, si la caché acertó, si hubo failover, si se recortó el historial.
 * Y estaba **todo repartido**: un chip aquí, un panel allá, y varias cosas en
 * ningún sitio. Cuando una respuesta salía rara —y salen— no había forma de
 * reconstruir qué había pasado.
 *
 * Esta es la ficha de UNA respuesta, guardada con ella. Es lo que yo querría
 * abrir cuando algo no cuadra, y es lo que ninguna otra app de chat enseña:
 * no una valoración, sino **el expediente**.
 *
 * ——— La regla de siempre ———
 *
 * Aquí no se estima nada que no se sepa. Cada campo es opcional y lo que falta
 * se dice que falta. Un expediente con huecos sirve; uno relleno a ojo, no —
 * sería exactamente lo contrario de para lo que existe.
 */
import type { ContextoUsado } from "./contexto-usado";
import { fmtDinero } from "./precios";

export interface IntentoFallido {
  modelo: string;
  proveedor: string;
  /** código HTTP, 0 si no hubo respuesta */
  status: number;
  /** qué se decidió hacer: seguir en la cadena, saltar de proveedor, parar */
  decision: string;
  motivo?: string;
  /** lo que tardó ese intento hasta fallar */
  ms?: number;
}

/** El fallo en palabras: un 429 no le dice nada a nadie; «se acabó la cuota»,
 *  sí. Solo traduce códigos que significan siempre lo mismo; si no, el texto
 *  del proveedor (recortado) habla por sí mismo. */
export function fallo(i: Pick<IntentoFallido, "status" | "motivo">): string {
  const m = (i.motivo ?? "").toLowerCase();
  if (i.status === 429 || /quota|rate.?limit|cuota|too many requests/.test(m)) return "se acabó su cuota";
  if (i.status === 413 || /too (large|long)|context length|maximum context|tokens? (limit|exceed)|no le cabe/.test(m)) return "el encargo no le cabe";
  if (i.status === 401 || i.status === 403) return "rechazó la clave";
  if (i.status === 404 || /not found|no endpoints|does not exist/.test(m)) return "ese modelo ya no existe";
  if (i.status >= 500) return "el proveedor falló por su lado";
  if (i.status === 0) return /sin datos|inactiv|timeout|tiempo/.test(m) ? "se quedó callado demasiado tiempo" : "no contestó";
  if (/vac[ií]a|empty/.test(m)) return "contestó vacío";
  return (i.motivo ?? `error ${i.status}`).slice(0, 80);
}

const DECISION: Record<string, string> = { siguiente: "pasé al siguiente", failover: "cambié de proveedor", parar: "paré" };

export interface FichaRespuesta {
  /** modelo que acabó respondiendo, «proveedor::modelo» */
  modelo?: string;
  /** los que fallaron ANTES, en orden. Vacío = respondió el primero */
  intentos?: IntentoFallido[];
  /** qué contexto entró en el prompt (ya lo calculaba `prompt-actual.ts`) */
  contexto?: ContextoUsado;
  /** caracteres del prompt de sistema montado */
  charsSistema?: number;
  /** mensajes de historial que se enviaron */
  mensajesEnviados?: number;
  /** mensajes que se apartaron por tamaño, y si se resumieron */
  recortados?: number;
  resumido?: boolean;
  /** la cuenta del proveedor, si la mandó */
  tokensEntrada?: number;
  tokensSalida?: number;
  tokensCache?: number;
  /** coste en dólares, solo si había tokens reales Y precio con fecha */
  coste?: number;
  /** de qué día es el precio con el que se calculó */
  precioDe?: string;
  /** por qué NO hay importe, cuando no lo hay. Es la mitad que falta dicha en
   * voz alta: sin esto, un hueco se lee como «la app no sabe contar». */
  sinCoste?: string;
  ms?: number;
}

/** Una línea por dato conocido. Lo que no se sabe NO sale: un expediente con
 * «sin dato» en catorce filas es ruido, y el hueco ya se nota por ausencia. */
export function lineasDeFicha(f: FichaRespuesta): { etiqueta: string; valor: string }[] {
  const out: { etiqueta: string; valor: string }[] = [];
  if (f.modelo) out.push({ etiqueta: "Respondió", valor: f.modelo });
  // Un intento por línea, con el motivo en palabras y lo que tardó: es lo que
  // hace falta para saber por qué una web no terminó.
  f.intentos?.forEach((i, k) => {
    const t = i.ms != null ? ` · ${(i.ms / 1000).toFixed(1)} s` : "";
    const d = DECISION[i.decision] ? ` → ${DECISION[i.decision]}` : "";
    out.push({ etiqueta: `Intento ${k + 1}`, valor: `${i.modelo}: ${fallo(i)}${t}${d}` });
  });
  if (f.mensajesEnviados != null) {
    out.push({ etiqueta: "Historial enviado", valor: `${f.mensajesEnviados} mensaje(s)` });
  }
  if (f.recortados) {
    out.push({
      etiqueta: "Apartado por tamaño",
      valor: `${f.recortados} mensaje(s)${f.resumido ? ", resumidos" : ", sin resumir"}`,
    });
  }
  if (f.charsSistema != null) {
    out.push({ etiqueta: "Prompt de sistema", valor: `${f.charsSistema.toLocaleString("es")} car.` });
  }
  if (f.tokensEntrada != null || f.tokensSalida != null) {
    const partes: string[] = [];
    if (f.tokensEntrada != null) partes.push(`${f.tokensEntrada} entrada`);
    if (f.tokensCache) partes.push(`${f.tokensCache} de caché`);
    if (f.tokensSalida != null) partes.push(`${f.tokensSalida} salida`);
    out.push({ etiqueta: "Tokens (dice el proveedor)", valor: partes.join(" · ") });
  }
  if (f.coste != null) {
    out.push({
      etiqueta: "Coste estimado",
      valor: `${fmtDinero(f.coste)}${f.precioDe ? ` · precios de ${f.precioDe}` : ""}`,
    });
  } else if (f.sinCoste) {
    out.push({ etiqueta: "Coste estimado", valor: f.sinCoste });
  }
  if (f.ms != null) out.push({ etiqueta: "Tardó", valor: `${(f.ms / 1000).toFixed(1)} s` });
  return out;
}

/** ¿Hay algo que enseñar? Con la ficha vacía no se pinta el botón: un botón
 * que abre un panel vacío se pulsa una vez y no se vuelve a mirar. */
export function hayFicha(f: FichaRespuesta | undefined): boolean {
  if (!f) return false;
  return lineasDeFicha(f).length > 0;
}

/** El titular: lo que explica la respuesta en una línea. Se elige lo más
 * llamativo de lo que pasó, no lo primero que haya. */
export function titularDeFicha(f: FichaRespuesta): string | null {
  if (f.intentos?.length) {
    return f.modelo
      ? `Respondió el ${f.intentos.length + 1}º modelo: los ${f.intentos.length} anteriores fallaron.`
      : `No terminó: fallaron ${f.intentos.length} ${f.intentos.length === 1 ? "modelo" : "modelos"} seguidos.`;
  }
  if (f.recortados) {
    return f.resumido
      ? `Se apartaron ${f.recortados} mensajes viejos y viajaron como resumen.`
      : `Se apartaron ${f.recortados} mensajes viejos para que cupiera.`;
  }
  if (f.tokensCache && f.tokensEntrada != null) {
    const total = f.tokensCache + f.tokensEntrada;
    if (total > 0) {
      return `${Math.round((f.tokensCache / total) * 100)} % del prompt entró por la caché.`;
    }
  }
  return null;
}
