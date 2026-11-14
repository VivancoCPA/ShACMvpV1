## 1. Pendientes de QE por asignación

- [x] 1.1 `accionesRequeridas.types.ts`: agregar `QE_INICIAR_INVESTIGACION`, `QE_COMPLETAR_ANALISIS`, `QE_ASIGNAR_RESPONSABLE`, `QE_APROBAR_CAUSA_RAIZ`; quitar `QE_CAUSA_RAIZ`
- [x] 1.2 `extraerAccionesQE`: reglas por responsable antes de las de rol, `QE_ASIGNAR_RESPONSABLE` y `QE_APROBAR_CAUSA_RAIZ` para JCA, excluir `deletedAt`, prioridad `'alta'` tras 48 h en ABIERTO (design D1, D2)
- [x] 1.3 Grep de `QE_CAUSA_RAIZ`: actualizar `buildJefeCalidadExportSections.test.ts` y cualquier otro uso
- [x] 1.4 i18n `dashboard:accionesRequeridas.tipo.*` en es-PE y en-US: 4 claves nuevas, quitar `QE_CAUSA_RAIZ`
- [x] 1.5 Tests en `accionesRequeridas.utils.test.ts`: los escenarios de la spec `dashboard-acciones-requeridas`, más las regresiones `QE_CERRAR`, `QE_VERIFICAR` y `QE_FIRMAR_CIERRE`

## 2. Actualización inmediata del dashboard

- [x] 2.1 Confirmar que las mutaciones de asignar, transicionar, guardar análisis, aprobar causa raíz y crear invalidan la lista de QE (ya verificado; sin cambios esperados)
- [x] 2.2 Crear `features/notifications/utils/invalidarQueriesDeEntidad.ts` (QE y DOCUMENTO) y usarlo en `useNotificationsHub` en lugar del bloque inline (design D3)
- [x] 2.3 `useNotificationToast`: invalidar las entidades de las notificaciones `fresh`, nunca en la baseline
- [x] 2.4 Tests: el hub con `entidadTipo: 'QE'` invalida la lista y el detalle de QE; el polling con una notificación QE nueva invalida; la baseline no invalida

## 3. Menús desplegables

- [x] 3.1 `src/hooks/useDismissable.ts`: `useDismissable(open, onClose, refs)` y `useRouteScopedOpen()` (design D4, D5)
- [x] 3.2 Tests de `useDismissable`: clic afuera, clic adentro o en el botón, Escape con foco, sin listeners cuando está cerrado; `useRouteScopedOpen` se cierra al cambiar de ruta
- [x] 3.3 `NotificationBell` y `NotificationList` (`onNavigate`): aplicar el hook y ARIA (`aria-haspopup="dialog"`)
- [x] 3.4 `TopNav`: menú de usuario y selector de empresa exclusivos, con el hook, cierre al navegar y ARIA
- [x] 3.5 `DocumentManagementActions`: reemplazar el overlay por el hook y agregar ARIA
- [x] 3.6 `SyncQueueBadge`: aplicar el hook y ARIA
- [x] 3.7 Tests de componentes: en `NotificationBell`, clic en el body y Escape cierran el panel; en `TopNav`, los menús son exclusivos y un cambio de ruta los cierra; ajustar los tests existentes de `DocumentManagementActions` y `SyncQueueBadge` si dependían del overlay

## 4. Verificación

- [ ] 4.1 Suite completa de frontend (`npm test`) y de backend (`dotnet test`)
- [ ] 4.2 `tsc --noEmit` y `npm run lint` con cero errores
- [ ] 4.3 Prueba manual con MSW apagado (pasos 1 a 5 de la instrucción), a cargo de Toño
