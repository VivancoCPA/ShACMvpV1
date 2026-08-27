## Why

`Documento.qeVinculados` (backend: `Guid[]`) y `QualityEvent.documentosVinculados` (frontend: `string[]`) son campos fantasma: existen en el modelo de datos desde el PRD original, pero ningún handler ni componente los puebla nunca — solo aparecen precargados en fixtures estáticos. Como consecuencia, dos piezas reales quedan bloqueadas: RN-DOC-005 (no obsoletizar un documento vinculado a un QE activo) no tiene ningún dato real que evaluar, y `AuditorDashboardData.evidenciasHallazgos` es un sentinel fijo (`{ conEvidencia: 0, sinEvidencia: total }`) documentado explícitamente como diferido hasta que exista esta vinculación. Verificado contra el código real de `ShcMvpEndPoint` y `shc-controldoc`: no existe tabla puente, no existen los 4 endpoints de vincular/desvincular, y no existe ningún flujo de UI en ninguno de los dos detalles (Documento, Quality Event) que permita poblar estos campos — ni siquiera como diseño no implementado.

Este cambio construye la vinculación real Documento↔QE de punta a punta: tabla puente en el backend, 4 endpoints simétricos, RN-DOC-005 evaluada en el punto real donde un documento pasa a `OBSOLETO`, el cómputo real de `evidenciasHallazgos`, y la UI nueva (en ambos detalles) que hoy no existe en ningún lado. El vínculo Documento↔NoConformidad (mismo patrón fantasma, confirmado en `NCForm.tsx`) queda fuera de alcance — es un tercer par independiente para un cambio de seguimiento futuro si se decide construirlo.

## What Changes

- Nueva tabla puente `DocumentoQualityEvent` (`DocumentoId`, `QualityEventId`, `EmpresaId`, `CreadoPorId`, `CreadoEn`), clave primaria compuesta — reemplaza la columna `Documento.QeVinculados: Guid[]` (se elimina, no queda en paralelo).
- 4 endpoints nuevos, simétricos desde ambos dominios sobre la misma tabla: `POST`/`DELETE /api/documents/:id/qe-vinculados[/:qualityEventId]` y `POST`/`DELETE /api/quality-events/:id/documentos-vinculados[/:documentoId]`. Creación idempotente (`200` si ya existía), `404` uniforme cross-empresa en ambos ids.
- `GET /api/documents/:id` y `GET /api/quality-events/:id` devuelven la lista de vínculos poblada con un resumen suficiente para renderizar sin una segunda llamada (`{ id, codigo, titulo, estado }` por documento; `{ id, numero, tipo, severidad, estado }` por QE) — no solo el id crudo.
- **BREAKING** (interno, sin backend real desplegado todavía): `Documento.qeVinculados` pasa de `string[]` (ids) a `QeVinculadoResumen[]`; `QualityEvent.documentosVinculados` pasa de `string[]` a `DocumentoVinculadoResumen[]`. `QualityEvent` (backend .NET) gana el campo `DocumentosVinculados`, que hoy no existe en absoluto en `Domain/Entities/QualityEvent.cs`.
- **Corrección de RN-DOC-005** (no solo "ahora real" — reubicada): hoy la única condición que cita "RN-DOC-005" en el backend bloquea `DELETE /api/documents/:id` (comparación literal de longitud de array), y el backend **no tiene ningún endpoint que transicione manualmente a `OBSOLETO`** — esa transición solo ocurre automáticamente dentro de `FirmarPublicarDocumentoHandler`, al publicar una nueva versión, sin ninguna validación de vínculos hoy. El mock (`documents.handlers.ts`) sí implementa RN-DOC-005 correctamente en ese punto. Este cambio mueve la validación real de RN-DOC-005 a `FirmarPublicarDocumentoHandler` (bloquea la obsoletización automática de la versión previa si tiene un vínculo a un QE cuyo estado no es `CERRADO` ni `VERIFICADO`) y conserva el guard de `DELETE` como una regla de integridad aparte (ya no rotulada RN-DOC-005), migrada a leer la tabla puente en vez del array eliminado.
- `DashboardSummaryBuilder.BuildAuditor`/`EvidenciasHallazgos`: reemplaza el sentinel `(0, total)` por el cómputo real contra la tabla puente.
- UI nueva en ambos detalles (no existe hoy en ninguno): combobox de búsqueda con debounce + selección múltiple con chips para vincular, sección colapsable de solo-lectura listando los vínculos existentes. El banner ya existente en `DocumentDetailHeader.tsx` (`qeVinculados.length > 0`) se mantiene, cambiando solo su fuente de datos.
- Dado que el frontend real de Documentos/QE todavía corre exclusivamente contra MSW en desarrollo (ningún cambio de backend anterior — `be-documentos`, `be-quality-events`, `be-dashboards` — conectó el frontend a su API real), este cambio también agrega los 4 handlers MSW nuevos (mismo contrato que el backend real) y actualiza `documents.fixtures.ts`/`quality-events.fixtures.ts` a la forma de objeto enriquecido, para que la UI nueva sea usable y verificable en el navegador — requisito de los Criterios de Aceptación Globales ("Handler MSW presente para cada endpoint consumido").

## Capabilities

### New Capabilities
- `documento-qe-vinculacion`: mecanismo de vinculación Documento↔QE — tabla puente, los 4 endpoints simétricos (creación idempotente, eliminación, 404 cross-empresa), el resumen poblado en ambos `GET :id`, RN-DOC-005 real en el punto de obsoletización automática, y el componente combobox compartido (búsqueda con debounce, selección múltiple con chips, mutación optimista sin botón "Guardar").

### Modified Capabilities
- `be-documentos-api`: `GET /api/documents/:id` incluye `qeVinculados` poblado desde la tabla puente (ya no el array `QeVinculados` crudo). RN-DOC-005 se reubica de `DELETE` a la obsoletización automática en `FirmarPublicarDocumentoHandler`. El guard existente de `DELETE` se conserva como regla de integridad independiente (ya no citada como RN-DOC-005), migrada a la tabla puente.
- `be-quality-events-api`: `QualityEvent` gana `DocumentosVinculados` (no existía); `GET /api/quality-events/:id` lo devuelve poblado desde la tabla puente.
- `be-dashboard-api`: `AuditorDashboardData.evidenciasHallazgos` deja de ser el sentinel `(0, total)` y se calcula contra la tabla puente real.
- `document-types`: `Documento.qeVinculados` cambia de `string[]` a `QeVinculadoResumen[]`.
- `quality-event-types`: `QualityEvent.documentosVinculados` cambia de `string[]` a `DocumentoVinculadoResumen[]`.
- `document-api-client`: nuevas funciones para `POST`/`DELETE .../qe-vinculados`.
- `quality-event-api`: nuevas funciones para `POST`/`DELETE .../documentos-vinculados`.
- `document-detail`: nueva sección colapsable de QE vinculados + combobox para agregar; el banner de `DocumentDetailHeader` cambia su fuente de datos (de ids crudos a `qeVinculados` poblado).
- `quality-event-detail-page`: nueva sección colapsable de documentos vinculados + combobox para agregar.
- `document-msw-handlers`: nuevos handlers `POST`/`DELETE .../qe-vinculados`, mismo contrato que el backend real.
- `document-msw-fixtures`: `qeVinculados` migra de `string[]` a objetos enriquecidos.
- `quality-event-msw-handlers`: nuevos handlers `POST`/`DELETE .../documentos-vinculados`, mismo contrato que el backend real.
- `quality-event-msw-fixtures`: `documentosVinculados` migra de `string[]` a objetos enriquecidos.

## Impact

- Backend (`ShcMvpEndPoint`): nueva entidad + migración EF Core (tabla puente, DropColumn de `Documento.QeVinculados`), 4 endpoints nuevos (`Features/Documentos/VincularQE`, `Features/QualityEvents/VincularDocumento` o equivalente), cambios en `EliminarDocumentoHandler`, `FirmarPublicarDocumentoHandler`, `ObtenerDocumentoHandler`/`ObtenerQualityEventHandler` (Dapper, resumen poblado igual que `AccionesCorrectivas` en QE), `DashboardSummaryBuilder.BuildAuditor` + `DashboardDataFetcher`, `Domain/Entities/QualityEvent.cs` (nuevo campo), `Extensions/EndpointExtensions.cs` (registro de 4 endpoints).
- Frontend (`shc-controldoc`): nuevo componente combobox compartido, `documents.types.ts`, `qualityEvent.types.ts`, `DocumentDetailPage.tsx`/`DocumentDetailHeader.tsx`, `QualityEventDetail.tsx`, `documents.api.ts`, `quality-events.api.ts`, nuevos hooks TanStack Query, `documents.handlers.ts`, `quality-events.handlers.ts`, `documents.fixtures.ts`, `quality-events.fixtures.ts`, claves i18n nuevas en `es-PE.json`/`en-US.json` (namespaces `documents`/`qualityEvents`).
- Fuera de alcance: vínculo Documento↔NoConformidad (mismo patrón fantasma, tercer par independiente); cualquier cambio a `NoConformidad.documentosVinculados`.
- Decisión pendiente de confirmación explícita antes de `/opsx:apply` (documentada en `design.md`): quién puede vincular/desvincular desde el lado QE — el backend real no tiene hoy ningún resolver de permisos por-QE (a diferencia de `DocumentPermissionResolver` en Documentos); `PATCH /api/quality-events/:id` genérico solo exige autenticación, sin gate de rol.
