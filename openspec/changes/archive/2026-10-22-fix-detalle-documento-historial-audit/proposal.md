## Why

El detalle de cualquier documento real crashea: `DocumentHistorial.tsx:23` hace `documento.historialVersiones.map(...)`, pero la entidad real `Documento.cs` no tiene ese campo — el backend modela versiones como filas separadas enlazadas por `VersionAnteriorId`, no como un array embebido. Nunca falló con MSW porque el fixture siempre lo envía. Al corregir esto se descubrió un segundo problema, silencioso: `ObtenerDocumentoHandler` nunca consulta `documento_audit_trail`, así que `auditTrail` siempre llega `[]` desde el backend real — el panel de Audit Trail se ve "sin entradas" aunque la tabla tenga filas, el historial de estados nunca muestra la creación, y la pestaña Versiones nunca muestra quién publicó. Esto no es cosmético: el audit trail es la evidencia de trazabilidad de ISO 9001 §7.5 (RN-DOC-008) — hoy se graba bien pero no se puede ver.

## What Changes

- Se elimina `historialVersiones`/`VersionEntry` del contrato (tipos TS, MSW, fixtures, tests). El historial de versiones reales ya lo resuelve `DocumentVersionesTab` vía `GET /api/documents?codigo=`; no se duplica.
- `DocumentHistorial.tsx` ("Historial de estados") se reconstruye a partir de `documento.auditTrail`: creación, transiciones de estado, firma/publicación y (si aporta) nueva versión/restauración.
- `ObtenerDocumentoHandler` pasa a poblar `Documento.AuditTrail` con las filas reales de `documento_audit_trail`, ordenadas por `timestamp`. `ListarDocumentosHandler` sigue devolviendo `auditTrail: []` en general (mismo criterio que `QeVinculados`/`NcVinculados`, evita N+1 en listados paginados) — **excepto** cuando el listado está filtrado por `codigo` (la consulta que arma la pestaña Versiones), donde el resultado está acotado a las versiones de un solo documento y sí se puebla, porque de lo contrario "quién publicó" en Versiones queda permanentemente vacío — ver `design.md` D2 para el razonamiento y la divergencia explícita respecto al texto original del pedido.
- `AuditTrailEntry` (tipo TS de Documentos) deja `entidadTipo`/`entidadId`/`ipOrigen` opcionales: no existen en `DocumentoAuditTrail.cs` y el backend no los va a inventar.
- Barrido de todo el contrato `Documento` TS contra `DocumentoSqlHelpers.SelectColumns` + lo poblado a mano: se documentan divergencias adicionales encontradas (`fechaObsolescencia`, `archivoUrl`, `tipoArchivo`, `hashArchivo` — ninguno existe en el backend) como hallazgos, sin corregirlos aquí salvo que rompan o se vean mal en el detalle.

## Capabilities

### Modified Capabilities
- `document-types`: se elimina `VersionEntry` y `Documento.historialVersiones`; `AuditTrailEntry.entidadTipo/entidadId/ipOrigen` pasan a opcionales.
- `document-detail`: `DocumentHistorial` se reconstruye desde `auditTrail` en vez de `historialVersiones`.
- `be-documentos-api`: `GET /api/documents/:id` devuelve el audit trail real; el listado general sigue en `[]`; el listado filtrado por `codigo` (versiones) también lo puebla.

## Impact

- Backend: `Features/Documentos/ObtenerDocumento/ObtenerDocumentoHandler.cs`, `Features/Documentos/ListarDocumentos/ListarDocumentosHandler.cs`, nuevo helper compartido de carga de audit trail en `Features/Documentos/Shared/`; tests de integración.
- Frontend: `types/documents.types.ts`, `features/documents/components/DocumentHistorial.tsx` (+ test), `mocks/handlers/documents.handlers.ts`, `mocks/fixtures/documents.fixtures.ts` (~30 entradas pierden `historialVersiones`), y cada test que hoy incluye `historialVersiones: []` en un `Documento` de prueba.
- Sin cambios de esquema de base de datos ni de contrato para el resto de campos de `Documento`.
- Desbloquea: las filas "a confirmar" de `design.md` de `fix-fechas-utc` (NC, ACs, `reporteExternoRef`) y la tarea 6.3 de `documentos-revisor-aprobador-reales`, ambas paradas por este crash del detalle.
