## MODIFIED Requirements

### Requirement: Captura de foto opcional con preview
El formulario SHALL permitir adjuntar una o más fotos vía `<input type="file" accept="image/*" capture="environment">`, mostrando una preview de cada foto antes del envío, y SHALL permitir enviar el formulario sin ninguna foto adjunta. Cada preview SHALL incluir un input de texto de una sola línea para un caption opcional (máx. 140 caracteres) asociado a esa foto específica, con `aria-label` (sin `<label>` visible, dado el layout compacto de grid de thumbnails).

#### Scenario: Usuario adjunta una foto
- **WHEN** el usuario selecciona una foto desde la cámara o galería del dispositivo
- **THEN** el sistema muestra una preview de la foto en el formulario antes de enviar, con un input de texto para un caption opcional

#### Scenario: Usuario envía sin foto
- **WHEN** el usuario completa los campos obligatorios sin adjuntar ninguna foto y envía el formulario
- **THEN** el sistema crea el incidente exitosamente sin bloquear por ausencia de fotos

#### Scenario: Usuario escribe un caption dentro del límite
- **WHEN** el usuario escribe un caption de 140 caracteres o menos para una foto adjunta
- **THEN** el sistema acepta el valor sin mostrar error de validación

#### Scenario: Usuario intenta exceder el límite de caracteres del caption
- **WHEN** el usuario intenta escribir más de 140 caracteres en el caption de una foto adjunta
- **THEN** el sistema muestra un error de validación localizado junto al campo, sin enviar la request

#### Scenario: Caption vacío no viaja como string vacío
- **WHEN** el usuario deja el campo de caption vacío para una foto y envía el formulario
- **THEN** la evidencia resultante no incluye `descripcion` (queda `undefined`), no un string vacío

### Requirement: Envío con cola offline ante falta de conexión
El formulario SHALL enviar el incidente directamente contra `POST /api/incidents` (mismo endpoint mock que usa el formulario de escritorio) cuando hay conexión activa. El folio (`numero`) y la empresa activa (`empresaId`) SHALL seguir siendo resueltos server-side por el handler existente para envíos online, no en el cliente. El caption opcional de cada foto (ver Requirement: Captura de foto opcional con preview) SHALL incluirse en la evidencia (`IncidentEvidencia.descripcion`) tanto en el envío online directo como al reconstruir las evidencias tras sincronizar desde la cola offline (ver capability `offline-incident-sync`).

Cuando `navigator.onLine === false` en el momento del envío, o la request falla por un error de conectividad real (sin `error.response`, p. ej. `error.code === 'ERR_NETWORK'`), el formulario SHALL encolar el reporte localmente (ver capability `offline-incident-queue`), incluyendo el caption de cada foto junto a su blob, y SHALL mostrar una confirmación de guardado local, no un mensaje de error. El formulario SHALL NOT mostrar la confirmación de guardado local ante un error de validación o negocio devuelto por el servidor (con `error.response` presente) ni ante el error sintético `ERR_INVALID_RESPONSE_ENVELOPE` documentado en `lib/axios.ts` (síntoma de que el Service Worker de MSW dejó de controlar la página) — en ambos casos SHALL mostrar el mensaje de error existente, sin encolar.

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

#### Scenario: Envío online con fotos con caption
- **WHEN** el usuario envía el formulario con conexión activa y al menos una foto tiene un caption escrito
- **THEN** el incidente creado incluye esa evidencia con `descripcion` igual al caption escrito

#### Scenario: Envío encolado con fotos con caption sincroniza con el caption intacto
- **WHEN** el usuario envía el formulario sin conexión con al menos una foto con caption, y luego el dispositivo reconecta
- **THEN** al sincronizar, la evidencia resultante conserva el mismo caption que el usuario escribió antes de perder la conexión
