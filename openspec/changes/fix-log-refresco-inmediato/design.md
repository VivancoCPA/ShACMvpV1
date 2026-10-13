## Context

Confirmado leyendo el código real:
- `lib/queryClient.ts:8` tiene `refetchOnWindowFocus: false` — la query `documents.detail(id)` solo se refresca si algo la invalida explícitamente.
- Barrido completo de `useDocumentActions.ts`: de 13 hooks de mutación, **12 ya invalidan `documents.detail`/`documents.all`** correctamente (`useChangeStatus`, `useSignDocument`, `useDeleteDocument`, `useCreateNuevaVersion`, `useRestaurarDocumento`, `useGetArchivoOriginalUrl`, `useReplaceArchivoOriginal`, `useConfirmarRevisionPeriodica`, `useVincularQE`, `useDesvincularQE`, `useVincularNC`, `useDesvincularNC`). Solo **`useExportarPdfControlado` no invalida nada** — confirma exactamente el diagnóstico del documento de instrucciones, sin hallazgos adicionales en este archivo.
- `DocumentViewer.tsx` usa `useQuery(['documents', 'visor', documentoId], ...)`, independiente de `documents.detail` — su éxito nunca invalida el detalle.
- `useNotificationsHub.ts` ya recibe `Notificacion.entidadTipo`/`entidadId` por el evento `notificacionNueva` (confirmado en `types/notification.types.ts`) — soporta el punto 4 sin cambios de backend.
- La impresión desde el visor (`DocumentViewer.handlePrint`) no llama a ningún endpoint ni escribe en el audit trail en el estado actual del código — no hay nada que invalidar ahí todavía (ese registro lo introduce `copias-controladas`, fuera de alcance de este change).

## Goals / Non-Goals

**Goals:** que el audit trail de un documento se vea actualizado sin recargar la página tras ver/descargar un documento, o tras una acción de otro usuario sobre ese mismo documento.

**Non-Goals:** no se cambia `refetchOnWindowFocus` global (afectaría a toda la app, explícitamente descartado por Toño). No se agrega ningún evento nuevo de SignalR en el backend — solo se consume el que ya existe.

## Decisions

### D1 — `useExportarPdfControlado`: invalidar en `onSuccess`, usando `variables`
`mutationFn` recibe el `Documento` completo (no solo el id) — `onSuccess(data, variables)` tiene `variables.id` disponible sin cambiar la firma del hook.

### D2 — `DocumentViewer`: invalidar dentro de la propia `queryFn`, después del `await`
Siguiendo la recomendación del documento de instrucciones: `queryFn: async () => { const blob = await getDocumentVisorBlob(documentoId); queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.detail(documentoId) }); return blob }`. Esto invalida exactamente una vez por ejecución exitosa de la queryFn (una apertura = una ejecución, gracias a `staleTime: 0` + la query key fija por `documentoId` — React Query no reintenta por sí sola tras un éxito).

**Riesgo de bucle descartado**: invalidar `documents.detail` marca esa query como stale y la vuelve a pedir si algo la está observando (el panel de acciones), pero no desmonta ni vuelve a montar `DocumentViewer` — su propia query (`['documents', 'visor', documentoId]`) es independiente y no depende de `documents.detail`. El panel que lo contiene no pasa `documento` como prop al visor de una forma que fuerce un remount (el visor solo recibe `documentoId`, un string estable). Verificado además con el test de "una sola invocación de `getDocumentVisorBlob`" (ver Tests).

### D3 — `useNotificationsHub`: invalidar por `entidadTipo === 'DOCUMENTO'`
Dentro del handler existente de `notificacionNueva`, además de lo que ya hace (toast + `setQueryData` de la lista de notificaciones), si `notificacion.entidadTipo === 'DOCUMENTO'` invalida `documents.detail(notificacion.entidadId)` y `documents.all`. Mismo patrón, extensible a otros `entidadTipo` en el futuro si se necesita (fuera de alcance aquí — solo `DOCUMENTO`, que es lo que pide el documento de instrucciones).

## Risks / Trade-offs

- **R1 — Invalidar en cada notificación `DOCUMENTO` puede disparar un refetch que el usuario no está mirando** (si tiene la lista de documentos abierta, no el detalle). Aceptado: es el mismo costo que ya paga cualquier otra invalidación de `documents.all` en el resto del módulo.

## Open Questions

Ninguna — alcance acotado y ya verificado contra el código real.
