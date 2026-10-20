# Fase V18 — Recuperación inteligente por componente/patrón

## Objetivo

Convertir la recuperación de Knowledge Base en una búsqueda estructural: el Cerebro puede detectar que una petición menciona un componente, patrón o tecnología que realmente existe en los Project Manifest y usar esa evidencia para ordenar los archivos remotos.

## Flujo

`brief → índice → Project Manifest → componente/patrón/tecnología → archivo candidato → contenido bajo demanda`

La fase no descarga la biblioteca completa ni inventa componentes que no aparecen en los manifiestos o metadatos disponibles.

## Cambios

- Nuevo `src/lib/forja/kb-smart-retrieval.ts`.
- Inferencia de componentes, patrones y tecnologías existentes.
- Ranking combinado de metadatos KB + Project Manifest + ruta + estructura del archivo.
- Prioridad opcional para código y MEGA.
- Contexto compacto con la razón de recuperación.
- Cerebro Web usa la recuperación inteligente antes de solicitar contenido remoto.
- Se mantienen los límites de V17 para el contenido descargado.
- Tests unitarios para componente, patrón y contexto.

## Ejemplos

- `ProductCard` → prioriza `src/components/ProductCard.tsx`.
- `FilterDrawer` → prioriza el archivo del drawer si existe en el manifiesto.
- `utility css` → prioriza proyectos/archivos que declaran ese patrón.
- `React` → prioriza recursos y archivos cuyo manifiesto declara React.

## Regla de seguridad

El ranking no equivale a haber leído un archivo. Solo los archivos que pasan a `retrieveKBContent` se descargan y se incorporan al contexto del modelo.

## Bug corregido en la revisión

`codeFirst` (que `buildCerebroPlanWithKnowledge` activa por defecto en todo
encargo web) sumaba su bonus sin exigir ninguna coincidencia previa: un
recurso de código servido desde MEGA pasaba el filtro `score > 0` aunque
no coincidiera en nada con el brief. En cuanto hubiera algo indexado en
MEGA, cada encargo habría arrastrado código irrelevante al prompt del
Cerebro — justo lo que "no inventa componentes que no aparecen en los
manifiestos" promete evitar. `codeFirst` ahora solo desempata entre
candidatos que ya tenían una coincidencia real (texto, componente, patrón,
tecnología o manifiesto).
