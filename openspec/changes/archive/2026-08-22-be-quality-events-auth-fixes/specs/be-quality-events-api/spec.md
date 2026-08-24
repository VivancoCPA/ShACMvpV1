## MODIFIED Requirements

### Requirement: Firma dual de cierre
El sistema SHALL exponer `PATCH /api/quality-events/:id/firmar-cierre`, requiriendo dos firmas (`rol`, `pin`): la primera de `JEFE_CALIDAD_SYST`, la segunda del rol resuelto por `ResolverRolSegundaFirma`, que SHALL devolver siempre `'SUPERVISOR'` (RN-QE-004 reconciliada: la escalada a `ALTA_DIRECCION` por mismo firmante no se implementa, por ser estructuralmente inalcanzable bajo el modelo de un rol por usuario). El sistema SHALL rechazar una segunda firma del mismo usuario que ya firmó como Jefe de Calidad. Antes de aceptar cualquiera de las dos firmas, el sistema SHALL validar `pin` contra el `PinHash` del usuario firmante: si el usuario no tiene `PinHash` configurado, la firma se rechaza indicando que debe configurar su PIN primero (`POST /api/auth/set-pin`); si `PinHash` está configurado pero `pin` no coincide, la firma se rechaza como no autorizada.

#### Scenario: Primera firma
- **WHEN** un `JEFE_CALIDAD_SYST` firma `PATCH /:id/firmar-cierre` sobre un QE con cierre iniciado, con su PIN de firma correcto
- **THEN** el sistema responde 200, registra `cerradoPorId`, y el QE permanece sin `estado: 'CERRADO'` hasta la segunda firma

#### Scenario: Segunda firma completa el cierre
- **WHEN** un `SUPERVISOR` firma tras la primera firma de Jefe de Calidad, con su PIN de firma correcto
- **THEN** el sistema responde 200 con `estado: 'CERRADO'` y, si `severidad` es `ALTA` o `CRITICA`, invoca el notificador best-effort a Gerencia

#### Scenario: Doble firma del mismo usuario
- **WHEN** el mismo usuario que ya firmó como Jefe de Calidad intenta firmar la segunda firma
- **THEN** el sistema responde 422 sin completar el cierre

#### Scenario: PIN incorrecto
- **WHEN** un usuario con `PinHash` configurado envía `PATCH /:id/firmar-cierre` con un `pin` que no coincide con el PIN configurado
- **THEN** el sistema responde 401 sin registrar la firma

#### Scenario: Usuario sin PIN configurado
- **WHEN** un usuario sin `PinHash` configurado (nunca llamó `POST /api/auth/set-pin`) envía `PATCH /:id/firmar-cierre`
- **THEN** el sistema responde con un mensaje de negocio claro indicando que debe configurar su PIN de firma primero, sin registrar la firma ni devolver un error genérico 500
