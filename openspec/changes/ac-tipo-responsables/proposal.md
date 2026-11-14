## Why

Al crear una acción correctiva desde un QE, el combo de responsables aparece vacío: `QEACSection` usa `useUsers()` → `GET /api/users`, que el backend restringe a `ADMINISTRADOR_EMPRESA`/`SUPERADMIN` (403 para el Jefe de Calidad). El mismo patrón rompe la lista de auditores de la verificación, el combo "Detectado por" de NC, y muestra ids en lugar de nombres. Además, las AC no tienen el "Tipo de acción" obligatorio del PRD §2.2 y el backend no valida que el responsable pertenezca a la empresa ni tenga un rol permitido (hoy se puede asignar a un usuario de otra empresa por id).

## What Changes

- Nuevo enum `AccionCorrectivaTipo` (`CORRECTIVA` | `PREVENTIVA` | `MEJORA`) y propiedad `Tipo` en `AccionCorrectivaQE`, `AccionCorrectivaNC` y `AccionCorrectivaIncidente`. Migración `AddTipoAccionCorrectiva` (columna `tipo` NOT NULL, default `CORRECTIVA`).
- Política única `ResponsableAcPolicy`: roles elegibles por tipo (D1) + asignación ACTIVA en la empresa de la sesión + usuario activo. Nunca roles de administración.
- Nuevo `GET /api/acciones-correctivas/candidatos-responsable?tipo=…` accesible a cualquier rol autenticado con empresa activa.
- **BREAKING (contrato)**: `POST` de AC en QE, NC e incidente exige `tipo`; un responsable fuera de la política responde error de validación del campo `responsableId` (400, `FieldValidationException`), nunca 404. Los `PATCH` de AC no aceptan `tipo`; si cambian `responsableId`, validan con el tipo actual de la AC.
- La creación de AC (QE, NC, incidente) notifica al responsable (best-effort, no en autoasignación), igual que la reasignación.
- Nuevo `GET /api/users/candidatos?roles=…` para selectores no-AC; filtra roles de administración en el servidor. `GET /api/users` sigue siendo solo de administradores.
- Frontend: campo "Tipo de acción" (obligatorio, antes del responsable) en el modal de AC del QE, combo de responsable dependiente del tipo con rol al lado, limpieza + aviso al cambiar de tipo, precarga del tipo desde el asistente IA, badge de tipo en la lista de AC.
- Frontend: `QEVerificacionSection` y `NCForm` usan `useCandidatosUsuarios`; el panel de ajuste de plazo y `NCList` muestran nombres (nunca ids; "Usuario no disponible" como fallback).
- MSW: handlers de ambos endpoints de candidatos, `tipo` obligatorio y validación del responsable en los tres `POST` de AC, `tipo` en fixtures, y `GET /api/users` responde 403 a roles no administrativos.

## Capabilities

### New Capabilities
- `ac-tipo-responsables`: tipo de acción de las AC (QE/NC/incidente), política de responsables por tipo, endpoint de candidatos de responsable de AC y su consumo en el formulario de AC del QE.
- `users-candidatos`: endpoint `GET /api/users/candidatos` y hook `useCandidatosUsuarios` para selectores de usuarios accesibles a roles operativos (verificación, "Detectado por").

### Modified Capabilities
- `quality-event-ac-section`: el modal de creación exige tipo y obtiene candidatos por tipo; la lista muestra el badge de tipo; el panel de ajuste de plazo muestra el nombre del solicitante.
- `be-users-api`: aclara que `GET /api/users` sigue restringido a administradores y que los selectores operativos usan `/api/users/candidatos` o `/api/users/nombres`.

## Impact

- **Backend**: `Domain/Enums`, tres entidades de AC, `ShacDbContext`, nueva migración, `Features/AccionesCorrectivas/` (policy + candidatos), tres slices `CrearAccionCorrectiva*`, tres slices `ActualizarAccionCorrectiva*`, `Features/Users/CandidatosUsuarios/`, `AccionCorrectivaResumen` del dashboard, exportación PDF del QE, tests de integración.
- **Frontend**: `QEACSection`, `QEInvestigationSection` (precarga IA), `QEVerificacionSection`, `NCForm`, `NCList`, tipos de AC de QE/NC/incidente, schema `createQEAccion`, nuevos hooks/api, i18n `es-PE`/`en-US`.
- **MSW**: `quality-events`, `nonconformities`, `incidents`, `users` handlers y fixtures.
- **Base de datos**: requiere `dotnet ef database update` antes de levantar el backend.
