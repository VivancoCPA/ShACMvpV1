## MODIFIED Requirements

### Requirement: Detalle de Quality Event
El sistema SHALL exponer `GET /api/quality-events/:id`. La respuesta SHALL incluir `documentosVinculados` poblado con el resumen `{ id, codigo, titulo, estado }` de cada `Documento` vinculado, consultado desde la tabla puente `DocumentoQualityEvent` (ver `documento-qe-vinculacion`). La respuesta SHALL incluir además `siguientePaso`, calculado por `QESiguientePasoResolver` (ver `quality-event-siguiente-paso`). `siguientePaso` SHALL ser exclusivo del detalle: `GET /api/quality-events` (listado) y los endpoints de escritura no lo devuelven.

#### Scenario: QE propio
- **WHEN** un usuario solicita `GET /api/quality-events/:id` de un QE de su empresa activa
- **THEN** el sistema responde 200 con el QE completo, incluyendo `accionesCorrectivas` (con sus `solicitudesAjustePlazo`), `documentosVinculados` y `siguientePaso`

#### Scenario: QE inexistente o de otra empresa
- **WHEN** el id no existe o pertenece a una empresa distinta a la activa
- **THEN** el sistema responde 404, nunca 403

#### Scenario: QE sin documentos vinculados
- **WHEN** se solicita `GET /api/quality-events/:id` sobre un QE sin ningún vínculo
- **THEN** `data.documentosVinculados` es un array vacío

#### Scenario: QE con documentos vinculados poblados
- **WHEN** se solicita `GET /api/quality-events/:id` sobre un QE vinculado a 1 documento
- **THEN** `data.documentosVinculados` contiene 1 objeto con `id`, `codigo`, `titulo` y `estado`

#### Scenario: Listado sin siguientePaso
- **WHEN** se solicita `GET /api/quality-events`
- **THEN** ningún item incluye `siguientePaso` (o viene en null)
