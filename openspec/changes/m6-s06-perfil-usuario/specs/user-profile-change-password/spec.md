## ADDED Requirements

### Requirement: Formulario de cambio de contraseña propia
La página `/perfil` SHALL incluir un formulario de cambio de contraseña con los campos contraseña actual, nueva contraseña y confirmar nueva contraseña, validado con React Hook Form + Zod, reutilizando las mismas reglas de fortaleza de contraseña que `resetPassword.schema.ts` (`PASSWORD_RULES`: mínimo 8 caracteres, mayúscula, minúscula, dígito y carácter especial).

#### Scenario: Nueva contraseña no cumple las reglas de fortaleza
- **WHEN** el usuario ingresa una nueva contraseña que no cumple alguna regla de `PASSWORD_RULES`
- **THEN** el formulario muestra el error de validación Zod localizado correspondiente y no envía la solicitud

#### Scenario: Confirmación no coincide con la nueva contraseña
- **WHEN** el campo de confirmar contraseña no coincide con el campo de nueva contraseña
- **THEN** el formulario muestra un error de validación en el campo de confirmación y no envía la solicitud

### Requirement: Validación de contraseña actual antes de aplicar el cambio
El sistema SHALL validar la contraseña actual del usuario contra el valor almacenado antes de aplicar cualquier cambio. Si la contraseña actual es incorrecta, el sistema SHALL rechazar la solicitud con un mensaje de error descriptivo y SHALL NOT modificar la contraseña almacenada.

#### Scenario: Contraseña actual incorrecta
- **WHEN** el usuario envía el formulario con una contraseña actual que no coincide con la almacenada
- **THEN** el sistema muestra un toast de error descriptivo (vía Sonner) y la contraseña almacenada permanece sin cambios

### Requirement: Cambio de contraseña exitoso
Cuando la contraseña actual es correcta y la nueva contraseña cumple las reglas de validación, el sistema SHALL actualizar la contraseña del usuario en el mock de sesión (`authFixtures`, en memoria) y SHALL confirmar el éxito mediante un toast de Sonner.

#### Scenario: Cambio de contraseña válido
- **WHEN** el usuario envía el formulario con la contraseña actual correcta y una nueva contraseña válida y confirmada
- **THEN** el sistema actualiza la contraseña del usuario en el mock, muestra un toast de éxito, y el usuario permanece en `/perfil`

#### Scenario: Login posterior con la nueva contraseña en la misma sesión de navegador
- **WHEN** el usuario cierra sesión y vuelve a iniciar sesión con la nueva contraseña dentro de la misma sesión de navegador (sin recargar el estado del mock)
- **THEN** el login es exitoso con la nueva contraseña

### Requirement: Limitación de persistencia del cambio de contraseña
El sistema SHALL documentar y aceptar como limitación conocida que el cambio de contraseña, al no existir backend real, no persiste más allá de la sesión actual del navegador (se pierde al recargar el estado del mock), de forma consistente con el resto de auth/sesión mock del proyecto.

#### Scenario: Recarga completa del mock reinicia la contraseña
- **WHEN** el entorno mock se reinicia (p.ej. recarga completa de la aplicación que reinicializa los fixtures)
- **THEN** la contraseña del usuario vuelve a su valor original de `auth.fixtures.ts`, y este comportamiento no se considera un defecto
