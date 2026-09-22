## 1. Preparar el entorno local

- [x] 1.1 Confirmar `docker-compose up -d` en `ShcMvpEndPoint/` con `shac-postgres` sano — confirmado, `shac-postgres` ya estaba `Up 11 days (healthy)` de una sesión anterior.
- [x] 1.2 Confirmar `dotnet run` levanta sin errores contra Postgres dev, anotar el puerto real — confirmado, backend levantado en `http://localhost:5072` (`GET /api/notifications` sin token responde 401).
- [x] 1.3 Confirmar que hay al menos un usuario QA reutilizable con empresa activa, y que existe (o se puede generar) al menos un QE o NC ya cutover-eado sobre el que disparar una transición real para ejercitar un `tipo` nuevo de notificación — se reutilizó "Cutover Dashboard QA S.A.C." (empresa QA dedicada de `cutover-dashboard`, con los 6 usuarios `dash.*.qa@shac.dev` ya creados, password `QaTest_2026!` conocida) y `superadmin@shac.dev` (`SuperAdminDevLocal_2026!`, `appsettings.Development.json`). No tenía QEs previos — se crearon 2 QEs `CRITICA` nuevos vía `POST /api/quality-events` (ver sección 6) en vez de depender de un QE de otro cutover.

## 2. Confirmar que no hay mismatch de contrato adicional (re-verificación previa a tocar el entorno)

- [x] 2.1 Releer `ListarNotificacionesHandler.cs`/`MarcarLeidaHandler.cs`/`MarcarTodasLeidasHandler.cs` y confirmar que siguen coincidiendo con `notifications.api.ts` — confirmado, `git diff --stat` sobre ambos lados desde la verificación de esta sesión (propose) da vacío.
- [x] 2.2 Releer `Extensions/EndpointExtensions.cs` y confirmar que las 3 rutas de Notificaciones (líneas 244-246) y sus 3 handlers en DI (líneas 397-399) siguen registrados sin cambios — confirmado, mismo `git diff --stat` vacío incluye `EndpointExtensions.cs`.
- [x] 2.3 Sin discrepancias nuevas detectadas más allá del gap de tipos ya identificado en `design.md` — no aplica documentar nada adicional.

## 3. Apuntar el frontend al backend real

- [x] 3.1 Editado `shc-controldoc/.env.development`: `VITE_ENABLE_MSW=false`, `VITE_API_BASE_URL=http://localhost:5072`.
- [x] 3.2 **Nota de metodología**: sin herramienta de automatización de navegador disponible en este entorno (sin Playwright/similar) — se verificó el contrato completo por API directa (`curl`, JWT real por login) en vez de clic en la UI, mismo criterio que todos los cutovers anteriores. Login confirmado contra el backend real con `dash.jefecalidad.qa@shac.dev` (`JEFE_CALIDAD_SYST`, empresa "Cutover Dashboard QA S.A.C."): `accessToken` real devuelto por `POST /api/auth/login`.

## 4. Verificar listado de Notificaciones (frontend-notificaciones-cutover-verification)

- [x] 4.1 `GET /api/notifications` contra el backend real — confirmado por API directa: tras crear 2 QEs `CRITICA`, `dash.altadireccion.qa@shac.dev` (`ALTA_DIRECCION`, misma empresa) recibió ambas notificaciones (`tipo: SEVERIDAD_CRITICA`) filtradas correctamente por `usuarioId`+`empresaActivaId`; `dash.jefecalidad.qa@shac.dev` (el propio actor que creó los QEs) no aparece como destinatario de sus propias notificaciones, confirmando la exclusión del actor documentada en `QualityEventNotificationSender.cs`. **Nota de metodología**: sin herramienta de navegador, no se verificó el renderizado visual de `NotificationBell`/`NotificationList` (orden por `createdAt`, contador) — se confirmó por lectura de código en `design.md`/propose que ambos componentes consumen `data`/`leida` directamente sin transformación adicional, y la suite de tests de componentes (sección 8) cubre ese renderizado contra fixtures.
- [x] 4.2 Confirmado por API directa: login como `superadmin@shac.dev` y `GET /api/notifications` sin empresa activa responde 401 con `"Sesión sin empresa activa"` — coincide con el diseño D6 de `be-notificaciones` (sin excepción `SUPERADMIN`, a diferencia de `GET /api/users`).

## 5. Verificar marcar como leída (individual y todas)

- [x] 5.1 Marcada una notificación propia (`SEVERIDAD_CRITICA` de `dash.altadireccion.qa@shac.dev`) como leída vía `PATCH /api/notifications/:id/leida` — confirmado `leida: true` persistido contra el backend real y visible en un `GET` posterior.
- [x] 5.2 Confirmado el 404 uniforme: `PATCH /api/notifications/:id/leida` con un `id` inexistente → 404 `"Notificación no encontrada"`; el mismo endpoint con el `id` real de una notificación de `dash.altadireccion.qa@shac.dev` invocado por `dash.jefecalidad.qa@shac.dev` (otro usuario) → 404 idéntico, sin distinguirse del caso anterior.
- [x] 5.3 Creado un segundo QE `CRITICA` (`QE-2026-002`) para generar una notificación no leída adicional; `PATCH /api/notifications/marcar-todas-leidas` como `dash.altadireccion.qa@shac.dev` marcó esa notificación como `leida: true` (la respuesta solo incluyó la que estaba no leída); un `GET` posterior confirmó ambas notificaciones (`QE-2026-001` y `QE-2026-002`) en `leida: true`.

## 6. Ejercitar un `tipo` nuevo de notificación contra datos reales

- [x] 6.1 Se creó un Quality Event real (`POST /api/quality-events`, origen `O4_REPORTE_EXTERNO`, severidad `CRITICA`) como `dash.jefecalidad.qa@shac.dev` en "Cutover Dashboard QA S.A.C." — `QE-2026-001`. Esto disparó `NotificarSeveridadCriticaAsync` (`CrearQualityEventHandler.cs`, RN-QE-005) hacia el rol `ALTA_DIRECCION` de la empresa. **Nota de metodología**: se optó por `SEVERIDAD_CRITICA` en vez de `CIERRE` porque no requiere completar el ciclo completo de QE (causa raíz aprobada, ACs ejecutadas, firma dual) — alcanza igual el objetivo de la tarea (ejercitar un `tipo` de los 4 no cubiertos antes) con una única llamada API.
- [x] 6.2 Confirmado por `GET /api/notifications` (como `dash.altadireccion.qa@shac.dev`) que la notificación trae `tipo: "SEVERIDAD_CRITICA"` real (no simulado), con `mensaje: "El Quality Event QE-2026-001 tiene severidad CRÍTICA."` y `link: "/quality-events/{id}"` — se marcó como leída igual que cualquier otra (ver 5.1), sin ningún manejo especial por `tipo` en el frontend (confirmado en `design.md`, `NotificationList.tsx` no discrimina por `tipo`).

## 7. Corregir el gap de tipos y el comentario desactualizado

- [x] 7.1 Ampliado `NotificacionTipo` en `shc-controldoc/src/types/notification.types.ts` a los 7 valores reales (`CAMBIO_ESTADO`, `ASIGNACION`, `VENCIMIENTO`, `SEVERIDAD_CRITICA`, `CIERRE`, `VERIFICACION_EFICAZ`, `COMERCIO_EXTERIOR`).
- [x] 7.2 Corrida la suite de tests de Notificaciones (`src/features/notifications` + `notification.types.ts`) tras el cambio de tipo: 13/13 passed, sin regresiones — ninguno de los tests dependía del union type de 3 valores.
- [x] 7.3 Corregido el comentario de `useNotificationToast.ts` (líneas 6-16): ya no promete que la limitación de "solo dentro de la misma pestaña/sesión" se resuelve por la sola existencia de un backend real — ahora explica que el backend real tampoco tiene WebSocket/SSE, que no hay `refetchInterval` configurado (confirmado por grep), y deja la decisión de agregar polling o SignalR como Open Question de producto.

## 8. Tests y cierre del ciclo

- [x] 8.1 Inspeccionados los 3 archivos de test de Notificaciones: `useNotifications.test.ts` usa `setupServer(...notificationHandlers)` (`msw/node`) — testea los HANDLERS MSW mismos, sin equivalente posible contra backend real, mismo patrón no-migrable que otros cutovers. `useNotificationToast.test.ts` y `NotificationBell.test.tsx` mockean `useNotifications`/`useAuthStore`/hooks de mutación directamente vía `vi.mock`, sin ninguna dependencia de MSW — no requieren migración porque nunca dependieron del mock de red. Ninguno de los tres se modifica más allá de lo ya cubierto en 7.2.
- [x] 8.2 Suite completa corrida sin regresiones nuevas: backend `dotnet test` y frontend `npx vitest run` (ver resultados en `design.md`, Hallazgos de verificación).
- [x] 8.3 Documentado en `design.md` ("Hallazgos de verificación").
- [x] 8.4 Revertido `shc-controldoc/.env.development` a `VITE_API_BASE_URL=`, `VITE_ENABLE_MSW=true` (estado original).
- [x] 8.5 Confirmado: `shc-controldoc/.env.production` no requiere cambios — ya tenía `VITE_ENABLE_MSW=false` desde `cutover-auth`, mismo Open Question de hosting pendiente.
- [x] 8.6 Evaluado — no aplica una fila propia en la tabla "Módulos del Sistema" de `CLAUDE.md`: esa tabla lista los 8 módulos de dominio (M1-M8) más la capa Multiempresa; Notificaciones es transversal a todos ellos (como i18n o el Design System), no un módulo de dominio con su propio directorio `features/[modulo]/` de negocio — no encaja en la forma de esa tabla. Mismo criterio que otras capas transversales ya documentadas (MSW, Auth) que tampoco tienen fila propia.
