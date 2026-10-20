# Fase V15 — MEGA visible y operativo

## Implementado
- Panel MEGA visible dentro de Knowledge Base, junto a Google Drive.
- Login real desde navegador mediante MEGAJS browser ES module versionado.
- Soporte de contraseña y código 2FA sin persistir la contraseña.
- Sesión MEGA mantenida en memoria de la pestaña.
- Estado conectado/desconectado y correo de la cuenta.
- Consulta de cuota.
- Listado de la raíz de MEGA.
- Subida directa de archivos.
- Desconexión segura de la sesión.
- Provider unificado `StorageProvider` para que el Cerebro pueda tratar MEGA como almacenamiento de código.

## Decisiones de seguridad
- No se guarda la contraseña en localStorage.
- No se envía la contraseña a un servidor de Forja.
- `megajs` es una dependencia real del proyecto (`package.json` +
  `package-lock.json`, con su hash de integridad de npm), no un script
  pedido a un CDN en tiempo de ejecución. La versión recibida en esta fase
  cargaba el build browser de MEGAJS directamente desde `unpkg.com` con un
  `import()` dinámico construido a mano (`new Function("url", "return
  import(url)")(...)`) para esquivar el análisis estático del bundler —
  eso deja que lo que se ejecuta en la app dependa de lo que unpkg sirva en
  cada momento, sin el candado del lockfile. Se cambió a `import("megajs")`
  con la dependencia instalada de verdad: mismo efecto de carga bajo
  demanda (Next.js separa el módulo en su propio chunk, descargado solo al
  pulsar "Conectar"), pero sin extender la confianza de la app a un
  dominio externo en cada conexión.
- El `.d.ts` publicado por `megajs` importa módulos `https://cdn.deno.land/...`
  (pensados para Deno) que rompen la resolución de tipos de un proyecto
  Node/Next normal — `mega-provider.ts` no los importa: usa sus propios
  tipos mínimos, igual que ya hacía la versión con CDN.

## Nota de despliegue
MEGAJS es una librería comunitaria/no oficial. Su documentación 1.x documenta el uso en navegador, `Storage`, login, 2FA, listado, subida y gestión de archivos.
