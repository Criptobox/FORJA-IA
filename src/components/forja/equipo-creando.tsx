"use client";
/** Forja IA — El equipo de 8 agentes, en pequeño, dentro del panel «Creando…».
 *
 * Son los mismos ocho especialistas del equipo de diseño de Tinta (mismos
 * nombres y colores). El panel de creación deja de ser un cartel aparte: los
 * agentes se reparten los pasos reales y se ve quién trabaja ahora. No inventa
 * progreso: el agente activo sale del paso real (entender → modelo → pensando
 * → escribiendo → entrega); dentro de un paso largo van rotando los que
 * encajan, para que se note que hay un equipo detrás. */
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

export const AGENTES_EQUIPO = [
  { id: "research", nombre: "Investigador", color: "#4d7cff", trabajo: "Leyendo tu idea y detectando el sector" },
  { id: "architect", nombre: "Arquitecto", color: "#ff8a2a", trabajo: "Decidiendo qué pantallas necesita" },
  { id: "ux", nombre: "Diseñador UX", color: "#f2c230", trabajo: "Eligiendo las piezas y su orden" },
  { id: "ui", nombre: "Diseñador UI", color: "#a366f0", trabajo: "Probando paletas y tipografías" },
  { id: "writer", nombre: "UX Writer", color: "#3ec46d", trabajo: "Escribiendo los textos" },
  { id: "a11y", nombre: "Accesibilidad", color: "#ee5a5a", trabajo: "Midiendo contrastes" },
  { id: "dev", nombre: "Frontend Dev", color: "#2cc2b8", trabajo: "Preparando el código" },
  { id: "critic", nombre: "Crítico", color: "#8f8f99", trabajo: "Buscando qué mejorar" },
] as const;

/** Qué agentes trabajan en cada paso real de la creación. */
const POR_PASO: Record<string, number[]> = {
  encargo: [0],
  modelo: [0, 1],
  pensando: [1, 2, 3],
  escribiendo: [4, 5, 6],
  entrega: [7],
};

export function agentesDelPaso(pasoId: string): number[] {
  return POR_PASO[pasoId] ?? [0];
}

function tono(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(t > 0 ? v + (255 - v) * t : v * (1 + t)));
  return "#" + c.map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("");
}

function Cubo({ color, activo, hecho }: { color: string; activo: boolean; hecho: boolean }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 48 52" width="34" height="37" aria-hidden focusable="false">
      <defs>
        <radialGradient id={`ag-${uid}`} cx="32%" cy="22%" r="82%">
          <stop offset="0" stopColor={tono(color, 0.5)} />
          <stop offset=".5" stopColor={color} />
          <stop offset="1" stopColor={tono(color, -0.5)} />
        </radialGradient>
      </defs>
      <ellipse cx="24" cy="48" rx="13" ry="2.6" fill="#000" opacity=".28" />
      <path d="M24 9V3" stroke={tono(color, -0.35)} strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="3" r="2.2" fill={activo ? "#ffb02e" : tono(color, 0.3)} />
      <rect x="5" y="9" width="38" height="33" rx="10" fill={`url(#ag-${uid})`} />
      <rect x="5" y="9" width="38" height="33" rx="10" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="1" />
      <rect x="10" y="16" width="28" height="19" rx="7" fill="#1c1822" />
      {hecho ? (
        <path d="M17 26l4 4 10-9" fill="none" stroke="#5ee08a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          <circle cx="18" cy="25" r="2.6" fill="#ffb02e" />
          <circle cx="30" cy="25" r="2.6" fill="#ffb02e" />
          <path d="M19 30q5 4 10 0" fill="none" stroke="#ffb02e" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      <ellipse cx="14" cy="14" rx="5" ry="2.6" fill="#fff" opacity=".6" transform="rotate(-25 14 14)" />
    </svg>
  );
}

export function EquipoCreando({ pasoId, terminado = false }: { pasoId: string; terminado?: boolean }) {
  const candidatos = agentesDelPaso(pasoId);
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    setVuelta(0);
    if (candidatos.length < 2) return;
    const t = setInterval(() => setVuelta((v) => v + 1), 2600);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasoId]);
  const activo = candidatos[vuelta % candidatos.length];
  const primero = Math.min(...candidatos);
  return (
    <div className="fj-equipo" data-testid="equipo-creando" data-activo={AGENTES_EQUIPO[activo].id}>
      <ul className="fj-equipo-fila">
        {AGENTES_EQUIPO.map((a, i) => {
          const esActivo = !terminado && i === activo;
          const hecho = terminado || i < primero;
          return (
            <li key={a.id} className={cn("fj-equipo-ag", esActivo && "is-activo", hecho && "is-hecho")} title={a.nombre} data-agente={a.id}>
              <Cubo color={a.color} activo={esActivo} hecho={hecho} />
            </li>
          );
        })}
      </ul>
      <p className="fj-equipo-trabajo">
        <strong style={{ color: AGENTES_EQUIPO[activo].color }}>{AGENTES_EQUIPO[activo].nombre}</strong> · {AGENTES_EQUIPO[activo].trabajo}
      </p>
    </div>
  );
}

const VERSIONES = [
  { modo: "equipo", etiqueta: "Versión del equipo" },
  { modo: "mezcla", etiqueta: "Mezcla" },
  { modo: "critico", etiqueta: "Versión del Crítico" },
] as const;

/** Lo que decidió cada agente y la objeción del Crítico, al terminar: es la
 *  misma información que daba la pantalla del equipo, ahora en la respuesta. */
export function InformeEquipo({
  lineas,
  critica,
  modo,
  onVersion,
}: {
  lineas: readonly string[];
  critica: string;
  modo: "equipo" | "mezcla" | "critico";
  onVersion: (modo: "equipo" | "mezcla" | "critico") => void;
}) {
  return (
    <details className="fj-informe mt-3 rounded-2xl border border-border/60 bg-card/60 p-3" data-testid="informe-equipo">
      <summary className="cursor-pointer text-[12.5px] font-medium">Lo que decidió el equipo</summary>
      <ul className="mt-2 space-y-1.5">
        {AGENTES_EQUIPO.map((a, i) => (
          <li key={a.id} className="flex items-start gap-2 text-[12px] leading-snug" data-agente={a.id}>
            <span className="mt-0.5 shrink-0">
              <Cubo color={a.color} activo={false} hecho />
            </span>
            <span className="min-w-0">
              <strong style={{ color: a.color }}>{a.nombre}</strong>
              <span className="text-muted-foreground"> · {i === 7 ? critica : (lineas[i] ?? "")}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Versión del diseño">
        {VERSIONES.map((v) => (
          <button
            key={v.modo}
            type="button"
            onClick={() => v.modo !== modo && onVersion(v.modo)}
            aria-pressed={v.modo === modo}
            data-testid={`version-${v.modo}`}
            className={cn(
              "rounded-full border px-3 py-1 text-[12px] font-medium transition",
              v.modo === modo ? "border-forja-violet bg-forja-violet/15 text-foreground" : "border-border/70 hover:bg-muted"
            )}
          >
            {v.etiqueta}
          </button>
        ))}
      </div>
    </details>
  );
}
