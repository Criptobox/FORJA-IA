# Estudio de diseño (tipo Stitch) — revisión y plan

Objetivo: un estudio de diseño al estilo de Google Stitch / Claude Design, pero
a nuestra medida: proyectos con varias pantallas, un visor cómodo, biblioteca,
descargas y modelos gratis con reparto automático de claves.

## 1. Qué hay ya (revisión del código, rama `main` dcd4a83)

| Pieza | Dónde | Estado |
|---|---|---|
| Página `/forja` («El Estudio») | `src/app/forja/page.tsx` | **Catálogo técnico** del motor: pestañas Ficha→Maqueta, ADN 2.0, Jueces, Anti-genérico y Motor. Útil para ver el motor, no es un flujo de diseño para el usuario. |
| Lienzo tipo Stitch | `src/lib/forja/motor/canvas.ts` | **Solo lógica, sin interfaz.** Máquina de estados (esperando → direcciones → canvas → iterar/comparar → código → exportado), steering semántico («hazlo más exclusivo»), versiones y comparación. Ninguna pantalla lo usa. |
| Adaptador OpenDesign | `src/lib/forja/motor/adapter-opendesign.ts` | Contrato FORJA decide → runtime ejecuta → FORJA evalúa. `RuntimeLocal` compone HTML de forma determinista; aún no hay runtime con modelo real enchufado. |
| Direcciones visuales | `src/lib/forja/design-directions.ts` | 5 direcciones curadas (OKLCH, tipografías, radios), checklist anti-slop, `DESIGN.md`. Ya lo usan `design-architect.ts` y `marketing.ts`. |
| Vista previa | `src/components/forja/preview-panel.tsx` | Escritorio / tablet 768 / móvil 390 / móvil 320, editor de estilos, auditoría, descarga HTML y ZIP. **Una página cada vez.** |
| Modelos gratis | `free-models.ts`, `free-radar.ts`, modo Auto | Router con failover y enfriamiento, compresión de contexto. |
| Drive / Mega | `gdrive-*.ts`, `mega-*` | Selector de Drive y base de conocimiento. |

Conclusión: **casi todo el cerebro existe**. Lo que falta es la **experiencia
de estudio**: el proyecto como conjunto de pantallas y un lienzo donde verlas,
compararlas y descargarlas.

## 2. Qué construir (por fases)

### Fase 1 — Proyecto con varias pantallas + lienzo
- Modelo de datos `ProyectoDiseno`: nombre, sistema de diseño (dirección +
  tokens `:root`), lista de pantallas (`id`, nombre, HTML, versión, nota del
  revisor), referencias.
- Nueva vista **Estudio** (reemplaza el catálogo como portada de `/forja`; el
  catálogo técnico pasa a una pestaña «Motor»):
  - Izquierda: pantallas del proyecto + «Añadir pantalla».
  - Centro: **lienzo** con todas las pantallas en marcos de dispositivo
    (móvil / tablet / escritorio), zoom y pan; clic → pantalla completa.
  - Derecha: crítica (jueces + anti-genérico, ya existentes).
  - Pie: Iterar · Variantes · Comparar · Código · Exportar (contrato de
    `canvas.ts`).
- Generación: el sistema de diseño se fija **una vez** por proyecto y viaja en
  cada pantalla para que sean coherentes.

### Fase 2 — Visor y descargas
- Comparar dos versiones o variantes lado a lado.
- Exportar: HTML por pantalla, ZIP del proyecto, PNG de cada pantalla,
  `DESIGN.md` + `tokens.css`.

### Fase 3 — Biblioteca
- Proyectos, referencias (imágenes con paleta), capturas y archivos de Drive en
  un solo sitio; elegir uno o varios como base del siguiente pedido.

### Fase 4 — Skills de OpenDesign (MIT) con modelos gratis
- Comprobar que las skills funcionan con modelos gratis (prompts cortos) y
  conectar el runtime del adaptador a un modelo real.

### Fase 5 — Mejora continua
- Memoria de gustos (aprobado/descartado → ejemplos), revisor que corrige
  antes de mostrar, modo autónomo «objetivo → N pantallas».

## Estado
- **Fase 5 hecha** (ahorro de tokens como regla):
  - **Prompt compacto** (`direccionCompacta` en `estudio/prompts.ts`): la misma dirección del chat sin repetir la paleta (ya va en los tokens CSS), con los efectos en sintaxis y sin la lista de repaso (la mide la crítica). El bloque de dirección baja de ~3.600 a ~1.300-1.650 caracteres, y el system prompt de cada pantalla de ~5.100 a menos de 3.200.
  - **Memoria de gustos** (`estudio/gustos.ts`): 👍/👎 en cada versión. Se sacan del HTML, sin modelo, unos 15 rasgos medibles (esquinas, sombras, degradados, densidad, titulares, barra inferior…). Con 2 votos o más, lo que se repite viaja en UNA línea del pedido (≤ 260 caracteres). Se ven y se olvidan en la portada del Estudio.
  - **Revisor antes de mostrar** (`estudio/revisor.ts`): la crítica determinista decide. Solo si hay patrones incumplidos o aspecto de plantilla, UNA corrección con ≤ 4 problemas (versión «Revisión automática»). Nunca revisa una corrección, así que no hay bucles. Se apaga por proyecto.
  - **Modo autónomo** «Hazlo todo»: objetivo → 3-6 pantallas exactas de un toque (plan, proyecto y generación con revisor).
  - Pruebas: `tests/unit/estudio-fase5.test.ts`, `tests/e2e/estudio-fase5.spec.ts`.
- **Fase 4 hecha**: skills de pantalla en `src/lib/forja/estudio/skills.ts` — 11 patrones (`producto`, `marco-app`, `tabla`, `formulario`, `detalle`, `busqueda`, `ajustes`, `acceso`, `bienvenida`, `planes`, `asistente`) adaptados de Open Design Agent Kit (MIT; solo las skills que escribió el kit, el resto de su catálogo es Apache-2.0 de nexu-io/open-design y no se copió — ver `AVISOS-SKILLS.md`). Condensadas a ≤ 650 caracteres; se eligen solas por nombre/propósito de la pantalla (máx. 2 + la base «producto»), se pueden cambiar a mano en el panel («Patrones») y viajan en el pedido de la pantalla, no en el system prompt. Cada una trae una autocomprobación determinista que entra en la crítica y en «Corregir con IA». Runtime real del adaptador: `src/lib/forja/motor/runtime-modelo.ts` (`RuntimeModelo`, recibe una `LlamadaModelo`, reintenta si el modelo no entrega HTML) y `runtimeEstudio()`/`llamadaAuto()` en `estudio/generador.ts` para enchufarle la cadena Auto. Pruebas: `tests/unit/estudio-skills.test.ts`; con un modelo real, `tests/unit/estudio-skills-vivo.test.ts` (se salta sin `FORJA_VIVO_*`). Pendiente: correr el banco en vivo con claves gratis y decidir si el chat/`/forja` usan `RuntimeModelo` por defecto.
- **Fase 3 hecha**: pestaña «Biblioteca» en el Estudio (subir imágenes, elegirlas de Google Drive con la cuenta conectada, «A biblioteca» desde una pantalla generada). Cada imagen se reduce a 1024 px / JPEG, se guarda en IndexedDB (metadatos en localStorage) y se le saca la paleta real. Al crear un proyecto (o desde «Referencias» en el editor) se eligen hasta 6: la paleta viaja siempre en el system prompt y, con Auto o un modelo con visión, hasta 4 imágenes van adjuntas con las instrucciones de `referencia-visual.ts`. Pruebas: `tests/unit/estudio.test.ts` (biblioteca), `tests/e2e/estudio-biblioteca.spec.ts`. Pendiente: guardar proyectos enteros como plantilla.
- **Fase 2 hecha**: PNG por pantalla (×2, reutiliza el capturador aislado de `screenshot.ts`, parametrizado sin cambiar el del QA), «ZIP + imágenes» y modo presentación (flechas / ← →) en pantalla completa. Pendiente de esta fase: PNG de lo pintado en `<canvas>` (límite de la técnica).
- **Fase 1 hecha** (esta rama): `src/lib/forja/estudio/*` (modelo, prompts, tokens, HTML, crítica, exportación, generador con la cadena Auto) + `src/components/forja/estudio/estudio.tsx` + pestaña «Estudio» por defecto en `/forja`. Pruebas: `tests/unit/estudio.test.ts`, `tests/e2e/estudio.spec.ts`.

## 3. Reglas de trabajo
- Rama `estudio-disenio`, PR revisable; nada directo a `main`.
- Reutilizar módulos existentes; no duplicar el motor.
- Cada fase con sus pruebas (Vitest) y sin romper las existentes.
