# be-incidentes-api

## Purpose

Backend .NET del CRUD de Incidentes SyST (M3): creación con severidad auto-calculada server-side, detección de reporte tardío, listado paginado/filtrado, transición de estado validada contra la máquina de estados, notificaciones best-effort, soft-delete/restauración, acciones correctivas del incidente, y aislamiento multi-tenant estricto scoped por `empresaId` de la sesión activa.

## Requirements

### Requirement: Creación de Incidente
El sistema SHALL exponer `POST /api/incidents`, requiriendo `tipo`, `descripcion` (mínimo 20 caracteres), `areaId`, `turno`, `fechaEvento` y `huboLesionados`; `numPersonasAfectadas` es opcional. El sistema asigna `empresaId` desde la sesión activa, nunca desde el body (salvo el caso de sincronización offline descrito en el diseño del frontend, fuera de alcance de este backend).

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
- **WHEN** la sesión no tiene `empresaActivaId` resuelto
- **THEN** el sistema responde 401 y no crea el incidente

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
El sistema SHALL exponer `PATCH /api/incidents/:id` para actualizar campos de investigación (parcial), registrando una entrada `CAMPO_EDITADO` en el audit trail.

#### Scenario: Actualización parcial exitosa
- **WHEN** un usuario envía un subconjunto de campos de investigación a `PATCH /api/incidents/:id` de un incidente de su empresa
- **THEN** el sistema responde 200 con el incidente actualizado y una nueva entrada de audit trail

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
El sistema SHALL filtrar todo acceso de lectura y escritura de Incidentes por `empresaId === empresaActivaId`, respondiendo 404 (nunca 403) ante cualquier recurso de otra empresa, y fijando `empresaId` únicamente desde la sesión en las creaciones.

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
