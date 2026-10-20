# Forja IA — Fase V14

## Recuperación de conocimiento estructural de repositorios

V14 añade recuperación sobre los manifiestos de proyectos importados
(`kb-project-retrieval.ts`) y la conecta de verdad al agente: la
herramienta `kb_project_search` (nueva en `tools-catalog.ts`/
`tool-runner.ts`, inyectada en `use-agent-tools.ts` igual que `kb_search`)
deja que el Cerebro busque componentes, patrones, tecnologías y archivos
relevantes entre los ZIP/repositorios ya analizados, sin volver a cargar
un repositorio completo. FORJA WEB la menciona en su primer paso
("Conocimiento") para preferirla antes de escribir un componente desde
cero.

### Flujo

`consulta → Project Manifests → ranking → archivos relevantes → contexto compacto → kb_project_search → Cerebro`

### Siguiente etapa

Extracción/persistencia real de los recursos de código (hoy el manifiesto
guarda metadatos y rutas, no el contenido completo de cada archivo) y
conexión con proveedores externos como MEGA/Drive.
