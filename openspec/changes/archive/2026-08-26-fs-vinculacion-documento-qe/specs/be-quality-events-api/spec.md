## MODIFIED Requirements

### Requirement: Listado paginado y filtrado de Quality Events
El sistema SHALL exponer `GET /api/quality-events` con filtros `estado`, `tipo`, `severidad`, `origen`, `fechaDesde`/`fechaHasta`, `soloReincidencias` (`ciclo > 1`), `incluirEliminados`, `search` (subcadena, sin distinción de mayúsculas, sobre `numero` y `descripcion`), `page`, `pageSize`, scoped a la empresa activa. La respuesta SHALL anidar el arreglo bajo `data.items` junto a `data.pagination`. Ningún elemento de `data.items` incluye el resumen de `documentosVinculados` poblado (queda `[]`) — evita N+1 consultas en listados paginados.

#### Scenario: Listado por defecto
- **WHEN** un usuario con empresa activa solicita `GET /api/quality-events` sin filtros
- **THEN** el sistema responde 200 con `{ items: QualityEvent[], pagination }`, excluyendo QEs con `deletedAt` definido y de otras empresas

#### Scenario: Filtro `soloReincidencias`
- **WHEN** se solicita `GET /api/quality-events?soloReincidencias=true`
- **THEN** el sistema retorna solo QEs con `ciclo > 1`

#### Scenario: Filtro `incluirEliminados`
- **WHEN** se solicita `GET /api/quality-events?incluirEliminados=true`
- **THEN** el sistema incluye también los QEs eliminados (soft-delete) de la empresa activa

#### Scenario: Filtro `search` por número o descripción
- **WHEN** se solicita `GET /api/quality-events?search=corros`
- **THEN** el sistema retorna solo QEs cuyo `numero` o `descripcion` contiene "corros" (sin distinción de mayúsculas), scoped a la empresa activa

### Requirement: Detalle de Quality Event
El sistema SHALL exponer `GET /api/quality-events/:id`. La respuesta SHALL incluir `documentosVinculados` poblado con el resumen `{ id, codigo, titulo, estado }` de cada `Documento` vinculado, consultado desde la tabla puente `DocumentoQualityEvent` (ver `documento-qe-vinculacion`).

#### Scenario: QE propio
- **WHEN** un usuario solicita `GET /api/quality-events/:id` de un QE de su empresa activa
- **THEN** el sistema responde 200 con el QE completo, incluyendo `accionesCorrectivas` (con sus `solicitudesAjustePlazo`) y `documentosVinculados`

#### Scenario: QE inexistente o de otra empresa
- **WHEN** el id no existe o pertenece a una empresa distinta a la activa
- **THEN** el sistema responde 404, nunca 403

#### Scenario: QE sin documentos vinculados
- **WHEN** se solicita `GET /api/quality-events/:id` sobre un QE sin ningún vínculo
- **THEN** `data.documentosVinculados` es un array vacío

#### Scenario: QE con documentos vinculados poblados
- **WHEN** se solicita `GET /api/quality-events/:id` sobre un QE vinculado a 1 documento
- **THEN** `data.documentosVinculados` contiene 1 objeto con `id`, `codigo`, `titulo` y `estado`

## ADDED Requirements

### Requirement: Campo `DocumentosVinculados` en la entidad Quality Event
La entidad `QualityEvent` SHALL exponer `documentosVinculados`, una lista de resúmenes de documentos vinculados vía la tabla puente `DocumentoQualityEvent` — campo nuevo, no portado desde el mock cuando se construyó `be-quality-events` originalmente por no existir todavía la vinculación real.

#### Scenario: Nuevo QE creado sin vínculos
- **WHEN** se crea un `QualityEvent` vía `POST /api/quality-events`
- **THEN** `documentosVinculados` es un array vacío hasta que se cree un vínculo explícito vía `documento-qe-vinculacion`
