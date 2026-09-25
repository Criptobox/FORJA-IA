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

### Grafo de archivos y contexto por foco (`grafo-proyecto.ts`)

- **Última versión de cada archivo:** se toma de la conversación con la misma lectura de nombres que usan la vista previa y el ZIP.
- **Grafo de dependencias entre archivos:** se construye a partir de `<script src>`, `<link href>`, `import … from`, `import()`, `require()`, `@import` y `url()` de CSS. Resuelve rutas relativas entre carpetas y los imports sin extensión.
- **Archivos relevantes para una petición:** son los que nombra la petición o, si no nombra ninguno, aquellos cuyo contenido casa con sus palabras. A esos se suman sus vecinos en el grafo, el HTML de entrada y todas las hojas de estilo.
- **Solo en preguntas y retoques (L1/L2):** los demás archivos no se reenvían. En su lugar va un marcador con su nombre, para que el modelo sepa que existen y pueda pedirlos.
- **Qué nunca se quita:**
  - Nada, si la petición no da pistas o si casi todos los archivos casan con ella.
  - Nada, en proyectos de menos de 4 archivos.
  - La pregunta viva.
- **Qué se ve:**
  - El desglose de «contexto usado» dice qué archivos no se enviaron.
  - La etiqueta `ctx −N %` suma este ahorro.

### Ventana de historial adaptativa

Ya existía antes de este sprint:

- `ventanaReferencia()` más `limites-medidos.ts` recortan de forma proactiva cuando el contexto entra en zona roja.
- Usan el tope real del modelo cuando ya se ha medido.

Por eso no se ha duplicado.

## 6. Sprint 3 — Budget Engine en dinero (`presupuesto-dinero.ts`)

- **Límites de fábrica** (§58):

  | Límite | Importe |
  |---|---|
  | Mensual | 5 $ |
  | Diario | 1 $ |
  | Por tarea | 0,50 $ |

  Se editan en Ajustes → Chat → Presupuesto en dinero, y un campo vacío significa «sin límite». «Tarea» es un envío del usuario con todo lo que desencadena: failover, continuaciones, revisiones y el orquestador.
- **Qué se cuenta:** solo el dinero medido, es decir, los tokens que reporta el proveedor multiplicados por el precio fechado de `precios.ts`.
  - Una llamada de pago sin cuenta o sin precio no suma dinero. Queda contada como «sin importe conocido», y para esas sigue valiendo el techo de llamadas de `gasto.ts`.
- **Qué pasa al llegar al límite** (FREE ONLY):
  - `streamChat` corta cualquier llamada de pago antes de que salga, incluidas las de los caminos automáticos.
  - Auto y FORJA WEB sacan los modelos de pago de su cadena.
  - Si el modelo elegido a mano es de pago, responde el mejor gratis para ese encargo y se avisa.
- **Aviso previo:** desde el 80 % de cualquier límite, al empezar cada tarea.
- **Límite conocido:** el importe de una llamada solo se sabe cuando termina. La llamada que cruza el límite se paga entera y es la última; se explica en Ajustes.
- **Duplicados:** `gasto.ts` (techo de llamadas) se mantiene como segunda barrera. Los demás módulos de coste del motor (`perfiles.ts`, `presupuesto-tokens.ts`, `token-roi.ts`) quedan para fusionarse cuando se haga el Task Ledger.

### Fallback inteligente por tipo de error (§61)

`decisiones.ts` ya distinguía cuota (402/429), proveedor caído (5xx/timeout), modelo retirado (404), mensaje demasiado grande (413/TPM) y petición inválida (400 propia, el único caso que para). Faltaba una categoría:

- **Límite propio**: presupuesto en dinero, techo de llamadas de pago y proveedor vetado. La petición ni siquiera sale, así que no hay código HTTP, y se trataba como «el proveedor no responde».
  - El modelo se mandaba al banquillo (cooldown) y contaba como fallo en su historial. Ya no.
  - El aviso decía «X no está respondiendo». Ahora dice «Límite de gasto: sigue un modelo gratis».
  - El siguiente intento podía ser otro modelo de pago, que volvía a cortarse. Ahora salta al siguiente candidato **gratis** de la cadena, o al failover, que solo elige gratis.

### Capacidades: visión (§60, `capacidades.ts`)

Con una imagen adjunta, Auto elegía por encaje con la tarea sin mirar si el modelo ve imágenes, y se perdía un intento con «does not support image input».

- **Pista por nombre** (Gemini, GPT-4o/5, Claude, Llama 4, Pixtral, Qwen-VL, GLM-4V…): solo **ordena**, nunca quita.
- **Evidencia**: un modelo que respondió «no admito imágenes» en este dispositivo sale de la cadena de Auto en los turnos con imágenes. Si luego ve una imagen sin quejarse, la marca se borra.
- Si todos los de la cadena están marcados, no se deja vacía: se intenta igualmente.

El resto de capacidades del §60 (CODING, REASONING, FAST…) sigue como encaje por nombre en `task-router.ts`. No se ha creado una tabla que nadie use.

## 7. Sprint 4 — Design First en el chat (`propuesta-diseno.ts`)

El Estudio (`/forja`) ya proponía antes de construir. El chat, que es donde se hacen las webs, construía directamente. Ahora, con una web nueva:

- **Propuesta:** en vez de construir se enseña una tarjeta con tres direcciones visuales (paleta, tipografía y para qué encajan, la recomendada primero), las secciones del plano de contenido y los datos que dio el usuario frente a los que faltan.
- **Coste cero:** todo sale del catálogo y del plano, que son deterministas. Ninguna llamada al modelo hasta que se pulsa «Construir».
- **Al elegir:**
  - La dirección viaja como elección del usuario y queda fijada como contrato del proyecto.
  - Los ajustes se añaden al encargo.
  - Los datos que faltan viajan con la orden de no inventarlos (§21).
- **Cuándo no sale:** en retoques, apps, con imagen de referencia, en proyectos con identidad ya fijada (salvo que se pida otro estilo), con «directo» en el encargo o si se apaga en Ajustes → Chat.
- **Pruebas:** `tests/e2e/propuesta-diseno.spec.ts` comprueba que la propuesta no hace ninguna petición y que lo elegido llega al prompt. Los E2E que prueban la construcción desactivan la propuesta en su configuración de arranque.

## 8. Sprint 5 — Builder: retoques por parche y Quality Gate (`retoque-parche.ts`)

- **Bug corregido en `patch.ts`**: cuando el SEARCH solo casaba ignorando la sangría (el caso más frecuente con modelos gratis), la coincidencia flexible volvía a escribir el **SEARCH** en lugar del REPLACE. El parche contaba como aplicado y el archivo quedaba igual. Afectaba también a la herramienta `apply_patch` del agente. Tiene test que lo reproduce.
- **Retoques por parche en el chat** (§63):
  - **Cuándo:** en un retoque (L2), sin agente y sobre archivos de más de 1.500 caracteres.
  - **Qué se pide:** bloques SEARCH/REPLACE bajo el nombre del archivo.
  - **Qué pasa al llegar la respuesta:** se aplican sobre la última versión y el archivo completo se añade a la respuesta localmente, sin gastar tokens, para que la vista previa, el ZIP y el historial sigan viendo archivos enteros.
  - **Ahorro:** en una página de 20.000 caracteres, la salida de un retoque pasa de ~20.000 a ~500-1.000 caracteres (en torno al 95 %). Además es más rápido y no da ocasión de cambiar lo que nadie pidió.
- **Rollback** (§22): si algún bloque de un archivo no casa, ese archivo no se toca y se pide completo en un segundo intento. Nunca queda un archivo a medio parchear.
- **Quality Gate** (§62):
  - **Qué detecta:** un archivo entregado con partes omitidas («<!-- resto del código igual -->», «// ... existing code ...») que mide mucho menos que su versión anterior.
  - **Qué hace:** no se acepta, se neutraliza en la respuesta (la versión anterior sigue siendo la buena) y se pide bien. Antes, ese archivo sustituía a la página entera.
- **Pruebas:** `tests/e2e/retoque-parche.spec.ts` comprueba los dos caminos en el navegador con un mock: parche aplicado y parche que no casa.

## 9. Sprint 6 — QA visual de móvil en el bucle de corrección (`qa-responsive.ts`)

La revisión automática ya ejecutaba cada página generada a 390 px con el medidor de `visual-qa.ts` dentro. De todo lo que medía, solo se usaban las señas de «página genérica». El scroll horizontal, los botones fuera de pantalla o sin nombre, el contraste ilegible, el texto de menos de 12 px y las imágenes sin alt se medían y se tiraban: el modelo nunca se enteraba de que su página se rompía en un móvil.

- **Severidades:**

  | Nivel | Hallazgos | Qué pasa |
  |---|---|---|
  | Alta | scroll horizontal, fuera de pantalla, sin nombre accesible | Corrección automática |
  | Media | contraste | Corrección automática |
  | Media | texto < 12 px, imagen sin alt | Viajan en la corrección si ya hay una, pero no gastan una llamada por sí solos |
  | Baja | objetivo de toque pequeño | Solo se informa |

- **La corrección** lleva lo medido, tal cual, y la regla para arreglarlo. Usa el mismo bucle y el mismo tope de intentos que los errores de consola. Como la vuelta es un retoque, sale por parche (Sprint 5).
- **Orden de la revisión:** errores de consola → botones que fallan → móvil → página genérica / fuera de dirección → contenido frente al plano.
- **El mock `mock-generica` tenía un fallo real de móvil:** tres tarjetas de 220 px sin `flex-wrap`, que desbordaban a 390 px. Se corrige en el mock para que su spec siga probando lo que prueba.
- **Pruebas:** `tests/e2e/qa-movil.spec.ts` con `mock-movil-roto` comprueba la página que desborda, la corrección con lo medido y la segunda entrega, que ya no falla.

**Pendiente de este frente:** la comparación con un modelo de visión (captura frente a diseño). Existe como herramienta del agente (`visual_review`), pero no se lanza sola porque cuesta una llamada con imagen en cada página. Candidata a activarse solo en L3 o con presupuesto.

## 10. Sprint 7 — Escalera de recuperación (`escalera.ts`)

La revisión automática (consola, botones, móvil, genérica/dirección, contenido) corregía siempre igual: mandaba el problema al MISMO modelo hasta agotar el tope de intentos. Si no lo arreglaba a la primera, la segunda vez recibía la misma petición y solía fallar igual, con una llamada gastada.

- **Firma de cada problema:** tipo más detalles normalizados (sin números ni comillas, ordenados). Si la firma vuelve tras corregirla, el modelo no avanzó: eso es un ciclo (§39).
- **Escalera** (§65):
  1. Problema nuevo: lo corrige el mismo modelo.
  2. Vuelve tras corregirlo: lo corrige **otro modelo**, el mejor de la cadena de Auto para ese encargo, respetando presupuesto, cuota y modelos rotos.
  3. Ya lo probó otro modelo, o no hay alternativa: **se para y se dice**, con la evidencia. No se repite una llamada que ya falló.
- **Recorte de contexto** (peldaño 2 del §65): no se repite aquí. Ya lo hacen los niveles L0–L5 y el grafo, porque una corrección es un retoque, viaja por parche y sin archivos ajenos.
- **Pruebas:**
  - `tests/unit/escalera.test.ts`.
  - E2E en `qa-movil.spec.ts`: un modelo terco que nunca arregla el desbordamiento en móvil. La 2ª corrección la hace otro modelo, que sí lo arregla.
  - `generico.spec` pasa de esperar 2 correcciones a esperar 1: con un solo modelo configurado ya no se repite la petición que falló.

## 11. Orden propuesto para los siguientes sprints

Se sigue el §75 del plan, ajustado a lo que ya existe:

- **Pendiente de Sprint 3:** interfaz `ModelProvider` explícita (§59). Hoy la abstracción real son los 3 protocolos de `chat-client.ts` (openai / anthropic / gemini) más el registro de `providers.ts`: añadir un proveedor compatible no requiere código nuevo.
- **Sprint 4 y siguientes:** Design First con aprobación, fusión de Vision QA, escalera de recuperación y gates de publicación.
