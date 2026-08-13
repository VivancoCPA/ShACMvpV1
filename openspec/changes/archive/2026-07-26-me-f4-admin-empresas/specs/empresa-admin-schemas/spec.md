## ADDED Requirements

### Requirement: Schema Zod de alta/edición de Empresa
`src/features/empresas/schemas/empresaForm.schema.ts` SHALL exportar `empresaFormSchema` (Zod) validando: `razonSocial` (`string`, `min(1)`), `ruc` (`string`, exactamente 11 dígitos numéricos — formato RUC peruano), `estado` (`enum(['ACTIVA', 'INACTIVA'])`), y `logoBase64` (`string` opcional — data URI, reutilizando la validación pura de `validateAvatarFile({ type, size })` de `avatarFile.schema.ts` sobre el `File` antes de convertirlo a base64, mismo límite de 2MB y tipos `image/jpeg`/`image/png`).

#### Scenario: RUC con menos de 11 dígitos falla validación
- **WHEN** se valida `empresaFormSchema` con `ruc: '123456'`
- **THEN** la validación falla con un error localizado en el campo `ruc`

#### Scenario: RUC con caracteres no numéricos falla validación
- **WHEN** se valida `empresaFormSchema` con `ruc: '2051234567A'`
- **THEN** la validación falla con un error localizado en el campo `ruc`

#### Scenario: razonSocial vacía falla validación
- **WHEN** se valida `empresaFormSchema` con `razonSocial: ''`
- **THEN** la validación falla con un error localizado en el campo `razonSocial`

#### Scenario: Alta sin logo es válida
- **WHEN** se valida `empresaFormSchema` sin `logoBase64`
- **THEN** la validación pasa — el logo es opcional

### Requirement: Validación de unicidad de RUC contra el store de empresas
El flujo de alta SHALL validar que el `ruc` no exista ya en el store de empresas, considerando todas las empresas sin importar su `estado`. Esta validación SHALL ocurrir en el handler MSW de creación (no solo client-side), retornando `409` con mensaje descriptivo si el RUC ya existe.

#### Scenario: RUC duplicado es rechazado
- **WHEN** se envía una solicitud de alta con un `ruc` que ya pertenece a una empresa existente (activa o inactiva)
- **THEN** el handler responde `409` con un mensaje indicando que el RUC ya está registrado

### Requirement: Schema Zod de asignación usuario-empresa-rol
`src/features/empresas/schemas/asignarUsuarioEmpresa.schema.ts` SHALL exportar `asignarUsuarioEmpresaSchema` (Zod) validando: `usuarioId` (`string`, `min(1)` — id de un `Usuario` existente) y `rol` (`enum` de `UserRole` **excluyendo** `'SUPERADMIN'` — el flag de Superadmin nunca se asigna vía `UsuarioEmpresa`, ver `empresa-admin-types`).

#### Scenario: Asignar rol SUPERADMIN vía este schema falla validación
- **WHEN** se valida `asignarUsuarioEmpresaSchema` con `rol: 'SUPERADMIN'`
- **THEN** la validación falla — `SUPERADMIN` no es un valor aceptado por el enum de este campo

#### Scenario: Asignación sin usuarioId falla validación
- **WHEN** se valida `asignarUsuarioEmpresaSchema` sin `usuarioId`
- **THEN** la validación falla con un error localizado en el campo `usuarioId`
