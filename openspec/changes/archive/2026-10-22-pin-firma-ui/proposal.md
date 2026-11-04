## Why

El backend .NET ya implementa el PIN de firma completo (`POST /api/auth/set-pin`, `PATCH /api/empresas/{id}/usuarios/{usuarioId}/reset-pin`, `ShacUser.PinHash`, validación en `FirmarPublicarDocumentoHandler`/`FirmarCierreQEHandler`), pero ningún componente del frontend lo invoca: nadie puede configurar su PIN desde la app, así que nadie puede firmar un documento ni cerrar un QE contra el backend real hoy. Además, los modales de firma existentes (`DocumentSignatureModal`, `PinModal` de QE) llaman al campo "contraseña" cuando en realidad piden un PIN de 4 dígitos, y solo manejan el caso 401 — un usuario sin PIN configurado no ve ningún mensaje útil. El mock MSW de cierre de QE ni siquiera valida el PIN enviado.

## What Changes

- Backend: agregar `TienePinFirma: bool` (`PinHash != null`) a `UserDto` (login/refresh/switch-empresa), sin exponer el hash.
- Backend: agregar un código de error estable `errorCode` al envelope de error (`ApiResponse<T>`) y setearlo a `PIN_NO_CONFIGURADO` en los `BusinessRuleException` que ya lanzan `FirmarPublicarDocumentoHandler` y `FirmarCierreQEHandler` cuando `PinHash` es `null`, usando el parámetro `ruleCode` que `BusinessRuleException` ya soporta.
- Backend: tests de integración para `set-pin` (password incorrecta → 401, pin con formato inválido → 400, pin válido → `TienePinFirma = true`), firmar sin PIN → `errorCode: PIN_NO_CONFIGURADO`, y `reset-pin` → `TienePinFirma = false`.
- Frontend `types/auth.types.ts`: agregar `tienePinFirma: boolean` a `User`.
- Frontend `Mi Perfil` (`ProfilePage.tsx`): nueva sección "PIN de firma" con estado actual (configurado / no configurado), formulario (contraseña actual + nuevo PIN + confirmar PIN, 4 dígitos, Zod) contra `POST /api/auth/set-pin`.
- Frontend `DocumentSignatureModal.tsx`: corregir textos i18n de "contraseña" a "PIN"; ocultar el campo y mostrar aviso con enlace a `/perfil` cuando `tienePinFirma === false`; mostrar cualquier error del backend (no solo 401), incluido el nuevo `errorCode`.
- Frontend `QECierreSection.tsx` / `PinModal`: mismo tratamiento — aviso + enlace cuando no hay PIN, error visible para cualquier fallo de `useFirmarCierre` (hoy no tiene `onError`).
- Frontend `EmpresaUsuariosPage.tsx`: nueva acción "Resetear PIN" (con confirmación) para `SUPERADMIN`, contra `PATCH /api/empresas/{id}/usuarios/{usuarioId}/reset-pin`.
- MSW: handlers de `set-pin` y `reset-pin`; `tienePinFirma` calculado en los usuarios del mock (`authFixtures`); los handlers de firma de documento y de cierre de QE deben validar el PIN guardado en el mock (reemplazando `MOCK_PIN` fijo en `documents.handlers.ts` y la ausencia total de validación en `quality-events.handlers.ts`) y devolver el mismo `errorCode: PIN_NO_CONFIGURADO` que el backend real cuando no hay PIN configurado.
- i18n: claves nuevas en `es-PE` y `en-US` para todo lo anterior (namespaces `users`, `documents`, `qualityEvents`, `empresas`).
- Pregunta abierta para decisión humana, documentada en `design.md` (no se resuelve en este change): ¿debería `ADMINISTRADOR_EMPRESA` poder resetear el PIN de los usuarios de su propia empresa, además de `SUPERADMIN`?

## Capabilities

### New Capabilities
- `user-profile-pin-firma`: sección "PIN de firma" en `/perfil` — estado, formulario de configuración/cambio, contrato con `POST /api/auth/set-pin`.

### Modified Capabilities
- `be-firma-pin`: agrega `TienePinFirma` (expuesto en `UserDto`) calculado desde `PinHash`.
- `be-documentos-api`: la respuesta de "Actor sin PIN configurado" en `POST /:id/sign` (RN-DOC-004) incluye `errorCode: PIN_NO_CONFIGURADO` en vez de solo un mensaje de texto.
- `be-quality-events-api`: la respuesta de "Usuario sin PIN configurado" en `PATCH /:id/firmar-cierre` incluye `errorCode: PIN_NO_CONFIGURADO`.
- `auth-flow`: el `User`/sesión mock expone `tienePinFirma`; MSW agrega los handlers `POST /api/auth/set-pin` y valida el PIN mock contra un valor por-usuario (ya no fijo).
- `document-approval-flow`: `DocumentSignatureModal` usa lenguaje de PIN (no contraseña), maneja el estado "sin PIN configurado" con enlace a `/perfil`, y muestra cualquier error del backend, no solo 401.
- `quality-event-cierre`: `PinModal` de `QECierreSection` recibe el mismo tratamiento — aviso de "sin PIN" con enlace, y manejo de error visible para cualquier fallo de `useFirmarCierre`.
- `empresa-user-assignment`: agrega la acción "Resetear PIN" (confirmación + `PATCH /api/empresas/{id}/usuarios/{usuarioId}/reset-pin`) a la fila de cada asignación, visible solo para `SUPERADMIN`.
- `document-msw-handlers`: el handler de firma de documento valida el PIN contra el valor configurado por usuario en el mock (ya no `MOCK_PIN` fijo) y responde `errorCode: PIN_NO_CONFIGURADO` cuando el usuario no tiene PIN.
- `quality-event-msw-handlers`: el handler `PATCH /api/quality-events/:id/firmar-cierre` valida el PIN enviado contra el PIN configurado por el usuario en el mock (hoy no lo valida en absoluto) y responde `errorCode: PIN_NO_CONFIGURADO` cuando corresponde.

## Impact

- Backend: `Features/Auth/AuthDtos.cs` (`UserDto`), `Features/Auth/SetPin/*`, `Features/Empresas/ResetPin/*`, `Features/Documentos/FirmarPublicarDocumento/FirmarPublicarDocumentoHandler.cs`, `Features/QualityEvents/FirmarCierreQE/FirmarCierreQEHandler.cs`, `ShcMvpEndPoint.Domain/Common/ApiResponse.cs`, `ShcMvpEndPoint.Infrastructure/Middleware/ApiExceptionHandler.cs`, `ShcMvpEndPoint.Domain/Exceptions/BusinessRuleException.cs` (ya soporta `ruleCode`, sin cambios de forma).
- Frontend: `src/types/auth.types.ts`, `src/features/users/pages/ProfilePage.tsx` (+ hook/schema nuevos de PIN), `src/features/documents/components/DocumentSignatureModal.tsx`, `src/features/quality-events/components/QECierreSection.tsx`, `src/features/empresas/pages/EmpresaUsuariosPage.tsx` (+ `empresas.api.ts`/`useUsuarioEmpresa.ts`), `src/features/auth/api/auth.api.ts`.
- MSW: `src/mocks/handlers/auth.handlers.ts`, `src/mocks/handlers/empresas.handlers.ts`, `src/mocks/handlers/documents.handlers.ts`, `src/mocks/handlers/quality-events.handlers.ts`, `src/mocks/fixtures/auth.fixtures.ts` (campo `pin`/`pinHash` mock por usuario).
- i18n: `src/i18n/es-PE.json`, `src/i18n/en-US.json` (namespaces `users`, `documents`, `qualityEvents`, `empresas`).
- Tests: nuevos y actualizados en `ShcMvpEndPoint.Tests/Features/Auth/`, `ShcMvpEndPoint.Tests/Features/Empresas/`, y en los `*.test.tsx`/`*.test.ts` de los archivos de frontend listados arriba.
