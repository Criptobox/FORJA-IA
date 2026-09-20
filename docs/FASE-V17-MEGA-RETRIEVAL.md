# FASE V17 — recuperación de código MEGA bajo demanda

## Objetivo

Cerrar el circuito que quedó preparado en V16: el índice local encuentra candidatos y Cerebro puede leer **solo los archivos de código relevantes** desde MEGA cuando inicia Web Studio.

## Flujo

1. `retrieveKB` filtra por metadatos locales y ordena por relevancia.
2. `retrieveKBContent` recorre esos candidatos EN ORDEN hasta reunir 4 con
   contenido real (o agotar la lista) — no corta a los 4 primeros del
   ranking antes de intentar leerlos, porque eso gastaba el cupo en
   candidatos sin lector remoto (hoy, cualquiera que no venga de MEGA) y
   podía dejar sin recuperar código de MEGA que sí era legible más abajo
   en la lista.
3. Solo archivos de texto/código se descargan automáticamente.
4. Cada archivo tiene límite de 5 MB y 12.000 caracteres de contexto.
5. El conjunto completo tiene límite de 30.000 caracteres.
6. El contenido recuperado se añade al prompt del Cerebro con su ruta y su
   procedencia real (`sourceProvider` del recurso — MEGA es la única
   fuente con lector implementado hoy).
7. ZIP, imágenes, fuentes y otros binarios no se descargan como código; se conserva su metadata/manifest.

## Integración

`ForjaStudioDialog` usa ahora `buildCerebroPlanWithKnowledge()`. El botón muestra `Preparando contexto…` mientras se hace la recuperación remota.

`buildCerebroPlan()` sigue existiendo y sigue siendo síncrono para no romper otras integraciones.

## Seguridad y coste de contexto

- No se descarga toda la biblioteca.
- No se guarda el código remoto en localStorage.
- No se persiste la contraseña de MEGA.
- Se limita cantidad de archivos, bytes y caracteres.
- Si un recurso no puede leerse, el prompt no finge que fue leído.
