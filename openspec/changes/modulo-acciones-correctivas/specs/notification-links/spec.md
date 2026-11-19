## ADDED Requirements

### Requirement: Redirección de /acciones-correctivas/:id al origen de la AC
El router SHALL registrar `/acciones-correctivas/:id` bajo el mismo `RoleGuard` que el listado. La ruta SHALL montar `AccionCorrectivaOrigenRedirect`, que:
1. resuelve el origen con `GET /api/acciones-correctivas/{id}/origen`;
2. hace `<Navigate replace>` al destino:
   - QE → `/quality-events/{origenId}#qe-ac-section`;
   - NC → `/nonconformities/{origenId}`;
   - INCIDENTE → `/incidents/{origenId}`.

Mientras resuelve, SHALL mostrar un indicador de carga. Ante un 404, SHALL mostrar un `toast.error` y navegar con `replace` a `/acciones-correctivas`.

#### Scenario: Enlace viejo de una AC de QE
- **WHEN** el usuario abre `/acciones-correctivas/ac-1` y la AC pertenece al QE `qe-9`
- **THEN** termina en `/quality-events/qe-9#qe-ac-section`, sin entrada intermedia en el historial

#### Scenario: AC inexistente
- **WHEN** el usuario abre `/acciones-correctivas/no-existe`
- **THEN** ve un toast de error y termina en `/acciones-correctivas`
