/** FORJA IA Lab — Ruta de chat del modelo virtual forja:ia-diseno.
 *
 * TRANSPORTE (v4.0.1): trabajo en segundo plano + SONDEO CORTO.
 * Los proxies del preview (gateway/Caddy) recortan o bufan los flujos SSE
 * largos y el navegador ve «el servidor no respondió» aunque el pipeline
 * haya ido perfecto. Ahora:
 *
 *   POST /api/forja/chat  → valida, lanza el trabajo y devuelve { id } AL INSTANTE
 *   GET  /api/forja/chat?id=&desde=  → JSON pequeño con los eventos nuevos
 *
 * El pipeline (ejecutarForja / continuarForja / ajustarMaquetaForja / estudioForja /
 * arenaForja) es EXACTAMENTE el mismo; solo cambió la tubería. Los eventos son
 * los mismos objetos que antes viajaban por SSE.
 */

import type {
  PeticionForja,
  PropuestaMaqueta,
  ResultadoForja,
} from "@/lib/prism/forja/tipos";
import { ejecutarForja, continuarForja, ajustarMaquetaForja, type DependenciasForja } from "@/lib/prism/forja/nucleo";
import { arenaForja, type ResultadoArena } from "@/lib/prism/forja/arena";
import { estudioForja, comoResultadoForja, type ResultadoEstudio } from "@/lib/prism/forja/director";
import { registrarLeccionesArena } from "@/lib/prism/forja/conocimiento-global";
import {
  interpretarOrdenFuentes,
  responderOrdenFuentes,
  dictamenFuente,
  deserializarFuentes,
  CLAVE_FUENTES_USUARIO,
} from "@/lib/prism/forja/fuentes-usuario";
import {
  deserializarConocimiento,
  serializarConocimiento,
  registrarUso,
  reglasGlobalesParaPrompt,
  CLAVE_CONOCIMIENTO_GLOBAL,
} from "@/lib/prism/forja/conocimiento-global";
import { MEMORIA_DEFECTO, CLAVE_MEMORIA, type MemoriaForja } from "@/lib/prism/forja/conocimiento-usuario";
import { PERFILES, PERFIL_DEFECTO } from "@/lib/prism/forja/tipos";
import {
  crearRegistro,
  cerrarRegistro,
  serializarRegistro,
  crearTelemetriaForja,
  agregarTelemetria,
} from "@/lib/prism/forja/observabilidad";
import { crearCacheMemoria, resumenCache } from "@/lib/prism/forja/cache-fichas";
import { cargarConfig, guardarAlmacen, leerAlmacen } from "../_base";
import { crearLlamadorLab, logEvento } from "@/lib/forja-lab/llamador";
import { crearConfigB } from "@/lib/forja-lab/arena-config";

const FALLBACK = { providerId: "z-ai", modelId: "motor" };

type Accion = "ejecutar" | "continuar" | "ajustar" | "arena" | "estudio";

interface Cuerpo {
  accion?: Accion;
  mensaje?: string;
  fichaTexto?: string;
  propuesta?: PropuestaMaqueta;
  feedback?: string;
  modo?: PeticionForja["modo"];
  arena?: { modo?: "maquetas" | "completa"; criteriosDelUsuario?: string };
  /** al continuar tras una Arena: con qué equipo seguir (A o B) */
  equipo?: "A" | "B";
  /** Estudio (v3.0): criterios del dueño que ponderan los jueces */
  estudio?: { criteriosDelUsuario?: string };
}

/* ------------------------- trabajos en segundo plano ---------------------- */

interface Trabajo {
  eventos: unknown[];
  terminado: boolean;
  creado: number;
}

/** Vive en el proceso del dev server (un solo proceso, como el resto del
 * preview). En FORJA IA esto iría a una tabla/redis; aquí basta un Map. */
const trabajos = new Map<string, Trabajo>();

const TIPO_FINAL = new Set(["resultado", "arena", "estudio", "error"]);

/** v4.2 — Caché del Lab compartida por el proceso: la misma petición no
 * paga dos veces la ficha ni la maqueta inicial (el núcleo decide cuándo
 * aplica; aquí solo vive la instancia). */
const cacheLab = crearCacheMemoria(24);

function podarTrabajos(): void {
  const ahora = Date.now();
  for (const [id, t] of trabajos) {
    if (ahora - t.creado > 30 * 60_000) trabajos.delete(id);
  }
  // cinturón: nunca más de 40 trabajos vivos
  while (trabajos.size > 40) {
    const masViejo = [...trabajos.entries()].sort((a, b) => a[1].creado - b[1].creado)[0];
    if (!masViejo) break;
    trabajos.delete(masViejo[0]);
  }
}

export async function POST(req: Request): Promise<Response> {
  const cuerpo = (await req.json().catch(() => null)) as Cuerpo | null;
  if (!cuerpo?.accion) {
    return Response.json({ error: "Falta la acción." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const trabajo: Trabajo = { eventos: [], terminado: false, creado: Date.now() };
  trabajos.set(id, trabajo);
  podarTrabajos();

  const send = (obj: unknown) => {
    trabajo.eventos.push(obj);
    if (
      obj &&
      typeof obj === "object" &&
      "tipo" in obj &&
      TIPO_FINAL.has(String((obj as { tipo: unknown }).tipo))
    ) {
      trabajo.terminado = true;
    }
  };

  // el pipeline corre en el MISMO proceso, sin ligar ninguna conexión:
  // el navegador sondea y cada respuesta dura milisegundos
  void resolver(cuerpo, send)
    .catch((e: unknown) => {
      trabajo.eventos.push({
        tipo: "error",
        error: e instanceof Error ? e.message : "Fallo inesperado del pipeline.",
      });
      trabajo.terminado = true;
    });

  return Response.json({ id });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const desde = Number.parseInt(url.searchParams.get("desde") ?? "0", 10) || 0;
  const trabajo = trabajos.get(id);
  if (!trabajo) {
    return Response.json({ error: "trabajo-desconocido" }, { status: 404 });
  }
  return Response.json({
    eventos: trabajo.eventos.slice(desde),
    total: trabajo.eventos.length,
    terminado: trabajo.terminado,
  });
}

/* ------------------------------- resolvers ------------------------------- */

async function resolver(cuerpo: Cuerpo, send: (obj: unknown) => void): Promise<void> {
  const cfg = await cargarConfig();
  const perfil = cfg.perfil ?? PERFIL_DEFECTO;

  // --- v4.2 — observabilidad POR GENERACIÓN ------------------------------
  // registro + puente de telemetría (los eventos del adaptador llenan el
  // registro) + caché compartida. Al cerrar la generación, el registro se
  // serializa al log del server: el expediente completo del flujo.
  const registro = crearRegistro("forja-lab");
  const llamarGeneracion = crearLlamadorLab({
    onEvento: crearTelemetriaForja(registro, { tambien: logEvento }),
  });
  const cierraRegistro = (score = 0) => {
    cerrarRegistro(registro, score, []);
    console.log("[FORJA registro]", serializarRegistro(registro));
    const salud = agregarTelemetria([registro]);
    console.log(
      `[FORJA ${resumenCache(cacheLab)}] blindaje: ${salud.reintentosRed} reintento(s) · ${salud.failovers} failover(s) · ${salud.continuaciones} continuación(es) · ${salud.tokensSalida} tokens · latencia media ${salud.latenciaMsMedia}ms`
    );
  };
  const scoreDe = (r: ResultadoForja): number => r.genericidad?.puntuacionIdentidad ?? 0;

  // --- órdenes sobre fuentes: atajos sin pipeline (v2.1) -----------------
  if (cuerpo.accion === "ejecutar" && cuerpo.mensaje) {
    const orden = interpretarOrdenFuentes(cuerpo.mensaje);
    if (orden.tipo !== "ninguna") {
      const [rawFuentes, rawAlmacen] = await Promise.all([
        leerAlmacen(CLAVE_FUENTES_USUARIO),
        leerAlmacen(CLAVE_CONOCIMIENTO_GLOBAL),
      ]);
      const respuesta = responderOrdenFuentes(
        orden,
        deserializarFuentes(rawFuentes),
        deserializarConocimiento(rawAlmacen).ultimoCiclo
      );
      if (respuesta) {
        if (orden.tipo === "proponer") {
          const d = dictamenFuente(orden.url);
          send({ tipo: "fuente-propuesta", url: d.propuesta?.url ?? orden.url });
        }
        cierraRegistro(); // atajo sin pipeline: registro de ceros, pero cerrado
        send({ tipo: "resultado", resultado: resultadoDeTexto(respuesta) });
        return;
      }
    }
  }

  // --- preparación común --------------------------------------------------
  const [rawMemoria, rawAlmacen] = await Promise.all([
    leerAlmacen(CLAVE_MEMORIA),
    leerAlmacen(CLAVE_CONOCIMIENTO_GLOBAL),
  ]);
  const memoria = memoriaDesde(rawMemoria);
  const almacen = deserializarConocimiento(rawAlmacen);
  const reglasInyectadas = reglasGlobalesParaPrompt(almacen, PERFILES[perfil].reglasGlobales);

  const peticion: PeticionForja = {
    mensaje: cuerpo.mensaje ?? "",
    conocimientoGlobal: reglasInyectadas,
    modo: cuerpo.modo,
  };

  const deps: DependenciasForja = {
    llamarModelo: llamarGeneracion,
    memoria,
    cache: cacheLab, // v4.2: la misma petición no se paga dos veces
    onMemoriaNueva: async (nueva) => {
      await guardarAlmacen(CLAVE_MEMORIA, JSON.stringify(nueva));
    },
    onProgreso: (evento) => send({ tipo: "evento", evento }),
  };

  const alTerminarCompleto = async (r: ResultadoForja) => {
    if (r.estado === "completo" && reglasInyectadas.length) {
      await guardarAlmacen(
        CLAVE_CONOCIMIENTO_GLOBAL,
        serializarConocimiento(registrarUso(almacen, reglasInyectadas))
      );
    }
  };

  // --- acciones ------------------------------------------------------------
  if (cuerpo.accion === "ejecutar") {
    const resultado = await ejecutarForja(peticion, cfg, deps, FALLBACK);
    await alTerminarCompleto(resultado);
    cierraRegistro(scoreDe(resultado));
    send({ tipo: "resultado", resultado });
    return;
  }

  if (cuerpo.accion === "continuar") {
    if (!cuerpo.fichaTexto) throw new Error("Falta la ficha de diseño para continuar.");
    const cfgEquipo = cuerpo.equipo === "B" ? crearConfigB(cfg) : cfg;
    const resultado = await continuarForja(peticion, cuerpo.fichaTexto, cfgEquipo, deps, FALLBACK);
    await alTerminarCompleto(resultado);
    cierraRegistro(scoreDe(resultado));
    send({ tipo: "resultado", resultado });
    return;
  }

  if (cuerpo.accion === "ajustar") {
    if (!cuerpo.fichaTexto || !cuerpo.propuesta || !cuerpo.feedback) {
      throw new Error("Faltan datos para ajustar la maqueta (ficha, propuesta o feedback).");
    }
    const resultado = await ajustarMaquetaForja(
      peticion,
      cuerpo.fichaTexto,
      cuerpo.propuesta,
      cuerpo.feedback,
      cfg,
      deps,
      FALLBACK
    );
    cierraRegistro(scoreDe(resultado));
    send({ tipo: "resultado", resultado });
    return;
  }

  // --- estudio (v3.0 «El Director Creativo») ------------------------------
  if (cuerpo.accion === "estudio") {
    const estudio: ResultadoEstudio = await estudioForja(
      peticion,
      cfg,
      deps,
      FALLBACK,
      { criteriosDelUsuario: cuerpo.estudio?.criteriosDelUsuario }
    );
    // las lecciones del panel alimentan la evolución, igual que en la Arena
    let almacenFinal = almacen;
    if (estudio.lecciones.length > 0) {
      almacenFinal = registrarLeccionesArena(almacen, estudio.lecciones);
    }
    if (reglasInyectadas.length) almacenFinal = registrarUso(almacenFinal, reglasInyectadas);
    if (almacenFinal !== almacen) {
      await guardarAlmacen(CLAVE_CONOCIMIENTO_GLOBAL, serializarConocimiento(almacenFinal));
    }
    cierraRegistro();
    send({ tipo: "estudio", estudio });
    // además exponemos el resultado normalizado para reutilizar la UI
    void comoResultadoForja(estudio);
    return;
  }

  // --- arena ----------------------------------------------------------------
  const cfgB = crearConfigB(cfg);
  const depsB: DependenciasForja = {
    llamarModelo: llamarGeneracion,
    memoria,
    cache: cacheLab,
    onProgreso: deps.onProgreso,
  };
  const arena: ResultadoArena = await arenaForja(
    peticion,
    cfg,
    deps,
    {
      equipoB: cfgB,
      depsB,
      modo: cuerpo.arena?.modo,
      criteriosDelUsuario: cuerpo.arena?.criteriosDelUsuario,
    },
    FALLBACK
  );
  // v2.4 «El Genoma Visual»: el juez enseña — las lecciones entran como
  // experimentos, patrones y fallos de la siguiente generación, y las reglas
  // usadas en este duelo marcan un uso sobre el almacén evolucionado.
  let almacenFinal = almacen;
  if (arena.lecciones.length > 0) {
    const equipoGanador = arena.veredicto.ganador === "B" ? "B" : "A";
    almacenFinal = registrarLeccionesArena(almacen, arena.lecciones, {
      puntuacionGanador: arena.veredicto[equipoGanador].total,
    });
  }
  if (reglasInyectadas.length) almacenFinal = registrarUso(almacenFinal, reglasInyectadas);
  if (almacenFinal !== almacen) {
    await guardarAlmacen(CLAVE_CONOCIMIENTO_GLOBAL, serializarConocimiento(almacenFinal));
  }
  cierraRegistro();
  send({ tipo: "arena", arena });
}

/** La memoria se persiste como JSON plano (el módulo no trae serializador:
 * la validación mínima la hace el host, igual que en FORJA IA). */
function memoriaDesde(crudo: string | null): MemoriaForja {
  if (!crudo) return MEMORIA_DEFECTO;
  try {
    const p = JSON.parse(crudo) as Partial<MemoriaForja>;
    if (!Array.isArray(p.reglas)) return MEMORIA_DEFECTO;
    return {
      reglas: p.reglas
        .filter((r): r is NonNullable<typeof r> => !!r && typeof r.texto === "string" && typeof r.id === "string")
        .map((r) => ({
          id: r.id,
          texto: r.texto,
          origen: r.origen === "manual" ? "manual" : "exito",
          creada: typeof r.creada === "string" ? r.creada : new Date().toISOString(),
          usos: typeof r.usos === "number" ? r.usos : 0,
        })),
    };
  } catch {
    return MEMORIA_DEFECTO;
  }
}

/** ResultadoForja de un texto directo (atajos del chat sin pipeline). */
function resultadoDeTexto(respuesta: string): ResultadoForja {
  return {
    estado: "completo",
    codigo: "",
    respuesta,
    ficha: null,
    fichaTexto: "",
    maqueta: null,
    rondas: [],
    veredicto: null,
    agotado: false,
  };
}
