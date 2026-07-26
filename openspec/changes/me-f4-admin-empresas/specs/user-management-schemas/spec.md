## MODIFIED Requirements

### Requirement: Schema Zod de alta de usuario (RN-USR-005)
`src/features/users/schemas/createUser.schema.ts` SHALL exportar `createUserSchema` (Zod) validando: `nombre` y `apellido` (`min(1)`), `email` (formato válido), `rol` (`enum` de `UserRole` **excluyendo** `'SUPERADMIN'` — el flag de Superadmin nunca se asigna desde este flujo, ver `empresa-admin-types`; `'ADMINISTRADOR_EMPRESA'` sí queda incluido, como cualquier otro rol asignable dentro de una empresa), `areaId` (`string` opcional — FK a `Area.id`) y `areaIds` (`string[]` opcional — FKs a `Area.id`). El schema SHALL requerir `areaId` y al menos un elemento en `areaIds` cuando `rol === 'SUPERVISOR'`, usando `.superRefine()`, siguiendo el mismo patrón condicional ya usado para `areasAsignadas` en M4 (ahora `areaIds`).

#### Scenario: Alta de SUPERVISOR sin areaIds falla validación
- **WHEN** se valida `createUserSchema` con `rol: 'SUPERVISOR'` y `areaIds` ausente o vacío
- **THEN** la validación falla con un error localizado en el campo `areaIds`

#### Scenario: Alta de rol distinto de SUPERVISOR no requiere areaIds
- **WHEN** se valida `createUserSchema` con `rol: 'OPERARIO'` y sin `areaId` ni `areaIds`
- **THEN** la validación pasa

#### Scenario: Email con formato inválido falla validación
- **WHEN** se valida `createUserSchema` con `email: 'no-es-un-email'`
- **THEN** la validación falla con un error localizado en el campo `email`

#### Scenario: Alta de ADMINISTRADOR_EMPRESA es un valor de rol válido
- **WHEN** se valida `createUserSchema` con `rol: 'ADMINISTRADOR_EMPRESA'`
- **THEN** la validación pasa (sin requerir `areaId`/`areaIds`, igual que cualquier rol distinto de `SUPERVISOR`)

#### Scenario: SUPERADMIN no es un valor de rol aceptado
- **WHEN** se valida `createUserSchema` con `rol: 'SUPERADMIN'`
- **THEN** la validación falla — `SUPERADMIN` no está entre los valores aceptados por el campo `rol`
