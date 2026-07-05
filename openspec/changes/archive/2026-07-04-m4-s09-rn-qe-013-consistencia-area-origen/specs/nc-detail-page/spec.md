## ADDED Requirements

### Requirement: Botón "Crear QE" visible cuando la NC no tiene QE vinculado
El sistema SHALL renderizar un botón "Crear QE" en el grupo de botones de acción de `NonconformityDetailPage` cuando `getNCPermissions(nc, userRole).canCrearQE === true`. Al hacer clic, el sistema SHALL navegar a `/quality-events/nuevo?origen=O2_NC_DETECTADA&ncId={nc.id}&ncNumero={nc.numero}&ncArea={nc.areaAfectada}` (con los valores codificados para URL). El botón SHALL estar ausente del DOM — no solo deshabilitado — cuando `canCrearQE` es `false`.

#### Scenario: Botón Crear QE visible para SUPERVISOR en NC activa sin QE vinculado
- **WHEN** un usuario con rol `SUPERVISOR` ve el detalle de una NC en estado `EN_CORRECCION` sin `qeGeneradoId`
- **THEN** el botón "Crear QE" es visible

#### Scenario: Botón Crear QE ausente cuando la NC ya tiene un QE vinculado
- **WHEN** la NC tiene `qeGeneradoId` poblado
- **THEN** el botón "Crear QE" no aparece, independientemente del rol

#### Scenario: Botón Crear QE ausente para OPERARIO
- **WHEN** un usuario con rol `OPERARIO` ve el detalle de cualquier NC
- **THEN** el botón "Crear QE" no aparece

#### Scenario: Clic en Crear QE navega con los query params de vinculación
- **WHEN** un usuario autorizado hace clic en "Crear QE" en la NC `NC-2026-014` (`id: 'nc-014'`, `areaAfectada: 'Almacén Norte'`)
- **THEN** el router navega a `/quality-events/nuevo?origen=O2_NC_DETECTADA&ncId=nc-014&ncNumero=NC-2026-014&ncArea=Almac%C3%A9n%20Norte`
