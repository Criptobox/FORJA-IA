# Fase V19 — Forja Agent Runtime / Subagentes

## Objetivo

Separar la ejecución especializada de Forja en contratos de subagentes coordinados por Cerebro, sin acoplarla a un proveedor de modelo.

## Flujo

`Planner → Designer → Coder → Browser → QA → (Repair → QA si hace falta)`

## Reglas

- Cada agente tiene objetivo, efectos permitidos y herramientas preferidas.
- El runtime no ejecuta herramientas: entrega el contrato al runtime existente de herramientas (`tool-runner.ts` / `tools-catalog.ts` siguen siendo la autoridad para ejecución y permisos).
- Los handoffs transportan solo resumen, evidencia y artefactos relevantes.
- QA no puede declarar éxito sin evidencia.
- Repair modifica directamente los archivos responsables; no crea capas de fix.
- La secuencia puede repetirse cuando una verificación encuentra fallos.

## Cambios

- Nuevo `src/lib/forja/agent-runtime.ts`: definición de los seis subagentes (`FORJA_SUBAGENTS`), construcción de la secuencia (`buildAgentSequence`), contrato de prompt (`buildAgentRuntimePrompt`) y máquina de estados de una ejecución (`createAgentRun` / `advanceAgentRun`).
- `cerebro-web.ts` incorpora `buildAgentRuntimePrompt` al prompt central de `buildCerebroPlan`, con `maxIterations: 2` (una vuelta de reparación por defecto).
- Tests unitarios para la secuencia, el contrato de prompt y la máquina de estados.

## Regla de seguridad

El Agent Runtime es un contrato declarativo, no un ejecutor: solo el `tool-runner` existente aplica permisos y ejecuta herramientas de verdad.

## Bugs corregidos en la revisión

`advanceAgentRun` calculaba la posición del agente en la secuencia con
`sequence.indexOf(agent)`. Con `maxIterations > 1` la secuencia repite
`"qa"` dos veces (`... qa, repair, qa`), y `indexOf` siempre resuelve la
**primera** aparición. Al cerrar el ciclo de reparación, el QA final
calculaba su "siguiente" a partir de ese primer índice —es decir,
`"repair"` otra vez— y el run quedaba atascado alternando entre `repair`
y `qa` sin poder llegar nunca a `"completed"`. La posición ahora se toma
de `run.iteration`, que avanza un paso por cada llamada y no se confunde
con agentes repetidos.

`advanceAgentRun` también mutaba el objeto `run` recibido
(`run.completed = [...run.completed, agent]`) antes de devolver una copia
nueva. Cualquier código que conservara una referencia al run anterior (por
ejemplo, para mostrar el estado previo o para deshacer) habría visto ese
estado cambiar por debajo sin haber llamado a nada. Ahora `completed` se
calcula en una variable local y el run de entrada no se toca.
