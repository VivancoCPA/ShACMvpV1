## REMOVED Requirements

### Requirement: revisorId and aprobadorId selects are populated from user fixtures
**Reason**: Los IDs de fixtures no existen en la base de datos real; con MSW apagado el documento quedaba asignado a usuarios ficticios.
**Migration**: Reemplazado por "revisorId and aprobadorId selects are populated from real candidates".

## ADDED Requirements

### Requirement: revisorId and aprobadorId selects are populated from real candidates
`DocumentForm` SHALL NOT recibir ni importar usuarios de `mocks/fixtures`. Cada `<select>` (`revisorId`, `aprobadorId`) SHALL poblarse con su propia lista obtenida de `useCandidatosAsignacion` (revisores y aprobadores pueden diferir), mostrando `nombreCompleto`. En modo edición SHALL enviarse el `documentoId` para excluir al autor. Si el valor guardado no figura entre los candidatos, el select SHALL mostrarlo como opción marcada "(no disponible)" y permitir cambiarlo, nunca quedar en blanco en silencio. Mientras carga, el select SHALL indicar el estado de carga. La regla RN-DOC-019 (superRefine) se mantiene.

#### Scenario: Selects independientes
- **WHEN** el formulario renderiza con candidatos distintos para revisor y aprobador
- **THEN** cada select lista únicamente los candidatos de su tipo

#### Scenario: Valor guardado ya no elegible
- **WHEN** se edita un BORRADOR cuyo `revisorId` guardado no está entre los candidatos
- **THEN** el select muestra esa opción con la marca "(no disponible)" seleccionada y permite elegir otro

#### Scenario: Sin uso de fixtures
- **WHEN** se inspeccionan los imports de `DocumentFormPage` y `DocumentForm`
- **THEN** no importan nada desde `mocks/`
