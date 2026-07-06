## Why

`ADMINISTRADOR_SISTEMA` es un rol de sistema puro cuyo alcance es exclusivamente M6 (Admin CRUD Locales/Zonas) y futuros módulos de administración — no tiene acceso a ningún módulo operativo (M1-M5). Sin embargo, los tres puntos donde hoy se calcula el destino post-autenticación (`useLogin` tras un login exitoso, `LoginPage` cuando ya hay sesión activa, y la ruta índice `/` del router) redirigen a `/documentos` para **todos** los roles sin distinción. Como `ADMINISTRADOR_SISTEMA` no tiene permiso sobre `/documentos`, el `RoleGuard` de esa ruta lo rebota a `/no-autorizado` — un callejón sin salida justo después de autenticarse, tanto en login fresco como en hard-refresh o navegación directa a `/`.

## What Changes

- Introducir un helper único `getDefaultRouteForRole(rol: UserRole): string` que centraliza el destino por defecto post-autenticación: `/admin/locales` para `ADMINISTRADOR_SISTEMA`, `/documentos` para el resto de roles (sin cambios).
- Usar ese helper en los tres puntos de intervención identificados:
  - `useLogin.ts` (`onSuccess` del mutation de login fresco) — usa `user.rol` de la respuesta del login.
  - `LoginPage.tsx` (redirect cuando `isAuthenticated` ya es `true` al montar `/login`) — usa el `user` del `authStore`.
  - `router/index.tsx` (ruta índice `/` bajo `RoleGuard`, alcanzada tras bootstrap de sesión en hard-refresh o navegación directa) — usa el `user` del `authStore`.
- No se modifica el destino por defecto de ningún otro rol ni el comportamiento de `RoleGuard` para rutas con `requiredRoles` explícitos.

## Capabilities

### New Capabilities

(ninguna — este cambio reutiliza y extiende capacidades existentes)

### Modified Capabilities

- `auth-flow`: el requisito "LoginPage permite autenticarse con email y contraseña" pasa de un destino fijo `/documentos` a un destino dependiente del rol del usuario autenticado (`/admin/locales` para `ADMINISTRADOR_SISTEMA`, `/documentos` para el resto).
- `routing`: el requisito "Router define rutas públicas y protegidas con separación clara" (escenario "Ruta raíz redirige a documentos") pasa de un destino fijo a un destino dependiente del rol del usuario autenticado.

## Impact

- **Código afectado:** `src/features/auth/hooks/useLogin.ts`, `src/features/auth/pages/LoginPage.tsx`, `src/router/index.tsx`.
- **Código nuevo:** un helper compartido (p.ej. `src/router/getDefaultRoute.ts`) consumido por los tres puntos anteriores, evitando triplicar la condición de rol.
- **Sin impacto en:** `RoleGuard`, permisos de `/admin/locales` (ya definidos desde M6-S03), ni el destino por defecto de `OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`.
- **Tests:** requiere actualizar/añadir tests unitarios que cubran login fresco, redirect desde `/login` ya autenticado, y bootstrap/hard-refresh en `/`, todos para el rol `ADMINISTRADOR_SISTEMA`.
