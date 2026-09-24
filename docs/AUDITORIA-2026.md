# FORJA IA — Auditoría inicial del Plan Maestro 2026 (Sprint 1)

Esta auditoría corresponde a la «primera misión» del [Plan Maestro 2026](PLAN-MAESTRO-2026.md) (§83). Se hizo antes de implementar nada del plan y responde a tres preguntas:

1. ¿Qué existe ya de cada prioridad?
2. ¿Qué piezas están duplicadas?
3. ¿Dónde se gastan los tokens?

Regla del plan que se respeta aquí: **no se borra nada** hasta demostrar que una alternativa mejor lo cubre. Las columnas MERGE y REWRITE son propuestas, no cambios hechos.

Estado del código auditado:

- 402 archivos en `src/`.
- 202 archivos de tests unitarios y 2.482 tests, todos en verde.
- knip no encuentra archivos sin usar.

---

## 1. Las 10 prioridades del plan frente a lo que ya existe

| # | Prioridad (§81) | Módulos que ya la cubren | Estado | Hueco principal |
|---|---|---|---|---|
| 1 | Project Brain | `project-map.ts`, `passport.ts`, `memoria-proyecto.ts`, `auto-contexto.ts`, `decisiones.ts`, `project-tasks.ts` | IMPROVE | El mapa se deduce de los mensajes y no del repositorio real. No hay grafo de imports entre archivos ni ranking de importancia. |
| 2 | Design Contract / DESIGN.md | `design-directions.ts`, `design-architect.ts`, `motor/adn2.ts`, `motor/exportadores-adn.ts`, `motor/contrato-experiencia.ts`, `reglas-no.ts` | MERGE | Hay tres «identidades visuales» (dirección, ADN 2.0 y contrato de experiencia) y ningún `DESIGN.md` persistente por proyecto que sea la fuente única. |
| 3 | Router económico | `task-router.ts`, `motor/enrutador-determinista.ts`, `health.ts`, `motor/salud-proveedores.ts`, `experiencia.ts`, `limites-medidos.ts`, `free-radar.ts` | IMPROVE | No hay una interfaz `ModelProvider` única (§59). Las capacidades se infieren por nombre y no por la tabla del §60. |
| 4 | Context Engine | `prompt-actual.ts`, `presupuesto.ts`, `turno-trivial.ts`, `compress.ts`, `recorte-contexto.ts`, `resumen-recorte.ts`, `versiones-superadas.ts` (nuevo), `motor/compilador-contexto.ts` | IMPROVE | Faltan los niveles L0–L5 explícitos (§7). Hoy solo hay dos niveles: «trivial» y «todo lo demás». |
| 5 | Design First | `motor/maqueta.ts`, `motor/plano-contenido.ts`, `motor/motor-creativo.ts`, `motor-chat.ts`, `motor/canvas.ts` | IMPROVE | La propuesta visual no pasa por aprobar, pedir cambios o bloquear decisiones antes del build (§4 fase B). |
| 6 | Builder Agent | `agent-loop.ts`, `use-agent-tools.ts`, `tool-runner.ts`, `patch.ts`, `multi-archivo.ts`, `modo-app.ts` | KEEP | Ya edita por parches (SEARCH/REPLACE) y rechaza archivos «fix.ts». Falta un planificador de código previo al parche. |
| 7 | Sandbox | `sandbox.ts`, `sandbox-runner.ts`, `sandbox-modules.ts`, `sandbox-pilot.ts`, `snapshots.ts` | KEEP | El rollback automático tras un fallo de build/QA (§22) no está cableado de extremo a extremo. |
| 8 | Vision + Code QA | `visual-qa.ts`, `screenshot.ts`, `inspector-checks.ts`, `web-audit.ts`, `web-verifier.ts`, `security-center.ts`, `motor/vision.ts`, `motor/revisor-visual.ts`, `vision-designer.ts` | MERGE | Cuatro rutas de «ver la página» con criterios distintos. Hay que decidir una sola Vision QA con severidades. |
| 9 | Autonomous Fix Loop | `auto-revision.ts`, `repair-agent.ts`, `motor/bucle-mejora.ts`, `decisiones.ts`, `motor/motivo-parada.ts` | IMPROVE | La escalera de recuperación del §65 (mismo modelo → menos contexto → otro modelo → rollback → usuario) no existe como política única. |
| 10 | Regression + Publish | `regression.ts`, `firma-visual.ts`, `deploy.ts`, `static-deploy.ts`, `netlify.ts`, `github-upload.ts`, `repo-push.ts` | KEEP | Faltan los gates de pre-publicación en cadena (§41). |

## 2. Duplicados detectados (candidatos a MERGE)

Son pares o grupos que resuelven lo mismo con criterios distintos. Todos están importados y en uso, así que ninguno se puede borrar sin migrar antes a quien lo usa.

| Tema | Piezas | Propuesta |
|---|---|---|
| Director | `motor/director.ts`, `motor/director2.ts`, `orquesta.ts`, `motor/equipo.ts`, `agent-runtime.ts`, `skill-agent-tool-orchestrator.ts` | Un solo FORJA DIRECTOR (§14). `orquesta.ts` es el que usa el chat y sería la base. |
| Anti-genérico | `motor/antigenerico.ts` (12 importadores), `motor/antigenerico2.ts`, `motor/anti-repetition.ts`, `generico.ts` | Unificar el medidor (§18). |
| Identidad visual | `motor/adn-visual.ts`, `motor/adn2.ts`, `design-directions.ts`, `motor/genoma-visual.ts` | Unificar en DESIGN.md (prioridad 2). |
| Arena / jueces | `motor/arena.ts`, `motor/arena2.ts`, `motor/arena-familias.ts`, `motor/jueces2.ts`, `consensus.ts` | Un solo «Designer A/B + Judge» (§26). Se usa solo cuando compensa el coste. |
| Núcleo | `motor/nucleo.ts`, `motor/nucleo-v4.ts` | Migrar a v4 y retirar el antiguo. |
| Salud de proveedores | `health.ts`, `motor/salud-proveedores.ts` | Un solo circuit breaker. |
| Motivo de parada | `finish-reason.ts`, `motor/motivo-parada.ts` (con la misma cabecera) | Fusionar. |
| Presupuesto y coste | `gasto.ts`, `gasto-modelos.ts`, `precios.ts`, `motor/perfiles.ts`, `motor/presupuesto-tokens.ts`, `motor/token-roi.ts` | Budget Engine único (§35) con límites mensual, diario y por tarea (§58). |
| Caché | `cache-prompt.ts`, `motor/cache-multinivel.ts`, `motor/cache-fichas.ts` | Documentar qué capa cachea qué antes de fusionar. |
| Métricas | `usage.ts`, `motor/metricas.ts`, `motor/observabilidad.ts` | Un Task Ledger (§13) del que salgan las tres vistas. |

## 3. Versionado (§73)

- `package.json` está en **4.68.1** y es la versión de la app.
- `motor/version.ts` lleva su propio historial **v4.7.x** y es la versión del motor creativo.

Hoy son dos números con significado distinto, pero la interfaz y el README pueden confundirlos. Propuesta: presentar el del motor siempre como «motor 4.7». La fuente única de la versión de la app sigue siendo `package.json` (`npm run bump`).

## 4. Consumo de tokens: dónde se iba y qué se ha cambiado ya

Medición sobre una conversación típica de Web Studio: 5 vueltas sobre una página de unos 20.000 caracteres.

| Pieza | Antes | Ahora |
|---|---|---|
| Historial con 5 versiones de `index.html` | ~100.000 caracteres por turno | ~20.600 caracteres (**−80 %**) |
| Skills activas en un «hola» o un «gracias» | ~3.600 caracteres | 0 |

### Cambios aplicados en este sprint

1. **`versiones-superadas.ts`** (nuevo). Cada vez que un archivo tiene una versión más reciente en un mensaje posterior, las copias viejas se sustituyen por una línea que dice qué había.
   - La última versión viaja siempre intacta.
   - Reglas de seguridad:
     - Un fragmento de menos de la mitad del tamaño no cuenta como versión nueva.
     - Los bloques de menos de 600 caracteres no se tocan.
     - La pregunta viva nunca se modifica.
   - Es determinista, así que el prefijo solo cambia cuando llega una versión nueva y la caché del proveedor sigue funcionando entre medias.
   - Funciona siempre, con o sin compresión, porque la compresión protege el código a propósito y no podía quitar estas copias.
2. **`answer-files.ts`** expone `bloquesConNombre()`, con la posición de cada bloque. Es la misma lectura de nombres que ya usaban la vista previa y el ZIP, así que no hay un segundo parser que se desincronice.
3. **`prompt-actual.ts`**: en un turno trivial ya no viajan las skills. Es el mismo criterio que ya se aplicaba a la plantilla del agente y al mapa. Las reglas «no tocar» siguen viajando siempre.
4. **La etiqueta `ctx −N %` de cada respuesta** suma ahora la compresión y las versiones omitidas.

### Siguientes palancas de tokens (por orden de impacto estimado)

1. **Niveles de contexto L0–L5 (§7).** El mapa, la memoria y la dirección de diseño viajan ahora en cualquier turno que no sea trivial. Una pregunta como «¿qué hace esta función?» (L1) no necesita la dirección de diseño.
2. **Enviar solo el token de diseño necesario (§12).** Para «cambia el color del botón» basta con la paleta; la dirección entera sobra.
3. **Ventana de historial adaptativa.** Hoy son 40 mensajes fijos (12 en modo ahorro). Se podría calcular a partir de la ventana real del modelo elegido (`limites-medidos.ts`).
4. **Task Ledger (§13).** Registrar tokens y coste por tipo de tarea para saber qué recortar con datos y no por intuición.

## 5. Sprint 2 — hecho

### Context Engine L0–L5 (`nivel-contexto.ts`)

Cada turno se clasifica en un nivel. Ante la duda, el turno sube a L3, que es lo que viajaba antes del cambio.

| Nivel | Ejemplo | Diseño que viaja | Design Architect (FORJA WEB) | Memoria |
|---|---|---|---|---|
| L0 trivial | «hola» | nada | no | no |
| L1 pregunta | «¿qué hace renderMenu?» | nada | no | Auto Context |
| L2 retoque | «cambia el botón a verde» | contrato compacto (~650 caracteres) | no | Auto Context |
| L3 feature | «hazme una landing», «añade reservas» | bloque completo (~4.000 caracteres) | sí (~2.200) | Auto Context |
| L4 proyecto | «refactoriza la arquitectura» | completo | sí | Auto Context + memoria completa |
| L5 auditoría | «audita el proyecto» | completo | sí | Auto Context + memoria completa |

Ahorro con FORJA WEB:

- En una pregunta dejan de viajar unos 2.200 caracteres por turno.
- En un retoque se mandan unos 650 en lugar de 2.200.

El nivel aparece en el desglose de «contexto usado» de cada respuesta.

### Contrato de diseño (`contrato-diseno.ts`)

- **Error corregido:**
  - Qué fallaba: la memoria guardaba el *nombre* de la dirección y la rotación comparaba con el *id*. Nunca coincidían, así que la rotación nunca evitaba repetir y el proyecto no tenía una dirección fijada.
  - Cómo queda: ahora se leen las dos formas.
- **Identidad fijada:** una vez elegida, la dirección del proyecto se mantiene en los encargos nuevos. Solo cambia si el usuario escribe una palabra de estilo o pide expresamente otra cosa («otro estilo», «rediséñala», «nueva web»). Es la regla del §5: «NO cambiar la identidad aprobada sin autorización».
- **Retoques:** antes no llevaban ningún dato de diseño y el modelo podía inventarse colores. Ahora llevan el contrato compacto: paleta, tipografía, radios, sombras y espaciado.
- **`.forja/DESIGN.md`:** el export a repositorio genera el documento. Al importar un repositorio que solo traiga el `DESIGN.md`, la dirección se recupera igualmente.

### Ventana de historial adaptativa

Ya existía antes de este sprint:

- `ventanaReferencia()` más `limites-medidos.ts` recortan de forma proactiva cuando el contexto entra en zona roja.
- Usan el tope real del modelo cuando ya se ha medido.

Por eso no se ha duplicado.

## 6. Orden propuesto para los siguientes sprints

Se sigue el §75 del plan, ajustado a lo que ya existe:

- **Sprint 2 (pendiente):** Project Map con grafo de imports y ranking de archivos. Con eso, L1 y L2 enviarían solo los archivos relacionados en lugar de los 12 del mapa.
- **Sprint 3:** interfaz `ModelProvider` y tabla de capacidades (§59–60). Budget Engine único con los límites del §58 y el modo FREE-ONLY automático al llegar al tope.
- **Sprint 4 y siguientes:** Design First con aprobación, fusión de Vision QA, escalera de recuperación y gates de publicación.
