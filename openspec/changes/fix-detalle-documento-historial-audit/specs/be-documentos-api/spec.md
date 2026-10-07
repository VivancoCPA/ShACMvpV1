## ADDED Requirements

### Requirement: GET /api/documents/:id devuelve el audit trail real
`ObtenerDocumentoHandler` SHALL cargar las filas de `documento_audit_trail` para el documento solicitado (tras las comprobaciones de tenant y confidencialidad, que siguen devolviendo `404` como hoy), ordenadas por `timestamp` ascendente, y asignarlas a `Documento.AuditTrail`. La proyección SHALL incluir únicamente columnas que existen en `DocumentoAuditTrail` (`id`, `documentoId`, `accion`, `estadoAnterior`, `estadoNuevo`, `campoModificado`, `valorAnterior`, `valorNuevo`, `realizadoPorId`, `realizadoPorNombre`, `timestamp`, `generadoPorIA`) — nunca inventa `entidadTipo`/`entidadId`/`ipOrigen`, que no existen en la entidad backend. El alcance de visibilidad SHALL ser el mismo que hoy (cualquier actor que pueda leer el detalle ve el audit trail completo, igual que el mock) — restringir esa visibilidad por rol queda fuera de este requirement.

#### Scenario: Audit trail no vacío tras crear un documento
- **WHEN** se crea un documento y luego se consulta `GET /api/documents/:id`
- **THEN** `auditTrail` incluye al menos una entrada con `accion: "DOCUMENTO_CREADO"`

#### Scenario: Audit trail incluye un cambio de estado
- **WHEN** un documento pasa de `BORRADOR` a `EN_REVISION` y luego se consulta `GET /api/documents/:id`
- **THEN** `auditTrail` incluye una entrada con `accion: "ESTADO_CAMBIADO"`, `estadoAnterior: "BORRADOR"`, `estadoNuevo: "EN_REVISION"`

### Requirement: GET /api/documents (listado general) no incluye audit trail
`ListarDocumentosHandler` SHALL seguir devolviendo `auditTrail: []` para cada documento cuando la consulta no está filtrada por `codigo` — mismo criterio que `QeVinculados`/`NcVinculados`: cargar el audit trail de cada fila de un listado paginado arbitrario sería una consulta N+1.

#### Scenario: Listado general sin filtrar por codigo devuelve auditTrail vacío
- **WHEN** se consulta `GET /api/documents?page=1&pageSize=10` sin `codigo`
- **THEN** cada documento del listado tiene `auditTrail: []`

### Requirement: GET /api/documents?codigo= (versiones) sí incluye audit trail
Cuando `ListarDocumentosQuery.Codigo` está definido, `ListarDocumentosHandler` SHALL poblar `auditTrail` para cada documento del resultado — este resultado está acotado a las versiones de un único código (normalmente unas pocas filas), no a un listado paginado arbitrario, así que no aplica el riesgo de N+1 que justifica dejarlo vacío en el caso general. Esto es necesario para que `DocumentVersionesTab` (`getPublisher`, vía `useDocumentVersiones(codigo)`) pueda mostrar quién publicó cada versión.

#### Scenario: Listado filtrado por codigo incluye auditTrail por versión
- **WHEN** se consulta `GET /api/documents?codigo=PRC-CD-001&pageSize=100`
- **THEN** cada documento del resultado tiene su propio `auditTrail` poblado con sus entradas reales
