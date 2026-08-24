## ADDED Requirements

### Requirement: Configuración y cambio de PIN de firma (autogestión)
El sistema SHALL exponer `POST /api/auth/set-pin`, requiriendo `password` (contraseña actual del usuario autenticado, como confirmación de identidad) y `pin` (exactamente 4 dígitos numéricos). Si `password` es correcta, el sistema SHALL guardar el hash de `pin` en `ShacUser.PinHash` usando `IPasswordHasher<ShacUser>`, reemplazando cualquier PIN previamente configurado. El mismo endpoint sirve tanto para la primera configuración (`PinHash` era `null`) como para un cambio posterior.

#### Scenario: Primera configuración de PIN
- **WHEN** un usuario autenticado sin `PinHash` configurado envía `POST /api/auth/set-pin` con su contraseña actual correcta y `pin: '1234'`
- **THEN** el sistema responde 200 y el usuario queda con un PIN de firma configurado

#### Scenario: Cambio de un PIN ya configurado
- **WHEN** un usuario con `PinHash` ya definido envía `POST /api/auth/set-pin` con su contraseña actual correcta y un `pin` nuevo
- **THEN** el sistema responde 200 y el PIN anterior deja de ser válido para firmar

#### Scenario: Contraseña actual incorrecta
- **WHEN** se envía `POST /api/auth/set-pin` con una `password` que no coincide con la contraseña actual del usuario
- **THEN** el sistema responde 401 sin modificar `PinHash`

#### Scenario: Formato de PIN inválido
- **WHEN** se envía `POST /api/auth/set-pin` con un `pin` que no son exactamente 4 dígitos numéricos
- **THEN** el sistema responde 400 sin modificar `PinHash`

### Requirement: Reset de PIN de firma por administrador
El sistema SHALL exponer `PATCH /api/empresas/{empresaId}/usuarios/{usuarioId}/reset-pin`, restringido al rol `SUPERADMIN` (mismo gate que `ActualizarAsignacionEndpoint`/`AsignarUsuarioEmpresaEndpoint`), permitido únicamente si existe una asignación `UsuarioEmpresa` para `(usuarioId, empresaId)`. El sistema SHALL limpiar `PinHash` (`null`) del usuario indicado, sin definir un valor de PIN nuevo — el usuario configura uno propio la próxima vez que lo necesite, vía `POST /api/auth/set-pin`.

#### Scenario: Reset exitoso
- **WHEN** un `SUPERADMIN` envía `PATCH /api/empresas/{empresaId}/usuarios/{usuarioId}/reset-pin` sobre un usuario con asignación activa en esa empresa y con un PIN previamente configurado
- **THEN** el sistema responde 200, `PinHash` del usuario queda en `null`, y un intento posterior de firmar un cierre de QE con el PIN anterior es rechazado por falta de PIN configurado

#### Scenario: Usuario sin rol autorizado
- **WHEN** un usuario con rol distinto de `SUPERADMIN` intenta `PATCH /api/empresas/{empresaId}/usuarios/{usuarioId}/reset-pin`
- **THEN** el sistema responde 403 sin modificar `PinHash`

#### Scenario: Usuario objetivo sin asignación en la empresa indicada
- **WHEN** `usuarioId` no tiene ninguna fila `UsuarioEmpresa` para `empresaId`
- **THEN** el sistema responde 404
