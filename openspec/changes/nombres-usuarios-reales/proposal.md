## Why

Seis componentes de producción (Documentos, QE, NC) y el exportador de PDF de QE resuelven nombres de usuario con `resolveUserDisplayName`, que busca el id en el store **mock** (`authFixtures`/`seedLegacyNames`) y, si no lo encuentra, devuelve el id crudo. Contra el backend real ningún id existe en ese store mock, así que todo usuario referenciado (autor, revisor, aprobador, reportante, aprobador de causa raíz, detectado por) se muestra como un GUID. `GET /api/users` no sirve como reemplazo: está restringido a `ADMINISTRADOR_EMPRESA`/`SUPERADMIN`, y la mayoría de roles que ven estas pantallas (JCA, JCD, DIR, OPERARIO, SUPERVISOR) no tienen ese acceso.

## What Changes

- **Nuevo endpoint** `GET /api/users/nombres?ids=<guid>,<guid>,...`: cualquier usuario autenticado con empresa activa puede resolver nombres (`id`, `nombreCompleto`) de otros usuarios de su misma empresa, incluidos inactivos o con asignación inactiva (un documento firmado por alguien que ya se fue debe seguir mostrando su nombre). Un id de otra empresa o inexistente simplemente no aparece en la respuesta — no es error. Límite de 100 ids por request (400 si se excede o si un id es inválido).
- **Hook compartido `useUserNames(ids)`** (TanStack Query, fuera de `mocks/`): deduplica y ordena ids para una query key estable, agrupa todos los ids que necesita una pantalla en una sola llamada, expone un resolvedor `getName(id)`, muestra un placeholder corto mientras carga y un texto i18n genérico ("Usuario no disponible") para ids que el backend no resolvió — nunca el GUID crudo.
- **Migración de los 6 componentes React** que hoy importan `resolveUserDisplayName` desde `mocks/fixtures/userIdentity.fixtures` (`DocumentDetailHeader`, `DocumentActionPanel`, `QEHeaderSection`, `QEInvestigationSection`, `QualityEventForm`, `NonconformityDetailPage`) al hook nuevo, consolidando a una sola llamada por pantalla donde hoy hay varias (Documentos: autor+revisor+aprobador en una sola).
- **`buildQualityEventPdf.ts`** (no es un componente) deja de importar `resolveUserDisplayName`: recibe los nombres ya resueltos como un mapa `id → nombre`, provisto por el componente que dispara la exportación.
- **`NonconformityDetailPage`** además deja de usar `getUsersStore()` del mock para `detectadoPorId` (hoy muestra `"{nombre} {apellido} (rol)"`); pasa a usar el hook nuevo, perdiendo el rol en pantalla (el endpoint nuevo no expone rol — ver Impact).
- **MSW**: nuevo handler para el endpoint, filtrando el store mock de usuarios por empresa activa con la misma regla de inclusión (activo/inactivo, asignación activa/inactiva) que el backend real.
- **`resolveUserDisplayName`** queda restringido a uso interno de mocks/tests una vez migrados los 6 consumidores — ninguna importación fuera de `src/mocks/` o `*.test.*`.

## Capabilities

### New Capabilities
- `user-names-lookup`: endpoint `GET /api/users/nombres`, regla de resolución multi-tenant (incluye inactivos), hook `useUserNames`, handler MSW y contrato de tipos.

### Modified Capabilities
- `shared-user-identity`: `resolveUserDisplayName`/`seedLegacyNames` pasan a ser de uso exclusivo de mocks y tests; ningún módulo de `src/features/` puede importarlos.
- `document-detail`: `DocumentDetailHeader` (Autor/Revisor/Aprobador) y `DocumentActionPanel` (Aprobador en el preview de PDF) resuelven nombres vía `useUserNames`, no vía el store mock.
- `quality-event-detail-page`: `QEHeaderSection` resuelve el nombre de `reportadoPorId` vía `useUserNames`.
- `quality-event-investigation`: el sello de aprobación de causa raíz resuelve `causaRaizAprobadaPorId` vía `useUserNames`.
- `quality-event-pdf-export`: `buildQualityEventPdf` recibe los nombres resueltos (reportante, aprobador de causa raíz) como parte de `QEExportMeta`, en vez de resolverlos internamente.
- `quality-event-batch-pdf-export`: el loop de exportación masiva resuelve con una sola llamada `useUserNames` los nombres de todas las QEs seleccionadas antes de invocar `buildQualityEventPdf` por cada una.
- `quality-event-form`: el modo edición resuelve el nombre de `reportadoPorId` (campo de solo lectura) vía `useUserNames`.

### New capability (NC, sin spec previa)
- `nonconformity-detail-page`: primera spec para `NonconformityDetailPage` en lo referente a la visualización de `detectadoPorId` — resuelto vía `useUserNames`, sin el sufijo de rol que mostraba el acceso directo al store mock.

## Impact

- Backend: nuevo `Features/Users/NombresUsuarios/` (Endpoint + Handler Dapper), tests de integración en `ShcMvpEndPoint.Tests/Features/Users/`.
- Frontend: nuevo hook en `features/users/hooks/useUserNames.ts`, función en `api/endpoints/users.api.ts`, handler en `mocks/handlers/users.handlers.ts`; cambios en los 6 componentes listados más `buildQualityEventPdf.ts` y su único invocador (`QEHeaderSection`); i18n (`users` o `common`, es-PE/en-US) para el placeholder de carga y el texto "no disponible".
- Pérdida de información: el rol mostrado junto a `detectadoPorId` en `NonconformityDetailPage` desaparece (el endpoint nuevo no expone rol por diseño — superficie mínima). Se documenta como decisión aceptada, no como bug.
- Sin cambios de esquema de base de datos.
