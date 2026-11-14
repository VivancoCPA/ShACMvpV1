## ADDED Requirements

### Requirement: OperarioDashboard compone el layout de 4 zonas
`OperarioDashboard` SHALL componer `DashboardLayout` así (sin zona de indicadores ni de mapa):
- **alertas:** "Mis AC vencidas" (error) y "Mis AC por vencer en 5 días" (warning), calculadas sobre `accionesCorrectivasAsignadas` del summary con estado distinto de `CERRADA` y `COMPLETADA`: vencidas si `plazoFecha < ahora`; por vencer si `ahora ≤ plazoFecha ≤ ahora + 5 días`. Las dos enlazan a `#mis-acs`;
- **trabajoPrincipal:** `AccionesRequeridasWidget` y `MisACsWidget` (`id="mis-acs"`);
- **trabajoLateral:** `MisQEsWidget` y la sección "Notificaciones pendientes".

La acción "Crear nuevo reporte" sigue en las `actions` de `PageWrapper`.

#### Scenario: Alertas del Operario
- **WHEN** `accionesCorrectivasAsignadas` tiene una AC `EN_EJECUCION` vencida ayer, una `PENDIENTE` que vence en 3 días y una `CERRADA` vencida
- **THEN** "Mis AC vencidas" muestra `1` y "Mis AC por vencer en 5 días" muestra `1`

#### Scenario: Zonas del Operario
- **WHEN** el summary ya cargó
- **THEN** se renderizan "Requiere atención" y "Mi trabajo y contexto", con `MisACsWidget` en la columna principal y `MisQEsWidget` y "Notificaciones pendientes" en la lateral
