## ADDED Requirements

### Requirement: Botón "Crear QE" visible cuando el incidente no tiene QE vinculado
El sistema SHALL renderizar un botón "Crear QE" en la cabecera de acciones de la página de detalle del incidente cuando `getIncidentPermissions(incidente, userRole).canCrearQE === true`. Al hacer clic, el sistema SHALL navegar a `/quality-events/nuevo?origen=O1_INCIDENTE_CAMPO&incidenteId={incidente.id}&incidenteNumero={incidente.numero}&incidenteArea={incidente.areaId}` (con los valores codificados para URL). El botón SHALL estar ausente del DOM — no solo deshabilitado — cuando `canCrearQE` es `false`. Este botón es independiente del enlace "Ver en QE" y del botón "Solicitar AC en QE", los cuales solo aparecen cuando `incidente.qeId` YA está poblado.

#### Scenario: Botón Crear QE visible para SUPERVISOR en incidente activo sin QE vinculado
- **WHEN** un usuario con rol `SUPERVISOR` ve el detalle de un incidente en estado `EN_INVESTIGACION` sin `qeId`
- **THEN** el botón "Crear QE" es visible

#### Scenario: Botón Crear QE ausente cuando el incidente ya tiene un QE vinculado
- **WHEN** `incidente.qeId` está poblado
- **THEN** el botón "Crear QE" no aparece, independientemente del rol, y en su lugar se muestra el enlace "Ver en QE" según la regla existente

#### Scenario: Botón Crear QE ausente para OPERARIO
- **WHEN** un usuario con rol `OPERARIO` ve el detalle de cualquier incidente
- **THEN** el botón "Crear QE" no aparece

#### Scenario: Clic en Crear QE navega con los query params de vinculación
- **WHEN** un usuario autorizado hace clic en "Crear QE" en el incidente `INC-2026-003` (`id: 'inc-003'`, `areaId: 'SyST'`)
- **THEN** el router navega a `/quality-events/nuevo?origen=O1_INCIDENTE_CAMPO&incidenteId=inc-003&incidenteNumero=INC-2026-003&incidenteArea=SyST`
