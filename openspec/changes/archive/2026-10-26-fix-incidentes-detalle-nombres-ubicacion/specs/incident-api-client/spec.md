## ADDED Requirements

### Requirement: Traducción de la ubicación al contrato del backend
`createIncident`, `createIncidentOfflineSync` y `updateIncident` SHALL traducir `ubicacion: { x, y }` del input a los campos planos `ubicacionX` / `ubicacionY` del body, y SHALL NOT enviar la propiedad `ubicacion`. Si `ubicacion` no viene en el input, el body no incluye `ubicacionX` ni `ubicacionY`. La traducción vive en un helper de la capa API, así que formularios y schemas Zod no cambian.

#### Scenario: Crear con ubicación
- **WHEN** se llama `createIncident({ ..., ubicacion: { x: 45, y: 30 } })`
- **THEN** el POST a `/api/incidents` lleva `ubicacionX: 45` y `ubicacionY: 30`, y no lleva `ubicacion`

#### Scenario: Actualizar con ubicación
- **WHEN** se llama `updateIncident('inc-001', { ubicacion: { x: 10, y: 90 } })`
- **THEN** el PATCH lleva `ubicacionX: 10` y `ubicacionY: 90`, y no lleva `ubicacion`

#### Scenario: Sin ubicación
- **WHEN** se llama `createIncident` sin `ubicacion`
- **THEN** el body no contiene `ubicacion`, `ubicacionX` ni `ubicacionY`
