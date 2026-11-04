# user-profile-pin-firma Specification

## Purpose
Sección "PIN de firma" en `/perfil` para que cada usuario configure o cambie su PIN de firma electrónica (usado al firmar documentos y cierres de QE) contra `POST /api/auth/set-pin`.

## Requirements

### Requirement: Sección "PIN de firma" en /perfil
`ProfilePage` SHALL render a section "PIN de firma" below the existing "Cambiar contraseña" section, visible to every authenticated user regardless of role (any role can be required to sign a document or a QE closure). It SHALL display the current status — "Configurado" when `user.tienePinFirma` is `true`, "No configurado" otherwise — and a form with three fields: current password, new PIN (4 digits, `inputMode="numeric"`, masked), and confirm PIN, managed via React Hook Form + a Zod schema enforcing exactly 4 numeric digits and that both PIN fields match.

#### Scenario: Usuario sin PIN configurado ve el estado correspondiente
- **WHEN** un usuario con `tienePinFirma: false` abre `/perfil`
- **THEN** la sección "PIN de firma" muestra el estado "No configurado"

#### Scenario: Usuario con PIN configurado ve el estado correspondiente
- **WHEN** un usuario con `tienePinFirma: true` abre `/perfil`
- **THEN** la sección "PIN de firma" muestra el estado "Configurado"

#### Scenario: Los PIN ingresados no coinciden
- **WHEN** el usuario ingresa un PIN nuevo y una confirmación que no coinciden
- **THEN** el formulario muestra un error de validación en el campo de confirmación y no envía la solicitud

#### Scenario: El PIN no tiene exactamente 4 dígitos
- **WHEN** el usuario ingresa un PIN (nuevo o confirmación) que no son exactamente 4 dígitos numéricos
- **THEN** el formulario muestra el error de validación Zod correspondiente y no envía la solicitud

### Requirement: Configurar o cambiar el PIN contra el backend real
El formulario de la sección "PIN de firma" SHALL llamar a `POST /api/auth/set-pin` con `{ password, pin }` al enviarse, usando el mismo endpoint tanto para la primera configuración como para un cambio posterior (el backend no distingue ambos casos). Si la respuesta es exitosa, el sistema SHALL mostrar un toast de éxito, limpiar el formulario, y actualizar `tienePinFirma: true` en `authStore` sin requerir un refresh de sesión completo. Si la respuesta es 401 (contraseña incorrecta), el sistema SHALL mostrar el error en el campo de contraseña actual, sin limpiar el formulario.

#### Scenario: Configuración o cambio exitoso
- **WHEN** el usuario envía el formulario con su contraseña actual correcta y un PIN válido y confirmado
- **THEN** el sistema llama `POST /api/auth/set-pin`, muestra un toast de éxito, limpia el formulario, y `authStore.user.tienePinFirma` pasa a `true`

#### Scenario: Contraseña actual incorrecta
- **WHEN** el usuario envía el formulario con una contraseña actual que no coincide con la real
- **THEN** el sistema muestra el error en el campo de contraseña actual, sin limpiar el formulario ni modificar `tienePinFirma`

### Requirement: Ancla directa a la sección "PIN de firma"
La sección "PIN de firma" de `/perfil` SHALL tener `id="pin-firma"`. Cuando la página se monta con `location.hash === '#pin-firma'`, SHALL hacer `scrollIntoView({ behavior: 'smooth', block: 'start' })` sobre la sección y poner el foco en el campo de contraseña `#pinPassword`.

#### Scenario: Llegar desde la pista de un modal de firma
- **WHEN** el usuario navega a `/perfil#pin-firma`
- **THEN** la sección "PIN de firma" queda visible y el foco está en el campo de contraseña actual

#### Scenario: Entrar a /perfil sin hash
- **WHEN** el usuario navega a `/perfil` sin hash
- **THEN** la página no hace scroll automático ni mueve el foco

### Requirement: Texto de ayuda para PIN olvidado
Cuando `user.tienePinFirma === true`, la sección "PIN de firma" SHALL mostrar bajo el título el texto `users:profile.pinSection.forgotHint` (`text-sm text-muted`). Ese texto aclara que no hace falta el PIN anterior, solo confirmar la contraseña y definir uno nuevo. Si el usuario no tiene PIN configurado, SHALL NOT mostrarse.

#### Scenario: Usuario con PIN
- **WHEN** un usuario con PIN configurado abre Mi Perfil
- **THEN** ve el texto de ayuda "¿Olvidaste tu PIN? No necesitas el anterior…"

#### Scenario: Usuario sin PIN
- **WHEN** un usuario sin PIN configurado abre Mi Perfil
- **THEN** no ve el texto de ayuda

#### Scenario: Contraseña incorrecta al cambiar el PIN
- **WHEN** el usuario envía el formulario con una contraseña incorrecta y el servidor responde 401 `CONTRASENA_INCORRECTA`
- **THEN** el error se muestra en el campo de contraseña y no se dispara ningún refresh de sesión
