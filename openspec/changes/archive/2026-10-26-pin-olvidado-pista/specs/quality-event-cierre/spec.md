## ADDED Requirements

### Requirement: Pista "¿Olvidaste tu PIN?" en el PinModal de cierre
Mientras el input del PIN esté visible, el `PinModal` de `QECierreSection` SHALL mostrar debajo del input un enlace con el texto `qualityEvents:detail.cierre.pinModal.forgotPinLink` hacia `/perfil#pin-firma`. El enlace `configurePinLink` del estado sin PIN SHALL apuntar a `/perfil#pin-firma`. El PIN incorrecto SHALL seguir notificándose como toast desde `useFirmarCierre`.

#### Scenario: Pista visible en el modal de firma de cierre
- **WHEN** un firmante con PIN configurado abre el modal de firma del cierre de un QE
- **THEN** se ve el enlace "¿Olvidaste tu PIN?" con `href="/perfil#pin-firma"`

#### Scenario: Enlace de configurar PIN con ancla
- **WHEN** el firmante no tiene PIN configurado
- **THEN** no se ve la pista, y el enlace de configurar PIN apunta a `/perfil#pin-firma`
