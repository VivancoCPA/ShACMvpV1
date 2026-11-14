# qe-solicitudes-ac Specification

## Purpose
TBD - created by archiving change solicitudes-ac-y-ac-del-qe-en-origen. Update Purpose after archive.

## Requirements
### Requirement: Solicitar AC en el QE restringido por rol y estado
`PATCH /api/quality-events/{id}/solicitar-ac` SHALL aceptar únicamente usuarios cuyo rol efectivo sea `OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST` o `ALTA_DIRECCION`; cualquier otro rol SHALL recibir 403 con `errorCode: 'SOLICITUD_AC_ROL_NO_PERMITIDO'`. Un QE de otra empresa SHALL responder 404. Si el QE está en `CERRADO`, `EN_VERIFICACION` o `VERIFICADO`, SHALL responder 422 con `errorCode: 'SOLICITUD_AC_ESTADO_INVALIDO'`. En otro caso incrementa `solicitudesAC` en 1 y registra el audit `AC_SOLICITADA` con el autor.

#### Scenario: Solicitud válida incrementa el contador
- **WHEN** un SUPERVISOR solicita AC sobre un QE en `EN_INVESTIGACION` con `solicitudesAC = 0`
- **THEN** responde 200 y el QE queda con `solicitudesAC = 1` y un audit `AC_SOLICITADA`

#### Scenario: Rol no permitido
- **WHEN** un `JEFE_CONTROL_DOCUMENTARIO` solicita AC
- **THEN** responde 403 con `errorCode: 'SOLICITUD_AC_ROL_NO_PERMITIDO'`

#### Scenario: QE cerrado
- **WHEN** se solicita AC sobre un QE en `CERRADO`
- **THEN** responde 422 con `errorCode: 'SOLICITUD_AC_ESTADO_INVALIDO'` y el contador no cambia

### Requirement: Crear una AC en el QE atiende una solicitud pendiente
Al crear una AC con `POST /api/quality-events/{id}/acciones-correctivas` (incluida la creada desde el asistente de IA), si `solicitudesAC > 0` el sistema SHALL descontar 1 en la misma transacción y registrar el audit `SOLICITUD_AC_ATENDIDA` con `campoModificado: 'solicitudesAC'`, `valorAnterior` = contador previo y `valorNuevo` = contador nuevo seguido del título de la AC. Si `solicitudesAC === 0`, el contador SHALL quedar en 0 y no se registra `SOLICITUD_AC_ATENDIDA`.

#### Scenario: Crear AC descuenta la solicitud
- **WHEN** un QE con `solicitudesAC = 1` recibe una AC nueva
- **THEN** el QE queda con `solicitudesAC = 0` y un audit `SOLICITUD_AC_ATENDIDA` con `valorAnterior: '1'`

#### Scenario: Sin solicitudes no queda negativo
- **WHEN** un QE con `solicitudesAC = 0` recibe una AC nueva
- **THEN** `solicitudesAC` sigue en 0 y no hay audit `SOLICITUD_AC_ATENDIDA`

#### Scenario: RN-QE-009 se libera al atender
- **WHEN** un QE en `EN_INVESTIGACION` con `solicitudesAC = 1` intenta pasar a `ANALISIS_COMPLETADO`, luego recibe una AC y vuelve a intentarlo
- **THEN** el primer intento responde 422 `RN-QE-009` y el segundo responde 200

### Requirement: El JCA puede descartar una solicitud con motivo
`POST /api/quality-events/{id}/solicitudes-ac/descartar` con body `{ motivo }` SHALL:
- responder 400 si `motivo` recortado no tiene entre 20 y 500 caracteres;
- responder 404 si el QE no es de la empresa activa;
- responder 403 con `errorCode: 'SOLO_JCA_DESCARTA_SOLICITUD'` si el rol efectivo no es `JEFE_CALIDAD_SYST`;
- responder 422 con `errorCode: 'SIN_SOLICITUDES_PENDIENTES'` si `solicitudesAC === 0`;
- en otro caso, descontar 1, registrar el audit `SOLICITUD_AC_DESCARTADA` (`valorAnterior`, `valorNuevo` con el motivo) y devolver el QE.

El descarte SHALL avisar best-effort (notificación `CAMBIO_ESTADO`) al autor de la solicitud descartada —la más antigua de las últimas `solicitudesAC` entradas `AC_SOLICITADA` del QE (FIFO)— salvo que sea el propio actor. Un fallo del aviso no SHALL bloquear la respuesta.

#### Scenario: JCA descarta con motivo válido
- **WHEN** el JCA descarta con un motivo de 30 caracteres un QE con `solicitudesAC = 1`
- **THEN** responde 200, el QE queda con `solicitudesAC = 0` y hay un audit `SOLICITUD_AC_DESCARTADA`

#### Scenario: Supervisor no puede descartar
- **WHEN** un SUPERVISOR llama al endpoint
- **THEN** responde 403 con `errorCode: 'SOLO_JCA_DESCARTA_SOLICITUD'`

#### Scenario: Motivo corto
- **WHEN** el JCA envía un motivo de 10 caracteres
- **THEN** responde 400 y el contador no cambia

#### Scenario: Sin solicitudes pendientes
- **WHEN** el JCA descarta sobre un QE con `solicitudesAC = 0`
- **THEN** responde 422 con `errorCode: 'SIN_SOLICITUDES_PENDIENTES'`

#### Scenario: Se avisa al solicitante
- **WHEN** un SUPERVISOR solicitó la AC y el JCA la descarta
- **THEN** el SUPERVISOR recibe una notificación con el motivo del descarte

#### Scenario: RN-QE-009 se libera al descartar
- **WHEN** un QE en `EN_INVESTIGACION` con `solicitudesAC = 1` se descarta y luego pasa a `ANALISIS_COMPLETADO`
- **THEN** la transición responde 200

### Requirement: Aviso de solicitudes en el QE con acciones para el JCA
Mientras `qe.solicitudesAC > 0`, el aviso de `QEACSection` visible para `JEFE_CALIDAD_SYST` SHALL indicar que la solicitud se atiende creando la AC con «Nueva AC» o descartándola, y SHALL ofrecer únicamente:
- "Descartar solicitud", que abre un modal con el campo "Motivo del descarte" (20 a 500 caracteres, React Hook Form + Zod) y llama a `useDescartarSolicitudAC`, cuando la sección no es `readOnly`.

El aviso MUST NOT ofrecer un botón propio "Crear AC"; la AC se crea con "Nueva AC" del encabezado de la sección, que abre el mismo formulario de alta y descuenta la solicitud en el servidor.

Crear una AC o descartar una solicitud SHALL invalidar las queries de QE (`['quality-events']`: detalle, lista y AC) y `['dashboard']`, de modo que el aviso, el badge de la lista y RN-QE-009 se actualizan sin recargar. El error `SIN_SOLICITUDES_PENDIENTES` SHALL mostrarse con `t('qualityEvents:errors.SIN_SOLICITUDES_PENDIENTES')`. El audit trail SHALL rotular `SOLICITUD_AC_ATENDIDA` y `SOLICITUD_AC_DESCARTADA`.

#### Scenario: JCA ve solo Descartar en el aviso
- **WHEN** el JCA abre un QE en `EN_INVESTIGACION` con `solicitudesAC = 1`
- **THEN** el aviso muestra "Descartar solicitud" y no "Crear AC", y el encabezado muestra "Nueva AC"

#### Scenario: Crear desde Nueva AC oculta el aviso
- **WHEN** el JCA crea una AC con "Nueva AC" y el QE refrescado devuelve `solicitudesAC = 0`
- **THEN** el aviso desaparece sin recargar

#### Scenario: Descartar oculta el aviso sin recargar
- **WHEN** el JCA descarta con un motivo válido y la API responde 200 con `solicitudesAC = 0`
- **THEN** el aviso desaparece tras la invalidación

#### Scenario: Modal valida el motivo
- **WHEN** el JCA confirma el descarte con un motivo de 5 caracteres
- **THEN** se muestra un error de validación y no se llama al endpoint

### Requirement: MSW espeja el ciclo de solicitudes
`quality-events.handlers.ts` SHALL:
- en `PATCH /:id/solicitar-ac`, aplicar los mismos 403/422 por rol y estado y registrar `AC_SOLICITADA` con el autor;
- en `POST /:id/acciones-correctivas`, descontar `solicitudesAC` y registrar `SOLICITUD_AC_ATENDIDA` cuando el contador es mayor a 0;
- registrar `POST /:id/solicitudes-ac/descartar` con las mismas validaciones (400, 403, 422) y el aviso al solicitante.

Los fixtures SHALL incluir un incidente vinculado a un QE con 2 AC y `solicitudesAC = 1`.

#### Scenario: MSW descarta
- **WHEN** el JCA llama al handler de descartar con un motivo válido sobre un QE con `solicitudesAC = 1`
- **THEN** responde 200 y un `GET` posterior del QE devuelve `solicitudesAC = 0`

#### Scenario: MSW crear AC descuenta
- **WHEN** se crea una AC sobre un QE con `solicitudesAC = 1`
- **THEN** un `GET` posterior del QE devuelve `solicitudesAC = 0`
