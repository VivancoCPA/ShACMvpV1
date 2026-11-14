## MODIFIED Requirements

### Requirement: Generación real de notificaciones de Quality Event por rol (RN-QE-005)
El sistema SHALL crear una notificación `Tipo: SEVERIDAD_CRITICA` al crear un QE con severidad `CRITICA` o al editar su severidad a `CRITICA` (destinatarios: rol `ALTA_DIRECCION` en la empresa del QE), una notificación `Tipo: CIERRE` al completarse la firma dual de cierre (destinatarios definidos en `be-quality-events-api` "Avisos del flujo de cierre": reportante, responsable, `JEFE_CALIDAD_SYST` y, con severidad `ALTA`/`CRITICA`, `ALTA_DIRECCION`), y una notificación `Tipo: VERIFICACION_EFICAZ` al verificar eficacia con resultado `EFECTIVO` si la severidad es `ALTA` o `CRITICA` (destinatarios: rol `JEFE_CALIDAD_SYST`) — en todos los casos excluyendo al actor, de forma best-effort. La resolución de destinatarios por rol (`RolNotificationHelper`) SHALL considerar solo asignaciones `UsuarioEmpresa` con `Estado == ACTIVO`.

#### Scenario: QE con severidad crítica notifica a Alta Dirección
- **WHEN** se crea (o se edita a) un QE con `severidad: CRITICA` en una empresa con al menos un usuario `ALTA_DIRECCION` distinto del actor
- **THEN** ese usuario recibe una notificación referenciando el QE

#### Scenario: Cierre de QE de severidad baja/media no notifica a Alta Dirección
- **WHEN** se completa la firma dual de cierre de un QE con `severidad: BAJA` o `MEDIA`
- **THEN** ningún usuario `ALTA_DIRECCION` recibe la notificación de cierre (sí la reciben el reportante, el responsable y los JCA)

#### Scenario: Asignación inactiva no recibe avisos por rol
- **WHEN** un usuario tiene asignación `JEFE_CALIDAD_SYST` con `Estado: INACTIVO` en la empresa
- **THEN** no recibe las notificaciones dirigidas a ese rol
