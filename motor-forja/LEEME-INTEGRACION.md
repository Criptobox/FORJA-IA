# FORJA IA v4.0.0 — «El Cerebro Creativo»
### Plan maestro OpenDesign + Stitch, ejecutado de una pieza

La arquitectura objetivo del plan ya está en el módulo:

```text
   FORJA decide  ──►  RUNTIME ejecuta  ──►  FORJA evalúa
   (cerebro)          (OpenDesign real o     (inspector + 3 capas
   ADN 2.0 · 14 dim    RuntimeLocal sin      anti-genéricas + revisor
   direcciones/Arena   red: MVP hoy,         PASS/WARN/FAIL + bucle
   jueces con          fork mañana)          con rollback + métricas)
   evidencia
```

**Regla de oro del plan (verificada por pruebas):** FORJA no conoce detalles
internos de OpenDesign — solo la interfaz `RuntimeOpenDesign` de
`adapter-opendesign.ts`. El `RuntimeLocal` implementa la MISMA interfaz sin red,
así que el MVP (`nucleo-v4.ts`) corre HOY de punta a punta; el día que fijes el
fork de OpenDesign (Fase 1 del plan), enchufas su runtime y no tocas nada más.
Los 4 ítems que dependen del fork (clonar, licencias del árbol, comparativa de
producción) quedan marcados PENDIENTE-CLON en `docs/INTEGRACION-MAPA.md`.

## Los módulos v4 y para qué sirven

| Módulo | Fase del plan | Qué hace |
|---|---|---|
| `adn2.ts` | 3 | ADN Visual 2.0 con 14 dimensiones + parser `<adn2>` + migración v3→v4 automática |
| `exportadores-adn.ts` | 3/9 | ADN → `DESIGN.md` · `tokens.css` · reglas de critique · restricciones del Codificador · criterios de Arena |
| `bridge-design-system.ts` | 9 | puente ADN ↔ design system + auditoría determinista de respeto del sistema |
| `adapter-opendesign.ts` | 2 | PeticiónForja → OpenDesignRequest → artifact → Evaluación; `RuntimeLocal` incluido |
| `director2.ts` | 5 | 6 arquetipos estructurales; visiones que divergen en representación/estructura/narrativa/interacción/composición |
| `jueces2.ts` | 13 | jueces con EVIDENCIA (funciona/falla/conservar) + evidencia física determinista previa + 5 jueces opcionales |
| `arena2.ts` + `perfiles.ts` | 6/26 | modos económico/profesional/experimental + perfiles FREE/SMART/ARENA/LAB con presupuesto de llamadas |
| `antigenerico2.ts` | 7 | 3 capas: determinista + visual + semántica (test de la plantilla), puntuación compuesta |
| `revisor-visual.ts` | 10 | PASS/WARN/FAIL con causa probable y corrección propuesta |
| `bucle-mejora.ts` | 11 | bucle autónomo, máx 3 iteraciones, rollback si no mejora |
| `memoria2.ts` | 12 | 5 memorias: proyecto · usuario · global · experimental · **fallos** |
| `genoma-visual.ts` | 20 | lecciones destacar/conservar/evitar → patrones, anti-patrones, experimentos |
| `voz.ts` + `canvas.ts` | 4/22 | voz → comandos semánticos + máquina de estados del canvas con historial y comparación |
| `referencias.ts` | 23 | url/html/imagen/descripción → atributos → inspiración → ADN (nunca copiar) |
| `mejora-pagina.ts` | 24 | diagnóstico determinista del código existente + variante que solo se aplica si gana |
| `observabilidad.ts` + `metricas.ts` | 28/30 | registro por generación + 5 consultas + 8 métricas con evidencia |
| `benchmark.ts` + `evaluador-exito.ts` | 29/33 | 10 categorías de benchmark + los 10 checks de éxito del plan |
| `nucleo-v4.ts` | 31-32 | el MVP completo: PROMPT → ADN → Arena → runtime → evaluación → bucle → métricas → genoma → éxito |

## Instalación en FORJA IA (sin cambios respecto a v3 + un paso nuevo)

1. Copia `src/lib/prism/forja/` dentro de tu proyecto (igual que en v3).
2. NUEVO: importa `ejecutarMvpForja` desde `nucleo-v4.ts` si quieres el flujo
   completo del plan (Arena + bucle + métricas + registro + genoma), o sigue
   usando `ejecutarForja`/`estudioForja` de v3 (seguirán funcionando igual).
3. NUEVO: si tienes el fork de OpenDesign, implementa `RuntimeOpenDesign` y
   pásalo en `DepsMvp.runtime`; si no, no pases nada y usará `RuntimeLocal`.
4. NUEVO: persiste el Genoma con `serializarGenoma()`/`deserializarGenoma()` y
   las 5 memorias con las claves de `CLAVES_MEMORIA2`.
5. El preview es `preview/FORJA-IA-Laboratorio.html`: doble clic y listo
   (file://, sin servidor, con modo oscuro/claro).
6. Ajustes de la UI: añade el selector de perfil de coste (FREE/SMART/ARENA/LAB
   desde `perfiles.ts`) y pinta `NOMBRE_VERSION_FORJA` / `NOVEDADES_FORJA` de `version.ts`.
7. Seguridad: sin cambios (todo el módulo sigue siendo sin-red; las URLs de
   referencias pasan por `seguridad-web.ts`).

## §9 — Cablear el adaptador resiliente (NUEVO v4.1: failover + anti-truncamiento)

Un solo archivo resuelve las dos cosas que le faltaban a la integración:
`adaptador-resiliente.ts` (con `motivo-parada.ts` como traductor del
`finish_reason`). El núcleo no cambia: el adaptador ES una `LlamadaModelo`.

**Qué resuelve, en orden:**

1. **max_tokens por rol** — 16.384 en el Codificador, 8.192 en Diseñador y
   Revisor. Si la petición pide un límite de salida bajo, el modelo corta el
   HTML a la mitad, y eso pasa igual de pagado que de gratis. Para generación
   de páginas: 16k o más, SIEMPRE.
2. **finish_reason** — la API dice por qué terminó. Si es `length` en vez de
   `stop`, la salida quedó corta: el adaptador pide CONTINUACIÓN (máx. 2) y
   concatena. El campo crudo (`finish_reason` / `stop_reason` /
   `finishReason`) lo traduce `motivo-parada.ts` en los tres protocolos.
   (El host ya tenía `finish-reason.ts`: este es el port autocontenido para
   que el módulo no dependa de nada.)
3. **Timeouts y errores de red** — reintentos con backoff exponencial + jitter
   (0.6s · 1.2s · 2.4s) por proveedor. El streaming por `onFragmento` sigue
   funcionando igual (lo soporta el transporte).
4. **Caídas del proveedor** — cadena de failover por rol: DeepSeek caído →
   siguiente en la cadena, sin que el usuario lo note.
5. **Última línea de defensa** — un corte que sobreviva a todo no llega roto:
   `chequeosEstaticos` detecta etiquetas sin cerrar y el Revisor con el
   bucle-mejora manda corregir antes de entregar. Llega como WARN y se
   corrige, no como página rota.

**Cableado en el host FORJA IA (3 piezas):**

```ts
// 1) El TRANSPORTE: tu chat-client envuelto. Devuelve texto + motivo crudo.
import { crearAdaptadorForja, type TransporteModelo } from "@/lib/prism/forja/adaptador-resiliente";

const transporte: TransporteModelo = async (a) => {
  const r = await streamChat({
    providerId: a.providerId,
    modelId: a.modelId,
    system: a.system,
    user: a.user,
    settings: { temperature: a.temperatura, maxTokens: a.maxTokens, stream: true },
    onDelta: a.onFragmento,
    signal: a.signal,
  });
  // streamChat ya captura el finish_reason del proveedor (chat-client.ts
  // lo lee con finish-reason.ts): expón el MotivoParada en el resultado.
  return { texto: r, motivoParada: r.motivoProveedor };
};

// 2) La CADENA por rol: primario = lo que llegue en la llamada;
//    suplentes = tu failover. Ejemplo con los sugeridos del equipo:
import { EQUIPO_FORJA } from "@/lib/prism/forja/equipo";

const suplentesPorRol = {
  disenador:   EQUIPO_FORJA.disenador.sugerencias.map(({ providerId, modelId }) => ({ providerId, modelId })),
  codificador: EQUIPO_FORJA.codificador.sugerencias.map(({ providerId, modelId }) => ({ providerId, modelId })),
  revisor:     EQUIPO_FORJA.revisor.sugerencias.map(({ providerId, modelId }) => ({ providerId, modelId })),
};

// 3) El ADAPTADOR que le pasas al núcleo (antes pasabas la llamada pelada):
const llamarModelo = crearAdaptadorForja(transporte, {
  suplentesPorRol,
  intentosRed: 3,
  backoffBaseMs: 600,
  maxContinuaciones: 2,
  onEvento: (e) => registrarEnObservabilidad(e), // reintentos/failover/continuaciones
});
```

**Notas de cableado:**

- `LlamadaModelo` ahora acepta `rol?` en los argumentos: lo rellenan el núcleo,
  el Estudio y el bucle de mejora. Con eso el adaptador sabe qué techo de
  salida pedir y qué suplentes usar. Tus llamadas existentes siguen válidas.
- Si tu transporte no puede exponer el `finish_reason`, el adaptador funciona
  igual (sin continuación automática) y la defensa por forma del texto —
  `chequeosEstaticos` + Revisor — toma el relevo. Y desde v4.2, el segundo
  cinturón del núcleo (§10) cierra la rotura estructural aunque nadie mire
  el `finish_reason`.
- En el Lab ya está conectado: `integracion/forja-lab/llamador.ts` demuestra el
  patrón completo con el SDK del sandbox, incluida la telemetría al log.
- Errores fatales (401/403/modelo inexistente) no se reintentan en el mismo
  proveedor: failover directo. Los de red (timeout, 429, 5xx, socket) sí.

## §10 — v4.2 «Acero Templado»: salud, continuación de núcleo, caché, telemetría y presupuesto por rol

Cinco mejoras que hacen que la tubería v4.1 APRENDIZA (salud) y AHORRE
(caché, continuación en el núcleo). Todas opcionales y compatibles: sin
cablear nada nuevo, el pipeline funciona exactamente como en v4.1.

### 10.1 Salud de proveedores por latencia (`salud-proveedores.ts`)

```ts
import { crearSaludProveedores, saludDesdeJSON, saludAJSON } from "@/lib/prism/forja/salud-proveedores";

// UNA instancia por proceso (no por llamada): acumula evidencia
export const salud = saludDesdeJSON(localStorage.getItem("forja.salud")); // o tu store

const llamarModelo = crearAdaptadorForja(transporte, {
  suplentesPorRol,
  salud, // ← el adaptador anota y deja que la salud reordene los SUPLENTES
});

// persistencia a tu gusto:
addEventListener("beforeunload", () => localStorage.setItem("forja.salud", saludAJSON(salud)));
```

Qué hace: los suplentes se reordenan por latencia EWMA medida (los sanos
primero, los enfriados por fallos consecutivos al final). El primario nunca
se toca — es tu elección explícita.

### 10.2 Continuación a nivel núcleo (`continuacion-nucleo.ts`)

NO hay que cablear nada: `ejecutarForja`, `continuarForja`,
`ajustarMaquetaForja`, `estudioForja` y el bucle de mejora ya la aplican a
TODAS las llamadas. Detección estructural gratis (cercados impares,
`<html>`/`<style>`/`<script>` sin cerrar) + continuación con la MISMA
llamada. El ahorro: una salida rota no gasta un Revisor ni la regeneración
de la siguiente ronda — solo la cola. Evento nuevo para tu UI:
`onProgreso({ tipo: "continuacion-nucleo", rol, ronda, n })`.

### 10.3 Caché de generaciones por hash (`cache-fichas.ts`)

```ts
import { crearCacheMemoria } from "@/lib/prism/forja/cache-fichas";

const deps: DependenciasForja = {
  llamarModelo,
  memoria,
  cache: crearCacheMemoria(24), // ← una línea; LRU en memoria
};
```

La misma petición (mensaje + código + reglas + config, invalidada por
VERSION_FORJA) reusa ficha y maqueta inicial sin pagar la llamada. Para
caché persistente delante del LRU: `cacheEnCascada(capaHost, lru)`.
Eventos para tu UI: `onProgreso({ tipo: "cache", que: "ficha" | "maqueta" })`.

### 10.4 Telemetría → observabilidad (`observabilidad.ts`)

```ts
import { crearRegistro, cerrarRegistro, crearTelemetriaForja, serializarRegistro } from "@/lib/prism/forja/observabilidad";

const registro = crearRegistro(projectId);
const llamarModelo = crearAdaptadorForja(transporte, {
  suplentesPorRol,
  salud,
  onEvento: crearTelemetriaForja(registro, { tambien: miLog }), // ← el puente
});
// … al terminar la generación:
const cerrado = cerrarRegistro(registro, scoreFinal, lecciones);
persistir(serializarRegistro(cerrado)); // reintentos, failovers, continuaciones, tokens, latencias
```

El registro lleva `telemetria` (nuevo campo, tolerado en registros v4.1) y
`textoConsultas(consultarRegistros(rs))` suma el bloque «Blindaje de red».

### 10.5 Presupuesto de tokens por rol (`ConfigForja`)

```ts
cfg.maxTokensPorRol = { codificador: 8192, revisor: 4096 }; // el Diseñador usa el defecto
```

El núcleo resuelve `techoTokens(cfg, rol)` y lo envía en cada llamada (campo
nuevo `maxTokens` de `LlamadaModelo`). Precedencia: `args.maxTokens` >
`maxTokensPorRol` del adaptador > defecto (16.384 Codificador). Guardas:
256..65.536 (`sanearTokensRol`). La ruta de config del Lab ya lo acepta y
sanea; `_base.ts` ya lo persiste.

La historia completa del módulo (v3.0 «El Director Creativo», v2.4 ADN visual,
v2.3 Inspector visual, etc.) sigue aquí abajo, intacta.

---

# FORJA IA v3.0.0 — «El Director Creativo»
### IA virtual de diseño web para FORJA IA

Una IA que aparece en tu lista de modelos como un modelo más
(`FORJA IA · IA de Diseño`) y que por dentro es un **estudio de diseño**
completo: primero define el **ADN visual** del proyecto (personalidad,
sensación puntuada, lenguaje y PROHIBICIONES), decide cómo **REPRESENTAR la
información** de tu negocio (nada de dashboards de cajitas por defecto), te
propone **ideas que son variaciones de ese ADN** y una maqueta navegable, y
solo cuando apruebas, el equipo (Diseñador → Codificador → Revisor) tira el
código real con su bucle de corrección. Un **motor anti-genérico** detecta
los síntomas de plantilla de IA en cada entrega y manda corregirlos, un
**Inspector visual** audita el resto de bugs, la **Arena** hace duelar a dos
equipos y su juez GENERA lecciones para la siguiente generación (evolución
de diseño), el **Estudio** orquesta Director Creativo + panel de jueces +
fusión para los proyectos importantes, y el conocimiento vive en **6 capas**
con autoridad: tus preferencias mandan, los fallos (incluidos los de las
páginas MALAS que marques como contraejemplo) nunca se olvidan, las
tendencias caducan. Aprende de internet Y de los links que TÚ le des en su
**Apartado de Aprendizaje**.

```
Tu petición
   │
   ▼
Diseñador (modelo A) ──► REPRESENTACIÓN PRIMERO (¿cómo se explican estos
   │                     datos? radial · mapa · timeline · nodos · capas…)
   ├───────────────────► ADN VISUAL (personalidad, sensación 0..10,
   │                     lenguaje, PROHIBICIONES)
   ▼
   3 IDEAS = variaciones del mismo ADN + ficha concreta
   │
   ▼ (si toca maqueta: proyectos nuevos, perfil equilibrado/profundo)
Codificador (modelo B) ──► MAQUETA navegable ──► 🛡 anti-genérico (gratis)
   │        «Aprobado»  → código real                    │
   │        «Ajusta: …» → nueva maqueta (máx. 2)         │ informe de
   │        «Dirección 2» → re-maqueta con otra idea     │ saturación
   ▼
Código real ──► 👁 Inspector visual (chequeo automático, gratis)
   │
   ▼
Revisor (modelo C) recibe código + Inspector + INFORME ANTI-GENÉRICO
   │        (saturación ALTA con síntomas reales = defecto de identidad)
   ▼
Entrega + secciones «Inspector visual» y «Anti-genérico» + aprendizaje

── MODO ESTUDIO (opt-in, proyectos importantes, ~9 llamadas) ──
PETICIÓN → DIRECTOR CREATIVO → 3 VISIONES divergentes (misma identidad,
   otra representación) → 3 MAQUETAS en paralelo → PANEL DE JUECES
   (visual · UX/A11Y · originalidad + evidencia anti-genérica) →
   DIRECTOR FINAL → DISEÑO FUSIÓN → (código + Revisor como siempre)
```

## §11 — v4.4 «El Taller Eficiente»: presupuesto, caché multinivel, contexto compilado, enrutador determinista, salida temprana y ROI

La prioridad V4.4 del plan maestro (§22/23/24/25/26/28) implementada de una
pieza. La idea central: `LlamadaModelo` es la única puerta por la que pasa
dinero — si esa puerta es eficiente, TODO el sistema lo es.

### La forma rápida (1 línea en tu llamador)

```ts
import { crearLlamadaEficiente } from "@/lib/prism/forja/eficiencia";
import { presupuestoPara, crearPresupuesto } from "@/lib/prism/forja/presupuesto-tokens";
import { cacheMultinivelCompartido } from "@/lib/prism/forja/cache-multinivel";
import { crearLibroROI } from "@/lib/prism/forja/token-roi";

const { complejidad, reparto } = presupuestoPara(peticion.mensaje, false, "SMART");
const presupuesto = crearPresupuesto(reparto, "SMART");
const cache = cacheMultinivelCompartido(capapPersistenteDelHost); // opcional
const roi = crearLibroROI();

const llamadaEficiente = crearLlamadaEficiente(miAdaptadorResiliente, {
  presupuesto, cache, roi,
  onDenegada: (rol, motivo) => log(`denegada ${rol}: ${motivo}`),
  onCacheHit: (nivel) => log(`caché L${nivel}`),
}).llamarModelo;
```

Pásale `llamadaEficiente` al núcleo (o al Lab) donde antes pasaba el
adaptador: obtienes caché L1, presupuesto por fases y ROI en TODAS las
llamadas (núcleo, Arena, bucle) sin tocar nada más.

### O incluso más rápido: el MVP ya lo trae

`ejecutarMvpForja` monta la capa de eficiencia SOLO desde v4.4:

```ts
const res = await ejecutarMvpForja(peticion, {
  llamarModelo: miAdaptadorResiliente,
  perfil: "SMART",
  cache: capaPersistenteDelHost,   // opcional (localStorage/SQLite/redis)
  // sinEficiencia: true,          // escape hatch para pruebas A/B
});
res.registro.eficiencia  // presupuesto, caché, ROI, ahorro estimado
res.resultado.respuesta  // incluye la cuenta del ahorro para el usuario
```

### Las piezas y su sección del plan

| Archivo | Plan | Qué hace |
|---|---|---|
| `presupuesto-tokens.ts` | §25 | techo por GENERACIÓN en 6 fases; autorizar/estimar/gastar; rescate desde reserve |
| `cache-multinivel.ts` | §24 | L1 respuesta · L2 ficha · L3 decisión ADN · L4 patrón · L5 parche · L6 QA |
| `compilador-contexto.ts` | §23 | contexto deduplicado + relevante + a techo; prohibiciones duras SIEMPRE |
| `enrutador-determinista.ts` | §22 | Detect → Classify → Patch GRATIS (lang, alt, noopener, tabindex, reduced-motion, overflow…) |
| `salida-temprana.ts` | §26 | ¿good enough? → STOP; parche determinista antes que LLM |
| `token-roi.ts` | §28 | operación · tokens · resultado → quality gain / tokens + recomendaciones |
| `eficiencia.ts` | — | el envoltorio que encadena los tres sistemas en una LlamadaModelo |

### Persistencia del aprendizaje

El ROI es acumulativo entre generaciones si el host lo persiste:

```ts
roiAJSON(libro.roiPorOperacion().length ? todosLosRegistros : [])  // → guardar donde quieras
const libro = crearLibroROI(roiDesdeJSON(jsonGuardado));
```

### Pruebas

- `node integracion/adapter-test/verificacion-v44.mjs` — 52 pruebas sin red
  (requiere el bundle construido; lee `motor-forja.mjs` del host o pásale la
  ruta como argumento).
- `node integracion/adapter-test/verificacion-v45.mjs` — 86 pruebas sin red.
- `node integracion/adapter-test/verificacion-v46.mjs` — 86 pruebas sin red
  (las ideas A-F de v4.6 + integración).
- `node integracion/adapter-test/construir-bundle.mjs [salida.mjs]` —
  reconstruye el bundle y verifica los 45 nombres críticos del Estudio.

## §13 — v4.6 «El Taller que Aprende»: primitivas compiladas, objeto 3D forjado, learning loop, motion QA, contrato JSON y Arena de familias

### A · Primitivas compiladas (0 tokens por pieza reutilizada)

```ts
import {
  elegirPrimitivas, cssPrimitivas, htmlPrimitiva, scriptPrimitivas,
  seccionPrimitivas, resumenPrimitivas, PRIMITIVAS_BLOQUE, defPrimitiva,
} from "@/lib/prism/forja/primitivas";

const e = elegirPrimitivas(dnaExperiencia, receta, heroElegido, mensaje);
e.primitivas;            // ["REVEAL_GRUPO", "TILT_CARD", "FLOATING_METRIC"…]
e.kbTotales;             // KB del material compilado
cssPrimitivas(e.primitivas);      // CSS completa (reduced-motion + foco ya hechos)
htmlPrimitiva("MARQUEE", ["Marca 1", "Marca 2"], "Marcas"); // HTML paramétrico
scriptPrimitivas(e.primitivas);   // script capado ("" si no hace falta)
```

El Codificador/maquetador recibe TODO por el núcleo (`cssDeterminista()` +
`scriptDeterminista()` + el HTML de ejemplo en `mensajeMaqueta()`): su trabajo
es parametrizar contenido, no re-inventar mecánica.

### B · Learning loop del Genoma (persistir y recomendar)

```ts
import {
  registrarResultadoAprendizaje, recomendacionesAprendidas,
  ajustesHeroAprendidos, serializarAprendizaje, deserializarAprendizaje,
  cargarMemoriaAprendizaje, resumenAprendizaje,
} from "@/lib/prism/forja/aprendizaje-genoma";

// El núcleo registra SOLO tras cada generación (fase 8b). El host persiste:
await guardarEnStore(serializarAprendizaje());          // tras cada generación
cargarMemoriaAprendizaje(deserializarAprendizaje(store)); // al arrancar
// o de una pieza: ejecutarMvpForja(peticion, { memoriaAprendizaje: entradas })

const recs = recomendacionesAprendidas({ minMuestras: 3 });
// → [{ accion: "destacar", dimension: "hero", valor: "HERO_SPLIT",
//      muestras: 5, scoreMedio: 91, evidencia: "…" }, …]
const ajustes = ajustesHeroAprendidos(3); // → { HERO_SPLIT: +2, HERO_MINIMAL: -2 }
```

### C · Objeto 3D forjado (render directo en el host)

```ts
import { elegirObjeto3d, htmlObjeto3d, cssObjeto3d, catalogoObjetos3d } from "@/lib/prism/forja/objeto-3d";

const objeto = elegirObjeto3d(dna, familia, mensaje, historialObjetos);
objeto.html;  // <div class="f3d" aria-hidden="true">…</div>  → innerHTML
objeto.css;   // ~2 KB, 0 librerías, reduced-motion → <style>
// la selección completa ya lo decide sola: seleccionarExperiencia(msg).objeto
```

### D · Motion QA medido (fase 6c del núcleo; también autónomo)

```ts
import { medirMovimiento, parchesMovimiento, auditarYparchearMovimiento, guardReducedMotion } from "@/lib/prism/forja/motion-qa-medido";

const informe = medirMovimiento(html);
informe.duraciones;      // [{ ms, categoria, selector, declaracion, dentroEscala, ambiente }]
informe.hallazgos;       // escala-tiempos · reduced-motion-guard · stagger-ausente
informe.score;           // 0..100
const r = parchesMovimiento(html, informe, planMovimiento);
// r.html (guard + overrides capados + stagger), r.parches, r.informe (re-medido)
```

### E · Contrato de experiencia exportable/editable (JSON)

```ts
import { exportarContrato, serializarContrato, validarContrato, aplicarEdicionContrato, resumenEdicion } from "@/lib/prism/forja/contrato-experiencia";

const contrato = exportarContrato(seleccion, mensaje, VERSION_FORJA);
const json = serializarContrato(contrato);   // schema forja.experiencia@1
const v = validarContrato(JSON.parse(json)); // { ok, errores[], avisos[] }
const r = aplicarEdicionContrato({ ...contrato, edicion: { familia: "editorial", hero: "HERO_MINIMAL", intensidad: 1, use3d: false } });
r.sel;        // SeleccionExperiencia re-compilada (0 tokens)
r.css; r.script; r.contrato;
```

Campos editables: `familia · hero · intensidad (0-4) · modoEspacial ·
profundidad · elevacion · blur · radiusPx · use3d · pesoObjeto`.

### F · Arena entre familias

```ts
import { asignarFamiliasArena, coherenciaFamilia, notasCoherenciaFamilia, leccionesFamilia, seccionFamiliaAsignada } from "@/lib/prism/forja/arena-familias";

const asignacion = asignarFamiliasArena(mensaje); // 3 familias DISTINTAS (A/B/C)
// automático vía núcleo: arena2Forja(msg, adn, modo, perfil, { familiasArena: asignacion })
coherenciaFamilia(textoMaqueta, "spatial"); // { score 0..1, encontradas, faltantes, evidencia }
leccionesFamilia(asignacion, notasCoherencia, medias, vertical); // → Genoma
```

## Novedades v3.0.0

| Novedad | Qué significa para ti |
|---|---|
| **Motor anti-genérico** (`antigenerico.ts`) | FORJA IA aprende también de las páginas MALAS: un detector determinista y GRATUITO examina cada maqueta y cada entrega buscando los síntomas de plantilla de IA (hero centrado, título gigante, botón azul #3B82F6, tres tarjetas gemelas, fondo degradado, blobs, glassmorphism en exceso, dashboard de cajitas) y emite el informe con NIVEL DE SATURACIÓN, puntuación de identidad 0..100 y ALTERNATIVAS concretas por síntoma. Saturación alta = defecto de identidad que el Revisor manda corregir. | 
| **Representación primero** (`representacion.ts`) | Antes de elegir componentes, el Diseñador decide cómo representar la información de ESTE negocio: composición radial, mapa, timeline, capas, nodos, módulos asimétricos, visualización contextual, navegación espacial, editorial o lienzo. Candidatas detectadas de tu petición, ejemplo incluido. Lo prohibido ya no es el patrón clásico: es NO decidir. |
| **El Estudio** (`director.ts`) | La Arena jerárquica que dibujaste: Director Creativo → 3 visiones divergentes (misma identidad, otra representación) → 3 maquetas en paralelo → Panel de Jueces (visual · UX/A11Y · originalidad, este último con el informe anti-genérico como EVIDENCIA) → Director Final → Diseño FUSIÓN → código con Revisor. ~9 llamadas, modo opt-in; si algo falla, respaldo honesto en cada fase (incluso caer al pipeline normal). |
| **Contraejemplos** | Marca una fuente del Apartado como «página mala»: el ciclo deja de aprender sus aciertos y extrae REGLAS DE EVITACIÓN que entran en la capa `fallo` (la de oro). Saber reconocer lo genérico es la mitad que faltaba del aprendizaje. |
| **El Estudio enseña** | Las lecciones del panel (conservar/evitar/destacar) se registran como en la Arena: cada estudio es una generación más de la evolución. |

## Novedades v2.4.0

| Novedad | Qué significa para ti |
|---|---|
| **ADN visual** (`adn-visual.ts`) | Antes de proponer direcciones, el Diseñador define la identidad del proyecto: personalidad (tecnológico, silencioso, preciso…), sensación puntuada por eje (confianza 8/10, innovación 9/10, lujo 7/10, agresividad 2/10), lenguaje visual (superficies limpias, tipografía protagonista…) y PROHIBICIONES (tarjetas genéricas, gradientes excesivos, blobs, glassmorphism en exceso…). Las 3 direcciones son ahora VARIACIONES del mismo ADN, no tres webs distintas. |
| **El ADN manda en todo el equipo** | El maquetador y el Codificador lo reciben como sección obligatoria, el Reviso­r audita contra sus prohibiciones («si el código incumple una, es un defecto») y el Juez evalúa la fidelidad al genoma. Si un modelo se olvida del bloque, entra el ADN de respaldo ANTI-GENÉRICO con tus prohibiciones por defecto — el flujo nunca se bloquea. La respuesta muestra la sección «ADN visual del proyecto» y `ResultadoForja.adn` lo expone a la UI. |
| **Arena evolutiva** | El juez ya no solo puntúa: emite 2-4 LECCIONES (`destacar` / `conservar` / `evitar`) que se convierten en experimentos, patrones y fallos para la siguiente generación. Cada duelo avanza la `generacion` del almacén: la evolución de diseño empieza. El host persiste las lecciones con `registrarLeccionesArena()` tras cada duelo (ver §7b). |
| **Conocimiento en 6 capas** | Adiós a las 120 reglas planas: tus **preferencias** mandan sobre todo, los **fallos** son oro que no se expulsa, los **experimentos** llevan puntuación y generación, los **fundamentos** son estables, los **patrones** se anclan a tipos de proyecto y las **tendencias** caducan con fecha. Las contradicciones («16px» vs «24px») se arbitran por autoridad y la perdedora queda «superada» (auditable, fuera del prompt). La cesta por petición se reparte en equilibrio y cada regla viaja etiquetada: `[preferencia]`, `[fallo G3]`, `[experimento 82/100]`… |

## Novedades v2.3.0

| Novedad | Qué significa para ti |
|---|---|
| **Inspector visual** (`vision.ts`) | En cada ronda, el núcleo ejecuta `chequeosEstaticos(codigo)`: una función pura y gratuita que encuentra los bugs objetivos (meta viewport ausente, imágenes sin alt, campos sin etiqueta, saltos de jerarquía h1→h3, contraste bajo en los colores declarados, texto < 12px, `target=_blank` sin noopener, etiquetas obsoletas…). El informe viaja al Revisor con la instrucción de confirmar o descartar cada hallazgo: los críticos confirmados bloquean la aprobación. |
| **Visión con capturas** | Contrato `LlamadaVision` + `PROMPT_VISION` + `parseHallazgos()`: si el host inyecta un modelo multimodal (BYOK), FORJA puede mirar CAPTURAS de la vista previa y detectar lo que una regex no ve: solapes, texto cortado, desbordes en móvil, imágenes rotas. |
| **Resultado visible** | `ResultadoForja.vision` expone los hallazgos finales y la respuesta incluye la sección «Inspector visual». La UI del preview añade la pestaña Inspector (los mismos chequeos corren en el navegador) con analizador de HTML pegado. |
| **Anti-demora** | Desde 4.0.1, transporte por SONDEO CORTO: `POST /api/forja/chat` devuelve `{id}` al instante y los eventos se leen con `GET /api/forja/chat?id=&desde=` hasta `terminado` — los proxies que recortan SSE ya no rompen el chat (las peticiones de 1-2 min ya no mueren con «el servidor no respondió»). Cronómetro visible por fase, maquetas más compactas (regla 7 del prompt) y modo rápido sin maqueta en el preview. |

## Novedades v2.2.0

| Novedad | Qué significa para ti |
|---|---|
| **La Arena** (`arena.ts`) | Dos equipos FORJA resuelven tu petición en paralelo. Un juez puntúa 5 criterios (jerarquía, color, tipografía, accesibilidad, originalidad, 0-10 cada uno) y explica su veredicto. Modo «maquetas» (económico): solo compite el diseño y el ganador pasa a producción. Modo «completa»: duelo de entregas finales. TÚ decides al final: puedes seguir con el perdedor. |
| **Código de integración listo** (`integracion/`) | Panel React del Apartado con dictamen en vivo, rutas `/api/forja/fuentes` y `/api/forja/aprender` con TODAS las guardas del lado servidor, y cron diario documentado. Copiar-adaptar y listo. |
| **Progreso por equipo** | Nuevo evento `{ tipo: "arena", equipo, evento }` envuelve cada evento de cada equipo: la UI puede ver los dos pipelines en vivo. |

## Novedades v2.1.0

| Novedad | Qué significa para ti |
|---|---|
| **Apartado de Aprendizaje** | Un panel donde pegas links de sitios, repos de GitHub y documentos (.md/.txt). En cada ciclo, FORJA IA lee TUS fuentes activas primero y destila reglas de ellas. Con estadísticas por fuente: lecturas y reglas aportadas. |
| **Seguridad por capas** | Validación anti-SSRF en cliente Y servidor, bloqueo de acortadores y binarios, limpieza anti-inyección del contenido leído y descanso mínimo de 15 min entre ciclos. El detalle completo está en `SEGURIDAD.md`. |
| **El chat solo propone** | Puedes decirle «añade esta fuente: …» por chat, pero la fuente solo se acepta cuando la apruebas en el panel. Así ni una página envenenada puede decidir de qué aprende tu IA. |
| **Botón «olvidar»** | Borra las reglas aprendidas de una fuente concreta (o vacía todo el conocimiento de la web) sin tocar tu memoria personal. |

## Novedades v2.0.0

| Novedad | Qué significa para ti |
|---|---|
| **Maqueta antes de código** | Ya no recibes código de algo que no pediste: primero 3 ideas con nombre y concepto + una maqueta HTML navegable en la vista previa. Apruebas, ajustas o cambias de idea — y DESPUÉS se produce. |
| **Autoaprendizaje de internet** | Un ciclo que lee fuentes curadas (incluido el repo abierto con los prompts de v0, Lovable, Bolt y Cursor) y destila REGLAS generales en tu conocimiento global. La IA mejora sola cada semana que la alimentes. |
| **Perfiles de recursos** | `ligero` / `equilibrado` / `profundo`: el dial entre rapidez y calidad. Sin maqueta y 2 rondas, o con maqueta y hasta 4 rondas. |
| **Prompts pulidos nivel senior** | El Diseñador ahora trabaja con método de director de arte: sentimiento → acción única → recuerdo de 10 segundos → público. Estrategia antes que estética. |
| **3 habilidades nuevas** | Tendencias actuales (con juicio), apps SaaS (estados vacío/carga/error, tablas, toasts) y negocio local (horarios, reservas, fotos reales). |

## Archivos

| Archivo | Qué es |
|---|---|
| `src/lib/prism/forja/tipos.ts` | Contrato completo: roles, ficha, maqueta, perfiles, veredicto |
| `src/lib/prism/forja/version.ts` | Versión instalada y novedades (la pinta la UI) |
| `src/lib/prism/forja/modelo.ts` | Registro del modelo virtual + capacidades + ficha |
| `src/lib/prism/forja/equipo.ts` | Los 3 puestos + modelos sugeridos por rol |
| `src/lib/prism/forja/nucleo.ts` | El motor: maqueta + bucle de corrección + continuación |
| `src/lib/prism/forja/nucleo-extractos.ts` | Extractores puros (código, decisiones) |
| `src/lib/prism/forja/maqueta.ts` | La fase de propuesta visual y sus ajustes |
| `src/lib/prism/forja/habilidades.ts` | 9 habilidades (landing, dashboard, e-commerce, tendencias…) |
| `src/lib/prism/forja/conocimiento/disenador.ts` | Prompt maestro del Diseñador (v2 con estrategia) |
| `src/lib/prism/forja/conocimiento/codificador.ts` | Prompt maestro del Codificador |
| `src/lib/prism/forja/conocimiento/revisor.ts` | Prompt maestro del Revisor |
| `src/lib/prism/forja/conocimiento-usuario.ts` | Memoria entrenable del usuario (reglas + éxitos) |
| `src/lib/prism/forja/conocimiento-global.ts` | Almacén de reglas aprendidas de internet (tope 120) |
| `src/lib/prism/forja/fuentes.ts` | Fuentes semilla curadas (prompts de las mejores IAs, M3, HIG…) |
| `src/lib/prism/forja/autoaprendizaje.ts` | El ciclo: planificar → leer → limpiar → destilar → fusionar → informe |
| `src/lib/prism/forja/fuentes-usuario.ts` | El Apartado: tus fuentes (añadir, validar, pausar, olvidar, estadísticas) |
| `src/lib/prism/forja/seguridad-web.ts` | Las capas de seguridad: dictamen de URLs, anti-XSS, anti-inyección, presupuestos |
| `src/lib/prism/forja/arena.ts` | La Arena: dos equipos en paralelo + juez con 5 criterios y veredicto tolerante |
| `integracion/` (fuera de src) | **Código listo para copiar**: PanelAprendizaje.tsx, rutas API y cron.md |

### La carpeta `integracion/`

| Archivo | Qué es | Dónde va |
|---|---|---|
| `integracion/PanelAprendizaje.tsx` | Componente React 19 + Tailwind 4: dictamen en vivo, alta con nota/calidad, pausar, olvidar, stats, botón «Aprender ahora» con informe | `src/components/d1/` (o donde montes Ajustes) |
| `integracion/api/forja/_base.ts` | Almacén server-side (JSON en disco, sustituible por tu store) + guardia de dueño (`FORJA_ADMIN_SECRET`) | `app/api/forja/_base.ts` |
| `integracion/api/forja/fuentes/route.ts` | GET/POST/PATCH/DELETE del panel, con dictamen repetido en el servidor | `app/api/forja/fuentes/route.ts` |
| `integracion/api/forja/aprender/route.ts` | POST del ciclo con TODAS las guardas (dueño, descanso 429, dictamen tras redirects, content-type, 2 MB, timeout 12 s) | `app/api/forja/aprender/route.ts` |
| `integracion/cron.md` | Vercel Cron / crontab / GitHub Actions para el estudio diario | (doc) |

## Instalación (7 pasos)

### 1. Copia la carpeta

```bash
cp -r d1 /ruta/a/FORJA IA/src/lib/prism/
```

Cero dependencias nuevas. Cero toques a módulos existentes: `d1/` solo
importa desde sus propios archivos.

### 2. Conecta el modelo virtual a tu lista de modelos

```ts
import { ENTRADA_FORJA, esForja } from "./d1/modelo";

const lista = [...modelosDeProveedores, ENTRADA_FORJA];

if (esForja(modelKeySeleccionado)) {
  return enviarPorForja(mensaje);
}
```

### 3. Conecta el núcleo a tu chat-client (con flujo de maqueta)

```ts
import { ejecutarForja, continuarForja, ajustarMaquetaForja } from "./d1/nucleo";
import { MEMORIA_DEFECTO } from "./d1/conocimiento-usuario";
import { deserializarConocimiento, CLAVE_CONOCIMIENTO_GLOBAL } from "./d1/conocimiento-global";

async function enviarPorForja(mensaje: string) {
  const resultado = await ejecutarForja(
    {
      mensaje,
      codigoActual: codigoDelProyectoActual(),
      reglasAprendidas: [],
      conocimientoGlobal: reglasGlobalesCargadas(), // ver paso 4
      // modo: "directo" si el usuario eligió el botón «sin maqueta»
    },
    configD1DelStore(),          // { porRol, habilidades, perfil }
    {
      llamarModelo: miChatClient,       // tu función real de llamada
      memoria: memoriaD1DelStore(),
      onMemoriaNueva: guardarMemoriaForja,
      onProgreso: (ev) => pintarTrazoEnVivo(ev),
    },
    modeloActivoDelChat()        // fallback si un rol no tiene modelo
  );

  // ── ESTADO 1: propuesta visual lista, esperando TU decisión ──
  if (resultado.estado === "esperando-aprobacion") {
    guardarEstadoPendiente(resultado);      // fichaTexto + maqueta + rondas
    mostrarEnPreview(resultado.maqueta?.html); // la maqueta navegable
    mostrarRespuesta(resultado.respuesta);     // las 3 ideas + qué decidir
    return;
  }

  // ── ESTADO 2: entrega completa ──
  guardarEnPreview(resultado.codigo);
  mostrarRespuesta(resultado.respuesta);
}
```

### 4. Los dos botones que cierran el flujo de maqueta

```ts
// «Aprobado» (o «directo»): el equipo codifica con la ficha ya hecha
const entrega = await continuarForja(
  peticionOriginal,
  estadoPendiente.fichaTexto,
  configD1DelStore(),
  deps,                     // las mismas DependenciasForja de antes
  modeloActivoDelChat()
);
guardarEnPreview(entrega.codigo);

// «Ajusta: …» o «usa la dirección 2»
const ajustada = await ajustarMaquetaForja(
  peticionOriginal,
  estadoPendiente.fichaTexto,
  estadoPendiente.maqueta,  // la PropuestaMaqueta anterior
  feedbackDelUsuario,       // texto literal, ej: «hero más alto y tipografía serif»
  configD1DelStore(),
  deps,
  modeloActivoDelChat()
);
mostrarEnPreview(ajustada.maqueta?.html);
```

### 5. El ciclo de autoaprendizaje (el botón «Aprender de la web»)

El módulo no toca la red: tú le pasas el lector. En FORJA IA ya tienes
piezas equivalentes en `src/lib/prism` (lector de páginas / buscador).

```ts
import { cicloAprendizaje, type LectorWeb } from "./d1/autoaprendizaje";
import { deserializarConocimiento, serializarConocimiento, CLAVE_CONOCIMIENTO_GLOBAL } from "./d1/conocimiento-global";

const lector: LectorWeb = {
  leer: async (url) => (await fetch(url)).text(),        // o tu lector HTML→texto
  buscar: async (q) => resultadosDeTuBuscador(q),        // opcional
};

const informe = await cicloAprendizaje(
  lector,
  deserializarConocimiento(localStorage.getItem(CLAVE_CONOCIMIENTO_GLOBAL)),
  miChatClient,                                          // el modelo destilador
  config.porRol.disenador ?? modeloActivoDelChat()
);

localStorage.setItem(CLAVE_CONOCIMIENTO_GLOBAL, serializarConocimiento(informe.almacen));
mostrarRespuesta(informe.informe);  // qué leyó, qué aprendió, qué descartó
```

Cámbialo por una ruta `/api/forja/aprender` con un botón en Ajustes, o por un
cron diario: el ciclo es acotado (3 fuentes, 1 llamada de destilación por
fuente) y seguro (solo https, sin privados, sin textos literales de terceros).

### 6. El Apartado de Aprendizaje (tus propias fuentes)

El flujo completo con fuentes del usuario. Estado en tu store, ruta API
para el ciclo y el panel en Ajustes.

```ts
import {
  anadirFuente, alternarFuente, quitarFuente, fuentesActivas,
  dictamenFuente, registrarLecturasFuentes, olvidarReglasDeFuente,
  interpretarOrdenFuentes, responderOrdenFuentes,
  serializarFuentes, deserializarFuentes,
  CLAVE_FUENTES_USUARIO,
} from "./d1/fuentes-usuario";

// ── Estado del panel (localStorage / zustand / DB) ──
let fuentes = deserializarFuentes(store.get(CLAVE_FUENTES_USUARIO));
const persistirFuentes = () => store.set(CLAVE_FUENTES_USUARIO, serializarFuentes(fuentes));

// ── ALTA (el botón «añadir» del panel): dictamen primero, para pintar
// el porqué del rechazo ANTES de guardar ──
function añadirDesdePanel(urlPegada: string, nota?: string) {
  const d = dictamenFuente(urlPegada);
  if (!d.ok) return mostrarError(d.motivos.join(" "));
  const r = anadirFuente(fuentes, urlPegada, { nota });
  if (r.error) return mostrarError(r.error);
  fuentes = r.lista;
  persistirFuentes();
}

// ── CICLO (ahora SÍ prioriza tus fuentes activas): ──
const informe = await cicloAprendizaje(
  lector,
  almacenActual,
  miChatClient,
  config.porRol.disenador ?? modeloActivoDelChat(),
  fuentesActivas(fuentes)        // ← el Apartado entra aquí
);
if (informe.ejecutado) {
  fuentes = registrarLecturasFuentes(fuentes, informe.reglasPorFuente);
  persistirFuentes();
  store.set(CLAVE_CONOCIMIENTO_GLOBAL, serializarConocimiento(informe.almacen));
  mostrarRespuesta(informe.informe);
}

// ── CHAT: si el usuario escribe «añade esta fuente: https://…» o pega una
// URL pelada, responde con la propuesta y muestra el botón del panel ──
const orden = interpretarOrdenFuentes(mensajeUsuario);
const respuestaFuentes = responderOrdenFuentes(orden, fuentes, almacen.ultimoCiclo);
if (respuestaFuentes) {
  mostrarRespuesta(respuestaFuentes);
  if (orden.tipo === "proponer") abrirPanelConUrlPrecargada(orden.url);
}

// ── GESTIÓN (panel): pausar, borrar y OLVIDAR ──
fuentes = alternarFuente(fuentes, id);                 // pausa/reactiva
fuentes = quitarFuente(fuentes, id);                   // quita de la lista
almacen = olvidarReglasDeFuente(almacen, id);          // …y borra sus reglas
```

#### La ruta API del ciclo (con todas las guardas del lado servidor)

```ts
// app/api/forja/aprender/route.ts — el esqueleto completo con comentarios
// está en SEGURIDAD.md §3: guardia de dueño, descanso server-side,
// dictamen repetido tras fetch, content-type, tope de bytes y timeout.
```

> **Regla de oro del Apartado:** el chat solo PROPONE; el panel APRUEBA.
> Y repite `urlAptaparaAprendizaje()` en el servidor antes de cualquier
> fetch: nunca confíes en el cliente. Más capas y razón de cada una en
> `SEGURIDAD.md`.

### 7. La Arena (opcional): dos equipos compiten, un juez decide

```ts
import { arenaForja } from "./d1/arena";

const resultado = await arenaForja(
  peticion,                     // la misma PeticionForja de siempre
  configD1DelStore(),           // equipo A: tu config habitual
  deps,                         // equipo A: llamarModelo + memoria + onProgreso
  {
    equipoB: configAlternativaDelStore(),   // otro modelo en el Diseñador, otra memoria…
    depsB: { llamarModelo: miChatClient, memoria: memoriaD1DelStore() },
    juez: { providerId: "deepseek", modelId: "deepseek-v3" },  // opcional: sin esto, el modelo activo
    modo: "maquetas",           // «maquetas» (económico, defecto) o «completa»
    criteriosDelUsuario: "que sea rápido en móvil y sin azul genérico",
  },
  modeloActivoDelChat()
);

mostrarRespuesta(resultado.respuesta);           // tabla de puntuaciones + veredicto
mostrarEnPreview(resultado.ganadorResultado.maqueta?.html ?? resultado.ganadorResultado.codigo);

// El usuario manda: si prefiere al perdedor, continúas con su config:
// continuarForja(peticion, resultado.equipoA.fichaTexto, resultado.equipoA → cfg A…)
```

Costes: modo «maquetas» ≈ 1× producción normal + 1× fase de diseño + 1
llamada del juez. Modo «completa» ≈ 2× la petición + el juez. En empate
sigue el Equipo A (y el usuario puede cambiar).

## Ajustes (UI mínima sugerida)

| Ajuste | Control | Defecto |
|---|---|---|
| Modelo del Diseñador / Codificador / Revisor | selector de tus modelos | (vacío = modelo activo) |
| Perfil de recursos | ligero / equilibrado / profundo | equilibrado |
| Maqueta primero | interruptor | activado |
| Rondas máx. de corrección | 1–5 (opcional: el perfil propone) | según perfil |
| Habilidades activas | checkboxes del catálogo (9) | — |
| Memoria entrenada | lista editable de reglas | — |
| **Apartado de Aprendizaje** | panel: lista de fuentes con estado (●/○), stats, añadir con dictamen en vivo, pausar, borrar, «olvidar reglas de esta fuente» — **componente listo en `integracion/PanelAprendizaje.tsx`** | vacío |
| Conocimiento de la web | ver reglas + botón «Aprender ahora» (respeta el descanso de 15 min) + «olvidar todo» | — |
| Versión instalada | etiqueta de `version.ts` | — |

## Perfiles de recursos

| Perfil | Llamadas típicas | Maqueta | Rondas | Reglas de la web |
|---|---|---|---|---|
| `ligero` | 3–5 | nunca | 2 | 4 |
| `equilibrado` | 5–7 | proyectos nuevos | 3 | 6 |
| `profundo` | 5–9 | siempre que aplique | 4 | 10 |

El usuario SIEMPRE puede forzar en un mensaje concreto: «sin maqueta» /
«directo» (salta la propuesta) o «maqueta» / «dame ideas» (la fuerza,
incluso en ediciones). `debeMaquetar()` en tipos.ts aplica estas reglas.

## Cómo se "entrena" (4 niveles)

1. **Prompts maestros** (incluido): método de dirección de arte + reglas de
   código + checklist de auditoría, destilados y compactos.
2. **Habilidades** (incluido): 9 bloques por tipo de proyecto que se activan
   solos según lo que pidas.
3. **Memoria del usuario** (`conocimiento-usuario.ts`): tus reglas son ley;
   tras cada entrega aprobada guarda las decisiones que sobrevivieron.
4. **Conocimiento de la web** (`conocimiento-global.ts` + `autoaprendizaje.ts`):
   reglas destiladas de design systems y de los prompts de las mejores IAs,
   Y de las fuentes que tú añadas en el Apartado (tus fuentes activas van
   PRIMERO en cada ciclo). Con peso, vigencia (las tendencias caducan),
   tope de 120 reglas y derecho al olvido. Solo viajan 4–10 por petición
   según perfil: nunca satura la ventana.

## Visión e inspección (v2.3): qué corre solo y qué se inyecta

Hay dos niveles, y el primero ya viene ACTIVADO de fábrica:

1. **Inspector estático (automático, 0 llamadas).** El núcleo llama a
   `chequeosEstaticos(codigo)` en cada ronda y le pasa el informe al
   Revisor. No tienes que cablear nada: si copias el módulo, ya funciona.
   También puedes usarlo en tu propia UI:

   ```ts
   import { chequeosEstaticos, informeInspector } from "@/lib/prism/forja/vision";
   const hallazgos = chequeosEstaticos(htmlActual); // pure: browser y server
   ```

2. **Visión con capturas (opcional, host inyecta el modelo).** Para mirar
   solapes, texto cortado y desbordes reales, inyecta un modelo multimodal
   en `LlamadaVision` (captura de tu vista previa → base64) y llama a
   `parseHallazgos()` con la respuesta. Formato cerrado con etiquetas, igual
   que el resto del módulo:

   ```ts
   import { PROMPT_VISION, FORMATO_VISION, mensajeVision, parseHallazgos } from "@/lib/prism/forja/vision";

   const texto = await llamadaVision({
     imagen: capturaBase64,               // screenshot de la vista previa
     mimeType: "image/webp",
     system: `${PROMPT_VISION}\n\n${FORMATO_VISION}`,
     user: mensajeVision({ mimeType: "image/webp", html: codigoRecortado }),
   });
   const hallazgosVisuales = parseHallazgos(texto);
   ```

   Útil tras la entrega («¿se ve bien en móvil?» con captura a 390px) y en
   la Arena (captura de cada maqueta como criterio extra para el juez).
   Si no lo cableas, no pasa nada: el Inspector estático sigue funcionando.

## §14 — v4.7 «La Página, no el Hero»: plano de contenido, QA de detalle e iconografía

### G · Plano de contenido (qué lleva la página, no solo cómo se ve)

```ts
import {
  construirPlanoContenido, seccionPlanoContenido, resumenPlano,
  extraerHechos, verticalDeContenido, nivelDeDetalle, PRESUPUESTOS,
} from "@/lib/prism/forja/plano-contenido";

const plano = construirPlanoContenido(mensajeDelUsuario, { nivel: "produccion" });
plano.secciones;      // [{ id: "nav", nombre: "Navegación", minItems: 0, … }, …]
plano.hechos;         // { precios: ["$15","$12"], ciudades: ["Ponce"], … }
plano.presupuesto.maxTokensImplementacion; // techo de tokens de esta generación

// ya viaja SOLO por seleccionarExperiencia(): sel.plano
const sel = seleccionarExperiencia(mensaje, { mensajeOriginal: mensaje });
```

Se calcula UNA vez dentro de `seleccionarExperiencia()` (paso 12) con el
mensaje **original** (`opts.mensajeOriginal`), nunca con el corpus de
señales compuesto: mezclarlo con la ficha o el ADN produciría precios y
horarios fantasma. Su sección ya viaja en
`seccionContratoExperiencia()` y su techo de tokens en la llamada del
Codificador (`nucleo-v4.ts`).

Perilla de la UI: `DepsMvp.nivelDetalle` (`"borrador" | "produccion" |
"showcase"`) fuerza el nivel; sin ella se deduce del brief
(`nivelDeDetalle()`).

### H · QA de detalle (fase 6d del núcleo; también autónomo)

```ts
import { auditarDetalle, medirDetalle, seccionReparacionDetalle, resumenDetalle } from "@/lib/prism/forja/qa-detalle";

const informe = auditarDetalle(htmlFinal, seleccion.plano);
informe.puntuacion;   // 0..100
informe.veredicto;    // "PASS" | "WARN" | "FAIL"
informe.hallazgos;    // [{ id, gravedad, titulo, evidencia, correccion }, …]

// si FAIL: un encargo corto para UNA llamada de reparación (no regenerar)
const encargo = seccionReparacionDetalle(informe, seleccion.plano);
```

Corre automáticamente en `ejecutarMvpForja()` tras el motion QA (6c). Si el
veredicto es FAIL, encarga la ampliación con rollback: solo se acepta si
sube la puntuación de detalle Y no rompe el veredicto visual. Para
desactivar la llamada extra en pruebas (el QA sigue midiendo y
registrando):

```ts
ejecutarMvpForja(peticion, { ...deps, sinReparacionDetalle: true });
```

El registro (`resultado.registro.experiencia.detalleQa`) lleva el resumen
de una línea para persistir junto al resto de observabilidad.

### I · Iconografía e imagen compiladas (0 tokens por icono reutilizado)

```ts
import { elegirIconos, svgIcono, seccionIconografia, cssIconografia, figuraPlaceholder } from "@/lib/prism/forja/iconos";

const eleccion = elegirIconos(mensaje, 10);  // { iconos: [...], motivo }
svgIcono("reloj", { tamano: 20 });           // <svg …>…</svg> con currentColor
figuraPlaceholder("Fachada del local", { ratio: "16 / 9" }); // aspect-ratio fijo
```

Igual que las primitivas: el Codificador selecciona y parametriza, no
dibuja paths a mano. Ya viaja por `seccionContratoExperiencia()` (bloque
«ICONOGRAFÍA») y por `cssDeterminista()` (clases `.f-ico` y `.f-fig-marco`).

### Correcciones de cableado de esta entrega (afectan a integraciones existentes)

Si ya integraste v4.6, revisa estos tres puntos:

1. **`recompilarDesdeDna(dna, opts)`** ahora necesita `opts.mensajeOriginal`
   para no degradar la familia a `minimal`. Si tu panel de edición del
   contrato llama a esto, pasa el mensaje original de la generación.
2. **`DepsMvp.historialComposicion`** (nuevo, opcional): si ya persistes
   `memoriaAprendizaje` para el learning loop B, persiste también el
   historial de composición del mismo modo — antes se perdía entre
   invocaciones serverless.
3. **`OperacionROI`** ganó el valor `"reparacion-detalle"`: si tu UI
   enumera las operaciones del libro ROI con un `switch` exhaustivo,
   añade el caso.

## §7b — Cablear las lecciones de la Arena (evolución, v2.4)

Tras cada duelo, `arenaForja` devuelve `resultado.lecciones`. Para que la
siguiente generación aprenda, el host debe:

```ts
import { registrarLeccionesArena, deserializarConocimiento, serializarConocimiento } from "@/lib/prism/forja/conocimiento-global";

// en tu ruta de chat, justo después de arenaForja(...):
if (arena.lecciones.length > 0) {
  const almacen = deserializarConocimiento(await store.get(CLAVE_CONOCIMIENTO_GLOBAL));
  const evolucionado = registrarLeccionesArena(almacen, arena.lecciones, {
    puntuacionGanador: arena.veredicto[arena.veredicto.ganador === "B" ? "B" : "A"].total, // 0..50
    contexto: "tu-proyecto",
  });
  await store.set(CLAVE_CONOCIMIENTO_GLOBAL, serializarConocimiento(evolucionado));
}
```

- `generacion` del almacén avanza +1 por duelo con lecciones; las reglas
  creadas viajan etiquetadas (`[fallo G3] …`, `[experimento 82/100] …`).
- Las preferencias del dueño entran con `registrarPreferencia(almacen, texto)`
  (desde el panel o una orden aprobada) y viajan SIEMPRE primeras.
- El panel puede mostrar `estadisticasPorCapa(almacen)` para ver el
  reparto: preferencias / fallos / experimentos / fundamentos / patrones /
  tendencias.
- No hay que cablear nada para el ADN: el núcleo lo parsea del Diseñador,
  lo inyecta en maquetador/Codificador/Revisor y lo devuelve en
  `ResultadoForja.adn` y en la respuesta del chat.

## §8 — El Estudio (v3.0): Director Creativo + panel + fusión

El modo para proyectos importantes. Es OPT-IN: se llama a `estudioForja()` en
lugar de `ejecutarForja()` (misma filosofía de inyección), y a partir de ahí
entra en el flujo de siempre:

```ts
import { estudioForja, comoResultadoForja } from "./d1/director";
import { registrarLeccionesArena } from "./d1/conocimiento-global";

// «Estudio» en tu UI (un botón junto al duelo de la Arena):
const estudio = await estudioForja(
  peticion,
  configForja,
  { llamarModelo, memoria, onProgreso },   // mismas deps que siempre
  modeloActivoDelChat,
  {
    criteriosDelUsuario: "que no parezca otro dashboard", // opcional
    juez: { providerId: "x", modelId: "y" },              // opcional
  }
);

// el host persiste las lecciones del panel (evolución, igual que la Arena):
almacen = registrarLeccionesArena(almacen, estudio.lecciones);

// y la UI pinta el resultado con el contrato que ya conoce:
const resultado = comoResultadoForja(estudio);
// resultado.estado === "esperando-aprobacion" → la maqueta FUSIONADA en la
// vista previa; «Aprobado» → continuarForja; «Ajusta: …» → ajustarMaquetaForja.
// Si estudio.fallbackUsado === true, resultado es un pipeline normal.
```

Eventos nuevos para tu UI (`onProgreso`):

```ts
{ tipo: "estudio", fase: "director" | "maquetas" | "jueces" | "fusion"
                  | "fallback" | "fin",
  detalle?: string,      // «visión 2: Editorial oscura», «Juez visual»…
  hecho?: number, total?: number }
```

En `ResultadoEstudio` tienes el duelo completo para pintar comparativas:
`visiones` (3), `maquetas` (3, con su `genericidad`), `informes`
(saturación por visión), `panel.jueces` (notas por criterio y razones) y
`fusion` (base + adoptar + evitar). El usuario manda: puede aprobar la
fusión o continuar con otra visión.

## Coste y rendimiento

- `ligero`: 3 llamadas mínimo, hasta `1 + 2×rondas` si el Revisor rechaza.
- Con maqueta: +2 llamadas (direcciones vienen con la ficha; la maqueta es
  1 llamada del Codificador) y una pausa a la espera de tu decisión.
- El ciclo de aprendizaje: 3 lecturas + hasta 3 destilaciones, solo cuando
  tú lo lanzas (o el cron), con 15 min de descanso mínimo entre ciclos.
  Tus fuentes del Apartado entran primero; las semillas rellenan el cupo.
- La Arena: modo «maquetas» añade ~4 llamadas (2 fichas + 2 maquetas) y 1
  del juez sobre la producción normal del ganador; modo «completa» ~2× todo.
- El Estudio (v3.0): ~9 llamadas (1 director + 3 maquetas + 3 jueces + 1
  director final + 1 maqueta de fusión). Es el modo más caro: úsalo para el
  proyecto que lo merece; la Arena de 2 equipos sigue siendo el modo medio
  y el pipeline normal el económico. Los detectores (Inspector,
  anti-genérico, representaciones) son regex puros: 0 llamadas, 0 coste.
- Con modelos gratuitos el coste es 0; la latencia típica: 30–60 s hasta la
  maqueta, 30–90 s la producción completa; el Estudio 2–4 min (las 3
  maquetas y los 3 jueces corren en paralelo).

## Prueba rápida sin integrar

```ts
import { ejecutarForja } from "./d1/nucleo";
import { MEMORIA_DEFECTO } from "./d1/conocimiento-usuario";
import type { LlamadaModelo } from "./d1/tipos";

const mock: LlamadaModelo = async ({ system, user }) =>
  system.includes("maquetador")
    ? "```html maqueta.html\n<h1>maqueta de prueba</h1>\n```"
    : system.includes("Diseñador")
      ? `<direcciones>\n1. Idea A — concepto — por qué\n2. Idea B — concepto — por qué\n3. Idea C — concepto — por qué\n</direcciones>\n<ficha>\nTipo de web: landing\nPúblico: prueba\nMensaje principal: prueba\n\n## Paleta\n#FFFFFF\n\n## Tipografía\nInter\n\n## Estructura\n1. Hero\n\n## Interacción\nhover\n\n## Restricciones\nninguna\n</ficha>`
      : "```html index.html\n<h1>hola</h1>\n```";

const r = await ejecutarForja(
  { mensaje: "landing de mi app de recetas" },
  { porRol: { disenador: null, codificador: null, revisor: null }, habilidades: [] },
  { llamarModelo: mock, memoria: MEMORIA_DEFECTO },
  { providerId: "gemini", modelId: "gemini-2.5-flash" }
);
// r.estado === "esperando-aprobacion" → hay maqueta e ideas en r.respuesta
```

## §12 — El Motor de Experiencia (v4.5): cablear la dirección creativa

La v4.5 añade el motor del doc «moderno-3D»: INTENCIÓN → EXPERIENCE DNA →
FAMILIA → RECETA → REPRESENTACIÓN → PLANES → HERO → CARDS → RESPONSIVE →
TOKENS, todo determinista. El MVP ya lo ejecuta solo (fase 1b + 6b del
núcleo): NO hace falta cablear nada para que funcione.

API pública nueva (todo exportado por el bundle):

- `seleccionarExperiencia(mensaje, opts?)` → la decisión completa
  (dna, familia, receta, representacion, planEspacial, planMovimiento,
  hero, cards, responsive, penalizacion, tokensCss, resumen). Gratis.
- `seccionContratoExperiencia(seleccion)` → el bloque para prompts del
  maquetador/Codificador (§15). `cssDeterminista(seleccion)` → tokens +
  escenario + movimiento + cards listos para el `<style>`.
- `auditarExperiencia(html, dna)` + `parchesExperiencia(...)` → QA de
  experiencia y parches patch-first (§21/§22), idempotentes y capados.
- `medirExperiencia(html)` / `scoreEditorial(senales)` /
  `desviacionDeDna(metricas, dna)` → métricas y sesgo (§11/§12).
- `registrarComposicion(huella)` / `obtenerHistorial()` /
  `cargarHistorial(list)` → anti-repetición (§13). El historial vive en
  el proceso; si tu host reinza a menudo, persiste el historial con
  `cargarHistorial()` al arrancar (opcional).
- `extraerAdnReferencia(texto)` + `principiosNoPixeles(adn)` → Reference
  DNA (§24/§25); ya integrado en `analizarReferencia()` de referencias.ts.

Si tu host llama a `ejecutarMvpForja`, no cambies NADA: el resultado ahora
incluye `experiencia` (la selección completa) y el registro lleva
`registro.experiencia` (optional). La maqueta (maqueta.ts) lleva el contrato
en el mensaje automáticamente.

Dónde verlo en vivo: Estudio → pestaña «Motor» → tarjetas 11/12/13.
