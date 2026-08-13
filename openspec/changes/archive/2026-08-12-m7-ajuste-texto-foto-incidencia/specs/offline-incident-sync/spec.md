## MODIFIED Requirements

### Requirement: Reutilización de la mutation de creación de incidentes existente
La sincronización de un reporte encolado SHALL reutilizar la misma mutation de creación de incidentes (`useCreateIncident`) que usa el formulario de escritorio y el envío online del formulario mobile, reconstruyendo el payload (incluyendo evidencias a partir de los `Blob` persistidos, y el caption de cada foto desde `photoCaptions` alineado por índice) sin reimplementar la llamada a la API.

#### Scenario: Sincronización exitosa de un reporte con fotos
- **WHEN** un reporte encolado con `photoBlobs` no vacío sincroniza exitosamente
- **THEN** el sistema reconstruye las evidencias del incidente a partir de los `Blob` persistidos y las envía en el mismo payload que usaría un envío online directo, sin duplicar la lógica de la llamada HTTP

#### Scenario: Sincronización propaga el caption de cada foto
- **WHEN** un reporte encolado tiene `photoCaptions` con al menos un caption definido, y sincroniza exitosamente
- **THEN** cada `IncidentEvidencia` reconstruida incluye `descripcion` igual al caption correspondiente en `photoCaptions` por el mismo índice que su `Blob` en `photoBlobs`

#### Scenario: Sincronización de una entrada sin `photoCaptions` (encolada antes de este cambio)
- **WHEN** un reporte encolado no tiene el campo `photoCaptions` (persistido por una versión anterior del esquema) sincroniza exitosamente
- **THEN** el sistema reconstruye las evidencias correctamente, todas sin `descripcion`, sin lanzar error
