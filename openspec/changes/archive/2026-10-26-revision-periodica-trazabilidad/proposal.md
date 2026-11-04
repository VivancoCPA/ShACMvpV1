## Why

Cuando llega (o pasa) la fecha de revisión periódica de un documento `PUBLICADO`, hoy no pasa nada observable: `VencimientoScanner.EscanearDocumentosAsync` solo envía una notificación de preaviso una única vez en la vida del documento (nunca se repite en ciclos siguientes, porque la idempotencia se evalúa sin importar la fecha), no distingue "se acerca" de "ya venció", no filtra por estado (alerta incluso en BORRADOR/OBSOLETO), calcula "hoy" en UTC del servidor en vez de Lima, y nunca deja constancia en el audit trail del documento. El detalle del documento tampoco muestra ningún aviso — solo el semáforo visual en el encabezado/listado, que no es evidencia ni notifica a nadie.

## What Changes

- **Decisión de Toño (2026-10-07, opción B):** el inicio de la revisión periódica sigue siendo manual (sin cambio automático de estado); el sistema deja constancia en el log cuando la fecha vence y avisa en el detalle.
- `EscanearDocumentosAsync`: solo documentos `PUBLICADO` (no eliminados, con `FechaRevisionProxima`); "hoy" calculado en `America/Lima`; distingue preaviso (≤30 días) de vencido (fecha alcanzada o pasada); el vencido escribe **una** entrada `REVISION_PERIODICA_VENCIDA` en el audit trail (actor "Sistema") y envía una notificación distinta; idempotencia por **ciclo** (documento + `FechaRevisionProxima` vigente + tipo de aviso), para que confirmar la vigencia con una fecha nueva vuelva a habilitar los avisos del ciclo siguiente.
- Migración: nueva columna `CicloClave` en `Notificacion` (default `""`, preserva la idempotencia actual de AC/NC/QE sin cambios) y el índice único parcial de vencimiento pasa a incluir esa columna.
- `CambiarEstadoDocumentoHandler`, transición `PUBLICADO → EN_REVISION_PERIODICA`: registra `REVISION_PERIODICA_INICIADA` (no `ESTADO_CAMBIADO` genérico) con un motivo calculado server-side según cuán cerca esté la fecha de revisión.
- Detalle del documento: aviso visible para cualquier lector — ámbar (≤30 días), rojo (vencida), informativo (ya en `EN_REVISION_PERIODICA`, con quién la inició y cuándo). El botón "Iniciar revisión periódica" (ya existente, solo JCA/JCD) queda donde está, junto al título — no se duplica dentro del aviso.
- `DocumentHistorial`/`DocumentAuditTrail`: nuevas etiquetas i18n y entrada en la lista de acciones relevantes para `REVISION_PERIODICA_VENCIDA` y `REVISION_PERIODICA_INICIADA`.
- MSW: mismas reglas en `generateVencimientoNotifications` (clave de idempotencia por ciclo) y fixtures con un documento `PUBLICADO` vencido y uno `EN_REVISION_PERIODICA`, para poder ver el aviso en modo mock.

**Dependencia de orden:** este change toca `ConfirmarRevisionPeriodicaHandler`'s vecino (`CambiarEstadoDocumentoHandler`) y el mismo modal de revisión periódica que `revision-periodica-fecha-editable`. Se implementa **después** de que ese change esté archivado, para no pisar el mismo código en paralelo.

## Capabilities

### Modified Capabilities
- `be-notifications-api`: requirement del escáner de vencimiento de Documentos — filtro por estado, cálculo en Lima, distinción preaviso/vencido, entrada de audit trail, idempotencia por ciclo. Nueva columna `CicloClave` en `Notificacion` y ajuste del índice único.
- `be-documentos-api`: requirement "Cambio de estado sin firma" — la transición `PUBLICADO → EN_REVISION_PERIODICA` gana su propia acción (`REVISION_PERIODICA_INICIADA`) y motivo calculado.
- `document-detail`: requirement "DocumentDetailHeader contextual banners" (nuevos avisos de revisión periódica) y "DocumentAuditTrail section" (iconos/fallback para las 2 acciones nuevas).
- `document-revision-periodica`: nuevo requirement para el helper compartido de "nivel de alerta" (reusado por `RevisionSemaforo` y el nuevo aviso del detalle).
- `notification-generation`: mismo ajuste de idempotencia por ciclo en el MSW `generateVencimientoNotifications`.

## Impact

- `ShcMvpEndPoint/Features/Notifications/Shared/VencimientoScanner.cs`.
- `ShcMvpEndPoint/Features/Documentos/CambiarEstadoDocumento/CambiarEstadoDocumentoHandler.cs`.
- `ShcMvpEndPoint.Domain/Entities/Notificacion.cs` + migración EF Core (nueva columna + índice).
- `shc-controldoc/src/features/documents/components/DocumentDetailHeader.tsx`, `DocumentHistorial.tsx`, `DocumentAuditTrail.tsx`.
- `shc-controldoc/src/features/documents/components/RevisionSemaforo.tsx` (reusa el helper compartido de nivel de alerta, sin cambiar su comportamiento visual).
- Nuevo helper compartido de "nivel de alerta de revisión periódica" (frontend).
- `shc-controldoc/src/mocks/fixtures/notificationGeneration.ts`, `documents.fixtures.ts` (2 fixtures nuevas).
- `shc-controldoc/src/i18n/es-PE.json`, `en-US.json`.
- Tests de integración backend y unitarios/componente frontend.
