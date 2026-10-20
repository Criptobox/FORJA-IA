# FASE V29.2.3 — Revisión de falsos positivos

## Problema
El informe de Sandbox podía mostrar errores de sintaxis y enlaces rotos que no correspondían al código real cuando se ejecutaba una versión antigua del revisor.

## Corrección
- `sandbox-review.ts` identifica explícitamente los `@import` CSS desnudos como paquetes cuando no llevan `./`, `../` o `/`.
- El chequeo de delimitadores trabaja sobre JavaScript enmascarado y no interpreta texto/comillas angulares como sintaxis.
- Se añade `SANDBOX_REVIEW_ENGINE_VERSION = v29.2.3` para identificar inequívocamente el motor corregido.
- Se añaden regresiones para Tailwind, `tw-animate-css` y el texto `«»`.

## Validación
El ZIP se comprueba con `node --check` para los `.js/.mjs/.cjs` y con `unzip -t` antes de entregarlo.


## V29.2.3 — caché PWA
- Se incrementa el identificador del Service Worker para invalidar versiones antiguas que podían seguir ejecutando el revisor anterior desde la PWA instalada.
- La vista de revisión muestra la versión del motor para poder comprobar qué revisor está activo.
