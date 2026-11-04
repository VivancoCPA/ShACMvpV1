## ADDED Requirements

### Requirement: Widget "Incidentes sin QE vencidos"
`JefeCalidadDashboard` SHALL incluir `IncidentesSinQeVencidosWidget`, alimentado por `incidentesSinQeVencidos` e `incidentesSinQeVencidosTotal` del resumen JEFE_CALIDAD. El tipo `JefeCalidadDashboardData` del frontend SHALL declarar ambos campos.

Cada fila del widget SHALL mostrar:
- el número;
- el tipo (traducido);
- "Vencido hace {{duracion}}", calculado con `getIncidentQEPlazoInfo`;
- un enlace a `/incidents/{id}`.

Sin elementos, SHALL mostrar `dashboard:incidentesSinQeVencidos.empty`. Los textos usan `t('dashboard:incidentesSinQeVencidos.*')` y el widget funciona en modo claro y oscuro.

#### Scenario: Widget con datos
- **WHEN** el resumen trae 2 incidentes sin QE vencidos
- **THEN** el widget muestra 2 filas con número, tipo y "Vencido hace …", y cada fila enlaza a su detalle

#### Scenario: Widget vacío
- **WHEN** `incidentesSinQeVencidos` está vacío
- **THEN** el widget muestra "No hay incidentes con el plazo vencido."
