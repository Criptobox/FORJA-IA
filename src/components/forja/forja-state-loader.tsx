/** Forja IA — Estados animados del yunque para indicadores de progreso.
 *
 * Mismas piezas y gradientes que `ForjaLogo` (cara/cuerpo/base + chispa),
 * pero con las animaciones exactas de los mockups de marca (pensando,
 * buscando, trabajando, reparando, finalizado, generando y creando) en
 * vez del logo estático. El SVG y el CSS de cada estado están portados
 * 1:1 desde esos mockups — mismas coordenadas, mismos tiempos, mismos
 * colores — solo con las clases renombradas con el prefijo `fj-` para no
 * chocar con nada del resto de la app.
 *
 * `generando` tiene tres variantes visuales (mismo estado, distinto
 * adorno): `dots` (tres puntos + cursor, la que ya usa el resto del chat),
 * `sweep` (haz de luz girando) y `progress` (barra horizontal).
 */
import { useId, type CSSProperties } from "react";

export type ForjaLoaderState =
  | "creando"
  | "pensando"
  | "buscando"
  | "trabajando"
  | "reparando"
  | "finalizado"
  | "generando"
  /** El modelo dejó de responder a medias (`agentStalled()` en
   *  agent-loop.ts): el yunque se apaga y se queda quieto en vez de
   *  seguir animado como si trabajara — la señal es real, no cosmética. */
  | "detenido";

export type ForjaGenerandoVariant = "dots" | "sweep" | "progress";

export function ForjaStateLoader({
  state,
  size = 32,
  variant = "dots",
  className,
}: {
  state: ForjaLoaderState;
  size?: number;
  /** Solo aplica cuando `state === "generando"`. */
  variant?: ForjaGenerandoVariant;
  className?: string;
}) {
  // Mismo motivo que en ForjaLogo: useId da un id estable entre servidor y
  // cliente (y distinto por instancia), así los gradientes de dos loaders
  // en la misma página no se pisan entre sí.
  const reactId = useId();
  const uid = reactId.replace(/:/g, "");
  const caraId = `fjl-cara-${uid}`;
  const cuerpoId = `fjl-cuerpo-${uid}`;
  const baseId = `fjl-base-${uid}`;
  const checkId = `fjl-check-${uid}`;

  const variantClass =
    state === "generando"
      ? variant === "sweep"
        ? " fj-v-generando-b"
        : variant === "progress"
          ? " fj-v-generando-c"
          : ""
      : "";
  const rootClass = ["fj-loader", `fj-v-${state}${variantClass}`, className].filter(Boolean).join(" ");

  return (
    <div className={rootClass} style={{ width: size, height: size }}>
      {state === "buscando" && (
        <>
          <div className="fj-radar-ring fj-radar-r1" />
          <div className="fj-radar-ring fj-radar-r2" />
          <div className="fj-radar-ring fj-radar-r3" />
          <div className="fj-radar-sweep" />
        </>
      )}

      <div className="fj-logo">
        {state === "generando" && variant === "sweep" && <div className="fj-stream-sweep" />}

        <svg viewBox="0 0 240 240" fill="none" aria-hidden focusable="false">
          <defs>
            <linearGradient id={caraId} x1="28" y1="64" x2="212" y2="98" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#FFC48C" />
              <stop offset="0.55" stopColor="#FB8A3C" />
              <stop offset="1" stopColor="#F2600C" />
            </linearGradient>
            <linearGradient id={cuerpoId} x1="68" y1="98" x2="172" y2="186" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#FB923C" />
              <stop offset="1" stopColor="#E4560A" />
            </linearGradient>
            <linearGradient id={baseId} x1="68" y1="150" x2="172" y2="186" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#F97316" />
              <stop offset="1" stopColor="#DD4F08" />
            </linearGradient>
            {state === "finalizado" && (
              <linearGradient id={checkId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#4ADE80" />
                <stop offset="1" stopColor="#16A34A" />
              </linearGradient>
            )}
          </defs>

          <rect className="fj-cara" x="30" y="66" width="180" height="34" rx="15" fill={`url(#${caraId})`} />
          <path className="fj-cuerpo" d="M100 100 h40 l34 52 h-108 z" fill={`url(#${cuerpoId})`} />
          <rect className="fj-base" x="66" y="150" width="108" height="34" rx="13" fill={`url(#${baseId})`} />
          <path
            className="fj-spark"
            d="M189 26 c3.2 11.5 7.5 15.8 19 19 c-11.5 3.2 -15.8 7.5 -19 19 c-3.2 -11.5 -7.5 -15.8 -19 -19 c11.5 -3.2 15.8 -7.5 19 -19 z"
            fill="#FFF3E2"
          />
          <circle className="fj-spark" cx="159" cy="33" r="6" fill="#F97316" />
        </svg>

        {state === "pensando" && (
          <div className="fj-thinking-dots" aria-hidden>
            <span />
            <span />
            <span />
          </div>
        )}

        {state === "trabajando" && (
          <>
            <div className="fj-hammer" aria-hidden>
              <svg viewBox="0 0 40 40" fill="none">
                <rect x="14" y="2" width="16" height="12" rx="2" fill="#5b6470" />
                <rect x="16" y="0" width="12" height="3" rx="1" fill="#3a3f48" />
                <rect x="20" y="14" width="4" height="26" rx="1" fill="#5a3a1a" />
              </svg>
            </div>
            <div className="fj-hit-ring" aria-hidden />
            {IMPACT_SPARKS.map((end, i) => (
              <span
                key={i}
                className="fj-impact-spark"
                aria-hidden
                style={{ top: "48%", left: "50%", "--fj-end": end } as CSSProperties}
              />
            ))}
          </>
        )}

        {state === "finalizado" && (
          <>
            <div className="fj-check-stamp" aria-hidden>
              <svg viewBox="0 0 56 56" fill="none">
                <circle cx="28" cy="28" r="24" fill={`url(#${checkId})`} stroke="#16A34A" strokeWidth="1.5" />
                <path
                  className="fj-tick"
                  d="M16 28 L25 37 L40 20"
                  stroke="#FFFFFF"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
            <div className="fj-celebrate-ring" aria-hidden />
            {CONFETTI.map((c, i) => (
              <span
                key={i}
                className="fj-confetti"
                aria-hidden
                style={{ left: c.left, top: c.top, "--fj-dx": c.dx, "--fj-dy": c.dy, "--fj-rot": c.rot } as CSSProperties}
              />
            ))}
          </>
        )}

        {state === "generando" && variant === "dots" && (
          <div className="fj-stream-dots" aria-hidden>
            <span />
            <span />
            <span />
            <div className="fj-stream-cursor" />
          </div>
        )}
        {state === "generando" && variant === "progress" && (
          <div className="fj-progress-track" aria-hidden>
            <div className="fj-progress-fill" />
          </div>
        )}

        {state === "detenido" && (
          <div className="fj-pause-badge" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="12" fill="#F59E0B" />
              <rect x="8" y="7" width="3" height="10" rx="1" fill="#1a0d04" />
              <rect x="13" y="7" width="3" height="10" rx="1" fill="#1a0d04" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

const IMPACT_SPARKS = [
  "translate(28px,-22px)",
  "translate(-28px,-20px)",
  "translate(16px,-30px)",
  "translate(-18px,-28px)",
];

const CONFETTI = [
  { left: "35%", top: "30%", dx: "-30px", dy: "-40px", rot: "-180deg" },
  { left: "65%", top: "30%", dx: "30px", dy: "-40px", rot: "180deg" },
  { left: "50%", top: "25%", dx: "0px", dy: "-50px", rot: "360deg" },
];
