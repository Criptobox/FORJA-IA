# Forja IA — Fase V12: Knowledge Base profunda y revisión visual

## Implementado

- Manifiesto compacto del corpus (`kb-corpus.ts`) para que el Cerebro conozca composición/tamaño sin cargar archivos.
- Filtros adicionales de recuperación por `sourceKind` y exclusión de pendientes.
- Cola de revisión visual explícita.
- Similitud visual conservada como score en cada recurso.
- Relaciones entre recursos (`relatedResourceIds`).
- Acciones seguras: conservar ambos, relacionar o retirar del índice.
- Retirar del índice **no elimina el archivo remoto**.

## Regla

La Knowledge Base sigue siendo metadata-first: el Cerebro consulta el índice y solo recupera contenido de candidatos relevantes.

## Siguiente fase

- UI completa de comparación visual lado a lado.
- Extracción/indexación profunda de ZIP/repositorios.
- Conector MEGA con sesión real.

## UI

El panel Conocimiento ahora muestra la cola de revisión visual con acciones explícitas:

- Conservar ambos.
- Relacionarlos como recursos complementarios.
- Quitar el duplicado del índice (sin borrar el archivo remoto).
