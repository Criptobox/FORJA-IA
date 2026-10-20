# Fase V20 — Component Bundles

Forja puede recuperar varios componentes relacionados como un conjunto coherente.

## Objetivo

Evitar que una tarea como `Navbar + ProductCard + FilterDrawer + CartDrawer` mezcle piezas de proyectos incompatibles cuando existe un proyecto de la Knowledge Base que contiene varias de ellas.

## Flujo

1. El texto del brief se compara contra los componentes reales de los Project Manifest.
2. Se infieren varias piezas cuando aparecen en la consulta (`KBSmartQuery.components`, más las detectadas por texto).
3. Se puntúan proyectos que contienen varias piezas del conjunto (`bundle:N/M` en las razones).
4. Se intenta cubrir cada componente pedido con al menos un resultado (`retrieveSmartKBBundle`).
5. Se completan los resultados con las coincidencias globales restantes de `retrieveSmartKB`.
6. El contenido remoto se recupera después del ranking (hasta 6 archivos por defecto) y queda limitado por caracteres/archivos.

## Límites

- Hasta 20 resultados del bundle.
- Hasta 6 archivos de contenido por defecto (antes 4).
- El contenido remoto sigue sujeto a los límites de V17/V18.
- No se mezclan archivos completos de un repositorio si no son relevantes: sigue vigente el resguardo de V18 (`codeFirst` solo desempata entre candidatos que ya tenían una coincidencia real).

## Regla

El bundle es una fuente de referencia, no una instrucción para copiar diseños literalmente. El Cerebro debe adaptar las piezas al brief, identidad y arquitectura del proyecto.

## Bug corregido en la revisión

La fase de cobertura de `retrieveSmartKBBundle` (intentar cubrir cada componente pedido con al menos un resultado) comparaba únicamente contra `matchedComponent`. Ese campo no identifica el componente propio de cada recurso: viene del único archivo "mejor" del manifiesto para el `component` singular que `inferQuery` infiere de todo el texto (ver `fileMatches`), así que **todos** los recursos de un mismo proyecto terminan con el mismo `matchedComponent`, aunque cada uno sea en realidad una pieza distinta.

Con eso solo, pedir `Navbar + ProductCard + FilterDrawer` —el ejemplo exacto que motiva esta fase— nunca encontraba el recurso `Navbar.tsx` en la fase de cobertura, porque su `matchedComponent` resolvía a otro nombre (p. ej. "FilterDrawer", el que ganó el desempate de `inferQuery`). Si el `limit` era menor que el número de piezas pedidas, `Navbar.tsx` podía quedar fuera del resultado final aunque existiera en la Knowledge Base y el usuario lo hubiera pedido explícitamente — justo el escenario que el objetivo de la fase promete resolver.

La cobertura ahora también compara contra el nombre y la ruta propios de cada recurso, no solo contra `matchedComponent`. Test de regresión: `tests/unit/kb-smart-retrieval.test.ts` → "la cobertura no descarta una pieza pedida por comparar solo `matchedComponent`".
