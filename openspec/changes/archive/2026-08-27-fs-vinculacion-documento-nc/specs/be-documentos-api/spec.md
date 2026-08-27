## MODIFIED Requirements

### Requirement: Eliminación y restauración (soft delete)
El sistema SHALL exponer `DELETE /api/documents/:id`, marcando `DeletedAt` solo si `estado ∈ {BORRADOR, EN_REVISION}` y el documento no tiene ningún vínculo en la tabla puente `DocumentoQualityEvent` ni en la tabla puente `DocumentoNoConformidad` (protección de integridad propia de este endpoint, sin distinguir el estado de la entidad vinculada — no se deriva de RN-DOC-005, que gobierna la obsoletización, no el borrado). SHALL responder `409` si ya está eliminado, si el estado no califica, o si tiene vínculos de cualquiera de los dos tipos. El sistema SHALL exponer `PATCH /api/documents/:id/restaurar`, que limpia `DeletedAt` y fija `Estado: BORRADOR` incondicionalmente, sin importar el estado que tenía al momento de eliminarse.

#### Scenario: Eliminación exitosa en BORRADOR
- **WHEN** se envía `DELETE /api/documents/:id` sobre un documento en `BORRADOR` sin vínculos activos
- **THEN** el sistema responde `200` con el documento marcado como eliminado, que queda excluido del listado por defecto

#### Scenario: Eliminación rechazada por estado no válido
- **WHEN** se envía `DELETE /api/documents/:id` sobre un documento `PUBLICADO`
- **THEN** el sistema responde `409`

#### Scenario: Eliminación rechazada por vínculo QE existente
- **WHEN** se envía `DELETE /api/documents/:id` sobre un documento con al menos un vínculo en la tabla puente `DocumentoQualityEvent`, sin importar el estado de ese QE
- **THEN** el sistema responde `409`

#### Scenario: Eliminación rechazada por vínculo NC existente
- **WHEN** se envía `DELETE /api/documents/:id` sobre un documento sin vínculos de QE pero con al menos un vínculo en la tabla puente `DocumentoNoConformidad`, sin importar el estado de esa NC
- **THEN** el sistema responde `409`

#### Scenario: Restaurar siempre vuelve a BORRADOR
- **WHEN** se envía `PATCH /api/documents/:id/restaurar` sobre un documento eliminado que estaba en `EN_REVISION` al momento de eliminarse
- **THEN** el sistema responde `200` con `estado: BORRADOR`, no `EN_REVISION`

## ADDED Requirements

### Requirement: GET /api/documents/:id incluye el resumen de NCs vinculadas
El sistema SHALL poblar `data.ncVinculados` en la respuesta de `GET /api/documents/:id` con el resumen `{ id, numero, tipo, severidad, estado }` de cada `NoConformidad` vinculada, consultado desde la tabla puente `DocumentoNoConformidad`. Ver `documento-nc-vinculacion` para el contrato completo de la tabla puente y sus endpoints.

#### Scenario: Detalle de documento sin vínculos de NC
- **WHEN** se solicita `GET /api/documents/:id` sobre un documento sin ninguna NC vinculada
- **THEN** `data.ncVinculados` es un array vacío

#### Scenario: Detalle de documento con NCs vinculadas
- **WHEN** se solicita `GET /api/documents/:id` sobre un documento vinculado a 2 NCs
- **THEN** `data.ncVinculados` contiene 2 objetos con `id`, `numero`, `tipo`, `severidad` y `estado` de cada NC
