## Why

`/usuarios` existe hoy solo como stub (`ComingSoon`) protegido por
`RoleGuard requiredRoles={['JEFE_CALIDAD_SYST', 'ALTA_DIRECCION']}`
(`src/router/index.tsx`) — una asignación de roles sin fuente normativa
(no está en el RACI de M1, no fue decidida en ninguna spec previa) que
además contradice el rol de sistema pensado para administración:
`ADMINISTRADOR_SISTEMA`. No existe hoy ningún CRUD real de usuarios —
`features/users/` solo contiene el autoservicio de perfil (M6-S06). Esta
spec construye el CRUD administrativo completo y corrige el RBAC de la
ruta para que sea acceso exclusivo de `ADMINISTRADOR_SISTEMA`.

## What Changes

- **BREAKING (RBAC):** `RoleGuard` de `/usuarios` cambia de
  `['JEFE_CALIDAD_SYST', 'ALTA_DIRECCION']` a `['ADMINISTRADOR_SISTEMA']`.
  `JEFE_CALIDAD_SYST` y `ALTA_DIRECCION` pierden el acceso que tienen hoy
  (hoy solo ven un placeholder, sin impacto funcional real). El item de
  `Sidebar.tsx` (`key: 'users'`) se actualiza al mismo set de roles.
- Nuevo campo `activo: boolean` en `User` (`src/types/auth.types.ts`) y
  `MockUser` (`src/mocks/fixtures/auth.fixtures.ts`), default `true` en
  todos los fixtures existentes.
- Nuevo handler MSW de login: rechaza autenticación de usuarios con
  `activo === false` con mensaje explícito distinto de "credenciales
  inválidas".
- Nuevos handlers MSW CRUD de usuarios: listar (con filtros por rol y
  estado), crear, editar, dar de baja/reactivar, reset de contraseña.
- Nueva página `/usuarios`: listado con tabla, filtros, y acciones por
  fila; formulario de alta/edición con validación Zod, incluyendo carga
  de avatar (base64 en el mock).
- Reglas de negocio nuevas `RN-USR-001` a `RN-USR-007` (ver design.md /
  specs para detalle).

## Capabilities

### New Capabilities

- `user-management-types`: Tipo `User`/`MockUser` extendido con `activo`,
  y tipos de request/response del CRUD de usuarios (alta, edición, reset
  de contraseña, baja/reactivación).
- `user-management-schemas`: Schemas Zod de alta y edición de usuario
  (RN-USR-005, RN-USR-006, RN-USR-007), incluyendo validación condicional
  de `area`/`areasAsignadas` para `rol = SUPERVISOR` y validación de
  archivo de avatar (formato/tamaño).
- `user-management-msw`: Fixtures (`activo` en `authFixtures`) y handlers
  MSW del CRUD de usuarios (`GET/POST/PATCH /api/users*`) y del bloqueo de
  login para usuarios inactivos (RN-USR-002).
- `user-management-api-hooks`: Cliente Axios y hooks TanStack Query
  (`useUsers`, `useCreateUser`, `useUpdateUser`, `useToggleUserActive`,
  `useResetUserPassword`) siguiendo la convención `use[Entidad][Acción]`.
- `user-management-list-view`: Página de listado en `/usuarios` — tabla,
  filtros por rol/estado, acciones de baja/reactivación y reset de
  contraseña con confirmación (modal) y feedback (Sonner toast).
- `user-management-form`: Formulario de alta/edición (React Hook Form +
  Zod) con carga de avatar y preview, reutilizado para crear y editar.

### Modified Capabilities

- `routing`: `RoleGuard` de la ruta `/usuarios` cambia de
  `['JEFE_CALIDAD_SYST', 'ALTA_DIRECCION']` a `['ADMINISTRADOR_SISTEMA']`.
- `app-navigation`: item de sidebar `users` (`/usuarios`) actualiza su
  set de roles visibles al mismo cambio de RBAC.

## Impact

- **Código afectado:** `src/router/index.tsx`, `src/components/layout/Sidebar.tsx`,
  `src/types/auth.types.ts`, `src/mocks/fixtures/auth.fixtures.ts`,
  `src/mocks/handlers/auth.handlers.ts`, `src/features/users/` (nueva
  carpeta `pages/UsersListPage.tsx`, `components/`, `schemas/`, `api/`,
  `hooks/`).
- **Roles afectados:** `JEFE_CALIDAD_SYST` y `ALTA_DIRECCION` pierden
  acceso a `/usuarios`; `ADMINISTRADOR_SISTEMA` gana acceso completo
  (único módulo operativo al que este rol de sistema accede, según
  CLAUDE.md).
- **i18n:** nuevas claves en namespace `users` (o `common`, a decidir en
  design.md) para `es-PE` y `en-US`.
- **Sin cambios de backend real:** todo el CRUD vive en MSW; sin impacto
  en `.NET`/PostgreSQL (aún no existen).
