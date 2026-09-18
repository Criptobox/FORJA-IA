---
name: protocolo-verificacion
description: Protocolo estricto para cualquier tarea no trivial de código, investigación, archivos o proyecto — analizar antes de actuar, separar lo confirmado de lo inferido, revisar el propio trabajo dos veces y nunca declarar algo "listo" sin haberlo comprobado. Úsalo siempre que la tarea implique escribir o cambiar código, investigar algo con fuentes, tocar archivos del usuario, o entregar un proyecto — no para preguntas triviales de una frase.
---

# Protocolo de verificación

Esto no es una lista de buenas intenciones. Es una secuencia de fases con
una salida concreta en cada una — si una fase no produce lo que pide, no
está hecha, aunque se haya "pensado en ello".

**Límite honesto**: esto es una instrucción, no un candado de código. Puede
exigir un formato de salida (y lo hace, más abajo) pero no puede impedir
técnicamente que te lo saltes. Lo que sí puede: hacer que saltárselo se
note, porque falta la tabla, falta el checklist, o falta el veredicto.

## Cuándo NO se aplica esto

Este protocolo cuesta tiempo y turnos. Aplicarlo a todo, incluida una
pregunta de una frase, es la misma clase de fallo que no aplicarlo nunca:
convierte el rigor en burocracia y entrena a ignorarlo.

**No aplica** cuando la respuesta no toca código, no toca archivos del
usuario, y no hace ninguna afirmación verificable — una aclaración
conceptual, una opinión pedida directamente, "¿qué hace esta función en dos
frases", una charla. Ahí, responde normal.

**Sí aplica**, aunque parezca pequeño, en cuanto la tarea:

- cambia o crea un archivo real,
- afirma algo sobre CÓMO se comporta un sistema (código, API, datos) que
  podría estar mal,
- o el usuario va a actuar sobre lo que respondas (tomar una decisión,
  publicar algo, confiar en un número).

En la duda, una versión corta del cierre (fase 3 breve + veredicto de una
línea) es más barata que decidir mal si aplica o no.

## Fase 0 — Contexto por cuenta propia

Antes de pedir nada, léelo tú:

1. `CLAUDE.md` / `AGENTS.md` del proyecto (y lo que importen).
2. El archivo de memoria de errores (ver «Aprendizaje persistente» abajo) —
   si existe, para no repetir un fallo ya conocido en otro proyecto.
3. Cualquier doc de arquitectura o decisiones que el propio repo señale.

Solo si después de leer esto sigue faltando algo **crítico** — algo que si
se adivina mal es caro de deshacer o cambia el comportamiento de verdad, no
un detalle de estilo — se pregunta. No se rellena a ciegas.

## Fase 1 — Análisis

Antes de tocar nada, resume con tus propias palabras:

- Qué se pidió **explícito**.
- Qué está **implícito** (lo que hace falta para que lo explícito funcione).
- Qué **NO** se pidió — esto es lo que alimenta el control de alcance de la
  fase 7: si no está aquí, no se toca, por buena idea que parezca.

## Fase 2 — No duplicar funciones

Antes de escribir código nuevo, busca si ya existe algo que hace esto o
algo parecido. Deja constancia de QUÉ se buscó y QUÉ se encontró — no
«ya lo comprobé», sino los términos de búsqueda y el resultado, aunque sea
«nada relevante».

## Fase 3 — Sistema de confianza

Antes de actuar, clasifica cada afirmación o supuesto del plan en una de
tres cubetas, explícitas:

- **CONFIRMADO** — lo viste en el código, la doc, o una fuente verificable.
- **INFERIDO** — supuesto razonable a partir de lo confirmado; se dice
  como lo que es, nunca disfrazado de hecho.
- **DESCONOCIDO** — hueco real. Se pregunta si es crítico (fase 0), o se
  declara como hueco conocido si no lo es.

Si todo lo que vas a hacer es INFERIDO sin nada CONFIRMADO debajo, para: no
tienes base suficiente todavía.

**Plantilla** (una fila por afirmación o supuesto real del plan, no relleno):

```markdown
| Afirmación | Estado | Base |
|---|---|---|
| El endpoint usa autenticación por token | CONFIRMADO | middleware/auth.ts:14 |
| El token expira a los 30 min | INFERIDO | valor típico, no visto en config |
| Hay un límite de tasa por IP | DESCONOCIDO | no aparece en el código ni la doc |
```

## Fase 4 — Detección de contradicciones

Si dos fuentes no cuadran — el código dice una cosa, la doc otra, el
usuario pidió una tercera — no se elige en silencio. Se nombra el
conflicto y se dice cuál se sigue y por qué, o se pregunta.

**Ejemplo**: el README dice que el timeout es de 10s; el código tiene
`TIMEOUT_MS = 30_000`. En vez de usar uno de los dos sin más, se dice:
*«El README dice 10s pero el código usa 30s (config.ts:8). Sigo el código
—es lo que corre de verdad— y aviso de que el README está desactualizado.»*
Eso es nombrar el conflicto. Elegir 10s porque "está en la doc", o 30s
porque "es lo que vi primero", sin decir que había dos respuestas, es
exactamente lo que esta fase prohíbe.

## Fase 5 — Transparencia de herramientas

Regla dura, sin excepciones: nunca digas que ejecutaste algo, hiciste push,
corriste los tests, o llamaste a una herramienta, si no lo hiciste EN ESE
MISMO turno con el resultado real delante. Ni en pasado disfrazado, ni como
«ya debería estar hecho». Si no se hizo, no se dice que se hizo.

## Fase 6 — Autotest

Con el trabajo ya hecho, intenta romperlo tú antes de entregarlo:

- ¿Qué entrada lo rompería?
- ¿Qué caso NO se probó?
- ¿Qué se dejó sin verificar porque no había forma fácil de hacerlo?

Esto produce una lista corta de huecos conocidos. Nunca silencio: si no
encuentras huecos, se dice explícitamente que se buscaron y no aparecieron
— no se omite la sección.

## Fase 7 — Doble revisión

Para una tarea normal, TÚ mismo haces las dos pasadas, una detrás de otra,
no mezcladas:

1. **Revisión técnica** — ¿funciona de verdad, es correcto, sigue las
   convenciones del proyecto?
2. **Revisión crítica** — ¿es lo que se pidió, ni más ni menos? ¿hay algo
   exagerado o inventado en cómo se describe el resultado?

Un segundo revisor INDEPENDIENTE (no tú, un agente o una persona aparte)
solo entra si el cambio cruza alguno de estos umbrales:

- Toca seguridad, autenticación, pagos, o datos reales de usuarios.
- Es una operación difícil de deshacer (borra datos, reescribe historial,
  cambia un esquema en producción).
- Cambia más de ~5 archivos, o es una pieza central de la que dependen
  otras.

Por debajo de ese umbral, un segundo revisor es coste sin beneficio real —
las dos pasadas propias ya cazan casi todo lo que un tercero cazaría.

**Sin forma de invocar a otro agente** (el entorno no tiene subagentes, o no
hay otra persona disponible): las dos pasadas se hacen igual TÚ mismo, pero
de verdad separadas — termina la revisión técnica, pasa a otra cosa aunque
sea un minuto, y vuelve después a la crítica con la vista fresca. Dos
pasadas seguidas sin ese corte tienden a repetir el mismo punto ciego dos
veces, que es como no haber hecho la segunda.

## Fase 8 — Checklist de requisitos

Vuelve al pedido ORIGINAL, literal, y márcalo punto por punto. No «creo que
está todo» — cada punto, con su sí o su no.

## Fase 9 — Puntuación final / veredicto

Antes de decir que la tarea está lista, un veredicto explícito con tres
partes, sin suavizarlas:

- **Confirmado funcionando** — lo que de verdad se comprobó.
- **No se pudo verificar** — lo que se dejó sin comprobar y por qué.
- **Falta / no se hizo** — lo que quedó fuera, aunque sea porque no se
  pidió.

**Plantilla**:

```markdown
### Veredicto
- Confirmado funcionando: [lo probado, con cómo se probó]
- No se pudo verificar: [qué, y por qué — falta de acceso, de tiempo, de forma de probarlo]
- Falta / no se hizo: [qué quedó fuera, y si fue porque no se pidió o porque no dio tiempo]
```

Nunca «listo» si algo de esto no se comprobó de verdad. Decirlo tal cual es
mejor que un «todo bien» que no lo está.

## Fase 10 — Aprendizaje persistente

Ningún agente tiene memoria entre sesiones o proyectos por diseño — lo
único que persiste es lo que queda escrito en un archivo que se vuelve a
leer la próxima vez. Por eso la fase 0 lee esto y esta fase lo escribe.

**Dónde vive**: `~/.claude/memoria-de-errores.md` — fuera de cualquier
repo concreto, para que un fallo real en un proyecto sirva en el
siguiente. Si ese archivo no existe, créalo la primera vez que haya algo
que anotar.

**Qué se anota**: SOLO errores reales y confirmados — algo que de verdad
pasó y se verificó, nunca una sospecha o un «podría fallar». Una entrada
corta, con fecha, proyecto y la lección en una frase accionable:

```markdown
## 2026-01-15 — prism-ai — el puente de consola perdía la carrera
Insertar un shim de compatibilidad al FINAL de <head> no protege scripts
que el proyecto pone ANTES en el documento. Insertar shims de este tipo
al ABRIR <head>, no antes de cerrarlo.
```

Si el archivo crece mucho, no se resume a la ligera — un error real sigue
siendo real por muy viejo que sea la entrada. Pero leerlo entero en cada
fase 0 se vuelve caro con el tiempo, así que la LECTURA (nunca el
contenido) se acota:

1. Primero las entradas del proyecto actual (por el nombre después de la
   fecha en el encabezado).
2. Si no hay, o quedan pocas, las últimas ~20 entradas en general,
   sin importar de qué proyecto.
3. Solo si la tarea concreta lo pide (p. ej. "¿ya la cagué con esto antes en
   otro sitio?"), se busca más atrás por palabra clave.

Nada se borra ni se resume por antigüedad — el tope es solo cuánto se lee
por defecto, no cuánto se guarda.

## Modos especializados

No son protocolos distintos: son las mismas 10 fases con distinto énfasis.

| Modo | Qué pesa más |
|---|---|
| Código | Fase 2 (no duplicar) y fase 6 (autotest real, no solo léelo) |
| Investigación | Fase 3 (separar hecho de inferencia) y fase 4 (fuentes que no cuadran) |
| Archivos del usuario | Fase 0 (qué había antes de tocar) y fase 5 (nunca decir que se guardó si no se guardó) |
| Web / datos externos | Fase 3 (verificar con más de una fuente, fecha del dato) |
| Proyecto completo | Fase 1 (alcance) y fase 8 (checklist final) |

## Formato de cierre obligatorio

Ninguna tarea de este protocolo termina sin mostrar, en este orden:

1. La tabla de confianza (fase 3).
2. Los huecos del autotest (fase 6), aunque sea «ninguno encontrado».
3. El checklist de requisitos (fase 8).
4. El veredicto final (fase 9).

Las cuatro piezas van siempre — lo que cambia con el tamaño de la tarea es
cuánto ocupa cada una, no si aparece. En una tarea corta, la tabla de
confianza puede ser dos filas y el veredicto una línea por bloque; en una
grande, cada pieza se desarrolla de verdad. Saltarse una pieza porque «esto
era pequeño» es la puerta por la que se cuela lo no comprobado.

Si la tarea activó el umbral de la fase 10, la entrada añadida a
`~/.claude/memoria-de-errores.md` se menciona también.
