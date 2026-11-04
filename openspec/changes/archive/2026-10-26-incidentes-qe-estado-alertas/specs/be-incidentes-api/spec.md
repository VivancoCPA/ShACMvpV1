## MODIFIED Requirements

### Requirement: Actualización de campos de investigación
El sistema SHALL exponer `PATCH /api/incidents/:id` para actualizar campos de investigación (parcial), registrando una entrada `CAMPO_EDITADO` en el audit trail. Los campos aceptados incluyen `condicionesEntorno`, `localId`, `zonaId`, `ubicacion`, `testigos`, `personalInvolucrado`, `equiposInvolucrados`, `atencionMedicaRequerida`, `atencionMedicaDescripcion`, `notificacionAmbientalRequerida`, y `evidencias` (URLs ya subidas vía `POST /api/incidents/evidencias`). El formulario de escritorio (`IncidentForm.tsx`) permite adjuntar evidencia nueva tanto al crear como al editar el incidente, así que este endpoint también la acepta. El endpoint SHALL NOT modificar `qeId`: la vinculación con el Quality Event la gestiona exclusivamente la creación, eliminación y reactivación del QE. Si el request trae un `qeId` distinto del actual, el sistema SHALL responder 422 con `errorCode: QE_VINCULO_GESTIONADO_POR_QE`, sin modificar el incidente. Si el `qeId` es igual al actual, se ignora.

#### Scenario: Actualización parcial exitosa
- **WHEN** un usuario envía un subconjunto de campos de investigación a `PATCH /api/incidents/:id` de un incidente de su empresa
- **THEN** el sistema responde 200 con el incidente actualizado y una nueva entrada de audit trail

#### Scenario: Actualización de campos de atención médica y testigos
- **WHEN** un usuario envía `{ testigos: [...], personalInvolucrado: [...], equiposInvolucrados: [...], atencionMedicaRequerida: true, atencionMedicaDescripcion: '...', notificacionAmbientalRequerida: false }` a `PATCH /api/incidents/:id`
- **THEN** el sistema responde 200, persiste los seis campos y agrega una entrada `CAMPO_EDITADO` al audit trail

#### Scenario: Agregar una evidencia nueva durante la edición no duplica las ya existentes
- **WHEN** un usuario envía `{ evidencias: [...evidencias existentes del incidente, nuevaEvidencia] }` a `PATCH /api/incidents/:id` (el frontend siempre envía la lista completa, existentes + nuevas)
- **THEN** el sistema agrega únicamente la evidencia cuya `url` todavía no está persistida en el incidente, sin duplicar las ya existentes

#### Scenario: Intento de vincular un QE por este endpoint
- **WHEN** se envía `PATCH /api/incidents/:id { qeId: '<otro-id>' }` y el incidente tiene `qeId` distinto (o nulo)
- **THEN** el sistema responde 422 con `errorCode: QE_VINCULO_GESTIONADO_POR_QE` y no modifica el incidente

### Requirement: Transición de estado validada server-side
El sistema SHALL exponer `PATCH /api/incidents/:id/status` únicamente para anular un incidente: solo SHALL aceptar `ABIERTO → ANULADO`, y solo si el incidente no tiene `qeId`. Cualquier otra transición, o una anulación de un incidente con QE vinculado, SHALL responder 422 con `errorCode: ESTADO_GOBERNADO_POR_QE` y el mensaje "El estado del incidente lo determina su Quality Event.", sin modificar el incidente. El resto del ciclo de vida (`EN_INVESTIGACION` … `CERRADO`) lo gobierna exclusivamente el Quality Event vinculado (ver `incident-qe-sync`). Una anulación válida registra `ESTADO_CAMBIADO` con `estadoAnterior`/`estadoNuevo`.

#### Scenario: Anulación sin QE
- **WHEN** un incidente en `ABIERTO` sin `qeId` recibe `PATCH /:id/status` con `{ estado: 'ANULADO' }`
- **THEN** el sistema responde 200, actualiza `estado` y agrega una entrada `ESTADO_CAMBIADO` con `estadoAnterior`/`estadoNuevo`

#### Scenario: Avance manual rechazado
- **WHEN** un incidente en `ABIERTO` recibe `PATCH /:id/status` con `{ estado: 'EN_INVESTIGACION' }`
- **THEN** el sistema responde 422 con `errorCode: ESTADO_GOBERNADO_POR_QE` sin modificar el incidente

#### Scenario: Anulación con QE vinculado rechazada
- **WHEN** un incidente con `qeId` recibe `PATCH /:id/status` con `{ estado: 'ANULADO' }`
- **THEN** el sistema responde 422 con `errorCode: ESTADO_GOBERNADO_POR_QE`

## ADDED Requirements

### Requirement: Notificación best-effort al crear un incidente
Tras confirmar la transacción de `POST /api/incidents`, el sistema SHALL notificar la creación a los usuarios con rol `JEFE_CALIDAD_SYST` o `SUPERVISOR` en estado `ACTIVO` de la empresa del incidente. Si la severidad es `ALTA` o `CRITICA`, también SHALL notificar a los `ALTA_DIRECCION` activos. Reglas de la notificación:
- se excluye al actor y no se repiten destinatarios;
- el tipo es `SEVERIDAD_CRITICA` si la severidad es `CRITICA`, y `CAMBIO_ESTADO` en los demás casos;
- `EntidadTipo = INCIDENTE`;
- el mensaje es "Nuevo {tipo} {numero} reportado (severidad {severidad}).";
- `link` es `/incidents/{id}`.

Un fallo del envío SHALL registrarse en el log y SHALL NOT impedir la respuesta 201. Esto cubre también los incidentes que llegan por la sincronización offline, que usa el mismo endpoint.

#### Scenario: Incidente de severidad MEDIA
- **WHEN** un SUPERVISOR crea un incidente con severidad `MEDIA`
- **THEN** los JEFE_CALIDAD_SYST y los demás SUPERVISOR activos de la empresa reciben una notificación `CAMBIO_ESTADO`, ningún ALTA_DIRECCION la recibe y el actor no se notifica a sí mismo

#### Scenario: Incidente de severidad CRITICA
- **WHEN** se crea un incidente con severidad `CRITICA`
- **THEN** los JCA, SUP y ALTA_DIRECCION activos reciben una notificación de tipo `SEVERIDAD_CRITICA`

#### Scenario: Usuarios inactivos o de otra empresa
- **WHEN** existe un JEFE_CALIDAD_SYST inactivo en la empresa y otro activo en una empresa distinta
- **THEN** ninguno de los dos recibe la notificación

#### Scenario: Fallo de notificación no bloquea la creación
- **WHEN** la persistencia de la notificación lanza una excepción
- **THEN** `POST /api/incidents` igual responde 201 con el incidente creado
