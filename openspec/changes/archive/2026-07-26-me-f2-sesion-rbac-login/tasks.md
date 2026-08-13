## 1. Auditoría previa (bloqueante, antes de tocar código)

- [x] 1.1 Grep completo de `\.rol\b` en `src/` y clasificar cada uno de los ~69 archivos en: (a) lee `authStore.user.rol` directa o indirectamente (vía `RoleGuard`, `routeAccess.ts`, `getDefaultRoute.ts`, Sidebar, TopNav, `*Permissions.ts` de dominio) — no requiere cambio; (b) handlers MSW que resuelven el "usuario actuante" por su cuenta (`getUserFromRequest`, `useAuthStore.getState().user`) — requieren migrar a `getSessionUser()` (grupo 4); (c) cualquier otro caso (ej. `features/users/` administrando `User.rol` como campo plano) — documentar como fuera de alcance (Fase 4), no migrar
- [x] 1.2 Dejar el resultado de 1.1 como comentario/nota en el PR o resumen final — no debe quedar ningún punto de categoría (b) sin listar

**Resultado de la auditoría (grep `\.rol\b`, 69 archivos):**

- **(a) Vía sesión (`authStore.user.rol` o params derivados de él) — ~50 archivos, sin cambios de código, corregidos automáticamente por el trabajo de los grupos 2-4.** Incluye: `RoleGuard.tsx`, `router/index.tsx`, `router/DocumentEditGuard.tsx`, `router/routeAccess.ts`/`getDefaultRoute.ts` (consumidos con `user.rol`), `Sidebar.tsx`, `TopNav.tsx`, `UserAvatar.tsx`, `LoginPage.tsx`/`useLogin.ts`, `utils/documentPdf.ts`, todas las páginas/componentes de Documentos, Incidentes, NC y Quality Events que leen `user?.rol`/`useAuthStore(s => s.user?.rol)` para gating de UI o pasan `user.rol` a un `*Permissions.ts` de dominio (`qualityEventPermissions.ts`, `ncPermissions.ts`, `incidentPermissions.ts`, `areasPermissions.ts`, `localesPermissions.ts`), y las páginas de Dashboard por rol (`OperarioDashboard.tsx`, `SupervisorDashboard.tsx`, `JefeCalidadDashboard.tsx`, `JefeControlDocumentarioDashboard.tsx`, `AuditorDashboard.tsx`, `AltaDireccionDashboard.tsx`, `DashboardPage.tsx`) que leen `data.rol` de la respuesta de `dashboard.handlers.ts` — quedan correctos en cuanto ese handler migra a `getSessionUser()` (grupo 5).
- **(b) Handlers MSW que resuelven el usuario actuante por su cuenta — 6 archivos, requieren migración explícita (grupo 5):** `documents.handlers.ts`, `dashboard.handlers.ts`, `incidents.handlers.ts`, `nonconformities.handlers.ts`, `notifications.handlers.ts` (cada uno con su propia función local `getUserFromRequest` duplicada) y `quality-events.handlers.ts` (ya lee `useAuthStore.getState().user` inline — se actualiza para importar el helper compartido en vez de leer el store directo, mismo resultado).
- **(c) Fuera de alcance de esta fase (Fase 4 / informacional, sin cambio):**
  - `features/users/**` (`users.handlers.ts`, `users.api.ts`, `UserFormModal.tsx`, `UserList.tsx`, `createUser.schema.ts`, `updateUser.schema.ts`, sus tests) — el CRUD de administración de usuarios sigue leyendo/escribiendo `User.rol` como campo plano de fixture; no se toca hasta Fase 4 (asignación usuario↔empresa). Documentado como inconsistencia conocida en `design.md` (Risks).
  - `NonconformityDetailPage.tsx` (`u.rol` de `detectadoPorId`) y `NCForm.tsx` (`u.rol` en dropdown de responsables) — muestran el rol de **otro** usuario con fines informativos/de display, no es una decisión de permisos de la sesión activa; sin cambio.
  - `mocks/fixtures/notificationGeneration.ts` — itera `getUsersStore()` completo (todas las empresas) para decidir destinatarios de notificaciones por rol; no filtra por empresa hoy y no es objetivo de esta fase (el filtrado por empresa de notificaciones es Fase 3).

## 2. Tipos y estado de sesión

- [x] 2.1 Extender `AuthState` en `src/stores/authStore.ts` con `empresaActivaId: string | null` y `empresasDisponibles: Empresa[]`
- [x] 2.2 Actualizar la acción `login()` de `authStore` para aceptar y guardar `empresaActivaId`/`empresasDisponibles` además de `user`/`accessToken`
- [x] 2.3 Agregar acción `switchEmpresa({ user, accessToken, empresaActivaId, empresasDisponibles })` a `authStore` (actualiza sesión sin tocar `isAuthenticated`)
- [x] 2.4 Actualizar `logout()` para limpiar `empresaActivaId`/`empresasDisponibles`
- [x] 2.5 Actualizar `bootstrap()` para poblar `empresaActivaId`/`empresasDisponibles` desde la respuesta de `/auth/refresh`
- [x] 2.6 Actualizar `LoginResponse` (`src/features/auth/api/auth.api.ts`) para incluir `empresaActivaId`, `empresasDisponibles`, y un tipo unión con la respuesta `{ requiresEmpresaSelection: true; empresasDisponibles: Empresa[] }`

## 3. Persistencia mock de `empresaActivaId`

- [x] 3.1 Agregar `persistActiveEmpresaId(id: string | null)` / `readActiveEmpresaId(): string | null` a `src/lib/mockSession.ts` (misma clave/patrón de `localStorage` que `mockRefreshToken`)
- [x] 3.2 Invocar `persistActiveEmpresaId` en `authStore.login()` y `authStore.switchEmpresa()`; limpiar en `authStore.logout()`

## 4. Handlers MSW de auth

- [x] 4.1 `POST /api/auth/login` (`src/mocks/handlers/auth.handlers.ts`): aceptar `empresaId?` en el body; resolver empresas activas del usuario vía `usuarioEmpresaFixtures`; si hay exactamente 1 → resolver sesión completa ignorando `empresaId`; si hay más de 1 y `empresaId` ausente → responder `{ requiresEmpresaSelection: true, empresasDisponibles }`; si `empresaId` viene y es válido → resolver sesión completa con ese rol
- [x] 4.2 Rechazar `empresaId` que no tenga fila `UsuarioEmpresa` activa para el usuario (error, no login)
- [x] 4.3 `POST /api/auth/refresh`: leer el header `X-Mock-Empresa-Activa` (persistido por 3.1/3.2) y resolver el rol efectivo para esa empresa antes de responder; fallback razonable si el header falta o la empresa ya no es válida (usar la primera empresa activa disponible)
- [x] 4.4 Agregar `POST /api/auth/switch-empresa` (autenticado): valida `empresaId` contra las asignaciones activas del usuario del token, resuelve nuevo rol efectivo, reemite `accessToken`, responde sesión completa
- [x] 4.5 Asegurar que las 3 respuestas (login resuelto, refresh, switch-empresa) comparten la misma forma de sesión (`accessToken`, `user`, `empresaActivaId`, `empresasDisponibles`)

## 5. Consolidar resolución de usuario actuante en handlers de dominio

- [x] 5.1 Crear `src/mocks/handlers/shared/session.ts` con `getSessionUser()`, que lee `useAuthStore.getState().user` (rol ya efectivo) y valida el Bearer token del request contra ese `user.id` (401 si no matchea/falta) — también expone `getSessionUserUnchecked()` (mismo dato, sin validar token) para call sites que no tenían `Request` en scope
- [x] 5.2 Migrar `documents.handlers.ts` de su `getUserFromRequest` local a `getSessionUser()` (import aliaseado `getSessionUser as getUserFromRequest`, cero cambios en call sites)
- [x] 5.3 Migrar `dashboard.handlers.ts` de su `getUserFromRequest` local a `getSessionUser()`; `buildOperarioData`/`buildSupervisorData`/`buildDashboardSummary` cambian su parámetro de `MockUser` a `User` (mismos campos usados: `id`, `areaId`, `areaIds`, `rol`)
- [x] 5.4 Migrar `incidents.handlers.ts` de su `getUserFromRequest` local a `getSessionUser()`
- [x] 5.5 Migrar `nonconformities.handlers.ts` de su `getUserFromRequest` local a `getSessionUser()`
- [x] 5.6 Migrar `notifications.handlers.ts` de su `getUserFromRequest` local a `getSessionUser()`
- [x] 5.7 Actualizar `quality-events.handlers.ts` para importar `getSessionUserUnchecked()` en vez de leer `useAuthStore.getState().user` inline (mismo resultado, un solo punto de verdad; conserva la firma sin `Request` que ya tenían `getCurrentUser()`/`getCurrentUserForEditAccess()`)
- [x] 5.8 Eliminar las 5 definiciones locales duplicadas de `getUserFromRequest` una vez migradas

## 6. LoginPage — layout de dos paneles y selección de empresa

- [x] 6.1 Reestructurar `LoginPage.tsx` a layout de dos paneles (panel izquierdo: arte institucional genérico SHAC; panel derecho: contenido existente del formulario)
- [x] 6.2 Agregar paso de selección de empresa: al recibir `requiresEmpresaSelection: true` de `useLogin`, mostrar lista de `empresasDisponibles` (por `razonSocial`) sin re-pedir credenciales
- [x] 6.3 Preseleccionar (no autocompletar) la empresa correspondiente al `empresaActivaId` persistido (`readActiveEmpresaId()`) como sugerencia por defecto en el selector
- [x] 6.4 Al confirmar una empresa, reenviar el login con `{ email, password, empresaId }` y completar el flujo existente (`authStore.login()` + redirect por `getDefaultRouteForRole`)
- [x] 6.5 Actualizar `useLogin.ts` para manejar la respuesta unión (`requiresEmpresaSelection` vs sesión completa) sin romper el manejo de errores existente

## 7. TopNav — selector de empresa activa

- [x] 7.1 Crear hook `useSwitchEmpresa()` (TanStack `useMutation`) que llama `POST /api/auth/switch-empresa`, actualiza `authStore.switchEmpresa()`, invoca `queryClient.clear()`, y redirige con `isRouteAllowedForRole`/`getDefaultRouteForRole` si la ruta actual deja de ser válida para el nuevo rol
- [x] 7.2 Agregar selector de empresa activa a `TopNav.tsx` — **corregido tras feedback de Toño**: el nombre de la empresa activa se muestra siempre que hay una empresa resuelta (antes quedaba oculto para usuarios mono-empresa); solo el control de cambio (botón+dropdown) queda condicionado a `empresasDisponibles.length > 1`
- [x] 7.3 Verificar que el badge de rol y el resto de `TopNav` reaccionan automáticamente al nuevo `user.rol` tras el switch (sin cambios adicionales, ya que leen del store) — confirmado por lectura de código: el badge lee `user.rol` de `authStore` en cada render, sin estado local propio

## 8. i18n

- [x] 8.1 Agregar claves nuevas de `es-PE.json`/`en-US.json` para: paso de selección de empresa en login, selector de empresa activa en TopNav, mensajes de error de `switch-empresa`

## 9. Tests y verificación estática

- [x] 9.1 Actualizar/crear tests de `authStore` para `empresaActivaId`, `empresasDisponibles`, `switchEmpresa()` — nuevo `src/stores/authStore.test.ts`
- [x] 9.2 Actualizar tests de `auth.handlers.ts` (login mono-empresa, login multi-empresa con y sin `empresaId`, refresh con empresa persistida, switch-empresa exitoso y rechazado) — agregado a `auth.handlers.test.ts`; de paso se encontró y corrigió un bug real: `resolveSession()` copia el usuario *antes* de que el handler de login le asigne `lastLogin`, dejando la respuesta con `lastLogin` stale (ahora se sincroniza explícitamente tras resolver)
- [x] 9.3 Revisar y actualizar los tests existentes de `documents.handlers.test.ts`, `dashboard.handlers.test.ts`, `incidents.handlers.test.ts`, `nonconformities.handlers.test.ts`, `notifications.handlers.test.ts` para que su helper `authHeaders(email)` también pueble `authStore` (antes solo fabricaba un Bearer token y confiaba en `getUserFromRequest` re-derivándolo de `authFixtures`; con `getSessionUser` eso ya no basta). Además se detectó y corrigió un gap real: usuarios creados vía `POST /api/users` (CRUD de M6) no tenían fila `UsuarioEmpresa`, por lo que no podían loguearse nunca bajo la nueva resolución — `users.handlers.ts` ahora crea esa fila (`empresa-001` por defecto) al crear un usuario, y la mantiene sincronizada si se edita el `rol` vía `PATCH /api/users/:id`
- [x] 9.4 Correr `tsc -p tsconfig.app.json` (el `tsc --noEmit` de la raíz no compila nada real — usa project references con `files: []`) y confirmar 0 errores relacionados a `SessionPayload`/`LoginResponse`/`empresaActivaId`/`empresasDisponibles`/`switchEmpresa`/`isLoginResolved`. Quedan ~700 errores preexistentes no relacionados (mayormente `toBeInTheDocument` y similares — `tsconfig.app.json` no tiene los tipos de `@testing-library/jest-dom`/vitest globals en su `types`, un gap de configuración anterior a este cambio, no algo que este cambio deba resolver)
- [x] 9.5 Correr la suite completa (`npx vitest run`, 1162 tests) — 1157 pasan. Los 5 tests que fallan en 6 archivos son preexistentes y verificablemente no relacionados a este cambio (confirmado leyendo cada uno, no solo por inspección superficial): `DeadlineBadge.test.tsx`/`Pagination.test.tsx` (import roto a `../../i18n/config`, no existe ese archivo), `qualityEventCreate.schema.test.ts` (validación Zod de O1/O4 sin relación a auth), `useNCList.test.ts` (espera `pageSize: 5`, el hook usa `10` — sin relación a auth), `JefeCalidadDashboard.test.tsx` (mockea `useDashboardSummary` directamente, sin tocar `authStore`/handlers). `useDashboardSummary.test.ts` merece nota aparte: **sí** se investigó a fondo (con logging temporal) porque a primera vista parecía causado por este cambio — se confirmó que `getSessionUser` resuelve el usuario correcto en cada caso; la causa real es que Fase 1 agregó QEs de `empresa-002` que reutilizan `areaId: 'area-001'` (mismo catálogo de Áreas, sin scoping por empresa — explícitamente fuera de alcance hasta Fase 3), inflando el conteo que el test esperaba. Es una colisión de datos de Fase 1, no una regresión de Fase 2.

## 10. Verificación en navegador

- [ ] 10.1 Loguearse con `user-operario-001` (mono-empresa) y confirmar que el login sigue siendo de un solo paso, sin selector de empresa — **PENDIENTE**: sin herramienta de automatización de navegador disponible en esta sesión (extensión Chrome no instalada); se verificó por otra vía que `npm run dev` sirve la SPA sin errores (`GET / → 200`, `<title>shc-controldoc</title>`), no es verificación visual real. Requiere verificación manual humana.
- [ ] 10.2 Loguearse con `user-supervisor-001` (multi-empresa) y confirmar que aparece el paso de selección de empresa con ambas opciones — **PENDIENTE**, mismo motivo que 10.1
- [ ] 10.3 Elegir `empresa-002` en el login y confirmar que el rol/sidebar/permisos corresponden a `JEFE_CALIDAD_SYST`, no a `SUPERVISOR` — **PENDIENTE**, mismo motivo que 10.1
- [ ] 10.4 Usar el selector de `TopNav` para volver a `empresa-001` sin cerrar sesión y confirmar que el rol/sidebar vuelven a `SUPERVISOR` — **PENDIENTE**, mismo motivo que 10.1
- [ ] 10.5 Recargar la página completa tras un cambio de empresa y confirmar que la empresa activa y el rol se conservan (no vuelve a `empresa-001` por defecto) — **PENDIENTE**, mismo motivo que 10.1
- [ ] 10.6 Confirmar que ninguna vista muestra datos "pegados" de la empresa anterior tras un switch (cache limpio) — **PENDIENTE**, mismo motivo que 10.1
- [x] 10.7 Dejar un resumen corto de: archivos tocados, cómo quedó el flujo de selección de empresa en login, y qué guards/checks de rol se migraron (para verificación humana) — ver resumen final entregado al usuario
