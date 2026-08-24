## ADDED Requirements

### Requirement: Creación de Quality Event
El sistema SHALL exponer `POST /api/quality-events`, requiriendo `origen`, `tipo`, `severidad`, `areaId`, `descripcion`, `fechaHoraEvento`, `fechaHoraReporte`, `turno` y el campo específico exigido por el `origen` (`incidenteId` para `O1_INCIDENTE_CAMPO`, `ncId` para `O2_NC_DETECTADA`, `hallazgoCodigo` + `normativaVinculada` para `O3_HALLAZGO_AUDITORIA`, `reporteExternoRef` para `O4_REPORTE_EXTERNO`). El sistema asigna `empresaId` y `reportadoPorId` desde la sesión activa, nunca desde el body.

#### Scenario: Creación exitosa
- **WHEN** un usuario con empresa activa envía un body válido a `POST /api/quality-events`
- **THEN** el sistema responde 201 con el QE creado, `estado: 'ABIERTO'`, `ciclo: 1`, `numero` con formato `QE-<año>-NNN`, `accionesCorrectivas: []`, `solicitudesAC: 0` y una entrada de audit trail `CREADO`

#### Scenario: Campo requerido por origen ausente
- **WHEN** se crea un QE con `origen: 'O1_INCIDENTE_CAMPO'` sin `incidenteId` (o el equivalente para cualquier otro origen)
- **THEN** el sistema responde 400 sin crear el QE

#### Scenario: Origen O3 sin normativa vinculada
- **WHEN** se crea un QE con `origen: 'O3_HALLAZGO_AUDITORIA'` sin `normativaVinculada` (norma + cláusula)
- **THEN** el sistema responde 400, ignorando cualquier bypass intentado desde el cliente (RN-QE-010 validada server-side, no solo en el formulario)

#### Scenario: Sin empresa activa
- **WHEN** la sesión no tiene `empresaActivaId` resuelto
- **THEN** el sistema responde 401 y no crea el QE

### Requirement: Validación de origen Incidente/NC al crear
Cuando `origen` es `O1_INCIDENTE_CAMPO` o `O2_NC_DETECTADA`, el sistema SHALL validar que el `incidenteId`/`ncId` referenciado exista y pertenezca a la empresa activa, y que no esté ya vinculado a otro Quality Event (`Incidente.QeId`/`NoConformidad.QeGeneradoId` ya definido).

#### Scenario: Incidente inexistente o de otra empresa
- **WHEN** se crea un QE con `origen: 'O1_INCIDENTE_CAMPO'` e `incidenteId` que no existe o pertenece a otra empresa
- **THEN** el sistema responde 422 sin crear el QE

#### Scenario: Incidente ya vinculado a otro QE
- **WHEN** se crea un QE con `incidenteId` de un Incidente cuyo `QeId` ya está definido
- **THEN** el sistema responde 422 sin crear el QE

#### Scenario: NC ya vinculada a otro QE
- **WHEN** se crea un QE con `ncId` de una NC cuyo `QeGeneradoId` ya está definido
- **THEN** el sistema responde 422 sin crear el QE

### Requirement: Notificación best-effort de severidad crítica al crear (RN-QE-005)
El sistema SHALL invocar, tras crear un QE con `severidad === 'CRITICA'`, un notificador best-effort dirigido a Gerencia, sin bloquear la respuesta si el envío falla o no está implementado.

#### Scenario: QE de severidad CRITICA
- **WHEN** se crea un QE con `severidad: 'CRITICA'`
- **THEN** el sistema invoca el notificador best-effort y responde 201 independientemente del resultado de esa invocación

### Requirement: Numeración correlativa por empresa
El sistema SHALL generar `numero` con formato `QE-<año>-NNN`, correlativo por empresa activa y año calendario efectivo, sin duplicados incluso bajo creación concurrente.

#### Scenario: Segunda QE de la misma empresa en el año
- **WHEN** una empresa ya tiene `QE-2026-001` y crea otro QE el mismo año
- **THEN** el sistema asigna `QE-2026-002`

#### Scenario: Primera QE de una empresa distinta
- **WHEN** una empresa distinta, sin QEs previos ese año, crea su primer QE
- **THEN** el sistema asigna `QE-<año>-001` para esa empresa, independientemente del correlativo de otras empresas

### Requirement: Listado paginado y filtrado de Quality Events
El sistema SHALL exponer `GET /api/quality-events` con filtros `estado`, `tipo`, `severidad`, `origen`, `fechaDesde`/`fechaHasta`, `soloReincidencias` (`ciclo > 1`), `incluirEliminados`, `page`, `pageSize`, scoped a la empresa activa. La respuesta SHALL anidar el arreglo bajo `data.items` junto a `data.pagination`.

#### Scenario: Listado por defecto
- **WHEN** un usuario con empresa activa solicita `GET /api/quality-events` sin filtros
- **THEN** el sistema responde 200 con `{ items: QualityEvent[], pagination }`, excluyendo QEs con `deletedAt` definido y de otras empresas

#### Scenario: Filtro `soloReincidencias`
- **WHEN** se solicita `GET /api/quality-events?soloReincidencias=true`
- **THEN** el sistema retorna solo QEs con `ciclo > 1`

#### Scenario: Filtro `incluirEliminados`
- **WHEN** se solicita `GET /api/quality-events?incluirEliminados=true`
- **THEN** el sistema incluye también los QEs eliminados (soft-delete) de la empresa activa

### Requirement: Detalle de Quality Event
El sistema SHALL exponer `GET /api/quality-events/:id`.

#### Scenario: QE propio
- **WHEN** un usuario solicita `GET /api/quality-events/:id` de un QE de su empresa activa
- **THEN** el sistema responde 200 con el QE completo, incluyendo `accionesCorrectivas` (con sus `solicitudesAjustePlazo`)

#### Scenario: QE inexistente o de otra empresa
- **WHEN** el id no existe o pertenece a una empresa distinta a la activa
- **THEN** el sistema responde 404, nunca 403

### Requirement: Edición parcial con `descripcion` bloqueada fuera de ABIERTO
El sistema SHALL exponer `PATCH /api/quality-events/:id` para actualización parcial de los campos de `QualityEventUpdateInput` (`descripcion, areaId, turno, mineralInvolucrado, descripcionAmpliada, metodoAnalisis, cincoPorques, ishikawa, causaRaizDefinitiva, causaRaizAprobadaPorId, causaRaizFirmadaEn, resultadoCierre, plazoVerificacionDias, fechaVerificacionProgramada`), rechazando cualquier intento de incluir `estado` en el body. El sistema SHALL rechazar con 422 cualquier intento de modificar `descripcion` cuando `estado !== 'ABIERTO'` (RN-QE-006).

#### Scenario: Actualización parcial exitosa
- **WHEN** un usuario envía un subconjunto de campos permitidos a `PATCH /api/quality-events/:id` de un QE de su empresa
- **THEN** el sistema responde 200 con el QE actualizado y una nueva entrada de audit trail `CAMPO_EDITADO` por cada campo modificado

#### Scenario: Intento de editar `estado` vía PATCH genérico
- **WHEN** el body de `PATCH /:id` incluye `estado`
- **THEN** el sistema ignora ese campo o responde 400, y nunca cambia el `estado` por esta vía

#### Scenario: Edición de `descripcion` fuera de ABIERTO
- **WHEN** un QE en `estado !== 'ABIERTO'` recibe `PATCH /:id` con `descripcion` en el body
- **THEN** el sistema responde 422 sin modificar el QE

### Requirement: Transición de estado con máquina de estados server-side
El sistema SHALL exponer `PATCH /api/quality-events/:id/status`, validando que `(estadoActual, nuevoEstado)` sea una transición permitida: `ABIERTO→EN_INVESTIGACION`, `EN_INVESTIGACION→ANALISIS_COMPLETADO`, `ANALISIS_COMPLETADO→EN_EJECUCION`, `EN_EJECUCION→PENDIENTE_CIERRE`, `PENDIENTE_CIERRE→CERRADO`, `CERRADO→EN_VERIFICACION`, `EN_VERIFICACION→VERIFICADO` (además de la reapertura automática a `EN_INVESTIGACION`, ver requirement de Verificación de eficacia). Cualquier otra combinación SHALL responder 422.

#### Scenario: Transición válida
- **WHEN** un QE en `EN_INVESTIGACION` recibe `PATCH /:id/status { nuevoEstado: 'ANALISIS_COMPLETADO' }` y `solicitudesAC === 0`
- **THEN** el sistema responde 200 con `estado: 'ANALISIS_COMPLETADO'` y una entrada de audit trail `ESTADO_CAMBIADO`

#### Scenario: Transición inválida
- **WHEN** un QE en `ABIERTO` recibe `PATCH /:id/status { nuevoEstado: 'VERIFICADO' }`
- **THEN** el sistema responde 422 sin modificar el `estado`

### Requirement: RN-QE-002 — causa raíz definitiva y firmada antes de EN_EJECUCION
El sistema SHALL bloquear la transición `ANALISIS_COMPLETADO → EN_EJECUCION` con 422 si `causaRaizDefinitiva` está vacío o `causaRaizFirmadaEn` no está definido.

#### Scenario: Causa raíz incompleta
- **WHEN** un QE en `ANALISIS_COMPLETADO` sin `causaRaizDefinitiva` o sin `causaRaizFirmadaEn` recibe `PATCH /:id/status { nuevoEstado: 'EN_EJECUCION' }`
- **THEN** el sistema responde 422 con un mensaje legible referenciando RN-QE-002, sin modificar el `estado`

#### Scenario: Causa raíz completa
- **WHEN** un QE en `ANALISIS_COMPLETADO` con `causaRaizDefinitiva` no vacío y `causaRaizFirmadaEn` definido recibe la misma transición
- **THEN** el sistema responde 200 con `estado: 'EN_EJECUCION'`

### Requirement: RN-QE-009 — solicitudes de AC pendientes bloquean ANALISIS_COMPLETADO
El sistema SHALL bloquear la transición `EN_INVESTIGACION → ANALISIS_COMPLETADO` con 422 si `solicitudesAC > 0`.

#### Scenario: Con solicitudes de AC pendientes
- **WHEN** un QE en `EN_INVESTIGACION` con `solicitudesAC > 0` recibe `PATCH /:id/status { nuevoEstado: 'ANALISIS_COMPLETADO' }`
- **THEN** el sistema responde 422 sin modificar el `estado`

### Requirement: Solicitar Acción Correctiva en el Quality Event
El sistema SHALL exponer `PATCH /api/quality-events/:id/solicitar-ac`, incrementando `solicitudesAC` en 1.

#### Scenario: Solicitud registrada
- **WHEN** un usuario envía `PATCH /:id/solicitar-ac` sobre un QE de su empresa
- **THEN** el sistema responde 200 con `solicitudesAC` incrementado en 1

### Requirement: Eliminación (soft-delete) de Quality Event solo en estado ABIERTO
El sistema SHALL exponer `DELETE /api/quality-events/:id`, permitiendo la eliminación únicamente cuando `estado === 'ABIERTO'` y el QE no esté ya eliminado.

#### Scenario: Eliminación válida
- **WHEN** un QE en `ABIERTO` sin `deletedAt` recibe `DELETE /:id`
- **THEN** el sistema responde 200, marca `deletedAt` con la hora del servidor y agrega una entrada de audit trail `ELIMINADO`

#### Scenario: Eliminación bloqueada por estado
- **WHEN** un QE en un estado distinto de `ABIERTO` recibe `DELETE /:id`
- **THEN** el sistema responde 422 sin modificar el QE

#### Scenario: Eliminación de un QE ya eliminado
- **WHEN** un QE con `deletedAt` ya definido recibe `DELETE /:id`
- **THEN** el sistema responde 422

### Requirement: Reactivación de Quality Event eliminado, preservando el estado previo
El sistema SHALL exponer `PATCH /api/quality-events/:id/reactivar`, permitido únicamente si el QE tiene `deletedAt` definido, limpiando ese campo sin forzar `estado` a `ABIERTO`.

#### Scenario: Reactivación válida
- **WHEN** un QE con `deletedAt` definido y `estado: 'ABIERTO'` (único estado alcanzable por RN de eliminación) recibe `PATCH /:id/reactivar`
- **THEN** el sistema responde 200, limpia `deletedAt`, conserva `estado: 'ABIERTO'` y agrega una entrada de audit trail `REACTIVADO`

#### Scenario: Reactivación de un QE no eliminado
- **WHEN** un QE sin `deletedAt` recibe `PATCH /:id/reactivar`
- **THEN** el sistema responde 422

### Requirement: Edición del reporte inicial dentro de la ventana de 2 horas (RN-QE-014)
El sistema SHALL exponer `PATCH /api/quality-events/:id/editar-reporte-inicial`, permitido solo si `estado === 'ABIERTO'` y han transcurrido menos de 2 horas desde `fechaHoraReporte`, y solo por el reportante original o un `SUPERVISOR` cuya `areasAsignadas` incluya el `areaId` del QE. El sistema SHALL rechazar con 422 cualquier intento de modificar `numero, origen, tipo, fechaHoraReporte, reportadoPorId, severidad` por este endpoint, aceptando únicamente `descripcion, areaId, turno, fechaHoraEvento, mineralInvolucrado, incidenteId, ncId, hallazgoCodigo, normativaVinculada, reporteExternoRef`.

#### Scenario: Edición dentro de la ventana
- **WHEN** el reportante original edita `descripcion` menos de 2 horas después de `fechaHoraReporte`, con el QE aún en `ABIERTO`
- **THEN** el sistema responde 200 con el QE actualizado y una entrada de audit trail `REPORTE_INICIAL_EDITADO`

#### Scenario: Ventana vencida
- **WHEN** el mismo usuario intenta la misma edición más de 2 horas después de `fechaHoraReporte`
- **THEN** el sistema responde 422 sin modificar el QE

#### Scenario: Usuario sin permiso
- **WHEN** un usuario que no es el reportante ni un Supervisor del área del QE intenta editar el reporte inicial
- **THEN** el sistema responde 403

#### Scenario: Campo protegido en el body
- **WHEN** el body de `editar-reporte-inicial` incluye `severidad` (o cualquier otro campo protegido)
- **THEN** el sistema responde 422 sin modificar el QE

### Requirement: Edición de severidad, restringida a Jefe de Calidad
El sistema SHALL exponer `PATCH /api/quality-events/:id/editar-severidad`, permitido únicamente al rol `JEFE_CALIDAD_SYST`. Cuando la nueva severidad es `CRITICA`, el sistema SHALL invocar el mismo notificador best-effort usado en creación (RN-QE-005).

#### Scenario: Edición válida
- **WHEN** un `JEFE_CALIDAD_SYST` envía `PATCH /:id/editar-severidad` con una nueva severidad
- **THEN** el sistema responde 200 con la severidad actualizada y una entrada de audit trail `SEVERIDAD_EDITADA`

#### Scenario: Usuario sin rol autorizado
- **WHEN** un usuario con rol distinto de `JEFE_CALIDAD_SYST` intenta editar la severidad
- **THEN** el sistema responde 403 sin modificar el QE

### Requirement: Edición de mineral, restringida a Jefe de Calidad y tipos CALIDAD/OPERACIONAL
El sistema SHALL exponer `PATCH /api/quality-events/:id/editar-mineral`, permitido únicamente al rol `JEFE_CALIDAD_SYST` y solo cuando `tipo` del QE es `CALIDAD` u `OPERACIONAL`.

#### Scenario: Edición válida
- **WHEN** un `JEFE_CALIDAD_SYST` envía `PATCH /:id/editar-mineral` sobre un QE de tipo `CALIDAD`
- **THEN** el sistema responde 200 con `mineralInvolucrado` actualizado

#### Scenario: Tipo no aplicable
- **WHEN** se envía `PATCH /:id/editar-mineral` sobre un QE de tipo `SST` o `ADUANERO`
- **THEN** el sistema responde 422 sin modificar el QE

### Requirement: Cierre del Quality Event bloqueado si hay ACs sin cerrar (RN-QE-003)
El sistema SHALL exponer `PATCH /api/quality-events/:id/cerrar`, requiriendo `resultadoCierre` (100-500 caracteres) y `plazoVerificacionDias` (default 60), rechazando con 422 si alguna acción correctiva del QE tiene `estado !== 'CERRADA'` o no tiene `descripcionEvidencia`.

#### Scenario: Cierre bloqueado por AC pendiente
- **WHEN** un QE con al menos una acción correctiva en `PENDIENTE` o `EN_EJECUCION` recibe `PATCH /:id/cerrar`
- **THEN** el sistema responde 422 sin modificar el QE

#### Scenario: Primer paso de cierre exitoso
- **WHEN** un QE con todas sus acciones correctivas `CERRADA` y con evidencia recibe `PATCH /:id/cerrar` con un body válido
- **THEN** el sistema responde 200, registra `resultadoCierre`/`plazoVerificacionDias` y agrega una entrada de audit trail, quedando pendiente de firma dual

### Requirement: Firma dual de cierre
El sistema SHALL exponer `PATCH /api/quality-events/:id/firmar-cierre`, requiriendo dos firmas (`rol`, `pin`): la primera de `JEFE_CALIDAD_SYST`, la segunda del rol resuelto por `ResolverRolSegundaFirma`, que SHALL devolver siempre `'SUPERVISOR'` (RN-QE-004 reconciliada: la escalada a `ALTA_DIRECCION` por mismo firmante no se implementa, por ser estructuralmente inalcanzable bajo el modelo de un rol por usuario). El sistema SHALL rechazar una segunda firma del mismo usuario que ya firmó como Jefe de Calidad.

#### Scenario: Primera firma
- **WHEN** un `JEFE_CALIDAD_SYST` firma `PATCH /:id/firmar-cierre` sobre un QE con cierre iniciado
- **THEN** el sistema responde 200, registra `cerradoPorId`, y el QE permanece sin `estado: 'CERRADO'` hasta la segunda firma

#### Scenario: Segunda firma completa el cierre
- **WHEN** un `SUPERVISOR` firma tras la primera firma de Jefe de Calidad
- **THEN** el sistema responde 200 con `estado: 'CERRADO'` y, si `severidad` es `ALTA` o `CRITICA`, invoca el notificador best-effort a Gerencia

#### Scenario: Doble firma del mismo usuario
- **WHEN** el mismo usuario que ya firmó como Jefe de Calidad intenta firmar la segunda firma
- **THEN** el sistema responde 422 sin completar el cierre

### Requirement: Verificación de eficacia con reapertura automática (RN-QE-007)
El sistema SHALL exponer `POST /api/quality-events/:id/verificacion-eficacia`, requiriendo `resultado` (`EFECTIVO`|`NO_EFECTIVO`) y `evidencia`. Cuando `resultado === 'EFECTIVO'`, el sistema SHALL transicionar a `VERIFICADO` (invocando el notificador best-effort si `severidad` es `ALTA` o `CRITICA`). Cuando `resultado === 'NO_EFECTIVO'`, el sistema SHALL reabrir el QE: `estado → 'EN_INVESTIGACION'`, `ciclo` incrementado en 1, conservando el historial completo (audit trail y acciones correctivas previas intactos), con una entrada de audit trail `accion: 'REABIERTO'` y `campoModificado: 'motivo'`/`valorNuevo: 'NO_EFECTIVO'`.

#### Scenario: Verificación efectiva
- **WHEN** se envía `POST /:id/verificacion-eficacia { resultado: 'EFECTIVO', evidencia }` sobre un QE en `EN_VERIFICACION`
- **THEN** el sistema responde 200 con `estado: 'VERIFICADO'`

#### Scenario: Verificación no efectiva reabre el ciclo
- **WHEN** se envía `POST /:id/verificacion-eficacia { resultado: 'NO_EFECTIVO', evidencia }` sobre un QE en `EN_VERIFICACION` con `ciclo: 1`
- **THEN** el sistema responde 200 con `estado: 'EN_INVESTIGACION'`, `ciclo: 2`, y el historial previo (audit trail, acciones correctivas) permanece inalterado

### Requirement: Reapertura por vencimiento de verificación (utilidad dev-only)
El sistema SHALL exponer `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion`, disponible únicamente en entorno de desarrollo (`IsDevelopment()`), aplicando la misma reapertura que una verificación `NO_EFECTIVO` con `valorNuevo: 'VENCIMIENTO_PLAZO'` en la entrada de audit trail.

#### Scenario: Forzado en desarrollo
- **WHEN** se envía `PATCH /:id/forzar-vencimiento-verificacion` en un entorno de desarrollo sobre un QE en `EN_VERIFICACION`
- **THEN** el sistema responde 200 con `estado: 'EN_INVESTIGACION'` y `ciclo` incrementado

#### Scenario: Bloqueado fuera de desarrollo
- **WHEN** se envía el mismo request en un entorno que no es de desarrollo
- **THEN** el sistema responde 404 (endpoint no expuesto)

### Requirement: Exportación de PDF registra auditoría, sin generar el archivo
El sistema SHALL exponer `POST /api/quality-events/:id/export-pdf`, registrando una entrada de audit trail `EXPORTADO_PDF` sin generar ningún archivo — la generación del PDF es responsabilidad exclusiva del frontend.

#### Scenario: Registro de exportación
- **WHEN** un usuario envía `POST /:id/export-pdf` sobre un QE de su empresa
- **THEN** el sistema responde 200 (o 204) y agrega una entrada de audit trail `EXPORTADO_PDF`, sin devolver ningún binario

### Requirement: Consulta de audit trail
El sistema SHALL exponer `GET /api/quality-events/:id/audit-trail`, retornando las entradas ordenadas descendentemente por `timestamp`.

#### Scenario: Consulta de historial
- **WHEN** un usuario solicita `GET /:id/audit-trail` de un QE de su empresa
- **THEN** el sistema responde 200 con el arreglo de entradas ordenado del más reciente al más antiguo

### Requirement: Creación de Acción Correctiva del Quality Event
El sistema SHALL exponer `POST /api/quality-events/:id/acciones-correctivas`, creando la acción en estado `PENDIENTE`.

#### Scenario: Creación exitosa
- **WHEN** un usuario envía un body válido a `POST /:id/acciones-correctivas`
- **THEN** el sistema responde 201 con la acción creada (`estado: 'PENDIENTE'`) y agrega una entrada `AC_CREADA` al audit trail del QE

### Requirement: Actualización de Acción Correctiva del Quality Event
El sistema SHALL exponer `PATCH /api/quality-events/:id/acciones-correctivas/:acId` para actualización parcial.

#### Scenario: Actualización exitosa
- **WHEN** un usuario envía campos parciales a `PATCH /:id/acciones-correctivas/:acId` de una acción existente
- **THEN** el sistema responde 200 con la acción actualizada y una entrada `AC_ACTUALIZADA` en el audit trail del QE

#### Scenario: Acción inexistente
- **WHEN** `:acId` no corresponde a ninguna acción del QE indicado
- **THEN** el sistema responde 404

### Requirement: Cambio de estado de Acción Correctiva, incluyendo cierre con evidencia
El sistema SHALL exponer `PATCH /api/quality-events/:id/acciones-correctivas/:acId/status`. Cuando el body cambia `estado` a `CERRADA`, el sistema SHALL requerir `descripcionEvidencia` no vacía y fijar `fechaCierre` con la hora del servidor. Cuando todas las acciones correctivas del QE quedan `CERRADA` con evidencia y el QE está en `EN_EJECUCION`, el sistema SHALL transicionar automáticamente el QE a `PENDIENTE_CIERRE`.

#### Scenario: Cierre de AC con evidencia
- **WHEN** se envía `PATCH .../status { estado: 'CERRADA', descripcionEvidencia: '<texto>' }`
- **THEN** el sistema responde 200 con `estado: 'CERRADA'`, `fechaCierre` con un ISO 8601 no vacío, y agrega `AC_CERRADA` al audit trail del QE

#### Scenario: Cierre sin evidencia
- **WHEN** se envía `PATCH .../status { estado: 'CERRADA' }` sin `descripcionEvidencia`
- **THEN** el sistema responde 400 sin modificar la acción

#### Scenario: Última AC cerrada transiciona el QE
- **WHEN** la última acción correctiva pendiente de un QE en `EN_EJECUCION` se cierra con evidencia
- **THEN** el sistema transiciona automáticamente el QE a `estado: 'PENDIENTE_CIERRE'`

### Requirement: Solicitud de ajuste de plazo de Acción Correctiva con plazos por severidad
El sistema SHALL exponer `POST /api/quality-events/:id/acciones-correctivas/:acId/solicitud-plazo`, requiriendo `fechaSolicitada` y `justificacion` (mínimo 50 caracteres). El sistema SHALL rechazar con 422 si el plazo total resultante (desde la creación de la AC) es menor al mínimo de días hábiles según la severidad del QE (`BAJA: 15, MEDIA: 10, ALTA: 5, CRITICA: 2`). El sistema SHALL calcular `requiereAprobacionGerencia`: siempre `true` para `CRITICA`; para `ALTA`, `true` solo si el incremento en días hábiles respecto al plazo actual supera el 50% del plazo sugerido (10 días hábiles → > 5); `false` para `BAJA`/`MEDIA`.

#### Scenario: Solicitud dentro del mínimo permitido
- **WHEN** se solicita un ajuste de plazo cuyo total resultante cumple el mínimo de días hábiles de la severidad del QE
- **THEN** el sistema responde 201 con la solicitud en `estado: 'PENDIENTE'` y `requiereAprobacionGerencia` calculado según la tabla

#### Scenario: Solicitud por debajo del mínimo
- **WHEN** el plazo total resultante es menor al mínimo de días hábiles de la severidad del QE
- **THEN** el sistema responde 422 sin crear la solicitud

#### Scenario: Severidad CRITICA siempre requiere Gerencia
- **WHEN** se solicita cualquier ajuste de plazo sobre una AC de un QE con `severidad: 'CRITICA'`
- **THEN** `requiereAprobacionGerencia` es `true` sin importar el incremento solicitado

### Requirement: Revisión (aprobación/rechazo) de solicitud de ajuste de plazo
El sistema SHALL exponer `PATCH /api/quality-events/:id/acciones-correctivas/:acId/solicitud-plazo/:solicitudId`, permitiendo cambiar `estado` a `APROBADA` o `RECHAZADA`. Al aprobar, el sistema SHALL actualizar `plazoFecha` de la acción correctiva con `fechaSolicitada`.

#### Scenario: Aprobación
- **WHEN** se envía `PATCH .../solicitud-plazo/:solicitudId { estado: 'APROBADA' }`
- **THEN** el sistema responde 200, actualiza `plazoFecha` de la AC con la fecha solicitada, y registra `revisadoPorId`/`revisadoEn`

#### Scenario: Rechazo
- **WHEN** se envía `PATCH .../solicitud-plazo/:solicitudId { estado: 'RECHAZADA', comentarioRevision }`
- **THEN** el sistema responde 200 sin modificar `plazoFecha` de la AC

### Requirement: Vinculación con el Incidente de origen
El sistema SHALL aceptar `QeId` en `PATCH /api/incidents/:id` (comando de actualización de investigación de Incidentes), permitiendo que el frontend complete la vinculación inversa tras crear un Quality Event con `origen: 'O1_INCIDENTE_CAMPO'`.

#### Scenario: Vinculación inversa
- **WHEN** se envía `PATCH /api/incidents/:id { qeId: '<id-del-qe-creado>' }` sobre un Incidente de la misma empresa
- **THEN** el sistema responde 200 con `Incidente.QeId` actualizado

### Requirement: Vinculación con la No Conformidad de origen
El sistema SHALL aceptar `QeGeneradoId` en `PATCH /api/nonconformities/:id` (comando de actualización de No Conformidad), permitiendo que el frontend complete la vinculación inversa tras crear un Quality Event con `origen: 'O2_NC_DETECTADA'`.

#### Scenario: Vinculación inversa
- **WHEN** se envía `PATCH /api/nonconformities/:id { qeGeneradoId: '<id-del-qe-creado>' }` sobre una No Conformidad de la misma empresa
- **THEN** el sistema responde 200 con `NoConformidad.QeGeneradoId` actualizado

### Requirement: Aislamiento multi-tenant en Quality Events
El sistema SHALL filtrar todo acceso de lectura y escritura de Quality Events (y sus acciones correctivas y solicitudes de ajuste de plazo) por `empresaId === empresaActivaId`, respondiendo 404 (nunca 403) ante cualquier recurso de otra empresa, y fijando `empresaId` únicamente desde la sesión en las creaciones.

#### Scenario: Acceso cruzado a QE de otra empresa
- **WHEN** un usuario con empresa activa `A` solicita cualquier operación sobre un QE de la empresa `B`
- **THEN** el sistema responde 404, sin distinguir "no existe" de "pertenece a otra empresa"

#### Scenario: Acceso cruzado a acción correctiva vía QE de otra empresa
- **WHEN** un usuario con empresa activa `A` solicita una operación sobre una acción correctiva cuyo QE padre pertenece a la empresa `B`
- **THEN** el sistema responde 404, igual que si el QE no existiera
