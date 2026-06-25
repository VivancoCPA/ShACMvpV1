## 1. Fixtures y handlers MSW de autenticación

- [x] 1.1 Crear `src/mocks/fixtures/auth.fixtures.ts` con 6 usuarios (uno por rol), password `Shac2025!`, y constante `MOCK_RESET_TOKEN`
- [x] 1.2 Crear `src/mocks/handlers/auth.handlers.ts` con handlers para `POST /auth/login`, `/auth/logout`, `/auth/refresh`, `/auth/forgot-password`, `/auth/reset-password` — el handler de `forgot-password` SIEMPRE retorna 200 independientemente de si el email existe en fixtures (práctica de seguridad: no revelar enumeración de usuarios)
- [x] 1.3 Exportar `authHandlers` desde `src/mocks/handlers/index.ts`

## 2. i18n — namespaces auth y nav

- [x] 2.1 Añadir namespace `auth` a `src/i18n/es-PE.json` con todas las claves especificadas (login, forgotPassword, resetPassword, validation, errors, roles, devMode)
- [x] 2.2 Añadir namespace `nav` a `src/i18n/es-PE.json` (documents, nonconformities, incidents, qualityEvents, dashboard, users, logout, myProfile, toggleTheme, toggleLanguage)
- [x] 2.3 Añadir namespace `auth` a `src/i18n/en-US.json` con las mismas claves en inglés
- [x] 2.4 Añadir namespace `nav` a `src/i18n/en-US.json` con las mismas claves en inglés

## 3. Schemas Zod de autenticación

- [x] 3.1 Crear `src/features/auth/schemas/login.schema.ts` con schema de email + password y tipo inferido `LoginInput`
- [x] 3.2 Crear `src/features/auth/schemas/forgotPassword.schema.ts` con schema de email y tipo inferido `ForgotPasswordInput`
- [x] 3.3 Crear `src/features/auth/schemas/resetPassword.schema.ts` con `PASSWORD_RULES`, schema de nueva contraseña + confirmación (`.refine` para coincidencia), e indicador de fortaleza helper

## 4. API client de autenticación y hooks TanStack Query

- [x] 4.1 Crear `src/features/auth/api/auth.api.ts` con funciones `loginUser`, `logoutUser`, `refreshToken`, `forgotPassword`, `resetPassword` usando la instancia Axios base
- [x] 4.2 Crear hook `useLogin` (mutation) que llama `authStore.login()` con los datos del servidor
- [x] 4.3 Crear hook `useLogout` (mutation) que llama `authStore.logout()` y navega a `/login`
- [x] 4.4 Crear hook `useForgotPassword` (mutation) para `POST /auth/forgot-password`
- [x] 4.5 Crear hook `useResetPassword` (mutation) para `POST /auth/reset-password`

## 5. Hook useDarkMode

- [x] 5.1 Crear `src/hooks/useDarkMode.ts` que lee `uiStore.theme`, detecta `prefers-color-scheme` si es `'system'`, aplica/quita clase `dark` en `document.documentElement`, y persiste en `localStorage` con clave `shac-theme`

## 6. Componentes UI base

- [x] 6.1 Crear `src/components/ui/UserAvatar.tsx` con soporte de imagen y fallback de iniciales, tamaños sm/md/lg, y color de fondo derivado del rol del usuario
- [x] 6.2 Crear `src/components/layout/PageWrapper.tsx` con props `title`, `actions` (opcional) y `children`, con `<h1>` en font-serif y padding `p-6`

## 7. Páginas de autenticación

- [x] 7.1 Crear `src/features/auth/pages/LoginPage.tsx` con layout centrado, formulario React Hook Form + schema Zod, toggle Eye/EyeOff, link a forgot-password, y selector de rol mock condicional a `VITE_ENABLE_MSW`
- [x] 7.2 Crear `src/features/auth/pages/ForgotPasswordPage.tsx` con formulario de email, estado de éxito con mensaje genérico, y link de volver
- [x] 7.3 Crear `src/features/auth/pages/ResetPasswordPage.tsx` con lectura de `?token=` (redirect si ausente), campos de contraseña + confirmación, barra de fortaleza de 4 segmentos, y schema Zod

## 8. Páginas de error

- [x] 8.1 Crear `src/pages/NotFoundPage.tsx` con mensaje 404 y link para volver al inicio
- [x] 8.2 Crear `src/pages/UnauthorizedPage.tsx` con mensaje de acceso denegado y link para volver

## 9. Componentes de layout (AppShell, Sidebar, TopNav)

- [x] 9.1 Crear `src/components/layout/Sidebar.tsx` con ancho 240px/64px, ítems filtrados por rol, ícono + texto, estado activo con estilo coral, footer con UserAvatar, transición CSS y botón de colapso accesible
- [x] 9.2 Crear `src/components/layout/TopNav.tsx` con altura `h-14`, breadcrumb desde `useMatches()`, toggle idioma, toggle tema, bloque de usuario con UserAvatar + nombre + badge de rol coloreado por rol, y dropdown de logout
- [x] 9.3 Crear `src/components/layout/AppShell.tsx` con layout flex, sidebar fijo en desktop y drawer en móvil, llamada a `useDarkMode()` en mount, y `<Outlet />` en área de contenido

## 10. Router y RoleGuard

- [x] 10.1 Crear `src/router/RoleGuard.tsx` con verificación render-time de autenticación y rol (sin `useEffect`), early return con `<Navigate replace>`
- [x] 10.2 Crear `src/router/index.tsx` con `createBrowserRouter`, árbol de rutas públicas y protegidas, rutas de módulos pendientes con placeholder "Próximamente", y `handle.breadcrumb` en cada ruta
- [x] 10.3 Crear `src/App.tsx` con `<RouterProvider router={router} />`

## 11. Verificación de criterios de aceptación

- [x] 11.1 Verificar que `/login` renderiza correctamente en light y dark mode, con selector de rol visible (MSW=true)
- [x] 11.2 Verificar flujo completo: seleccionar rol → login → sidebar con ítems filtrados → topnav con badge de rol → logout → redirect a login
- [x] 11.3 Verificar `/forgot-password`: submit con email válido → 200 + mensaje genérico; submit con email inexistente → también 200 + mismo mensaje (confirmar que el mock nunca distingue entre emails existentes y no existentes)
- [x] 11.4 Verificar `/reset-password?token=mock-reset-token`: indicador de fortaleza funciona, submit exitoso navega a login
- [x] 11.5 Verificar que usuario OPERARIO no ve No Conformidades ni Quality Events en el sidebar
- [x] 11.6 Verificar que TypeScript no reporta errores (`tsc --noEmit`)
