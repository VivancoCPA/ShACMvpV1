## MODIFIED Requirements

### Requirement: Envío con cola offline ante falta de conexión
El formulario SHALL enviar el incidente directamente contra `POST /api/incidents` (mismo endpoint mock que usa el formulario de escritorio) cuando hay conexión activa. El folio (`numero`) y la empresa activa (`empresaId`) SHALL seguir siendo resueltos server-side por el handler existente para envíos online, no en el cliente.

Cuando `navigator.onLine === false` en el momento del envío, o la request falla por un error de conectividad real (sin `error.response`, p. ej. `error.code === 'ERR_NETWORK'`), el formulario SHALL encolar el reporte localmente (ver capability `offline-incident-queue`) y SHALL mostrar una confirmación de guardado local, no un mensaje de error. El formulario SHALL NOT mostrar la confirmación de guardado local ante un error de validación o negocio devuelto por el servidor (con `error.response` presente) ni ante el error sintético `ERR_INVALID_RESPONSE_ENVELOPE` documentado en `lib/axios.ts` (síntoma de que el Service Worker de MSW dejó de controlar la página) — en ambos casos SHALL mostrar el mensaje de error existente, sin encolar.

#### Scenario: Envío exitoso con conexión activa
- **WHEN** el usuario envía el formulario con conexión activa
- **THEN** el sistema crea el incidente con folio asignado por el servidor y lo muestra en `IncidentListPage` de escritorio con el mismo tratamiento que cualquier otro incidente

#### Scenario: Envío sin conexión detectada de antemano
- **WHEN** el usuario envía el formulario y `navigator.onLine === false`
- **THEN** el sistema encola el reporte localmente y muestra una confirmación de "guardado, se enviará cuando haya conexión", sin mostrar un mensaje de error

#### Scenario: Envío falla por error de red real
- **WHEN** el usuario envía el formulario con `navigator.onLine === true` pero la request falla con un error de conectividad real (sin `error.response`)
- **THEN** el sistema encola el reporte localmente y muestra la misma confirmación de guardado local que en el escenario sin conexión detectada de antemano

#### Scenario: Envío falla por error de validación del servidor
- **WHEN** el envío del formulario recibe una respuesta de error del servidor (`error.response` presente, p. ej. una regla de negocio rechazada)
- **THEN** el sistema muestra el mensaje de error existente vía `toast` (Sonner) y no encola el reporte

#### Scenario: Envío falla por Service Worker de MSW sin control de la página
- **WHEN** el envío del formulario recibe el error sintético `ERR_INVALID_RESPONSE_ENVELOPE`
- **THEN** el sistema muestra el mensaje de error existente vía `toast` (Sonner) y no encola el reporte, para no enmascarar el problema de coordinación de Service Workers

## ADDED Requirements

### Requirement: Indicador de estado de la cola offline en la UI mobile
El layout mobile SHALL mostrar un indicador (badge) con la cantidad de reportes pendientes de sincronizar (`pendingCount` de `useOfflineIncidentSync()`) cuando ese valor sea mayor a cero, y SHALL mostrar un botón "Reintentar" cuando exista al menos un reporte en `status: 'error'`.

#### Scenario: Hay reportes pendientes de sincronizar
- **WHEN** `pendingCount` es mayor a cero
- **THEN** la UI mobile muestra un badge visible con la cantidad de reportes pendientes

#### Scenario: No hay reportes pendientes
- **WHEN** `pendingCount` es cero
- **THEN** la UI mobile no muestra el badge de pendientes

#### Scenario: Hay un reporte en error
- **WHEN** al menos un reporte encolado está en `status: 'error'`
- **THEN** la UI mobile muestra un botón "Reintentar" que, al presionarse, invoca `retry()` sobre ese reporte
