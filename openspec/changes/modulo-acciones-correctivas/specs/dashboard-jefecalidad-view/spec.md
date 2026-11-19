## ADDED Requirements

### Requirement: ACsVencidasPorVencerWidget enlaza al listado completo de AC
En la pestaña "Vencidas", `ACsVencidasPorVencerWidget` SHALL mostrar un enlace "Ver todas" (una clave nueva del namespace `dashboard`, en es-PE y en-US) a `/acciones-correctivas?vencida=true`. La cantidad de vencidas del widget y la del listado salen de la misma regla `EsAcVencida`, así que coinciden.

#### Scenario: Ver todas desde el dashboard
- **WHEN** el JCA hace clic en "Ver todas" en la pestaña "Vencidas"
- **THEN** navega a `/acciones-correctivas?vencida=true` y la tarjeta "Vencidas" del listado está activa
