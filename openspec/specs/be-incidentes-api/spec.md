# be-incidentes-api

## Purpose

Backend .NET del CRUD de Incidentes SyST (M3): creación con severidad auto-calculada server-side, detección de reporte tardío, listado paginado/filtrado, transición de estado validada contra la máquina de estados, notificaciones best-effort, soft-delete/restauración, acciones correctivas del incidente, y aislamiento multi-tenant estricto scoped por `empresaId` de la sesión activa.

## Requirements

### Requirement: Creación de Incidente
El sistema SHALL exponer `POST /api/incidents`, requiriendo `tipo`, `descripcion` (mínimo 20 caracteres), `areaId`, `turno`, `fechaEvento` y `huboLesionados`; `numPersonasAfectadas` es opcional. El sistema acepta además, opcionalmente en la creación: `localId`, `zonaId`, `ubicacion` (`{ x, y }`), `geoUbicacion` (`{ lat, lng, capturadoEn }`) y `evidencias` (URLs ya subidas vía el endpoint de upload de evidencias). El sistema asigna `empresaId` desde la sesión activa; la única excepción es un `empresaId` opcional en el body, aceptado únicamente para el caso de sincronización offline, y solo tras validar que el usuario autenticado tiene o tuvo membresía en esa empresa.

#### Scenario: Creación exitosa
- **WHEN** un usuario con empresa activa envía un body válido a `POST /api/incidents`
- **THEN** el sistema responde 201 con el incidente creado, `estado: 'ABIERTO'`, `numero` con formato `INC-<año>-NNN`, y `severidad` calculada por el servidor

#### Scenario: Campos requeridos ausentes
- **WHEN** el body de `POST /api/incidents` omite alguno de los campos requeridos
- **THEN** el sistema responde 400 con el detalle de los campos faltantes

#### Scenario: Descripción demasiado corta
- **WHEN** `descripcion` tiene menos de 20 caracteres
- **THEN** el sistema responde 400

#### Scenario: Sin empresa activa
- **WHEN** la sesión no tiene `empresaActivaId` resuelto y el body no incluye `empresaId`
- **THEN** el sistema responde 401 y no crea el incidente

#### Scenario: Creación con local, zona y ubicación en el plano
- **WHEN** se crea un incidente incluyendo `localId`, `zonaId` y `ubicacion: { x, y }` en el body
- **THEN** el sistema persiste los tres campos en el incidente creado, igual que si se hubieran seteado luego vía `PATCH /:id`, y `GET`/`POST` responden `ubicacion` como objeto anidado `{ x, y }` (nunca como `ubicacionX`/`ubicacionY` sueltos)

#### Scenario: Creación con geolocalización y evidencias del reporte mobile
- **WHEN** se crea un incidente incluyendo `geoUbicacion: { lat, lng, capturadoEn }` y `evidencias: [{ url, nombre, tipo, tamanioKb, ... }]` (URLs ya obtenidas de `POST /api/incidents/evidencias`)
- **THEN** el sistema persiste ambos campos tal cual fueron enviados, sin validar que las URLs de `evidencias` correspondan a un upload previo de este mismo usuario, y responde `geoUbicacion` como objeto anidado `{ lat, lng, capturadoEn }` (nunca como `geoLat`/`geoLng`/`geoCapturadoEn` sueltos)

#### Scenario: Creación offline con `empresaId` de un miembro válido
- **WHEN** un usuario autenticado envía `POST /api/incidents` con `empresaId` explícito en el body, y el usuario tiene (o tuvo) una membresía en esa empresa
- **THEN** el sistema crea el incidente bajo esa `empresaId`, ignorando cuál sea la empresa activa de la sesión

#### Scenario: Creación offline con `empresaId` de una empresa sin membresía
- **WHEN** un usuario autenticado envía `POST /api/incidents` con `empresaId` explícito en el body, y el usuario nunca tuvo membresía en esa empresa
- **THEN** el sistema responde 403 y no crea el incidente

### Requirement: Severidad auto-calculada server-side
El sistema SHALL calcular `severidad` en el servidor a partir de `tipo` y `numPersonasAfectadas`, ignorando cualquier valor de `severidad` enviado por el cliente: `ACCIDENTE` con más de una persona afectada → `CRITICA`; `ACCIDENTE` en cualquier otro caso → `ALTA`; `INCIDENTE` → `MEDIA`; `CUASI_ACCIDENTE` → `MEDIA`; `CONDICION_INSEGURA` → `BAJA`.

#### Scenario: Accidente con múltiples afectados
- **WHEN** se crea un incidente con `tipo: 'ACCIDENTE'` y `numPersonasAfectadas: 2`
- **THEN** el sistema asigna `severidad: 'CRITICA'`

#### Scenario: Accidente con un solo afectado o sin dato
- **WHEN** se crea un incidente con `tipo: 'ACCIDENTE'` y `numPersonasAfectadas` ausente o igual a 1
- **THEN** el sistema asigna `severidad: 'ALTA'`

#### Scenario: Cliente intenta forzar severidad
- **WHEN** el body de creación incluye un campo `severidad` con un valor distinto al calculado
- **THEN** el sistema ignora ese valor y persiste la severidad calculada server-side

### Requirement: Detección server-side de reporte tardío
El sistema SHALL registrar automáticamente una entrada de audit trail `REPORTE_TARDIO` cuando transcurran más de 24 horas entre `fechaEvento` y el momento de la creación del incidente, calculado con la hora del servidor.

#### Scenario: Reporte dentro de plazo
- **WHEN** un incidente se crea con `fechaEvento` de hace menos de 24 horas
- **THEN** el audit trail no incluye una entrada `REPORTE_TARDIO`

#### Scenario: Reporte tardío
- **WHEN** un incidente se crea con `fechaEvento` de hace más de 24 horas
- **THEN** el audit trail incluye una entrada `REPORTE_TARDIO` con `realizadoPorId: 'system'` y `generadoPorIA: true`, generada en el mismo request de creación

### Requirement: Listado paginado y filtrado de Incidentes
El sistema SHALL exponer `GET /api/incidents` con filtros `tipo`, `fechaDesde`, `fechaHasta`, `search` (sobre `numero`/`descripcion`), `showDeleted`, `page`, `pageSize`, scoped a la empresa activa. La respuesta SHALL anidar el arreglo bajo `data.items` junto a `data.pagination`, no `data` como arreglo directo.

#### Scenario: Listado por defecto
- **WHEN** un usuario con empresa activa solicita `GET /api/incidents` sin filtros
- **THEN** el sistema responde 200 con `{ items: Incidente[], pagination }`, excluyendo incidentes con `deletedAt` definido y de otras empresas

#### Scenario: Filtro `showDeleted`
- **WHEN** se solicita `GET /api/incidents?showDeleted=true`
- **THEN** el sistema incluye también los incidentes eliminados (soft-delete) de la empresa activa

#### Scenario: Búsqueda por texto
- **WHEN** se solicita `GET /api/incidents?search=<texto>`
- **THEN** el sistema retorna solo incidentes cuyo `numero` o `descripcion` contienen `<texto>` (case-insensitive)

### Requirement: Detalle de Incidente
El sistema SHALL exponer `GET /api/incidents/:id`.

#### Scenario: Incidente propio
- **WHEN** un usuario solicita `GET /api/incidents/:id` de un incidente de su empresa activa
- **THEN** el sistema responde 200 con el incidente completo, incluyendo `accionesCorrectivas` y `auditTrail`

#### Scenario: Incidente inexistente o de otra empresa
- **WHEN** el id no existe o pertenece a una empresa distinta a la activa
- **THEN** el sistema responde 404, nunca 403

### Requirement: Actualización de campos de investigación
El sistema SHALL exponer `PATCH /api/incidents/:id` para actualizar campos de investigación (parcial), registrando una entrada `CAMPO_EDITADO` en el audit trail. Los campos aceptados incluyen `condicionesEntorno`, `localId`, `zonaId`, `ubicacion`, `qeId`, `testigos`, `personalInvolucrado`, `equiposInvolucrados`, `atencionMedicaRequerida`, `atencionMedicaDescripcion`, `notificacionAmbientalRequerida`, y `evidencias` (URLs ya subidas vía `POST /api/incidents/evidencias`) — el formulario de escritorio (`IncidentForm.tsx`) permite adjuntar evidencia nueva tanto al crear como al editar el incidente, así que este endpoint también la acepta.

#### Scenario: Actualización parcial exitosa
- **WHEN** un usuario envía un subconjunto de campos de investigación a `PATCH /api/incidents/:id` de un incidente de su empresa
- **THEN** el sistema responde 200 con el incidente actualizado y una nueva entrada de audit trail

#### Scenario: Actualización de campos de atención médica y testigos
- **WHEN** un usuario envía `{ testigos: [...], personalInvolucrado: [...], equiposInvolucrados: [...], atencionMedicaRequerida: true, atencionMedicaDescripcion: '...', notificacionAmbientalRequerida: false }` a `PATCH /api/incidents/:id`
- **THEN** el sistema responde 200, persiste los seis campos y agrega una entrada `CAMPO_EDITADO` al audit trail

#### Scenario: Agregar una evidencia nueva durante la edición no duplica las ya existentes
- **WHEN** un usuario envía `{ evidencias: [...evidencias existentes del incidente, nuevaEvidencia] }` a `PATCH /api/incidents/:id` (el frontend siempre envía la lista completa, existentes + nuevas)
- **THEN** el sistema agrega únicamente la evidencia cuya `url` todavía no está persistida en el incidente, sin duplicar las ya existentes

### Requirement: Transición de estado validada server-side
El sistema SHALL exponer `PATCH /api/incidents/:id/status`, validando la transición contra la máquina de estados `ABIERTO → {EN_INVESTIGACION, ANULADO}`, `EN_INVESTIGACION → ANALISIS_COMPLETADO`, `ANALISIS_COMPLETADO → EN_EJECUCION`, `EN_EJECUCION → PENDIENTE_CIERRE`, `PENDIENTE_CIERRE → CERRADO`, `CERRADO → (terminal)`, `ANULADO → (terminal)`.

#### Scenario: Transición válida
- **WHEN** un incidente en `ABIERTO` recibe `PATCH /:id/status` con `{ estado: 'EN_INVESTIGACION' }`
- **THEN** el sistema responde 200, actualiza `estado` y agrega una entrada `ESTADO_CAMBIADO` con `estadoAnterior`/`estadoNuevo`

#### Scenario: Transición inválida
- **WHEN** un incidente en `ABIERTO` recibe `PATCH /:id/status` con `{ estado: 'CERRADO' }`
- **THEN** el sistema responde 422 sin modificar el incidente

### Requirement: Notificación best-effort tras transición de estado
El sistema SHALL calcular los destinatarios de notificación (reportante + responsables de acciones correctivas no cerradas, excluyendo al actor que hizo el cambio) tras cada transición de estado válida, sin bloquear la respuesta si el envío falla o si la infraestructura de notificaciones no está disponible.

#### Scenario: Transición válida con acciones correctivas abiertas
- **WHEN** un incidente con acciones correctivas en estado distinto de `CERRADA` cambia de estado exitosamente
- **THEN** el sistema calcula la lista de destinatarios (reportante + responsables, sin el actor) y delega el envío sin que un fallo de envío afecte el código de respuesta 200

### Requirement: Eliminación (soft-delete) solo en estado ABIERTO
El sistema SHALL exponer `DELETE /api/incidents/:id`, permitiendo la eliminación únicamente cuando `estado === 'ABIERTO'` y el incidente no esté ya eliminado.

#### Scenario: Eliminación válida
- **WHEN** un incidente en `ABIERTO` sin `deletedAt` recibe `DELETE /:id`
- **THEN** el sistema responde 200, marca `deletedAt` con la hora del servidor y agrega una entrada `ELIMINADO`

#### Scenario: Eliminación bloqueada por estado
- **WHEN** un incidente en un estado distinto de `ABIERTO` recibe `DELETE /:id`
- **THEN** el sistema responde 422 sin modificar el incidente

#### Scenario: Eliminación de un incidente ya eliminado
- **WHEN** un incidente con `deletedAt` ya definido recibe `DELETE /:id`
- **THEN** el sistema responde 422

### Requirement: Restauración de Incidente eliminado
El sistema SHALL exponer `PATCH /api/incidents/:id/restore`, permitido únicamente si el incidente tiene `deletedAt` definido.

#### Scenario: Restauración válida
- **WHEN** un incidente con `deletedAt` definido recibe `PATCH /:id/restore`
- **THEN** el sistema responde 200, limpia `deletedAt` y agrega una entrada `RESTAURADO`

#### Scenario: Restauración de un incidente no eliminado
- **WHEN** un incidente sin `deletedAt` recibe `PATCH /:id/restore`
- **THEN** el sistema responde 422

### Requirement: Creación de Acción Correctiva del Incidente
El sistema SHALL exponer `POST /api/incidents/:id/acciones`, requiriendo `titulo`, `descripcion`, `responsableId`, `plazoFecha` y `prioridad`, creando la acción en estado `PENDIENTE`.

#### Scenario: Creación exitosa
- **WHEN** un usuario envía un body válido a `POST /api/incidents/:id/acciones` de un incidente de su empresa
- **THEN** el sistema responde 201 con la acción correctiva creada y agrega una entrada `AC_CREADA` al audit trail del incidente

#### Scenario: Campos requeridos ausentes
- **WHEN** el body omite alguno de los campos requeridos
- **THEN** el sistema responde 400 con el detalle de los campos faltantes

### Requirement: Actualización de Acción Correctiva del Incidente
El sistema SHALL exponer `PATCH /api/incidents/:incidenteId/acciones/:acId` para actualización parcial de una acción correctiva existente.

#### Scenario: Actualización exitosa
- **WHEN** un usuario envía campos parciales a `PATCH /api/incidents/:incidenteId/acciones/:acId` de una acción existente
- **THEN** el sistema responde 200 con la acción actualizada

#### Scenario: Acción inexistente
- **WHEN** `:acId` no corresponde a ninguna acción del incidente indicado
- **THEN** el sistema responde 404

### Requirement: Aislamiento multi-tenant en Incidentes
El sistema SHALL filtrar todo acceso de lectura y escritura de Incidentes por `empresaId === empresaActivaId`, respondiendo 404 (nunca 403) ante cualquier recurso de otra empresa. En creaciones, `empresaId` se fija únicamente desde la sesión, salvo la única excepción documentada de `POST /api/incidents` con `empresaId` explícito en el body para sincronización offline, gateada por validación de membresía (ver Requirement "Creación de Incidente").

#### Scenario: Acceso cruzado a incidente de otra empresa
- **WHEN** un usuario con empresa activa `A` solicita cualquier operación sobre un incidente de la empresa `B`
- **THEN** el sistema responde 404, sin distinguir "no existe" de "pertenece a otra empresa"

### Requirement: Numeración correlativa por empresa
El sistema SHALL generar `numero` con formato `INC-<año>-NNN`, correlativo e independiente por cada empresa, sin duplicados incluso bajo creación concurrente.

#### Scenario: Segundo incidente del año para la misma empresa
- **WHEN** una empresa ya tiene un incidente `INC-2026-001` y crea uno nuevo el mismo año
- **THEN** el sistema asigna `INC-2026-002`

#### Scenario: Primer incidente del año para otra empresa
- **WHEN** una empresa distinta, sin incidentes previos ese año, crea su primer incidente
- **THEN** el sistema asigna `INC-2026-001` para esa empresa, independientemente del correlativo de otras empresas

### Requirement: Upload de evidencias de Incidente
El sistema SHALL exponer `POST /api/incidents/evidencias` (`multipart/form-data`, un archivo por request), requiriendo sesión autenticada con empresa activa resuelta, y SHALL responder con `{ url, nombre, tamanioKb }` de un archivo guardado server-side, sin asociarlo todavía a ningún incidente concreto. Tipos aceptados: JPEG, PNG, WEBP y PDF — la unión de los tipos permitidos por `mobileIncidentReportSchema` (JPEG/PNG/WEBP) e `incidentForm.schema.ts` del formulario de escritorio (JPEG/PNG/PDF), ya que este endpoint sirve a ambos formularios.

#### Scenario: Upload exitoso de una foto de evidencia
- **WHEN** un usuario con empresa activa envía un archivo de imagen válido a `POST /api/incidents/evidencias`
- **THEN** el sistema responde 201 con `{ url, nombre, tamanioKb }`, donde `url` es una ruta servible que devuelve el archivo subido

#### Scenario: Archivo de tipo no permitido
- **WHEN** el archivo enviado no es JPEG, PNG, WEBP ni PDF
- **THEN** el sistema responde 400 sin guardar el archivo

#### Scenario: Archivo excede el límite de tamaño
- **WHEN** el archivo enviado supera el límite de tamaño configurado (10 MB, igual que el límite ya validado en el formulario mobile)
- **THEN** el sistema responde 400 sin guardar el archivo

### Requirement: Cierre de Acción Correctiva del Incidente
El sistema SHALL exponer `PATCH /api/incidents/:incidenteId/acciones/:acId/cerrar`, requiriendo `descripcionEvidencia` (`evidenciaUrl` opcional), transicionando la acción correctiva a `estado: 'CERRADA'` mediante el mismo mecanismo de actualización que `PATCH /api/incidents/:incidenteId/acciones/:acId`.

#### Scenario: Cierre exitoso de una acción correctiva
- **WHEN** un usuario envía `{ descripcionEvidencia: '...' }` (con o sin `evidenciaUrl`) a `PATCH /api/incidents/:incidenteId/acciones/:acId/cerrar` de una acción existente
- **THEN** el sistema responde 200 con la acción actualizada, `estado: 'CERRADA'` y `descripcionEvidencia`/`evidenciaUrl` persistidos

#### Scenario: Cierre sin descripción de evidencia
- **WHEN** el body omite `descripcionEvidencia`
- **THEN** el sistema responde 400

#### Scenario: Cierre de una acción inexistente
- **WHEN** `:acId` no corresponde a ninguna acción del incidente indicado
- **THEN** el sistema responde 404
