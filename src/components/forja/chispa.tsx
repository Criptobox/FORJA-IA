/** Forja IA — Lumen, el avatar principal: el guía tranquilo.
 *
 * Mismo estilo que los 8 agentes del equipo de Tinta (robot cubo 3D: volumen
 * por luces, brillo arriba a la izquierda, sombra en el suelo), para que la
 * app tenga UN solo lenguaje de personajes. Lo distinguen tres cosas: es el
 * único con brazos, lleva la chispa de Forja en la antena y su cara es una
 * pantalla con luces naranjas que cambian con cada emoción (se lee igual de
 * bien a 30 px que a 120 px).
 *
 * El componente conserva el nombre y la API de la mascota anterior (Chispa,
 * la llama): `estado`, `size`, `titulo` y `data-testid="chispa-<estado>"`.
 * Las animaciones viven en globals.css (`.lumen-*`) y se apagan con
 * prefers-reduced-motion.
 *
 * Los gradientes llevan un id por instancia (`useId`): dos avatares en la
 * misma página (el de cada respuesta) no se pisan entre sí. */
import { useId } from "react";
import { cn } from "@/lib/utils";

export type EstadoChispa = "inicio" | "pensando" | "forjando" | "listo" | "error" | "avatar";

/** Crema cálido del cuerpo y naranja de las luces. */
const CUERPO = "#efe4d2";
const LUZ = "#ffb02e";
const LUZ_ERROR = "#ff5a4d";

/** Aclara (t>0) u oscurece (t<0) un color: el volumen sale de aquí. */
function tono(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(t > 0 ? v + (255 - v) * t : v * (1 + t)));
  return "#" + c.map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("");
}

export function Chispa({
  estado = "inicio",
  size = 120,
  className,
  titulo,
}: {
  estado?: EstadoChispa;
  /** ancho en px (el alto es algo mayor, salvo en el avatar, que es cuadrado) */
  size?: number;
  className?: string;
  /** texto para lectores de pantalla; sin él es decorativa */
  titulo?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const id = (n: string) => `lu-${n}-${uid}`;
  const url = (n: string) => `url(#${id(n)})`;
  const avatar = estado === "avatar";
  const error = estado === "error";
  const brazoArriba = estado === "inicio" || estado === "forjando";

  const led = { stroke: LUZ, strokeWidth: 7, strokeLinecap: "round" as const, fill: "none", filter: url("brillo") };

  const cara = (() => {
    switch (estado) {
      case "pensando":
        return (
          <>
            <circle cx="88" cy="78" r="5" fill={LUZ} filter={url("brillo")} />
            <circle cx="120" cy="78" r="5" fill={LUZ} filter={url("brillo")} />
            <path d="M88 104h24" {...led} />
          </>
        );
      case "forjando":
        return (
          <>
            <path d="M74 84h18M108 84h18" {...led} />
            <rect x="72" y="100" width="56" height="8" rx="4" fill="#3a3340" />
            <rect className="lumen-progreso" x="72" y="100" width="56" height="8" rx="4" fill={LUZ} />
          </>
        );
      case "listo":
        return (
          <>
            <path d="M72 88l10-10 10 10M108 88l10-10 10 10" {...led} />
            <path d="M80 100q20 16 40 0" {...led} />
          </>
        );
      case "error":
        return (
          <>
            <path d="M74 78l14 10-14 10M126 78l-14 10 14 10" stroke={LUZ_ERROR} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M86 110q7-6 14 0t14 0" stroke={LUZ_ERROR} strokeWidth="6" strokeLinecap="round" fill="none" />
          </>
        );
      default:
        return (
          <>
            <g className="lumen-parpadeo">
              <path d="M72 90q10-14 20 0M108 90q10-14 20 0" {...led} />
            </g>
            <path d="M80 102q20 14 40 0" {...led} />
          </>
        );
    }
  })();

  // brazo: cápsula del color del cuerpo; el derecho sube para saludar o trabajar
  const brazo = (lado: "i" | "d") => {
    const x = lado === "i" ? 40 : 140;
    const cap = <rect x={x} y="138" width="20" height="40" rx="10" fill={url("cuerpo")} />;
    if (lado === "d" && brazoArriba) {
      return (
        <g transform="translate(22 6) rotate(-125 138 144)">
          <g className={estado === "inicio" ? "lumen-saluda" : "lumen-golpe"}>{cap}</g>
        </g>
      );
    }
    if (lado === "i" && estado === "pensando") {
      return <g transform="rotate(120 62 144)">{cap}</g>;
    }
    return cap;
  };

  const cabeza = (
    <>
      <path d="M100 36V12" stroke={tono(CUERPO, -0.35)} strokeWidth="6" strokeLinecap="round" />
      {/* la chispa de Forja: pequeña y quieta en un fallo, grande al trabajar */}
      <g transform={`translate(100 2) scale(${error ? 0.7 : estado === "forjando" ? 1.25 : 1})`}>
        <g className={error ? undefined : "lumen-chispa"}>
          <path d="M0 -22c9 9 14 17 9 27-3 6-8 9-9 9s-6-3-9-9c-4-8 1-14 4-18 1 5 3 7 5 7-2-6-2-11 0-16Z" fill={url("llama")} opacity={error ? 0.55 : 1} />
          <ellipse cx="0" cy="6" rx="3.6" ry="4.6" fill="#fff6c2" opacity=".9" />
        </g>
      </g>
      <rect x="38" y="36" width="124" height="104" rx="30" fill={url("cuerpo")} />
      <rect x="38" y="36" width="124" height="104" rx="30" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="2.5" />
      <rect x="52" y="56" width="96" height="66" rx="20" fill="#1c1822" />
      <rect x="52" y="56" width="96" height="66" rx="20" fill="none" stroke="#000" strokeOpacity=".35" strokeWidth="2" />
      {cara}
      <ellipse cx="64" cy="50" rx="16" ry="8" fill={url("brillo-luz")} opacity=".75" transform="rotate(-25 64 50)" />
    </>
  );

  const extra = (() => {
    switch (estado) {
      case "pensando":
        return (
          <g aria-hidden>
            <circle className="chispa-punto" cx="176" cy="34" r="6" fill="#bdb4a8" />
            <circle className="chispa-punto chispa-punto--2" cx="196" cy="20" r="4.5" fill="#bdb4a8" />
            <circle className="chispa-punto chispa-punto--3" cx="210" cy="6" r="3" fill="#bdb4a8" />
          </g>
        );
      case "forjando":
        return (
          <g fill={LUZ} aria-hidden>
            <path className="chispa-punto" d="M190 18l4 9 9 4-9 4-4 9-4-9-9-4 9-4Z" />
            <path className="chispa-punto chispa-punto--2" d="M206 62l2.5 5.5 5.5 2.5-5.5 2.5-2.5 5.5-2.5-5.5-5.5-2.5 5.5-2.5Z" />
            <circle className="chispa-punto chispa-punto--3" cx="214" cy="36" r="3" />
          </g>
        );
      case "listo":
        return (
          <g transform="translate(172 22)" aria-hidden>
            <circle r="17" fill="#22a35a" stroke="#fff" strokeWidth="3" />
            <path d="M-8 0l5 6 11-12" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
      case "error":
        return (
          <g fill="#9b938a" aria-hidden>
            <circle className="chispa-humo" cx="164" cy="22" r="10" />
            <circle className="chispa-humo chispa-humo--2" cx="180" cy="12" r="8" />
          </g>
        );
      default:
        return null;
    }
  })();

  return (
    <svg
      // el avatar encuadra solo la cabeza con su antena: a 30 px se lee mejor
      viewBox={avatar ? "16 -24 168 168" : "-20 -24 240 248"}
      width={size}
      height={avatar ? size : Math.round((size * 248) / 240)}
      className={cn("chispa", "lumen", `chispa--${estado}`, className)}
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      focusable="false"
      data-testid={`chispa-${estado}`}
    >
      <defs>
        <radialGradient id={id("cuerpo")} cx="32%" cy="22%" r="82%">
          <stop offset="0" stopColor={tono(CUERPO, 0.45)} />
          <stop offset=".5" stopColor={CUERPO} />
          <stop offset="1" stopColor={tono(CUERPO, -0.5)} />
        </radialGradient>
        <radialGradient id={id("brillo-luz")}>
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("suelo")}>
          <stop offset="0" stopColor="#000" stopOpacity=".35" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("bajo")} cx="50%" cy="100%" r="70%">
          <stop offset="0" stopColor="#000" stopOpacity=".28" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("llama")} cx="50%" cy="70%" r="60%">
          <stop offset="0" stopColor="#fff6c2" />
          <stop offset=".45" stopColor={LUZ} />
          <stop offset="1" stopColor="#ff4d2e" />
        </radialGradient>
        <filter id={id("brillo")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g className={avatar ? undefined : "lumen-respira"}>
        {!avatar && (
          <>
            <ellipse cx="100" cy="208" rx="54" ry="9" fill={url("suelo")} />
            <rect x="70" y="160" width="24" height="40" rx="8" fill={url("cuerpo")} />
            <rect x="106" y="160" width="24" height="40" rx="8" fill={url("cuerpo")} />
            <rect x="62" y="132" width="76" height="48" rx="14" fill={url("cuerpo")} />
            <ellipse cx="100" cy="176" rx="34" ry="8" fill={url("bajo")} />
            <circle cx="100" cy="150" r="7" fill={error ? LUZ_ERROR : LUZ} filter={url("brillo")} />
            {brazo("i")}
            {!brazoArriba && brazo("d")}
          </>
        )}
        {cabeza}
        {!avatar && brazoArriba && brazo("d")}
      </g>
      {!avatar && extra}
    </svg>
  );
}
