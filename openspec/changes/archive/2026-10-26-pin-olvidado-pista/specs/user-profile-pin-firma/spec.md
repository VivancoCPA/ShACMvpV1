## ADDED Requirements

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
