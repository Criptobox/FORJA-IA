# Forja IA 4.20 — Web Studio y Project Intelligence

## Objetivo

Llevar Forja a un flujo de desarrollo web más profundo sin duplicar las herramientas que ya existen.

### Ya existente y reutilizado

- Modo agente plan → ejecutar → revisar.
- Sandbox y vista previa.
- Visual QA real a 320/390 px.
- Regresión.
- Memoria de fallos con caducidad.
- Mapa y Project Passport.
- Router de tareas/modelos.
- Permisos por herramienta.
- Bóveda y escudo de red.
- Snapshots.
- Skills.

## Añadido en 4.20

### 1. Web Studio

`src/lib/prism/web-studio.ts` define las siete etapas y construye un prompt especializado. No afirma que una prueba haya pasado: obliga al agente a ejecutar y medir cuando la herramienta esté disponible.

### 2. Project Health

`src/lib/prism/project-health.ts` combina únicamente señales disponibles. La ausencia de datos produce `null`, no un 0/100 o 100/100 inventado.

### 3. Security Center

`src/lib/prism/security-center.ts` hace un análisis estático conservador del código visible. Es un diagnóstico, no una auditoría completa. No envía el código a ningún servicio.

### 4. Project Tasks

`src/lib/prism/project-tasks.ts` mantiene un tablero local persistente. Los hallazgos de Visual QA y Security Center pueden crear tareas para que no se pierdan.

### 5. Hub de interfaz

`src/components/prism/prism-studio-dialog.tsx` integra esas capacidades en una sola superficie accesible desde la barra lateral como **Web Studio**.

## Qué NO se duplicó

No se creó otro sistema de memoria, otro navegador, otro motor de QA, otro router ni otro sistema de snapshots. Se reutilizan las implementaciones existentes.

## Verificación

En este entorno no fue posible ejecutar la suite completa porque la instalación de `node_modules` quedó incompleta durante `npm ci` y faltan los binarios de ESLint/TypeScript. Por tanto, **no se afirma que `lint`, `build` o `test` hayan pasado**. Los nuevos tests unitarios sí fueron añadidos para que CI los ejecute en un entorno instalado correctamente.

## Próximo paso recomendado

La siguiente iteración debería conectar el tablero de tareas con el `AgentTrace` y los resultados de regresión, y después extraer más responsabilidades de `chat-app.tsx`. No conviene añadir un orquestador multiagente antes de que esa base esté estable.
