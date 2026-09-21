# Forja IA — Fase V27: Technology Radar

## Objetivo

Añadir al Cerebro un catálogo interno de tecnologías candidatas para que pueda investigar y comparar opciones de agentes, RAG, embeddings, reranking, evaluación, observabilidad, routing, compresión de contexto, structured output, seguridad, inferencia local y preparación de datos.

## Regla

El radar **no instala dependencias, no activa herramientas y no sustituye las implementaciones propias de Forja**. Sus resultados son candidatos de arquitectura con licencia, madurez, compatibilidad local y cautelas.

## Flujo

Brief → Skills → Agents → Recipes → Technology Radar → Plan del Cerebro.

El catálogo está pensado para crecer. Las entradas provenientes de catálogos externos deben verificarse antes de incorporar código, versiones o dependencias al producto.

## Integración V24

`buildForjaOrchestration()` añade `technologyRadar` al plan (con `radarAreas`, `radarLocalOnly` y `maxRadarTools` como entradas opcionales) y `orchestrationContext()` incluye una línea compacta con los candidatos para el Cerebro.

## Qué NO se adoptó del ZIP original

Igual que en V26, el ZIP de esta fase traía `skill-agent-tool-orchestrator.ts` construido sobre una copia anterior a dos fixes ya confirmados y con test propio en este repo:

- El pool de búsqueda de recetas volvía a estrecharse por `maxRecipes` antes de filtrar (`tests/unit/skill-agent-tool-orchestrator.test.ts`, "no descarta una receta reutilizable por estrechar el pool...").
- El fallback de la secuencia de agentes volvía a ser una constante fija (`6`) en vez de la longitud real de la secuencia, lo que trunca el QA final tras Repair (mismo archivo, "no trunca por defecto el QA final...").

Se integró solo el radar (import, campos nuevos, wiring), sin revertir esos dos fixes.

## Corrección durante la integración

El catálogo original (`technology-radar.ts`) declaraba `"observability"` como área válida y el anuncio de la fase la incluye ("📊 Observabilidad"), pero no traía ningún candidato para ella — cualquier búsqueda de esa categoría habría devuelto siempre vacío. Se agregó una entrada (Langfuse, trazas/métricas/logs para LLMs) para que las 12 categorías anunciadas tengan al menos un candidato real; un test en `tests/unit/technology-radar.test.ts` lo verifica para que no vuelva a faltar en silencio.
