# Forja IA — Implementación del Cerebro Web

## Qué se implementó en esta versión

Esta actualización no reemplaza la infraestructura existente de Forja. Añade una capa de decisión especializada encima de Web Studio, Knowledge Base, Sandbox, Visual QA, Agent Loop y el selector de modelos.

### 1. Cerebro Web
`src/lib/forja/cerebro-web.ts`

El Cerebro decide:

- tipo de tarea;
- arquitectura de página;
- dirección visual;
- estrategia de industria;
- contexto de Knowledge Base;
- fases de ejecución;
- política de herramientas;
- ciclo Preview → Visual QA → Repair → Regression.

El modelo sigue siendo el motor de razonamiento intercambiable. Forja decide qué debe hacer.

### 2. Design Architect
`src/lib/forja/design-architect.ts`

Convierte un brief corto en:

- objetivo principal;
- estructura;
- navegación;
- conversión;
- composición;
- responsive;
- interacción;
- patrones prohibidos.

No genera una plantilla HTML.

### 3. Estrategias por industria
`src/lib/forja/industry-strategies.ts`

Se incluyen estrategias para:

- restaurante;
- e-commerce;
- SaaS;
- portfolio;
- agencia;
- inmobiliaria;
- salud;
- educación;
- finanzas;
- eventos;
- servicios locales;
- contenido.

La intención es impedir que todas las webs terminen con el mismo hero + tres cards.

### 4. Vision Designer
`src/lib/forja/vision-designer.ts`

Define el contrato para convertir screenshots/referencias en:

- composición;
- jerarquía;
- espaciado;
- tipografía;
- color;
- superficies;
- interacción;
- responsive;
- mejoras.

La referencia se utiliza como fuente de principios visuales, no como plantilla para copiar identidad, textos, imágenes o código.

### 5. Recuperación selectiva de Knowledge Base
`src/lib/forja/knowledge-retrieval.ts`

La búsqueda pasa primero por metadatos y devuelve un conjunto pequeño de candidatos.

Objetivo:

`brief → índice → candidatos → ranking → contexto compacto`

No:

`brief → cargar toda la biblioteca`.

### 6. Contrato de almacenamiento
`src/lib/forja/storage-providers.ts`

Se define una interfaz común para:

- Google Drive: conocimiento, referencias, documentos, imágenes y datasets.
- MEGA: código, repositorios, componentes, templates, datasets y recetas.

Esto permite conectar los SDK reales sin que el Cerebro dependa de ellos.

### 7. Repair Agent
`src/lib/forja/repair-agent.ts`

Los hallazgos de Visual QA se convierten en acciones priorizadas.

Regla:

- corregir el archivo responsable;
- volver a ejecutar;
- volver a medir;
- no crear `fix.ts`, `patch-final.js`, etc.

### 8. Integración real en FORJA WEB
`prompt-actual.ts` y `forja-studio-dialog.tsx`

FORJA WEB ahora incorpora la decisión del Design Architect antes de que el agente escriba.

En Web Studio se eliminó la necesidad de introducir manualmente una "dirección visual": el Cerebro decide automáticamente.

## Qué NO se finge como terminado

### Google Drive OAuth universal
La arquitectura actual de Drive sigue dependiendo de la configuración OAuth de Google Cloud de la aplicación. Esta actualización no inventa credenciales ni un Client ID público que todavía no existe.

El siguiente paso real es configurar la aplicación OAuth de Forja y cambiar la pantalla BYOC por el flujo:

`Conectar Google Drive → Google → autorizar → volver a Forja`.

### MEGA
El contrato está preparado, pero no se ha fingido una sesión MEGA funcional sin integrar un SDK/protocolo real.

### Vision multimodal
El contrato de Vision Designer está implementado. El análisis visual real continúa utilizando el modelo multimodal disponible en Forja y sus herramientas existentes.

### Generación autónoma completa
El ciclo conceptual está conectado al prompt y al Repair Agent, pero la ejecución real continúa dependiendo de las herramientas existentes de Sandbox/Agent Loop/Visual QA.

## Verificación

Se añadieron tests unitarios para:

- Cerebro Web;
- detección de industria;
- Design Architect;
- Repair Agent.

El repositorio no contiene `node_modules` en el ZIP recibido, por lo que no se pudo ejecutar Vitest ni un build completo localmente sin instalar dependencias. Se ejecutó TypeScript globalmente para detectar errores; los mensajes restantes corresponden principalmente a dependencias ausentes y errores preexistentes del repositorio, no a los módulos nuevos.
