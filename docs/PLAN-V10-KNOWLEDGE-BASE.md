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

   **FORJA WEB (preset seleccionable) — hecho.** El usuario pidió
   explícito: *"el motor de forja ia hay que configurarlo para que
   busque en esos Google Drive que son como la base de datos"*. Antes,
   el agente podía CONSTRUIR con las herramientas del catálogo, pero
   nada lo conectaba con la Knowledge Base — ninguna herramienta la
   consultaba. Ahora hay una herramienta nueva, `kb_search`
   (`tools-catalog.ts` + `tool-runner.ts`), que busca de verdad en el
   índice (`kb-index.ts`: nombre, categoría, etiquetas, tecnología,
   licencia) y dice honestamente cuando no hay nada, en vez de inventar
   un recurso. Y en el selector de modelo hay un preset nuevo, "FORJA
   WEB" (`FORJA_WEB_MODEL_KEY` en `types.ts`, junto a "Auto" en
   `model-picker.tsx`): seleccionarlo fuerza el modo agente y el
   catálogo de herramientas aunque el interruptor de Ajustes esté
   apagado, y añade al prompt un orden obligatorio — Research
   (`kb_search` primero) → Diseño → Código → QA (`verify_project`) antes
   de dar el proyecto por terminado (`FORJA_WEB_PROMPT` en
   `prompt-actual.ts`). Sigue corriendo sobre el mismo modelo real que
   "Auto" elegiría para la tarea (no es una IA aparte): la
   especialización está en el prompt y las herramientas.

   **Marca: "Forja IA" responde, no el proveedor real — hecho.** El
   usuario probó el preset y protestó: *"sigue llamando a otras IAs...
   la idea es que la IA es Forja IA no otra externa"*. Aclarado con un
   diagrama suyo qué quería decir: no un modelo propio entrenado (eso sí
   requeriría infraestructura real, ver la aclaración que se le dio),
   sino que de cara al usuario NUNCA se nombre al proveedor real (Kimi,
   Groq, Gemini…) cuando responde FORJA WEB — el proveedor sigue
   eligiéndose por debajo exactamente igual que antes (alguien tiene que
   generar el texto), solo que no se enseña. `ChatMessage.viaForjaWeb`
   (`types.ts`) marca cada respuesta generada bajo el preset; la
   etiqueta bajo la burbuja (`message.tsx`) y los avisos de failover/
   cuota/error (`use-generation.ts`) muestran "Forja IA" en vez del
   proveedor cuando ese flag está puesto. Los paneles técnicos (Ajustes,
   Panel del sistema, cuotas) siguen enseñando el proveedor real: son
   para que el propio usuario depure, no la conversación de cara a
   quien usa la web.

   **El flujo tiene que ejecutarse de verdad, no ser cajas bonitas —
   hecho.** El usuario mandó un diagrama con el flujo exacto que quería:
   Brief → Conocimiento → Diseño → Arquitectura → Código → Navegador →
   QA → Reparación → Nueva prueba → Entrega, y una regla explícita: al
   encontrar un fallo, el modelo tiene que localizar el archivo
   responsable y corregirlo AHÍ — nunca crear un archivo de parche aparte
   ("fix-123.ts", "patch-final.js", "temporary-fix.html"). `FORJA_WEB_PROMPT`
   ahora nombra las ocho etapas en ese orden, cada una con su herramienta
   real (Conocimiento→`kb_search`, QA→`verify_project`, Reparación→
   `edit_file`/`apply_patch`, Nueva prueba→`verify_project` otra vez,
   Entrega→`check_definition_of_done`). Y la prohibición de archivos de
   parche no se quedó en una frase que el modelo pudiera ignorar:
   `tool-runner.ts` la HACE CUMPLIR — `esNombreDeParche()` rechaza
   `write_file` cuando el archivo es NUEVO y su nombre contiene un token
   como "fix", "patch", "temp", "backup" o "final" (comparado por token
   completo, no por substring, para no atrapar "prefix.ts" ni
   "traffic.js"). Sobrescribir un archivo que el proyecto ya tenía con
   ese nombre sigue permitido: la regla evita CREAR el patrón, no prohíbe
   un nombre por sí solo. Es una regla global del catálogo de
   herramientas, no solo de FORJA WEB: protege cualquier conversación con
   modo agente.

   **Un filtro de seguridad sin contenido no se enseña como si fuera la
   respuesta — hecho.** El usuario probó "Crea una web para una
   barbería" en FORJA WEB y la burbuja mostró literalmente `User Safety:
   safe` — y en el turno siguiente, `User Safety: safeResponse Safety:
   safe` (dos avisos pegados sin separador). Ni una línea de HTML. La
   causa: eso no está vacío, así que el chequeo de "respuesta vacía" no
   lo veía — se contaba como éxito. `esSoloFiltroSeguridad()`
   (`free-models.ts`) detecta este preámbulo de clasificación de
   seguridad (visto con nemotron vía OpenRouter) aunque los dos avisos
   vengan pegados sin espacio, y `use-generation.ts` lo trata igual que
   una respuesta vacía: falla ese candidato, prueba el siguiente de la
   cadena, y si no queda ninguno, se lo dice al usuario citando el texto
   exacto en vez de mostrarlo como si fuera la web pedida.

   **Seguía colando en una tercera forma: JSON — hecho.** Tras el
   arreglo de arriba, el mismo problema volvió a aparecer, esta vez como
   `{"User Safety": "safe", "Response Safety": "safe"}`. La comilla de
   cierre justo después de "Safety" (antes de los dos puntos) rompía el
   patrón, que solo esperaba texto plano sin comillas de por medio.
   `PATRON_FILTRO_SEGURIDAD` ahora acepta comillas opcionales alrededor
   de "Safety" y del valor ("safe"/"unsafe"), así que reconoce tanto el
   texto plano como la variante JSON, pegadas o no. Las dos formas
   tienen su propio mock (`mock-filtro-seguridad`,
   `mock-filtro-seguridad-json`) y su propio caso de prueba.
3. **Análisis visual.** Composición, tipografía, color, agrupación de
   capturas desktop/tablet/mobile — la clasificación de texto/nombre ya
   existe (punto 2); esto es clasificar por lo que se VE en una imagen,
   con una llamada de visión igual que `visual_review`.
4. **Duplicados.** Hoy solo hay aviso de "mismo contenido exacto" por
   hash antes de subir. Falta la comparación visual lado a lado para
   duplicados NO idénticos (mismo diseño, export distinto) y la decisión
   manual + sincronización del índice al eliminar.
5. **Research Agent.** "Busca primero en la base" — **hecho**, vía
   `kb_search` dentro de FORJA WEB (punto 2). Falta el resto: recurrir a
   fuentes externas solo si de verdad falta algo, verificar origen/licencia
   de lo que trae, y dejar en INBOX lo que no sabe clasificar.
6. **El cerebro consume solo índices**, nunca carpetas completas —
   **hecho**, vía `retrieveKB()`/`kbContext()`
   (`src/lib/forja/knowledge-retrieval.ts`, parte del Cerebro Web
   descrito en `docs/IMPLEMENTACION-CEREBRO-WEB.md`): filtra primero por
   metadatos del índice local (categoría, tecnología, tags, nombre) y
   solo entrega al prompt un contexto compacto con los candidatos que
   puntuaron, nunca la biblioteca entera. Revisando el código recibido se
   encontró y corrigió un fallo que rompía justo esta regla: el bonus por
   estado "clasificado" se sumaba sin condición, así que CUALQUIER
   recurso clasificado pasaba el filtro `score > 0` aunque no hubiera
   coincidido en nada — con una biblioteca grande, "selectivo" habría
   dejado de significar algo. Ahora ese bonus solo desempata entre
   recursos que ya tenían alguna coincidencia real.

## 10. Regla principal
Forja debe usar la Knowledge Base como memoria técnica y visual consultable, no como una carpeta donde se acumula contenido sin control.
