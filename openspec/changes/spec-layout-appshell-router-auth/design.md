## Context

El proyecto tiene el scaffold base completo: React 19 + Vite + Tailwind + TanStack Query + Zustand + MSW. Los stores `authStore`, `uiStore` y `preferencesStore` están definidos. M1 (DocumentsPage, hooks, fixtures, handlers) está implementado pero no es navegable porque no existe router ni shell.

El backend aún no existe — MSW es la única fuente de datos en desarrollo.

## Goals / Non-Goals

**Goals:**
- App navegable con rutas protegidas desde el primer `npm run dev`.
- Shell visual consistente (Sidebar + TopNav) que filtra navegación por rol.
- Flujo completo de autenticación con MSW (login, forgot-password, reset-password).
- Dark mode funcional desde el primer render.
- Selector de rol en login solo en modo MSW (dev) para facilitar pruebas.

**Non-Goals:**
- Integración con backend real de autenticación.
- Flujos de cambio de contraseña desde perfil de usuario.
- Animaciones de transición de ruta.
- Tests E2E del flujo de autenticación.

## Decisions

### D1: `RoleGuard` como render-time check, sin `useEffect`

**Decisión**: `RoleGuard` lee `authStore` sincrónicamente y hace early return con `<Navigate>` en lugar de llamar `navigate()` dentro de un `useEffect`.

**Rationale**: La regla arquitectónica del proyecto prohíbe `useEffect` para derivar estado. Un render-time check con `<Navigate replace>` es idiomático en React Router v6 y evita el flash de contenido protegido que puede ocurrir con efectos asíncronos.

**Alternativa descartada**: `useEffect` + `navigate()` — violación de regla arquitectónica.

---

### D2: `useDarkMode` sin `useEffect` — sincronización en render

**Decisión**: `useDarkMode` aplica la clase `dark` en `document.documentElement` de forma sincrónica durante el render del componente (no en un efecto), leyendo el store de Zustand.

**Rationale**: Evita el flash de tema incorrecto (FOUC) y cumple la regla de no usar `useEffect` para derivar estado. El DOM manipulation es un side effect que en este caso se hace inline en el render-time del hook.

**Alternativa descartada**: `useLayoutEffect` — aunque evita FOUC, introduce una categoría de efectos. La solución inline es más simple.

---

### D3: Sidebar colapsable con estado en `uiStore` (Zustand)

**Decisión**: El estado `sidebarOpen` vive en `uiStore` (Zustand), no en estado local del componente.

**Rationale**: TopNav necesita el botón hamburger que modifica el sidebar. Si el estado fuera local a `AppShell`, habría prop drilling. Zustand elimina el coupling y el estado persiste entre navegaciones.

---

### D4: Selector de rol mock solo con `import.meta.env.VITE_ENABLE_MSW === 'true'`

**Decisión**: El selector de rol en `LoginPage` se renderiza condicionalmente con `{import.meta.env.VITE_ENABLE_MSW === 'true' && <RoleSelectorDev />}`.

**Rationale**: Vite tree-shakes el código de env vars en build time. En producción, el componente no existe. No se necesita feature flag ni lógica adicional.

---

### D5: Breadcrumb dinámico desde `useMatches()`

**Decisión**: `TopNav` usa `useMatches()` de React Router v6 para construir el breadcrumb leyendo el campo `handle.breadcrumb` de cada ruta.

**Rationale**: Desacopla el conocimiento del breadcrumb de `TopNav`. Cada ruta declara su propio label de breadcrumb en su definición. `useMatches()` es el patrón oficial de React Router v6 para este caso.

---

### D6: Contraseña — validación en schema, no en componente

**Decisión**: Las reglas de contraseña se definen en `PASSWORD_RULES` (constante exportada) y el schema Zod las aplica. Los componentes no tienen lógica de validación propia.

**Rationale**: Reutilizable para futura pantalla de cambio de contraseña. Consistencia garantizada. El schema vive en `features/auth/schemas/resetPassword.schema.ts` y es la única fuente de verdad.

---

### D7: UserAvatar — color de fondo derivado del rol

**Decisión**: El color de fondo de las iniciales en `UserAvatar` se obtiene de un mapa `ROLE_COLORS` compartido entre `UserAvatar` y `TopNav` (badge de rol).

**Rationale**: Un único mapa de colores evita que los colores diverjan entre el avatar y el badge. Se define en un archivo de constantes compartido (`features/auth/constants/roleColors.ts` o inline en el componente más cercano al uso común).

## Risks / Trade-offs

- **[Riesgo] Hydration mismatch con dark mode** → Mitigación: el hook aplica la clase antes del primer render del árbol de rutas. Si hay SSR en el futuro, añadir script de inicialización inline en `index.html`.
- **[Riesgo] `authStore` no persistido entre recargas** → El access token está en Zustand en memoria; un refresh de página cierra sesión. Mitigación aceptada para MVP: la sesión solo vive en la pestaña. El refresh token en cookie httpOnly está para cuando exista el backend.
- **[Trade-off] Selector de rol en LoginPage** → Expone fixtures de usuarios en bundle de desarrollo. Aceptable porque está detrás de `VITE_ENABLE_MSW` y no llega a producción.
- **[Riesgo] Sidebar drawer en móvil sin portal** → El drawer móvil se implementa como overlay dentro del flujo del DOM. Si hay z-index conflicts con modales, puede necesitar `portal`. Pospuesto para cuando exista un modal real.
