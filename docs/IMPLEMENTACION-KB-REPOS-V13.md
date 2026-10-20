# Forja IA — V13: repositorios como conocimiento estructurado

Esta fase añade análisis local de ZIP/repositorios antes de tratarlos como una sola referencia.

## Flujo

ZIP → lectura local → eliminación de dependencias/generados → detección de stack → componentes → patrones → licencia → puntos de entrada → manifiesto → Knowledge Base.

El repositorio completo **no se manda al modelo** por defecto. El manifiesto compacto queda disponible para recuperación posterior y permite pedir archivos concretos cuando sean necesarios.

## Límites

- 3.000 archivos indexables por ZIP.
- 2 MB por archivo para extracción de texto.
- Se ignoran `node_modules`, `.git`, `dist`, `build`, `.next`, `coverage`, mapas y minificados.
- Los binarios se registran estructuralmente pero no se envía su contenido.
- El análisis es local en el navegador.

## Siguiente fase

Conectar el manifiesto a la recuperación del Cerebro y permitir recuperar archivos/componentes concretos por tecnología, patrón o nombre. Después: integración real de MEGA.
