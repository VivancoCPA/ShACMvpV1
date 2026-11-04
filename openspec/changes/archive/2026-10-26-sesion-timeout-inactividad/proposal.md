## Why

Hoy una sesión de SHAC no expira nunca mientras la app esté abierta en una pestaña: el access token dura 60 min, `/api/auth/refresh` rota el refresh token y le da 7 días más en cada llamada, y el polling de notificaciones (60 s) dispara ese refresh aunque nadie use la app. En una PC compartida de almacén o de garita, cualquiera puede operar con la sesión de otro usuario, incluida la lectura de documentos CONFIDENCIALES. No existe ni un cierre por inactividad ni una duración máxima de sesión, y `Empresa` no tiene configuración de seguridad.

## What Changes

- **Política de sesión configurable** (decisiones D1–D3 de Toño, 2026-10-19):
  - Inactividad: 30 min por defecto, rango 5–240. Duración máxima absoluta: 12 h por defecto, rango 1–24. La sesión máxima (en minutos) nunca puede ser menor que la inactividad.
  - SUPERADMIN define el valor por defecto global y los límites mínimo y máximo en una tabla de parámetros del sistema (no `appsettings`). También puede editar la configuración de cualquier empresa.
  - ADMINISTRADOR_EMPRESA define los valores de **su** empresa (otra empresa → 404). Un valor nulo usa el global. SUPERADMIN, que no tiene empresa activa, usa el global.
  - La política se resuelve en un solo lugar (`PoliticaSesionResolver`). Ese resolver ajusta al límite más cercano un valor de empresa que quedó fuera de rango porque el SUPERADMIN cambió los límites después.
- **Aplicación real en el servidor:**
  - `RefreshToken` gana `SesionIniciadaEn` y `UltimaActividadEn`. La rotación hereda `SesionIniciadaEn`.
  - `/api/auth/refresh` revoca el token y responde 401 con `errorCode` `SESION_MAXIMA_ALCANZADA` o `SESION_INACTIVA` cuando corresponde.
  - La actividad real solo se registra vía el nuevo `POST /api/auth/actividad`. El polling, SignalR y el refresh **no** cuentan como actividad.
  - **BREAKING (config):** el access token baja de 60 a 5 min.
  - El cierre por política queda en el log de autenticación (ILogger estructurado). Cada cambio de configuración queda en una tabla de auditoría append-only, con valor anterior y nuevo.
- **Frontend:**
  - Detector de inactividad montado una sola vez por layout autenticado (`AppShell` y `MobileShell`).
  - Modal de aviso 60 s antes, con "Seguir conectado" y "Cerrar sesión".
  - Sincronización entre pestañas con `BroadcastChannel` y `storage`.
  - El cierre de sesión limpia el `authStore` y la caché de TanStack Query, y desconecta SignalR. El login muestra el motivo del cierre y después vuelve a la ruta donde estaba el usuario.
  - El interceptor de Axios no reintenta ante un 401 con `SESION_INACTIVA` o `SESION_MAXIMA_ALCANZADA`.
  - El refresh pasa a ser *single-flight*, con Web Locks entre pestañas, porque con tokens de 5 min las rotaciones concurrentes dejarían de ser raras.
- **Pantallas de configuración:**
  - Sección "Seguridad de sesión" en `/usuarios` para ADMINISTRADOR_EMPRESA.
  - Página `/admin/parametros-sesion` para SUPERADMIN.
  - Acción "Seguridad de sesión" por empresa en `/admin/empresas`.
  - Todas usan RHF + Zod con los límites que devuelve el servidor y muestran quién hizo el último cambio y cuándo.
- **Cola offline:** el logout no la borra (ya era así; queda confirmado). Las entradas nuevas guardan `usuarioId`, y la sincronización y el panel solo procesan las entradas del usuario logueado.
- MSW con los mismos contratos y reglas. i18n `es-PE`/`en-US` en un namespace nuevo `sesion`.

## Capabilities

### New Capabilities
- `session-policy-config`: parámetros globales de sesión (default y límites), configuración por empresa, resolución de la política efectiva con ajuste a los límites, validaciones, permisos por rol, auditoría de cambios y endpoints `GET/PUT /api/sistema/parametros-sesion` y `GET/PUT /api/empresas/{id}/seguridad-sesion`.
- `session-timeout-enforcement`: aplicación en el servidor (campos de sesión en `RefreshToken`, comprobaciones en `/refresh`, `POST /api/auth/actividad`, `GET /api/auth/politica-sesion`, access token de 5 min, códigos de error, log de cierres).
- `session-inactivity-client`: detector de inactividad, modal de aviso, sincronización entre pestañas, cierre de sesión con motivo, retorno a la ruta original, interceptor sin reintento, refresh *single-flight*.
- `session-policy-admin-ui`: pantallas y formularios de configuración para ADMINISTRADOR_EMPRESA y SUPERADMIN.

### Modified Capabilities
- `offline-incident-queue`: la entrada encolada guarda `usuarioId`, y el listado y la sincronización se aíslan por usuario. La cola sobrevive al cierre de sesión.
- `auth-flow`: los handlers MSW de auth incorporan las comprobaciones de política de sesión en `/auth/refresh` y los endpoints nuevos.

## Impact

- **Backend** (`ShcMvpEndPoint`):
  - Entidades nuevas `ParametrosSesionSistema`, `ConfiguracionSeguridadEmpresa` y `ConfiguracionSesionAuditTrail`, y dos columnas nuevas en `refresh_tokens`, más una migración EF.
  - Cambios en `LoginHandler`, `RefreshHandler`, `ApiExceptionHandler` y `UnauthorizedBusinessException` (código de error).
  - Features nuevos: `Auth/Actividad`, `Auth/PoliticaSesion`, `SeguridadSesion/*`.
  - Cambio de `appsettings` y del `.example`: `AccessTokenExpirationMinutes = 5`.
  - Tests de integración.
- **Frontend** (`shc-controldoc`):
  - Feature nuevo `features/sesion/` (api, hooks, components, pages, schemas, utils).
  - `lib/axios.ts`, `stores/authStore.ts`, `lib/sessionEnd.ts` (nuevo), `lib/notificationsHub.ts`, `AppShell`, `MobileShell`, `LoginPage`, `useLogout`, `Sidebar`, router y `routeAccess`, `EmpresaList`, `UsersListPage`, `lib/offlineQueue.ts`, `useOfflineIncidentSync`, `offlineQueueStore`, i18n.
- **MSW:** `mocks/handlers/sesion.handlers.ts` y `mocks/fixtures/sesion.fixtures.ts` (nuevos), y `auth.handlers.ts`.
- **Operación:** hay que detener el backend, correr `dotnet ef database update` y luego `dotnet build`.
