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
Apartado dedicado, abierto desde la barra lateral (`Drive`, icono de disco),
donde se ve todo lo relacionado con las cuentas de Google Drive conectadas:

- **Conectar varias cuentas.** Cada persona crea su propio cliente OAuth en
  su Google Cloud (Google no tiene un registro automático como el
  manifiesto de GitHub Apps) y lo pega una vez en el panel. A partir de ahí,
  "Conectar cuenta de Google" es un clic por cuenta — se pueden tener
  varias conectadas a la vez, como pide el plan.
- **Almacenamiento por cuenta.** Cada tarjeta de cuenta muestra avatar,
  nombre, email, y una barra con lo usado / el total (o "sin límite" en
  cuentas Workspace ilimitadas), en verde/ámbar/rojo según lo llena que
  esté.
- **Datos subidos / disponibles.** Debajo de cada cuenta, "Ver archivos de
  esta cuenta" trae los archivos más recientes de ESA cuenta (nombre, icono,
  tamaño, enlace directo a Drive) — la primera vista de "qué hay ahí" antes
  de que exista el índice de la Knowledge Base.
- **Desconectar.** Por cuenta, sin tocar las demás.

Piezas: `src/lib/forja/gdrive-oauth.ts` (URLs y parseo, sin red),
`src/lib/forja/gdrive-oauth-server.ts` (intercambio de código, refresco,
cookies — reutiliza las utilidades genéricas de `github-oauth-server.ts`
en vez de duplicarlas), `src/lib/forja/gdrive.ts` (cuentas guardadas en el
dispositivo + llamadas a la API de Drive), rutas en
`src/app/api/gdrive/oauth/*` y el diálogo `src/components/forja/gdrive-dialog.tsx`.

Lo que este panel NO hace todavía (fases siguientes, ver §9): elegir
carpetas para indexar, subir/clasificar recursos, generar metadata,
detectar duplicados o alimentar al research agent. Es la base sobre la que
se construye todo eso — sin ella no hay ninguna cuenta que consultar.

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
2. **Knowledge Base Manager.** Elegir carpetas de cada cuenta a indexar,
   subir recursos desde el dispositivo o desde Drive, `INDEX.json` con
   id/categoría/etiquetas/tecnología/fuente/licencia/ruta/hash/estado/fecha.
3. **Análisis visual.** Composición, tipografía, color, agrupación de
   capturas desktop/tablet/mobile, metadata automática.
4. **Duplicados.** Comparación lado a lado, decisión manual, sincronización
   del índice al eliminar.
5. **Research Agent.** Busca primero en la base, fuentes externas solo si
   falta algo, verifica origen/licencia, deja en INBOX lo que no sabe
   clasificar.
6. **El cerebro consume solo índices**, nunca carpetas completas.

## 10. Regla principal
Forja debe usar la Knowledge Base como memoria técnica y visual consultable, no como una carpeta donde se acumula contenido sin control.
