## Context

`ShcMvpEndPoint` ya tiene Usuarios (M6) implementado (`Features/Users/*`, archivado como `2026-08-25-be-crud-gestion-usuarios`): listar, crear, editar, dar de baja/reactivar, resetear contraseña. A diferencia de Incidentes/Documentos, esta investigación (repetida y verificada en esta sesión, no solo heredada del handoff de Toño) no encontró ningún mismatch de contrato entre frontend y backend.

Verificado contra el código real antes de proponer (grep + lectura directa, esta sesión):

- Las 5 rutas de `Features/Users/` están registradas en `Extensions/EndpointExtensions.cs` (líneas 237-241 y 389-393, registro de endpoint + handler) y coinciden 1:1 con `src/api/endpoints/users.api.ts` (confirmado leyendo ambos archivos completos): `GET /api/users` ↔ `listUsers`, `POST /api/users` ↔ `createUser`, `PATCH /api/users/:id` ↔ `updateUser`, `PATCH /api/users/:id/toggle-active` ↔ `toggleUserActive`, `POST /api/users/:id/reset-password` ↔ `resetUserPassword`.
- `ListarUsuariosEndpoint.cs` es la única de las 5 rutas con `RequireRole(ADMINISTRADOR_EMPRESA, SUPERADMIN)` — las otras 4 son `ADMINISTRADOR_EMPRESA`-only (confirmado leyendo los 5 archivos `*Endpoint.cs` completos). Coincide con el comentario propio del código, que documenta la excepción como decisión intencional (D3/D9/D10 de `be-crud-gestion-usuarios`, confirmada por Toño 2026-08-24), no un descuido.
- `ActualizarUsuarioHandler.cs` (líneas 38-46): `Rol`, si viene en el PATCH, nunca toca `ShacUser` (entidad global) — se escribe únicamente en la fila `UsuarioEmpresa` de `(usuarioId, empresaActivaDelActor)`. El propio comentario del código documenta esto como la corrección de un bug ya conocido del mock (escribir el rol en el usuario global filtraba el cambio hacia todas las empresas del usuario). Nada que corregir acá — el backend ya lo hace bien; se verifica en `tasks.md` con un usuario de dos empresas.
- `ActualizarUsuarioHandler.cs` (líneas 21-30) y `CrearUsuarioHandler.cs` (líneas 17-29): unicidad de email verificada **antes** de aplicar cualquier otro cambio (edición) o de crear (alta) — un 409 no deja ningún campo a medio actualizar. `CrearUsuarioHandler` distingue explícitamente "el email ya existe en esta empresa" (409 simple) de "existe en otra empresa" (409 con mensaje que indica la vía correcta, `AsignarUsuarioEmpresa`, `SUPERADMIN`-only, ya cutover-eado en `cutover-catalogos`) — más una red de seguridad TOCTOU (`DuplicateUserName` de Identity) si el pre-check no atómico deja pasar un duplicado real hacia el insert.
- `ToggleActivoUsuarioHandler.cs`: sin ninguna validación de bloqueo (a diferencia de Área/Local/Zona) — dar de baja a un usuario siempre tiene éxito, decisión de diseño documentada explícitamente en el propio comentario del código (D6), no un olvido.
- `ResetPasswordUsuarioHandler.cs`: usa `RemovePasswordAsync`+`AddPasswordAsync` de Identity (evita el paso extra de un token de reset, decisión razonable para una acción admin-a-admin), distinto de `Features/Empresas/ResetPin` (resetea `PinHash`, la firma de QE) — dos flujos separados, confirmado que el frontend no los confunde (`useResetUserPassword` vs. el reset de PIN de `AsignarUsuarioModal`/`ProfilePage`, cada uno en su propio dominio).
- El cambio de contraseña propia (`ProfilePage.tsx`, sección "Cambiar contraseña") usa `useChangePassword`/`changePasswordSchema` de `features/auth/` — ya cutover-eado en `cutover-auth`, confirmado por grep que `ProfilePage.tsx` no llama a ningún endpoint de `Features/Users` para esto.
- Validaciones espejadas en ambos lados: `SUPERADMIN` excluido como rol asignable en `createUserSchema`/`updateUserSchema` (frontend, comentario explícito: "es un flag global, nunca un rol asignado desde este flujo") y en `CrearUsuarioValidator`/`ActualizarUsuarioValidator` (backend, `NotEqual(SUPERADMIN)`); `SUPERVISOR` exige `areaId` + `areaIds` no vacío en ambos lados (`superRefine` ↔ `RuleFor(...).When(Rol == SUPERVISOR)`); avatar (JPEG/PNG, ≤2MB) validado en frontend (`avatarFile.schema.ts`) y en backend por defensa en profundidad (mismo criterio que `PlanoValidator` de Locales).
- **Hallazgo confirmado en esta sesión, refina el punto 3 del handoff de Toño** (`/usuarios` NO carece de guard, como una lectura superficial podría sugerir): `router/routeAccess.ts` línea 51 define `usersAdmin: ['ADMINISTRADOR_EMPRESA']`, y `router/index.tsx` línea 211 envuelve `/usuarios` en `<RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.usersAdmin} />` — coincide exactamente con `canAdminister` en `UserList.tsx` (`authUser?.rol === 'ADMINISTRADOR_EMPRESA'`). Un `OPERARIO` (o cualquier rol no `ADMINISTRADOR_EMPRESA`) que navegue a `/usuarios` es redirigido a `/no-autorizado`, mismo comportamiento que cualquier otra ruta con `RoleGuard`. No es un hallazgo bloqueante ni una pregunta abierta — ya está resuelto en el código, ver D1.
- `shc-controldoc/.env.development` está hoy en `VITE_ENABLE_MSW=true`, `VITE_API_BASE_URL` vacío — estado esperado antes de abrir la ventana de verificación. `.env.production` ya tiene `VITE_ENABLE_MSW=false` desde `cutover-auth`, mismo Open Question de hosting pendiente (no se toca en este change).

## Goals / Non-Goals

**Goals:**
- Apuntar el frontend en desarrollo al backend .NET real y verificar: listar con filtros (`rol`, `activo`), crear (avatar + contraseña temporal), editar (incluida la independencia de `Rol` entre empresas para un mismo usuario), dar de baja/reactivar, resetear contraseña.
- Verificar las dos variantes del 409 de email duplicado (misma empresa vs. otra empresa) y la red de seguridad TOCTOU.
- Verificar por API directa la excepción `SUPERADMIN` de `GET /api/users` (D3 de `be-crud-gestion-usuarios`: ve todos los usuarios del sistema, sin filtro de empresa) — no hay UI que la ejercite, ver D2 de este documento.
- Diagnosticar y corregir, con causa raíz confirmada, cualquier discrepancia real que aparezca durante la verificación — sin asumir de antemano que existe ninguna.
- Inspeccionar los tests de Usuarios antes de asumir que dependen de MSW.

**Non-Goals:**
- No se construye ninguna UI nueva para la excepción `SUPERADMIN` de `GET /api/users` (un eventual panel global cross-empresa) — es trabajo de producto nuevo, no una corrección de contrato. Si el usuario decide que se construya, es una decisión explícita fuera del alcance actual de este change.
- No se elimina ningún código — a diferencia de otros cutovers, esta investigación no encontró código muerto de contrato en Usuarios (todo lo revisado en `UserList.tsx`, `UserFormModal.tsx`, `TemporaryPasswordModal.tsx`, `useUsers.ts` tiene consumidor real).
- No se resuelve el Open Question de hosting/dominio de producción heredado de `cutover-auth`.
- No se toca `.env.production`.
- No se toca `Features/Empresas/*` (`AsignarUsuarioEmpresa`, `ActualizarAsignacion`, `ListarUsuariosEmpresa`, `ResetPin`, `SetPin`) — ya cutover-eados en `cutover-catalogos`, quedan tal cual.

## Decisions

### D1 — El guard de ruta de `/usuarios` ya existe y coincide con el backend; se verifica, no se construye
El handoff de Toño marcaba como "a confirmar durante la verificación" si `/usuarios` tenía guard de ruta. La investigación de esta sesión (lectura directa de `router/routeAccess.ts` y `router/index.tsx`) confirma que sí: `RoleGuard requiredRoles={['ADMINISTRADOR_EMPRESA']}`, coincidente con `canAdminister` en `UserList.tsx` y con el `RequireRole(ADMINISTRADOR_EMPRESA)` de las 4 rutas backend que no son `GET /api/users`. La verificación (tasks.md) confirma el comportamiento observado en navegador/API (403 backend + redirect `/no-autorizado` frontend para un rol no autorizado), no descubre nada nuevo — es una confirmación, no una investigación abierta.

**Alternativa descartada**: tratar el punto 3 del handoff como una pregunta abierta de producto y esperar respuesta antes de proponer. Se descarta porque la respuesta ya está en el código — igual que `cutover-no-conformidades` D1, no se escribe una pregunta para el usuario cuando la investigación previa ya la resuelve.

### D2 — La excepción `SUPERADMIN` de `GET /api/users` se verifica por API directa, no por clic en la UI
`GET /api/users` acepta tanto `ADMINISTRADOR_EMPRESA` como `SUPERADMIN` (`ListarUsuariosEndpoint.cs` línea 16), pero ningún punto de la UI la invoca como `SUPERADMIN`: `/usuarios` solo admite `ADMINISTRADOR_EMPRESA` (D1), y la página que sí ve `SUPERADMIN` (`EmpresaUsuariosPage.tsx` en `/admin/empresas/:id/usuarios`) usa `useUsuarioEmpresa.ts`, que llama a `GET /api/empresas/:id/usuarios` (`ListarUsuariosEmpresa`, un endpoint distinto de `Features/Empresas/*`, ya cutover-eado en `cutover-catalogos`) — confirmado por grep, cero referencias a `listUsers`/`users.api.ts` dentro de `features/empresas/**`. Se verifica la excepción por `curl`/API directa: login como `SUPERADMIN`, `GET /api/users` sin header de empresa activa, confirmar que devuelve usuarios de todas las empresas con `rol: null` (D9 de `be-crud-gestion-usuarios`).

**Alternativa descartada**: construir un botón/página nueva para que `SUPERADMIN` pueda ver este listado global desde la UI. Se descarta por el mismo criterio que D2 de `cutover-no-conformidades` — el proposal es explícito en que esto es trabajo de producto nuevo, no una corrección de contrato, y mezclar ambos alcances dificultaría revisar cada uno por separado.

## Risks / Trade-offs

- **[Riesgo] La excepción `SUPERADMIN` de `GET /api/users` se verifica sin cobertura de UI real** → Mitigación: mismo patrón ya validado en `cutover-no-conformidades` D2 para las transiciones de estado de NC — el contrato backend se confirma igual de rigurosamente por API directa, solo cambia el mecanismo de invocación.
- **[Riesgo] Confundir el reset de contraseña de login (`ResetPasswordUsuario`) con el reset de PIN de firma (`Features/Empresas/ResetPin`)** → Mitigación: ambos ya están claramente separados en el código (comentario explícito en `ResetPasswordUsuarioHandler.cs`) y en el frontend (hooks distintos); la verificación confirma que cada botón de la UI invoca el endpoint correcto, sin necesidad de cambio de código.
- **[Riesgo] Si aparece un mismatch no detectado durante la verificación real** → Mitigación: mismo protocolo de diagnóstico-antes-de-fix que todos los cutovers anteriores — causa raíz confirmada (archivo + línea) documentada en este `design.md` antes de aplicar cualquier corrección.

## Migration Plan

1. Backend local (`dotnet run` + Postgres dev) arriba y sano.
2. `shc-controldoc/.env.development`: `VITE_ENABLE_MSW=false`, apuntar a backend local.
3. Verificar: listar usuarios con filtros `rol`/`activo`; crear usuario (avatar válido/inválido, contraseña temporal mostrada correctamente en `TemporaryPasswordModal`); editar usuario (nombre/apellido/email/rol/área/avatar, incluida la independencia de `Rol` entre empresas para un usuario con múltiples asignaciones); dar de baja y reactivar (`toggle-active`); resetear contraseña (confirmar el texto de ayuda ya existente en la UI sobre cómo compartir la contraseña temporal).
4. Verificar las dos variantes del 409 de email duplicado (misma empresa vs. otra empresa, con el mensaje que indica la vía `AsignarUsuarioEmpresa`).
5. Verificar por API directa (D2) la excepción `SUPERADMIN` de `GET /api/users`.
6. Diagnosticar y documentar (causa raíz, archivo + línea) cualquier discrepancia real encontrada antes de corregirla.
7. Inspeccionar los tests de Usuarios — documentar si `users.handlers.test.ts` (`setupServer(...userHandlers, ...authHandlers)`, confirmado por lectura que testea los handlers MSW mismos) se migra o se deja intacto, mismo criterio que `cutover-no-conformidades`/`cutover-incidentes` para tests que dependen de `msw/node`.
8. Revertir `shc-controldoc/.env.development` a `VITE_ENABLE_MSW=true` al terminar.
9. No tocar `.env.production`.

**Rollback:** revertir `VITE_ENABLE_MSW` a `true` restaura el comportamiento anterior de inmediato en el frontend. Si apareciera algún cambio de backend no anticipado, sería aditivo (nueva columna/endpoint nullable u opcional), revertible con el rollback estándar de EF Core sin pérdida de datos existentes.

## Hallazgos de verificación

Verificado por API directa contra el backend real (`http://localhost:5072`) + Postgres dev, con `VITE_ENABLE_MSW=false`. **Sin herramienta de automatización de navegador disponible en este entorno** (sin Playwright/similar, mismo aviso de metodología que `cutover-no-conformidades` 3.2) — todo el contrato (secciones 4-8 de `tasks.md`) se verificó por `curl` con JWT real obtenido por login, en vez de clic en la UI. Confirmado sin discrepancias: listado con filtros (`rol`/`activo`), creación (avatar válido/inválido espejado en ambos lados, contraseña temporal, validación `SUPERVISOR`), las dos variantes del 409 de email duplicado (en creación y en edición, con corrección de metodología documentada en tasks.md 5.4 — un primer intento contaminó su propio caso de prueba, no un bug de la app), la independencia de `Rol` entre empresas para un mismo usuario (D5, confirmado con un usuario real en dos empresas), `toggle-active` sin validación de bloqueo (D6), `reset-password` generando una contraseña distinta de la de creación, y la excepción `SUPERADMIN` de `GET /api/users` devolviendo `rol: null` en el 100% de los registros (D9). No se encontró ningún hallazgo real que requiera corrección — la investigación previa a proponer este change (Context) ya había identificado correctamente el contrato completo.

## Open Questions

Ninguna pendiente de decisión de producto a esta fecha. El punto 3 del handoff de Toño ("¿tiene guard de ruta `/usuarios`?") queda resuelto por D1 antes de iniciar la verificación — se confirma en `tasks.md`, no se investiga como pregunta abierta. Si la verificación revela que el usuario quiere construir una UI para la excepción `SUPERADMIN` de `GET /api/users` (D2), es una decisión de producto nueva y explícita — no bloquea el cierre de este change.
