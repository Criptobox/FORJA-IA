# FASE V29.2 — GitHub: reconexión sin registrar otra aplicación

## Problema

El flujo anterior podía volver a abrir el registro de una GitHub App cuando la cookie HttpOnly del servidor no estaba disponible. GitHub rechazaba el nombre fijo `Forja IA` porque esa aplicación ya existía.

## Corrección

- Si Forja ya tiene un token de GitHub guardado en el dispositivo, `Conectar GitHub` valida ese token y reutiliza la conexión.
- No se vuelve a abrir el registro de la GitHub App en ese caso.
- Se migran tokens antiguos guardados como `gh_token` al almacenamiento canónico `forja-github-token`.
- La bóveda ahora usa el mismo nombre canónico del token de GitHub, evitando que una conexión quede invisible después de desbloquearla.
- Si el token guardado ya fue revocado, Forja lo elimina y entonces sí inicia una autorización nueva.

## Limitación importante

La primera creación de la GitHub App sigue siendo un proceso de GitHub. Si el navegador perdió tanto el token local como las credenciales/cookie de la GitHub App, Forja no puede reconstruir de forma segura el `client_secret` de esa aplicación; en ese caso hace falta recuperar la aplicación existente o configurar sus credenciales en el servidor.
