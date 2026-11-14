## Why

`ac-tipo-responsables` dejó fija en el código (`ResponsableAcPolicy.RolesPermitidos`) la tabla "tipo de AC → roles que pueden ser responsables". Cada empresa organiza distinto sus responsabilidades (p.ej. una quiere que las acciones de Mejora solo las lidere el Jefe de Calidad), y hoy cambiarlo exige un despliegue. Toño decidió (D1) que la tabla sea **configurable por empresa**.

## What Changes

- Nueva tabla `config_responsables_ac_empresa` (una fila por empresa y tipo, `Roles text[]`) y migración `AddConfiguracionResponsablesAc`, sin datos semilla: una empresa sin filas usa los valores por defecto (la tabla actual de `ac-tipo-responsables`).
- `ResponsableAcPolicy` deja de leer una tabla estática: `RolesPermitidos(tipo)` se reemplaza por `RolesPermitidosAsync(empresaId, tipo, ct)`, que lee la configuración de la empresa o cae a `ResponsablesAcDefaults`, y siempre filtra roles de administración. Candidatos, creación y reasignación de AC usan esa lectura. **BREAKING (interno):** desaparece el método estático.
- Nuevos endpoints `GET`/`PUT /api/empresas/{id}/responsables-ac` y `POST /api/empresas/{id}/responsables-ac/restablecer`, con el mismo control de acceso que la seguridad de sesión (ADMINISTRADOR_EMPRESA en su empresa, SUPERADMIN en cualquiera; otra empresa → 404) y auditoría por cada tipo que cambia.
- El cambio aplica solo a asignaciones nuevas (crear AC o cambiar `responsableId`); las AC existentes conservan su responsable.
- Frontend: `ResponsablesAcSection` (matriz 3 tipos × 6 roles operativos) en Usuarios para el ADMINISTRADOR_EMPRESA y modal "Responsables de AC" en Administración de Empresas para el SUPERADMIN. Al guardar se invalidan los candidatos.
- `QEACSection`: el mensaje de "sin candidatos" agrega una pista según el rol.
- MSW: configuración en memoria por empresa, mismos endpoints y validaciones; el handler de candidatos y la validación de los `POST` de AC usan la configuración de la empresa activa.

## Capabilities

### New Capabilities
- `ac-responsables-config-empresa`: configuración por empresa de qué roles pueden ser responsables de cada tipo de AC (persistencia, endpoints, permisos, auditoría, UI y MSW).

### Modified Capabilities
- `ac-tipo-responsables`: la política de responsables toma los roles de la configuración de la empresa (con la tabla actual como default) en lugar de una tabla fija; el MSW replica esa lectura.
- `quality-event-ac-section`: el mensaje de lista vacía de candidatos orienta al administrador o al resto de roles.

## Impact

- Backend: `Features/AccionesCorrectivas/Shared/ResponsableAcPolicy.cs`, nuevo `ResponsablesAcDefaults.cs`, nuevo slice `Features/AccionesCorrectivas/ConfiguracionResponsables/`, nueva entidad + `ShacDbContext` + migración, `ConfiguracionSesionAuditoria`, `EndpointExtensions.cs`, tests.
- Frontend: `constants/accionCorrectivaTipo.constants.ts`, nuevo `features/acciones-correctivas/` (api, hooks, schema, componentes), `UsersListPage.tsx`, `EmpresasAdminPage.tsx`, `QEACSection.tsx`, i18n `es-PE`/`en-US`.
- MSW: handlers de `/api/empresas/:id/responsables-ac`, fixture en memoria, `mocks/handlers/shared/candidatosUsuarios.ts`.
- API: 3 endpoints nuevos; ninguno existente cambia de contrato.
