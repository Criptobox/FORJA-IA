"use client";
/** Prism AI — Lo que cada modelo demostró que NO le cabe.
 *
 * Un modelo puede existir, estar vivo y tener tu clave bien y aun así no
 * servirte: Groq contestó «Request too large … input tokens per minute (ITPM):
 * Limit 7000, Requested 21138» a una conversación de 21k tokens. El modelo
 * está perfecto; lo que no cabe es la conversación, y con esa cuenta no va a
 * caber nunca. Elegirlo otra vez es repetir el error a sabiendas.
 *
 * Esto lo recuerda. Con una regla que separa lo que se SABE de lo que se
 * supone:
 *
 *  · Si el proveedor dijo el número («Limit 7000»), se guarda ese: es su dato.
 *  · Si solo dijo «demasiado grande», se guarda **lo que se le pidió**, y a
 *    partir de ahí solo se descarta para mensajes IGUAL de grandes o más. Un
 *    mensaje más corto puede entrar de sobra, y prohibirlo sería inventarse un
 *    límite que nadie dijo.
 *
 * ——— Por qué caduca ———
 *
 * Muchos de estos topes son POR MINUTO, no del modelo: dentro de un rato el
 * mismo mensaje entra. Por eso la marca caduca sola. Sin caducidad, un pico de
 * tráfico de un martes dejaría un modelo apartado para siempre.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeLocalStorage } from "./store";

/** Cuánto vale una medición. Los límites por minuto se reponen; los del modelo
 * no, pero volver a probar cada seis horas cuesta un error y evita apartar
 * para siempre un modelo que ya iría bien. */
export const VIGENCIA_MS = 6 * 60 * 60 * 1000;

export interface LimiteMedido {
  /** tope que dijo el proveedor, en tokens. `null` si no lo dijo */
  limite: number | null;
  /** lo que se le pidió cuando dijo que no */
  rechazado: number;
  at: number;
}

export type Limites = Record<string, LimiteMedido>;

/** ¿Cabe un mensaje de `tokens` en este modelo, por lo que sabemos?
 *
 * `true` también cuando no se sabe nada: esto aparta modelos con pruebas, no
 * con sospechas. */
export function cabe(limites: Limites, modelKey: string, tokens: number, ahora: number): boolean {
  const m = limites[modelKey];
  if (!m) return true;
  if (ahora - m.at > VIGENCIA_MS) return true;
  if (m.limite != null) return tokens <= m.limite;
  // sin número del proveedor: solo se descarta lo igual de grande o más
  return tokens < m.rechazado;
}

/** Guarda una medición nueva. Gana la más restrictiva de la misma época: dos
 * negativas seguidas no pueden ampliar el límite. */
export function anotar(
  previo: LimiteMedido | undefined,
  nuevo: LimiteMedido,
  ahora: number
): LimiteMedido {
  if (!previo || ahora - previo.at > VIGENCIA_MS) return nuevo;
  const limite =
    previo.limite == null
      ? nuevo.limite
      : nuevo.limite == null
        ? previo.limite
        : Math.min(previo.limite, nuevo.limite);
  return { limite, rechazado: Math.min(previo.rechazado, nuevo.rechazado), at: nuevo.at };
}

/** La frase para el aviso. Con el número del proveedor si lo dio. */
export function motivoNoCabe(m: LimiteMedido | undefined, modelId: string): string {
  if (!m) return `«${modelId}» rechazó un mensaje de este tamaño.`;
  if (m.limite != null) {
    return `«${modelId}» admite ${m.limite.toLocaleString("es")} tokens de entrada y la conversación pide más.`;
  }
  return `«${modelId}» ya rechazó un mensaje de este tamaño (${m.rechazado.toLocaleString("es")} tokens).`;
}

interface LimitesState {
  limites: Limites;
  anotar: (modelKey: string, medicion: LimiteMedido) => void;
  /** una respuesta buena borra la marca: el tope era del minuto, no del modelo */
  limpiar: (modelKey: string) => void;
}

export const useLimites = create<LimitesState>()(
  persist(
    (set) => ({
      limites: {},
      anotar: (modelKey, medicion) =>
        set((s) => ({
          limites: {
            ...s.limites,
            [modelKey]: anotar(s.limites[modelKey], medicion, medicion.at),
          },
        })),
      limpiar: (modelKey) =>
        set((s) => {
          if (!s.limites[modelKey]) return s;
          const { [modelKey]: _fuera, ...resto } = s.limites;
          return { limites: resto };
        }),
    }),
    { name: "prism-limites-v1", storage: createJSONStorage(safeLocalStorage) }
  )
);
