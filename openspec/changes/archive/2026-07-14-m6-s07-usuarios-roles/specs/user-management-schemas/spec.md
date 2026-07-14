## ADDED Requirements

### Requirement: Schema Zod de alta de usuario (RN-USR-005)
`src/features/users/schemas/createUser.schema.ts` SHALL exportar `createUserSchema` (Zod) validando: `nombre` y `apellido` (`min(1)`), `email` (formato válido), `rol` (`enum` de `UserRole`), `area` (`string` opcional) y `areasAsignadas` (`string[]` opcional). El schema SHALL requerir `area` y al menos un elemento en `areasAsignadas` cuando `rol === 'SUPERVISOR'`, usando `.superRefine()`, siguiendo el mismo patrón condicional ya usado para `areasAsignadas` en M4.

#### Scenario: Alta de SUPERVISOR sin areasAsignadas falla validación
- **WHEN** se valida `createUserSchema` con `rol: 'SUPERVISOR'` y `areasAsignadas` ausente o vacío
- **THEN** la validación falla con un error localizado en el campo `areasAsignadas`

#### Scenario: Alta de rol distinto de SUPERVISOR no requiere areasAsignadas
- **WHEN** se valida `createUserSchema` con `rol: 'OPERARIO'` y sin `area` ni `areasAsignadas`
- **THEN** la validación pasa

#### Scenario: Email con formato inválido falla validación
- **WHEN** se valida `createUserSchema` con `email: 'no-es-un-email'`
- **THEN** la validación falla con un error localizado en el campo `email`

### Requirement: Validación de unicidad de email contra el store de usuarios (RN-USR-005)
El flujo de alta SHALL validar que el `email` no exista ya en el store de usuarios (`authFixtures`/store mutable), considerando TODOS los usuarios sin importar su valor de `activo`. Esta validación SHALL ocurrir en el handler MSW de creación (no solo client-side), retornando un error `409` con mensaje descriptivo si el email ya existe.

#### Scenario: Email duplicado con usuario activo es rechazado
- **WHEN** se envía una solicitud de alta con un `email` que ya pertenece a un usuario con `activo: true`
- **THEN** el handler responde `409` con un mensaje indicando que el email ya está en uso

#### Scenario: Email duplicado con usuario inactivo también es rechazado
- **WHEN** se envía una solicitud de alta con un `email` que ya pertenece a un usuario con `activo: false`
- **THEN** el handler responde `409` con el mismo mensaje descriptivo

### Requirement: Schema Zod de edición de usuario (RN-USR-006)
`src/features/users/schemas/updateUser.schema.ts` SHALL exportar `updateUserSchema` (Zod) validando `email`, `rol`, `area` y `areasAsignadas` con las mismas reglas condicionales que `createUserSchema` para `rol === 'SUPERVISOR'`, SIN campo de contraseña (el reset de contraseña es una acción independiente, RN-USR-004).

#### Scenario: Edición no expone campo de contraseña
- **WHEN** se inspecciona la forma (`shape`) de `updateUserSchema`
- **THEN** no existe ninguna clave relacionada a contraseña

#### Scenario: Edición de SUPERVISOR sin areasAsignadas falla validación
- **WHEN** se valida `updateUserSchema` con `rol: 'SUPERVISOR'` y `areasAsignadas` vacío
- **THEN** la validación falla con un error localizado en el campo `areasAsignadas`

### Requirement: Validación de archivo de avatar (RN-USR-007)
El schema de alta/edición (o un schema de campo dedicado consumido por el componente de carga de avatar) SHALL validar que el archivo cargado tenga tipo MIME `image/jpeg` o `image/png` y tamaño máximo de 2MB (2 * 1024 * 1024 bytes). Un archivo que no cumpla estas reglas SHALL producir un error de validación localizado sin bloquear el resto del formulario (los demás campos conservan sus valores y pueden seguir editándose).

#### Scenario: Archivo de formato no permitido es rechazado
- **WHEN** el usuario selecciona un archivo `documento.pdf` en el input de avatar
- **THEN** se muestra un error de validación localizado indicando formato no permitido, y el resto del formulario permanece editable e intacto

#### Scenario: Archivo que excede 2MB es rechazado
- **WHEN** el usuario selecciona una imagen `.png` de 3MB
- **THEN** se muestra un error de validación localizado indicando tamaño máximo excedido, y el resto del formulario permanece editable e intacto

#### Scenario: Archivo válido pasa la validación
- **WHEN** el usuario selecciona una imagen `.jpg` de 500KB
- **THEN** no se muestra error de validación de avatar y el archivo queda disponible para conversión a base64
