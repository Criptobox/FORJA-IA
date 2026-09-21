# Construir y previsualizar proyectos con build (Vite/Next/CRA)

## Motivación

El Sandbox ejecuta HTML/CSS/JS tal cual están, sin bundler: un proyecto de Vite, Next o CRA no tiene ningún HTML hasta que se compila, así que hasta ahora el único mensaje era "sube esto a GitHub y despliégalo en Vercel para verlo". Esta función permite abrir, construir y previsualizar ese tipo de proyectos **dentro de Forja**, antes de subirlos a mano a GitHub o a un servicio de despliegue.

## Cómo funciona

1. Abre el proyecto en **Repo Studio → modo descargado** (clona el repo en `workspace/repos/` del servidor).
2. Pulsa **«Construir y previsualizar»**.
3. El servidor detecta el gestor de paquetes por el lockfile presente (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, si no → npm), instala dependencias y ejecuta el script `build` del `package.json` tal cual venga.
4. Si el build produce una salida estática (`out/`, `dist/` o `build/`, en ese orden, la primera con `index.html`), esos archivos se abren directamente en el Sandbox — igual que "Todo el repo al Sandbox", pero con el proyecto ya compilado.
5. Si el build termina bien pero no genera ninguna carpeta estática con `index.html` (típico de un Next.js con rutas de servidor/SSR real, como la propia Forja), se avisa explícitamente: hace falta un servidor Node de verdad —Vercel, un VPS…— para probar esa parte, el Sandbox no puede simularla.

## Qué NO hace

- No sustituye el despliegue real: sigue siendo responsabilidad del usuario subir el proyecto a GitHub/Vercel cuando quiera publicarlo.
- No mantiene un servidor Node corriendo (`next start`, `vite dev`…): solo build único + servir el resultado estático. Rutas de servidor/API routes reales no se pueden probar en vivo aquí.
- No inlinea binarios pesados de la build (mismo límite que ya tenía "Todo el repo al Sandbox"): se cuentan como omitidos.

## Implicación de seguridad

A diferencia del resto de acciones de `/api/repos` (que solo leen/escriben archivos), `build` **ejecuta código arbitrario** del repositorio abierto: `npm install` corre los scripts `postinstall` que traiga, y luego el script `build` que declare. Sigue protegido por el mismo guardián que ya exige `FORJA_ACCESS_CODE` en producción para toda la ruta — pero ahora ese guardián protege ejecución real, no solo lectura/escritura de disco.

También requiere un servidor Node persistente (no una función serverless efímera): el `install`+`build` puede tardar varios minutos y necesita que el proceso y el disco sigan vivos entre esos pasos.

## Archivos

- `src/app/api/repos/route.ts` — acción `build`, y las funciones puras `detectPackageManager`, `hasBuildScript`, `findStaticOutputDir`, `trimLog` (con tests en `tests/unit/api-repos-build.test.ts`).
- `src/components/forja/repo-dialog.tsx` — botón «Construir y previsualizar» en el panel de Repo Studio (modo descargado).
- `src/components/forja/sandbox-studio.tsx` — el aviso de "este proyecto necesita compilarse" ahora menciona esta opción cuando el proyecto viene de Repo Studio.
