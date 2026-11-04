## ADDED Requirements

### Requirement: Badge "Sin QE vinculado" junto al botón "Crear QE"
`IncidentDetailPage` SHALL mostrar `IncidentSinQEBadge` (con el mismo tooltip y `aria-label` del listado) junto al botón "Crear QE" cuando `getIncidentQEAlertLevel(incidente, now)` sea `AMARILLO` o `ROJO`. Todo hook que use la página SHALL invocarse antes de cualquier `return` temprano.

#### Scenario: Incidente sin QE y vencido
- **WHEN** un incidente ACCIDENTE sin `qeId` con `fechaEvento` de hace 30 h se abre en el detalle
- **THEN** el badge "Sin QE vinculado" en rojo aparece junto al botón "Crear QE"

#### Scenario: Incidente dentro del plazo sin alerta
- **WHEN** el incidente sin QE está por debajo del 75 % de su plazo
- **THEN** no se muestra el badge

### Requirement: Aviso de estado gobernado por el Quality Event
Cuando el incidente tenga `qeId`, `IncidentDetailPage` SHALL mostrar un aviso informativo con el texto `t('incidents:detail.qeGobiernaEstado', { numero })` y un enlace a `/quality-events/{qeId}`. En ese caso SHALL NOT mostrar el badge "Sin QE vinculado". El aviso SHALL verse correctamente en modo claro y oscuro.

#### Scenario: Incidente con QE vinculado
- **WHEN** se abre el detalle de un incidente vinculado al QE `QE-2026-010`
- **THEN** se ve el aviso "El estado de este incidente se actualiza con el QE QE-2026-010." con enlace al QE, y no se ve el badge

### Requirement: Etiquetas de las acciones de audit trail generadas por el sistema
El audit trail del incidente SHALL mostrar etiquetas localizadas (`es-PE` y `en-US`) para las acciones `ESTADO_SINCRONIZADO_QE`, `PLAZO_QE_VENCIDO` y `QE_VINCULADO`.

#### Scenario: Entrada de sincronización visible
- **WHEN** el audit trail contiene una entrada `ESTADO_SINCRONIZADO_QE`
- **THEN** se muestra con su etiqueta traducida y el actor "Sistema"
