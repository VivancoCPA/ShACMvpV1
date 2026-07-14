## ADDED Requirements

### Requirement: Cliente API de usuarios
`src/api/endpoints/users.api.ts` SHALL exportar funciones Axios (`listUsers`, `createUser`, `updateUser`, `toggleUserActive`, `resetUserPassword`) que invocan los endpoints correspondientes de `users.handlers.ts`, siguiendo la convención de capas del proyecto (componente → hook TanStack Query → `*.api.ts` → MSW). Ningún componente ni hook SHALL invocar `axios` directamente.

#### Scenario: Todas las mutaciones pasan por el cliente API
- **WHEN** se inspecciona el código de los hooks de administración de usuarios
- **THEN** ninguno importa `axios` directamente; todos invocan funciones de `users.api.ts`

### Requirement: Query keys de administración de usuarios
`src/lib/queryClient.ts` (o el archivo de `QUERY_KEYS` correspondiente) SHALL agregar una entrada `users` con `all`, `list(filters)` y opcionalmente `detail(id)`, siguiendo la convención existente de `QUERY_KEYS.documents`.

#### Scenario: Query key de listado varía por filtros
- **WHEN** se invoca `QUERY_KEYS.users.list({ rol: 'SUPERVISOR' })` y `QUERY_KEYS.users.list({})`
- **THEN** ambas keys son distintas entre sí

### Requirement: Hook de listado de usuarios
`src/features/users/hooks/useUsers.ts` SHALL exportar `useUsers(filters?)` como `useQuery` de TanStack Query v5, bajo `QUERY_KEYS.users.list(filters)`, invocando `listUsers` de `users.api.ts`.

#### Scenario: useUsers retorna todos los usuarios sin filtros
- **WHEN** se invoca `useUsers()` sin argumentos
- **THEN** el resultado incluye usuarios activos e inactivos de todos los roles

### Requirement: Hooks de mutation de administración de usuarios
`useUsers.ts` SHALL exportar `useCreateUser()`, `useUpdateUser()`, `useToggleUserActive()` y `useResetUserPassword()` como `useMutation` de TanStack Query v5. Las cuatro mutations SHALL invalidar `QUERY_KEYS.users.all` en éxito. `useCreateUser()` y `useResetUserPassword()` SHALL exponer `temporaryPassword` en su resultado (`data`) para que la UI lo muestre.

#### Scenario: Crear usuario invalida el listado
- **WHEN** `useCreateUser().mutate(data)` completa exitosamente
- **THEN** la query `QUERY_KEYS.users.all` queda invalidada

#### Scenario: Dar de baja invalida el listado
- **WHEN** `useToggleUserActive().mutate(id)` completa exitosamente
- **THEN** la query `QUERY_KEYS.users.all` queda invalidada

#### Scenario: Reset de contraseña expone la contraseña temporal al caller
- **WHEN** `useResetUserPassword().mutate(id)` completa exitosamente
- **THEN** `mutation.data.temporaryPassword` contiene la contraseña generada por el handler

### Requirement: Registro de mutaciones en Audit Trail
Cada mutation de `useUsers.ts` (alta, edición, baja/reactivación, reset de contraseña) SHALL registrar una entrada de `AuditTrailEntry` asociada al usuario afectado, con `entidadTipo` adaptado al dominio de usuarios y `generadoPorIA: false`, consistente con la regla global de audit trail append-only de CLAUDE.md.

#### Scenario: Dar de baja a un usuario registra audit trail
- **WHEN** `useToggleUserActive().mutate(id)` completa exitosamente
- **THEN** se registra una entrada de audit trail con `accion: 'ESTADO_CAMBIADO'`, `estadoAnterior` y `estadoNuevo` reflejando el cambio de `activo`
