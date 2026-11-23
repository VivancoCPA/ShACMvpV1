# be-quality-events-api

## Purpose

Backend .NET del núcleo Quality Event (M4): creación con validación de campo específico por `origen` (incidente/NC/hallazgo de auditoría/reporte externo), máquina de estados server-side con las reglas de negocio RN-QE-002/003/004/005/006/007/009/010/014, numeración correlativa por empresa y año, firma dual de cierre, verificación de eficacia con reapertura automática de ciclo, gestión de acciones correctivas y solicitudes de ajuste de plazo por severidad, vinculación inversa con Incidente/No Conformidad de origen, y aislamiento multi-tenant estricto scoped por `empresaId` de la sesión activa.
## Requirements

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
El sistema SHALL exponer `GET /api/quality-events` con filtros `estado`, `tipo`, `severidad`, `origen`, `fechaDesde`/`fechaHasta`, `soloReincidencias` (`ciclo > 1`), `incluirEliminados`, `search` (subcadena, sin distinción de mayúsculas, sobre `numero` y `descripcion`), `page`, `pageSize`, scoped a la empresa activa. La respuesta SHALL anidar el arreglo bajo `data.items` junto a `data.pagination`. Ningún elemento de `data.items` incluye el resumen de `documentosVinculados` poblado (queda `[]`) — evita N+1 consultas en listados paginados.

#### Scenario: Listado por defecto
- **WHEN** un usuario con empresa activa solicita `GET /api/quality-events` sin filtros
- **THEN** el sistema responde 200 con `{ items: QualityEvent[], pagination }`, excluyendo QEs con `deletedAt` definido y de otras empresas

#### Scenario: Filtro `soloReincidencias`
- **WHEN** se solicita `GET /api/quality-events?soloReincidencias=true`
- **THEN** el sistema retorna solo QEs con `ciclo > 1`

#### Scenario: Filtro `incluirEliminados`
- **WHEN** se solicita `GET /api/quality-events?incluirEliminados=true`
- **THEN** el sistema incluye también los QEs eliminados (soft-delete) de la empresa activa

#### Scenario: Filtro `search` por número o descripción
- **WHEN** se solicita `GET /api/quality-events?search=corros`
- **THEN** el sistema retorna solo QEs cuyo `numero` o `descripcion` contiene "corros" (sin distinción de mayúsculas), scoped a la empresa activa

### Requirement: Detalle de Quality Event
El sistema SHALL exponer `GET /api/quality-events/:id`. La respuesta SHALL incluir `documentosVinculados` poblado con el resumen `{ id, codigo, titulo, estado }` de cada `Documento` vinculado, consultado desde la tabla puente `DocumentoQualityEvent` (ver `documento-qe-vinculacion`). La respuesta SHALL incluir además `siguientePaso`, calculado por `QESiguientePasoResolver` (ver `quality-event-siguiente-paso`). `siguientePaso` SHALL ser exclusivo del detalle: `GET /api/quality-events` (listado) y los endpoints de escritura no lo devuelven.

#### Scenario: QE propio
- **WHEN** un usuario solicita `GET /api/quality-events/:id` de un QE de su empresa activa
- **THEN** el sistema responde 200 con el QE completo, incluyendo `accionesCorrectivas` (con sus `solicitudesAjustePlazo`), `documentosVinculados` y `siguientePaso`

#### Scenario: QE inexistente o de otra empresa
- **WHEN** el id no existe o pertenece a una empresa distinta a la activa
- **THEN** el sistema responde 404, nunca 403

#### Scenario: QE sin documentos vinculados
- **WHEN** se solicita `GET /api/quality-events/:id` sobre un QE sin ningún vínculo
- **THEN** `data.documentosVinculados` es un array vacío

#### Scenario: QE con documentos vinculados poblados
- **WHEN** se solicita `GET /api/quality-events/:id` sobre un QE vinculado a 1 documento
- **THEN** `data.documentosVinculados` contiene 1 objeto con `id`, `codigo`, `titulo` y `estado`

#### Scenario: Listado sin siguientePaso
- **WHEN** se solicita `GET /api/quality-events`
- **THEN** ningún item incluye `siguientePaso` (o viene en null)

### Requirement: Campo `DocumentosVinculados` en la entidad Quality Event
La entidad `QualityEvent` SHALL exponer `documentosVinculados`, una lista de resúmenes de documentos vinculados vía la tabla puente `DocumentoQualityEvent` — campo nuevo, no portado desde el mock cuando se construyó `be-quality-events` originalmente por no existir todavía la vinculación real.

#### Scenario: Nuevo QE creado sin vínculos
- **WHEN** se crea un `QualityEvent` vía `POST /api/quality-events`
- **THEN** `documentosVinculados` es un array vacío hasta que se cree un vínculo explícito vía `documento-qe-vinculacion`

### Requirement: Edición parcial con `descripcion` bloqueada fuera de ABIERTO
El sistema SHALL exponer `PATCH /api/quality-events/:id` para la actualización parcial de los campos de `QualityEventUpdateInput`: `descripcion`, `areaId`, `turno`, `mineralInvolucrado`, `descripcionAmpliada`, `metodoAnalisis`, `cincoPorques`, `ishikawa`, `causaRaizDefinitiva`, `resultadoCierre`, `plazoVerificacionDias` y `fechaVerificacionProgramada`. El sistema SHALL rechazar cualquier intento de incluir `estado` en el body. El sistema SHALL rechazar con 422 cualquier intento de modificar `descripcion` cuando `estado !== 'ABIERTO'` (RN-QE-006). `causaRaizAprobadaPorId` y `causaRaizFirmadaEn` SHALL NOT formar parte del command: si vienen en el body, se ignoran y no modifican el QE. La única vía para escribirlos es `POST /:id/aprobar-causa-raiz`.

#### Scenario: Actualización parcial exitosa
- **WHEN** un usuario envía un subconjunto de campos permitidos a `PATCH /api/quality-events/:id` de un QE de su empresa
- **THEN** el sistema responde 200 con el QE actualizado y una nueva entrada de audit trail `CAMPO_EDITADO` por cada campo modificado

#### Scenario: Intento de editar `estado` vía PATCH genérico
- **WHEN** el body de `PATCH /:id` incluye `estado`
- **THEN** el sistema ignora ese campo o responde 400, y nunca cambia el `estado` por esta vía

#### Scenario: Edición de `descripcion` fuera de ABIERTO
- **WHEN** un QE en `estado !== 'ABIERTO'` recibe `PATCH /:id` con `descripcion` en el body
- **THEN** el sistema responde 422 sin modificar el QE

#### Scenario: Campos de firma en el PATCH genérico se ignoran
- **WHEN** el body de `PATCH /:id` incluye `causaRaizFirmadaEn` y `causaRaizAprobadaPorId`
- **THEN** `causaRaizFirmadaEn` y `causaRaizAprobadaPorId` del QE no cambian

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
El sistema SHALL exponer `PATCH /api/quality-events/:id/firmar-cierre`, requiriendo dos firmas (`rol`, `pin`): la primera de `JEFE_CALIDAD_SYST`, la segunda del rol resuelto por `ResolverRolSegundaFirma`, que SHALL devolver siempre `'SUPERVISOR'` (RN-QE-004 reconciliada: la escalada a `ALTA_DIRECCION` por mismo firmante no se implementa, por ser estructuralmente inalcanzable bajo el modelo de un rol por usuario). La segunda firma SHALL exigir además que el actor sea supervisor del área del QE (ver "Supervisores del área del QE"); si no lo es, el sistema SHALL responder 403 con `errorCode: "NO_ES_SUPERVISOR_DEL_AREA"`. El sistema SHALL rechazar una segunda firma del mismo usuario que ya firmó como Jefe de Calidad (422). Antes de registrar la primera firma, el sistema SHALL verificar que el área del QE tenga al menos un supervisor; si no, SHALL responder 422 `AREA_SIN_SUPERVISOR`. Antes de aceptar cualquiera de las dos firmas, el sistema SHALL validar `pin` contra el `PinHash` del usuario firmante: si el usuario no tiene `PinHash` configurado, la firma se rechaza con `BusinessRuleException` (`RuleCode: "PIN_NO_CONFIGURADO"`) indicando que debe configurar su PIN primero (`POST /api/auth/set-pin`); si `PinHash` está configurado pero `pin` no coincide, la firma se rechaza como no autorizada (401). La primera firma SHALL registrar en el audit trail `accion: "FIRMA_CIERRE_JEFE_CALIDAD"` y la segunda `accion: "FIRMA_CIERRE_SUPERVISOR"`, ambas con `valorNuevo` igual al nombre completo del firmante.

#### Scenario: Primera firma
- **WHEN** un `JEFE_CALIDAD_SYST` firma `PATCH /:id/firmar-cierre` sobre un QE con cierre iniciado y área con supervisor, con su PIN de firma correcto
- **THEN** el sistema responde 200, registra `cerradoPorId`, agrega `FIRMA_CIERRE_JEFE_CALIDAD` con su nombre en `valorNuevo`, y el QE permanece sin `estado: 'CERRADO'` hasta la segunda firma

#### Scenario: Segunda firma de un supervisor del área completa el cierre
- **WHEN** un `SUPERVISOR` con el área del QE en `AreaIds` firma tras la primera firma de Jefe de Calidad, con su PIN de firma correcto
- **THEN** el sistema responde 200 con `estado: 'CERRADO'`, agrega `FIRMA_CIERRE_SUPERVISOR` con su nombre en `valorNuevo` y envía el aviso de cierre completo

#### Scenario: Supervisor de otra área
- **WHEN** un `SUPERVISOR` sin el área del QE en `AreaIds` intenta la segunda firma
- **THEN** el sistema responde 403 con `errorCode: "NO_ES_SUPERVISOR_DEL_AREA"` sin registrar la firma

#### Scenario: Primera firma con área sin supervisor
- **WHEN** un `JEFE_CALIDAD_SYST` intenta la primera firma y el área del QE no tiene ningún supervisor activo
- **THEN** el sistema responde 422 con `errorCode: "AREA_SIN_SUPERVISOR"` sin registrar la firma

#### Scenario: Doble firma del mismo usuario
- **WHEN** el mismo usuario que ya firmó como Jefe de Calidad intenta firmar la segunda firma
- **THEN** el sistema responde 422 sin completar el cierre

#### Scenario: PIN incorrecto
- **WHEN** un usuario con `PinHash` configurado envía `PATCH /:id/firmar-cierre` con un `pin` que no coincide con el PIN configurado
- **THEN** el sistema responde 401 sin registrar la firma

#### Scenario: Usuario sin PIN configurado
- **WHEN** un usuario sin `PinHash` configurado (nunca llamó `POST /api/auth/set-pin`) envía `PATCH /:id/firmar-cierre`
- **THEN** el sistema responde `422` con `errorCode: "PIN_NO_CONFIGURADO"` en el envelope de error, sin registrar la firma ni devolver un error genérico 500

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
Al crear un Quality Event con `origen: 'O1_INCIDENTE_CAMPO'`, el sistema SHALL asignar `Incidente.QeId` al id del QE creado **en la misma transacción** que la creación del QE, con una asignación condicional (`qe_id IS NULL`) que evite que dos creaciones concurrentes vinculen el mismo incidente. También SHALL registrar `QE_VINCULADO` en el audit trail del incidente, con el número del QE. Si el incidente ya está vinculado, el sistema SHALL responder 422 y no crear el QE. La vinculación ya no se completa desde el frontend mediante `PATCH /api/incidents/:id`.

#### Scenario: Vinculación atómica
- **WHEN** se envía `POST /api/quality-events` con `origen: 'O1_INCIDENTE_CAMPO'` e `incidenteId` de un incidente de la misma empresa sin QE
- **THEN** la respuesta 201 corresponde a un QE cuyo incidente ya tiene `QeId` igual al id del QE, sin requests adicionales

#### Scenario: Incidente ya vinculado
- **WHEN** se intenta crear un segundo QE O1 sobre un incidente que ya tiene `QeId`
- **THEN** el sistema responde 422 y no crea el QE

#### Scenario: Ciclo completo del QE O1
- **WHEN** un QE O1 se crea, transiciona a `EN_INVESTIGACION`, se cierra con la firma dual, se verifica como `EFECTIVO` y luego se reabre (por otra verificación `NO_EFECTIVO`)
- **THEN** el incidente pasa, respectivamente, por `ABIERTO` (con `QeId`), `EN_INVESTIGACION`, `CERRADO`, `CERRADO` y `EN_INVESTIGACION`

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

### Requirement: PIN incorrecto en firma de cierre identificado con errorCode
Cuando `PATCH /api/quality-events/:id/firmar-cierre` recibe un `pin` que no coincide con el `PinHash` del firmante, el sistema SHALL responder 401 con `errorCode: "PIN_INCORRECTO"` (`UnauthorizedBusinessException("PIN incorrecto", "PIN_INCORRECTO")`) y SHALL NOT registrar la firma. El status SHALL seguir siendo 401.

#### Scenario: Firma de cierre con PIN incorrecto
- **WHEN** un usuario con `PinHash` configurado envía `PATCH /:id/firmar-cierre` con un `pin` que no coincide
- **THEN** el sistema responde 401 con `errorCode: "PIN_INCORRECTO"` y no registra la firma

### Requirement: Candidatos a responsable de investigación
El sistema SHALL exponer `GET /api/quality-events/candidatos-responsable`, autenticado y con empresa activa, que devuelve los usuarios con asignación `ACTIVO` en la empresa de la sesión, rol de empresa `SUPERVISOR` o `JEFE_CALIDAD_SYST` y `ShacUser.Activo = true`. Cada elemento SHALL tener la forma `{ id, nombreCompleto, rol, avatarUrl }`, ordenado por nombre y apellido.

#### Scenario: Solo SUPERVISOR y JCA activos de la empresa
- **WHEN** un usuario autenticado con empresa activa llama al endpoint
- **THEN** la respuesta incluye a los SUPERVISOR y JEFE_CALIDAD_SYST activos de esa empresa
- **AND** no incluye OPERARIO, AUDITOR_INTERNO ni otros roles, ni usuarios inactivos, ni asignaciones no `ACTIVO`, ni usuarios de otra empresa

#### Scenario: Sin empresa activa
- **WHEN** la sesión no tiene empresa activa
- **THEN** el endpoint responde con el error del filtro `RequireEmpresaActivaFilter`

### Requirement: Responsable de investigación opcional al crear un QE
`POST /api/quality-events` SHALL aceptar `responsableInvestigacionId` opcional. Si viene, el sistema SHALL validarlo con la misma regla de candidatos y, si no es válido, SHALL responder un error de validación del campo `responsableInvestigacionId` (`FieldValidationException`, 400), nunca un 404. Si es válido, SHALL guardarlo y SHALL registrar `RESPONSABLE_ASIGNADO` en el audit trail del QE dentro de la misma transacción, con `ValorNuevo` = nombre del responsable.

#### Scenario: Crear con responsable válido
- **WHEN** se crea un QE con `responsableInvestigacionId` de un SUPERVISOR activo de la empresa
- **THEN** responde 201, el QE queda con ese responsable y el audit trail contiene `CREADO` y `RESPONSABLE_ASIGNADO`

#### Scenario: Crear con responsable inválido
- **WHEN** `responsableInvestigacionId` corresponde a un OPERARIO o a un usuario de otra empresa
- **THEN** responde 400 con un error en el campo `responsableInvestigacionId` y no se crea el QE

#### Scenario: Crear sin responsable
- **WHEN** se crea un QE sin `responsableInvestigacionId`
- **THEN** responde 201 y el QE queda sin responsable

### Requirement: Asignación y cambio del responsable de investigación
El sistema SHALL exponer `PATCH /api/quality-events/{id}/responsable` con body `{ responsableInvestigacionId }`, restringido por rol global a `JEFE_CALIDAD_SYST` (otro rol → 403). Un QE inexistente o de otra empresa SHALL responder 404. En estado `CERRADO`, `EN_VERIFICACION` o `VERIFICADO` SHALL responder 422 con `errorCode = QE_CERRADO`. El candidato SHALL validarse con la regla de candidatos (error de campo si no es válido). Si el responsable no cambia, SHALL responder 200 sin audit trail ni notificación. Si cambia, SHALL registrar `RESPONSABLE_ASIGNADO` (no había responsable) o `RESPONSABLE_CAMBIADO` (ya había uno), con `CampoModificado = responsableInvestigacionId` y `ValorAnterior`/`ValorNuevo` con los nombres de las personas, no los ids. `ActualizarQualityEventCommand` SHALL NOT aceptar este campo.

#### Scenario: JCA asigna y luego cambia
- **WHEN** un JCA asigna un responsable a un QE sin responsable y luego lo cambia por otro
- **THEN** ambas llamadas responden 200, el audit trail registra `RESPONSABLE_ASIGNADO` y después `RESPONSABLE_CAMBIADO` con los nombres anterior y nuevo

#### Scenario: SUPERVISOR intenta asignar
- **WHEN** un SUPERVISOR llama al endpoint
- **THEN** responde 403

#### Scenario: QE de otra empresa
- **WHEN** el QE pertenece a otra empresa
- **THEN** responde 404

#### Scenario: QE cerrado
- **WHEN** el QE está en `CERRADO`, `EN_VERIFICACION` o `VERIFICADO`
- **THEN** responde 422 con `errorCode = QE_CERRADO`

#### Scenario: Mismo responsable
- **WHEN** se envía el mismo responsable que ya tiene el QE
- **THEN** responde 200 sin nueva entrada de audit trail ni notificación

### Requirement: ABIERTO → EN_INVESTIGACION exige responsable de investigación
`PATCH /api/quality-events/{id}/status` con `nuevoEstado = EN_INVESTIGACION` sobre un QE en estado `ABIERTO` sin `ResponsableInvestigacionId` SHALL responder 422 con `errorCode = QE_SIN_RESPONSABLE` y mensaje "Asigna un responsable de investigación antes de iniciar la investigación". Las reaperturas (EN_VERIFICACION → EN_INVESTIGACION por este endpoint o por `QEReaperturaHelper`) SHALL NOT aplicar esta validación.

#### Scenario: Reapertura sin responsable
- **WHEN** se transiciona EN_VERIFICACION → EN_INVESTIGACION un QE sin responsable
- **THEN** la transición no se bloquea por `QE_SIN_RESPONSABLE`

#### Scenario: Sin responsable
- **WHEN** se transiciona ABIERTO → EN_INVESTIGACION un QE sin responsable
- **THEN** responde 422 `QE_SIN_RESPONSABLE` y el estado no cambia

#### Scenario: Con responsable
- **WHEN** se transiciona ABIERTO → EN_INVESTIGACION un QE con responsable
- **THEN** responde 200 y el QE queda en EN_INVESTIGACION

### Requirement: Notificación al responsable asignado
Cuando se asigna o cambia el responsable (al crear o vía `PATCH /responsable`), el sistema SHALL crear, después del commit y en modo best-effort, una notificación para el nuevo responsable — salvo que sea el actor — con `Tipo = ASIGNACION`, `EntidadTipo = QE`, mensaje `Fuiste asignado como responsable de investigación del {numero}.` y `Link = /quality-events/{id}`. Un fallo SHALL registrarse con `LogWarning` y SHALL NOT alterar la respuesta.

#### Scenario: Asignado distinto del actor
- **WHEN** un JCA asigna a un SUPERVISOR
- **THEN** el SUPERVISOR recibe la notificación `ASIGNACION`

#### Scenario: El actor se asigna a sí mismo
- **WHEN** un JCA se elige a sí mismo como responsable
- **THEN** no se crea la notificación de asignación

### Requirement: Notificación de creación de QE
Al crear un QE, el sistema SHALL notificar, después del commit y en modo best-effort, a los `JEFE_CALIDAD_SYST` y `SUPERVISOR` de la empresa (resueltos con `RolNotificationHelper`), sin el actor y sin duplicados, con `Tipo = CAMBIO_ESTADO`, `EntidadTipo = QE`, mensaje `Nuevo Quality Event {numero} ({tipo}, severidad {severidad}).` — con el sufijo ` — origen {incidenteNumero}` cuando el origen es un incidente — y `Link = /quality-events/{id}`. La notificación de severidad crítica (RN-QE-005) SHALL seguir enviándose como hasta ahora. Un fallo SHALL NOT cambiar la respuesta 201.

#### Scenario: Aviso a JCA y SUP sin el actor
- **WHEN** un JCA crea un QE
- **THEN** los demás JCA y todos los SUPERVISOR de la empresa reciben el aviso, y el actor no

#### Scenario: Fallo del envío
- **WHEN** la notificación de creación lanza una excepción
- **THEN** la respuesta sigue siendo 201

### Requirement: Nombre del responsable en detalle y listado
`GET /api/quality-events/{id}` y `GET /api/quality-events` SHALL devolver `responsableInvestigacionId` y `responsableInvestigacionNombre` (`TRIM(nombre || ' ' || apellido)` vía `LEFT JOIN asp_net_users`). `ResponsableInvestigacionNombre` SHALL ser una propiedad `[NotMapped]` de la entidad, sin columna en la base de datos.

#### Scenario: Detalle con responsable
- **WHEN** se obtiene un QE con responsable
- **THEN** la respuesta incluye su `responsableInvestigacionNombre`

#### Scenario: Listado sin responsable
- **WHEN** se lista un QE sin responsable
- **THEN** `responsableInvestigacionNombre` es null

### Requirement: Análisis de causa raíz tipado en el PATCH genérico
`PATCH /api/quality-events/:id` SHALL recibir `cincoPorques` como `{ pregunta, respuesta }[]` e `ishikawa` como `{ categoria, causa }[]`, donde `categoria` ∈ {`METODO`, `MAQUINA`, `MATERIAL`, `MANO_DE_OBRA`, `MEDICION`, `MEDIO_AMBIENTE`}. El sistema SHALL guardarlos como JSON (camelCase, enums como string) en las columnas `text` existentes `cinco_porques` e `ishikawa`, sin migración. El validator SHALL exigir:
- `metodoAnalisis` ∈ {`5_PORQUES`, `ISHIKAWA`};
- `cincoPorques` o `ishikawa` solo junto con `metodoAnalisis` y solo la lista de la herramienta activa;
- con `5_PORQUES`, exactamente 5 ítems;
- con `ISHIKAWA`, exactamente 6 ítems con las 6 categorías, sin repetir;
- en ambos casos, un máximo de 2.000 caracteres por `pregunta`, `respuesta` o `causa` (se permiten respuestas vacías mientras el análisis es borrador).

Una violación SHALL responder 400. Al guardar con `metodoAnalisis = 5_PORQUES`, el sistema SHALL poner `ishikawa` en null; con `ISHIKAWA`, SHALL poner `cincoPorques` en null (PRD: una sola herramienta activa por QE). En el audit trail, `cincoPorques` e `ishikawa` SHALL registrarse con un resumen, no con el JSON completo: `5 Porqués actualizado (N de 5 respuestas completas)` o `Ishikawa actualizado (N de 6 categorías completas)`.

#### Scenario: Guardar 5 Porqués
- **WHEN** se envía `metodoAnalisis = 5_PORQUES` con 5 porqués a un QE que tenía Ishikawa
- **THEN** responde 200, el `GET` siguiente devuelve `cincoPorques` idéntico a lo enviado e `ishikawa = null`

#### Scenario: Guardar Ishikawa
- **WHEN** se envía `metodoAnalisis = ISHIKAWA` con las 6 categorías
- **THEN** responde 200, el `GET` siguiente devuelve `ishikawa` idéntico y `cincoPorques = null`

#### Scenario: Estructura inválida
- **WHEN** se envían 4 porqués, 7 categorías, una categoría repetida o `metodoAnalisis = 'OTRO'`
- **THEN** responde 400 y el QE no cambia

#### Scenario: Audit trail con resumen
- **WHEN** se guardan 5 porqués con 3 respuestas no vacías
- **THEN** el audit trail registra `CAMPO_EDITADO` en `cincoPorques` con `ValorNuevo = "5 Porqués actualizado (3 de 5 respuestas completas)"`

### Requirement: Permiso para editar el análisis de causa raíz
Cuando el body de `PATCH /api/quality-events/:id` incluye `metodoAnalisis`, `cincoPorques`, `ishikawa` o `causaRaizDefinitiva`, el sistema SHALL verificar, en este orden:
1. Si el actor no es `JEFE_CALIDAD_SYST` (rol del token) ni `qe.ResponsableInvestigacionId`, responde 403.
2. Si el estado no es `EN_INVESTIGACION` ni `ANALISIS_COMPLETADO`, responde 422 con `errorCode = ANALISIS_NO_EDITABLE`.
3. Si `causaRaizDefinitiva` viene con un valor distinto del guardado y `causaRaizFirmadaEn` ya está definido, responde 422 con `errorCode = CAUSA_RAIZ_FIRMADA`.

#### Scenario: JCA edita
- **WHEN** un JCA guarda el análisis de un QE en EN_INVESTIGACION
- **THEN** responde 200

#### Scenario: SUPERVISOR responsable asignado edita
- **WHEN** el SUPERVISOR que es `responsableInvestigacionId` guarda el análisis de un QE en EN_INVESTIGACION
- **THEN** responde 200

#### Scenario: SUPERVISOR no asignado
- **WHEN** un SUPERVISOR que no es el responsable guarda el análisis
- **THEN** responde 403

#### Scenario: QE en ABIERTO
- **WHEN** un JCA guarda el análisis de un QE en ABIERTO
- **THEN** responde 422 con `errorCode = ANALISIS_NO_EDITABLE`

#### Scenario: Causa raíz ya firmada
- **WHEN** se envía una `causaRaizDefinitiva` distinta para un QE con la causa raíz firmada
- **THEN** responde 422 con `errorCode = CAUSA_RAIZ_FIRMADA`

### Requirement: Lectura del análisis como arrays, tolerante a datos viejos
Toda respuesta que serialice la entidad `QualityEvent` (detalle, listado y endpoints de escritura) SHALL exponer `cincoPorques` e `ishikawa` como arrays (o null), nunca como texto. Las columnas crudas SHALL quedar fuera del JSON (`[JsonIgnore]`). Si el texto guardado no es JSON válido para la forma esperada, SHALL exponerse como `null`, sin 500, y `GET /api/quality-events/:id` SHALL registrar un `LogWarning` con el id del QE.

#### Scenario: Dato viejo no-JSON
- **WHEN** `cinco_porques` contiene el texto `"porque sí"` y se pide el detalle del QE
- **THEN** responde 200 con `cincoPorques: null`

### Requirement: Aprobación de la causa raíz con PIN verificado (RN-QE-002)
El sistema SHALL exponer `POST /api/quality-events/{id}/aprobar-causa-raiz`, autenticado, con body `{ pin }` (validado como 4 dígitos, 400 si no lo es). Validará, en este orden:
1. Un QE inexistente o de otra empresa responde 404.
2. Un actor que no es `JEFE_CALIDAD_SYST` responde 403.
3. Un estado distinto de `EN_INVESTIGACION` o `ANALISIS_COMPLETADO` responde 422.
4. Si la `causaRaizDefinitiva` guardada (con trim) no tiene entre 100 y 500 caracteres, responde 422 con `errorCode = CAUSA_RAIZ_INVALIDA`.
5. Si `causaRaizFirmadaEn` ya está definido, responde 422 con `errorCode = CAUSA_RAIZ_FIRMADA`.
6. Si el actor no tiene `PinHash`, responde 422 con `errorCode = PIN_NO_CONFIGURADO`. Si el PIN no coincide (`IPasswordHasher<ShacUser>`), responde 401 con `errorCode = PIN_INCORRECTO`.

En éxito, el sistema SHALL fijar `CausaRaizAprobadaPorId = actorId`, `CausaRaizFirmadaEn = DateTime.UtcNow` y `ActualizadoEn`, registrar en el audit trail `Accion = CAUSA_RAIZ_APROBADA` con `ValorNuevo` = los primeros 100 caracteres de la causa raíz, y responder 200 con el QE actualizado.

#### Scenario: JCA con PIN correcto
- **WHEN** un JCA con PIN configurado aprueba una causa raíz guardada de 150 caracteres con el PIN correcto
- **THEN** responde 200, el QE queda con `causaRaizAprobadaPorId` = el JCA y `causaRaizFirmadaEn` = la hora del servidor, y el audit trail contiene `CAUSA_RAIZ_APROBADA`

#### Scenario: PIN incorrecto
- **WHEN** el PIN no coincide
- **THEN** responde 401 con `errorCode = PIN_INCORRECTO` y el QE no cambia

#### Scenario: Sin PIN configurado
- **WHEN** el JCA no tiene `PinHash`
- **THEN** responde 422 con `errorCode = PIN_NO_CONFIGURADO`

#### Scenario: SUPERVISOR intenta aprobar
- **WHEN** un SUPERVISOR, aunque sea el responsable asignado, llama al endpoint
- **THEN** responde 403

#### Scenario: Causa raíz corta
- **WHEN** la causa raíz guardada tiene menos de 100 caracteres
- **THEN** responde 422 con `errorCode = CAUSA_RAIZ_INVALIDA`

#### Scenario: Ya firmada
- **WHEN** la causa raíz ya fue aprobada
- **THEN** responde 422 con `errorCode = CAUSA_RAIZ_FIRMADA`

#### Scenario: Otra empresa
- **WHEN** el QE pertenece a otra empresa
- **THEN** responde 404

#### Scenario: Avance a EN_EJECUCION tras aprobar
- **WHEN** la causa raíz de un QE en ANALISIS_COMPLETADO se aprueba por este endpoint y luego se pide `PATCH /:id/status { nuevoEstado: 'EN_EJECUCION' }`
- **THEN** la transición responde 200 (RN-QE-002 satisfecha)

### Requirement: Trazabilidad de sugerencias IA en el PATCH genérico
`PATCH /api/quality-events/:id` SHALL aceptar un campo opcional `origenIA: { causaRaiz?: 'IA' | 'IA_EDITADO', cincoPorques?: 'IA' | 'IA_EDITADO' }`; cualquier otro valor SHALL responder 400. Al registrar `CAMPO_EDITADO` de `causaRaizDefinitiva` o `cincoPorques`:
- con origen `IA`, la entrada SHALL tener `GeneradoPorIA = true`;
- con `IA_EDITADO`, SHALL tener `GeneradoPorIA = false` y un `ValorNuevo` terminado en " (sugerencia IA editada)";
- sin origen, el comportamiento no cambia (`GeneradoPorIA = false`).

`origenIA` SHALL NOT alterar los permisos ni las validaciones del análisis (JCA o responsable, estado editable, causa raíz no firmada). RNG-004: la sugerencia solo se vuelve definitiva con la aprobación con PIN del JCA (`aprobar-causa-raiz`).

#### Scenario: Causa raíz sugerida sin editar
- **WHEN** se guarda `causaRaizDefinitiva` con `origenIA.causaRaiz = 'IA'`
- **THEN** la entrada `CAMPO_EDITADO` de `causaRaizDefinitiva` tiene `generadoPorIA: true`

#### Scenario: Sugerencia editada
- **WHEN** se guarda `cincoPorques` con `origenIA.cincoPorques = 'IA_EDITADO'`
- **THEN** la entrada tiene `generadoPorIA: false` y `valorNuevo` termina en "(sugerencia IA editada)"

#### Scenario: Valor inválido
- **WHEN** `origenIA.causaRaiz = 'OTRO'`
- **THEN** responde 400 y el QE no cambia

### Requirement: Supervisores del área del QE
El sistema SHALL resolver los supervisores del área de un QE (`SupervisoresAreaResolver`) como los usuarios con asignación `UsuarioEmpresa` en la empresa del QE con `Rol == SUPERVISOR` y `Estado == ACTIVO`, `ShacUser.Activo == true` y el `AreaId` del QE contenido en `ShacUser.AreaIds`. `ShacUser.AreaId` (departamento propio) NO SHALL considerarse. Cada resultado SHALL exponer `id`, `nombreCompleto` y `avatarUrl`.

#### Scenario: Incluye solo supervisores activos del área
- **WHEN** la empresa tiene un SUPERVISOR activo con el área en `AreaIds`, otro SUPERVISOR con otra área, uno con asignación inactiva, uno con usuario inactivo, un JCA con el área y un SUPERVISOR de otra empresa con el área
- **THEN** el resolver devuelve solo el primero

### Requirement: Inicio del cierre bloqueado si el área no tiene supervisor
`PATCH /api/quality-events/:id/cerrar` SHALL responder 422 con `errorCode: "AREA_SIN_SUPERVISOR"` y el mensaje "El área {nombre del área} no tiene un supervisor activo asignado. Asigna uno en Usuarios antes de cerrar." cuando el área del QE no tiene supervisores, sin registrar `resultadoCierre`.

#### Scenario: Área sin supervisores
- **WHEN** se envía `PATCH /:id/cerrar` válido para un QE cuya área no tiene ningún supervisor activo
- **THEN** el sistema responde 422 `AREA_SIN_SUPERVISOR` y `resultadoCierre` sigue vacío

### Requirement: Rechazo del cierre por el supervisor del área
El sistema SHALL exponer `POST /api/quality-events/:id/rechazar-cierre` con body `{ motivo }` (20–500 caracteres; fuera de rango → 400). Un QE de otra empresa SHALL responder 404. El QE SHALL estar en `PENDIENTE_CIERRE` con `cerradoPorId` y sin `cierreFirmaSupervisorId`; si no, 422. El actor SHALL ser supervisor del área del QE; si no, 403 `NO_ES_SUPERVISOR_DEL_AREA`. No requiere PIN. El efecto SHALL ser: `estado = EN_EJECUCION`, `cerradoPorId = null`, `resultadoCierre` y `plazoVerificacionDias` conservados, audit `CIERRE_RECHAZADO` con `estadoAnterior: PENDIENTE_CIERRE`, `estadoNuevo: EN_EJECUCION` y `valorNuevo` = motivo, sincronización del incidente vinculado (`IncidenteQeSync`) y aviso de rechazo al JCA.

#### Scenario: Rechazo válido
- **WHEN** un supervisor del área rechaza con un motivo de 30 caracteres un QE en PENDIENTE_CIERRE con la firma del JCA
- **THEN** el sistema responde 200 con `estado: 'EN_EJECUCION'`, `cerradoPorId: null`, `resultadoCierre` intacto, una entrada `CIERRE_RECHAZADO` con el motivo, el incidente vinculado en `EN_EJECUCION` y una notificación al JCA que firmó

#### Scenario: Motivo corto
- **WHEN** el motivo tiene menos de 20 caracteres
- **THEN** el sistema responde 400

#### Scenario: Sin firma del JCA
- **WHEN** el QE está en PENDIENTE_CIERRE sin `cerradoPorId`
- **THEN** el sistema responde 422

#### Scenario: Supervisor de otra área rechaza
- **WHEN** un SUPERVISOR sin el área del QE intenta rechazar
- **THEN** el sistema responde 403 `NO_ES_SUPERVISOR_DEL_AREA`

#### Scenario: QE de otra empresa
- **WHEN** el QE pertenece a otra empresa
- **THEN** el sistema responde 404

### Requirement: EN_EJECUCION → PENDIENTE_CIERRE manual exige AC cerradas (RN-QE-003)
`PATCH /api/quality-events/:id/status` con `nuevoEstado: PENDIENTE_CIERRE` SHALL responder 422 `RN-QE-003` si alguna acción correctiva del QE no está `CERRADA` o no tiene `descripcionEvidencia`.

#### Scenario: Re-cierre tras un rechazo con todas las AC cerradas
- **WHEN** un QE en EN_EJECUCION (tras un rechazo) con todas sus AC cerradas con evidencia pasa a PENDIENTE_CIERRE
- **THEN** el sistema responde 200 y envía el aviso "listo para cierre"

#### Scenario: AC abierta
- **WHEN** el QE tiene una AC en PENDIENTE
- **THEN** el sistema responde 422 `RN-QE-003`

### Requirement: Avisos del flujo de cierre
El sistema SHALL enviar, best-effort (después de persistir, sin alterar la respuesta si falla), sin incluir al actor, sin duplicados y con `link: /quality-events/{id}`:
- **Listo para cierre** (`CAMBIO_ESTADO`) al pasar a PENDIENTE_CIERRE (auto-transición al cerrar la última AC o transición manual): JCA con asignación activa y supervisores del área. Mensaje: "El {numero} está listo para cierre: todas sus acciones correctivas están cerradas."
- **Firma pendiente** (`ASIGNACION`) tras la primera firma: supervisores del área. Mensaje: "El {numero} espera tu firma de cierre como Supervisor de {área}. Firmó el Jefe de Calidad {nombreJCA}."
- **Cierre rechazado** (`CAMBIO_ESTADO`): el JCA que firmó si sigue activo como JCA en la empresa; si no, todos los JCA activos. Mensaje: `El supervisor {nombre} rechazó el cierre del {numero}: "{primeros 100 caracteres del motivo}".`
- **Cierre completo** (`CIERRE`) tras la segunda firma: reportante, responsable de investigación, JCA activos y, con severidad ALTA o CRITICA, ALTA_DIRECCION. Mensaje: "El {numero} fue cerrado con doble firma. Verificación de eficacia programada para el {dd/MM/yyyy}."

`{área}` SHALL ser el nombre del área, no su id.

#### Scenario: Listo para cierre solo al área
- **WHEN** se cierra la última AC de un QE del área 1
- **THEN** reciben aviso los JCA y los supervisores del área 1, y no un supervisor del área 2

#### Scenario: Firma pendiente
- **WHEN** el JCA da la primera firma
- **THEN** solo los supervisores del área reciben el aviso `ASIGNACION`

#### Scenario: Cierre completo con severidad ALTA
- **WHEN** se completa la segunda firma de un QE con severidad ALTA
- **THEN** reciben aviso `CIERRE` el reportante, el responsable, los JCA y ALTA_DIRECCION, y no el supervisor que firmó

#### Scenario: Cierre completo con severidad MEDIA
- **WHEN** se completa la segunda firma de un QE con severidad MEDIA
- **THEN** ALTA_DIRECCION no recibe aviso

#### Scenario: Fallo de notificación
- **WHEN** el envío de un aviso del cierre lanza una excepción
- **THEN** la respuesta del endpoint no cambia

### Requirement: Detalle del QE con firmantes y supervisores del área
`GET /api/quality-events/:id` SHALL devolver `cerradoPorNombre` y `cierreFirmaSupervisorNombre` (nombre completo de los firmantes, `null` si no firmaron) y, solo cuando `estado == PENDIENTE_CIERRE`, `supervisoresArea: [{ id, nombreCompleto, avatarUrl }]`; en otros estados `supervisoresArea` SHALL ser `null`.

#### Scenario: Detalle en PENDIENTE_CIERRE con primera firma
- **WHEN** se pide el detalle de un QE en PENDIENTE_CIERRE firmado por el JCA, con dos supervisores en el área
- **THEN** la respuesta trae `cerradoPorNombre` con el nombre del JCA y `supervisoresArea` con los dos supervisores
