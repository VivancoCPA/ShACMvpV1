## ADDED Requirements

### Requirement: El dashboard se refresca con cada notificación y con cada acción
El sistema SHALL exportar `invalidarDashboard(queryClient)` en `src/features/dashboard/utils/invalidarDashboard.ts`, que invalida `DASHBOARD_QUERY_KEYS.all` (`['dashboard']`): el summary y los KPI de cualquier período. SHALL llamarse:
- al recibir **cualquier** notificación nueva, desde `invalidarQueriesDeEntidad` (`features/notifications/utils/`), que comparten el hub SignalR (`useNotificationsHub`) y el diffing del polling (`useNotificationToast`), sin importar `entidadTipo`;
- en el `onSuccess` de las mutaciones que cambian pendientes o alertas:
  - QE: crear, transicionar, asignar responsable, actualizar (guardar análisis), aprobar causa raíz, registrar cierre, firmar cierre, rechazar cierre, verificar eficacia, crear, actualizar y cerrar AC, y solicitar y revisar un ajuste de plazo;
  - NC: crear, actualizar y cerrar AC;
  - incidentes: crear (en línea y en la sincronización offline), y crear, actualizar y cerrar AC;
  - documentos: cambio de estado, firma, confirmar revisión periódica, nueva versión y copia controlada.

No SHALL agregarse polling del dashboard (`refetchInterval`).

#### Scenario: Una notificación invalida el dashboard
- **WHEN** el hub entrega una notificación con `entidadTipo: 'INCIDENTE'`
- **THEN** se invalidan las queries que empiezan con `['dashboard']`

#### Scenario: Aprobar causa raíz invalida el dashboard
- **WHEN** `useAprobarCausaRaiz` termina con éxito
- **THEN** se invalidan las queries que empiezan con `['dashboard']`

#### Scenario: Firmar cierre invalida el dashboard
- **WHEN** `useFirmarCierre` termina con éxito
- **THEN** se invalidan las queries que empiezan con `['dashboard']`

#### Scenario: La tarjeta cambia sin recargar
- **WHEN** el JCA está en el dashboard con "Aprobaciones y cierres pendientes" en `2` y se invalida `['dashboard']` tras aprobar una causa raíz
- **THEN** la tarjeta pasa a `1` sin recargar la página
