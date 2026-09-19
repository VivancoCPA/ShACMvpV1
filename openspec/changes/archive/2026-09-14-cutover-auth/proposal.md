## Why

El backend .NET real ya tiene los 12 módulos de `Features/` construidos, y `Features/Auth` (7 endpoints) fue verificado manualmente contra Postgres real en `2026-08-18-be-manual-test-auth-empresas` (archivado) sin bugs encontrados. El frontend (`shc-controldoc`), sin embargo, sigue corriendo 100% contra MSW: `.env.production` tiene `VITE_ENABLE_MSW=true` y `VITE_API_BASE_URL=` vacío — el mock quedaría activo en un build de producción si se desplegara hoy. Auth es el módulo correcto para arrancar el cutover porque todo lo demás depende de una sesión válida: si login/refresh/logout no funcionan de punta a punta contra el backend real, ningún otro módulo puede verificarse de verdad.

## What Changes

- Apuntar `shc-controldoc` en desarrollo (`.env.development`) al backend .NET real (`dotnet run` + Postgres dev en `localhost:5435`) con `VITE_ENABLE_MSW=false`, y verificar en el navegador los 7 flujos de Auth (login mono-empresa, login multi-empresa con selección, login superadmin, logout, refresh silencioso al recargar, switch-empresa, forgot/reset/change-password) contra datos reales, no contra fixtures.
- **BREAKING (dev-only, reversible por flag)**: mientras `VITE_ENABLE_MSW` es una única bandera global (no por módulo), verificar Auth contra el backend real implica que el resto de los 11 módulos también dejan de estar mockeados durante esa ventana de prueba — no hay forma de aislar solo Auth sin apagar MSW por completo. Esto se documenta como restricción de arquitectura en `design.md`, no se intenta resolver en este change.
- Eliminar el código muerto de sesión-mock una vez confirmado que el backend real no los necesita: los headers `X-Mock-Refresh-Token`/`X-Mock-Empresa-Activa` que `authStore.ts` sigue enviando en cada refresh, y las funciones `persistMockRefreshToken`/`readMockRefreshToken` de `lib/mockSession.ts`. `persistActiveEmpresaId`/`readActiveEmpresaId` se mantienen (se usan también para la sugerencia de empresa preseleccionada en `LoginPage`, no son mock-only).
- Corregir `.env.production`: `VITE_ENABLE_MSW=false` y `VITE_API_BASE_URL` apuntando a la URL real del backend (o dejar el placeholder documentado si el dominio de producción aún no existe — ver Impact).
- Agregar `Cors:AllowedOrigins` a `appsettings.json`/`appsettings.Production.json` del backend con los orígenes reales del frontend cuando se conozcan (ver Decision pendiente en `design.md` sobre hosting); en dev, el fallback hardcodeado (`http://localhost:5173`) ya es correcto y no requiere cambios.
- Confirmar que el envelope `ApiResponse<T>` y los status codes de error (401/403/400) que interpreta el interceptor de Axios (`lib/axios.ts`) coinciden con lo que realmente devuelven los 7 endpoints de Auth — ya fue verificado del lado backend en `be-manual-test-auth-empresas`; aquí se confirma que el frontend interpreta esas mismas respuestas correctamente (toasts de error, refresh automático en 401, logout en refresh fallido).
- Migrar `src/stores/authStore.test.ts`, `src/features/auth/hooks/useLogin.test.tsx` y `src/features/auth/pages/LoginPage.test.tsx` para correr contra el backend real (Postgres dev + `dotnet run`) en vez de MSW, documentando en `design.md` el mecanismo elegido (variable de entorno de test, script de arranque, etc.).

## Capabilities

### New Capabilities

- `frontend-auth-cutover-verification`: define los escenarios de verificación manual en navegador (login mono-empresa, multi-empresa, superadmin, logout, refresh en reload, switch-empresa, forgot/reset/change-password) contra el backend .NET real + Postgres real, sin MSW, y las condiciones de "hecho" para retirar el código mock-only de sesión (`X-Mock-Refresh-Token`/`X-Mock-Empresa-Activa`/`persistMockRefreshToken`/`readMockRefreshToken`). Es el equivalente del lado frontend de `backend-auth-empresas-manual-verification` (que ya cubrió el contrato del lado backend).

### Modified Capabilities

Ninguna. `auth-flow` describe el comportamiento observable de las páginas de auth (que no cambia: la UI se comporta igual contra el backend real que contra MSW, por diseño del contrato compartido `ApiResponse<T>`). La limpieza de headers mock-only y el cambio de origen de datos son detalles de implementación, no requisitos nuevos. Si la verificación en navegador descubre una discrepancia de contrato real, se documenta como hallazgo en `design.md` de este change (y se corrige del lado que esté equivocado) en vez de generar una delta spec — el requisito ya existente sigue siendo la fuente de verdad.

## Impact

- **Afectado**: `shc-controldoc/.env.development`, `shc-controldoc/.env.production`, `shc-controldoc/src/stores/authStore.ts`, `shc-controldoc/src/lib/mockSession.ts`, `ShcMvpEndPoint/appsettings*.json` (sección `Cors:AllowedOrigins`), tests de auth listados arriba.
- **No afectado**: `openspec/specs/auth-flow`, `openspec/specs/empresa-session`, handlers MSW de auth (`src/mocks/handlers/auth.handlers.ts` se mantiene intacto — sigue siendo la base de los tests de otros módulos aún no cutover-eados y puede reactivarse con el flag).
- **Pendiente explícito, no se resuelve en este change**: el dominio/hosting real de producción (afecta si `SameSite=Strict` en la cookie de refresh sigue siendo viable — ver `design.md`); la automatización en CI de los tests migrados a backend real (hoy no existe pipeline de CI en el repo, los tests corren localmente vía `npx vitest`).
- **Fuera de alcance**: los otros 11 módulos backend (Areas/Empresas/Locales/Zonas, Incidentes, NoConformidades, QualityEvents, Documentos, Notifications, Dashboard, Users) — cada uno tendrá su propio change `cutover-<modulo>` siguiendo el mismo patrón, en el orden documentado en `design.md`.
