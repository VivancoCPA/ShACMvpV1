## Why

SHAC tiene el stack base instalado (React 19, TanStack Query, Zustand, MSW, Tailwind) pero no tiene ninguna ruta, shell de navegación ni flujo de autenticación. Sin esto, la app M1 (Control Documentario) no es navegable y no se puede iterar visualmente sobre ningún módulo.

## What Changes

- **Nuevo**: Router completo con `createBrowserRouter` — rutas públicas (login, forgot-password, reset-password) y rutas protegidas bajo `AppShell`.
- **Nuevo**: `RoleGuard` — guard de autenticación y rol en render-time, sin `useEffect`.
- **Nuevo**: `AppShell` — layout principal con sidebar colapsable (desktop/móvil) y topnav.
- **Nuevo**: `Sidebar` — navegación filtrada por rol, colapsable a íconos, con `UserAvatar` en footer.
- **Nuevo**: `TopNav` — breadcrumb dinámico, toggle idioma/tema, bloque de usuario con badge de rol y dropdown de logout.
- **Nuevo**: `UserAvatar` — componente de avatar con iniciales o imagen, colores derivados del rol.
- **Nuevo**: `PageWrapper` — contenedor de página con título y slot de acciones.
- **Nuevo**: Flujo de auth completo: `LoginPage` (con selector de rol mock en dev), `ForgotPasswordPage`, `ResetPasswordPage` (con indicador de fortaleza de contraseña).
- **Nuevo**: Schemas Zod para login, forgot-password y reset-password con reglas estrictas de contraseña.
- **Nuevo**: `auth.api.ts` — cliente Axios para los endpoints de autenticación.
- **Nuevo**: `useDarkMode` hook — aplica clase `dark` en `<html>`, detecta `prefers-color-scheme`, persiste en `localStorage`.
- **Nuevo**: MSW handlers y fixtures de auth (6 usuarios, uno por rol, password `Shac2025!`).
- **Modificado**: `src/mocks/handlers/index.ts` — se añaden `authHandlers`.
- **Modificado**: `src/i18n/es-PE.json` y `en-US.json` — se añaden namespaces `auth` y `nav`.

## Capabilities

### New Capabilities

- `app-navigation`: AppShell, Sidebar, TopNav, PageWrapper — estructura visual completa de la aplicación con soporte de dark mode y roles.
- `auth-flow`: LoginPage, ForgotPasswordPage, ResetPasswordPage, schemas Zod, API client, MSW handlers y fixtures — ciclo completo de autenticación.
- `routing`: Router con `createBrowserRouter`, `RoleGuard`, árbol de rutas protegidas y páginas 404/no-autorizado.

### Modified Capabilities

<!-- No existing specs have their requirements changed by this change. -->

## Impact

- **`src/App.tsx`**: punto de entrada reemplazado con `RouterProvider`.
- **`src/main.tsx`**: sin cambios (MSW setup ya implementado).
- **`src/stores/authStore.ts`**: consumido pero no modificado.
- **`src/stores/uiStore.ts`**: consumido pero no modificado.
- **Dependencias**: `react-router-dom` (ya instalado), `lucide-react` (ya instalado), `sonner` (ya instalado).
- **i18n**: adición de namespaces `auth` y `nav` a ambos archivos de traducción.
- **MSW**: nuevo archivo `auth.handlers.ts` + actualización de `handlers/index.ts`.
