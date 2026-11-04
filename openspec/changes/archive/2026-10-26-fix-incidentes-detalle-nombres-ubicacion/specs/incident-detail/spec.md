## ADDED Requirements

### Requirement: El detalle se renderiza sin error al pasar de carga a datos
`IncidentDetailPage` (y los subcomponentes del mismo archivo) SHALL llamar todos sus hooks antes de cualquier `return` anticipado (skeleton de carga, error o incidente inexistente), para que el número de hooks no cambie entre renders. En particular, `usePlanoBlob` y el cálculo de `selectedLocal` SHALL ejecutarse con datos opcionales (`incident?.localId`) antes del primer `return`.

#### Scenario: Transición de carga a datos
- **WHEN** la página se renderiza primero con `isLoading = true` y luego con el incidente cargado
- **THEN** la página muestra el detalle sin lanzar "Rendered more hooks than during the previous render"

#### Scenario: Apertura directa por URL
- **WHEN** el usuario abre `/incidents/:id` directamente (sin caché), por ejemplo justo después de crear el incidente o con F5
- **THEN** el detalle se muestra sin error

## MODIFIED Requirements

### Requirement: Cabecera del incidente con badges y metadatos
La sección de cabecera SHALL mostrar: número del incidente en tipografía grande, `IncidentTypeBadge` + `IncidentStatusBadge` + `SeverityBadge` en línea horizontal, y los metadatos: fecha de evento, área, turno, reportado por, y fecha de reporte. "Reportado por" SHALL mostrar `reportadoPorNombre`. Si no viene, SHALL mostrar el texto `incidents:detail.fields.usuarioDesconocido` ("Usuario no disponible") y nunca `reportadoPorId`.

#### Scenario: Cabecera con metadatos completos
- **WHEN** se carga el detalle de un incidente
- **THEN** el número, badges y todos los metadatos se muestran en la cabecera

#### Scenario: Reportado por muestra el nombre
- **WHEN** el incidente tiene `reportadoPorNombre = 'Juan Pérez'`
- **THEN** "Reportado por" muestra "Juan Pérez" y el GUID de `reportadoPorId` no aparece en la página

#### Scenario: Reportado por sin nombre
- **WHEN** el incidente no trae `reportadoPorNombre`
- **THEN** "Reportado por" muestra "Usuario no disponible" y nunca el GUID

#### Scenario: Breadcrumb de navegación
- **WHEN** se carga el detalle de un incidente INC-2026-003
- **THEN** el breadcrumb muestra "Incidentes / INC-2026-003"

### Requirement: Bloque "Ubicación" en detalle de incidente (ADD-03)
La sección de detalle SHALL incluir un bloque "Ubicación" posicionado en la misma posición relativa que en el formulario (después del bloque "Descripción del evento" y antes de "Información de investigación"). El bloque SHALL renderizarse únicamente cuando `incidente.localId` tiene valor. Si `localId` es `undefined`, el bloque no se muestra.

Cuando `localId` está presente, el bloque SHALL mostrar el nombre del local (`localNombre`) y, si `zonaId` está definido, el nombre de la zona (`zonaNombre`). Si alguno de los nombres no viene, SHALL mostrarse `—` en su lugar, nunca `localId` ni `zonaId`.

El plano SHALL mostrarse según estos casos:
- **Local con `planoPngUrl` y con `ubicacion`:** imagen del plano con un pin `bg-coral` posicionado mediante `position: absolute; left: x%; top: y%`, dentro de un contenedor `position: relative`.
- **Local con `planoPngUrl` y sin `ubicacion`:** imagen del plano sin pin, con el texto `incidents:detail.ubicacion.sinPunto` debajo.
- **Local sin `planoPngUrl`:** sin imagen, con el texto `incidents:detail.ubicacion.sinPlano`.

La imagen del plano SHALL ocupar `w-full` con un ancho máximo de 480 px. Mientras se carga el blob autenticado del plano, SHALL mostrarse un skeleton con ese mismo tamaño máximo. El `alt` de la imagen SHALL ser `localNombre` o, si no viene, el texto `incidents:detail.fields.local`.

#### Scenario: Bloque oculto sin localId
- **WHEN** se carga el detalle de un incidente que no tiene `localId`
- **THEN** el bloque "Ubicación" no se renderiza en el DOM

#### Scenario: Nombres de local y zona visibles
- **WHEN** se carga el detalle de un incidente con `localId = 'loc-001'`, `localNombre = 'Almacén Principal'`, `zonaId = 'zon-001'`, `zonaNombre = 'Zona de Recepción'`
- **THEN** el bloque muestra "Almacén Principal" y "Zona de Recepción"

#### Scenario: Nombres ausentes no exponen GUIDs
- **WHEN** el incidente tiene `localId` y `zonaId` pero no trae `localNombre` ni `zonaNombre`
- **THEN** el bloque muestra `—` para local y zona, y ningún GUID

#### Scenario: Solo nombre de local sin zona
- **WHEN** se carga el detalle de un incidente con `localId` definido pero `zonaId` ausente
- **THEN** el bloque muestra el `localNombre` sin ningún texto de zona

#### Scenario: Plano con pin
- **WHEN** se carga el detalle de un incidente con `ubicacion = { x: 45, y: 30 }` y el local tiene `planoPngUrl`
- **THEN** se muestra el plano (máx 480 px) con un punto `bg-coral` en `left: 45%; top: 30%`

#### Scenario: Plano sin punto
- **WHEN** el local tiene `planoPngUrl` y el incidente no tiene `ubicacion`
- **THEN** se muestra el plano sin pin y debajo "No se marcó la ubicación en el plano."

#### Scenario: Local sin plano
- **WHEN** el local del incidente no tiene `planoPngUrl`
- **THEN** no se muestra imagen y aparece "Este local no tiene plano cargado."

#### Scenario: Skeleton mientras carga el plano
- **WHEN** el local tiene `planoPngUrl` pero el blob del plano aún no está disponible
- **THEN** se muestra un skeleton del tamaño del plano en lugar de la imagen
