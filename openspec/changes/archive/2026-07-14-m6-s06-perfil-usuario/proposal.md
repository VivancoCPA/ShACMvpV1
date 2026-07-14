## Why

No hay ninguna vista donde un usuario autenticado pueda ver su propia información de cuenta (rol, área, áreas asignadas) sin abrir DevTools, ni cambiar su contraseña de login sin pasar por el flujo de "olvidé mi contraseña". Esto dificulta soporte/debug durante desarrollo y es una carencia básica de autoservicio de cuenta antes de que exista M6 completo de gestión de usuarios.

## What Changes

- Nueva ruta `/perfil`, accesible para los 7 roles (los 6 roles de dominio + `ADMINISTRADOR_SISTEMA`) con solo sesión autenticada requerida — mismo patrón de guard que `/dev/semaforo-preview` (hijo de `AppShell`, sin `requiredRoles`).
- El botón "Mi perfil" del dropdown de avatar en `TopNav` (`myProfile`, actualmente solo cierra el dropdown sin navegar) pasa a navegar a `/perfil`.
- `/perfil` NO se agrega a `Sidebar.tsx` — accesible solo por ruta directa y por el dropdown, igual que las páginas `/dev/*`.
- Sección de solo lectura: avatar (tamaño `lg`), nombre completo, email, rol (con el mismo badge de color de `roleColors.ts`/`ROLE_BG_CLASSES` usado en TopNav), área propia, y `areasAsignadas[]` como lista de tags solo si `rol === 'SUPERVISOR'`.
- Sección editable: formulario de cambio de contraseña (contraseña actual + nueva + confirmar), con React Hook Form + Zod reutilizando las reglas de fortaleza de `resetPassword.schema.ts` (`PASSWORD_RULES`).
- Nuevo endpoint mock `POST /api/auth/change-password` en `auth.handlers.ts`: valida la contraseña actual contra `authFixtures`, y si es correcta, muta el campo `password` del usuario en el arreglo de fixtures en memoria (sin persistencia real — se pierde al recargar la página, limitación conocida del entorno mock, igual que el resto de auth/sesión).
- **Fuera de alcance explícito**: el PIN de firma electrónica de aprobación de documentos (RN-DOC-004) no se toca — es un mecanismo distinto y más crítico ligado a la firma de documentos. Esta spec cubre únicamente la contraseña de login (`authStore`/`auth.fixtures.ts`).
- **Fuera de alcance explícito**: edición de rol, área o `areasAsignadas` propias (responsabilidad futura de `ADMINISTRADOR_SISTEMA` vía gestión de usuarios).
- `MockUser` (`auth.fixtures.ts`) incorpora `createdAt` (obligatorio, semilla fija por usuario) y `lastLogin` (opcional, actualizado por el handler MSW de login en cada inicio de sesión exitoso). La página `/perfil` muestra "Cuenta creada" siempre, y "Último acceso" solo cuando `lastLogin` está definido.

## Capabilities

### New Capabilities

- `user-profile-view`: página `/perfil` con la sección de solo lectura (avatar, nombre, email, rol con badge, área, áreasAsignadas condicional para SUPERVISOR) y su integración de ruta/navegación (guard, entrada desde TopNav, ausencia en Sidebar).
- `user-profile-change-password`: formulario de cambio de contraseña propia (schema Zod, hook de mutación, endpoint MSW `POST /api/auth/change-password`, mutación in-memory de `authFixtures`, manejo de error de contraseña actual incorrecta).

### Modified Capabilities

_(ninguna — no existe un spec previo de auth-flow que cubra cambio de contraseña autenticado; los specs `auth-flow` y `routing` existentes no cambian sus requisitos, solo se extiende el árbol de rutas y el dropdown de TopNav con una entrada nueva, sin alterar comportamiento documentado)_

## Impact

- **Rutas**: `src/router/index.tsx` — nueva ruta `/perfil` como hijo directo de `AppShell`, sin `requiredRoles` (patrón `/dev/semaforo-preview`).
- **Componentes**: nueva página `src/features/users/pages/ProfilePage.tsx` (o ubicación equivalente a definir en design.md); `src/components/layout/TopNav.tsx` — el botón "Mi perfil" navega en vez de solo cerrar el dropdown.
- **API/hooks**: `src/features/auth/api/auth.api.ts` (nueva función `changePassword`), nuevo hook `useChangePassword`, nuevo schema `changePassword.schema.ts` en `features/auth/schemas/` (o `features/users/schemas/`, a definir en design.md).
- **MSW**: `src/mocks/handlers/auth.handlers.ts` — nuevo handler `POST /api/auth/change-password`; `src/mocks/fixtures/auth.fixtures.ts` no cambia su forma, pero su contenido en memoria se muta por el handler.
- **i18n**: nuevas claves en namespace `auth` (o `users`) para textos de `/perfil` en `es-PE.json` y `en-US.json`.
- **Dependencias**: ninguna nueva librería — reutiliza React Hook Form, Zod, TanStack Query, Sonner y componentes existentes (`UserAvatar`, `ROLE_BG_CLASSES`, `PASSWORD_RULES`).
