## 1. Barrido (confirmado en design.md)

- [x] 1.1 Confirmar que `useExportarPdfControlado` es el único hook de `useDocumentActions.ts` que no invalida `documents.detail`/`documents.all` en su `onSuccess` (12 de 13 ya lo hacen). Sin hallazgos adicionales.

## 2. Frontend — invalidaciones

- [x] 2.1 `useExportarPdfControlado`: en `onSuccess`, después de disparar la descarga, invalidar `QUERY_KEYS.documents.detail(variables.id)` (usar `variables`, el `Documento` completo que recibe `mutationFn`).
- [x] 2.2 `DocumentViewer`: dentro de la `queryFn` de `useQuery(['documents', 'visor', documentoId], ...)`, después del `await getDocumentVisorBlob(documentoId)` exitoso, invalidar `QUERY_KEYS.documents.detail(documentoId)` vía `useQueryClient()`. Confirmar que no se dispara una segunda carga del propio visor como consecuencia (su query key es independiente).
- [x] 2.3 `useNotificationsHub`: en el handler de `"notificacionNueva"`, si `notificacion.entidadTipo === 'DOCUMENTO'`, invalidar `QUERY_KEYS.documents.detail(notificacion.entidadId)` y `QUERY_KEYS.documents.all`.

## 3. Tests (frontend)

- [x] 3.1 `useExportarPdfControlado`: al descargar la copia, se invalida `documents.detail(id)` (spy sobre `queryClient.invalidateQueries`).
- [x] 3.2 `DocumentViewer`: al cargar exitosamente, se invalida `documents.detail(id)` exactamente una vez, y `getDocumentVisorBlob` se invoca una sola vez (la invalidación no reabre el visor).
- [x] 3.3 `DocumentViewer`: si la carga falla (403/404/422), no se invalida `documents.detail`.
- [x] 3.4 `useNotificationsHub`: evento `notificacionNueva` con `entidadTipo: 'DOCUMENTO'` invalida `documents.detail`/`documents.all`; con otro `entidadTipo`, no.

## 4. Verificación final

- [x] 4.1 `tsc --noEmit` completo: limpio. Suite `vitest` completa NO corrida (decisión explícita del usuario, mismo criterio que en `proteccion-documental`: riesgo de muerte por memoria baja) — en su lugar, los 3 archivos de test afectados corridos de forma targeted: 18/18 passing (`useExportarPdfControlado.test.tsx`, `DocumentViewer.test.tsx`, `useNotificationsHub.test.ts`).
- [ ] 4.2 Prueba manual (MSW apagado): abrir un documento publicado con el log desplegado, pulsar "Ver documento" → aparece "Visualización" en el log sin salir del detalle.
- [ ] 4.3 Prueba manual: pulsar "Descargar copia (PDF)" → aparece "Descarga" en el log sin salir del detalle.
- [ ] 4.4 Prueba manual (dos sesiones/navegadores, autor y revisor): el revisor aprueba el documento mientras el autor tiene el detalle abierto → el detalle del autor se actualiza solo (sin recargar).
