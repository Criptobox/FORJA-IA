# FORJA IA — Ideas de mejora (hoja de ruta v4.5 → v5.0)

> Documento vivo con las ideas de evolución tras v4.7 «La Página, no el
> Hero». Cada idea dice QUÉ, POR QUÉ y CUÁNTO CUESTA (esfuerzo y tokens).
> Las ideas marcadas ★ son las de mejor relación impacto/esfuerzo para el
> objetivo del proyecto: páginas ultra profesionales saliendo lo más barato
> posible.
>
> **Actualizado tras v4.7**: las ideas A-F de v4.6 y G-I de v4.7 (plano de
> contenido, QA de detalle, iconografía e imagen compiladas + 9 correcciones
> de cableado) quedaron IMPLEMENTADAS — se conservan aquí como registro con
> su estado. Las NUEVAS ideas (v4.8+) están al principio.

---

## V4.8 — El acabado y la escala (lo que v4.7 dejó a medio cablear)

### 1. ★ Generación por secciones + ensamblador determinista
- **Qué**: hoy toda la página compite por un único presupuesto en una sola
  llamada, así que el detalle se reparte entre todas las secciones del
  plano. Con `plano-contenido.ts` ya declarando el inventario completo, el
  Codificador puede generar el `<main>` sección a sección (o en 2-3 lotes)
  y un ensamblador determinista une `<head>`, tokens, CSS forjada, objeto
  3D, primitivas e iconos. Cada sección recibe el detalle COMPLETO porque
  ya no compite con las demás por el mismo techo de tokens.
- **Por qué**: es el techo de detalle real — hoy limitado por
  `maxTokensImplementacion` de una sola llamada — y el paso previo natural
  al Page Genome (idea 4): quien puede generar una sección puede
  reemplazar una sección.
- **Coste**: medio-alto. Toca `nucleo-v4.ts` y el ensamblador es nuevo.

### 2. ★ Juez de acabado en la Arena (alimentado por qa-detalle.ts)
- **Qué**: el panel de jueces (`director.ts`) puntúa visual/UX/originalidad
  pero no densidad de contenido, estados ni casos borde — con qa-detalle.ts
  ya midiendo eso, falta pasarlo como EVIDENCIA al cuarto juez, igual que
  el juez de originalidad recibe hoy el informe anti-genérico.
- **Por qué**: hoy la Arena puede premiar la maqueta más limpia, y la más
  limpia suele ser la más vacía. Este juez corrige el sesgo con evidencia
  física, no con opinión.
- **Coste**: bajo. `auditarDetalle()` ya existe; es prompt + wiring.

### 3. ★ Panel «Elige la experiencia» en la UI (cierre real del circuito E)
- **Qué**: el contrato JSON es exportable/editable y re-compilable
  (`contrato-experiencia.ts`) desde v4.6, y v4.7 corrigió el bug que hacía
  que editar el contrato degradara la familia a `minimal`. Sigue faltando
  el PANEL: controles familia/hero/intensidad/profundidad en la vista
  previa que llamen a `aplicarEdicionContrato()` y re-rendericen sin
  gastar un token.
- **Coste**: bajo-medio. Todo el motor existe (y ahora sin el bug); es UI +
  un POST al núcleo.

### 4. Page Genome + parches quirúrgicos
- **Qué**: con el plano de contenido declarando QUÉ tiene cada sección y el
  QA de detalle midiéndolo, una edición del usuario («cambia solo los
  precios», «añade un testimonio más») puede aislarse a la sección
  concreta del plano y regenerarse sola, sin tocar el resto del documento.
- **Por qué**: el mayor ahorro de tokens por edición del roadmap original;
  ahora tiene sobre qué apoyarse (antes no existía ni el inventario de
  secciones ni la forma de medir si una sección concreta está completa).
- **Coste**: alto. Depende de la idea 1 (generación por secciones).

### 5. Verticales locales con contenido propio
- **Qué**: `plano-contenido.ts` ya cubre "local" como vertical de
  CONTENIDO (plantilla de secciones); falta una plantilla de HECHOS típicos
  por oficio (qué precios/horarios/datos espera un usuario que NO los
  declaró) para que el copy de relleno sea más específico que «invéntalo
  realista» — ej. una barbería sin precios declarados podría sugerir un
  rango típico en vez de uno genérico.
- **Coste**: medio. Requiere una tabla de referencia por oficio y cuidado
  para no inventar datos que se lean como reales cuando son ilustrativos.

---

## Registro de ideas implementadas

## V4.7 — La Página, no el Hero — ✅ IMPLEMENTADO (v4.7.0)

### G. ~~Plano de contenido determinista~~ → ✅ `plano-contenido.ts`
- Extractor de hechos del brief (precios, teléfonos, correos, ciudades,
  horarios, cantidades, marca); catálogo de 13 secciones con slots y
  mínimos verificables; 9 plantillas por vertical de contenido; 3 niveles
  de detalle que mueven secciones, piezas, líneas objetivo y techo de
  tokens a la vez. Los hechos del brief AÑADEN secciones (precios
  declarados → sección de precios).

### H. ~~QA de densidad de detalle~~ → ✅ `qa-detalle.ts`
- 24 métricas medidas contra el plano de contenido; puntuación 0-100;
  13 tipos de hallazgo con corrección propuesta; encargo de reparación
  quirúrgica («amplía, no regeneres») en vez de regenerar la página
  entera; fase 6d del núcleo con rollback honesto.

### I. ~~Iconografía e imagen compiladas~~ → ✅ `iconos.ts`
- 24 iconos SVG de trazo con currentColor, elegidos por sector; imagen con
  aspect-ratio fijo (el layout no salta); cifras tabulares. Mismo patrón
  que `primitivas.ts`: el Codificador selecciona, no dibuja paths a mano.

### Correcciones de cableado (9, sin idea propia pero con impacto directo)
- Corpus de señales (ficha + ADN + feedback) en vez de solo el mensaje
  crudo; el ajuste del usuario («Ajusta: …») por fin re-decide la
  experiencia; anti-repetición calculada con la composición real y
  presente en el contrato; historial de composición persistible entre
  invocaciones; `recompilarDesdeDna()` ya no degrada a `minimal`;
  verticales locales alineados con la familia; presupuesto de
  implementación recalibrado (38%→46%); `maxTokens` del Codificador ligado
  al nivel de detalle.

---

## Cómo leer esta hoja

El plan maestro (§39) fija las prioridades: V4.5 Surgical Editing, V4.6
Design Compiler, V4.7 Visual Intelligence, V4.8 FORJA Studio, V5.0 Design
Engine. v4.4 cerró la eficiencia de tokens; v4.5 implementó el MOTOR DE
EXPERIENCIA (familias, recetas, spatial/motion/hero/card engines, bias, QA
patch-first, anti-repetición, Reference DNA, performance gate); v4.6 hizo
que el taller EJECUTE y APRENDA: primitivas compiladas, objeto 3D forjado,
learning loop con evidencia, motion QA medido, contrato editable y Arena de
familias. Las ideas de abajo continúan esa línea.

---

## V4.6→4.7 — El estudio editable — registro histórico (varias cerradas por v4.7)

### 1. Panel «Elige la experiencia» en la UI (cierre del circuito E) → movida a V4.8 idea 3
- El motor ya no tiene el bug que degradaba la familia a `minimal` al
  editar (corregido en v4.7); la idea sigue viva como V4.8 idea 3.

### 2. ~~Persistencia del learning loop en el host~~ → ✅ AMPLIADA en v4.7
- El circuito B (`memoriaAprendizaje`) ya existía; v4.7 añadió el
  equivalente para la anti-repetición (`DepsMvp.historialComposicion` +
  `cargarHistorial()`), que hasta entonces se perdía en cada invocación
  serverless. Sigue faltando el panel «lo que la forja aprendió de ti»
  en la UI — trabajo de interfaz, no de motor.

### 3. Primitivas por uso medido (crecer el catálogo con evidencia)
- **Qué**: el ROI v4.4 + el learning loop v4.6 dicen qué primitivas salen en
  las generaciones ganadoras. Las que ganan, se amplían (variantes); las que
  nunca salen, se retiran del catálogo por peso muerto.
- **Coste**: bajo. Es una política sobre `elegirPrimitivas` + estadística.

### 4. Genoma como juez adicional de la Arena
- **Qué**: hoy el learning loop alimenta la ELECCIÓN; el paso siguiente es
  que el Genoma vote en el panel con su evidencia («esta familia ya ganó 3
  veces para este vertical: +0.5 a la visión que la respete»).
- **Coste**: medio. Requiere pasar recomendaciones al prompt de jueces2.

### 5. ★ Motion QA con presupuesto de movimiento por página → ver también V4.8 (extensión natural)
- **Qué**: además de la escala §9 por duración, un techo de PRESUPUESTO
  (nº de animaciones por página según intensidad): 12 en nivel 2, 20 en
  nivel 3… El QA ya mide; falta el toco y el parche (quitar animación de
  menor jerarquía).
- **Coste**: bajo-medio. Extensión natural de `motion-qa-medido.ts`.

---

## Registro de ideas implementadas

## V4.6 — El Taller que Aprende — ✅ IMPLEMENTADO (v4.6.0)

### A. ~~Primitivas listas: de receta a componente compilado~~ → ✅ `primitivas.ts`
- 8 bloques listos (REVEAL_GRUPO, TILT_CARD, MAGNETIC_CTA, FLOATING_METRIC,
  SPOTLIGHT_CARD, PARALLAX_LAYER, STICKY_STORY, MARQUEE) con HTML+CSS
  completos, responsive, toques ≥44px, foco y reduced-motion de fábrica,
  más scripts capados. El Codificador selecciona y parametriza. Techo por
  intensidad y disciplina registrada. Coste marginal: 0 tokens.

### B. ~~Learning loop del Genoma sobre la experiencia~~ → ✅ `aprendizaje-genoma.ts`
- Huella + RESULTADO (score + veredicto) en `EntradaAprendizaje`;
  `recomendacionesAprendidas()` produce destacar/evitar con evidencia;
  ajustes (+2/-2 hero, +1.5/-1.5 familia) alimentan hero engine y Arena;
  memoria inyectable/serializable; integrada en el núcleo (fase 8b) y en
  el contrato (sección LEARNING LOOP).

### C. ~~WebHero real: objeto 3D CSS paramétrico~~ → ✅ `objeto-3d.ts`
- 8 formas (monolito, orbe, capas flotantes, tarjeta doblada, anillo
  orbital, torre isométrica, cubo giratorio, constelación), HTML+CSS 3D
  puro ~2 KB, aria-hidden, tokens y reduced-motion resueltos; elección por
  familia+señales+anti-repetición fuerte; viaja COMPLETO al maquetador y al
  Codificador (prohibido re-inventarlo).

### D. ~~Motion QA con medición real del movimiento~~ → ✅ `motion-qa-medido.ts`
- Parseo de reglas CSS (con @media), clasificación por categoría §9,
  verificación de stagger pedido y guard real de reduced-motion; parches
  append-only (guard + overrides capados + utilidad de stagger);
  re-medición override-aware; fase 6c del núcleo con ROI propio.

### E. ~~Contrato de experiencia EXPORTABLE (JSON)~~ → ✅ `contrato-experiencia.ts`
- Schema `forja.experiencia@1`; exportar/serializar/validar/aplicar
  edición; re-compilado completo del pipeline con 0 tokens (tokens CSS,
  objeto, primitivas, planes y contrato textual coherentes).

### F. ~~Test A/B de familias con la Arena~~ → ✅ `arena-familias.ts`
- `asignarFamiliasArena()` (3 distintas, natural defiende A, vecinas por
  señales/aprendizaje), juez de coherencia determinista con vocabulario §12,
  lecciones «la familia X funcionó para el vertical Y» al Genoma; cableado
  completo en arena2 (prompt del director + maquetas + panel) y núcleo.

## V4.5 — Edición quirúrgica (Surgical Editing) — pendiente (v4.6 no la tocó)

### 1. ★ Page Genome real (§12) — el árbol editable de la página
- **Qué**: al generar, el núcleo guarda un `PageGenome` (JSON con secciones,
  componentes, interacciones y los tokens que usó cada nodo). El Estudio lo
  pinta como árbol y cada nodo es seleccionable.
- **Por qué**: hoy «cambia el hero» re-genera la página entera. Con genoma,
  se selecciona el nodo y solo ese nodo se vuelve a pagar. Es el mayor ahorro
  pendiente tras v4.4: una edición quirúrgica cuesta ~10% de una regeneración.
- **Coste**: medio. El parseo HTML→genoma puede ser determinista (regex de
  secciones semánticas + helpers existentes de `revisor-visual`).

### 2. ★ Preserve/Change Contract en el prompt (§13)
- **Qué**: cada petición de edición compila explícitamente qué se PRESERVA
  (identidad, hero, copy, imágenes) y qué CAMBIA. El compilador de contexto
  v4.4 ya tiene las piezas: falta la interfaz y el bloque del prompt.
- **Por qué**: evita que un ajuste pequeño destruya el diseño aprobado —
  la queja nº 1 de los generadores de páginas.
- **Coste**: bajo. Determinista, sin modelo.

### 3. Rollback de ediciones (§33 parcial)
- **Qué**: pila de versiones del HTML con diff de código + diff de QA +
  coste en tokens de cada paso. `rollback(n)` y `restaurar(nodo)`.
- **Coste**: bajo-medio. El canvas (v4.0) ya tiene historial; generalizarlo.

### 4. ★ Parches LLM quirúrgicos (patch-mode)
- **Qué**: cuando un parche determinista no basta, el Codificador recibe
  SOLO el fragmento afectado + instrucción «devuelve solo el bloque
  corregido», y el núcleo lo re-inyecta. Max tokens de salida: 500-1500 en
  lugar de 16k.
- **Por qué**: la corrección típica (hover, spacing, contraste) no necesita
  re-pintar la página. Ahorro estimado: 60-80% por ronda de corrección.
- **Coste**: medio. Requiere el genoma (idea 1) o anclas por id/data-attr.

## V4.6→4.7 — Design Compiler — registro histórico

### 5. ~~Experience DNA como JSON compilable~~ → ✅ IMPLEMENTADO en v4.5 (`experience-dna.ts` + `tokens-experiencia.ts`) y AMPLIADO en v4.6 (contrato exportable/editable)

### 6. ★ Catálogo de primitivas (§18, §19, §42) → ✅ IMPLEMENTADO en v4.6 (`primitivas.ts`, idea A): 8 bloques compilados, nacen auditados, con scripts capados. Ampliar el catálogo POR USO MEDIDO (idea 3 de V4.7).

### 7. ~~Experience Families~~ → ✅ IMPLEMENTADO en v4.5 (`familias-experiencia.ts`, 10 familias + verticales + regla §23) y con APRENDIZAJE en v4.6 (Arena entre familias, idea F)

## V4.6→4.7 — Inteligencia visual — registro histórico

### 8. ~~Editorial Bias Detector + Editorial Score~~ → ✅ IMPLEMENTADO en v4.5 (`experience-bias.ts` + QA patch-first en `experience-qa.ts`)

### 9. ★ Anti-Slop con causas y alternativas (§30)
- **Qué**: el anti-genérico actual dice «genérico»; el plan exige explicar
  POR QUÉ (grid de 3 repetido, hero predecible, ritmo de sección por
  defecto) y PROponer alternativa concreta («floating card constellation»).
- **Coste**: bajo-medio. Mapear cada antipatrón a su receta de sustitución
  (determinista, sin modelo).

### 10. ~~Reference DNA~~ → ✅ IMPLEMENTADO en v4.5 (`reference-dna.ts`, principios ≠ píxeles; integrado en referencias.ts)

### 11. Design Confidence con evidencia (§32)
- **Qué**: panel de confianza por dimensión (visual, responsive, UX,
  originalidad, a11y, performance) mostrando la EVIDENCIA (3 QA passes,
  4 breakpoints, 0 críticos) en lugar de una nota mágica. La UI ya pinta
  evidencia de jueces; generalizarla como «Confianza».

## V4.9+ — FORJA Studio (sin cambios desde v4.6)

### 12. Selección visual + edición contextual (§34)
- **Qué**: clic sobre la maqueta → nodo del genoma → «hazla más profunda,
  sube el radius, tilt suave» → parche quirúrgico de ese nodo (con la voz
  semántica de `voz.ts` ya decidiendo densidad/espacio/jerarquía).
- **Depende de**: ideas 1 (genoma) y 4 (parches quirúrgicos) de V4.5.
- **Coste**: medio-alto. El Estudio ya tiene iframe sandbox: falta el puente
  postMessage + overlay de selección.

### 13. Visual diff entre versiones (§33)
- **Qué**: comparar v(n-1) vs v(n) en píxeles (capturas del iframe) y en
  código, con el coste en tokens de cada paso. El plan lo pide para
  el rollback con criterio.

### 14. Explain This Design (§35)
- **Qué**: cada nodo explica por qué existe (de qué decisión del ADN viene,
  qué regla de memoria lo prohibió/promovió). Determinista: el genoma guarda
  las decisiones reales; la explicación las recita. Con v4.6 el objeto 3D,
  las primitivas y el contrato ya explican su porqué en la traza.

## Eficiencia continua (transversal, el objetivo «lo más barato posible»)

### 15. ★ Presupuesto aprendido por ROI
- **Qué**: hoy el reparto por fases es fijo por complejidad (v4.4). Con el
  libro ROI acumulado, el reparto se AJUSTA con evidencia: si `jueces` tiene
  ROI ~0 en tus últimas 20 generaciones, su cupo baja; si `revisor` gana 30
  puntos/1k tok, sube.
- **Coste**: bajo. `token-roi.ts` ya produce las medias; falta el ajuste
  automático del reparto (con límites y defaults sanos).

### 16. ★ Caché L4 de patrones visuales activo
- **Qué**: cuando el anti-genérico detecta «card sin profundidad», buscar en
  L4 la RECETA conocida (patrón → snippet) en lugar de generarla. El plan
  (§24) lo describe literalmente. Hoy L4 existe pero nadie escribe en él:
  cablear `parche-det`, las primitivas compiladas v4.6 y las lecciones del
  genoma como fuentes de patrones.
- **Coste**: bajo-medio. (Las primitivas v4.6 ya son el 80% de L4 en
  espíritu: son el patrón con su snippet, servido gratis.)

### 17. Modelos por operación según ROI (§21)
- **Qué**: el plan §21 separa modelo económico/intermedio/potente. Con ROI
  medido por operación y modelo (ya se registra `modelo`), el enrutador
  asigna: clasificación/extracción → económico; composición → intermedio;
  dirección creativa → potente. El `perfiles.ts` ya tiene la maquinaria.
- **Coste**: medio (requiere 2+ proveedores configurados).

### 18. Streaming del Codificador con QA incremental
- **Qué**: `onFragmento` existe desde v3 pero no se usa en el MVP. Stream
  + chequeos estructurales ligeros por fragmento (cercados, tamaño) permite
  abortar temprano una generación que ya se sabe mala, y continuar la buena
  pagando solo la cola.
- **Coste**: medio.

### 19. Medición de COSTE REAL por proveedor
- **Qué**: el ROI v4.4 estima tokens (chars/4). Si el host reporta usage
  real del proveedor (ya lo hace el evento `exito` del adaptador vía
  `tokensSalida`), el ROI pasa de estimado a contable, y las
  recomendaciones ganan precisión.
- **Coste**: bajo: alimentar `roi.registrar()` con los tokens reales del
  evento en lugar de la estimación.

### 20. Modo «presupuesto duro» para cuotas gratuitas
- **Qué**: perfil extra donde el presupuesto NO tiene rescate de reserve y
  las fases denegadas saltan SIEMPRE (degradación máxima: sin Arena, sin
  bucle LLM, solo parches deterministas). Para routers con cuota dura.
- **Coste**: bajo. Es una política sobre `crearPresupuesto`.

## Seguridad y calidad (mantener mientras se crece)

- 21. Mantener `seguridad-web.ts` como auditoría de TODA primitiva nueva del
  catálogo: cada primitiva v4.6 ya nace con reduced-motion, foco y toques
  resueltos — gratis, en la plantilla. Las nuevas del catálogo, igual.
- 22. El genoma debe seguir prohibiendo lo confirmado: cada fallo del QA de
  una primitiva nueva se convierte en regla dura (memoria de fallos), no en
  una nota. El learning loop v4.6 le da la EVIDENCIA que faltaba.

## Orden recomendado (máximo ahorro por esfuerzo)

1. **Idea 2 de V4.7** (persistir el learning loop) + **idea 1** (panel
   «Elige la experiencia») — el taller aprende para siempre y el usuario
   gira la decisión con la mano. Ambas cierran circuitos ya montados.
2. **Idea 5 de V4.7** (presupuesto de movimiento) — extiende el QA medido.
3. **V4.5 ideas 1-4** (Page Genome + parches quirúrgicos) — el mayor ahorro
   restante por edición.
4. **Idea 15** (presupuesto aprendido) + **idea 19** (coste real) — el
   sistema afina solo, con evidencia.
5. Después: V4.8/V4.9 según el plan.

---
