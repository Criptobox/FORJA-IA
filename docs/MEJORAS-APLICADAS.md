# Mejoras aplicadas

## v4.69.2 — Selector en «Subir a GitHub»
- Añadido al apartado exacto «Paso 2 · Repositorio» de la ventana «Subir a GitHub».
- Lista los repositorios de la cuenta conectada, con búsqueda por propietario/nombre, rama por defecto y visibilidad privada/pública.
- Permite actualizar la lista y mantiene la entrada manual para crear un repositorio nuevo.
- Al elegir un repositorio existente, la subida apunta al propietario y repositorio seleccionados, también cuando el repositorio pertenece a una organización.
- La versión se incrementó y sincronizó con package.json, app-version.ts y package-lock.json.
- Validación: se revisó la estructura del cambio; la compilación completa debe ejecutarse en un entorno con las dependencias del proyecto instaladas.

# v4.69.1 — Selector de repositorios GitHub

- Repo Studio muestra los repositorios accesibles después de conectar GitHub, tanto en el modo directo como en el modo descargado/clonado. Ya no es necesario escribir a mano `usuario/repositorio`.
- Añadido buscador por propietario, organización o nombre; estado de carga; mensajes de error con reintento; y botón para actualizar la lista.
- `ghListRepos` pagina la API de GitHub (100 por página, hasta 20 páginas) e incluye repositorios de organizaciones a los que la conexión tenga acceso. Se eliminan duplicados y se conservan las etiquetas de repositorio privado y rama por defecto.
- La entrada manual de URL sigue disponible como alternativa, y se mantiene el flujo de permisos y revisión de cambios antes de publicar.
- Versión de app sincronizada en `package.json`, `src/lib/forja/app-version.ts` y `package-lock.json`.

**Verificación:** dependencias no instaladas en el entorno de trabajo; `npm ci` no terminó por el límite de tiempo del entorno. No se declara build ni suite de tests como aprobados. Pendiente ejecutar `npm ci`, `npm run lint`, `npm test` y `npm run build` en un entorno con acceso a npm.

---

# FORJA IA — Mejoras aplicadas (ronda 2, v4.68.0)

> Ronda 1 (v4.67.1–v4.67.3): corrección de errores del repo + 8 mejoras M1–M8
> (ESLint en fases, `noImplicitAny`, StrictMode, cookie GitHub 12 h, xlsx
> oficial 0.20.3, techo de función serverless, mock de tools fragmentadas).
> Esta ronda 2 parte de ese punto y profundiza en calidad y bugs reales.

## Qué cambió en v4.68.0

### 1. ESLint: 0 errores. El lint vuelve a ser una red, no un adorno
La configuración quedó en dos fases y el código quedó LIMPIO de verdad:

- **Fase 1 (errores, bloquean):** variables e imports sin usar (con puerta de
  escape `_prefijo`), `prefer-const`, `no-var`, escapes inútiles, whitespace
  irregular, `case` sin break, código inalcanzable…
- **Fase 2 (avisos, no bloquean):** `any`, `exhaustive-deps`, `<img>`,
  `no-empty`, `no-debugger`… Visibles para irlos limpiando por rondas.

Resultado: **0 errores, 306 avisos documentados** (antes: todo apagado a
ciegas). Se limpiaron 45 infracciones reales: imports muertos, parámetros sin
uso renombrados a `_param`, constantes locales muertas marcadas o eliminadas.

### 2. Bug real: regex `\\s` que nunca colapsaban espacios (6 sitios)
Varios scripts que viajan inyectados al iframe (medidor de QA visual, sandbox,
piloto, medidor genérico) tenían `.replace(/\\s+/g, " ")` — que sustituye el
texto literal «\s», no los espacios. Además había UN sitio con el problema
inverso (un `\s` dentro de un template string, que se cocina a «s» y habría
sustituido todas las letras «s» del texto por espacios).

Corregido en: `sandbox-pilot.ts` (4), `visual-qa.ts` (1), `sandbox.ts` (1),
`generico.ts` (1). El detector de «la página cambió» ahora firma texto real.

### 3. Bug real: tool_calls fragmentados se perdían (streaming)
Groq y OpenRouter trocean un tool_call en varios deltas SSE: el primero trae
`id`+`nombre`, los siguientes solo trozos de `arguments` con el `index` del
wire. El acumulador agrupaba por `id` (que no se repite) y la llamada llegaba
rota — el agente escribía archivos a medias o no los escribía.

- `tools-translate.ts`: los fragmentos ahora conservan `index` y un `id`
  vacío significa «continuación de lo que ya hay».
- `chat-client.ts`: el acumulador agrupa por `index` del wire (OpenAI),
  con fallback al comportamiento anterior para Anthropic/Gemini.
- Nuevo modelo mock **`mock-tools-fragmentado`** que emite el troceo exacto
  de Groq, y test nuevo `chat-client-stream-tools.test.ts` que verifica que
  los 3 fragmentos acaban en UNA llamada completa con los argumentos íntegros.

### 4. Bug real: etiqueta de proveedor mostraba el id crudo (Wrapped)
`wrapped.ts` indexaba el ARRAY de proveedores con un string
(`PROVIDERS["groq"]` → `undefined`), así que el ranking de uso enseñaba
«groq · llama-3.3» en vez de «Groq · llama-3.3». Ahora usa `PROVIDER_MAP`,
el diccionario por id que ya existía. `gasto-panel.tsx` tenía la misma pinta
y se corrigió igual.

### 5. Bug real: `parseColor` del QA visual no matcheaba nada
El regex de colores rgba dentro del script inyectado llevaba dobles
backslashes sobrantes en `visual-qa.ts`. Con la corrección del punto 2, el
análisis de color/contraste vuelve a funcionar.

### 6. NBSP explícito en `html-a-texto.ts`
La clase de caracteres llevaba un espacio no separable (U+00A0) literal y
invisible. Ahora está escrito como escape `\u00a0`: mismo comportamiento,
legible y sin «whitespace irregular» en el lint.

### 7. `noImplicitAny: true` — y los bugs que destapó
TypeScript ya no acepta `any` implícito. Con esto arriba se detectaron los
bugs 3 y 4 de esta lista en el primer `tsc`. Tipados corregidos en
`tools-translate.ts` (protocolos) y `gasto-panel.tsx` (`ProviderId`).

### 8. Cookie de la GitHub App: 30 días → 12 horas
`GH_APP_COOKIE_MAX_AGE = 60*60*12` en `github-oauth-server.ts`, usado por el
callback del manifiesto. Menos ventana para la credencial; reconectar son dos
clics.

### 9. xlsx del CDN oficial (0.20.3)
`package.json` apunta a `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.
La versión 0.18.5 de npm tiene CVEs conocidos sin parche en el registry.

### 10. Techo de función serverless con mensaje claro (Repo Studio builds)
`/api/repos` ya tenía `maxDuration = 60`; ahora además `TECHO_FUNCION_MS =
50_000` recorta el tiempo de `spawnSync` al margen real restante y devuelve
«se quedó sin tiempo: construye en local o usa un proyecto más pequeño» en
vez de dejar que Vercel mate la función con un error de red genérico.

### 11. Resto de la ronda 1 (se mantiene)
- `reactStrictMode: true` en `next.config.ts`.
- `assets/` fuera del lint (el codemod del lint rompía `forja-3d.js`).
- Mock `mock-tools-fragmentado` + test (punto 3 de esta ronda).

## Verificación de la ronda

| Puerta               | Resultado                          |
|----------------------|------------------------------------|
| `tsc --noEmit`       | 0 errores (`noImplicitAny` activo) |
| `eslint .`           | 0 errores · 306 avisos documentados|
| `vitest run`         | 2340/2340 tests pasan              |
| `next build`         | OK (standalone en local, Vercel intacto) |
| Versión              | 4.68.0 (`/api/version` y PWA)      |

---

# Corrección v4.68.1 — el revisor de Forja se comía su propio código

Al pasar el propio FORJA IA por su revisor (Sandbox/Repo Studio) aparecían
avisos falsos en archivos perfectamente válidos (`node --check` los daba por
buenos): «cierre «)» sin su apertura» en `public/motor-forja.mjs:886` y
`motor-forja/integracion/adapter-test/verificacion-v47.mjs:119`, y «enlaces
rotos» en `src/app/globals.css:1-2`. Tres bugs del REVISOR, no del código
revisado:

## 1. Regex tras cabecera de bloque se tragaba medio archivo
`for (let x of lista) /\balt\s*=/i.test(x)` — el «/» después de «)» es la
ambigüedad clásica de JavaScript (¿división o regex?). El heurístico del
masker decidía «división», otro «/» lejano cerraba el falso regex y el
revisor se comía cientos de líneas reales — de ahí los paréntesis fantasma.
Ahora el masker lleva CONTEXTO: si el «(» venía tras `for/if/while/switch/
with/catch`, el «)» deja el turno en posición de enunciado y el «/» es regex.
Igual con `return/re/`, `typeof/re/` y compañía.

## 2. Plantillas anidadas desalineaban el balance
Un `` `a ${x ? `b` : `${c}`} d` `` cortaba en el PRIMER backtick y todo lo
que venía después contaba mal. Ahora la plantilla se recorre de verdad: el
texto literal se enmascara y cada `${…}` se procesa como código, con
anidamiento recursivo.

## 3. `@import "tailwindcss"` no es un enlace roto
El revisor resolvía los `@import` del CSS como rutas de archivo. Los bare
specifiers (`tailwindcss`, `tw-animate-css`) los resuelve el build desde
node_modules. Solo se comprueban los que apuntan con ruta relativa o a un
`.css` propio.

**Verificación contra un parser real:** el masker corregido se comparó token
a token con acorn sobre `public/motor-forja.mjs` (450 KB minificados):
0 divergencias. +7 tests de regresión (2347/2347), tsc 0, eslint 0 errores,
build OK. Versión 4.68.1.
