## ADDED Requirements

### Requirement: Creación de No Conformidad
El sistema SHALL exponer `POST /api/nonconformities`, requiriendo `origen`, `tipo`, `severidad`, `areaId`, `descripcion`, `fechaDeteccion`, `dominio`, `titulo` y `fechaCierre` (fecha límite esperada de cierre). El sistema asigna `empresaId` desde la sesión activa, nunca desde el body.

#### Scenario: Creación exitosa
- **WHEN** un usuario con empresa activa envía un body válido a `POST /api/nonconformities`
- **THEN** el sistema responde 201 con la NC creada, `estado: 'ABIERTA'`, `numero` con formato `NC-<DOM>-<año>-NNN`, `accionesCorrectivas: []` y una entrada de audit trail `CREADA`

#### Scenario: Campos requeridos ausentes
- **WHEN** el body de `POST /api/nonconformities` omite alguno de los campos requeridos
- **THEN** el sistema responde 400 con el detalle de los campos faltantes

#### Scenario: Sin empresa activa
- **WHEN** la sesión no tiene `empresaActivaId` resuelto
- **THEN** el sistema responde 401 y no crea la NC

### Requirement: `requiereIPER` calculado server-side (RN-NC-001)
El sistema SHALL calcular `requiereIPER` en el servidor como `true` cuando `dominio === 'SST'` y `false` en cualquier otro caso, ignorando cualquier valor de `requiereIPER` enviado por el cliente. No se crea ningún Quality Event automáticamente — el módulo QE no existe en este backend.

#### Scenario: NC de dominio SST
- **WHEN** se crea una NC con `dominio: 'SST'`
- **THEN** el sistema asigna `requiereIPER: true` sin importar el valor enviado en el body

#### Scenario: NC de dominio distinto de SST
- **WHEN** se crea una NC con `dominio` distinto de `'SST'`
- **THEN** el sistema asigna `requiereIPER: false`, incluso si el cliente envía `requiereIPER: true`

### Requirement: Numeración correlativa por empresa y dominio
El sistema SHALL generar `numero` con formato `NC-<DOM>-<año>-NNN`, donde `<DOM>` es el prefijo del dominio (`CALIDAD→CAL`, `SST→SST`, `ADUANERO→ADU`, `OPERACIONAL→OPE`, `PROVEEDOR→PRV`), correlativo e independiente por cada combinación `(empresaId, dominio)`, sin duplicados incluso bajo creación concurrente.

#### Scenario: Segunda NC del mismo dominio para la misma empresa
- **WHEN** una empresa ya tiene una NC `NC-CAL-2026-001` y crea otra NC de dominio `CALIDAD` el mismo año
- **THEN** el sistema asigna `NC-CAL-2026-002`

#### Scenario: Primera NC de un dominio distinto para la misma empresa
- **WHEN** una empresa tiene NCs de dominio `CALIDAD` pero ninguna de dominio `SST`
- **THEN** su primera NC de dominio `SST` recibe `NC-SST-<año>-001`, independientemente del correlativo de `CALIDAD`

#### Scenario: Primera NC de una empresa distinta
- **WHEN** una empresa distinta, sin NCs previas ese año en ese dominio, crea su primera NC
- **THEN** el sistema asigna `NC-<DOM>-<año>-001` para esa empresa, independientemente del correlativo de otras empresas

### Requirement: Detección de posibles duplicados (RN-NC-005)
El sistema SHALL, al crear una NC sin `forzar: true` en el body, buscar otras NCs de la misma empresa con el mismo `dominio` y `areaId`, creadas (`creadoEn`) dentro de los últimos 30 días. Si existen coincidencias, la NC SHALL crearse igualmente (201) pero la respuesta SHALL incluir `warning: "POSIBLE_DUPLICADO"` y `ncsSimilares` con las NCs encontradas. Cuando `forzar: true`, el sistema SHALL omitir esta verificación.

#### Scenario: Duplicado potencial detectado
- **WHEN** se crea una NC con `dominio`/`areaId` iguales a otra NC de la misma empresa creada hace menos de 30 días, sin `forzar`
- **THEN** el sistema responde 201 con `warning: 'POSIBLE_DUPLICADO'` y `ncsSimilares` no vacío

#### Scenario: Sin duplicado reciente
- **WHEN** no existe ninguna NC de la misma empresa con el mismo `dominio`/`areaId` creada en los últimos 30 días
- **THEN** la respuesta no incluye el campo `warning`

#### Scenario: Creación forzada omite la detección
- **WHEN** se crea una NC con `forzar: true`, aun existiendo coincidencias recientes de `dominio`/`areaId`
- **THEN** la respuesta no incluye `warning` ni `ncsSimilares`

#### Scenario: No hay falso positivo entre empresas distintas
- **WHEN** existe una NC con el mismo `dominio`/`areaId` creada hace menos de 30 días pero en otra empresa
- **THEN** el sistema no la considera para la detección de duplicados de la empresa activa

### Requirement: Notificación best-effort a Comercio Exterior (RN-NC-002)
El sistema SHALL invocar, tras crear una NC con `dominio === 'ADUANERO'`, un notificador best-effort que registra la necesidad de notificar a Comercio Exterior, sin bloquear la respuesta si el envío falla o no está implementado. El campo `notificacionComercioExterior` de la NC creada SHALL quedar `null` hasta que exista un flujo real de envío.

#### Scenario: NC de dominio ADUANERO
- **WHEN** se crea una NC con `dominio: 'ADUANERO'`
- **THEN** el sistema invoca el notificador best-effort y responde 201 independientemente del resultado de esa invocación

### Requirement: Listado paginado y filtrado de No Conformidades
El sistema SHALL exponer `GET /api/nonconformities` con filtros `estado`, `tipo`, `severidad`, `dominio`, `areaId`, `search` (sobre `numero`/`descripcion`), `fechaDesde`/`fechaHasta` (sobre `fechaDeteccion`), `showDeleted`, `page`, `pageSize`, scoped a la empresa activa. La respuesta SHALL anidar el arreglo bajo `data.items` junto a `data.pagination`, no `data` como arreglo directo.

#### Scenario: Listado por defecto
- **WHEN** un usuario con empresa activa solicita `GET /api/nonconformities` sin filtros
- **THEN** el sistema responde 200 con `{ items: NoConformidad[], pagination }`, excluyendo NCs con `deletedAt` definido y de otras empresas

#### Scenario: Filtro `showDeleted`
- **WHEN** se solicita `GET /api/nonconformities?showDeleted=true`
- **THEN** el sistema incluye también las NCs eliminadas (soft-delete) de la empresa activa

#### Scenario: Búsqueda por texto
- **WHEN** se solicita `GET /api/nonconformities?search=<texto>`
- **THEN** el sistema retorna solo NCs cuyo `numero` o `descripcion` contienen `<texto>` (case-insensitive)

### Requirement: Detalle de No Conformidad
El sistema SHALL exponer `GET /api/nonconformities/:id`.

#### Scenario: NC propia
- **WHEN** un usuario solicita `GET /api/nonconformities/:id` de una NC de su empresa activa
- **THEN** el sistema responde 200 con la NC completa, incluyendo `accionesCorrectivas` y `auditTrail`

#### Scenario: NC inexistente o de otra empresa
- **WHEN** el id no existe o pertenece a una empresa distinta a la activa
- **THEN** el sistema responde 404, nunca 403

### Requirement: Edición parcial bloqueada en estados terminales
El sistema SHALL exponer `PATCH /api/nonconformities/:id` para actualización parcial, rechazando la operación con 409 cuando `estado` sea `CERRADA` o `ANULADA`. Cada campo modificado SHALL generar una entrada de audit trail `CAMPO_EDITADO`. Cuando el body cambia `estado`, el sistema SHALL calcular los destinatarios de notificación (reportante + responsables de acciones correctivas no cerradas, excluyendo al actor) de forma best-effort, sin bloquear la respuesta.

#### Scenario: Actualización parcial exitosa
- **WHEN** un usuario envía un subconjunto de campos a `PATCH /api/nonconformities/:id` de una NC de su empresa en un estado no terminal
- **THEN** el sistema responde 200 con la NC actualizada y una nueva entrada de audit trail por cada campo modificado

#### Scenario: Edición bloqueada por estado CERRADA
- **WHEN** una NC en `estado: 'CERRADA'` recibe `PATCH /:id`
- **THEN** el sistema responde 409 sin modificar la NC

#### Scenario: Edición bloqueada por estado ANULADA
- **WHEN** una NC en `estado: 'ANULADA'` recibe `PATCH /:id`
- **THEN** el sistema responde 409 sin modificar la NC

#### Scenario: Cambio de estado dispara notificación best-effort
- **WHEN** `PATCH /:id` cambia `estado` a un valor distinto del actual
- **THEN** el sistema calcula la lista de destinatarios (reportante + responsables de ACs no cerradas, sin el actor) sin que un fallo de envío afecte el código de respuesta 200

### Requirement: Anulación de No Conformidad
El sistema SHALL exponer `POST /api/nonconformities/:id/anular`, requiriendo `justificacion` no vacía, cambiando `estado` a `ANULADA` y agregando una entrada de audit trail `ANULADA` con `valorNuevo` igual a la justificación.

#### Scenario: Anulación exitosa
- **WHEN** un usuario envía `{ justificacion: '<motivo>' }` a `POST /api/nonconformities/:id/anular` de una NC de su empresa
- **THEN** el sistema responde 200 con `estado: 'ANULADA'` y la nueva entrada de audit trail

#### Scenario: Justificación ausente o vacía
- **WHEN** el body de `POST /:id/anular` omite `justificacion` o la envía vacía
- **THEN** el sistema responde 400 sin modificar la NC

### Requirement: Eliminación (soft-delete) de No Conformidad solo en estado ABIERTA
El sistema SHALL exponer `DELETE /api/nonconformities/:id`, permitiendo la eliminación únicamente cuando `estado === 'ABIERTA'` y la NC no esté ya eliminada.

#### Scenario: Eliminación válida
- **WHEN** una NC en `ABIERTA` sin `deletedAt` recibe `DELETE /:id`
- **THEN** el sistema responde 200, marca `deletedAt` con la hora del servidor y agrega una entrada de audit trail `ELIMINADA`

#### Scenario: Eliminación bloqueada por estado
- **WHEN** una NC en un estado distinto de `ABIERTA` recibe `DELETE /:id`
- **THEN** el sistema responde 422 sin modificar la NC

#### Scenario: Eliminación de una NC ya eliminada
- **WHEN** una NC con `deletedAt` ya definido recibe `DELETE /:id`
- **THEN** el sistema responde 422

### Requirement: Restauración de No Conformidad eliminada
El sistema SHALL exponer `PATCH /api/nonconformities/:id/restore`, permitido únicamente si la NC tiene `deletedAt` definido.

#### Scenario: Restauración válida
- **WHEN** una NC con `deletedAt` definido recibe `PATCH /:id/restore`
- **THEN** el sistema responde 200, limpia `deletedAt` y agrega una entrada de audit trail `RESTAURADA`

#### Scenario: Restauración de una NC no eliminada
- **WHEN** una NC sin `deletedAt` recibe `PATCH /:id/restore`
- **THEN** el sistema responde 422

### Requirement: Creación de Acción Correctiva de la No Conformidad
El sistema SHALL exponer `POST /api/nonconformities/:id/acciones-correctivas`, requiriendo `titulo`, `descripcion`, `responsableId`, `plazoFecha` y `prioridad`, creando la acción en estado `PENDIENTE` con `responsableNombre` resuelto server-side desde `responsableId`.

#### Scenario: Creación exitosa
- **WHEN** un usuario envía un body válido a `POST /api/nonconformities/:id/acciones-correctivas` de una NC de su empresa
- **THEN** el sistema responde 201 con la acción correctiva creada (`estado: 'PENDIENTE'`) y agrega una entrada `AC_CREADA` al audit trail de la NC

#### Scenario: Campos requeridos ausentes
- **WHEN** el body omite alguno de los campos requeridos
- **THEN** el sistema responde 400 con el detalle de los campos faltantes

### Requirement: Actualización de Acción Correctiva de la No Conformidad
El sistema SHALL exponer `PATCH /api/nonconformities/:ncId/acciones-correctivas/:acId` para actualización parcial de una acción correctiva existente, registrando una entrada `AC_ACTUALIZADA` en el audit trail de la NC. Cuando el body modifica `plazoFecha` sobre una acción cuyo `plazoFecha` anterior ya estaba vencido respecto a la hora del servidor al momento del PATCH, el sistema SHALL registrar ese hecho en la entrada de audit trail (RN-NC-006, extensión de plazo sobre AC vencida).

#### Scenario: Actualización exitosa
- **WHEN** un usuario envía campos parciales a `PATCH /api/nonconformities/:ncId/acciones-correctivas/:acId` de una acción existente
- **THEN** el sistema responde 200 con la acción actualizada y una nueva entrada `AC_ACTUALIZADA` en el audit trail de la NC

#### Scenario: Acción inexistente
- **WHEN** `:acId` no corresponde a ninguna acción de la NC indicada
- **THEN** el sistema responde 404

### Requirement: Cierre de Acción Correctiva de la No Conformidad
El sistema SHALL exponer `POST /api/nonconformities/:ncId/acciones-correctivas/:acId/cerrar`, requiriendo `descripcionEvidencia` no vacía (`evidenciaUrl` opcional), fijando `estado: 'CERRADA'`, `fechaCierre` con la hora del servidor, y agregando una entrada `AC_CERRADA` al audit trail de la NC.

#### Scenario: Cierre exitoso
- **WHEN** un usuario envía `{ descripcionEvidencia: '<texto>' }` a `POST /.../acciones-correctivas/:acId/cerrar` de una acción de su empresa
- **THEN** el sistema responde 200 con `estado: 'CERRADA'` y `fechaCierre` con un ISO 8601 no vacío

#### Scenario: Evidencia ausente o vacía
- **WHEN** el body omite `descripcionEvidencia` o la envía vacía
- **THEN** el sistema responde 400 sin modificar la acción

### Requirement: Aislamiento multi-tenant en No Conformidades
El sistema SHALL filtrar todo acceso de lectura y escritura de No Conformidades (y sus acciones correctivas) por `empresaId === empresaActivaId`, respondiendo 404 (nunca 403) ante cualquier recurso de otra empresa, y fijando `empresaId` únicamente desde la sesión en las creaciones. Las acciones correctivas no tienen `empresaId` propio — su aislamiento se hereda exclusivamente de la NC padre.

#### Scenario: Acceso cruzado a NC de otra empresa
- **WHEN** un usuario con empresa activa `A` solicita cualquier operación sobre una NC de la empresa `B`
- **THEN** el sistema responde 404, sin distinguir "no existe" de "pertenece a otra empresa"

#### Scenario: Acceso cruzado a acción correctiva vía NC de otra empresa
- **WHEN** un usuario con empresa activa `A` solicita una operación sobre una acción correctiva cuya NC padre pertenece a la empresa `B`
- **THEN** el sistema responde 404, igual que si la NC no existiera
