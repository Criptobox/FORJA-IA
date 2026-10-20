# INTEGRACION-MAPA.md — Auditoría de integración FORJA IA ↔ OpenDesign ↔ Stitch

> Entregable de la **Fase 0** del Plan Maestro FORJA IA 4.0 («OpenDesign + Stitch»).
> Este documento es el mapa que gobierna la integración: qué se conserva de
> FORJA, qué se reutiliza de OpenDesign, qué se adopta de Stitch como
> referencia de experiencia y qué NO se hace jamás.

Fecha de auditoría: entrega FORJA IA v4.0.0.
Estado del árbol de OpenDesign: **no clonado aún** (no hay repositorio fijado en
este entorno). El plan exige «clonar una versión fijada y registrar el commit
exacto»: ese paso queda marcado como PENDIENTE-CLON y todos los contratos de
este mapa se han definido de forma que el módulo funcione COMPLETO sin
OpenDesign (runtime local de respaldo en `adapter-opendesign.ts`). Cuando se
fije el fork, solo cambia la implementación del adaptador, no los contratos.

---

## 1. Estado actual de FORJA IA (auditoría v3.1.0)

Piezas de primera clase ya construidas y verificadas (tsc strict, 0 errores):

| Módulo | Qué aporta |
|---|---|
| `nucleo.ts` | pipeline Diseñador → Codificador → Revisor, bucle de corrección, streaming de progreso |
| `maqueta.ts` | maqueta-first: 3 direcciones → maqueta navegable → aprobación (máx 2 ajustes) |
| `adn-visual.ts` | ADN Visual v1: personalidad, sensación (ejes 0..10), lenguaje, prohibiciones |
| `director.ts` | El Estudio: 3 visiones divergentes + panel de 3 jueces (visual/UX/originalidad) + Diseño Fusión |
| `arena.ts` | Arena de dos equipos con veredicto, criterios y lecciones |
| `antigenerico.ts` | Capa 1 del Anti-Generic: 8 síntomas deterministas con motivo y alternativa |
| `representacion.ts` | Representación de la información como paso previo a los componentes |
| `vision.ts` | Inspector estático de 17 chequeos + contrato de visión multimodal |
| `conocimiento-global.ts` | conocimiento en 6 capas (preferencia, fallo, experimento, fundamento, patrón, tendencia) |
| `conocimiento-usuario.ts` | memoria del usuario (reglas aprendidas) |
| `autoaprendizaje.ts` + `fuentes*.ts` | ciclo FUENTES → SEGURIDAD → LIMPIEZA → DESTILACIÓN → REGLAS → DEDUPLICACIÓN |
| `seguridad-web.ts` | validación de URL, anti-inyección, límites, sandbox de aprendizaje |
| `habilidades.ts` | catálogo de skills componibles del Diseñador |

**Decisión del plan, confirmada por la auditoría: NO reescribir FORJA IA.**
La v4.0.0 añade una capa encima (`adn2`, `director2`, `arena2`, `jueces2`,
`antigenerico2`, `revisor-visual`, `bucle-mejora`, `memoria2`, `genoma-visual`,
`voz`, `referencias`, `mejora-pagina`, `canvas`, `perfiles`, `observabilidad`,
`metricas`, `benchmark`, `evaluador-exito`, `adapter-opendesign`) y conserva
toda la API de v3 (los parseadores y tipos de v3 siguen exportándose igual).

---

## 2. Qué aporta OpenDesign (infraestructura de ejecución)

OpenDesign se trata como **cuerpo**, no como cerebro. Según su documentación
(AGENTS.md, docs/architecture.md, docs/skills-protocol.md,
docs/agent-adapters.md, docs/design-systems.md, docs/modes.md — PENDIENTE-CLON:
leer en el commit fijado), aporta:

- runtime de agentes + adaptadores de agentes (CLIs, modelos locales, BYOK);
- daemon con SSE (streaming) y SQLite (estado);
- filesystem de proyectos, sesiones, plantillas;
- skills componibles y design systems;
- plugins, templates, previews sandboxed y exportación;
- flujo brief → dirección → design system → artifact → handoff → memory.

### Tabla de integración (entregable de la Fase 0)

| FORJA IA | OpenDesign | Acción | Módulo v4 responsable |
|---|---|---|---|
| Director Creativo | Orchestrator / agent runtime | integrar | `director2.ts` + `adapter-opendesign.ts` |
| Arena (2 equipos) | Arena / critique | fusionar capacidades | `arena2.ts` (modos económico/profesional/experimental) |
| ADN Visual | DESIGN.md + tokens | adaptar | `adn2.ts` + `exportadores-adn.ts` |
| Anti-Genérico | Critique | plugin propio | `antigenerico2.ts` (3 capas) |
| Maqueta | Prototype mode | reutilizar | `maqueta.ts` (sin cambios) |
| Codificador | Agent adapter | reutilizar | `adapter-opendesign.ts` (rol → agente) |
| Revisor | Critique / review | extender | `revisor-visual.ts` (PASS/WARN/FAIL con evidencia) |
| Autoaprendizaje | Memory | integrar | `memoria2.ts` (5 memorias) |
| Fuentes | knowledge layer | conservar | `fuentes*.ts` (sin cambios) |
| Preview | Preview | reutilizar | runtime del adaptador |
| Exportación | Export | reutilizar | runtime del adaptador |
| Bucle de mejora | — (no existe) | construir en FORJA | `bucle-mejora.ts` (máx 3 iteraciones + rollback) |
| Genoma Visual | — (no existe) | construir en FORJA | `genoma-visual.ts` |
| Voz semántica | — (no existe) | construir en FORJA | `voz.ts` |
| Canvas tipo Stitch | — (no existe) | construir en FORJA | `canvas.ts` |
| Benchmark + métricas | — (no existe) | construir en FORJA | `benchmark.ts` + `metricas.ts` |

### Regla de oro

- **FORJA decide** (experiencia, arquitectura visual, ADN, representaciones,
  direcciones, patrones a evitar, qué iterar, qué defectos importan, qué
  aprendizaje conservar).
- **OpenDesign ejecuta** (skills, agentes, generación, filesystem, design
  systems, templates, preview, exportación, handoff, sesiones).
- **No duplicar**: jamás un segundo daemon, sistema de agentes, plugins,
  preview, exportación ni gestor de sesiones. FORJA llama y extiende.

---

## 3. Qué aporta Stitch (referencia de experiencia, nunca dependencia)

Adoptar como ideas de interacción: canvas visual, generación progresiva,
iteración en tiempo real, dirección por texto y voz, referencias, steering
durante la generación, comparación visual, diseño como conversación viva y el
formato abierto `DESIGN.md` (encaja con design systems de OpenDesign y el ADN
de FORJA).

**NO hacer**: depender de Stitch para generar cada página; copiar su UI ni su
código propietario; convertir FORJA en un clon; que el producto deje de
funcionar si Stitch no está (no hay ni una llamada a Stitch en el módulo).

---

## 4. Contrato del adaptador (Fase 2)

```text
FORJA INPUT (PeticionForja + AdnVisual2 + dirección)
    ↓  peticionARequest()            — adapter-opendesign.ts
OpenDesignRequest  (brief + design-system + skills + prompts)
    ↓  runtime.ejecutar()            — daemon de OpenDesign | RuntimeLocal
OpenDesignArtifact (html, tokens, sistema, artefactos, trazas)
    ↓  artifactAEvaluacion()         — adapter-opendesign.ts
FORJA Evaluation  (inspector + anti-genérico + critique + métricas)
```

Reglas del adaptador, verificadas por pruebas:

1. FORJA no depende de detalles internos del daemon: solo de la interfaz
   `RuntimeOpenDesign` (métodos: `ejecutar`, `skills`, `designSystem`,
   `preview`, `exportar`).
2. `RuntimeLocal` implementa la MISMA interfaz sin red: el MVP corre igual
   hoy, y el día que exista el fork se enchufa el runtime real.
3. Toda ejecución deja `RegistroGeneracion` (observabilidad.ts).
4. El modelo es intercambiable (OpenAI-compatible, Claude, Codex, Gemini,
   Ollama, OpenCode, locales): la llamada llega inyectada (`LlamadaModelo`),
   nunca importada.

---

## 5. Licencias (auditoría)

- Código propio del módulo: FORJA IA (proyecto del usuario), sin
  dependencias nuevas en v4 — todo es TypeScript puro, sin runtime externo.
- OpenDesign: licencia por revisar en el commit fijado (PENDIENTE-CLON). Antes
  de publicar cualquier fork: registrar licencia por carpeta/componente y
  cumplir la de plugins/skills que se reutilicen.
- Stitch: solo inspiración de interacción. Cero código, cero marca, cero
  dependencia en runtime.

---

## 6. Checklist del «primer paso inmediato» (sección 37 del plan)

1. [x] Definir los adapters (contratos listos, runtime local funcionando).
2. [x] Mapear cada módulo de FORJA IA v3.1 (sección 1 de este documento).
3. [x] Crear `INTEGRACION-MAPA.md` (este archivo).
4. [ ] Fijar commit de OpenDesign (PENDIENTE-CLON: requiere el repositorio).
5. [ ] Auditar licencias del árbol clonado (depende del paso anterior).
6. [x] Primer prototipo mínimo: MVP completo en `nucleo-v4.ts` (funciona hoy
       con RuntimeLocal y sin una sola llamada de red).
7. [x] Benchmark con 10 tipos de página (`benchmark.ts`) + métricas
       (`metricas.ts`) + definición de éxito (`evaluador-exito.ts`).
8. [ ] Comparativa OpenDesign solo vs FORJA IA vs FORJA+OpenDesign:
       el corredor de benchmark queda listo; la comparativa de producción se
       ejecuta cuando el fork fije su runtime real.

La v4.0.0 entrega TODO lo ejecutable sin el fork; los 4 ítems abiertos quedan
aislados detrás del adaptador para no bloquear ninguna otra fase.
