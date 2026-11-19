## ADDED Requirements

### Requirement: invalidarDashboard también refresca el listado de AC
`invalidarDashboard(queryClient)` SHALL invalidar, además de `['dashboard']`, las queries que empiezan con `['acciones-correctivas', 'listado']`. Así, cada mutación de AC (crear, actualizar, iniciar, ejecutar, verificar, devolver y cerrar, en QE, NC e incidente) y cada notificación nueva refrescan el listado sin recargar. Las queries de configuración y de candidatos de responsables (`['acciones-correctivas', 'responsables-config' | 'candidatos', ...]`) NO SHALL invalidarse por esta vía.

#### Scenario: Una notificación refresca el listado
- **WHEN** llega una notificación nueva con el listado de AC montado
- **THEN** se invalida `['acciones-correctivas', 'listado', …]` y no se invalida `['acciones-correctivas', 'candidatos', …]`
