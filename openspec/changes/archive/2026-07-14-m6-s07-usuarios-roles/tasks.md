## 1. Modelo de datos

- [x] 1.1 Agregar `activo: boolean` a `User` (`src/types/auth.types.ts`)
- [x] 1.2 Agregar `activo: boolean` a `MockUser` (`src/mocks/fixtures/auth.fixtures.ts`) y setear `activo: true` en todos los usuarios semilla existentes
- [x] 1.3 Exportar `getUsersStore(): MockUser[]` desde `auth.fixtures.ts` como store mutable compartido (patrón `getIncidentsStore()`)
- [x] 1.4 Definir tipos `CreateUserRequest`, `UpdateUserRequest`, `ResetPasswordResponse`, `ToggleActiveRequest` (`src/types/auth.types.ts` o `features/users/types/userManagement.types.ts`)

## 2. Bloqueo de login para usuarios inactivos (RN-USR-002)

- [x] 2.1 Actualizar `POST /api/auth/login` en `src/mocks/handlers/auth.handlers.ts` para leer de `getUsersStore()` y rechazar usuarios con `activo === false` con mensaje explícito distinto de "credenciales inválidas"
- [x] 2.2 Agregar clave i18n del mensaje de usuario deshabilitado en `es-PE.json`/`en-US.json` (namespace `auth` o `users`)
- [x] 2.3 Test: login de usuario inactivo es rechazado con el mensaje correcto; login de usuario activo sigue funcionando

## 3. Schemas Zod (RN-USR-005, RN-USR-006, RN-USR-007)

- [x] 3.1 Crear `src/features/users/schemas/createUser.schema.ts` con `createUserSchema` (validación condicional de `area`/`areasAsignadas` para `rol === 'SUPERVISOR'`)
- [x] 3.2 Crear `src/features/users/schemas/updateUser.schema.ts` con `updateUserSchema` (mismas reglas condicionales, sin campo de contraseña)
- [x] 3.3 Agregar validación de archivo de avatar (tipo `image/jpeg`/`image/png`, tamaño máximo 2MB) reutilizable desde el componente de carga
- [x] 3.4 Test: alta de SUPERVISOR sin `areasAsignadas` falla; alta de otros roles sin esos campos pasa; email inválido falla; archivo de avatar fuera de formato/tamaño falla

## 4. Handlers y fixtures MSW de usuarios

- [x] 4.1 Crear `src/mocks/handlers/users.handlers.ts` con `GET /api/users` (filtros `rol`, `activo`)
- [x] 4.2 Implementar `POST /api/users` (RN-USR-005): validación de unicidad de email contra `getUsersStore()` (incluyendo usuarios inactivos), generación de contraseña temporal alfanumérica de 8 caracteres, respuesta con `temporaryPassword`
- [x] 4.3 Implementar `PATCH /api/users/:id` (RN-USR-006): actualiza `email`, `rol`, `area`, `areasAsignadas`, `avatarUrl`; valida unicidad de email excluyendo al propio usuario
- [x] 4.4 Implementar `PATCH /api/users/:id/toggle-active` (RN-USR-001, RN-USR-003): alterna `activo` sin eliminar el registro ni tocar otros campos
- [x] 4.5 Implementar `POST /api/users/:id/reset-password` (RN-USR-004): genera y persiste nueva contraseña temporal, retorna `temporaryPassword`
- [x] 4.6 Registrar `userHandlers` en `src/mocks/handlers/index.ts`
- [x] 4.7 Test: cada handler cubre sus escenarios de éxito y error (409 por email duplicado, baja no destructiva, reset habilita login con la nueva contraseña e invalida la anterior)

## 5. Cliente API y hooks TanStack Query

- [x] 5.1 Crear `src/api/endpoints/users.api.ts` con `listUsers`, `createUser`, `updateUser`, `toggleUserActive`, `resetUserPassword`
- [x] 5.2 Agregar `QUERY_KEYS.users` (`all`, `list(filters)`) siguiendo la convención existente
- [x] 5.3 Crear `src/features/users/hooks/useUsers.ts` con `useUsers(filters?)`, `useCreateUser()`, `useUpdateUser()`, `useToggleUserActive()`, `useResetUserPassword()` — las cuatro mutations invalidan `QUERY_KEYS.users.all`
- [x] 5.4 Registrar `AuditTrailEntry` en cada mutation (alta, edición, baja/reactivación, reset de contraseña)
- [x] 5.5 Test: mutations invalidan cache correctamente; `temporaryPassword` queda expuesta en `mutation.data` de alta y reset

## 6. Formulario de alta/edición (RN-USR-005, RN-USR-006, RN-USR-007)

- [x] 6.1 Crear `src/features/users/components/UserFormModal.tsx` (React Hook Form + Zod) reutilizado para alta y edición, distinguiendo modo por `userId` inicial
- [x] 6.2 Mostrar/ocultar `area`/`areasAsignadas` condicionalmente según `rol === 'SUPERVISOR'`
- [x] 6.3 Implementar input de avatar con preview (`FileReader.readAsDataURL`) y validación de formato/tamaño sin bloquear el resto del formulario
- [x] 6.4 Al completar alta exitosa, mostrar `temporaryPassword` reutilizando el mismo modal persistente con botón "Copiar" implementado para el reset de contraseña (`TemporaryPasswordModal`, RN-USR-004/RN-USR-005, CA-USR-08/CA-USR-09) — no un toast ni un componente nuevo
- [x] 6.5 Agregar claves i18n de todos los textos del formulario (namespace `users`, `es-PE` y `en-US`)
- [x] 6.6 Dark mode: verificar que todas las clases Tailwind del formulario tienen variante `dark:`
- [x] 6.7 Test: alta exitosa, edición precargada, validaciones Zod localizadas, preview de avatar, reemplazo de avatar en edición

## 7. Página de listado

- [x] 7.1 Crear `src/features/users/pages/UsersListPage.tsx`: tabla con nombre, email, rol (badge), área, estado, `lastLogin` (formateado con `Intl.DateTimeFormat` del locale activo, "Nunca" si ausente)
- [x] 7.2 Agregar paginación a la tabla (regla global de listas largas)
- [x] 7.3 Agregar filtros por rol y por estado (activo/inactivo/todos)
- [x] 7.4 Agregar acción de baja/reactivación por fila con modal de confirmación y toast de resultado
- [x] 7.5 Agregar acción de reset de contraseña por fila con modal/toast persistente mostrando `temporaryPassword`
- [x] 7.5a Agregar modal de confirmación explícito (nombre del usuario) antes de ejecutar el reset de contraseña, y reemplazar el toast de resultado por un modal persistente con botón "Copiar" (`navigator.clipboard.writeText`) con feedback visual temporal (RN-USR-004, CA-USR-08)
- [x] 7.6 Agregar botón de alta que abre `UserFormModal` en modo creación; acción de editar por fila que lo abre en modo edición
- [x] 7.7 Verificar rol `ADMINISTRADOR_SISTEMA` desde `authStore` antes de renderizar cada acción protegida (defensa en profundidad)
- [x] 7.8 Agregar `ErrorBoundary` de la feature
- [x] 7.9 Agregar claves i18n del listado (namespace `users`, `es-PE` y `en-US`)
- [x] 7.10 Dark mode: verificar que toda la página tiene variante `dark:` correspondiente
- [x] 7.11 Test: filtros, acciones por fila, accesibilidad (aria-label en botones sin texto, labels asociados a inputs)

## 8. Cambio de RBAC — router y sidebar (último paso)

- [x] 8.1 Reemplazar `<ComingSoon label="Usuarios y Roles" />` por `<UsersListPage />` en `src/router/index.tsx`
- [x] 8.2 Cambiar `RoleGuard requiredRoles={['JEFE_CALIDAD_SYST', 'ALTA_DIRECCION']}` de la ruta `/usuarios` a `requiredRoles={['ADMINISTRADOR_SISTEMA']}`
- [x] 8.3 Actualizar `roles` del ítem `key: 'users'` en `src/components/layout/Sidebar.tsx` a `['ADMINISTRADOR_SISTEMA']`
- [x] 8.4 Test: `JEFE_CALIDAD_SYST`/`ALTA_DIRECCION` reciben redirect a `/no-autorizado` en `/usuarios`; `ADMINISTRADOR_SISTEMA` accede normalmente y ve el ítem en el sidebar; otros roles no ven el ítem

## 9. Verificación final

- [x] 9.1 Ejecutar toda la suite de tests nueva y existente (regresión de `auth`, `router`, `Sidebar`) — 910/913 pasan tras agregar la confirmación+copiar del reset de contraseña y reutilizar el mismo modal para la contraseña temporal del alta; los 3 fallos restantes (`useNCList.test.ts`, `qualityEventCreate.schema.test.ts`) son preexistentes en `master`, no relacionados con M6-S07
- [x] 9.2 Verificado el escenario de login bloqueado para usuario dado de baja vía test automatizado (`users.handlers.test.ts`, `useUsers.test.ts`) y edición sin romper referencias históricas (`PATCH /api/users/:id` no toca `password`/`activo`, cubierto en `users.handlers.test.ts`). **No se realizó verificación manual interactiva en navegador** (sin herramienta de navegador disponible en este entorno) — se confirmó en su lugar que Vite sirve/transforma `UsersListPage.tsx` y `router/index.tsx` sin errores de compilación
- [x] 9.3 Revisión de código: todas las clases Tailwind nuevas en `UserFormModal.tsx`/`UserList.tsx`/`UsersListPage.tsx` incluyen variante `dark:` — no se verificó visualmente en navegador (mismo motivo que 9.2)
- [x] 9.4 Confirmado sin `useEffect` para derivar estado y sin `any` en `src/features/users/**`, `src/api/endpoints/users.api.ts`, `src/mocks/handlers/users.handlers.ts`
