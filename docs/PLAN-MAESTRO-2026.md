# FORJA IA --- Plan Maestro 2026

## Evolución hacia un AI Web/App Studio autónomo, económico y agnóstico de modelos

**Repositorio:** https://github.com/Criptobox/FORJA-IA\
**Objetivo:** convertir FORJA IA en un sistema capaz de transformar una
idea en una página web o aplicación web funcional, visualmente
coherente, probada y publicable, utilizando modelos gratuitos y APIs de
bajo coste sin depender de un proveedor concreto.

------------------------------------------------------------------------

# 1. Decisión estratégica

## 1.1 Qué NO debe convertirse FORJA

FORJA no debe intentar competir con Kimi, Qwen, GLM, Gemini, GPT o
DeepSeek creando otro LLM generalista.

Tampoco debe convertirse en:

-   un simple chat con muchos modelos;
-   un generador de HTML;
-   una colección de funciones independientes;
-   un agregador de APIs cuyo principal valor sea mostrar modelos;
-   una herramienta que necesite una IA de pago diferente para cada
    tarea.

## 1.2 Qué debe convertirse

> **FORJA = un estudio autónomo de creación de webs y aplicaciones web
> que utiliza los mejores modelos disponibles como motores
> intercambiables.**

El modelo es el cerebro especializado de una tarea.

FORJA aporta:

-   comprensión del proyecto;
-   memoria;
-   sistema de diseño;
-   planificación;
-   dirección creativa;
-   selección de modelos;
-   ejecución;
-   sandbox;
-   preview;
-   visión/QA;
-   corrección;
-   regresión;
-   seguridad;
-   Git;
-   publicación;
-   control de costes.

La ventaja competitiva debe estar en la **orquestación completa**, no en
poseer un modelo propietario gigante.

------------------------------------------------------------------------

# 2. Punto de partida actual

El repositorio ya contiene una base importante que debe conservarse y
consolidarse.

Entre las capacidades existentes se encuentran:

-   Web Studio;
-   flujo Brief → Plan → Build → Visual QA → Fix → Regression → Publish;
-   preview web;
-   Project Health;
-   Security Center;
-   Project Tasks;
-   modo App;
-   persistencia local para las aplicaciones generadas;
-   editor visual de estilos;
-   distintos tamaños responsive;
-   auditorías SEO, rendimiento y accesibilidad;
-   motor creativo;
-   Content Plan;
-   QA contra el Content Plan;
-   radar de modelos gratuitos;
-   failover;
-   router automático de modelos;
-   circuit breaker;
-   compresión de contexto;
-   métricas locales;
-   grafo del proyecto;
-   memoria `.forja`;
-   sandbox;
-   pruebas;
-   integración con Git/GitHub.

La prioridad NO es rehacer estas piezas desde cero.

La prioridad es **integrarlas alrededor de un flujo único y coherente**.

------------------------------------------------------------------------

# 3. Nueva definición del producto

FORJA debe poder recibir algo tan sencillo como:

> "Crea una web premium para una hamburguesería junto al mar. Quiero
> menú, pedidos por WhatsApp, ubicación, horarios y una estética moderna
> relacionada con la playa."

Y convertirlo progresivamente en:

``` text
IDEA
  ↓
BRIEF
  ↓
ANÁLISIS
  ↓
DIRECCIÓN CREATIVA
  ↓
PROPUESTA VISUAL
  ↓
ARQUITECTURA
  ↓
IMPLEMENTACIÓN
  ↓
RENDER
  ↓
VISUAL QA
  ↓
CODE QA
  ↓
CORRECCIÓN
  ↓
REGRESIÓN
  ↓
PUBLICACIÓN
```

El usuario no debería tener que explicar el mismo proyecto varias veces.

------------------------------------------------------------------------

# 4. Principio central: Design First, Code Second

Una de las evoluciones más importantes será separar:

1.  qué se quiere construir;
2.  cómo debe verse;
3.  cómo se implementará.

No se debe pedir al modelo que improvise simultáneamente todo.

## Fase A --- Dirección creativa

FORJA genera una dirección visual:

-   propósito;
-   público;
-   personalidad;
-   referencias conceptuales;
-   composición;
-   estructura;
-   navegación;
-   paleta;
-   tipografía;
-   espaciado;
-   formas;
-   componentes;
-   tratamiento de imágenes;
-   movimiento;
-   responsive;
-   accesibilidad.

## Fase B --- Propuesta visual

Antes de construir toda la aplicación, FORJA debe poder presentar una
propuesta navegable.

El usuario podrá:

-   aprobar;
-   pedir cambios;
-   comparar variantes;
-   modificar dirección;
-   bloquear decisiones.

## Fase C --- Implementación

Una vez aprobada la dirección:

``` text
Design Contract
      ↓
Architecture Plan
      ↓
Code Plan
      ↓
Build
```

El código debe implementar el diseño, no inventar uno diferente.

------------------------------------------------------------------------

# 5. DESIGN.md: contrato permanente del proyecto

Cada proyecto debe tener una fuente de verdad de diseño.

Ejemplo:

``` text
.forja/
├── DESIGN.md
├── PROJECT.md
├── CONTEXT.md
├── DECISIONS.md
├── TASKS.md
├── EVIDENCE.md
├── ERRORS.md
├── REGRESSIONS.md
└── PROJECT-MAP.json
```

## DESIGN.md debe almacenar

### Identidad

-   nombre;
-   propósito;
-   personalidad;
-   tono.

### Visual

-   colores;
-   tipografías;
-   escala tipográfica;
-   spacing;
-   radios;
-   sombras;
-   bordes;
-   iconografía;
-   tratamiento de imágenes.

### Layout

-   ancho máximo;
-   grid;
-   columnas;
-   navegación;
-   comportamiento móvil.

### Motion

-   cuándo utilizar animaciones;
-   duración;
-   easing;
-   qué elementos pueden moverse;
-   qué elementos NO deben animarse.

### Componentes

-   botones;
-   cards;
-   formularios;
-   navegación;
-   modales;
-   tablas;
-   dashboards;
-   estados.

### Reglas negativas

Ejemplos:

``` text
NO usar gradientes genéricos.
NO usar glassmorphism en todo.
NO repetir la misma card en todas las secciones.
NO utilizar animaciones sin función.
NO utilizar iconos incompatibles entre sí.
NO inventar datos.
NO cambiar la identidad aprobada sin autorización.
```

------------------------------------------------------------------------

# 6. Project Brain

El proyecto debe tener una representación estructurada que permita a
FORJA entenderlo sin enviar todos los archivos al modelo.

## Project Map

Debe conocer:

-   archivos;
-   carpetas;
-   componentes;
-   rutas;
-   dependencias;
-   relaciones;
-   imports;
-   referencias;
-   APIs;
-   datos;
-   configuración;
-   entry points;
-   tests;
-   estado de build;
-   problemas conocidos.

## Regla fundamental

> **FORJA debe enviar al modelo solamente el contexto necesario para la
> tarea.**

Ejemplo:

Si el usuario dice:

> "El menú móvil no funciona."

No se envía todo el repositorio.

Se localiza:

``` text
Navbar
Menu
MobileMenu
CSS relacionado
layout
errores recientes
```

Y solo eso se entrega al agente.

------------------------------------------------------------------------

# 7. Context Engine

Construir una capa que decida automáticamente qué contexto necesita cada
tarea.

## Niveles

### L0 --- Pregunta simple

Solo conversación.

### L1 --- Archivo concreto

Archivo + contexto inmediato.

### L2 --- Componente

Componente + dependencias relacionadas.

### L3 --- Feature

Feature completa + tests + estilos + rutas.

### L4 --- Proyecto

Arquitectura completa.

### L5 --- Auditoría

Proyecto + evidencia + historial + regresiones.

Esto reduce coste y mejora precisión.

------------------------------------------------------------------------

# 8. Router de modelos económico

Este componente pasa a ser estratégico.

FORJA debe ser **agnóstico de proveedores**.

## Fuentes posibles

### Gratuitas

-   Qwen;
-   GLM;
-   Kimi;
-   Gemini;
-   OpenRouter;
-   otros proveedores con cuotas gratuitas;
-   Ollama/local cuando sea viable.

### De pago

-   DeepSeek;
-   OpenAI;
-   otros proveedores añadidos posteriormente.

No se debe asumir que una oferta gratuita será permanente.

------------------------------------------------------------------------

# 9. Modelo Router 2.0

El router no debe elegir simplemente "el mejor modelo".

Debe elegir:

> **el modelo suficientemente bueno para esta tarea al menor coste
> posible.**

## Factores

``` text
task_type
complexity
context_size
vision_required
reasoning_required
coding_required
latency
historical_success_rate
quota
provider_health
cost
user_budget
```

## Ejemplo

``` text
Tarea:
Cambiar padding de un botón.

Complejidad:
Baja.

Ruta:
Modelo gratuito rápido.
```

Otra:

``` text
Tarea:
Reestructurar arquitectura de una aplicación.

Complejidad:
Alta.

Ruta:
Modelo gratuito fuerte.
Si falla → DeepSeek.
Si sigue fallando → GPT.
```

------------------------------------------------------------------------

# 10. Presupuesto de IA

Crear un sistema explícito de presupuesto.

Ejemplo:

``` text
Presupuesto mensual: $5

Gastado:
$2.13

Disponible:
$2.87
```

## Modos

### FREE

Solo modelos gratuitos.

### ECONOMY

Gratis primero + APIs económicas.

### BALANCED

Gratis → barato → premium cuando sea necesario.

### MANUAL

El usuario decide qué modelo puede gastar dinero.

------------------------------------------------------------------------

# 11. Regla de gasto

Nunca gastar dinero sin una razón técnica.

Antes de utilizar un modelo de pago:

``` text
¿Existe modelo gratuito adecuado?
        │
       Sí
        ↓
usar gratis

       No
        ↓
¿La tarea justifica coste?
        │
      No → pedir confirmación
        │
       Sí
        ↓
usar modelo económico
```

Para tareas de bajo riesgo no se debe utilizar el modelo premium.

------------------------------------------------------------------------

# 12. Cache y ahorro de tokens

Implementar cache agresiva para:

-   análisis de archivos;
-   Project Map;
-   arquitectura;
-   Design Contract;
-   Content Plan;
-   resultados de QA;
-   explicaciones;
-   respuestas repetidas.

## No reenviar

-   archivos sin cambios;
-   contexto que no afecta a la tarea;
-   historial completo;
-   Design Contract completo si solo se necesita un token de diseño;
-   resultados de análisis que ya están vigentes.

------------------------------------------------------------------------

# 13. Task Ledger

Cada tarea debe registrar:

``` text
task_id
tipo
objetivo
archivos
modelo
tokens
coste
resultado
errores
QA
regresión
estado
```

Esto permite saber:

-   qué modelo funciona mejor;
-   cuánto cuesta cada tipo de tarea;
-   qué proveedores fallan;
-   dónde se consume presupuesto.

------------------------------------------------------------------------

# 14. Agentes especializados

No utilizar un único agente para todo.

## FORJA DIRECTOR

Responsabilidades:

-   entender la petición;
-   clasificarla;
-   dividir trabajo;
-   seleccionar agentes;
-   seleccionar modelos;
-   decidir cuándo terminar.

## FORJA DESIGNER

Responsabilidades:

-   UX;
-   UI;
-   dirección visual;
-   responsive;
-   componentes;
-   motion;
-   Design Contract.

## FORJA ARCHITECT

Responsabilidades:

-   estructura;
-   rutas;
-   componentes;
-   datos;
-   dependencias;
-   arquitectura técnica.

## FORJA BUILDER

Responsabilidades:

-   código;
-   integración;
-   componentes;
-   estilos;
-   funcionalidades.

## FORJA VISION

Responsabilidades:

-   analizar screenshots;
-   comparar diseño y resultado;
-   detectar problemas visuales.

## FORJA QA

Responsabilidades:

-   errores;
-   consola;
-   tests;
-   responsive;
-   accesibilidad;
-   SEO;
-   rendimiento.

## FORJA SECURITY

Responsabilidades:

-   secretos;
-   scripts externos;
-   XSS;
-   configuraciones peligrosas;
-   dependencias;
-   exposición accidental.

## FORJA PUBLISHER

Responsabilidades:

-   build final;
-   export;
-   Git;
-   GitHub;
-   despliegue.

------------------------------------------------------------------------

# 15. Bucle autónomo

La pieza central debe ser:

``` text
PLAN
 ↓
BUILD
 ↓
RUN
 ↓
OBSERVE
 ↓
ANALYZE
 ↓
FIX
 ↓
RUN
 ↓
QA
 ↓
REGRESSION
 ↓
DONE
```

FORJA nunca debe aceptar:

> "parece correcto"

como evidencia suficiente.

Debe utilizar resultados reales.

------------------------------------------------------------------------

# 16. Definition of Done

Una tarea puede marcarse como terminada solamente si cumple los
criterios aplicables.

``` text
[ ] Código generado
[ ] Build correcto
[ ] Sin errores críticos de consola
[ ] Preview renderizada
[ ] Responsive comprobado
[ ] Funcionalidad comprobada
[ ] Visual QA
[ ] Code QA
[ ] Seguridad básica
[ ] Regresión
[ ] Cambios documentados
```

No todas las tareas necesitan todos los pasos, pero el Director debe
decidir cuáles aplican.

------------------------------------------------------------------------

# 17. Visual QA real

Esta debe ser una prioridad.

FORJA necesita comparar:

``` text
DESIGN INTENT
      ↓
IMPLEMENTATION
      ↓
SCREENSHOT
      ↓
VISION MODEL
      ↓
DIFFERENCES
```

Detectar:

-   spacing;
-   tamaños;
-   jerarquía;
-   alineación;
-   contraste;
-   componentes faltantes;
-   overflow;
-   responsive;
-   inconsistencias;
-   diseño genérico;
-   exceso de elementos.

------------------------------------------------------------------------

# 18. Anti-genericidad

Crear un sistema medible para evitar que todas las webs terminen
pareciéndose.

Analizar:

-   repetición de layouts;
-   repetición de colores;
-   repetición de componentes;
-   patrones visuales excesivamente frecuentes;
-   uso indiscriminado de gradientes;
-   exceso de glassmorphism;
-   héroes idénticos;
-   cards repetitivas;
-   tipografías sin personalidad.

La IA puede usar referencias, pero no debe copiar ciegamente una
plantilla.

------------------------------------------------------------------------

# 19. Creative Freedom con límites

FORJA no debe convertirse en un generador rígido.

El sistema debe establecer:

``` text
PROJECT RULES
      +
DESIGN CONTRACT
      +
USER INTENT
      ↓
CREATIVE SPACE
```

Dentro de ese espacio el modelo puede proponer soluciones nuevas.

------------------------------------------------------------------------

# 20. Content Plan

Antes de construir una página, extraer:

-   negocio;
-   nombre;
-   ubicación;
-   servicios;
-   productos;
-   precios;
-   horarios;
-   contactos;
-   llamadas a la acción;
-   secciones necesarias.

Separar:

### Datos confirmados

### Datos proporcionados por el usuario

### Datos inferidos

### Datos faltantes

### Datos que jamás deben inventarse

------------------------------------------------------------------------

# 21. Sistema anti-alucinación

Toda información debe tener estado:

``` text
CONFIRMED
USER_PROVIDED
DISCOVERED
INFERRED
UNKNOWN
```

Si un dato no existe:

> NO INVENTAR.

Ejemplo:

Si el usuario no proporciona un teléfono:

``` text
Teléfono: pendiente
```

No:

``` text
+1 555...
```

------------------------------------------------------------------------

# 22. Safe Sandbox

Toda modificación generada por IA debe pasar por un entorno seguro antes
de considerarse válida.

Flujo:

``` text
PATCH
 ↓
APPLY
 ↓
BUILD
 ↓
RUN
 ↓
TEST
 ↓
CAPTURE
 ↓
QA
```

Si falla:

``` text
ROLLBACK
```

------------------------------------------------------------------------

# 23. Git como sistema de seguridad

Cada ciclo importante debe generar:

-   snapshot;
-   diff;
-   resumen;
-   posibilidad de rollback.

Antes de cambios grandes:

``` text
CHECKPOINT
```

Después:

``` text
REGRESSION CHECK
```

------------------------------------------------------------------------

# 24. GitHub

Mantener GitHub como una capacidad, no como requisito.

FORJA debe poder:

-   importar repositorio;
-   analizarlo;
-   crear cambios;
-   mostrar diff;
-   crear commit;
-   crear branch;
-   publicar;
-   trabajar sin GitHub cuando el proyecto sea local.

------------------------------------------------------------------------

# 25. MCP / herramientas externas

Diseñar un sistema de herramientas desacoplado.

Ejemplos:

``` text
filesystem
browser
github
git
image
search
terminal
preview
vision
deployment
```

Los modelos no deben tener acceso directo e ilimitado.

FORJA decide:

``` text
modelo → tool request → permission layer → tool → result
```

Esto permite cambiar de modelo sin cambiar el sistema de herramientas.

------------------------------------------------------------------------

# 26. Multi-modelo real

No limitarse a:

``` text
modelo A responde
```

Permitir:

``` text
Planner
   ↓
Designer
   ↓
Builder
   ↓
Vision
   ↓
QA
```

Cada etapa puede utilizar un modelo diferente.

Incluso:

``` text
Designer A
Designer B
   ↓
Judge
```

para comparar propuestas cuando sea necesario.

No ejecutar múltiples modelos siempre: hacerlo solo cuando el beneficio
justifique el coste.

------------------------------------------------------------------------

# 27. Modelo local

No es prioridad entrenar un modelo propio.

Sí es prioridad preparar soporte para modelos locales.

Objetivos:

-   Ollama;
-   modelos pequeños de coding;
-   modelos de visión locales cuando sea posible;
-   modelos especializados.

El modelo local debe servir especialmente para:

-   tareas sencillas;
-   clasificación;
-   resumen;
-   extracción;
-   análisis;
-   pequeñas correcciones;
-   tareas privadas.

------------------------------------------------------------------------

# 28. No intentar entrenar un LLM propio todavía

Entrenar un modelo competitivo desde cero requiere:

-   enormes cantidades de datos;
-   infraestructura;
-   GPUs;
-   entrenamiento;
-   evaluación;
-   alineación;
-   mantenimiento.

No es el cuello de botella de FORJA.

La inteligencia diferencial debe estar inicialmente en:

``` text
orquestación
+
memoria
+
contexto
+
diseño
+
ejecución
+
QA
```

------------------------------------------------------------------------

# 29. FORJA Brain

El "cerebro" de FORJA será la combinación de:

``` text
Intent Engine
+
Project Map
+
Memory
+
Design Contract
+
Task Planner
+
Model Router
+
Agent Orchestrator
+
Tool Router
+
Sandbox
+
Vision QA
+
Code QA
+
Regression Engine
```

No necesita ser un único modelo.

------------------------------------------------------------------------

# 30. Arquitectura objetivo

``` text
                         USER
                           │
                           ▼
                    ┌─────────────┐
                    │ FORJA UI    │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ DIRECTOR    │
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
        DESIGNER       ARCHITECT        BUILDER
            │              │              │
            └──────────────┼──────────────┘
                           ▼
                    MODEL ROUTER
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
       FREE MODEL      CHEAP API       PREMIUM API
          │                │                │
          └────────────────┼────────────────┘
                           ▼
                      TOOL ROUTER
                           │
      ┌────────────┬───────┼────────┬──────────┐
      ▼            ▼       ▼        ▼          ▼
   Filesystem    Git     Browser  Sandbox    Vision
                           │
                           ▼
                        BUILD
                           │
                           ▼
                     VISUAL QA
                           │
                           ▼
                       CODE QA
                           │
                           ▼
                      REGRESSION
                           │
                    ┌──────┴──────┐
                    │             │
                  FAIL          PASS
                    │             │
                    ▼             ▼
                   FIX          DONE
                                  │
                                  ▼
                               PUBLISH
```

------------------------------------------------------------------------

# 31. Roadmap de implementación

## Fase 0 --- Auditoría y limpieza

Objetivo:

> convertir el proyecto existente en una base estable.

### Tareas

-   [ ] Inventariar módulos.
-   [ ] Detectar funciones duplicadas.
-   [ ] Detectar código muerto.
-   [ ] Detectar funciones desconectadas de la UI.
-   [ ] Unificar nomenclatura.
-   [ ] Revisar documentación.
-   [ ] Unificar versión.
-   [ ] Revisar README.
-   [ ] Revisar tests.
-   [ ] Crear arquitectura oficial.
-   [ ] Definir fuente única de verdad.

### Resultado

FORJA tiene una arquitectura documentada y medible.

------------------------------------------------------------------------

# 32. Fase 1 --- Design System Engine

### Construir

-   [ ] DESIGN.md.
-   [ ] parser de DESIGN.md.
-   [ ] Design Contract.
-   [ ] tokens.
-   [ ] reglas positivas.
-   [ ] reglas negativas.
-   [ ] componentes.
-   [ ] motion rules.
-   [ ] responsive rules.
-   [ ] validación del contrato.

### Resultado

Toda IA trabaja bajo la misma identidad visual.

------------------------------------------------------------------------

# 33. Fase 2 --- Project Brain

### Construir

-   [ ] Project Map.
-   [ ] dependency graph.
-   [ ] file importance ranking.
-   [ ] context selector.
-   [ ] changed-files detector.
-   [ ] relevant-files retrieval.
-   [ ] evidence index.
-   [ ] task memory.
-   [ ] decision memory.

### Resultado

FORJA deja de enviar contexto innecesario.

------------------------------------------------------------------------

# 34. Fase 3 --- Model Router 2.0

### Construir

-   [ ] registro de modelos.
-   [ ] capacidades por modelo.
-   [ ] health.
-   [ ] cooldown.
-   [ ] quota.
-   [ ] coste.
-   [ ] latencia.
-   [ ] contexto máximo.
-   [ ] visión.
-   \[coding.
-   [ ] reasoning.
-   [ ] scoring interno.
-   [ ] fallback.
-   [ ] budget manager.

### Resultado

FORJA puede funcionar con \$0 y mejorar cuando haya presupuesto.

------------------------------------------------------------------------

# 35. Fase 4 --- Budget Engine

### Construir

-   [ ] presupuesto mensual.
-   [ ] límite diario.
-   [ ] coste por tarea.
-   [ ] coste por modelo.
-   [ ] alertas.
-   [ ] confirmación antes de gastar.
-   [ ] modo económico.
-   [ ] modo gratuito.
-   [ ] historial de consumo.

### Regla

Nunca consumir un modelo caro para una tarea que puede resolver un
modelo gratuito adecuado.

------------------------------------------------------------------------

# 36. Fase 5 --- Design First

### Construir

-   [ ] brief parser.
-   [ ] design brief.
-   [ ] dirección visual.
-   [ ] wireframe.
-   [ ] propuesta visual.
-   [ ] variantes.
-   [ ] aprobación.
-   [ ] Design Contract.

### Resultado

La IA diseña antes de codificar.

------------------------------------------------------------------------

# 37. Fase 6 --- Builder Agent

### Construir

-   [ ] architecture planner.
-   [ ] code planner.
-   [ ] patch generator.
-   [ ] file dependency awareness.
-   [ ] incremental build.
-   [ ] safe patching.
-   [ ] rollback.

### Resultado

El Builder deja de improvisar modificaciones grandes.

------------------------------------------------------------------------

# 38. Fase 7 --- Vision QA

### Construir

-   [ ] screenshot capture.
-   [ ] responsive screenshots.
-   [ ] design-vs-render comparison.
-   [ ] issue extraction.
-   [ ] severity.
-   [ ] auto-fix loop.

### Resultado

FORJA puede "ver" la web que construyó.

------------------------------------------------------------------------

# 39. Fase 8 --- Autonomous Loop

### Construir

``` text
PLAN
BUILD
RUN
OBSERVE
FIX
QA
REGRESSION
```

### Añadir

-   [ ] límite de iteraciones;
-   [ ] detección de ciclos;
-   [ ] rollback;
-   [ ] stop conditions;
-   [ ] evidence log.

### Resultado

FORJA puede trabajar durante múltiples pasos sin que el usuario tenga
que dirigir cada acción.

------------------------------------------------------------------------

# 40. Fase 9 --- App Studio

Profundizar el modo App.

Debe soportar:

-   dashboards;
-   CRM;
-   inventario;
-   reservas;
-   ecommerce;
-   gestores;
-   formularios;
-   autenticación cuando la infraestructura lo permita;
-   CRUD;
-   estados;
-   datos;
-   import/export;
-   responsive;
-   PWA.

No tratar todas las apps como páginas estáticas.

------------------------------------------------------------------------

# 41. Fase 10 --- Publishing Engine

### Soportar

-   export ZIP;
-   GitHub;
-   GitHub Pages;
-   Vercel/Netlify cuando proceda;
-   configuración de build;
-   variables de entorno;
-   checks antes de publicar.

### Pre-publicación

``` text
BUILD
↓
TEST
↓
SECURITY
↓
SEO
↓
ACCESSIBILITY
↓
PERFORMANCE
↓
REGRESSION
↓
PUBLISH
```

------------------------------------------------------------------------

# 42. Fase 11 --- Mobile First

Como parte de la experiencia del usuario:

-   UI usable desde teléfono;
-   preview responsive;
-   edición táctil;
-   import/export sencillo;
-   configuración de API;
-   control de presupuesto;
-   logs;
-   gestión de proyectos.

No sacrificar la potencia del sistema por intentar hacer toda la
interfaz móvil.

------------------------------------------------------------------------

# 43. Fase 12 --- Marketplace interno de Skills

Las skills deben ser módulos especializados.

Ejemplos:

``` text
skill-web-design
skill-react
skill-nextjs
skill-ecommerce
skill-dashboard
skill-landing-page
skill-pwa
skill-accessibility
skill-performance
skill-seo
skill-security
skill-animation
```

Las skills deben declararse mediante capacidades y no obligar al usuario
a configurar manualmente el sistema.

FORJA decide cuándo utilizarlas.

------------------------------------------------------------------------

# 44. Skill Verification

Toda skill debe indicar:

``` text
name
version
capabilities
inputs
outputs
tools
model requirements
validation
```

Y pasar tests antes de ser utilizada.

------------------------------------------------------------------------

# 45. Sistema de evaluación

Crear un conjunto fijo de proyectos de prueba.

## Benchmark Web

Ejemplos:

1.  landing de restaurante;
2.  ecommerce;
3.  dashboard;
4.  CRM;
5.  portfolio;
6.  SaaS;
7.  PWA;
8.  app de inventario;
9.  app de reservas;
10. sitio editorial.

Medir:

-   calidad visual;
-   funcionalidad;
-   errores;
-   responsive;
-   accesibilidad;
-   SEO;
-   rendimiento;
-   número de iteraciones;
-   coste;
-   tiempo.

------------------------------------------------------------------------

# 46. Benchmark de modelos

FORJA debe poder descubrir qué modelo funciona mejor para cada tipo de
tarea mediante evidencia.

Ejemplo:

``` text
TASK: React debugging

Model A
success: 82%
cost: low
latency: 4.2s

Model B
success: 91%
cost: medium
latency: 8.7s

Model C
success: 87%
cost: free
latency: 5.1s
```

El router utiliza estos datos para mejorar sus decisiones.

No depender únicamente de rankings externos.

------------------------------------------------------------------------

# 47. Sistema de aprendizaje del router

El router debe aprender localmente:

``` text
task
→ model
→ result
→ QA
→ success/failure
→ latency
→ cost
```

Después:

``` text
MODEL SCORE FOR TASK TYPE
```

Esto no requiere entrenar un LLM.

Es aprendizaje operativo basado en evidencia.

------------------------------------------------------------------------

# 48. Observabilidad

Crear un panel interno:

``` text
Tasks
Models
Cost
Failures
QA
Builds
Regressions
Latency
```

Permitir responder:

-   ¿Qué modelo falla más?
-   ¿Qué tarea cuesta más?
-   ¿Cuándo se usa DeepSeek?
-   ¿Cuánto se ahorra usando modelos gratuitos?
-   ¿Cuántas iteraciones necesita una web?
-   ¿Qué tipo de error aparece más?

------------------------------------------------------------------------

# 49. Privacidad

Mantener como principio:

-   sin cuenta obligatoria;
-   claves almacenadas localmente cuando sea viable;
-   PII shield;
-   secretos nunca enviados innecesariamente;
-   logs locales;
-   permisos de herramientas;
-   sandbox;
-   confirmación de acciones peligrosas.

Nunca mandar un proyecto completo a un proveedor si solo necesita dos
archivos.

------------------------------------------------------------------------

# 50. Seguridad de herramientas

Crear permisos:

``` text
READ
WRITE
EXECUTE
NETWORK
GIT
DEPLOY
```

Una tarea puede requerir:

``` text
READ + WRITE
```

pero no:

``` text
DEPLOY
```

El Director debe solicitar permisos adicionales cuando sean necesarios.

------------------------------------------------------------------------

# 51. Sistema de interrupción

El usuario siempre debe poder:

-   pausar;
-   cancelar;
-   revertir;
-   inspeccionar;
-   cambiar modelo;
-   cambiar presupuesto;
-   modificar el objetivo.

La autonomía no debe significar perder control.

------------------------------------------------------------------------

# 52. UX final

La pantalla principal ideal debe sentirse como un estudio:

``` text
┌──────────────────────────────────────┐
│ FORJA                         ● Ready │
├──────────────────────────────────────┤
│                                      │
│       PREVIEW / CANVAS               │
│                                      │
│                                      │
├──────────────────────────────────────┤
│ AI WORKSPACE                         │
│                                      │
│ "Quiero..."                          │
│                                      │
├──────────────────────────────────────┤
│ Design  Build  QA  Files  Git  Map   │
└──────────────────────────────────────┘
```

El usuario no necesita saber qué agente está trabajando.

Pero puede abrir el panel avanzado y verlo.

------------------------------------------------------------------------

# 53. Estados del Director

El sistema debe comunicar claramente:

``` text
THINKING
PLANNING
DESIGNING
BUILDING
RUNNING
INSPECTING
FIXING
TESTING
PUBLISHING
DONE
```

Cada estado debe representar una acción real.

No utilizar animaciones decorativas sin información.

------------------------------------------------------------------------

# 54. Qué funciones deben dejar de ser prioridad

No eliminar automáticamente.

Pero sí bajar prioridad a:

-   funciones de chat genéricas;
-   agregadores sin relación con Web Studio;
-   funciones multimedia que no ayuden al objetivo;
-   características que no tengan integración con el flujo de creación;
-   duplicados;
-   opciones que compliquen la UX sin aportar capacidad.

La regla:

> Si una función no ayuda a diseñar, construir, probar, corregir o
> publicar software web, debe justificar claramente por qué pertenece a
> FORJA.

------------------------------------------------------------------------

# 55. Qué NO hacer durante el desarrollo

No:

-   rehacer todo desde cero;
-   cambiar el nombre continuamente;
-   cambiar arquitectura por moda;
-   agregar modelos solo porque aparecieron;
-   añadir funciones sin tests;
-   confiar en demos sin ejecutar;
-   marcar tareas como terminadas sin evidencia;
-   inventar capacidades;
-   introducir dependencias innecesarias;
-   convertir cada nuevo proveedor en una integración especial.

------------------------------------------------------------------------

# 56. Estrategia de presupuesto recomendada

Objetivo inicial:

## \$0

FORJA debe ser funcional utilizando modelos gratuitos.

## \~\$5

Añadir DeepSeek como capacidad de refuerzo.

Usarlo para:

-   tareas complejas;
-   debugging difícil;
-   arquitectura;
-   fallback;
-   tareas donde los modelos gratuitos fallen.

## \~\$8

Si se utiliza ChatGPT Go, tratarlo como herramienta externa para el
desarrollo y trabajo del usuario, no como requisito técnico de FORJA.

Importante:

> La suscripción de ChatGPT y las APIs son sistemas de facturación
> diferentes.

FORJA debe funcionar aunque el usuario no tenga ninguna suscripción de
ChatGPT.

------------------------------------------------------------------------

# 57. Arquitectura de costes

``` text
                 TASK
                   │
                   ▼
              CLASSIFIER
                   │
                   ▼
             FREE MODEL?
              /       \
            YES        NO
             │          │
             ▼          ▼
           RUN      CHEAP API?
                       /   \
                     YES    NO
                      │      │
                      ▼      ▼
                  DEEPSEEK  PREMIUM
```

Pero además:

``` text
Si FREE_MODEL tiene alta probabilidad de éxito
→ usar FREE

Si tarea crítica y FREE_MODEL tiene baja probabilidad
→ usar económico

Si económico falla
→ escalar

Nunca escalar automáticamente sin límite.
```

------------------------------------------------------------------------

# 58. Presupuesto de seguridad

Configurable:

``` text
MONTHLY_LIMIT = $5
DAILY_LIMIT = $1
TASK_LIMIT = $0.50
```

Si se alcanza:

``` text
FORJA → FREE ONLY
```

El sistema nunca debe superar automáticamente el límite.

------------------------------------------------------------------------

# 59. Arquitectura de proveedores

Crear una interfaz única:

``` ts
interface ModelProvider {
  id: string
  listModels(): Promise<Model[]>
  generate(request: GenerateRequest): Promise<GenerateResponse>
  supports(capability: Capability): boolean
  estimateCost(request: GenerateRequest): CostEstimate
}
```

Cada proveedor implementa el mismo contrato.

Así:

``` text
DeepSeekProvider
GeminiProvider
OpenAIProvider
OpenRouterProvider
OllamaProvider
KimiProvider
GLMProvider
QwenProvider
```

pueden cambiar sin afectar al resto del sistema.

------------------------------------------------------------------------

# 60. Capabilities

No seleccionar modelos únicamente por nombre.

Usar capacidades:

``` text
TEXT
CODING
REASONING
VISION
LONG_CONTEXT
FAST
TOOL_USE
JSON
STRUCTURED_OUTPUT
LOCAL
FREE
CHEAP
```

Ejemplo:

``` text
task = visual_debugging

required:
VISION
CODING
REASONING

preferred:
FAST
LOW_COST
```

El router encuentra candidatos.

------------------------------------------------------------------------

# 61. Fallback inteligente

No hacer:

``` text
A falla → B
B falla → C
C falla → D
```

sin analizar el motivo.

Diferenciar:

``` text
429 → quota
5xx → provider failure
timeout → retry/fallback
invalid response → model failure
tool failure → tool problem
bad output → quality failure
```

Un error de modelo no debe tratarse igual que un error del navegador.

------------------------------------------------------------------------

# 62. Quality Gate

Antes de aceptar una respuesta del modelo:

``` text
schema valid?
code valid?
files valid?
no destructive changes?
build?
tests?
```

Si falla:

``` text
REJECT
```

No simplemente mostrar el resultado.

------------------------------------------------------------------------

# 63. Patch-based editing

Evitar que el modelo reescriba archivos completos cuando solo necesita
cambiar una parte.

Preferir:

``` text
PATCH
```

sobre:

``` text
REPLACE WHOLE FILE
```

Ventajas:

-   menos tokens;
-   menos errores;
-   menor riesgo;
-   mejores diffs;
-   rollback sencillo.

------------------------------------------------------------------------

# 64. Large task decomposition

Una petición grande:

> "Hazme una aplicación de reservas completa."

debe dividirse:

``` text
1. Requirements
2. Data model
3. Architecture
4. Design
5. Navigation
6. Core UI
7. Data layer
8. Features
9. Validation
10. Responsive
11. QA
12. Security
13. Performance
14. Publish
```

Cada etapa debe tener estado.

------------------------------------------------------------------------

# 65. Recuperación de errores

Si una tarea falla:

### Intento 1

Corregir con el mismo modelo.

### Intento 2

Reducir contexto / aislar problema.

### Intento 3

Cambiar modelo.

### Intento 4

Rollback y replantear.

### Intento 5

Solicitar intervención del usuario.

No entrar en loops infinitos.

------------------------------------------------------------------------

# 66. Human-in-the-loop

El usuario debe aprobar:

-   cambios destructivos;
-   despliegues;
-   uso de presupuesto elevado;
-   permisos nuevos;
-   modificaciones críticas;
-   acciones externas.

Puede activar:

``` text
AUTO MODE
```

para tareas seguras.

------------------------------------------------------------------------

# 67. Modo AUTO

Cuando se activa:

``` text
User request
 ↓
FORJA
 ↓
plan
 ↓
execute
 ↓
QA
 ↓
fix
 ↓
done
```

El usuario recibe un resumen:

``` text
✓ 14 archivos modificados
✓ build correcto
✓ 0 errores críticos
✓ responsive OK
✓ 3 problemas corregidos
✓ coste: $0.18
```

------------------------------------------------------------------------

# 68. Modo MANUAL

Para usuarios avanzados:

``` text
Plan
Files
Model
Tools
Diff
Terminal
QA
```

El usuario puede controlar cada etapa.

------------------------------------------------------------------------

# 69. Documentación obligatoria

Crear:

``` text
docs/
├── ARCHITECTURE.md
├── DESIGN-SYSTEM.md
├── MODEL-ROUTER.md
├── AGENTS.md
├── TOOLS.md
├── SANDBOX.md
├── QA.md
├── VISION-QA.md
├── SECURITY.md
├── COST-CONTROL.md
├── PROJECT-BRAIN.md
├── SKILLS.md
└── ROADMAP.md
```

------------------------------------------------------------------------

# 70. Tests

Mantener tres niveles.

## Unit

Funciones individuales.

## Integration

Agentes + router + sandbox + memoria.

## E2E

Usuario → proyecto → web terminada.

------------------------------------------------------------------------

# 71. Golden Projects

Mantener proyectos de referencia que nunca deben romperse.

Cada release ejecuta:

``` text
CREATE
BUILD
RUN
QA
REGRESSION
```

Si un cambio rompe uno:

``` text
RELEASE BLOCKED
```

------------------------------------------------------------------------

# 72. Release gates

Ninguna versión importante se publica si:

-   falla build;
-   fallan tests críticos;
-   se rompe Web Studio;
-   se rompe preview;
-   se rompe Project Map;
-   se rompe router;
-   hay regresiones críticas;
-   documentación principal queda desactualizada.

------------------------------------------------------------------------

# 73. Versionado

Establecer una única fuente de versión.

Ejemplo:

``` text
package.json
     ↓
VERSION
     ↓
CHANGELOG
     ↓
README
     ↓
UI
```

Nunca permitir que README y aplicación anuncien versiones diferentes.

------------------------------------------------------------------------

# 74. Roadmap resumido

## Etapa A --- Fundación

``` text
Auditoría
Arquitectura
Versionado
Tests
Docs
```

## Etapa B --- Cerebro

``` text
Project Brain
Context Engine
Design Contract
Memory
```

## Etapa C --- Inteligencia económica

``` text
Model Router
Budget Engine
Provider abstraction
Cache
Fallback
```

## Etapa D --- Creación

``` text
Design First
Designer
Architect
Builder
```

## Etapa E --- Verificación

``` text
Sandbox
Vision QA
Code QA
Security
Regression
```

## Etapa F --- Autonomía

``` text
Director
Agent orchestration
Autonomous loop
Recovery
```

## Etapa G --- Producto

``` text
App Studio
GitHub
Publishing
Mobile UX
```

------------------------------------------------------------------------

# 75. Orden exacto recomendado de trabajo

No implementar todo simultáneamente.

## Sprint 1

-   auditoría;
-   arquitectura;
-   limpieza;
-   versionado;
-   tests críticos.

## Sprint 2

-   Project Brain;
-   Context Engine;
-   DESIGN.md.

## Sprint 3

-   Model Provider abstraction;
-   Model Router 2.0;
-   Budget Engine.

## Sprint 4

-   Design First;
-   propuesta visual;
-   Design Contract.

## Sprint 5

-   Builder;
-   patch system;
-   safe execution.

## Sprint 6

-   Vision QA;
-   Code QA;
-   responsive QA.

## Sprint 7

-   Autonomous Loop;
-   recovery;
-   regression.

## Sprint 8

-   Publishing;
-   GitHub;
-   export;
-   deployment.

## Sprint 9

-   Benchmark;
-   optimización;
-   coste;
-   rendimiento.

## Sprint 10

-   pulido;
-   UX;
-   documentación;
-   release estable.

------------------------------------------------------------------------

# 76. Criterio para decidir si una nueva tecnología entra

Antes de agregar algo:

``` text
¿Mejora la creación web?
¿Reduce coste?
¿Reduce errores?
¿Mejora autonomía?
¿Mejora QA?
¿Mejora diseño?
¿Mejora privacidad?
¿Puede integrarse sin acoplar todo el proyecto?
```

Si la respuesta es no a todas:

> No añadir.

------------------------------------------------------------------------

# 77. Principio fundamental de modelos

FORJA no debe decir:

> "Somos una plataforma de Kimi."

Ni:

> "Somos una plataforma de DeepSeek."

Debe decir:

> **"FORJA utiliza el modelo adecuado para cada trabajo."**

Esto protege el proyecto frente a cambios de precios, límites y nuevos
modelos.

------------------------------------------------------------------------

# 78. Objetivo final

El usuario debería poder decir:

> "Construye una aplicación web para gestionar mi tienda."

Y FORJA debería encargarse de:

``` text
ENTENDER
   ↓
PREGUNTAR SOLO LO NECESARIO
   ↓
INVESTIGAR CUANDO TENGA HERRAMIENTAS
   ↓
DISEÑAR
   ↓
PROPONER
   ↓
IMPLEMENTAR
   ↓
EJECUTAR
   ↓
VER
   ↓
DETECTAR ERRORES
   ↓
CORREGIR
   ↓
PROBAR
   ↓
MEJORAR
   ↓
PUBLICAR
```

El usuario no debería tener que convertirse en el "orquestador humano"
de cinco IAs.

**FORJA debe ser el orquestador.**

------------------------------------------------------------------------

# 79. La estrategia de bajo presupuesto

La filosofía económica definitiva:

``` text
             FORJA
                │
        ┌───────┴───────┐
        │               │
      FREE            PAID
        │               │
 Qwen / GLM /      DeepSeek
 Kimi / Gemini       ↓
        │          GPT si
        │        realmente
        │         hace falta
        └───────┬───────┘
                ↓
           MODEL ROUTER
                ↓
           BEST/CHEAPEST
                ↓
              TASK
```

Objetivo:

> **No pagar por inteligencia que se puede obtener gratis.**

------------------------------------------------------------------------

# 80. Resultado que debe alcanzar FORJA

Al final de este plan, FORJA debe poder competir por **flujo de
trabajo**, no por tamaño de modelo.

El producto final debe ser:

### Un AI Web/App Studio que:

-   entiende proyectos existentes;
-   crea proyectos desde cero;
-   diseña antes de programar;
-   mantiene identidad visual;
-   utiliza múltiples modelos;
-   funciona con presupuesto cero;
-   puede utilizar APIs económicas;
-   cambia automáticamente de proveedor;
-   conserva memoria;
-   conoce el proyecto;
-   ejecuta código;
-   ve el resultado;
-   prueba lo que construye;
-   corrige sus errores;
-   evita inventar datos;
-   protege archivos;
-   mantiene snapshots;
-   hace regresión;
-   publica;
-   permite control humano;
-   y mejora sus decisiones de routing mediante evidencia.

------------------------------------------------------------------------

# 81. Prioridad absoluta

Si hubiera que reducir todo el proyecto a las **10 cosas más
importantes**, serían:

1.  **Project Brain**
2.  **Design Contract / DESIGN.md**
3.  **Model Router económico**
4.  **Context Engine**
5.  **Design First**
6.  **Builder Agent**
7.  **Sandbox**
8.  **Vision + Code QA**
9.  **Autonomous Fix Loop**
10. **Regression + Publish**

Todo lo demás debe quedar por debajo de estas prioridades.

------------------------------------------------------------------------

# 82. Mantra del proyecto

> **El modelo piensa.\
> FORJA organiza.\
> El sandbox ejecuta.\
> Vision observa.\
> QA verifica.\
> Regression protege.\
> El usuario decide.**

------------------------------------------------------------------------

# 83. Primera misión después de este documento

No empezar inmediatamente a programar 50 funciones.

Primero:

``` text
1. Auditar FORJA actual.
2. Crear matriz:
   KEEP / IMPROVE / MERGE / REWRITE / REMOVE.
3. Dibujar arquitectura actual.
4. Dibujar arquitectura objetivo.
5. Detectar duplicados.
6. Detectar piezas desconectadas.
7. Definir interfaces.
8. Crear DESIGN.md para FORJA.
9. Definir ModelProvider.
10. Definir ModelRouter.
11. Definir Task schema.
12. Definir Agent schema.
13. Definir Evidence schema.
14. Definir QA gates.
15. Solo entonces comenzar implementación.
```

**No borrar funcionalidades existentes hasta demostrar que están
cubiertas por una alternativa mejor.**

------------------------------------------------------------------------

# 84. Visión final

FORJA no necesita tener la IA más grande.

Necesita ser capaz de decir:

> **"Tengo acceso a varios cerebros. Sé cuál usar, sé qué información
> darle, sé qué herramientas puede utilizar, sé cómo comprobar su
> trabajo y sé cuándo el resultado realmente está terminado."**

Ese es el siguiente nivel de FORJA.
