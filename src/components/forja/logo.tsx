/** Forja IA — Logo vectorial reutilizable: el yunque naranja con la chispa.
 *
 * Mismo contrato de props que el logo anterior (size / className / glow)
 * para que el cambio sea quirúrgico en los puntos donde se pinta: cabecera
 * de la barra lateral (26px), bienvenida (56px con glow), trace del agente
 * (18px), onboarding (64px con glow) y pantalla de generación (56px).
 * El SparkleAvatar va aparte para las burbujas del chat.
 *
 * Los degradados salen del logo maestro (motor-forja/marca/forja-logo.svg):
 * metal que pasa por el fuego, del durazno al naranja profundo.
 */
import { useId } from "react";

export function ForjaLogo({
  size = 32,
  className,
  glow = false,
}: {
  size?: number;
  className?: string;
  glow?: boolean;
}) {
  // id único por instancia: si hay dos logos en la misma página, los
  // gradientes no se pisan (bug clásico de SVG con ids compartidos).
  //
  // Con `Math.random()` el id salía DISTINTO en el servidor y en el cliente:
  // React lo cantaba como fallo de hidratación, y en desarrollo eso levanta
  // el overlay de error de Next, que tapa la pantalla entera. `useId` da un
  // id estable entre servidor y cliente y distinto por instancia.
  const reactId = useId();
  const uid = `${size}-${glow ? "g" : "p"}-${reactId.replace(/:/g, "")}`;
  const caraId = `fj-cara-${uid}`;
  const cuerpoId = `fj-cuerpo-${uid}`;
  const baseId = `fj-base-${uid}`;
  const haloId = `fj-halo-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Forja IA"
      role="img"
    >
      <defs>
        {/* cara superior: durazno → naranja → naranja profundo */}
        <linearGradient id={caraId} x1="28" y1="64" x2="212" y2="98" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFC48C" />
          <stop offset="0.55" stopColor="#FB8A3C" />
          <stop offset="1" stopColor="#F2600C" />
        </linearGradient>
        {/* cuello: el metal en plena forja */}
        <linearGradient id={cuerpoId} x1="68" y1="98" x2="172" y2="186" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FB923C" />
          <stop offset="1" stopColor="#E4560A" />
        </linearGradient>
        {/* base forjada */}
        <linearGradient id={baseId} x1="68" y1="150" x2="172" y2="186" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F97316" />
          <stop offset="1" stopColor="#DD4F08" />
        </linearGradient>
        {/* halo cálido cuando se pide glow (bienvenida / onboarding) */}
        <radialGradient id={haloId}>
          <stop offset="0" stopColor="#FB8A3C" stopOpacity="0.5" />
          <stop offset="1" stopColor="#FB8A3C" stopOpacity="0" />
        </radialGradient>
      </defs>

      {glow && <circle cx="120" cy="120" r="116" fill={`url(#${haloId})`} />}

      {/* cara superior del yunque */}
      <rect x="30" y="66" width="180" height="34" rx="15" fill={`url(#${caraId})`} />

      {/* cuello: ensancha hacia abajo, como el yunque de verdad */}
      <path d="M100 100 h40 l34 52 h-108 z" fill={`url(#${cuerpoId})`} />

      {/* base forjada */}
      <rect x="66" y="150" width="108" height="34" rx="13" fill={`url(#${baseId})`} />

      {/* chispa del herrerío: estrella de 4 puntas */}
      <path
        d="M189 26 c3.2 11.5 7.5 15.8 19 19 c-11.5 3.2 -15.8 7.5 -19 19 c-3.2 -11.5 -7.5 -15.8 -19 -19 c11.5 -3.2 15.8 -7.5 19 -19 z"
        fill="#FFF3E2"
      />
      {/* punto de metal incandescente */}
      <circle cx="159" cy="33" r="6" fill="#F97316" />
    </svg>
  );
}
