## MODIFIED Requirements

### Requirement: Vinculación con el Incidente de origen
Al crear un Quality Event con `origen: 'O1_INCIDENTE_CAMPO'`, el sistema SHALL asignar `Incidente.QeId` al id del QE creado **en la misma transacción** que la creación del QE, con una asignación condicional (`qe_id IS NULL`) que evite que dos creaciones concurrentes vinculen el mismo incidente. También SHALL registrar `QE_VINCULADO` en el audit trail del incidente, con el número del QE. Si el incidente ya está vinculado, el sistema SHALL responder 422 y no crear el QE. La vinculación ya no se completa desde el frontend mediante `PATCH /api/incidents/:id`.

#### Scenario: Vinculación atómica
- **WHEN** se envía `POST /api/quality-events` con `origen: 'O1_INCIDENTE_CAMPO'` e `incidenteId` de un incidente de la misma empresa sin QE
- **THEN** la respuesta 201 corresponde a un QE cuyo incidente ya tiene `QeId` igual al id del QE, sin requests adicionales

#### Scenario: Incidente ya vinculado
- **WHEN** se intenta crear un segundo QE O1 sobre un incidente que ya tiene `QeId`
- **THEN** el sistema responde 422 y no crea el QE

#### Scenario: Ciclo completo del QE O1
- **WHEN** un QE O1 se crea, transiciona a `EN_INVESTIGACION`, se cierra con la firma dual, se verifica como `EFECTIVO` y luego se reabre (por otra verificación `NO_EFECTIVO`)
- **THEN** el incidente pasa, respectivamente, por `ABIERTO` (con `QeId`), `EN_INVESTIGACION`, `CERRADO`, `CERRADO` y `EN_INVESTIGACION`
