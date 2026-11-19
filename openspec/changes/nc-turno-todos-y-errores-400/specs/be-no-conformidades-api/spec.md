## ADDED Requirements

### Requirement: Turno de la No Conformidad admite "TODOS"
El sistema SHALL modelar el turno de la NC con un enum propio `NCTurno` (`TODOS`, `DIA`, `TARDE`, `NOCHE`), distinto de `IncidentTurno` (que sigue siendo `DIA`/`TARDE`/`NOCHE` para Incidentes y Quality Events). `turno` es opcional en `POST /api/nonconformities` y `PATCH /api/nonconformities/:id`, se persiste como texto con el mismo literal, y se devuelve tal cual en detalle, listado y dashboard. Toda conversión de una NC hacia una entidad que use `IncidentTurno` MUST dejar el turno destino vacío/nulo cuando la NC tenga `TODOS`, nunca inventar un valor.

#### Scenario: Crear NC con turno TODOS
- **WHEN** un usuario envía `POST /api/nonconformities` con un body válido y `"turno": "TODOS"`
- **THEN** el sistema responde 201 y `GET /api/nonconformities/:id` devuelve `turno: 'TODOS'`

#### Scenario: Crear NC con turno DIA (regresión)
- **WHEN** un usuario envía `POST /api/nonconformities` con un body válido y `"turno": "DIA"`
- **THEN** el sistema responde 201 con `turno: 'DIA'`

#### Scenario: Turno desconocido
- **WHEN** un usuario envía `POST /api/nonconformities` con `"turno": "XYZ"`
- **THEN** el sistema responde 400 con un `message` que menciona `turno`, y no crea la NC

#### Scenario: Editar el turno a TODOS
- **WHEN** un usuario con permiso de edición envía `PATCH /api/nonconformities/:id` con `"turno": "TODOS"` sobre una NC editable
- **THEN** el sistema persiste `TODOS` y registra el cambio de campo `turno` en el audit trail
