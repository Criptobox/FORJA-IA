# FASE V24 — Skill / Agent / Tool Orchestrator

V24 une las capacidades construidas desde V19 a V23 en un contrato declarativo para el Cerebro Web.

## Qué decide

- Skills relevantes, sin activarlas silenciosamente.
- Subagentes y sus dependencias.
- Recetas reutilizables que no estén rechazadas ni degradadas por feedback.
- Fuentes de contexto disponibles.
- Herramientas preferidas y efectos permitidos.
- Presupuesto de contexto, llamadas e iteraciones.
- Gates de QA, permisos y evidencia.

## Qué NO hace

El orquestador no ejecuta herramientas, no descarga contenido remoto por su cuenta y no instala Skills. Entrega un plan al runtime existente para que la ejecución siga las políticas actuales.

## Flujo

`brief → señales → skills + recetas + agentes → presupuesto → ejecución → evidencia → QA → repair → QA`

## Integración

`cerebro-web.ts` incorpora el contexto V24 (`[FORJA ORCHESTRATOR V24]`) antes de la dirección visual. Reemplaza la llamada suelta a `recommendSkills`/`skillsPlanContext` que ya traía `buildCerebroPlan` desde V23: el orquestador calcula las skills internamente y las incluye en su propio bloque, así que mantener la llamada aparte solo repetía el cálculo y metía la misma lista de skills dos veces en el prompt. Se mantiene compatibilidad con `Agent Runtime` (su propio bloque `[FORJA AGENT RUNTIME]`, con la descripción narrativa de cada paso, sigue aparte), `Recipe Quality Gate` y el retrieval de Knowledge Base.

## Bugs corregidos en la revisión

**El plan por defecto nunca llegaba al QA final tras Repair.** `DEFAULT_BUDGET.maxIterations` es una constante fija en 2 (no hay forma de configurarla desde `OrchestratorInput`), así que `buildAgentSequence` siempre activa el ciclo de reparación y produce una secuencia de **7** pasos: `planner, designer, coder, browser, qa, repair, qa`. Pero `cap()` recortaba la secuencia a un fallback fijo de **6** cuando no se pasaba `maxAgents` — los seis *roles* distintos, sin contar que "qa" aparece dos veces. El resultado: el plan que de verdad usa `cerebro-web.ts` (que no pasa `maxAgents`) terminaba siempre en `"repair"`, cortando justo el QA que verifica que la reparación funcionó — lo contrario del propio gate del orquestador: *"Si QA falla, devolver el trabajo a Repair y después repetir QA dentro del presupuesto"*. Confirmado empíricamente antes del fix: la llamada por defecto de `cerebro-web.ts` (`maxAgents: 6` explícito en el ZIP original) producía `["planner","designer","coder","browser","qa","repair"]`, sin el "qa" final. El fallback ahora es `fullSequence.length` (no trunca nada salvo que el llamador pida explícitamente un `maxAgents` menor), y `cerebro-web.ts` ya no pasa `maxAgents` en absoluto.

**`maxRecipes` estrechaba el pool de búsqueda antes de filtrar, no solo la salida.** `searchForjaRecipes(brief, input.maxRecipes ?? 6)` usaba el mismo número tanto para el límite de la búsqueda inicial como para el corte final. Con `maxRecipes: 3` (el valor que pasaba `cerebro-web.ts`), solo se buscaban 3 candidatos *antes* de filtrar por `recipeCanBeReused`/`shouldDemoteRecipe` — si esos 3 no pasaban el filtro, el resultado quedaba vacío aunque existiera una cuarta receta perfectamente reutilizable en la Knowledge Base, simplemente por no haber entrado en el pool inicial. El pool de búsqueda ahora es `Math.max(6, maxRecipes ?? 6)`, siempre igual o mayor que la salida final, que sigue acotada por `maxRecipes ?? 3`.

Ambos bugs solo se manifestaban con la wiring real de `cerebro-web.ts` (que pasaba `maxAgents: 6` y `maxRecipes: 3` explícitos) — quedaron cubiertos con tests de regresión en `tests/unit/skill-agent-tool-orchestrator.test.ts`.
