# FASE V26 — Persistencia y actualización incremental del índice

Forja Search (V25) ya no tiene que reconstruir el índice en cada sesión.

## Qué añade

- Persistencia del snapshot en IndexedDB cuando está disponible (`forja-search-persistence.ts`).
- Fallback en memoria para SSR/tests: sin `indexedDB` global, todo sigue funcionando dentro del mismo proceso.
- Huella estable por documento (`fingerprint()`, FNV-1a sobre id+path+texto+metadata) para detectar cambios sin comparar el texto entero.
- Actualización incremental (`syncForjaSearchIndex`): altas, modificaciones y bajas contra lo guardado la vez anterior.
- Restauración del índice al volver a abrir Forja (`loadForjaSearchIndex`), sobre una instancia nueva de `ForjaSearchIndex`.
- `ForjaSearchIndex.getDocumentIds()`: para que quien sincroniza sepa qué hay indexado ahora sin llevar esa lista por su cuenta.
- No se guardan credenciales de MEGA/GitHub ni más contenido remoto que el que el índice ya representaba antes de esta fase.

## Flujo

`proyecto → documentos → fingerprint → diff contra lo guardado → altas/cambios/bajas al índice → persistir snapshot`

La capa semántica, Bundles y Recipes siguen encima del índice tal como lo dejó V25; V26 solo evita el coste de reconstruirlo entero en cada sesión.

## Qué NO cambia de V25

Esta fase llegó junto con una copia de `forja-search.ts` anterior a la revisión de V25 (sin el filtro de trigramas de frontera y con los postings otra vez dentro del snapshot — ver "Bugs corregidos en la revisión" en `FASE-V25-FORJA-SEARCH.md`). Esa parte **no se adoptó**: `forja-search-persistence.ts` es un módulo aparte que solo llama a `index.snapshot()`/`index.restore()` como caja negra, así que la persistencia funciona igual con la forma actual (ya corregida) del snapshot, sin reintroducir ninguno de esos dos bugs.

## Archivos

- `src/lib/forja/forja-search-persistence.ts` — `syncForjaSearchIndex`, `loadForjaSearchIndex`, `clearPersistedForjaSearchIndex`.
- `src/lib/forja/forja-search.ts` — `getDocumentIds()`.
- Tests: `tests/unit/forja-search-persistence.test.ts` (altas/cambios/bajas, recuperar tras "cerrar y volver a abrir", borrado) y el caso nuevo en `tests/unit/forja-search.test.ts`.

## Pendiente (fuera de esta fase)

Ni V25 ni V26 conectan todavía `syncForjaSearchIndex`/`loadForjaSearchIndex` a un caller real de la app — `buildProjectSearchIndex` (`kb-project-retrieval.ts`) sigue construyendo el índice desde cero cada vez que se llama. Cablear la persistencia a ese punto de entrada queda para una fase posterior.
