## 1. Backend — modelo y migración

- [x] 1.1 Entidades `ParametrosSesionSistema` (fila única Id=1), `ConfiguracionSeguridadEmpresa` (PK EmpresaId) y `ConfiguracionSesionAuditTrail` en `ShcMvpEndPoint.Domain/Entities`; DbSets + configuración en `ShacDbContext` (HasData semilla 30/5/240 · 12/1/24)
- [x] 1.2 `RefreshToken`: agregar `SesionIniciadaEn` y `UltimaActividadEn`
- [x] 1.3 Migración EF `AddPoliticaSesion` (backfill de las columnas nuevas de `refresh_tokens` con `created_at`)
- [x] 1.4 `JwtSettings.AccessTokenExpirationMinutes` default 5; `appsettings.Development.json.example` a 5

## 2. Backend — política, validación y endpoints de configuración

- [x] 2.1 `PoliticaSesionResolver` (efectiva por empresa/global con clamp) + validadores puros de parámetros globales y de empresa con rangos absolutos (D2)
- [x] 2.2 `UnauthorizedBusinessException` con `ErrorCode` opcional y propagación en `ApiExceptionHandler`
- [x] 2.3 `GET/PUT /api/sistema/parametros-sesion` (SUPERADMIN) con auditoría por campo
- [x] 2.4 `GET/PUT /api/empresas/{id}/seguridad-sesion` (ADMINISTRADOR_EMPRESA solo su empresa → 404 si no; SUPERADMIN cualquiera; otros 403) con auditoría por campo
- [x] 2.5 Registrar handlers/endpoints en `EndpointExtensions`

## 3. Backend — aplicación en el servidor

- [x] 3.1 `SesionPoliticaEnforcer` compartido: comprobaciones sesión máxima → inactividad, revocación persistida antes de lanzar 401 con código, log estructurado del cierre
- [x] 3.2 `LoginHandler`: inicializar `SesionIniciadaEn`/`UltimaActividadEn`
- [x] 3.3 `RefreshHandler`: aplicar enforcer y heredar los dos campos en la rotación (sin tocar `UltimaActividadEn`)
- [x] 3.4 `POST /api/auth/actividad` (cookie) y `GET /api/auth/politica-sesion` (Bearer + cookie opcional)
- [x] 3.5 Tests de integración: política efectiva empresa/global; 400 fuera de rango y máx<inactividad; 404 otra empresa; 403 OPERARIO; refresh SESION_INACTIVA + revocado; SESION_MAXIMA_ALCANZADA con actividad reciente; rotación conserva `SesionIniciadaEn`; polling no actualiza `UltimaActividadEn`; auditoría con valor anterior/nuevo; actividad actualiza; switch-empresa aplica política nueva; expiración del access token 5 min
- [x] 3.6 `dotnet build` + suite completa de tests del backend en verde

## 4. Frontend — base (tipos, api, utils, MSW)

- [x] 4.1 `features/sesion/types/sesion.types.ts`, `api/sesion.api.ts`, `utils/politicaSesion.ts` (resolver/validador puros espejo del backend)
- [x] 4.2 `mocks/fixtures/sesion.fixtures.ts` (stores mutables: parámetros, config por empresa, audit, sesiones mock) + reset en la herramienta dev existente si aplica
- [x] 4.3 `mocks/handlers/sesion.handlers.ts` (politica-sesion, actividad, seguridad-sesion GET/PUT, parametros-sesion GET/PUT) registrado en `handlers/index.ts`
- [x] 4.4 `auth.handlers.ts`: login crea sesión mock; refresh hereda y aplica política con `errorCode`; tests de handlers
- [x] 4.5 i18n namespace `sesion` en es-PE y en-US (+ registro en `i18n/index.ts`), y textos nuevos de nav

## 5. Frontend — cierre de sesión e interceptor

- [x] 5.1 `authStore`: `sessionEndReason`, `logout(reason?)`, `refreshToken()` single-flight + Web Locks; `bootstrap()` registra el motivo si el refresh devuelve código de política
- [x] 5.2 `lib/sessionActivity.ts` (última actividad compartida, BroadcastChannel + storage, difusión de logout)
- [x] 5.3 `lib/sessionEnd.ts` (`endSession(reason, { fromOtherTab })`): logout API best-effort, store, `queryClient.clear()`, broadcast; `useLogout` lo reutiliza
- [x] 5.4 `lib/axios.ts`: 401 con `SESION_INACTIVA`/`SESION_MAXIMA_ALCANZADA` → `endSession` sin reintento
- [x] 5.5 `lib/notificationsHub.ts`: `accessTokenFactory` asíncrono que refresca si el JWT está vencido
- [x] 5.6 `LoginPage`: aviso por motivo de cierre

## 6. Frontend — detector de inactividad

- [x] 6.1 Hooks `usePoliticaSesion`, `useRegistrarActividad`
- [x] 6.2 `SessionTimeoutManager` + `InactivityWarningModal` (aviso 60 s, Seguir conectado / Cerrar sesión, sesión máxima) montado en `AppShell` y `MobileShell`
- [x] 6.3 Tests con fake timers: aviso a los 60 s y "Seguir conectado" reinicia; sin interacción cierra con mensaje; actividad en otra pestaña evita cierre; 401 `SESION_MAXIMA_ALCANZADA` cierra sin reintentar refresh; refresh single-flight

## 7. Frontend — cola offline

- [x] 7.1 `offlineQueue.ts`: `usuarioId` en `enqueue`, filtro en `listPending`/`listVisible`; `IncidentQuickReportForm`, `useOfflineIncidentSync` y `offlineQueueStore` pasan el usuario
- [x] 7.2 Tests: aislamiento por usuario; la cola sobrevive a `endSession`

## 8. Frontend — pantallas de configuración

- [x] 8.1 Schemas `buildSeguridadSesionSchema(parametros)` y `buildParametrosSesionSchema()` + tests
- [x] 8.2 Hooks `useSeguridadSesionEmpresa`, `useUpdateSeguridadSesionEmpresa`, `useParametrosSesion`, `useUpdateParametrosSesion`
- [x] 8.3 `SeguridadSesionForm` + sección en `UsersListPage` (ADMINISTRADOR_EMPRESA)
- [x] 8.4 `SeguridadSesionEmpresaModal` + acción en `EmpresaList` (SUPERADMIN)
- [x] 8.5 `ParametrosSesionPage` en `/admin/parametros-sesion` (router, `routeAccess`, Sidebar) solo SUPERADMIN
- [x] 8.6 Tests del formulario (rangos, máx<inactividad, "usar valor por defecto")

## 9. Verificación

- [x] 9.1 `tsc -b`, lint y suite completa de vitest en verde — vitest 1665/1666; los fallos restantes son preexistentes y ajenos al cambio (confirmado con `git stash`): 18 errores de `tsc` en documents.fixtures/documents.handlers/IncidentForm/documents.types.test, lint en useOfflineIncidentSync/auth.handlers/router, y el test `router/documentReplaceOriginal.test.tsx`
- [x] 9.2 Actualizar `CLAUDE.md` (nota técnica de sesión/inactividad) 
- [x] 9.3 Prueba manual con MSW apagado (detener backend → `dotnet ef database update` → `dotnet build`; `AccessTokenExpirationMinutes=5` en `appsettings.Development.json` local): 5 min de inactividad (aviso a los 4, cierre a los 5), "Seguir conectado", dos pestañas, sesión máxima global 1 h, incidente offline tras expiración — pendiente de Toño
