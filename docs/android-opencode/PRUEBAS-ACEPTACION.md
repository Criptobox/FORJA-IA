# Pruebas de aceptación Android

- [ ] APK arranca sin red y muestra el estado del motor como no disponible, sin bloquear el chat normal.
- [ ] Con red, instala/actualiza el runtime desde una fuente fijada y verificable; muestra progreso y permite reintentar.
- [ ] El servidor escucha solo en loopback y no acepta conexiones LAN.
- [ ] La interfaz muestra únicamente modelos cuyo coste cero está verificado; precios desconocidos se excluyen.
- [ ] Una tarea simple devuelve texto y conserva `sessionID`.
- [ ] El usuario puede cancelar una tarea larga y empezar otra.
- [ ] Si el proceso se cierra, Forja muestra “motor detenido” y permite reiniciarlo.
- [ ] Sin modelos gratuitos, la tarea se bloquea y no cambia a un proveedor de pago.
- [ ] Una página web ajena no puede invocar el puente nativo.
- [ ] No se escriben API keys, contraseñas o prompts privados en logs de diagnóstico.
