## Why

Después de abrir el visor ("Ver documento") o descargar la copia controlada ("Descargar copia (PDF)"), el audit trail del documento no muestra la entrada nueva (`VISUALIZACION`/`DESCARGA`) hasta que el usuario sale del detalle y vuelve a entrar. `lib/queryClient.ts` tiene `refetchOnWindowFocus: false`, y ninguna de esas dos acciones invalida `QUERY_KEYS.documents.detail(id)` — a diferencia de todas las demás mutaciones del módulo (firmar, reemplazar original, confirmar revisión, etc.), que sí lo hacen.

## What Changes

- `useExportarPdfControlado`: invalida `documents.detail(id)` en `onSuccess`, después de disparar la descarga.
- `DocumentViewer`: invalida `documents.detail(documentoId)` exactamente una vez por apertura exitosa del visor, dentro de la misma `queryFn` (no vía `useEffect`) — sin que eso dispare una segunda carga del propio visor.
- `useNotificationsHub`: cuando llega un evento `notificacionNueva` cuya `entidadTipo === 'DOCUMENTO'`, invalida `documents.detail(entidadId)` y `documents.all` — para que la acción de **otro usuario** sobre el mismo documento (p.ej. el revisor aprueba mientras el autor tiene el detalle abierto) se refleje sin recargar.
- Barrido de cualquier otra acción que escriba en el audit trail de un documento sin invalidar su detail — documentado en `design.md`.

## Capabilities

### Modified Capabilities
- `document-viewer`: "Ver documento" invalida el detalle del documento tras una carga exitosa del visor.
- `document-detail`: la descarga de la copia controlada invalida el detalle tras completarse; las notificaciones en tiempo real sobre un documento invalidan su detalle.

## Impact

- Frontend (`shc-controldoc`): `features/documents/hooks/useDocumentActions.ts`, `features/documents/components/DocumentViewer.tsx`, `features/notifications/hooks/useNotificationsHub.ts`.
- Sin cambios de backend ni de contrato — es un fix de invalidación de caché en el cliente.
