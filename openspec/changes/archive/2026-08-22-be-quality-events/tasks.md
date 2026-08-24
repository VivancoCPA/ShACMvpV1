## 1. Dominio y persistencia — modelo de datos

- [x] 1.1 Crear entidad `QualityEvent` en `ShcMvpEndPoint.Domain/Entities` con todos los campos confirmados (ver `specs/be-quality-events-api`): `Id`, `Numero`, `Origen`, `Tipo`, `Severidad`, `Estado`, `Ciclo`, `Descripcion`, `AreaId`, `EmpresaId`, `MineralInvolucrado?`, `Turno`, `FechaHoraEvento`, `FechaHoraReporte`, `ReportadoPorId`, `ResponsableInvestigacionId?`, `IncidenteId?`, `NcId?`, `HallazgoCodigo?`, `NormativaVinculada?` (owned: `Norma`, `Clausula`, `NormaOtraDetalle?`), `ReporteExternoRef?` (owned: `NombreCliente`, `FechaRecepcion`), `DescripcionAmpliada?`, `MetodoAnalisis?`, `CincoPorques?`, `Ishikawa?`, `CausaRaizDefinitiva?`, `CausaRaizAprobadaPorId?`, `CausaRaizFirmadaEn?`, `SolicitudesAC`, `ResultadoCierre?`, `PlazoVerificacionDias?`, `CerradoPorId?`, `CierreFirmaSupervisorId?`, `FechaVerificacionProgramada?`, `ResultadoVerificacion?`, `DeletedAt?`, `CreadoEn`, `ActualizadoEn`
- [x] 1.2 Crear entidad `AccionCorrectivaQE` (FK `QualityEventId`) con `Titulo`, `Descripcion`, `ResponsableId`, `ResponsableNombre`, `PlazoFecha`, `Prioridad`, `Estado` (`PENDIENTE|EN_EJECUCION|CERRADA`, sin `VENCIDA`), `DescripcionEvidencia?`, `EvidenciaUrl?`, `FechaCierre?`, `CreadoEn`, `ActualizadoEn`
- [x] 1.3 Crear entidad `SolicitudAjustePlazoAC` (FK `AccionCorrectivaQEId`) con `FechaSolicitada`, `Justificacion`, `Estado` (`PENDIENTE|APROBADA|RECHAZADA`), `SolicitadoPorId`, `SolicitadoEn`, `RequiereAprobacionGerencia`, `RevisadoPorId?`, `RevisadoEn?`, `ComentarioRevision?`
- [x] 1.4 Crear entidad `QualityEventAuditTrail` (FK `QualityEventId`), append-only, con `Accion`, `EstadoAnterior?`, `EstadoNuevo?`, `CampoModificado?`, `ValorAnterior?`, `ValorNuevo?`, `RealizadoPorId`, `RealizadoPorNombre`, `Timestamp`, `GeneradoPorIA`
- [x] 1.5 Agregar campo `QeId` (Guid?, sin FK enforcement) a la entidad `Incidente` existente (D9 de `design.md`)
- [x] 1.6 Configurar EF Core en `ShacDbContext` (mapeos snake_case, índices: `QualityEvent.EmpresaId`, `QualityEvent.Numero` único por empresa+año, `AccionCorrectivaQE.QualityEventId`, `SolicitudAjustePlazoAC.AccionCorrectivaQEId`, `QualityEventAuditTrail.QualityEventId`) — sin tocar el orden de `UseSnakeCaseNaming()` al final de `OnModelCreating`
- [x] 1.7 Generar y aplicar migración EF Core `AddQualityEvents` (`quality_events`, `acciones_correctivas_qe`, `solicitudes_ajuste_plazo_ac`, `quality_event_audit_trail`)
- [x] 1.8 Generar y aplicar migración EF Core `AddIncidenteQeId` (columna `qe_id` nullable en `incidentes`)

## 2. Quality Events — creación y lectura

- [x] 2.1 Implementar generación de `numero` (`QE-<año>-NNN`) vía `EmpresaSecuencia` con `Tipo = "QE"`, año calendario efectivo (`DateTime.UtcNow.Year`, no un literal hardcodeado), atómico bajo concurrencia (mismo upsert que `IncidenteNumeroGenerator`/`NoConformidadNumeroGenerator`) — D3 de `design.md`
- [x] 2.2 Implementar `QualityEventTransitionValidator` (puerto server-side de `VALID_QE_TRANSITIONS`) — D14 de `design.md`
- [x] 2.3 Implementar `IQualityEventNotificationSender` + `NoOpQualityEventNotificationSender` (best-effort, TODO explícito, un método por disparador: severidad crítica en creación, severidad crítica/alta en cierre, severidad crítica/alta en verificación efectiva) — D16 de `design.md`
- [x] 2.4 Implementar `Features/QualityEvents/CrearQualityEvent` (Command + Validator + Handler EF Core + Endpoint): valida campos base + campo requerido por `origen` (`ORIGIN_REQUIRED_FIELD`, D10); si `origen` es `O1`/`O2`, valida existencia+tenancy del Incidente/NC y que no esté ya vinculado a otro QE (D9.4); `empresaId`/`reportadoPorId` desde JWT; 401 sin empresa activa; `estado: 'ABIERTO'`, `ciclo: 1`; para `origen: 'O3_HALLAZGO_AUDITORIA'` exige `normativaVinculada` server-side (RN-QE-010); invoca notificador si `severidad === 'CRITICA'`; agrega entrada de audit trail `CREADO`
- [x] 2.5 Implementar `Features/QualityEvents/ListarQualityEvents` (Dapper, filtros `estado`/`tipo`/`severidad`/`origen`/`fechaDesde`/`fechaHasta`/`soloReincidencias` (`ciclo > 1`)/`incluirEliminados`/`page`/`pageSize`, respuesta `{ items, pagination }`, scoped por empresa activa) — D20 de `design.md`
- [x] 2.6 Implementar `Features/QualityEvents/ObtenerQualityEvent` (Dapper, `GET /:id`, incluye `accionesCorrectivas` con sus `solicitudesAjustePlazo`, 404 cross-tenant)

## 3. Quality Events — actualización parcial y transición de estado

- [x] 3.1 Implementar `Features/QualityEvents/ActualizarQualityEvent` (`PATCH /:id`, whitelist de `QualityEventUpdateInput`, rechaza `estado` en el body, 422 si el body incluye `descripcion` y `estado !== 'ABIERTO'` — RN-QE-006, D11 —, agrega entrada `CAMPO_EDITADO` por cada campo modificado)
- [x] 3.2 Implementar `Features/QualityEvents/TransicionarEstadoQE` (`PATCH /:id/status`): valida vía `QualityEventTransitionValidator` (D14); bloquea `ANALISIS_COMPLETADO → EN_EJECUCION` si falta `causaRaizDefinitiva` o `causaRaizFirmadaEn` con mensaje legible "RN-QE-002: ..." (D11); bloquea `EN_INVESTIGACION → ANALISIS_COMPLETADO` si `solicitudesAC > 0` (RN-QE-009, D13); agrega entrada `ESTADO_CAMBIADO`
- [x] 3.3 Implementar `Features/QualityEvents/SolicitarACEnQE` (`PATCH /:id/solicitar-ac`, incrementa `solicitudesAC`)
- [x] 3.4 Implementar `Features/QualityEvents/EliminarQualityEvent` (`DELETE /:id`, soft-delete solo si `estado === 'ABIERTO'` y no eliminado previamente, 422 en los demás casos, agrega entrada `ELIMINADO`) — D5 de `design.md`
- [x] 3.5 Implementar `Features/QualityEvents/ReactivarQualityEvent` (`PATCH /:id/reactivar`, solo si `deletedAt` definido, NO fuerza `estado` a `ABIERTO` — conserva el estado previo, agrega entrada `REACTIVADO`) — D5/D6 de `design.md`
- [x] 3.6 Implementar `Features/QualityEvents/EditarReporteInicialQE` (`PATCH /:id/editar-reporte-inicial`): ventana de 2h desde `fechaHoraReporte`, solo si `estado === 'ABIERTO'`, solo reportante original o Supervisor del área (`areasAsignadas.includes(qe.areaId)`); 422 si el body incluye campos protegidos (`numero, origen, tipo, fechaHoraReporte, reportadoPorId, severidad`); whitelist editable (`descripcion, areaId, turno, fechaHoraEvento, mineralInvolucrado, incidenteId, ncId, hallazgoCodigo, normativaVinculada, reporteExternoRef`); agrega entrada `REPORTE_INICIAL_EDITADO` — RN-QE-014, D8
- [x] 3.7 Implementar `Features/QualityEvents/EditarSeveridadQE` (`PATCH /:id/editar-severidad`, solo `JEFE_CALIDAD_SYST`, invoca notificador si nueva severidad es `CRITICA`, agrega entrada `SEVERIDAD_EDITADA`)
- [x] 3.8 Implementar `Features/QualityEvents/EditarMineralQE` (`PATCH /:id/editar-mineral`, solo `JEFE_CALIDAD_SYST`, solo `tipo IN (CALIDAD, OPERACIONAL)`, 422 en otro caso, agrega entrada `MINERAL_EDITADO`)

## 4. Cierre, firma dual y verificación de eficacia

- [x] 4.1 Implementar `Features/QualityEvents/CerrarQE` (`PATCH /:id/cerrar`, requiere `resultadoCierre` 100-500 chars y `plazoVerificacionDias` (default 60), 422 si alguna AC no está `CERRADA` con evidencia — RN-QE-003, D12 —, agrega entrada `CIERRE_INICIADO`)
- [x] 4.2 Implementar `Features/QualityEvents/FirmarCierreQE` (`PATCH /:id/firmar-cierre`, primera firma `JEFE_CALIDAD_SYST` registra `cerradoPorId`; segunda firma con rol resuelto por `ResolverRolSegundaFirma` (siempre `'SUPERVISOR'`, D15/RN-QE-004 reconciliada) completa `estado: 'CERRADO'`; 422 en doble firma del mismo usuario; invoca notificador si `severidad IN (ALTA, CRITICA)`; agrega entrada `FIRMA_REGISTRADA` por cada firma)
- [x] 4.3 Implementar `Features/QualityEvents/VerificacionEficaciaQE` (`POST /:id/verificacion-eficacia`, `resultado EFECTIVO` → `estado: 'VERIFICADO'` + notificador si `severidad IN (ALTA, CRITICA)`; `resultado NO_EFECTIVO` → reapertura: `estado: 'EN_INVESTIGACION'`, `ciclo += 1`, conserva historial completo, entrada `REABIERTO` con `valorNuevo: 'NO_EFECTIVO'` — RN-QE-007, D17)
- [x] 4.4 Implementar `Features/QualityEvents/ForzarVencimientoVerificacion` (`PATCH /:id/forzar-vencimiento-verificacion`, gateado a `IsDevelopment()`, misma reapertura que 4.3 con `valorNuevo: 'VENCIMIENTO_PLAZO'`) — D18, dev-only
- [x] 4.5 Implementar `Features/QualityEvents/ExportarPdfQE` (`POST /:id/export-pdf`, solo registra entrada de audit trail `EXPORTADO_PDF`, sin generar ningún archivo)
- [x] 4.6 Implementar `Features/QualityEvents/ObtenerAuditTrailQE` (Dapper, `GET /:id/audit-trail`, orden descendente por `timestamp`)

## 5. Acciones correctivas del Quality Event

- [x] 5.1 Implementar `Features/QualityEvents/CrearAccionCorrectivaQE` (`POST /:id/acciones-correctivas`, estado inicial `PENDIENTE`, agrega entrada `AC_CREADA`)
- [x] 5.2 Implementar `Features/QualityEvents/ActualizarAccionCorrectivaQE` (`PATCH /:id/acciones-correctivas/:acId`, actualización parcial, 404 si la acción no existe, agrega entrada `AC_ACTUALIZADA`)
- [x] 5.3 Implementar `Features/QualityEvents/CambiarEstadoAccionCorrectivaQE` (`PATCH /:id/acciones-correctivas/:acId/status`): si `estado → 'CERRADA'`, requiere `descripcionEvidencia` no vacía (400 si falta) y fija `fechaCierre` con hora del servidor; si tras el cambio todas las ACs del QE quedan `CERRADA` con evidencia y el QE está en `EN_EJECUCION`, transiciona automáticamente el QE a `PENDIENTE_CIERRE`; agrega entrada `AC_CERRADA`/`AC_ESTADO_CAMBIADO` — D7 de `design.md` (sin sub-ruta `/cerrar` dedicada)
- [x] 5.4 Implementar `AjustePlazoCalculator` (puerto de `plazoAjuste.constants.ts`/`.utils.ts`): tabla `PLAZO_SUGERIDO_DIAS_HABILES`/`PLAZO_MINIMO_DIAS_HABILES` por severidad (`BAJA:30/15, MEDIA:20/10, ALTA:10/5, CRITICA:5/2`), conteo de días hábiles, cálculo de `requiereAprobacionGerencia` (`CRITICA` siempre `true`; `ALTA` `true` si incremento > 50% del plazo sugerido; `BAJA`/`MEDIA` siempre `false`) — D17 de `design.md`, sección I del research
- [x] 5.5 Implementar `Features/QualityEvents/SolicitarAjustePlazoAC` (`POST /:id/acciones-correctivas/:acId/solicitud-plazo`, requiere `fechaSolicitada` + `justificacion` min 50 chars, 422 si el plazo total resultante es menor al mínimo de días hábiles de la severidad del QE, calcula `requiereAprobacionGerencia` vía `AjustePlazoCalculator`)
- [x] 5.6 Implementar `Features/QualityEvents/RevisarAjustePlazoAC` (`PATCH .../solicitud-plazo/:solicitudId`, `APROBADA` actualiza `plazoFecha` de la AC con `fechaSolicitada`; `RECHAZADA` no modifica `plazoFecha`; registra `revisadoPorId`/`revisadoEn`/`comentarioRevision?`)

## 6. Vinculación cross-módulo con Incidentes y No Conformidades

- [x] 6.1 Ampliar `ActualizarInvestigacionCommand`/`ActualizarInvestigacionHandler` (Incidentes) para aceptar `QeId` en el whitelist de campos editables — D9.2 de `design.md`
- [x] 6.2 Ampliar `ActualizarNoConformidadCommand`/`ActualizarNoConformidadHandler` (No Conformidades) para aceptar `QeGeneradoId` en el whitelist de campos editables (el campo ya existe en la entidad desde `be-no-conformidades`) — D9.3 de `design.md`
- [x] 6.3 Test de regresión: confirmar que ampliar ambos comandos no cambia el comportamiento de ningún otro campo ya soportado por `PATCH /api/incidents/:id` / `PATCH /api/nonconformities/:id`

## 7. Multi-tenancy

- [x] 7.1 Verificar que todos los handlers de Quality Events (incluyendo acciones correctivas y solicitudes de ajuste de plazo, que heredan aislamiento del QE padre) filtran por `empresaId === empresaActivaId` antes de cualquier otro filtro/validación y responden 404 (nunca 403) cross-tenant

## 8. Tests

- [x] 8.1 Tests de integración: creación de QE (éxito por cada `origen`, validaciones 400 del campo requerido por origen, 400/422 de `normativaVinculada` faltante en O3, 401 sin empresa activa, 422 si `incidenteId`/`ncId` no existe o ya está vinculado a otro QE, notificación invocada solo si `severidad === 'CRITICA'`)
- [x] 8.2 Tests de integración: numeración correlativa — dos QEs de la misma empresa obtienen números consecutivos con el año calendario real; empresas distintas no interfieren entre sí
- [x] 8.3 Tests de integración: listado/detalle (paginación, filtros incl. `soloReincidencias` e `incluirEliminados`, shape `data.items`, 404 cross-tenant)
- [x] 8.4 Tests de integración: `PATCH /:id` (éxito, rechazo de `estado` en el body, 422 al editar `descripcion` fuera de `ABIERTO`)
- [x] 8.5 Tests de integración: máquina de estados — cada transición válida del mapa, 422 en cualquier combinación no listada, 422 específico de RN-QE-002 (causa raíz incompleta) y RN-QE-009 (solicitudesAC pendiente)
- [x] 8.6 Tests de integración: soft-delete/reactivación (bloqueo por estado, doble eliminación, reactivación preserva `estado` previo sin forzar `ABIERTO`)
- [x] 8.7 Tests de integración: editar-reporte-inicial (dentro/fuera de ventana de 2h, autor válido/inválido, campos protegidos rechazados)
- [x] 8.8 Tests de integración: editar-severidad / editar-mineral (rol autorizado/no autorizado, tipo aplicable/no aplicable)
- [x] 8.9 Tests de integración: cierre y firma dual (bloqueo por AC pendiente sin evidencia, primera/segunda firma, rechazo de doble firma del mismo usuario, notificación en severidad ALTA/CRITICA)
- [x] 8.10 Tests de integración: verificación de eficacia (EFECTIVO → VERIFICADO, NO_EFECTIVO → reapertura con `ciclo+1` e historial intacto), y `forzar-vencimiento-verificacion` (200 en desarrollo, 404 fuera de desarrollo)
- [x] 8.11 Tests de integración: acciones correctivas (creación, actualización, cambio de estado incluyendo cierre con/sin evidencia, auto-transición del QE a `PENDIENTE_CIERRE` cuando corresponde, 404 cross-tenant vía QE padre)
- [x] 8.12 Tests de integración: solicitud/revisión de ajuste de plazo (mínimo de días hábiles por severidad, `requiereAprobacionGerencia` para cada severidad, aprobación actualiza `plazoFecha`, rechazo no la modifica)
- [x] 8.13 Tests de integración: vinculación cross-módulo — `PATCH /api/incidents/:id { qeId }` y `PATCH /api/nonconformities/:id { qeGeneradoId }` persisten correctamente, sin afectar otros campos ya soportados

## 9. Verificación manual y cierre

- [x] 9.1 Ejecutar `dotnet test` y confirmar conteo de tests antes/después (partiendo del conteo actual post-No Conformidades)
- [x] 9.2 Pasada manual mínima end-to-end vía UI (no solo API directa, dado que D11/D12/D13/D14 endurecen el backend más allá del mock): crear QE por cada origen (incl. flujo completo Incidente→QE y NC→QE con vinculación inversa visible en ambas pantallas), recorrer la máquina de estados completa hasta `VERIFICADO`, forzar un ciclo de reapertura por verificación `NO_EFECTIVO`, soft-delete + reactivar, acceso cross-tenant → 404
- [x] 9.3 Documentar en el reporte final: endpoints implementados con status codes verificados, todas las discrepancias resueltas respecto al brief original (ver `proposal.md` "Impact" y `design.md` "Decisions" D1–D21), las 4 preguntas escaladas a Toño y sus respuestas confirmadas 2026-08-20, los 3 ítems de bajo riesgo pendientes de revisión (`design.md` "Open Questions"), estado de los hooks de notificación (TODO vs. infraestructura existente), confirmación de que el cambio quedó propuesto/aplicado en `ShcMvp/openspec/changes/` (no en `ShcMvpEndPoint/openspec/`), y `git status` final
- [x] 9.4 Generar `ShcMvpEndPoint/docs/SESSION-SUMMARY-quality-events.md`, mismo formato que `SESSION-SUMMARY-no-conformidades.md` y `SESSION-SUMMARY-scaffolding-inicial.md`
