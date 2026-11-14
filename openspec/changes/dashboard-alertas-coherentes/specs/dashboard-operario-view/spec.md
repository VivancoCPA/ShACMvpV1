## MODIFIED Requirements

### Requirement: OperarioDashboard compone el layout de 4 zonas
`OperarioDashboard` SHALL componer `DashboardLayout` así, sin zona de indicadores ni de mapa:
- **alertas**: "Mis AC vencidas" (`acVencidas`; error; selectora) y "Mis AC por vencer en 5 días" (`acPorVencer`; warning; selectora).
  - Sus valores son el `.length` de los arreglos que devuelve `clasificarAcsVencidasYPorVencer(accionesCorrectivasAsignadas)` (`alertasDashboard.utils.ts`), sobre las AC con estado distinto de `CERRADA` y `COMPLETADA`: vencidas si `plazoFecha < ahora`; por vencer si `ahora ≤ plazoFecha ≤ ahora + 5 días`.
  - Al hacer clic, cada tarjeta filtra `MisACsWidget` para mostrar **ese mismo arreglo**, con un chip "Mostrando: {etiqueta} ({n}) ✕" que limpia `?alerta=`.
- **trabajoPrincipal:** `AccionesRequeridasWidget` y `MisACsWidget` (`id="mis-acs"`). `MisACsWidget` acepta las props opcionales `etiquetaFiltro` y `onQuitarFiltro`, y renderiza el arreglo que recibe.
- **trabajoLateral:** `MisQEsWidget` y la sección "Notificaciones pendientes".

La acción "Crear nuevo reporte" sigue en las `actions` de `PageWrapper`.

#### Scenario: Alertas del Operario
- **WHEN** `accionesCorrectivasAsignadas` tiene una AC `EN_EJECUCION` vencida ayer, una `PENDIENTE` que vence en 3 días y una `CERRADA` vencida
- **THEN** "Mis AC vencidas" muestra `1` y "Mis AC por vencer en 5 días" muestra `1`

#### Scenario: Zonas del Operario
- **WHEN** el summary ya cargó
- **THEN** se renderizan "Requiere atención" y "Mi trabajo y contexto", con `MisACsWidget` en la columna principal, y `MisQEsWidget` y "Notificaciones pendientes" en la lateral

#### Scenario: Clic en AC vencidas filtra Mis AC con el mismo número
- **WHEN** con esos mismos datos el usuario hace clic en "Mis AC vencidas"
- **THEN** la URL tiene `alerta=acVencidas`, y `MisACsWidget` muestra exactamente 1 fila y el chip "Mostrando: Mis AC vencidas (1)"

#### Scenario: Sin filtro se muestran todas las AC asignadas
- **WHEN** la URL no tiene `alerta`
- **THEN** `MisACsWidget` muestra las 3 AC asignadas, sin chip
