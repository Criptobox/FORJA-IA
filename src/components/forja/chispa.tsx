/** Forja IA — Chispa, la mascota: una llama con guantes que acompaña cada
 * estado de la app (te recibe, forja, celebra, avisa de un fallo).
 *
 * SVG original con volumen «3D» hecho solo con luces: núcleo caliente,
 * brillo arriba a la izquierda, sombra en el borde derecho y sombra en el
 * suelo. Las animaciones viven en globals.css (`.chispa-*`) y se apagan con
 * prefers-reduced-motion.
 *
 * Los gradientes llevan un id por instancia (`useId`): dos Chispas en la
 * misma página (el avatar de cada respuesta) no se pisan entre sí. */
import { useId } from "react";
import { cn } from "@/lib/utils";

export type EstadoChispa = "inicio" | "pensando" | "forjando" | "listo" | "error" | "avatar";

const SILUETA =
  "M100 200 C55 200 34 170 36 134 C38 106 52 90 60 70 C66 86 72 94 80 96 C74 68 86 38 114 8 C112 36 122 52 136 68 C142 58 146 46 144 34 C164 60 170 94 166 130 C168 172 146 200 100 200 Z";

export function Chispa({
  estado = "inicio",
  size = 120,
  className,
  titulo,
}: {
  estado?: EstadoChispa;
  /** ancho en px (el alto es 1,2 × ancho, salvo en el avatar, que es cuadrado) */
  size?: number;
  className?: string;
  /** texto para lectores de pantalla; sin él es decorativa */
  titulo?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const id = (n: string) => `ch-${n}-${uid}`;
  const url = (n: string) => `url(#${id(n)})`;
  const avatar = estado === "avatar";
  const apagada = estado === "error";

  const guante = (x: number, y: number, s = 1, espejo = false) => (
    <g transform={`translate(${x} ${y}) scale(${espejo ? -s : s} ${s})`}>
      <circle r="13" fill={url("guante")} />
      <ellipse cx="-8" cy="-5" rx="5" ry="7" fill={url("guante")} transform="rotate(-30 -8 -5)" />
      <path d="M-2 9 q8 2 13 -4" stroke="#b9b6c6" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity=".7" />
    </g>
  );
  const brazo = (d: string) => <path d={d} stroke={url("miembro")} strokeWidth="11" fill="none" strokeLinecap="round" />;
  const ceja = (d: string, w = 9) => <path d={d} stroke="#2b1408" strokeWidth={w} fill="none" strokeLinecap="round" />;

  const ojosAbiertos = (
    <>
      <g className="chispa-parpadeo">
        <ellipse cx="78" cy="120" rx="16" ry="19" fill={url("ojo")} />
        <ellipse cx="122" cy="120" rx="16" ry="19" fill={url("ojo")} />
      </g>
      <circle cx="82" cy="124" r="10" fill={url("iris")} />
      <circle cx="118" cy="124" r="10" fill={url("iris")} />
      <circle cx="83" cy="125" r="5" fill="#2a0d02" />
      <circle cx="117" cy="125" r="5" fill="#2a0d02" />
      <circle cx="86" cy="120" r="2.6" fill="#fff" />
      <circle cx="120" cy="120" r="2.6" fill="#fff" />
    </>
  );

  return (
    <svg
      // el avatar encuadra la llama ENTERA (punta y base redondeada); antes
      // el recorte la dejaba con la base plana, como cortada
      viewBox={avatar ? "-4 2 208 208" : "0 0 200 240"}
      width={size}
      height={avatar ? size : Math.round(size * 1.2)}
      className={cn("chispa", `chispa--${estado}`, className)}
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      focusable="false"
      data-testid={`chispa-${estado}`}
    >
      <defs>
        <radialGradient id={id("cuerpo")} cx="44%" cy="64%" r="72%">
          {apagada ? (
            <>
              <stop offset="0" stopColor="#ffd7a8" />
              <stop offset=".4" stopColor="#f29a63" />
              <stop offset="1" stopColor="#b9493a" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#ffe98a" />
              <stop offset=".3" stopColor="#ffb52e" />
              <stop offset=".62" stopColor="#ff6a1f" />
              <stop offset="1" stopColor="#d4180e" />
            </>
          )}
        </radialGradient>
        <linearGradient id={id("sombra")} x1="0" y1="0" x2="1" y2=".6">
          <stop offset=".45" stopColor="#7a0b00" stopOpacity="0" />
          <stop offset="1" stopColor="#7a0b00" stopOpacity=".55" />
        </linearGradient>
        <radialGradient id={id("nucleo")}>
          <stop offset="0" stopColor="#fff6c4" stopOpacity=".95" />
          <stop offset="1" stopColor="#ffd05a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("miembro")} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ff8a4f" />
          <stop offset=".55" stopColor="#ec3b1b" />
          <stop offset="1" stopColor="#a5150b" />
        </radialGradient>
        <radialGradient id={id("guante")} cx="35%" cy="28%" r="80%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".6" stopColor="#f1f0f5" />
          <stop offset="1" stopColor="#c3c1cf" />
        </radialGradient>
        <radialGradient id={id("ojo")} cx="40%" cy="32%" r="75%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".75" stopColor="#f3f1f4" />
          <stop offset="1" stopColor="#cbc4cc" />
        </radialGradient>
        <radialGradient id={id("iris")} cx="45%" cy="38%" r="65%">
          <stop offset="0" stopColor="#ffc06a" />
          <stop offset=".55" stopColor="#e2621b" />
          <stop offset="1" stopColor="#6e2306" />
        </radialGradient>
        <linearGradient id={id("metal")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9aa3b0" />
          <stop offset=".45" stopColor="#5b6370" />
          <stop offset="1" stopColor="#2b3038" />
        </linearGradient>
        <filter id={id("blur")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>

      <g className="chispa-vive">
        {apagada && (
          <g aria-hidden>
            <circle className="chispa-humo" cx="96" cy="20" r="10" fill="#cfc6c0" />
            <circle className="chispa-humo chispa-humo--2" cx="114" cy="16" r="8" fill="#ddd5cf" />
          </g>
        )}
        {!avatar && (
          <>
            <rect x="74" y="182" width="14" height="34" rx="7" fill={url("miembro")} />
            <rect x="112" y="182" width="14" height="34" rx="7" fill={url("miembro")} />
            <ellipse cx="74" cy="219" rx="17" ry="8.5" fill={url("miembro")} />
            <ellipse cx="127" cy="219" rx="17" ry="8.5" fill={url("miembro")} />
          </>
        )}
        <g className="chispa-llama">
          <path d={SILUETA} fill={url("cuerpo")} />
          <ellipse cx="98" cy="142" rx="44" ry="48" fill={url("nucleo")} />
          <path d={SILUETA} fill={url("sombra")} />
          <ellipse cx="62" cy="112" rx="9" ry="24" fill="#fff" opacity=".55" filter={url("blur")} transform="rotate(-18 62 112)" />
          <ellipse cx="108" cy="36" rx="4" ry="11" fill="#fff" opacity=".5" filter={url("blur")} transform="rotate(25 108 36)" />
        </g>

        {(estado === "inicio" || estado === "avatar") && (
          <>
            {ceja("M58 98 Q76 90 95 105")}
            {ceja("M105 105 Q124 90 142 98")}
            {ojosAbiertos}
            <path d="M78 150 Q100 170 126 148 Q104 158 78 150 Z" fill="#fff" stroke="#7a1a06" strokeWidth="3" strokeLinejoin="round" />
            {estado === "inicio" && (
              <>
                {brazo("M48 148 Q58 172 88 170")}
                {brazo("M152 148 Q144 172 114 170")}
                {guante(93, 172)}
                {guante(108, 169, 1, true)}
              </>
            )}
          </>
        )}

        {estado === "pensando" && (
          <>
            {/* una ceja recta y la otra arriba: está dándole vueltas */}
            {ceja("M60 100 Q76 96 94 102")}
            {ceja("M106 96 Q124 82 142 92")}
            <g className="chispa-parpadeo">
              <ellipse cx="78" cy="120" rx="15" ry="18" fill={url("ojo")} />
              <ellipse cx="122" cy="120" rx="15" ry="18" fill={url("ojo")} />
            </g>
            {/* mira arriba, hacia la nube */}
            <circle cx="84" cy="113" r="8.5" fill={url("iris")} />
            <circle cx="128" cy="113" r="8.5" fill={url("iris")} />
            <circle cx="86" cy="111" r="4.2" fill="#2a0d02" />
            <circle cx="130" cy="111" r="4.2" fill="#2a0d02" />
            <circle cx="88" cy="108" r="2" fill="#fff" />
            <circle cx="132" cy="108" r="2" fill="#fff" />
            <path d="M86 158 Q98 152 112 156" stroke="#7a1a06" strokeWidth="4" fill="none" strokeLinecap="round" />
            {brazo("M48 150 Q54 172 76 176")}
            {guante(80, 176)}
            {/* la mano a la barbilla */}
            {brazo("M152 150 Q146 178 118 172")}
            {guante(112, 168, 0.95, true)}
            <g className="chispa-piensa" aria-hidden>
              <circle cx="152" cy="74" r="4" fill="#f1f0f5" opacity=".85" />
              <circle cx="163" cy="58" r="6.5" fill="#f1f0f5" opacity=".9" />
              <rect x="150" y="10" width="48" height="34" rx="17" fill="#f1f0f5" />
              <circle className="chispa-punto" cx="163" cy="27" r="3.6" fill="#e2621b" />
              <circle className="chispa-punto chispa-punto--2" cx="174" cy="27" r="3.6" fill="#e2621b" />
              <circle className="chispa-punto chispa-punto--3" cx="185" cy="27" r="3.6" fill="#e2621b" />
            </g>
          </>
        )}

        {estado === "forjando" && (
          <>
            {ceja("M60 104 L95 108")}
            {ceja("M105 108 L140 104")}
            <ellipse cx="78" cy="124" rx="15" ry="11" fill={url("ojo")} />
            <ellipse cx="122" cy="124" rx="15" ry="11" fill={url("ojo")} />
            <circle cx="84" cy="125" r="7.5" fill={url("iris")} />
            <circle cx="126" cy="125" r="7.5" fill={url("iris")} />
            <circle cx="85" cy="125" r="3.6" fill="#2a0d02" />
            <circle cx="127" cy="125" r="3.6" fill="#2a0d02" />
            <path d="M86 156 Q100 150 116 156" stroke="#7a1a06" strokeWidth="4" fill="none" strokeLinecap="round" />
            <ellipse cx="112" cy="160" rx="6" ry="5" fill="#ff7a8a" stroke="#7a1a06" strokeWidth="2" />
            <path d="M118 196 h56 l-8 -10 h-40 z" fill={url("metal")} />
            <rect x="132" y="196" width="22" height="16" rx="3" fill="#3a3f47" />
            {brazo("M48 150 Q56 170 80 172")}
            {guante(84, 172)}
            <g className="chispa-martillo">
              {brazo("M150 146 Q162 138 160 126")}
              <rect x="156" y="70" width="8" height="58" rx="4" fill="#8a4f22" />
              <rect x="140" y="58" width="40" height="20" rx="5" fill={url("metal")} />
              <rect x="143" y="61" width="34" height="4" rx="2" fill="#fff" opacity=".35" />
              {guante(160, 124, 0.9)}
            </g>
          </>
        )}

        {estado === "listo" && (
          <>
            {ceja("M62 104 Q78 94 94 104", 8)}
            {ceja("M106 104 Q122 94 138 104", 8)}
            {ceja("M66 126 Q78 112 92 126", 6)}
            {ceja("M108 126 Q122 112 134 126", 6)}
            <ellipse cx="64" cy="142" rx="9" ry="5" fill="#ff4d6d" opacity=".45" />
            <ellipse cx="136" cy="142" rx="9" ry="5" fill="#ff4d6d" opacity=".45" />
            <path d="M76 144 Q100 178 124 144 Z" fill="#7a1a06" />
            <path d="M80 145 Q100 152 120 145 L118 150 Q100 156 82 150 Z" fill="#fff" />
            <ellipse cx="100" cy="164" rx="10" ry="6" fill="#ff7a8a" />
            {brazo("M50 150 Q54 172 74 176")}
            {guante(78, 176)}
            <g className="chispa-saluda">
              {brazo("M150 150 Q170 138 168 112")}
              {guante(168, 104)}
              <rect x="164" y="80" width="9" height="18" rx="4.5" fill={url("guante")} />
            </g>
          </>
        )}

        {estado === "error" && (
          <>
            {ceja("M62 104 Q80 104 92 94", 8)}
            {ceja("M108 94 Q120 104 138 104", 8)}
            <ellipse cx="78" cy="124" rx="15" ry="18" fill={url("ojo")} />
            <ellipse cx="122" cy="124" rx="15" ry="18" fill={url("ojo")} />
            <circle cx="80" cy="128" r="6" fill={url("iris")} />
            <circle cx="120" cy="128" r="6" fill={url("iris")} />
            <circle cx="80" cy="128" r="3" fill="#2a0d02" />
            <circle cx="120" cy="128" r="3" fill="#2a0d02" />
            <path d="M84 160 q8 -8 16 0 q8 8 16 0" stroke="#7a1a06" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path className="chispa-gota" d="M146 108 q6 9 0 13 q-6 -4 0 -13 z" fill="#7cc7ff" />
            {brazo("M46 150 Q50 172 68 180")}
            {brazo("M154 150 Q150 172 132 180")}
            {guante(70, 182, 0.9)}
            {guante(130, 182, 0.9, true)}
          </>
        )}
      </g>
    </svg>
  );
}
