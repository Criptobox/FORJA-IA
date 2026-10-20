# Fase V21 — Recipe Builder

## Objetivo

Convertir conjuntos de componentes recuperados por la Knowledge Base en recetas reutilizables para que el Cerebro pueda repetir soluciones coherentes sin volver a descubrirlas desde cero.

## Principios

- La receta guarda metadatos, decisiones, patrones y referencias; no copia automáticamente código remoto.
- Las fuentes siguen viviendo en MEGA/Drive/local según su proveedor.
- Una receta debe adaptarse al brief actual.
- El Cerebro debe revisar licencia, dependencias, compatibilidad y QA antes de usar una receta.

## Flujo

1. Smart Retrieval (V18/V20) encuentra un bundle de componentes.
2. Recipe Builder crea una receta con componentes, patrones, tecnología, fuentes y reglas (`buildForjaRecipe`).
3. La receta se guarda localmente en `forja-recipes` (`saveForjaRecipe`).
4. En tareas futuras, `buildCerebroPlanWithKnowledge` busca recetas relacionadas con el brief (`searchForjaRecipes`).
5. Si encuentra alguna, añade su contexto al prompt (`recipeContext`), con la regla explícita de que es una guía, no una copia.
6. El agente adapta la receta y verifica el resultado.

## API

- `buildForjaRecipe()`
- `saveForjaRecipe()`
- `listForjaRecipes()`
- `getForjaRecipe()`
- `deleteForjaRecipe()`
- `searchForjaRecipes()`
- `markForjaRecipeUsed()`
- `recipeContext()`

## Estado de la integración

Esta fase entrega el contrato completo de recetas (crear, guardar, buscar, marcar uso) y lo conecta a `cerebro-web.ts`: cada `buildCerebroPlanWithKnowledge` busca hasta 2 recetas relacionadas con el brief y las añade al prompt. La creación automática de una receta a partir de un bundle encontrado (`buildForjaRecipe` + `saveForjaRecipe`) queda como API disponible para cuando el flujo de QA/publicación decida qué bundles vale la pena convertir en receta — todavía no hay un disparador automático que la invoque tras una tarea exitosa.

## Corregido en la revisión

El test original de `buildForjaRecipe` afirmaba `expect(JSON.stringify(recipe)).not.toContain("código remoto")` para comprobar que la receta no copia código remoto. Pero las propias reglas que la función genera incluyen literalmente la frase de negocio "No copiar código remoto sin revisar dependencias, licencia y compatibilidad" — el test fallaba siempre contra el propio código correcto, no detectaba ningún defecto real. Se cambió por una comprobación estructural: la receta no debe tener ningún campo `content`/`code`, que es la garantía real que ofrece `buildForjaRecipe` (solo guarda nombre, ruta, proyecto, patrón y tecnología).

## Siguiente evolución

- persistir recetas también en MEGA dentro de `forja-recipes`;
- aprobación/quality gate antes de marcar una receta como reutilizable;
- versionado y hash de recetas;
- importar/exportar recetas;
- feedback de QA para mejorar su calidad;
- disparar `buildForjaRecipe`/`saveForjaRecipe` automáticamente cuando un bundle pase QA.
