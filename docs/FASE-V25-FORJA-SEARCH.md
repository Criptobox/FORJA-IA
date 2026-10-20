# FASE V25 — Forja Search Engine

## Objetivo

Añadir una capa de búsqueda rápida basada en índice de trigramas para reducir el universo de candidatos antes del ranking estructural/semántico.

La implementación es propia y está inspirada conceptualmente en la estrategia de índices persistentes de herramientas como `tgrep`; no copia su implementación.

## Flujo

1. Project Manifest / Knowledge Base genera documentos compactos.
2. `ForjaSearchIndex` crea postings por trigramas.
3. La consulta devuelve candidatos rápidamente.
4. `kb-project-retrieval` usa esos candidatos como pre-filtro (`buildProjectSearchIndex` + el tercer parámetro opcional de `retrieveProjectKnowledge`).
5. El ranking existente conserva la decisión final.
6. Bundles y Recipes reciben solamente los candidatos relevantes.

## Actualización incremental

El índice soporta `add`, `addMany`, `remove` y `clear`. Un documento modificado se reemplaza sin reconstruir los demás.

## Persistencia

`ForjaSearchIndex.snapshot()` produce un JSON serializable (solo los documentos) y `restore()` reconstruye el índice recalculando los trigramas. Esto deja preparada la persistencia local o en una futura caché del proyecto sin acoplarla a una base de datos.

## Límites

- máximo 250.000 caracteres indexados por documento;
- máximo 100 resultados por consulta;
- no se descarga contenido remoto para realizar esta búsqueda;
- no sustituye el ranking semántico ni la verificación del contenido.

## Integración con MEGA

La capa puede indexar los metadatos de los Project Manifest que ya tenemos para MEGA. La lectura del archivo remoto continúa ocurriendo únicamente después de seleccionar candidatos.

## Bugs corregidos en la revisión

**Dos palabras podían "coincidir" solo por compartir la primera o la última letra.** `grams()` acolcha el texto con 2 espacios a cada lado para anclar principio/fin de palabra, pero eso produce un trigrama de frontera (`"  x"` o `"x  "`) que codifica **un solo carácter real** junto a 2 espacios de relleno. Cualquier documento que empezara o terminara con esa misma letra lo compartía sin ninguna relación real de contenido: por ejemplo, `"Navbar"` y `"CartDrawer"` compartían el trigrama final `"r  "` solo por terminar ambos en "r". Confirmado empíricamente: el propio test que trae la fase (`índice.add("Navbar")` reemplazado por `índice.add("CartDrawer")`, luego `search("Navbar")` debía devolver 0 resultados) fallaba contra el código tal como venía, devolviendo el documento reemplazado igualmente. Ahora se descartan los trigramas con 2 o más espacios (sin señal real de contenido) al construir el índice y al consultar.

**El snapshot serializaba los postings de trigramas, pero `restore()` nunca los leía.** `restore()` siempre reconstruye los postings desde `documents` (misma función `grams()`), así que el campo `trigrams` del snapshot original era puro peso muerto — justo el tipo de índice/contexto gigante que esta misma fase promete evitar con sus límites de tamaño (un posting por cada trigrama único del corpus, con la lista completa de IDs que lo contienen). Se eliminó del snapshot; `restore()` sigue funcionando igual porque nunca dependió de ese campo.

**El pre-filtro de `kb-project-retrieval` buscaba el brief completo como una sola consulta.** Con un brief largo ("necesito ayuda urgente con el componente FilterDrawer roto en mi tienda"), los trigramas que cruzan límites de palabra sobre toda la frase diluyen el ratio de coincidencia de una palabra realmente relevante (p. ej. "FilterDrawer") entre trigramas irrelevantes de palabras vecinas — con un corpus grande, ese documento podría no entrar en el prefiltro aunque el ranking real sí lo hubiera encontrado, violando "el ranking existente conserva la decisión final". Ahora `indexedCandidateIds` busca cada palabra de `q.text` por separado (la misma tokenización que ya usa `scoreFile`/el scoring de proyecto), igual que ya hacía con `component`/`pattern`/`technology`.
