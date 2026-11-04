## ADDED Requirements

### Requirement: Candidatos a responsable de investigación
El sistema SHALL exponer `GET /api/quality-events/candidatos-responsable`, autenticado y con empresa activa, que devuelve los usuarios con asignación `ACTIVO` en la empresa de la sesión, rol de empresa `SUPERVISOR` o `JEFE_CALIDAD_SYST` y `ShacUser.Activo = true`. Cada elemento SHALL tener la forma `{ id, nombreCompleto, rol, avatarUrl }`, ordenado por nombre y apellido.

#### Scenario: Solo SUPERVISOR y JCA activos de la empresa
- **WHEN** un usuario autenticado con empresa activa llama al endpoint
- **THEN** la respuesta incluye a los SUPERVISOR y JEFE_CALIDAD_SYST activos de esa empresa
- **AND** no incluye OPERARIO, AUDITOR_INTERNO ni otros roles, ni usuarios inactivos, ni asignaciones no `ACTIVO`, ni usuarios de otra empresa

#### Scenario: Sin empresa activa
- **WHEN** la sesión no tiene empresa activa
- **THEN** el endpoint responde con el error del filtro `RequireEmpresaActivaFilter`

### Requirement: Responsable de investigación opcional al crear un QE
`POST /api/quality-events` SHALL aceptar `responsableInvestigacionId` opcional. Si viene, el sistema SHALL validarlo con la misma regla de candidatos y, si no es válido, SHALL responder un error de validación del campo `responsableInvestigacionId` (`FieldValidationException`, 400), nunca un 404. Si es válido, SHALL guardarlo y SHALL registrar `RESPONSABLE_ASIGNADO` en el audit trail del QE dentro de la misma transacción, con `ValorNuevo` = nombre del responsable.

#### Scenario: Crear con responsable válido
- **WHEN** se crea un QE con `responsableInvestigacionId` de un SUPERVISOR activo de la empresa
- **THEN** responde 201, el QE queda con ese responsable y el audit trail contiene `CREADO` y `RESPONSABLE_ASIGNADO`

#### Scenario: Crear con responsable inválido
- **WHEN** `responsableInvestigacionId` corresponde a un OPERARIO o a un usuario de otra empresa
- **THEN** responde 400 con un error en el campo `responsableInvestigacionId` y no se crea el QE

#### Scenario: Crear sin responsable
- **WHEN** se crea un QE sin `responsableInvestigacionId`
- **THEN** responde 201 y el QE queda sin responsable

### Requirement: Asignación y cambio del responsable de investigación
El sistema SHALL exponer `PATCH /api/quality-events/{id}/responsable` con body `{ responsableInvestigacionId }`, restringido por rol global a `JEFE_CALIDAD_SYST` (otro rol → 403). Un QE inexistente o de otra empresa SHALL responder 404. En estado `CERRADO`, `EN_VERIFICACION` o `VERIFICADO` SHALL responder 422 con `errorCode = QE_CERRADO`. El candidato SHALL validarse con la regla de candidatos (error de campo si no es válido). Si el responsable no cambia, SHALL responder 200 sin audit trail ni notificación. Si cambia, SHALL registrar `RESPONSABLE_ASIGNADO` (no había responsable) o `RESPONSABLE_CAMBIADO` (ya había uno), con `CampoModificado = responsableInvestigacionId` y `ValorAnterior`/`ValorNuevo` con los nombres de las personas, no los ids. `ActualizarQualityEventCommand` SHALL NOT aceptar este campo.

#### Scenario: JCA asigna y luego cambia
- **WHEN** un JCA asigna un responsable a un QE sin responsable y luego lo cambia por otro
- **THEN** ambas llamadas responden 200, el audit trail registra `RESPONSABLE_ASIGNADO` y después `RESPONSABLE_CAMBIADO` con los nombres anterior y nuevo

#### Scenario: SUPERVISOR intenta asignar
- **WHEN** un SUPERVISOR llama al endpoint
- **THEN** responde 403

#### Scenario: QE de otra empresa
- **WHEN** el QE pertenece a otra empresa
- **THEN** responde 404

#### Scenario: QE cerrado
- **WHEN** el QE está en `CERRADO`, `EN_VERIFICACION` o `VERIFICADO`
- **THEN** responde 422 con `errorCode = QE_CERRADO`

#### Scenario: Mismo responsable
- **WHEN** se envía el mismo responsable que ya tiene el QE
- **THEN** responde 200 sin nueva entrada de audit trail ni notificación

### Requirement: ABIERTO → EN_INVESTIGACION exige responsable de investigación
`PATCH /api/quality-events/{id}/status` con `nuevoEstado = EN_INVESTIGACION` sobre un QE en estado `ABIERTO` sin `ResponsableInvestigacionId` SHALL responder 422 con `errorCode = QE_SIN_RESPONSABLE` y mensaje "Asigna un responsable de investigación antes de iniciar la investigación". Las reaperturas (EN_VERIFICACION → EN_INVESTIGACION por este endpoint o por `QEReaperturaHelper`) SHALL NOT aplicar esta validación.

#### Scenario: Reapertura sin responsable
- **WHEN** se transiciona EN_VERIFICACION → EN_INVESTIGACION un QE sin responsable
- **THEN** la transición no se bloquea por `QE_SIN_RESPONSABLE`

#### Scenario: Sin responsable
- **WHEN** se transiciona ABIERTO → EN_INVESTIGACION un QE sin responsable
- **THEN** responde 422 `QE_SIN_RESPONSABLE` y el estado no cambia

#### Scenario: Con responsable
- **WHEN** se transiciona ABIERTO → EN_INVESTIGACION un QE con responsable
- **THEN** responde 200 y el QE queda en EN_INVESTIGACION

### Requirement: Notificación al responsable asignado
Cuando se asigna o cambia el responsable (al crear o vía `PATCH /responsable`), el sistema SHALL crear, después del commit y en modo best-effort, una notificación para el nuevo responsable — salvo que sea el actor — con `Tipo = ASIGNACION`, `EntidadTipo = QE`, mensaje `Fuiste asignado como responsable de investigación del {numero}.` y `Link = /quality-events/{id}`. Un fallo SHALL registrarse con `LogWarning` y SHALL NOT alterar la respuesta.

#### Scenario: Asignado distinto del actor
- **WHEN** un JCA asigna a un SUPERVISOR
- **THEN** el SUPERVISOR recibe la notificación `ASIGNACION`

#### Scenario: El actor se asigna a sí mismo
- **WHEN** un JCA se elige a sí mismo como responsable
- **THEN** no se crea la notificación de asignación

### Requirement: Notificación de creación de QE
Al crear un QE, el sistema SHALL notificar, después del commit y en modo best-effort, a los `JEFE_CALIDAD_SYST` y `SUPERVISOR` de la empresa (resueltos con `RolNotificationHelper`), sin el actor y sin duplicados, con `Tipo = CAMBIO_ESTADO`, `EntidadTipo = QE`, mensaje `Nuevo Quality Event {numero} ({tipo}, severidad {severidad}).` — con el sufijo ` — origen {incidenteNumero}` cuando el origen es un incidente — y `Link = /quality-events/{id}`. La notificación de severidad crítica (RN-QE-005) SHALL seguir enviándose como hasta ahora. Un fallo SHALL NOT cambiar la respuesta 201.

#### Scenario: Aviso a JCA y SUP sin el actor
- **WHEN** un JCA crea un QE
- **THEN** los demás JCA y todos los SUPERVISOR de la empresa reciben el aviso, y el actor no

#### Scenario: Fallo del envío
- **WHEN** la notificación de creación lanza una excepción
- **THEN** la respuesta sigue siendo 201

### Requirement: Nombre del responsable en detalle y listado
`GET /api/quality-events/{id}` y `GET /api/quality-events` SHALL devolver `responsableInvestigacionId` y `responsableInvestigacionNombre` (`TRIM(nombre || ' ' || apellido)` vía `LEFT JOIN asp_net_users`). `ResponsableInvestigacionNombre` SHALL ser una propiedad `[NotMapped]` de la entidad, sin columna en la base de datos.

#### Scenario: Detalle con responsable
- **WHEN** se obtiene un QE con responsable
- **THEN** la respuesta incluye su `responsableInvestigacionNombre`

#### Scenario: Listado sin responsable
- **WHEN** se lista un QE sin responsable
- **THEN** `responsableInvestigacionNombre` es null
