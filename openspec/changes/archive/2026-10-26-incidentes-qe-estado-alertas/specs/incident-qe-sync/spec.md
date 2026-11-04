## ADDED Requirements

### Requirement: El estado del incidente sigue al estado de su Quality Event vinculado
El sistema SHALL recalcular `Incidente.Estado` cada vez que cambia `QualityEvent.Estado` de un QE con `IncidenteId` no nulo, en la misma transacción que el cambio del QE, según este mapeo: `ABIERTO→ABIERTO`, `EN_INVESTIGACION→EN_INVESTIGACION`, `ANALISIS_COMPLETADO→ANALISIS_COMPLETADO`, `EN_EJECUCION→EN_EJECUCION`, `PENDIENTE_CIERRE→PENDIENTE_CIERRE`, y `CERRADO`/`EN_VERIFICACION`/`VERIFICADO→CERRADO`. La reapertura del QE (→ `EN_INVESTIGACION`) SHALL llevar el incidente a `EN_INVESTIGACION`, aunque esté en `CERRADO`. La sincronización SHALL NOT validarse contra `IncidentStateMachine`. Solo SHALL afectar a un incidente de la misma empresa que el QE y no eliminado.

#### Scenario: Transición del QE arrastra al incidente
- **WHEN** un QE vinculado a un incidente en `ABIERTO` transiciona a `EN_INVESTIGACION`
- **THEN** el incidente queda en `EN_INVESTIGACION` en la misma respuesta transaccional

#### Scenario: Firma dual de cierre cierra el incidente
- **WHEN** la segunda firma lleva el QE vinculado a `CERRADO`
- **THEN** el incidente queda en `CERRADO`

#### Scenario: Verificación eficaz mantiene el incidente cerrado
- **WHEN** el QE pasa de `EN_VERIFICACION` a `VERIFICADO`
- **THEN** el incidente sigue en `CERRADO` y no se agrega ninguna entrada de audit trail al incidente

#### Scenario: Reapertura reabre el incidente
- **WHEN** el QE se reabre (verificación `NO_EFECTIVO` o vencimiento forzado) y vuelve a `EN_INVESTIGACION`
- **THEN** el incidente pasa de `CERRADO` a `EN_INVESTIGACION`

#### Scenario: QE sin incidente no hace nada
- **WHEN** cambia el estado de un QE con `IncidenteId` nulo
- **THEN** no se modifica ningún incidente

#### Scenario: Incidente de otra empresa no se toca
- **WHEN** el `IncidenteId` del QE apunta a un incidente con `EmpresaId` distinto del QE
- **THEN** el incidente no se modifica

### Requirement: Audit trail de la sincronización con actor Sistema
Cada cambio de estado del incidente producido por la sincronización SHALL agregar una entrada de audit trail del incidente con `Accion = "ESTADO_SINCRONIZADO_QE"`, `EstadoAnterior`, `EstadoNuevo`, `ValorNuevo` = número del QE, `RealizadoPorId = "system"`, `RealizadoPorNombre = "Sistema"` y `GeneradoPorIA = true`. Si el estado destino coincide con el actual, no se agrega ninguna entrada.

#### Scenario: Entrada registrada al sincronizar
- **WHEN** la sincronización cambia el incidente de `ABIERTO` a `EN_INVESTIGACION` por el QE `QE-2026-010`
- **THEN** el audit trail del incidente contiene `ESTADO_SINCRONIZADO_QE` con `estadoAnterior: ABIERTO`, `estadoNuevo: EN_INVESTIGACION`, `valorNuevo: QE-2026-010` y `realizadoPorNombre: Sistema`

### Requirement: Notificación best-effort tras la sincronización
Cuando la sincronización cambia el estado del incidente, el sistema SHALL enviar, después de persistir, la notificación `CAMBIO_ESTADO` del incidente al reportante y a los responsables de AC del incidente no cerradas, excluyendo al actor que cambió el QE. Un fallo del envío SHALL NOT afectar la respuesta del endpoint del QE.

#### Scenario: Fallo de notificación no rompe la transición del QE
- **WHEN** la persistencia de la notificación lanza una excepción tras sincronizar el incidente
- **THEN** el endpoint del QE responde con éxito y el incidente queda con el estado sincronizado

### Requirement: Desvinculación al eliminar el QE y re-vinculación al reactivarlo
Al eliminar (soft delete) un QE con `IncidenteId`, el sistema SHALL dejar `Incidente.QeId = null` y el incidente en `ABIERTO`, y SHALL registrar `ESTADO_SINCRONIZADO_QE` con el motivo "QE {numero} eliminado". Al reactivar ese QE, el sistema SHALL volver a vincularlo si el incidente sigue sin QE, no está eliminado y está en `ABIERTO`. En caso contrario, SHALL responder 422 con `errorCode: INCIDENTE_YA_VINCULADO` y el QE sigue eliminado.

#### Scenario: Eliminar el QE libera el incidente
- **WHEN** se elimina un QE en `ABIERTO` vinculado a un incidente
- **THEN** el incidente queda con `qeId: null`, en `ABIERTO`, y con una entrada `ESTADO_SINCRONIZADO_QE` cuyo motivo menciona el número del QE

#### Scenario: Reactivar con el incidente libre vuelve a vincular
- **WHEN** se reactiva ese QE y el incidente sigue con `qeId: null`
- **THEN** el QE queda activo y el incidente vuelve a tener `qeId` igual al id del QE

#### Scenario: Reactivar con el incidente ya tomado se rechaza
- **WHEN** se reactiva el QE pero el incidente ya está vinculado a otro QE
- **THEN** el sistema responde 422 con `INCIDENTE_YA_VINCULADO` y el QE sigue eliminado
