## ADDED Requirements

### Requirement: Sesión mock expone tienePinFirma
El `User` resuelto por `login`, `refresh` y `switch-empresa` en MSW SHALL incluir `tienePinFirma: boolean`, calculado a partir del campo `pin` (en texto plano, mismo patrón que `password`) del `MockUser` correspondiente en `authFixtures`: `true` si `pin` está definido, `false` en caso contrario.

#### Scenario: Usuario sin PIN configurado
- **WHEN** MSW resuelve la sesión de un usuario cuyo `MockUser.pin` es `undefined`
- **THEN** el `user` de la respuesta tiene `tienePinFirma: false`

#### Scenario: Usuario con PIN configurado
- **WHEN** MSW resuelve la sesión de un usuario cuyo `MockUser.pin` es un string de 4 dígitos
- **THEN** el `user` de la respuesta tiene `tienePinFirma: true`

### Requirement: MSW handler POST /api/auth/set-pin
El sistema SHALL registrar `http.post('/api/auth/set-pin', ...)` en `auth.handlers.ts`, siguiendo el mismo patrón que `POST /api/auth/change-password`: resolver el usuario autenticado desde el header de acceso (`readAccessUserId`), validar `password` contra `user.password`, y validar que `pin` cumpla exactamente `^\d{4}$`. Si ambas validaciones pasan, SHALL asignar `user.pin = body.pin` en el store mutable de `authFixtures` (`getUsersStore()`), reemplazando cualquier PIN previo.

#### Scenario: Configuración exitosa
- **WHEN** un usuario autenticado envía `POST /api/auth/set-pin` con su contraseña correcta y `pin: '4821'`
- **THEN** la respuesta es 200 y una llamada posterior a un endpoint de firma con `pin: '4821'` para ese usuario es aceptada

#### Scenario: Contraseña incorrecta
- **WHEN** se envía `POST /api/auth/set-pin` con una `password` que no coincide con `user.password`
- **THEN** la respuesta es 401 y `user.pin` no se modifica

#### Scenario: Formato de PIN inválido
- **WHEN** se envía `POST /api/auth/set-pin` con un `pin` que no son exactamente 4 dígitos numéricos
- **THEN** la respuesta es 400 y `user.pin` no se modifica

#### Scenario: Sesión expirada
- **WHEN** se envía `POST /api/auth/set-pin` sin un header de acceso resoluble a un usuario de `authFixtures`
- **THEN** la respuesta es 401
