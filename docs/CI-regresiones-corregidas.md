# Regresiones E2E corregidas

## 1. Failover que continúa
El camino de error ahora usa `detectarParcialRescatable()` en la decisión y al preparar el failover. Además de cercas abiertas, reconoce HTML parcial sin `</html>` cuando el stream se corta, preserva la respuesta previa y envía la instrucción de continuación al proveedor de repuesto.

## 2. Web Studio a 390 px
El diálogo móvil queda anclado al borde izquierdo (`left: 0`, sin traslación horizontal) y usa `100vw` explícito. Esto evita que el centrado Radix y el ancho calculado por defecto resten píxeles al ancho visible.

No se declara que CI pase hasta ejecutar los tests E2E en Chromium.
