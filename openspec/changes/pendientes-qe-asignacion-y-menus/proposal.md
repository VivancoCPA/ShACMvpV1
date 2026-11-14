## Why

Un QE asignado al Jefe de Calidad (o a un Supervisor) como responsable de investigación no aparece en "Acciones requeridas" del dashboard aunque la notificación de asignación sí llega a la campana: `extraerAccionesQE` nunca mira `responsableInvestigacionId` (agregado en `qe-precarga-incidente-responsable`), así que un QE en `ABIERTO` asignado no genera ningún pendiente y un Supervisor responsable no ve su investigación. Además, los menús desplegables del header (notificaciones, menú de usuario, selector de empresa) y otros paneles solo se cierran volviendo a hacer clic en su botón — no con clic afuera, Escape ni al navegar.

## What Changes

- `extraerAccionesQE` calcula los pendientes de QE **por asignación** más las tareas propias del JCA:
  - Responsable asignado (cualquier rol): `QE_INICIAR_INVESTIGACION` (QE en `ABIERTO`) y `QE_COMPLETAR_ANALISIS` (QE en `EN_INVESTIGACION`).
  - JCA: `QE_ASIGNAR_RESPONSABLE` (QE en `ABIERTO` sin responsable) y `QE_APROBAR_CAUSA_RAIZ` (QE en `EN_INVESTIGACION`/`ANALISIS_COMPLETADO` con causa raíz ≥ 100 caracteres sin firmar).
  - `QE_CERRAR`, `QE_VERIFICAR`, `QE_FIRMAR_CIERRE` sin cambios.
  - Se excluyen QE eliminados (`deletedAt`).
  - `QE_ASIGNAR_RESPONSABLE` e `QE_INICIAR_INVESTIGACION` suben a prioridad `'alta'` si el QE lleva más de 48 h en `ABIERTO` (PRD §1.3).
- **BREAKING (interno):** se elimina el tipo `QE_CAUSA_RAIZ` (y su clave i18n); lo reemplazan `QE_COMPLETAR_ANALISIS` y `QE_APROBAR_CAUSA_RAIZ`.
- Una notificación de `entidadTipo === 'QE'` invalida la lista (y el detalle) de QE, para que el pendiente aparezca a la vez que la notificación. Aplica tanto cuando llega por SignalR como cuando la detecta el polling (`useNotificationToast`).
- Nuevo hook compartido `useDismissable` (clic/touch afuera + Escape con devolución de foco) y cierre automático al navegar. Se aplica a: panel de notificaciones (`NotificationBell`), menú de usuario y selector de empresa (`TopNav`, mutuamente excluyentes), menú "⋯" de `DocumentManagementActions` y panel de la cola offline (`SyncQueueBadge`).
- Atributos ARIA en los botones disparadores (`aria-expanded`, `aria-haspopup`, `aria-controls`).
- i18n `dashboard:accionesRequeridas.tipo.*`: 4 claves nuevas en es-PE y en-US; se quita `QE_CAUSA_RAIZ`.

## Capabilities

### New Capabilities
- `dismissable-menus`: hook `useDismissable` y comportamiento de cierre (clic afuera, Escape, navegación) de los menús/paneles desplegables no modales.

### Modified Capabilities
- `dashboard-acciones-requeridas`: los ítems de QE pasan a calcularse por asignación del responsable de investigación + tareas del JCA; desaparece `QE_CAUSA_RAIZ`.
- `notifications-realtime-client`: un evento de entidad QE invalida la lista/detalle de QE.
- `notification-bell`: el panel se cierra con clic afuera, Escape y al navegar.
- `notification-toast`: las notificaciones nuevas detectadas por polling invalidan las queries de su entidad (QE/Documento). Es necesario porque la asignación de responsable no se envía por SignalR.

## Impact

- Frontend (`shc-controldoc/src/`): `features/dashboard/utils/accionesRequeridas.utils.ts`, `features/dashboard/types/accionesRequeridas.types.ts`, `features/notifications/hooks/useNotificationsHub.ts`, `features/notifications/components/NotificationBell.tsx`, `components/layout/TopNav.tsx`, `features/documents/components/DocumentManagementActions.tsx`, `features/incidents/components/SyncQueueBadge.tsx`, nuevo `hooks/useDismissable.ts`, `i18n/es-PE.json`, `i18n/en-US.json`, tests asociados.
- Sin cambios de backend, API ni migraciones.
