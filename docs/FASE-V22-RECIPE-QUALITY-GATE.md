# Fase V22 — Recipe Quality Gate

Antes de reutilizar una receta, Forja evalúa evidencia, coherencia, licencia, procedencia y evidencia explícita de QA.

## Estados

- `approved`: suficiente evidencia **y** evidencia explícita de QA para reutilización automática.
- `review`: útil, pero requiere validación adicional (por ejemplo, no hay QA explícito, aunque el resto de evidencia sea buena).
- `rejected`: falta evidencia esencial o licencia utilizable; no entra al retrieval normal del Cerebro.

El gate **no inventa QA**. La ausencia de pruebas no se interpreta como fallo, sino como falta de evidencia.

## Cambios

- Nuevo `src/lib/forja/recipe-quality-gate.ts`: `evaluateRecipeQuality()` puntúa evidencia (25), coherencia (25), licencia (20), procedencia (15) y evidencia de QA (15); `applyRecipeQuality()` persiste el resultado en la receta; `recipeCanBeReused()` filtra por estado.
- `recipe-builder.ts` gana los campos `qualityStatus`, `qualityReasons`, `qualityCheckedAt`, `qaEvidence` en `ForjaRecipe`, y `searchForjaRecipes()` ya excluye recetas `rejected`.
- `cerebro-web.ts`: `buildCerebroPlanWithKnowledge` busca hasta 4 recetas candidatas, las filtra con `recipeCanBeReused` (excluye también las nunca evaluadas) y usa las 2 mejores.

## Corregido en la revisión

El umbral de aprobación decidía el estado solo por puntuación (`score >= 80 ? "approved" : "review"`). Evidencia + coherencia + licencia + procedencia ya suman 85 puntos **sin ningún dato de QA** (evidencia 25 + coherencia 25 + licencia 20 + procedencia 15 = 85 ≥ 80), así que una receta jamás verificada pasaba directo a `approved` — el estado de máxima confianza, sin revisión — exactamente lo que la fase promete evitar ("si es útil pero todavía no hay QA comprobado → revisión"). Confirmado empíricamente: el propio test que trae la fase (`report.status` debía ser `"review"` con `qaEvidence: false` y `score: 85`) fallaba contra su propio código fuente, devolviendo `"approved"`.

`approved` ahora exige explícitamente `score >= 80 && qaEvidence`; sin evidencia de QA, el techo es `review` (o `rejected` si falta evidencia/licencia).

También se corrigió `evaluateRecipeQuality`, que leía `r.resource.originUrl` para "procedencia" — ese campo no existe en `KBResource` (típo/desajuste con una versión distinta del tipo); el campo real es `sourceUrl`. Sin el fix, el chequeo de procedencia vía URL de origen nunca se activaba (siempre `undefined`) y el código no compilaba contra el resto del repo.

## Siguiente evolución

- disparar `applyRecipeQuality` automáticamente al guardar una receta;
- feedback de QA real (visual/regresión) para mover una receta de `review` a `approved`;
- panel de revisión manual para recetas en `review`/`rejected`.
