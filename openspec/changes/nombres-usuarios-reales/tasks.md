## 1. Backend — endpoint de nombres

- [x] 1.1 Confirmar nombres reales de tabla/columna (`asp_net_users`, `usuarios_empresa`) leyendo `DocumentoAsignacionService.cs`; anotar divergencias en design.md si las hay
- [x] 1.2 Crear `Features/Users/NombresUsuarios/` (Endpoint, Handler Dapper, `UserNombreDto { Id, NombreCompleto }`) con `RequireAuthorization()` + `RequireEmpresaActivaFilter`, sin restricción de rol
- [x] 1.3 Validar `ids`: parseo de la query string separada por comas, 400 si algún id no es GUID válido, 400 si hay más de 100 ids — antes de tocar la base de datos
- [x] 1.4 Query Dapper: `JOIN asp_net_users ⋈ usuarios_empresa` filtrando solo por `empresa_id = @EmpresaId AND id = ANY(@Ids)` — sin filtrar `activo` ni `estado` (D2); `DISTINCT` por posibles múltiples filas de asignación
- [x] 1.5 Registrar el endpoint en el mapeo de rutas y DI

## 2. Backend — tests de integración

- [x] 2.1 Resuelve usuarios de la empresa activa, incluidos inactivos (usuario inactivo, y asignación con `estado` ≠ `ACTIVO`)
- [x] 2.2 Omite ids de otra empresa e ids inexistentes, sin error ni 404 para esos ids específicos
- [x] 2.3 Nunca expone `email`, `rol` ni `avatarUrl` en la respuesta
- [x] 2.4 400 con un id malformado; 400 al superar 100 ids
- [x] 2.5 200 con array vacío cuando ningún id resuelve (todos de otra empresa / inexistentes)

## 3. Frontend — contrato, api y hook compartido

- [x] 3.1 Tipo `UserNombre { id: string; nombreCompleto: string }` (ubicación: `types/auth.types.ts` o `features/users/types/userManagement.types.ts`, el que ya centralice tipos de usuario)
- [x] 3.2 Función `getUserNames(ids: string[])` en `api/endpoints/users.api.ts` (`GET /api/users/nombres`, params `ids` join-by-comma)
- [x] 3.3 Hook `useUserNames(ids)` en `features/users/hooks/useUserNames.ts`: filtra nulos/undefined, dedupe + sort para query key estable, `staleTime` generoso, devuelve `{ getName(id), isLoading }`
- [x] 3.4 `getName` devuelve placeholder corto mientras `isLoading`, y el texto i18n genérico (`common:userNames.noDisponible`, es-PE/en-US) para un id no presente en la respuesta — nunca el id crudo
- [x] 3.5 Claves i18n nuevas en `common` (es-PE y en-US): `userNames.noDisponible`, placeholder de carga

## 4. Frontend — migrar los 6 componentes + el exportador de PDF

- [x] 4.1 `DocumentDetailPage`: una sola llamada `useUserNames([autorId, revisorId, aprobadorId])`; pasar `getName` como prop a `DocumentDetailHeader` y `DocumentActionPanel`
- [x] 4.2 `DocumentDetailHeader`: reemplazar `resolveUserDisplayName(autorId/revisorId/aprobadorId)` por el `getName` recibido por prop; quitar el import de `mocks/fixtures/userIdentity.fixtures`
- [x] 4.3 `DocumentActionPanel`: reemplazar `resolveUserDisplayName(aprobadorId)` en el preview de PDF por el `getName` recibido por prop; quitar el import de `mocks/`
- [x] 4.4 `QEHeaderSection`: `useUserNames([reportadoPorId])` para el campo "Reportado por"; al exportar PDF, agregar `causaRaizAprobadaPorId` a la misma llamada (o una llamada que cubra ambos ids) y pasar `reportadoPorNombre`/`causaRaizAprobadaPorNombre` dentro de `meta` a `buildQualityEventPdf`
- [x] 4.5 `QEInvestigationSection`: `useUserNames([causaRaizAprobadaPorId])` para el sello "Aprobado por"; quitar el import de `mocks/`
- [x] 4.6 `QualityEventForm` (modo edición): `useUserNames([reportadoPorId])` para el campo de solo lectura "Reportado por"; quitar el import de `mocks/`
- [x] 4.7 `buildQualityEventPdf.ts`: agregar `reportadoPorNombre: string` y `causaRaizAprobadaPorNombre?: string` a `QEExportMeta`; `drawCabecera`/`drawCausaRaiz` usan `meta.*` en vez de llamar `resolveUserDisplayName`; quitar el import de `mocks/`
- [x] 4.8 `QEList.tsx` (batch export): antes del loop, una sola `useUserNames` cubriendo la unión de `reportadoPorId`/`causaRaizAprobadaPorId` de todas las QEs seleccionadas; construir `meta` por QE con los nombres ya resueltos
- [x] 4.9 `NonconformityDetailPage`: reemplazar el bloque `getUsersStore().find(...)` + `resolveUserDisplayName(detectadoPorId)` por `useUserNames([detectadoPorId])`; el campo deja de mostrar el rol (ver design.md D7); quitar ambos imports de `mocks/`

## 5. Frontend — MSW

- [x] 5.1 Handler `GET /api/users/nombres` en `mocks/handlers/users.handlers.ts`: parsea `ids`, 400 por límite/formato, resuelve desde `getUsersStore()` filtrando por pertenencia a la empresa activa vía `getUsuarioEmpresaStore()` (sin filtrar `activo`/`estado` — D2), registrado en `handlers/index.ts`

## 6. Frontend — tests

- [x] 6.1 `useUserNames`: dedupe + orden para query key estable, `getName` durante `isLoading`, `getName` para id no resuelto, ids nulos/undefined filtrados sin romper
- [x] 6.2 Cada componente migrado (4.2–4.9): un test con nombre resuelto y un test con id no resuelto (fallback genérico, no GUID en pantalla)
- [x] 6.3 `buildQualityEventPdf`: test actualizado para pasar `meta.reportadoPorNombre`/`causaRaizAprobadaPorNombre` y verificar que aparecen en el documento generado
- [x] 6.4 Handler MSW: resuelve usuario inactivo/asignación inactiva, omite otra empresa, 400 por límite y por id malformado

## 7. Barrido y verificación

- [x] 7.1 Confirmar con una búsqueda (`grep -rln resolveUserDisplayName src --include='*.{ts,tsx}'` excluyendo `src/mocks/` y `*.test.*`) que ya no queda ningún import de `resolveUserDisplayName` en código de producción; pegar el resultado (vacío) en design.md
- [x] 7.2 Suite completa del frontend, tests de integración del backend, y `tsc` (frontend 177/177 archivos, 1389/1390 — el único "expected fail" es el `it.fails` intencional y preexistente de `UserList.test.tsx` (botón Copiar, posposición decidida 2026-08-12), no relacionado a este change; backend 487/487; `tsc` solo falla en `IncidentForm.tsx:377`, preexistente y ya documentado en `documentos-revisor-aprobador-reales/design.md`)
- [x] 7.3 Detener el backend y ejecutar `dotnet build` antes de la prueba manual (0 advertencias, 0 errores)
- [ ] 7.4 Prueba manual con MSW apagado contra el backend real: detalle de documento (autor/revisor/aprobador, incluido el preview del PDF), detalle de QE y de NC (reportante/responsables), PDF exportado de un QE, y confirmar que desactivar un usuario no le borra el nombre donde está asignado
- [ ] 7.5 Avisar a Toño ("listo") para la verificación de Cowork
