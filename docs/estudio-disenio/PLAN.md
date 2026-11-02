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
- **Fase 1 hecha** (esta rama): `src/lib/forja/estudio/*` (modelo, prompts, tokens, HTML, crítica, exportación, generador con la cadena Auto) + `src/components/forja/estudio/estudio.tsx` + pestaña «Estudio» por defecto en `/forja`. Pruebas: `tests/unit/estudio.test.ts`, `tests/e2e/estudio.spec.ts`.

## 3. Reglas de trabajo
- Rama `estudio-disenio`, PR revisable; nada directo a `main`.
- Reutilizar módulos existentes; no duplicar el motor.
- Cada fase con sus pruebas (Vitest) y sin romper las existentes.
