## ADDED Requirements

### Requirement: Crear un QE O1 no dispara un segundo request de vinculación
Al crear con éxito un QE con `origen: 'O1_INCIDENTE_CAMPO'`, `QualityEventForm` SHALL navegar directo a `/quality-events/{id}`, sin llamar a `PATCH /api/incidents/:id` (la vinculación es atómica en el backend), y SHALL invalidar `INCIDENT_QUERY_KEYS.all` (que cubre el detalle y la lista). El hook `useVincularQE` de incidentes SHALL eliminarse si no le queda ningún consumidor.

#### Scenario: Sin segundo PATCH
- **WHEN** el usuario crea un QE O1 desde "Crear QE" de un incidente
- **THEN** solo se emite `POST /api/quality-events`, ningún `PATCH /api/incidents/:id`, y la caché de incidentes queda invalidada

### Requirement: Mutaciones de QE que afectan al incidente invalidan su caché
Toda mutación de QE que pueda cambiar el estado o el vínculo del incidente SHALL invalidar `INCIDENT_QUERY_KEYS.all` cuando el QE tiene `incidenteId`. Esto incluye transicionar, cambiar el estado de una AC, firmar el cierre, verificar la eficacia, forzar el vencimiento, eliminar y reactivar.

#### Scenario: Eliminar el QE refresca el incidente
- **WHEN** se elimina un QE con `incidenteId`
- **THEN** la caché de incidentes se invalida y el detalle del incidente vuelve a mostrar "Crear QE"
