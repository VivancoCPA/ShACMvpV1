## ADDED Requirements

### Requirement: Nombres resueltos en la lectura de Incidentes
`GET /api/incidents/:id` y `GET /api/incidents` SHALL incluir en cada incidente los campos de solo lectura `reportadoPorNombre` (nombre y apellido de quien reportó, sin espacios sobrantes), `localNombre` y `zonaNombre`. Se resuelven con `LEFT JOIN` a usuarios, locales y zonas. No se persisten en la tabla `incidentes` y no requieren migración. El filtro multi-empresa (`empresa_id` de la sesión) y el 404 para incidentes de otra empresa SHALL mantenerse sin cambios. Los endpoints de escritura MAY devolver estos campos en `null`.

#### Scenario: Detalle con nombres
- **WHEN** se solicita `GET /api/incidents/:id` de un incidente de la empresa activa con `reportadoPorId`, `localId` y `zonaId` válidos
- **THEN** la respuesta 200 incluye `reportadoPorNombre`, `localNombre` y `zonaNombre` con los nombres correspondientes

#### Scenario: Detalle sin local ni zona
- **WHEN** se solicita el detalle de un incidente sin `localId` ni `zonaId`
- **THEN** el sistema responde 200 con `localNombre` y `zonaNombre` en `null`

#### Scenario: Listado con nombres y filtros intactos
- **WHEN** se solicita `GET /api/incidents` con cualquier combinación de `tipo`, `fechaDesde`, `fechaHasta`, `search`, `showDeleted`, `page` y `pageSize`
- **THEN** cada item incluye los tres nombres y el resultado filtrado y paginado es el mismo que antes de agregar los JOIN (sin errores de columna ambigua)

#### Scenario: Incidente de otra empresa sigue en 404
- **WHEN** se solicita el detalle de un incidente que pertenece a otra empresa
- **THEN** el sistema responde 404

#### Scenario: Ubicación en el plano persistida y leída
- **WHEN** se crea un incidente con `ubicacionX = 40` y `ubicacionY = 25` y luego se solicita su detalle
- **THEN** la respuesta incluye `ubicacion: { x: 40, y: 25 }`
