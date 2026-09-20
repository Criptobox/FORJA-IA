# FASE V16 — MEGA como biblioteca viva de Knowledge Base

## Objetivo

MEGA deja de ser solo un almacenamiento conectado: Forja puede explorar carpetas y seleccionar archivos o carpetas para incorporarlos al índice de Knowledge Base sin copiar el contenido a Drive.

## Flujo

1. Conectar MEGA en Conocimiento.
2. Explorar raíz y carpetas.
3. Seleccionar archivos o carpetas.
4. Indexar.
5. Forja lee cada archivo desde MEGA, calcula SHA-256 y evita duplicados exactos.
6. Los ZIP pueden generar un Project Manifest usando el analizador existente.
7. El índice guarda metadatos, proveedor `mega`, `remoteId` y `relativePath`.
8. El código permanece en MEGA; la recuperación posterior puede leerlo bajo demanda.

## Decisión de arquitectura

No se duplica el código en Google Drive ni en localStorage. localStorage contiene únicamente el índice pequeño. El contenido remoto sigue en MEGA.

## Próxima evolución

Conectar `remoteId`/`sourceProvider` con `kb-project-retrieval` para que Cerebro pueda recuperar fragmentos de código desde MEGA bajo demanda, en lugar de cargar repositorios completos.
