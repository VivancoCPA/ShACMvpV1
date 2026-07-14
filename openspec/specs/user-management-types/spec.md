# user-management-types

TypeScript types backing M6 user administration (`ADMINISTRADOR_SISTEMA` CRUD of users): the `activo` field on `User`/`MockUser`, and the request/response DTOs consumed by the users API client and TanStack Query hooks.

## Requirements

### Requirement: Campo `activo` en User y MockUser
`src/types/auth.types.ts` (`User`) y `src/mocks/fixtures/auth.fixtures.ts` (`MockUser`) SHALL incluir un campo `activo: boolean`. Todos los usuarios definidos en `authFixtures` SHALL tener `activo: true` por defecto (ninguno de los usuarios semilla existentes queda inactivo).

#### Scenario: Fixtures existentes tienen activo=true
- **WHEN** se inspecciona cualquier elemento de `authFixtures`
- **THEN** su campo `activo` es `true`

#### Scenario: Tipo User expone activo
- **WHEN** se construye un objeto que satisface el tipo `User`
- **THEN** TypeScript exige el campo `activo: boolean`

### Requirement: Tipos de request/response del CRUD de administración de usuarios
`src/types/auth.types.ts` (o un archivo `userManagement.types.ts` dentro de `features/users/`) SHALL definir los tipos `CreateUserRequest`, `UpdateUserRequest`, `ResetPasswordResponse` y `ToggleActiveRequest` usados por el cliente API y los hooks de administración de usuarios. Ninguno de estos tipos SHALL usar `any`; campos de tipo desconocido en tiempo de compilación SHALL tipearse como `unknown`.

#### Scenario: CreateUserRequest cubre los campos de alta
- **WHEN** se construye un objeto que satisface `CreateUserRequest`
- **THEN** TypeScript exige `nombre`, `apellido`, `email`, `rol`, y campos opcionales `area`, `areasAsignadas`, `avatarBase64`

#### Scenario: ResetPasswordResponse expone la contraseña temporal generada
- **WHEN** se construye un objeto que satisface `ResetPasswordResponse`
- **THEN** TypeScript exige un campo `temporaryPassword: string`
