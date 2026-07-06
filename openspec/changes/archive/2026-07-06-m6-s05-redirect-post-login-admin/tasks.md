## 1. Helper compartido

- [x] 1.1 Crear `src/router/getDefaultRoute.ts` con `getDefaultRouteForRole(rol: UserRole): string` que retorna `/admin/locales` para `ADMINISTRADOR_SISTEMA` y `/documentos` para el resto de roles.
- [x] 1.2 Añadir test unitario `src/router/getDefaultRoute.test.ts` cubriendo `ADMINISTRADOR_SISTEMA` → `/admin/locales` y al menos un rol operativo (p.ej. `JEFE_CALIDAD_SYST`) → `/documentos`.

## 2. Login fresco (useLogin)

- [x] 2.1 Actualizar `src/features/auth/hooks/useLogin.ts` para llamar `navigate(getDefaultRouteForRole(user.rol))` en vez de `navigate('/documentos')` en el `onSuccess`.
- [x] 2.2 Añadir/actualizar test que verifique que un login exitoso con fixture de rol `ADMINISTRADOR_SISTEMA` navega a `/admin/locales`, y que un login con otro rol sigue navegando a `/documentos`.

## 3. Sesión activa en LoginPage

- [x] 3.1 Actualizar `src/features/auth/pages/LoginPage.tsx` para leer `user` de `useAuthStore` y redirigir con `<Navigate to={getDefaultRouteForRole(user.rol)} replace />` cuando `isAuthenticated` es `true`, en vez del literal `/documentos`.
- [x] 3.2 Añadir/actualizar test de `LoginPage` que, con `authStore` en estado autenticado y rol `ADMINISTRADOR_SISTEMA`, verifique el redirect a `/admin/locales`; y que con otro rol el redirect siga siendo a `/documentos`.

## 4. Ruta índice `/` (bootstrap / hard-refresh)

- [x] 4.1 En `src/router/index.tsx`, reemplazar `{ index: true, element: <Navigate to="/documentos" replace /> }` por un componente (p.ej. `DefaultRouteRedirect`) que lea `user` de `useAuthStore` y renderice `<Navigate to={getDefaultRouteForRole(user.rol)} replace />`.
- [x] 4.2 Añadir/actualizar test de routing (siguiendo el patrón de `locationsAccess.test.tsx`) que, simulando sesión ya autenticada como `ADMINISTRADOR_SISTEMA` y navegación a `/`, verifique aterrizaje en `/admin/locales` sin pasar por `/no-autorizado`.
- [x] 4.3 Añadir/actualizar test equivalente para un rol operativo (p.ej. `JEFE_CALIDAD_SYST`) confirmando que `/` sigue redirigiendo a `/documentos` sin cambios.

## 5. Verificación de criterios de aceptación

- [x] 5.1 Ejecutar la suite de tests (`npm test` o equivalente) y confirmar que todos los tests nuevos y existentes pasan, incluyendo `locationsAccess.test.tsx` y los tests de auth existentes. (2 fallos preexistentes no relacionados: `DeadlineBadge.test.tsx`/`Pagination.test.tsx` — import roto de `i18n/config`, y `qualityEventCreate.schema.test.ts` — sin relación con este cambio; verificado que no fueron tocados por este cambio.)
- [x] 5.2 Verificar manualmente (o vía test end-to-end si aplica) los tres escenarios de aceptación: login fresco como `admin@shac.pe`, hard-refresh autenticado como `admin@shac.pe`, y navegación directa a `/` autenticado como `admin@shac.pe` — los tres deben aterrizar en `/admin/locales`. (Verificado vía test e2e sobre el `router` real en `locationsAccess.test.tsx`: login real + navegación a `/` aterriza en `/admin/locales`; `useLogin.test.tsx` cubre el `onSuccess` de login fresco; `LoginPage.test.tsx` cubre sesión ya activa. RoleGuard/DefaultRouteRedirect no distinguen sesión recién logueada de sesión restaurada por bootstrap — ambas dependen del mismo par `isAuthenticated`+`user` del store, por lo que el camino de hard-refresh queda cubierto por el mismo mecanismo.)
- [x] 5.3 Confirmar que ningún otro rol (`OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`) cambió su destino por defecto (`/documentos`). (Confirmado: `getDefaultRouteForRole` solo distingue `ADMINISTRADOR_SISTEMA`; tests en `getDefaultRoute.test.ts`, `useLogin.test.tsx`, `LoginPage.test.tsx` y `locationsAccess.test.tsx` cubren `JEFE_CALIDAD_SYST` como representante de rol operativo → `/documentos` sin cambios; suite completa pasa salvo 3 fallos preexistentes no relacionados.)
