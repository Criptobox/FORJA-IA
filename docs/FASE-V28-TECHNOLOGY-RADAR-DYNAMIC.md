# V28 — Technology Radar dinámico

Forja puede recibir snapshots externos de tecnologías, validarlos, compararlos con el snapshot anterior y ponerlos en cuarentena si no cumplen el esquema.

## Reglas de seguridad
- Un catálogo externo es **datos**, no instrucciones ejecutables.
- Nunca instala paquetes, ejecuta scripts ni habilita herramientas por recibir un registro.
- Solo se aceptan esquemas conocidos, URLs válidas y enums permitidos.
- Duplicados y registros inválidos quedan fuera del snapshot activo.
- Los cambios de licencia/procedencia deben pasar por revisión antes de convertirse en conocimiento confiable.
- Los registros expirados no se recomiendan.
- Una entrada externa nunca reemplaza a una del catálogo propio con el mismo id (`mergeTechnologyRadarEntries`): el catálogo interno manda.

## Flujo
`fuente externa → snapshot → validación → diff → cuarentena/revisión → radar activo → Orchestrator`

Esto permite actualizar el radar sin convertirlo en un mecanismo de ejecución remota.

## Archivos

- `src/lib/forja/technology-radar-registry.ts`: `validateRadarRecord`, `validateRadarSnapshot`, `diffRadarSnapshots`, `activeRadarRecords`.
- `src/lib/forja/technology-radar.ts`: `mergeTechnologyRadarEntries` — mezcla registros externos ya validados con el catálogo (`RADAR`) sin pisar entradas propias.
- Tests: `tests/unit/technology-radar-registry.test.ts` (validación de campos/enums/URL/fecha, duplicados, diff de altas/cambios/bajas/cuarentena, expiración) y el bloque `mergeTechnologyRadarEntries` en `tests/unit/technology-radar.test.ts`.

## Estado: preparado, todavía no conectado

Igual que la persistencia de V26, esta fase deja el mecanismo listo pero **no lo conecta a ninguna fuente externa real todavía**: nada en la app llama a `validateRadarSnapshot`/`activeRadarRecords`/`mergeTechnologyRadarEntries` fuera de sus propios tests. Cablear esto a un origen real (una URL, un archivo subido, MEGA…) queda para una fase posterior, y en ese momento es donde importa de verdad la regla "es texto validado, no instrucciones" — nada de esta fase ejecuta código ni hace fetch por su cuenta.

## Corrección de una fase anterior encontrada de paso

Al revisar `technology-radar.ts` para integrar esto, se encontró que la línea `norm()` (V27) había quedado con el carácter combinante literal `[̀-ͯ]` en vez de la forma escrita `[̀-ͯ]` que se pretendía — un problema de cómo viajó el texto al escribir el archivo la vez anterior, no un bug de comportamiento (ambas formas son la misma expresión regular; los tests ya pasaban con las dos). Se corrigió a la forma escrita, más resistente a herramientas que no preserven bien caracteres Unicode sin base al copiar/procesar el archivo.
