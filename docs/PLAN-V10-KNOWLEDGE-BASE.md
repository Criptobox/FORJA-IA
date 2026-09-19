# FORJA — PLAN DE KNOWLEDGE BASE Y RESEARCH AGENT (v10)

> Plan original del usuario, con la sección 2bis («Drive») añadida a su
> pedido explícito: "hace falta agregar un apartado que diga drive donde
> se vera todos los datos de google drive conectados". El resto del
> documento es el plan tal cual se recibió — no se recortó nada.

## 1. Objetivo
Crear una biblioteca centralizada y extensible para que Forja pueda consultar conocimiento de diseño, código, UI/UX, responsive, animación, accesibilidad, SEO, PWA y patrones de negocio.

## 2. Google Drive
Google Drive funciona como almacenamiento externo. No es el cerebro. Forja consulta índices y recupera recursos concretos.

## 2bis. Drive (panel dentro de Forja) — Fase 1, YA IMPLEMENTADA
Al principio esto vivía en su propio apartado de la barra lateral
("Drive", icono de disco), separado de "Conocimiento". El usuario lo
probó y pidió lo contrario: *"la idea era un panel con todo, no una cosa
por un lado y otra por otro... todo los datos de ese tipo en 1 solo
lugar"*. Desde entonces las cuentas de Google Drive conectadas viven
dentro del mismo diálogo "Conocimiento" (ver §9, fase 2), como una
columna al lado del índice — un único apartado en la barra lateral, no
dos. Lo que se ve ahí:

- **Conectar varias cuentas.** Cada persona crea su propio cliente OAuth en
  su Google Cloud (Google no tiene un registro automático como el
  manifiesto de GitHub Apps) y pega Client ID + API Key una vez en el panel
  — **sin Client Secret**. A partir de ahí, "Conectar cuenta" es un clic por
  cuenta — se pueden tener varias conectadas a la vez, como pide el plan.
- **Almacenamiento por cuenta.** Cada fila de cuenta muestra avatar, nombre,
  email, y una barra con lo usado / el total (o "sin límite" en cuentas
  Workspace ilimitadas), en verde/ámbar/rojo según lo llena que esté.
- **Datos subidos / disponibles.** "Ver archivos" trae los archivos más
  recientes de esa cuenta (nombre, icono, tamaño, enlace directo a Drive).
  "Elegir en Drive" abre el selector visual oficial de Google
  (`@googleworkspace/drive-picker-element`) para navegar y escoger carpetas
  o archivos concretos con la UI real de Drive, reusando el token ya
  concedido — sin pedir permiso otra vez.
- **Desconectar.** Por cuenta, sin tocar las demás.

**Historial de la conexión (por qué es así ahora):** la v4.38.0 usaba un
intercambio OAuth de servidor clásico (código + Client Secret +
`redirect_uri` exacto). Un usuario real probó a conectar su cuenta y le
salió "Error 400: redirect_uri_mismatch" de Google, sin ninguna pista
dentro de Forja de qué había fallado. La v4.40.0 sustituyó ese flujo
entero por **Google Identity Services** (GIS): el navegador pide el
token directamente a Google (sin servidor, sin secret) y Google valida
contra el ORIGEN completo ("Authorized JavaScript origins"), no contra una
ruta exacta — el error concreto que sufrió el usuario deja de ser posible
por diseño. La contrapartida es que GIS no entrega `refresh_token` (eso
solo lo da el flujo de código, que si necesita secret): la renovación es
silenciosa, pidiendo un token nuevo mientras la sesión de Google del
navegador siga viva.

Piezas: `src/lib/forja/gdrive-gis.ts` (Google Identity Services: pedir
token, sin servidor), `src/lib/forja/gdrive-oauth.ts` (utilidades puras:
alcance, formato de bytes), `src/lib/forja/gdrive.ts` (cuentas y
credenciales guardadas en el dispositivo + llamadas a la API de Drive),
`src/components/forja/gdrive-picker-button.tsx` (el selector visual de
Drive) y `src/components/forja/gdrive-dialog.tsx`, que ya no exporta un
diálogo propio: exporta `<DriveAccountsPanel>`, la columna que
`kb-dialog.tsx` monta dentro del diálogo "Conocimiento". Ya no hay rutas
de servidor para esto (`src/app/api/gdrive/*` no existe): ni el Client ID
ni la API Key son secretos, así que no hace falta que el servidor los
toque — mismo trato que las API keys de los proveedores de modelos en el
resto de la app.

Lo que este panel NO hace todavía (fases siguientes, ver §9): guardar lo
elegido con el Picker en un índice, subir/clasificar recursos, generar
metadata, detectar duplicados o alimentar al research agent. Es la base
sobre la que se construye todo eso — sin ella no hay ninguna cuenta que
consultar.

## 3. Research Agent
- Busca primero en la Knowledge Base.
- Si no encuentra suficiente material, consulta fuentes permitidas.
- Verifica origen y licencia.
- Clasifica el recurso.
- Lo guarda únicamente en la ubicación definida.
- Actualiza INDEX.json y los metadatos.
- Nunca inventa carpetas.
- Si no sabe dónde clasificar algo, lo deja en INBOX para revisión.

## 4. Fuentes
Mantener una lista blanca de fuentes oficiales/open source. Las referencias visuales pueden servir para análisis de patrones, pero no deben tratarse como autorización para copiar diseños protegidos.

## 5. Referencias visuales
Desde Forja se podrán subir imágenes directamente a Google Drive mediante la integración oficial de Google Drive/OAuth.
La interfaz debe permitir:
- subir imágenes;
- ver si ya existen;
- detectar duplicados exactos o visualmente similares;
- agrupar capturas desktop/tablet/mobile;
- analizar composición, espaciado, tipografía, color, tarjetas, navegación y jerarquía;
- generar metadata automáticamente;
- filtrar nuevas, analizadas, pendientes y posibles duplicados.

## 6. Eliminación
Forja nunca debe borrar automáticamente una referencia por similitud dudosa.
En "Revisar duplicados" debe mostrar las imágenes lado a lado y permitir:
- conservar ambas;
- eliminar izquierda;
- eliminar derecha;
- revisar después.
Al eliminar, debe sincronizar el índice.

## 7. Documentos y código
Todo recurso debe tener id, categoría, etiquetas, tecnología, fuente, licencia, ruta, hash, estado y fecha de indexación.

## 8. Crecimiento
La biblioteca puede crecer desde decenas de MB hasta varios GB sin mover el código de Forja. El índice y la recuperación selectiva evitan cargar toda la biblioteca.

## 9. Fases de implementación
1. **Drive (§2bis) — hecho.** Conectar cuentas, ver almacenamiento y
   archivos recientes.
2. **Knowledge Base Manager — hecho, con clasificación real incluida, y
   ya fusionado con Drive en un solo panel.** Apartado "Conocimiento" en
   la barra lateral (`src/components/forja/kb-dialog.tsx`, índice en
   `src/lib/forja/kb-index.ts`) — la ÚNICA entrada para todo esto; "Drive"
   dejó de existir como apartado aparte. Dos columnas dentro del mismo
   diálogo: a la izquierda, importar y ver los recursos indexados; a la
   derecha, `<DriveAccountsPanel>` con las cuentas de Google Drive
   conectadas (en móvil se apilan). Cada recurso guarda id/nombre/tipo/
   tamaño/cuenta/enlace/categoría/etiquetas/tecnología/licencia/estado/
   fecha — el equivalente a `INDEX.json`, pero en localStorage (solo
   metadata; los archivos siguen en Drive, así la biblioteca puede crecer
   sin pesar nada aquí). Tres formas de añadir un recurso:
   - **"Importar recursos"** (`kb-import.tsx`, dentro del propio diálogo
     "Conocimiento"): sube un archivo del dispositivo y Forja decide todo
     sola — calcula su hash y avisa si ya existe (`gdrive-upload.ts` +
     `kb-index.ts`), lo clasifica con el MISMO modelo activo de la
     conversación (`kb-classify.ts`, igual patrón que `visual_review`:
     una llamada de un solo turno, sin modelo aparte), elige la cuenta de
     Drive conectada con más espacio libre, crea (o reutiliza) una
     carpeta con el nombre de la categoría en esa cuenta, y sube el
     archivo ahí. Si no hay modelo configurado o la clasificación falla,
     el recurso queda "pendiente" sin categoría — nunca se inventa una.
   - "Elegir en Drive" (el Picker visual, sobre archivos que ya existían).
   - "+ Añadir" en la lista de archivos recientes del panel Drive.

   Lo que falta de esta fase: elegir CARPETAS enteras de una vez (hoy es
   archivo por archivo), e importar ZIP/repositorios/enlaces — el propio
   panel lo dice ("carpetas, ZIP y repositorios llegan después").
   También falta afinar a qué CUENTA va cada categoría cuando ya existe
   una carpeta con ese nombre en otra cuenta que no es la de más espacio
   libre (hoy ese criterio de "más espacio libre" gana siempre).
3. **Análisis visual.** Composición, tipografía, color, agrupación de
   capturas desktop/tablet/mobile — la clasificación de texto/nombre ya
   existe (punto 2); esto es clasificar por lo que se VE en una imagen,
   con una llamada de visión igual que `visual_review`.
4. **Duplicados.** Hoy solo hay aviso de "mismo contenido exacto" por
   hash antes de subir. Falta la comparación visual lado a lado para
   duplicados NO idénticos (mismo diseño, export distinto) y la decisión
   manual + sincronización del índice al eliminar.
5. **Research Agent.** Busca primero en la base, fuentes externas solo si
   falta algo, verifica origen/licencia, deja en INBOX lo que no sabe
   clasificar.
6. **El cerebro consume solo índices**, nunca carpetas completas.

## 10. Regla principal
Forja debe usar la Knowledge Base como memoria técnica y visual consultable, no como una carpeta donde se acumula contenido sin control.
