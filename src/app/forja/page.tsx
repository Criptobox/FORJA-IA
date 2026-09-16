"use client";
/** FORJA IA — EL ESTUDIO (v4.3 «El Taller Abierto»).
 *
 * Página DENTRO del host (misma barra, mismo tema claro/oscuro, mismo acento
 * FORJA): reúne el motor completo del módulo corriendo en el navegador y el
 * catálogo íntegro de opciones que PRISMA-D1 ya traía — nada se queda fuera
 * de la vista. Reemplaza la pestaña suelta como puerta principal: la barra
 * lateral abre aquí, sin ventanas nuevas ni temas ajenos. */
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Compass,
  Database,
  Flame,
  Gauge,
  Hammer,
  Layers,
  Palette,
  ScrollText,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Chip } from "@/components/forja/ui-forja";
import { FichaTab } from "@/components/forja/ficha-tab";
import { AdnTab } from "@/components/forja/adn-tab";
import { JuecesTab, AntigenericoTab } from "@/components/forja/calidad-tabs";
import { MotorTab } from "@/components/forja/motor-tab";
import { cargarMotor, type Motor } from "@/lib/prism/motor-client";
import { usePrism } from "@/lib/prism/store";

const VERSION_FORJA = "4.3.1";
const NOMBRE_VERSION = "El Taller a Medida";

// Pestañas válidas: el sidebar puede abrir el Estudio directamente en
// cualquiera de ellas con /forja?tab=… — sin pestañas del navegador.
const PESTANAS_VALIDAS = ["inicio", "ficha", "adn", "jueces", "antigenerico", "motor"];

export default function ForjaEstudio() {
  const [motor, setMotor] = useState<Motor | null>(null);
  const [error, setError] = useState("");
  const settings = usePrism((s) => s.settings);
  // Se inicia en "inicio" y se corrige tras montar (evita desajuste de
  // hidratación si la URL trae ?tab=…).
  const [tab, setTab] = useState("inicio");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("tab");
    if (p && PESTANAS_VALIDAS.includes(p)) setTab(p);
  }, []);

  useEffect(() => {
    cargarMotor()
      .then(setMotor)
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  return (
    <div className="h-dvh overflow-auto bg-background text-foreground">
      <div className="mx-auto max-w-6xl space-y-5 px-3 py-4 sm:px-4 sm:py-6">
        {/* cabecera */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Hammer className="size-7 text-orange-500" />
            <div>
              <h1 className="text-base font-semibold tracking-tight sm:text-lg">
                FORJA IA · <span className="prism-gradient-text">Estudio</span>
              </h1>
              <p className="text-[12px] text-muted-foreground">
                El taller completo del módulo, con el tema de tu app — sin
                pestañas ajenas.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Chip tono="fuego">
              v{VERSION_FORJA} · {NOMBRE_VERSION}
            </Chip>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/">
                <ArrowLeft className="size-3.5" /> Volver al chat
              </Link>
            </Button>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[12.5px] text-red-600 dark:text-red-400">
            No se pudo cargar el motor (/motor-forja.mjs): {error}
          </div>
        )}

        {!motor && !error && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/50 p-6 text-[13px] text-muted-foreground">
            <Flame className="size-4 animate-pulse text-orange-500" /> Calentando
            el yunque: cargando el motor del módulo…
          </div>
        )}

        {motor && (
          <Tabs value={tab} onValueChange={setTab} className="gap-4">
            <TabsList className="h-9 w-full flex-nowrap items-center justify-start gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:h-auto sm:flex-wrap sm:overflow-visible">
              <TabsTrigger value="inicio" className="gap-1.5 flex-none sm:flex-1">
                <Compass className="size-3.5" /> Inicio · Catálogo
              </TabsTrigger>
              <TabsTrigger value="ficha" className="gap-1.5 flex-none sm:flex-1">
                <Hammer className="size-3.5" /> Ficha → Maqueta
              </TabsTrigger>
              <TabsTrigger value="adn" className="gap-1.5 flex-none sm:flex-1">
                <Layers className="size-3.5" /> ADN 2.0
              </TabsTrigger>
              <TabsTrigger value="jueces" className="gap-1.5 flex-none sm:flex-1">
                <Gauge className="size-3.5" /> Jueces · Evidencia
              </TabsTrigger>
              <TabsTrigger value="antigenerico" className="gap-1.5 flex-none sm:flex-1">
                <ShieldAlert className="size-3.5" /> Anti-genérico
              </TabsTrigger>
              <TabsTrigger value="motor" className="gap-1.5 flex-none sm:flex-1">
                <Flame className="size-3.5" /> Motor · Eficiencia + Aprendizaje
              </TabsTrigger>
            </TabsList>

            <TabsContent value="inicio">
              <Catalogo motor={motor} />
            </TabsContent>
            <TabsContent value="ficha">
              <FichaTab motor={motor} cfgUsuario={{ maxTokensPorRol: settings.maxTokensPorRol }} />
            </TabsContent>
            <TabsContent value="adn">
              <AdnTab motor={motor} />
            </TabsContent>
            <TabsContent value="jueces">
              <JuecesTab motor={motor} />
            </TabsContent>
            <TabsContent value="antigenerico">
              <AntigenericoTab motor={motor} />
            </TabsContent>
            <TabsContent value="motor">
              <MotorTab motor={motor} cfgUsuario={{ maxTokensPorRol: settings.maxTokensPorRol }} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

/* ── Catálogo: TODAS las opciones del módulo y dónde viven ────── */

function Catalogo({ motor }: { motor: Motor }) {
  const fuentes = (motor?.FUENTES_SEMILLA ?? []) as any[];
  const recetas = Object.keys(motor?.RECETAS_COSTO ?? {});
  const jueces = (motor?.JUECES_2 ?? []) as any[];

  const SISTEMAS: {
    icono: React.ReactNode;
    titulo: string;
    donde: string;
    descripcion: string;
  }[] = [
    {
      icono: <Hammer className="size-4 text-orange-500" />,
      titulo: "Núcleo: ficha → maqueta → ajustes",
      donde: "Pestaña «Ficha → Maqueta»",
      descripcion:
        "El pipeline completo (ejecutarForja): Diseñador redacta la ficha, Codificador la levanta, Revisor la examina y el bucle corrige hasta aprobar. Con caché y continuación de núcleo.",
    },
    {
      icono: <Layers className="size-4 text-orange-500" />,
      titulo: "ADN 2.0 · 14 dimensiones + exportadores",
      donde: "Pestaña «ADN 2.0»",
      descripcion:
        "Identidad, sensación, composición, tipografía, color, espaciado, movimiento, representación, interacción… Exporta DESIGN.md y tokens.css reales.",
    },
    {
      icono: <Gauge className="size-4 text-orange-500" />,
      titulo: "Jueces 2.0 con evidencia",
      donde: "Pestaña «Jueces · Evidencia»",
      descripcion:
        `Visual, UX/Accesibilidad, Originalidad y compañía (${jueces.length} jueces) deciden con evidencia determinista: chequeos estáticos + genericidad + design system.`,
    },
    {
      icono: <ShieldAlert className="size-4 text-orange-500" />,
      titulo: "Anti-genérico de 3 capas",
      donde: "Pestaña «Anti-genérico»",
      descripcion:
        "Detector de síntomas de plantilla con catálogo de antipatrones y puntuación de identidad: «¿podría cambiarse el logo y venderse como plantilla?»",
    },
    {
      icono: <Flame className="size-4 text-orange-500" />,
      titulo: "Blindaje v4.1+v4.2 del motor",
      donde: "Pestaña «Motor»",
      descripcion:
        "Adaptador resiliente (reintentos + failover + continuación), salud por latencia, caché por hash, telemetría y presupuesto por rol — las 5 mejoras en vivo.",
    },
    {
      icono: <Sparkles className="size-4 text-orange-500" />,
      titulo: "Director creativo · Estudio de visiones",
      donde: "Lab completo → pestaña ADN/Arena",
      descripcion:
        "Tres visiones creativas divergentes, jueces del estudio y fusión del Director (director.ts). En el Lab interactivo se ve el flujo completo con visiones.",
    },
    {
      icono: <Palette className="size-4 text-orange-500" />,
      titulo: "Arena 2.0 · comparar con jueces",
      donde: "Lab completo → pestaña «Arena 2.0»",
      descripcion:
        "2-3 visiones con el mismo prompt, notas por juez con evidencia, medias y ganadora (arena2.ts + criterios exportados del ADN).",
    },
    {
      icono: <ScrollText className="size-4 text-orange-500" />,
      titulo: "Bucle de mejora · «Mejora mi página»",
      donde: "Lab completo → «Mejora mi página»",
      descripcion:
        "Pega HTML existente: inspeccionar → corregir → comparar → ¿mejoró? → revertir (máx. 3). Score por ronda con el evaluador de éxito.",
    },
    {
      icono: <Database className="size-4 text-orange-500" />,
      titulo: "Memorias: proyecto, usuario, global, fallos, experimentos",
      donde: "En el núcleo (memoria2.ts, conocimiento-usuario.ts…)",
      descripcion:
        "Cinco memorias que viajan en cada llamada + Genoma Visual que consolida lecciones del Arena en el ADN (genoma-visual.ts).",
    },
    {
      icono: <Compass className="size-4 text-orange-500" />,
      titulo: `Perfiles de coste (${recetas.length}) y fuentes semilla (${fuentes.length})`,
      donde: "En el núcleo (perfiles.ts, fuentes.ts)",
      descripcion:
        `Recetas ${recetas.join(" / ")}: rondas, reglas y maquetas según presupuesto. Fuentes curadas de inspiración con permisos de aprendizaje.`,
    },
  ];

  return (
    <div className="space-y-3">
      <p className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
        Todo lo que PRISMA-D1 ya traía, ahora a la vista y con el tema de tu
        app. Las piezas interactivas corren aquí mismo; el resto vive en el
        núcleo del módulo (y su Lab completo como vista avanzada en pestaña).
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {SISTEMAS.map((s, i) => (
          <div key={i} className="rounded-2xl border border-border/60 bg-card/50 p-4">
            <div className="flex items-center gap-2">
              {s.icono}
              <h3 className="text-[13.5px] font-semibold leading-tight">{s.titulo}</h3>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{s.descripcion}</p>
            <div className="mt-2">
              <Chip tono="neutral">{s.donde}</Chip>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
