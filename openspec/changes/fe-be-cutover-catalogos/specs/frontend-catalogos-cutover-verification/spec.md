## ADDED Requirements

### Requirement: Los CRUD de Areas, Locales y Zonas funcionan de punta a punta contra el backend .NET real sin MSW

Con `VITE_ENABLE_MSW=false` y `VITE_API_BASE_URL` apuntando al backend .NET real corriendo localmente contra Postgres real, el sistema SHALL completar el alta, edición, desactivación y reactivación de Area, Local y Zona con el mismo comportamiento observable que hoy contra MSW (mismos toasts, mismas validaciones, mismo scoping por empresa activa).

#### Scenario: Alta, edición, desactivación y reactivación de Area contra el backend real

- **WHEN** un usuario `ADMINISTRADOR_SISTEMA` crea un Area desde `AreasAdminPage` con `VITE_ENABLE_MSW=false`
- **THEN** el Area se crea y aparece en el listado con los datos reales de Postgres
- **WHEN** el mismo usuario edita, desactiva y luego reactiva esa Area
- **THEN** cada acción se refleja de inmediato en la UI sin recargar la página, contra el backend real

#### Scenario: Alta de Local con plano PNG (multipart) contra el backend real

- **WHEN** un usuario `ADMINISTRADOR_SISTEMA` crea un Local desde `LocalNewPage` adjuntando un archivo PNG válido como plano
- **THEN** el backend real acepta el `multipart/form-data` (con `Content-Type` calculado por el navegador, no fijado por el cliente) y responde `201` con `planoPngUrl` apuntando al archivo almacenado

#### Scenario: Edición, desactivación y reactivación de Local contra el backend real

- **WHEN** un usuario `ADMINISTRADOR_SISTEMA` edita un Local existente (con y sin reemplazo de plano), lo desactiva y lo reactiva
- **THEN** cada operación responde con el estado esperado (`200`, o `409` si el Local tiene Incidentes bloqueantes) contra el backend real, igual que documenta `be-locales-zonas-lectura`

#### Scenario: Detalle de Local con Zonas embebidas carga en LocalEditPage

- **WHEN** un usuario navega a `LocalEditPage` para un Local existente de su empresa activa
- **THEN** `useLocal(id)` resuelve contra `GET /api/locales/:id` en el backend real y la página muestra el Local junto con sus Zonas, sin caer en el fallback SPA ni en `NotFoundPage`

#### Scenario: Listado de Zonas sin filtro de Local se usa en LocalList y ZonaFormPage

- **WHEN** `LocalList` (conteo de zonas por local) o `ZonaFormPage` (selector de local) cargan con `VITE_ENABLE_MSW=false`
- **THEN** `useZonas()` resuelve contra `GET /api/zonas` en el backend real y retorna todas las zonas (activas e inactivas) de la empresa activa de la sesión

#### Scenario: Una Zona desactivada sigue visible en LocalList para poder reactivarla

- **WHEN** una Zona de la empresa activa está en estado inactivo
- **THEN** sigue apareciendo agrupada bajo su Local en `LocalList` (vía `GET /api/zonas`, que no filtra por `activo`) con la acción "Reactivar" disponible, en vez de desaparecer de la vista

#### Scenario: Alta, edición, desactivación y reactivación de Zona contra el backend real

- **WHEN** un usuario `ADMINISTRADOR_SISTEMA` crea una Zona desde `ZonaFormPage` sobre un Local existente, la edita, la desactiva y la reactiva
- **THEN** cada operación se completa contra el backend real con el mismo comportamiento que documenta `be-locales-zonas-lectura` (incluida la validación de Incidentes en `EN_EJECUCION` que solo bloquea a Zona, no a Local)

### Requirement: El CRUD de Empresas y la gestión de usuarios de empresa funcionan contra el backend real, gateados a SUPERADMIN

Con `VITE_ENABLE_MSW=false`, el sistema SHALL completar el alta y edición de Empresa y la gestión de usuarios asignados a una Empresa exclusivamente para un usuario `SUPERADMIN`, y SHALL rechazar el acceso a cualquiera de los 7 endpoints de Empresas para un usuario autenticado con otro rol.

#### Scenario: Alta y edición de Empresa como SUPERADMIN

- **WHEN** un usuario `SUPERADMIN` crea una Empresa desde la UI de administración y luego la edita
- **THEN** ambas operaciones se completan contra el backend real y la Empresa nueva aparece en `ListarEmpresas` sin estar filtrada por ninguna empresa activa (es el catálogo de tenants)

#### Scenario: Gestión de usuarios de una Empresa como SUPERADMIN

- **WHEN** un usuario `SUPERADMIN` asigna un usuario a una Empresa y luego alterna su estado (`ACTIVO`/`INACTIVO`) desde la UI de gestión de usuarios de esa Empresa
- **THEN** ambas operaciones se completan contra el backend real y el cambio se refleja en `ListarUsuariosDeEmpresa`

#### Scenario: Un rol distinto de SUPERADMIN recibe 403 en los endpoints de Empresas

- **WHEN** un usuario autenticado con un rol distinto de `SUPERADMIN` (p. ej. `ADMINISTRADOR_SISTEMA` o `JEFE_CALIDAD_SYST`) intenta acceder a cualquiera de los 7 endpoints de Empresas consumidos por el frontend
- **THEN** el backend real responde `403`, igual que el comportamiento ya simulado por MSW

### Requirement: El aislamiento multi-tenant de los 4 catálogos se sostiene contra el backend real

El sistema SHALL scoped por `empresaId` de la empresa activa de la sesión todas las lecturas y mutaciones de Area, Local y Zona contra el backend real, sin exponer ni permitir modificar recursos de otra empresa.

#### Scenario: Un Local o Zona de otra empresa responde 404, no 403, en detalle o edición

- **WHEN** un usuario autenticado solicita `GET /api/locales/:id`, `PATCH /api/locales/:id` o cualquier mutación de Zona sobre un recurso que pertenece a una empresa distinta de su empresa activa
- **THEN** el backend real responde `404`, sin distinguir "no existe" de "es de otra empresa"

### Requirement: MSW se revierte a activo al cerrar la verificación de catálogos

El sistema SHALL dejar `shc-controldoc/.env.development` con `VITE_ENABLE_MSW=true` una vez completada la verificación de este change, para no bloquear el desarrollo diario de los módulos de dominio aún no cutover-eados.

#### Scenario: Estado del entorno de desarrollo al cerrar el change

- **WHEN** se inspecciona `shc-controldoc/.env.development` después de cerrado este change
- **THEN** `VITE_ENABLE_MSW` es `true`, igual que antes de iniciar la verificación
