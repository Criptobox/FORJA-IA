# Forja IA — Fase KB + Research + referencias visuales

## Implementado en esta fase

- Knowledge Base con metadatos de procedencia: ruta relativa y tipo de importación (`upload`/`folder`/`zip`) ya se calculan y se guardan en cada recurso subido. Los campos `sourceUrl` y `licenseUrl` existen en `KBResource` como contrato para cuando el recurso venga de una URL o traiga licencia conocida, pero ningún flujo de importación actual los rellena todavía — no se muestra un dato inventado en su lugar.
- Importación de carpetas/repositorios mediante `webkitdirectory`.
- Importación de ZIP como recurso sin fingir que se ha extraído su contenido.
- Huella SHA-256 para duplicados exactos.
- Huella visual local aHash 8x8 para imágenes/capturas.
- Detección de similitud visual antes de aceptar un recurso como normal.
- Los posibles duplicados pasan a `revision-duplicado`; Forja no elimina automáticamente.
- Research Agent: Knowledge Base primero; web solo cuando la KB no basta.
- Fuentes separadas por procedencia (`knowledge-base` / `web`) para evitar mezclar evidencia interna con resultados externos.
- Herramienta `research` disponible para el agente.
- Provider MEGA explícito como no conectado hasta disponer de autenticación real; no se almacenan contraseñas ni se simula conexión.

## No se considera terminado todavía

- OAuth de Google Drive de un clic requiere que el despliegue tenga configurado el cliente OAuth de Forja en Google Cloud.
- MEGA necesita una integración de sesión real antes de habilitar lectura/escritura.
- Un ZIP/repo se guarda como archivo; la extracción/indexación profunda de sus archivos queda para la siguiente fase.
- La comparación visual ya detecta candidatos, pero la pantalla dedicada de comparación lado a lado y sus acciones de conservar/eliminar/revisar después quedan para la siguiente fase.
- La verificación automática de licencias externas no se inventa: Research conserva la URL/origen y el agente debe comprobar la fuente antes de convertirla en conocimiento permanente.
