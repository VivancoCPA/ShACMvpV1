// Constantes compartidas entre `src/sw.ts` (Service Worker, tsconfig.sw.json,
// lib WebWorker) y el hilo principal (tsconfig.app.json, lib DOM) — sin
// depender de ninguna API específica de uno u otro contexto, para que ambos
// puedan importar este módulo sin conflicto de `lib`.
export const SYNC_TAG_INCIDENTS = 'sync-incidents'
export const SYNC_MESSAGE_TYPE = 'sync-incidents'
