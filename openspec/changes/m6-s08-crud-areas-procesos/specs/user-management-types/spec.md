## MODIFIED Requirements

### Requirement: Tipos de request/response del CRUD de administración de usuarios

`src/types/auth.types.ts` (o un archivo `userManagement.types.ts` dentro de `features/users/`) SHALL definir los tipos `CreateUserRequest`, `UpdateUserRequest`, `ResetPasswordResponse` y `ToggleActiveRequest` usados por el cliente API y los hooks de administración de usuarios. Ninguno de estos tipos SHALL usar `any`; campos de tipo desconocido en tiempo de compilación SHALL tipearse como `unknown`. `CreateUserRequest`/`UpdateUserRequest` SHALL exponer `areaId` (string, FK a `Area.id` del catálogo M6-S08) en vez de `area` (nombre libre), y `areaIds` (`string[]` de FKs) en vez de `areasAsignadas` (`string[]` de nombres).

#### Scenario: CreateUserRequest cubre los campos de alta

- **WHEN** se construye un objeto que satisface `CreateUserRequest`
- **THEN** TypeScript exige `nombre`, `apellido`, `email`, `rol`, y campos opcionales `areaId`, `areaIds`, `avatarBase64`

#### Scenario: ResetPasswordResponse expone la contraseña temporal generada

- **WHEN** se construye un objeto que satisface `ResetPasswordResponse`
- **THEN** TypeScript exige un campo `temporaryPassword: string`

#### Scenario: CreateUserRequest ya no expone area ni areasAsignadas por nombre

- **WHEN** un desarrollador intenta asignar `area` o `areasAsignadas` a un objeto `CreateUserRequest`
- **THEN** TypeScript emite un error de compilación, ya que esas propiedades no existen — los campos son `areaId` y `areaIds`
