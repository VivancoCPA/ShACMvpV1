## ADDED Requirements

### Requirement: Ruta mobile de reporte rápido de incidente
El sistema SHALL exponer la ruta `/m/incidentes/nuevo`, protegida por sesión activa y por el mismo grupo de roles que protege `/incidents/nuevo` (`ROUTE_ROLE_GROUPS.incidentsView`), renderizada con un layout propio mobile-first de una columna, sin el Sidebar ni el TopNav del `AppShell` de escritorio.

#### Scenario: Usuario autorizado accede a la ruta mobile
- **WHEN** un usuario autenticado con rol `OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `AUDITOR_INTERNO` o `ALTA_DIRECCION` navega a `/m/incidentes/nuevo`
- **THEN** el sistema renderiza el formulario de reporte rápido en un layout de una columna, sin Sidebar ni TopNav de escritorio

#### Scenario: Usuario sin rol autorizado intenta acceder
- **WHEN** un usuario autenticado sin ninguno de los roles de `incidentsView` navega a `/m/incidentes/nuevo`
- **THEN** el sistema redirige a `/no-autorizado`

#### Scenario: Usuario sin sesión intenta acceder
- **WHEN** un usuario sin sesión activa navega a `/m/incidentes/nuevo`
- **THEN** el sistema redirige a `/login`

### Requirement: Formulario de reporte rápido con subset de campos
El formulario SHALL usar React Hook Form + un schema Zod que extiende `createIncidentSchema` con los campos: `tipo`, `areaId`, `descripcion`, severidad percibida (opcional), fotos (evidencias) y `geoUbicacion` (opcional). El campo `localId`/`zonaId` y demás campos de investigación del formulario de escritorio SHALL NOT aparecer en el formulario mobile.

#### Scenario: Envío válido con campos mínimos
- **WHEN** el usuario completa `tipo`, `areaId`, `descripcion` (≥20 caracteres) y `huboLesionados`, y envía el formulario sin foto ni GPS
- **THEN** el sistema crea el incidente contra `POST /api/incidents` con los mismos campos y validaciones que ya aplica el mock (incluyendo severidad auto-calculada si no se especifica)

#### Scenario: Envío con errores de validación
- **WHEN** el usuario intenta enviar el formulario con `descripcion` de menos de 20 caracteres
- **THEN** el sistema muestra el error de validación localizado junto al campo, sin enviar la request

### Requirement: Captura de foto opcional con preview
El formulario SHALL permitir adjuntar una o más fotos vía `<input type="file" accept="image/*" capture="environment">`, mostrando una preview de cada foto antes del envío, y SHALL permitir enviar el formulario sin ninguna foto adjunta.

#### Scenario: Usuario adjunta una foto
- **WHEN** el usuario selecciona una foto desde la cámara o galería del dispositivo
- **THEN** el sistema muestra una preview de la foto en el formulario antes de enviar

#### Scenario: Usuario envía sin foto
- **WHEN** el usuario completa los campos obligatorios sin adjuntar ninguna foto y envía el formulario
- **THEN** el sistema crea el incidente exitosamente sin bloquear por ausencia de fotos

### Requirement: Captura de GPS opcional y no bloqueante
El formulario SHALL intentar capturar la ubicación GPS del dispositivo vía `navigator.geolocation.getCurrentPosition` al abrir el formulario, y SHALL permitir el envío exitoso del incidente aunque el usuario niegue el permiso, el dispositivo no soporte geolocalización, o la captura falle o esté en curso.

#### Scenario: Usuario concede permiso de ubicación
- **WHEN** el usuario concede el permiso de geolocalización y la captura es exitosa
- **THEN** el sistema incluye `geoUbicacion: { lat, lng, capturadoEn }` en el payload enviado a `POST /api/incidents`

#### Scenario: Usuario niega permiso de ubicación
- **WHEN** el usuario niega el permiso de geolocalización o la captura falla
- **THEN** el sistema permite completar y enviar el formulario sin bloquear el envío, y el payload enviado no incluye `geoUbicacion`

### Requirement: Envío online-only contra el mock existente
El formulario SHALL enviar el incidente directamente contra `POST /api/incidents` (mismo endpoint mock que usa el formulario de escritorio) sin ninguna cola de reintento local. El folio (`numero`) y la empresa activa (`empresaId`) SHALL seguir siendo resueltos server-side por el handler existente, no en el cliente.

#### Scenario: Envío exitoso con conexión activa
- **WHEN** el usuario envía el formulario con conexión activa
- **THEN** el sistema crea el incidente con folio asignado por el servidor y lo muestra en `IncidentListPage` de escritorio con el mismo tratamiento que cualquier otro incidente

#### Scenario: Envío falla sin conexión
- **WHEN** el usuario envía el formulario sin conexión de red
- **THEN** el sistema muestra un mensaje de error vía `toast` (Sonner), nunca `alert()`, sin simular un éxito ni encolar el reporte para reintento posterior
