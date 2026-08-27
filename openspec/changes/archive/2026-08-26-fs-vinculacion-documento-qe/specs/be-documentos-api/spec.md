## MODIFIED Requirements

### Requirement: Eliminación y restauración (soft delete)
El sistema SHALL exponer `DELETE /api/documents/:id`, marcando `DeletedAt` solo si `estado ∈ {BORRADOR, EN_REVISION}` y el documento no tiene ningún vínculo en la tabla puente `DocumentoQualityEvent` (protección de integridad propia de este endpoint, sin distinguir el estado del QE vinculado — no se deriva de RN-DOC-005, que gobierna la obsoletización, no el borrado). SHALL responder `409` si ya está eliminado, si el estado no califica, o si tiene vínculos. El sistema SHALL exponer `PATCH /api/documents/:id/restaurar`, que limpia `DeletedAt` y fija `Estado: BORRADOR` incondicionalmente, sin importar el estado que tenía al momento de eliminarse.

#### Scenario: Eliminación exitosa en BORRADOR
- **WHEN** se envía `DELETE /api/documents/:id` sobre un documento en `BORRADOR` sin vínculos activos
- **THEN** el sistema responde `200` con el documento marcado como eliminado, que queda excluido del listado por defecto

#### Scenario: Eliminación rechazada por estado no válido
- **WHEN** se envía `DELETE /api/documents/:id` sobre un documento `PUBLICADO`
- **THEN** el sistema responde `409`

#### Scenario: Eliminación rechazada por vínculo QE existente
- **WHEN** se envía `DELETE /api/documents/:id` sobre un documento con al menos un vínculo en la tabla puente `DocumentoQualityEvent`, sin importar el estado de ese QE
- **THEN** el sistema responde `409`

#### Scenario: Restaurar siempre vuelve a BORRADOR
- **WHEN** se envía `PATCH /api/documents/:id/restaurar` sobre un documento eliminado que estaba en `EN_REVISION` al momento de eliminarse
- **THEN** el sistema responde `200` con `estado: BORRADOR`, no `EN_REVISION`

## ADDED Requirements

### Requirement: RN-DOC-005 evaluada en la obsoletización automática al publicar
`FirmarPublicarDocumentoHandler` (la única vía real hacia `OBSOLETO`, que obsoletiza automáticamente la versión `PUBLICADO` previa del mismo código al firmar la publicación de una nueva versión) SHALL rechazar la operación completa con `409` si la versión previa tiene un vínculo en `DocumentoQualityEvent` a un `QualityEvent` cuyo estado no es `CERRADO` ni `VERIFICADO`. Ver `documento-qe-vinculacion` para el contrato completo de la tabla puente y sus endpoints.

#### Scenario: Firma de publicación bloqueada por QE activo en la versión previa
- **WHEN** se firma la publicación de una nueva versión y la versión `PUBLICADO` previa del mismo código tiene un vínculo a un QE en `EN_INVESTIGACION`
- **THEN** el sistema responde `409`, ninguna de las dos versiones cambia de estado, y no se genera el PDF de distribución de la nueva versión

#### Scenario: Firma de publicación exitosa cuando los QE vinculados están cerrados
- **WHEN** se firma la publicación de una nueva versión y todos los vínculos de la versión previa apuntan a QEs `CERRADO` o `VERIFICADO`
- **THEN** el sistema completa la publicación: la versión previa pasa a `OBSOLETO` y la nueva a `PUBLICADO`

### Requirement: GET /api/documents/:id incluye el resumen de QEs vinculados
El sistema SHALL poblar `data.qeVinculados` en la respuesta de `GET /api/documents/:id` con el resumen `{ id, numero, tipo, severidad, estado }` de cada `QualityEvent` vinculado, consultado desde la tabla puente `DocumentoQualityEvent`. El campo `QeVinculados: Guid[]` (columna cruda) queda eliminado del modelo — este resumen lo reemplaza por completo.

#### Scenario: Detalle de documento sin vínculos
- **WHEN** se solicita `GET /api/documents/:id` sobre un documento sin ningún vínculo
- **THEN** `data.qeVinculados` es un array vacío

#### Scenario: Detalle de documento con vínculos poblados
- **WHEN** se solicita `GET /api/documents/:id` sobre un documento vinculado a 2 QEs
- **THEN** `data.qeVinculados` contiene 2 objetos con `id`, `numero`, `tipo`, `severidad` y `estado` de cada QE
