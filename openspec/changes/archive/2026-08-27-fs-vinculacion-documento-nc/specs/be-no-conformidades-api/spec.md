## ADDED Requirements

### Requirement: GET /api/nonconformities/:id incluye el resumen de documentos vinculados
El sistema SHALL poblar `data.documentosVinculados` en la respuesta de `GET /api/nonconformities/:id` con el resumen `{ id, codigo, titulo, estado }` de cada `Documento` vinculado, consultado desde la tabla puente `DocumentoNoConformidad`. Ver `documento-nc-vinculacion` para el contrato completo de la tabla puente y sus endpoints. El listado paginado (`GET /api/nonconformities`) SHALL NOT poblar este resumen — permanece vacío en listados paginados, para evitar N+1 consultas.

#### Scenario: Detalle de NC sin documentos vinculados
- **WHEN** se solicita `GET /api/nonconformities/:id` sobre una NC sin ningún documento vinculado
- **THEN** `data.documentosVinculados` es un array vacío

#### Scenario: Detalle de NC con documentos vinculados
- **WHEN** se solicita `GET /api/nonconformities/:id` sobre una NC vinculada a 2 documentos
- **THEN** `data.documentosVinculados` contiene 2 objetos con `id`, `codigo`, `titulo` y `estado` de cada documento

#### Scenario: Listado de NCs no puebla el resumen de documentos vinculados
- **WHEN** se solicita `GET /api/nonconformities` (listado paginado)
- **THEN** cada elemento de `data` tiene `documentosVinculados: []`, independientemente de sus vínculos reales
