## ADDED Requirements

### Requirement: Pista "¿Olvidaste tu PIN?" en DocumentSignatureModal
Mientras el campo PIN esté visible (`!noPinConfigured`), `DocumentSignatureModal` SHALL mostrar siempre, debajo del campo y de su mensaje de error si lo hay, un enlace con el texto `documents:signature.forgotPinLink` hacia `/perfil#pin-firma`. El enlace `signature.configurePinLink` del estado sin PIN SHALL apuntar también a `/perfil#pin-firma`. El focus trap del modal SHALL incluir los enlaces (`a[href]`) en el ciclo de Tab, y al abrir el modal el primer elemento enfocado SHALL seguir siendo el input del PIN.

#### Scenario: Pista visible con PIN configurado
- **WHEN** un aprobador con `tienePinFirma === true` abre el modal de firma
- **THEN** se ve el enlace "¿Olvidaste tu PIN?" con `href="/perfil#pin-firma"` y el foco inicial está en el input del PIN

#### Scenario: Pista visible tras PIN incorrecto
- **WHEN** el usuario envía un PIN incorrecto y el servidor responde 401 `PIN_INCORRECTO`
- **THEN** se ve "PIN incorrecto." bajo el campo y el enlace "¿Olvidaste tu PIN?" sigue visible

#### Scenario: Sin PIN configurado
- **WHEN** el usuario no tiene PIN configurado
- **THEN** no se ve la pista "¿Olvidaste tu PIN?", y se ve el aviso de configurar PIN con un enlace a `/perfil#pin-firma`

#### Scenario: El enlace entra en el ciclo de Tab
- **WHEN** el usuario recorre el modal con Tab
- **THEN** el enlace "¿Olvidaste tu PIN?" recibe el foco en su turno, y el ciclo sigue cerrado (del último elemento vuelve al primero)
