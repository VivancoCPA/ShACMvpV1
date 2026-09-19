## MODIFIED Requirements

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

### Requirement: Aislamiento multi-tenant en Incidentes
El sistema SHALL filtrar todo acceso de lectura y escritura de Incidentes por `empresaId === empresaActivaId`, respondiendo 404 (nunca 403) ante cualquier recurso de otra empresa. En creaciones, `empresaId` se fija únicamente desde la sesión, salvo la única excepción documentada de `POST /api/incidents` con `empresaId` explícito en el body para sincronización offline, gateada por validación de membresía (ver Requirement "Creación de Incidente").

#### Scenario: Acceso cruzado a incidente de otra empresa
- **WHEN** un usuario con empresa activa `A` solicita cualquier operación sobre un incidente de la empresa `B`
- **THEN** el sistema responde 404, sin distinguir "no existe" de "pertenece a otra empresa"

## ADDED Requirements

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
