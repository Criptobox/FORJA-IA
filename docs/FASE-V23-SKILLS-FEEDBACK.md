# Fase V23 — Skill Recommender + Recipe Feedback

## Skill Recommender

Forja analiza el brief y las señales disponibles del proyecto para proponer skills relevantes. La recomendación no instala ni activa una skill por sí sola. Esto sigue el principio de control explícito del usuario, mientras permite que el Cerebro conozca qué especializaciones conviene tener disponibles.

La arquitectura toma como referencia el patrón público de Anthropic de analizar un codebase y recomendar skills, subagents, hooks y plugins según señales del proyecto.

- Nuevo `src/lib/forja/skill-recommender.ts`: `recommendSkills()` puntúa cada skill deshabilitada por coincidencia de palabras clave entre el brief y el nombre/descripción/instrucciones/`kinds` de la skill, más bonos por `taskKind` y `framework`. `skillsPlanContext()` renderiza el bloque `[FORJA SKILL PLAN]` para el prompt.
- `cerebro-web.ts` (`buildCerebroPlan`) llama a `recommendSkills` con `taskKind: "web"` (esta función es exclusiva de Cerebro Web) y añade el bloque al prompt central, antes de la dirección visual.
- `CerebroInput` gana un campo opcional `skills?: SkillItem[]` para que el llamador pase el catálogo real de skills.

## Recipe Feedback

Cada uso de una receta puede registrar `passed`, `failed` o `neutral`. El resultado alimenta una señal empírica separada de la calidad documental. Después de tres o más usos, si los fallos superan los éxitos, la receta se degrada en la búsqueda para evitar que continúe siendo una referencia preferida.

No se borra ninguna receta automáticamente. La degradación es reversible y conserva la evidencia.

- Nuevo `src/lib/forja/recipe-feedback.ts`: `recordRecipeOutcome()` acumula `uses/passed/failed` en `ForjaRecipe.feedback` y marca `qaEvidence` cuando el resultado trae evidencia real; `recipeConfidence()` combina la calidad documental (60%) con la tasa de éxito empírica (40%); `shouldDemoteRecipe()` señala cuándo una receta acumula más fallos que éxitos con al menos 3 usos.
- `recipe-builder.ts`: `ForjaRecipe` gana el campo `feedback`; `buildForjaRecipe()` lo inicializa en `{uses:0,passed:0,failed:0}`; `searchForjaRecipes()` resta una penalización de 50 puntos a las recetas que cumplen la condición de degradación (misma condición que `shouldDemoteRecipe`, duplicada en línea para evitar un ciclo de imports entre `recipe-builder.ts` y `recipe-feedback.ts`, que a su vez importa de `recipe-builder.ts`).

## Estado de la integración

Ambas piezas quedan como mecanismos completos y probados, pero sin disparador automático todavía:

- Nada llama a `recordRecipeOutcome` después de una ejecución real de QA — hace falta conectarlo al flujo de Visual QA/regresión para que el feedback se registre solo.
- `forja-studio-dialog.tsx` (el único llamador real de `buildCerebroPlanWithKnowledge`) todavía no pasa `skills`; sin el catálogo real, `[FORJA SKILL PLAN]` seguirá mostrando "No se detectaron skills adicionales" en producción hasta que se conecte al catálogo de `catalogo-skills.ts`.

## Siguiente evolución (según la idea original)

Ampliar el recomendador más allá de skills: decidir también qué subagente (V19), qué herramientas, qué conocimiento de MEGA/Drive y qué QA necesita cada proyecto — una evolución natural del Cerebro hacia una sola capa de decisión que combine Agent Runtime, Smart Retrieval, Recipe Builder/Feedback y Skill Recommender.
