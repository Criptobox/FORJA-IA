# Tinta · la biblioteca de diseño dentro de FORJA

Tinta viene de Estilos (versión 12.68) y desde aquí vive solo en FORJA. Es la biblioteca con la que el chat y el Estudio arman apps completas gastando muy pocos tokens: el modelo escribe una **receta** (qué bloques, paleta, letra y textos) y Tinta dibuja la app con todas sus pantallas, después de que trabaje el **equipo de 8 agentes**.

## Qué hay aquí

- `web/crear.html`: la página de Tinta. Con `?motor=1`, dentro de un iframe del mismo origen, atiende peticiones por `postMessage` (`ping`, `instrucciones`, `leer`, `dibujar`, `equipo`). El contrato y sus tipos están en `src/lib/forja/tinta/cliente.ts`.
- `web/js/`: 59 scripts clásicos del navegador, en el orden en que los carga `crear.html`. Entre ellos:
  - los bloques (`tinta-refs*.js`, `tinta-cards.js`, `tinta-widgets.js`…);
  - las plantillas (`tinta-templates.js`), los sectores (`tinta-sectors.js`) y las paletas, fondos y tipografías;
  - la receta (`tinta-receta.js`) y el equipo de agentes (`tinta-equipo.js`, `tinta-equipo-art.js`);
  - el contraste (`tinta-contrast.js`) y la página (`crear.js`).
- `web/css/`: `crear.css` y `equipo.css` (todo lo del equipo va bajo `.eq`).
- `tests/unit/`: pruebas de la lógica pura con `node:test` (receta, equipo, paletas, sectores, contraste, chat…).

## Cambiar algo

1. Edita `tinta/web/…`.
2. `npm run tinta` vuelve a construir `public/tinta/motor.html` (un solo HTML autónomo) y `src/lib/forja/tinta/version.ts` (su huella, para que no salga de caché).
3. `npm run test:tinta` pasa las pruebas del motor. El CI comprueba además con `npm run tinta -- --check` que `public/tinta/motor.html` está al día: tocar las fuentes sin reconstruir hace fallar el CI.

Las pruebas de punta a punta en FORJA (`tests/e2e/estudio-tinta.spec.ts` y `chat-tinta.spec.ts`) recorren el flujo entero con el modelo simulado.
