# Construir y previsualizar proyectos con build (Vite/Next/CRA)

## Motivación

El Sandbox ejecuta HTML/CSS/JS tal cual están, sin bundler: un proyecto de Vite, Next o CRA no tiene ningún HTML hasta que se compila, así que hasta ahora el único mensaje era "sube esto a GitHub y despliégalo en Vercel para verlo". Esta función permite construir y previsualizar ese tipo de proyectos **dentro de Forja**, antes de subirlos a mano a GitHub o a un servicio de despliegue.

Hay dos puntos de entrada, según de dónde venga el proyecto:

## 1. Un proyecto que ya está en el Sandbox (creado por chat, pegado, o subido como ZIP)

Es el caso normal: el Cerebro va creando un proyecto en formato Vite/Next/CRA directamente en el Sandbox (sin que exista todavía ningún repo de GitHub). Al abrir la pestaña **Vista** de un proyecto así, en vez del mensaje genérico aparece una caja dedicada:

> "Este proyecto tiene `package.json` pero ningún HTML: es de Vite, Next, CRA… Instala dependencias y construye aquí mismo para verlo."
> **[ Construir y previsualizar ]**

Al pulsarlo:
1. El cliente manda el contenido de texto actual del Sandbox (`entries`) al servidor — `action: "buildFromFiles"`.
2. El servidor lo escribe en una carpeta **temporal**, corre el mismo pipeline de instalación+build que el punto 2, y la borra al terminar (nunca se guarda como repo).
3. Si hay salida estática, se abre directamente en la misma vista previa del Sandbox (mismo iframe aislado de siempre).

## 2. Un proyecto clonado por Repo Studio (modo descargado)

Si el proyecto ya vive como repo clonado en `workspace/repos/` (Repo Studio → modo descargado), el botón **«Construir y previsualizar»** de ese panel hace lo mismo pero sobre esa carpeta persistente — `action: "build"` con `repoKey`.

## Cómo funciona el build en sí (común a los dos)

1. Se detecta el gestor de paquetes por el lockfile presente (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, si no → npm).
2. Se instala y se ejecuta el script `build` del `package.json` tal cual venga.
3. Si el build produce una salida estática (`out/`, `dist/` o `build/`, en ese orden, la primera con `index.html`), esos archivos pasan al Sandbox.
4. Si el build termina bien pero no genera ninguna carpeta estática con `index.html` (típico de un Next.js con rutas de servidor/SSR real, como la propia Forja), se avisa explícitamente: hace falta un servidor Node de verdad —Vercel, un VPS…— para probar esa parte, el Sandbox no puede simularla.

## Qué NO hace

- No sustituye el despliegue real: sigue siendo responsabilidad del usuario subir el proyecto a GitHub/Vercel cuando quiera publicarlo.
- No mantiene un servidor Node corriendo (`next start`, `vite dev`…): solo build único + servir el resultado estático. Rutas de servidor/API routes reales no se pueden probar en vivo aquí.
- No inlinea binarios pesados de la build (mismo límite que ya tenía "Todo el repo al Sandbox"/`readAll`): se cuentan como omitidos.
- `buildFromFiles` solo manda archivos de **texto** del Sandbox (los que `entries[...].text !== null`); los binarios (imágenes, etc.) que el proyecto tuviera como fuente no viajan al build.

## Implicación de seguridad

A diferencia del resto de acciones de `/api/repos` (que solo leen/escriben archivos), `build`/`buildFromFiles` **ejecutan código arbitrario**: `npm install` corre los scripts `postinstall` que traiga el proyecto, y luego el script `build` que declare. Siguen protegidas por el mismo guardián que ya exige `FORJA_ACCESS_CODE` en producción para toda la ruta — pero ahora ese guardián protege ejecución real, no solo lectura/escritura de disco.

`buildFromFiles` escribe en una carpeta temporal (`mkdtempSync`) con la misma protección de rutas que `safeJoin` (sin `..`, sin ruta absoluta, sin byte nulo, y verificación de que la ruta resuelta sigue dentro de la carpeta temporal) y la borra siempre en un `finally`, incluso si el build falla o lanza una excepción.

También requiere un servidor Node persistente (no una función serverless efímera): el `install`+`build` puede tardar varios minutos y necesita que el proceso y el disco sigan vivos entre esos pasos.

## Archivos

- `src/app/api/repos/route.ts` — acciones `build` (repo clonado) y `buildFromFiles` (Sandbox en memoria), compartiendo la lógica de instalación/build (`runInstallAndBuild`) y las funciones puras `detectPackageManager`, `hasBuildScript`, `findStaticOutputDir`, `trimLog` (con tests en `tests/unit/api-repos-build.test.ts`).
- `src/components/forja/sandbox-studio.tsx` — caja dedicada en la pestaña Vista cuando el proyecto actual necesita build (`necesitaBuild`), con el botón que llama a `buildInSandbox()`.
- `src/components/forja/repo-dialog.tsx` — botón «Construir y previsualizar» en el panel de Repo Studio (modo descargado), para proyectos ya clonados como repo.
