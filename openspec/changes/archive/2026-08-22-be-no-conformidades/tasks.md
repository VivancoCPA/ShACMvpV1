## 1. Dominio y persistencia — modelo de datos

- [x] 1.1 Crear entidad `NoConformidad` en `ShcMvpEndPoint.Domain/Entities` con todos los campos del shape confirmado (ver `specs/be-no-conformidades-api`): `Id`, `Numero`, `Dominio`, `Origen`, `Tipo`, `Severidad`, `Estado`, `Titulo`, `Descripcion`, `AreaId`, `EmpresaId`, `ProcesoInvolucrado?`, `DetectadoPorId?`, `ReportadoPorId`, `FechaDeteccion`, `FechaReporte`, `FechaCierre?` (deadline esperado), `JustificacionAnulacion?`, `DeletedAt?`, `CreadoEn`, `ActualizadoEn`, `MineralInvolucrado?`, `Turno?`, `ResponsableInvestigacionId?`, `AccionInmediata?`, `AccionInmediataFecha?`, `Correccion?`, `CorreccionEvidenciaUrl?`, `CausaRaiz?`, `CorregidoPorId?`, `VerificadoPorId?`, `FechaVerificacion?`, `ResultadoVerificacion?`, `QeGeneradoId?` (siempre null en este cambio), `RequiereIPER?`, `NotificacionComercioExterior?` (owned type: `Fecha`, `Referencia`, `Descripcion`, nullable)
- [x] 1.2 Crear entidad `AccionCorrectivaNC` (FK `NoConformidadId`) con `Titulo`, `Descripcion`, `ResponsableId`, `ResponsableNombre`, `PlazoFecha`, `Prioridad`, `Estado`, `DescripcionEvidencia?`, `EvidenciaUrl?`, `FechaCierre?`, `QeId?` (siempre null en este cambio), `CreadoEn`, `ActualizadoEn`
- [x] 1.3 Crear entidad `NoConformidadAuditTrail` (FK `NoConformidadId`), append-only, con `Accion`, `EstadoAnterior?`, `EstadoNuevo?`, `CampoModificado?`, `ValorAnterior?`, `ValorNuevo?`, `RealizadoPorId`, `RealizadoPorNombre`, `Timestamp`, `GeneradoPorIA`
- [x] 1.4 Configurar EF Core en `ShacDbContext` (mapeos snake_case, índices: `NoConformidad.EmpresaId`, `NoConformidad.Numero` único por empresa+dominio+año, `AccionCorrectivaNC.NoConformidadId`, `NoConformidadAuditTrail.NoConformidadId`) — sin tocar el orden de `UseSnakeCaseNaming()` al final de `OnModelCreating`
- [x] 1.5 Generar y aplicar migración EF Core `AddNoConformidades` con las tablas nuevas (`no_conformidades`, `acciones_correctivas_nc`, `no_conformidad_audit_trail`)

## 2. No Conformidades — creación y lectura

- [x] 2.1 Implementar generación de `numero` (`NC-<DOM>-<año>-NNN`) vía `EmpresaSecuencia` con `Tipo = "NC-{prefix}"` (`CAL|SST|ADU|OPE|PRV` según `Dominio`), atómico bajo concurrencia (mismo upsert que `IncidenteNumeroGenerator`)
- [x] 2.2 Implementar cálculo server-side de `RequiereIPER` (`true` si `Dominio == SST`, ignorando cualquier valor del cliente)
- [x] 2.3 Implementar detector de duplicados RN-NC-005: NCs de la misma empresa con mismo `Dominio` + `AreaId`, `CreadoEn` dentro de los últimos 30 días, omitido si `command.Forzar == true`
- [x] 2.4 Implementar `INoConformidadNotificationSender` + `NoOpNoConformidadNotificationSender` (best-effort, TODO explícito) — invocado al crear una NC con `Dominio == ADUANERO` (RN-NC-002)
- [x] 2.5 Implementar `Features/NoConformidades/CrearNoConformidad` (Command + Validator + Handler EF Core + Endpoint): valida `origen`, `tipo`, `severidad`, `areaId`, `descripcion`, `fechaDeteccion`, `dominio`, `titulo`, `fechaCierre`; `empresaId` desde JWT; 401 sin empresa activa; `estado: 'ABIERTA'`; agrega entrada de audit trail `CREADA`; incluye comentario explícito señalando que la creación automática de Quality Event está intencionalmente fuera de alcance
- [x] 2.6 Implementar `Features/NoConformidades/ListarNoConformidades` (Dapper, filtros `estado`/`tipo`/`severidad`/`dominio`/`areaId`/`search`/`fechaDesde`/`fechaHasta`/`showDeleted`/`page`/`pageSize`, respuesta `{ items, pagination }`, scoped por empresa activa)
- [x] 2.7 Implementar `Features/NoConformidades/ObtenerNoConformidad` (Dapper, `GET /:id`, incluye `accionesCorrectivas` y `auditTrail`, 404 cross-tenant)

## 3. No Conformidades — actualización, anulación y borrado

- [x] 3.1 Implementar `Features/NoConformidades/ActualizarNoConformidad` (`PATCH /:id`, actualización parcial, 409 si `estado` es `CERRADA`/`ANULADA`, agrega entrada `CAMPO_EDITADO` por cada campo modificado)
- [x] 3.2 Implementar cálculo de destinatarios de notificación best-effort (reportante + responsables de ACs no cerradas, excluyendo al actor) cuando `PATCH /:id` cambia `estado`, vía `INoConformidadNotificationSender`
- [x] 3.3 Implementar `Features/NoConformidades/AnularNoConformidad` (`POST /:id/anular`, requiere `justificacion` no vacía, `estado → ANULADA`, agrega entrada `ANULADA` con `valorNuevo = justificacion`)
- [x] 3.4 Implementar `Features/NoConformidades/EliminarNoConformidad` (`DELETE /:id`, soft-delete solo si `estado === 'ABIERTA'` y no eliminada previamente, 422 en los demás casos, agrega entrada `ELIMINADA`) — decisión D7 de `design.md`
- [x] 3.5 Implementar `Features/NoConformidades/RestaurarNoConformidad` (`PATCH /:id/restore`, solo si `deletedAt` definido, agrega entrada `RESTAURADA`) — decisión D7 de `design.md`

## 4. Acciones correctivas de la No Conformidad

- [x] 4.1 Implementar `Features/NoConformidades/CrearAccionCorrectiva` (`POST /:id/acciones-correctivas`, body `{ titulo, descripcion, responsableId, plazoFecha, prioridad }`, estado inicial `PENDIENTE`, `responsableNombre` resuelto server-side desde `responsableId`, agrega entrada `AC_CREADA`)
- [x] 4.2 Implementar `Features/NoConformidades/ActualizarAccionCorrectiva` (`PATCH /:ncId/acciones-correctivas/:acId`, actualización parcial, 404 si la acción no existe, agrega entrada `AC_ACTUALIZADA`) — al modificar `plazoFecha` sobre una AC cuyo plazo anterior ya estaba vencido (`DateTime.UtcNow` al momento del PATCH), registrar ese hecho en el detalle de la entrada de audit trail (RN-NC-006)
- [x] 4.3 Implementar `Features/NoConformidades/CerrarAccionCorrectiva` (`POST /:ncId/acciones-correctivas/:acId/cerrar`, requiere `descripcionEvidencia` no vacía, `evidenciaUrl?` opcional, `estado → 'CERRADA'`, `fechaCierre` con hora del servidor, agrega entrada `AC_CERRADA`) — decisión D8 de `design.md`, replica el código real del mock, no el spec `nc-msw-handlers` desactualizado

## 5. Multi-tenancy

- [x] 5.1 Verificar que todos los handlers de No Conformidades (incluyendo los de acciones correctivas, que heredan aislamiento de la NC padre) filtran por `empresaId === empresaActivaId` antes de cualquier otro filtro/validación y responden 404 (nunca 403) cross-tenant

## 6. Tests

- [x] 6.1 Tests de integración: creación de NC (éxito, validaciones 400 de los 9 campos requeridos, 401 sin empresa activa, `RequiereIPER` calculado por dominio, `estado: 'ABIERTA'`)
- [x] 6.2 Tests de integración: numeración correlativa — dos NCs del mismo dominio y empresa obtienen números consecutivos; distinto dominio en la misma empresa no interfiere; empresas distintas no interfieren entre sí
- [x] 6.3 Tests de integración: detección de duplicados RN-NC-005 (warning presente cuando corresponde, ausente sin coincidencia, ausente con `forzar: true`, sin falso positivo cross-empresa)
- [x] 6.4 Tests de integración: listado/detalle de NC (paginación, filtros, `showDeleted`, shape `data.items`, 404 cross-tenant)
- [x] 6.5 Tests de integración: edición parcial (éxito, 409 en `CERRADA`/`ANULADA`, notificación no bloqueante en cambio de `estado`)
- [x] 6.6 Tests de integración: anulación (éxito, 400 sin `justificacion`)
- [x] 6.7 Tests de integración: soft-delete/restore de NC (bloqueo por estado, doble eliminación, restauración)
- [x] 6.8 Tests de integración: acciones correctivas (creación con validación de los 5 campos requeridos, actualización, cierre con `estado: 'CERRADA'`, 400 sin `descripcionEvidencia`, 404 cross-tenant vía NC padre)

## 7. Verificación manual y cierre

- [x] 7.1 Ejecutar `dotnet test` y confirmar conteo de tests antes/después (partiendo del conteo actual post-Incidentes)
- [x] 7.2 Pasada manual mínima: crear NC (con y sin duplicado), listar/filtrar, editar, anular, soft-delete + restore, crear/actualizar/cerrar AC, acceso cross-tenant → 404
- [x] 7.3 Documentar en el reporte final: endpoints implementados con status codes verificados, las 6 discrepancias resueltas respecto a la instrucción original de Cowork (ver `proposal.md` "Impact" y `design.md` "Open Questions"), estado del hook de notificación (TODO vs. infraestructura existente), confirmación de que el cambio quedó propuesto/aplicado en `ShcMvp/openspec/changes/` (no en `ShcMvpEndPoint/openspec/`), y `git status` final
