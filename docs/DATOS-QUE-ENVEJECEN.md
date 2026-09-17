# La regla de la casa: todo dato que envejece necesita fecha, fuente y un `npm run` que lo regenere

Este documento existe por un fallo que se repitió en Forja cuatro veces, con
cuatro caras distintas y siempre la misma raíz.

## Qué pasó

- El catálogo de modelos llevaba `grok-3` y `qwen/qwen3-32b`, retirados por
  sus proveedores meses atrás. Los elegías, llegaba un 404 y parecía culpa de
  tu clave.
- Las tarifas de los modelos estaban escritas a mano en el código. Cuando
  cambiaron, el panel siguió diciendo lo de antes.
- Las ofertas de los proveedores llevaban **una sola** constante de fecha,
  `OFERTAS_VERIFICADO`, aplicada a las catorce. Bastaba comprobar una para que
  todas dijeran «verificado hoy». Es decir: la app afirmaba trece cosas que
  nadie había mirado.
- Una prueba E2E tenía los identificadores del catálogo copiados a mano.
  Añadir una oferta la rompía, y el arreglo «rápido» era volver a copiarlos.

Ninguno fue un error de programación. Los cuatro son el mismo error de
**diseño**: un dato que cambia solo, guardado en un sitio que no cambia solo, y
sin nada que avise de la diferencia.

## La regla

> **Todo dato que envejece necesita tres cosas: fecha, fuente y un `npm run`
> que lo regenere.** Si no puedes darle las tres, no lo escribas en el código:
> enséñalo como «sin dato» y di qué falta.

Las tres, y por qué cada una:

1. **Fecha.** Un precio sin fecha no es un precio, es un rumor. Con fecha, el
   usuario puede decidir si se fía; sin ella solo puede creerse a la app.
2. **Fuente.** Nombrada y comprobable. «Según el catálogo público de LiteLLM,
   foto del 2026-09-04» se puede verificar; «según Forja» no.
3. **Un comando que lo regenere.** Sin él, el dato solo se actualiza cuando
   alguien se acuerda — y nadie se acuerda. El comando convierte «hay que
   revisarlo» en «ejecuta esto».

## Cómo está aplicada hoy

| Dato | Módulo | Fecha | Fuente | Comando |
| --- | --- | --- | --- | --- |
| Tarifas por token | `src/lib/prism/precios-datos.ts` | `PRECIOS_FECHA` | `PRECIOS_FUENTE` (catálogo de LiteLLM, MIT) | `npm run precios` |
| Retiradas de modelos | `src/lib/prism/modelos-datos.ts` | `MODELOS_FECHA` | `MODELOS_FUENTE` | `npm run modelos` |
| Kit de efectos | `src/lib/prism/efectos-datos.ts` | — (es fuente propia, no caduca) | `assets/prism-fx.css` y `assets/prism-fx.js` | `npm run efectos` |
| Ofertas de proveedores | `src/lib/prism/ofertas.ts` | `verificado` **por oferta**, `null` si nadie la ha comprobado | el enlace de cada oferta | a mano, y por eso lleva `verificado: null` hasta que alguien mira |

El kit de efectos es un caso distinto y por eso está en la tabla: no envejece
solo —nadie lo cambia por su cuenta—, pero sí puede **separarse** de su fuente.
Si alguien edita `assets/prism-fx.css` y no ejecuta el comando, la app sigue
sirviendo el de antes y nada avisa. Un unitario compara los dos y falla si se
han separado: misma enfermedad, misma vacuna.

Las ofertas son el caso interesante: no hay catálogo público que las liste, así
que **no** hay comando. La regla no se salta por eso — se cumple por el otro
lado: cada oferta lleva su propia fecha, `null` significa «nadie lo ha
comprobado» y se dice así en pantalla, y `verificacionVieja()` avisa cuando una
comprobación pasa de `DIAS_VERIFICACION_VIEJA`.

## Lo que se deduce de la regla

**El dinero solo se enseña con sus dos mitades.** Un importe en Forja es
siempre `tokens que reportó tu proveedor × precio fechado de un catálogo con
nombre`. Si falta cualquiera de las dos, no se enseña un número: se dice «sin
dato» **y cuál de las dos falta** (`motivoSinCoste` en `precios.ts`). Un cero
sería afirmar que fue gratis; una estimación sería inventarse la factura.

**Nada de datos copiados a mano en las pruebas.** Una prueba que repite la
lista que quiere comprobar solo comprueba que sabes copiar. `ofertas.spec.ts`
deriva los identificadores de `OFERTAS_BASE`; `modelos-viejos.test.ts` recorre
`PROVIDERS` de verdad — y por eso encontró `qwen/qwen3-32b`, que ni el script
de auditoría había visto.

**Una prueba verde no prueba nada hasta que la has visto en rojo.** Es la otra
mitad de lo mismo: si no has comprobado que falla sin el cambio, no sabes si
mide el cambio o el andamio. Pasó aquí de verdad: un tope de llamadas se probó
con `topeLlamadasPago: 1`, el saneador lo subía al mínimo de 10 y la prueba
verde estaba midiendo el saneador.

## Antes de añadir un dato nuevo

1. ¿Cambia solo? Si no, escríbelo y ya está.
2. Si cambia: ¿de dónde sale, y se puede pedir a esa fuente desde un script?
   - Sí → script en `scripts/`, entrada en `"scripts"` de `package.json`, y el
     módulo generado exporta su `_FECHA` y su `_FUENTE`.
   - No → el dato lleva su propia fecha por elemento, admite `null`, y la
     interfaz dice «sin comprobar» cuando lo es.
3. ¿La interfaz lo enseña sin decir de cuándo es? Entonces todavía no está.
