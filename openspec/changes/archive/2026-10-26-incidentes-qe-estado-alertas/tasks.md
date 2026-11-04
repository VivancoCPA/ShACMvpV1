## 0. Precondición

- [x] 0.1 Confirmar que `fix-incidentes-detalle-nombres-ubicacion`, `incidentes-ajustes-ui` e `incidentes-edicion-campos-basicos` están cerrados (con "listo" de Toño). Confirmar que existen `getIncidentQEPlazoInfo` y el tooltip nuevo de `IncidentSinQEBadge`. Si `incidentes-edicion-campos-basicos` permite editar `Tipo`/`FechaEvento`, revisar la CicloClave de D7 antes de seguir

## 1. Backend — sincronización de estado y vínculo (incident-qe-sync)

- [x] 1.1 Crear `Features/Incidentes/Shared/IncidenteQeSync.cs`: `MapearEstado(QEEstado)` con switch exhaustivo, `SincronizarAsync(db, qe, now, ct, motivo?)` y `DesvincularAsync(db, qe, now, motivo, ct)`, con el audit `ESTADO_SINCRONIZADO_QE` (actor "Sistema", `GeneradoPorIA = true`) y filtro por empresa (design D1, D5)
- [x] 1.2 Extraer la resolución de destinatarios de `CambiarEstadoIncidenteHandler` a `IncidenteNotificacionDestinatariosResolver` (reportante + responsables de AC no cerradas, sin el actor)
- [x] 1.3 Llamar a `SincronizarAsync` antes del `SaveChangesAsync` en `TransicionarEstadoQEHandler`, en `CambiarEstadoAccionCorrectivaQEHandler` (rama PENDIENTE_CIERRE), en `FirmarCierreQEHandler` (segunda firma) y en `VerificacionEficaciaQEHandler` (rama EFECTIVO). Después del commit, notificación best-effort si el estado cambió
- [x] 1.4 Convertir `QEReaperturaHelper.Reabrir` en `ReabrirAsync`, que llama a `SincronizarAsync`. Actualizar `VerificacionEficaciaQEHandler` (NO_EFECTIVO) y `ForzarVencimientoVerificacionHandler`, y que cada uno notifique best-effort
- [x] 1.5 Volver a ejecutar `grep -rnE '\.Estado\s*=[^=]' Features/QualityEvents` y confirmar que no queda ningún cambio de estado de QE sin sincronizar
- [x] 1.6 `CrearQualityEventHandler`: vinculación atómica O1 con `ExecuteUpdateAsync(... WHERE qe_id IS NULL)`, verificación de 1 fila afectada (si no, 422) y audit `QE_VINCULADO` en el incidente, dentro de la transacción existente (D3)
- [x] 1.7 `EliminarQualityEventHandler`: si hay `IncidenteId`, llamar a `DesvincularAsync` con el motivo "QE {numero} eliminado"
- [x] 1.8 `ReactivarQualityEventHandler`: volver a vincular con un UPDATE condicional si el incidente está libre, no eliminado y en ABIERTO; si no, 422 `INCIDENTE_YA_VINCULADO` (D5)

## 2. Backend — endpoints de incidente

- [x] 2.1 `CambiarEstadoIncidenteHandler`: solo `ABIERTO → ANULADO` sin `QeId`; cualquier otro caso → `BusinessRuleException(..., "ESTADO_GOBERNADO_POR_QE")`. Verificar que el 422 expone el `errorCode`
- [x] 2.2 `ActualizarInvestigacionHandler`: un `QeId` distinto del actual → 422 `QE_VINCULO_GESTIONADO_POR_QE`; si coincide, se ignora; nunca asigna `QeId`. Comprobar con grep que no hay otros consumidores
- [x] 2.3 Agregar `NotificarCreacionAsync` a `IIncidenteNotificationSender`, implementarlo en `IncidenteNotificationSender`, y registrar la llamada en `CrearIncidenteHandler` después del `CommitAsync`, best-effort con `LogWarning`. Destinatarios JCA y SUP activos, más ALTA_DIRECCION si la severidad es ALTA o CRITICA; sin el actor; tipo `SEVERIDAD_CRITICA` o `CAMBIO_ESTADO`

## 3. Backend — plazo para vincular el QE y escáner

- [x] 3.1 Crear `Features/Incidentes/Shared/IncidentePlazoQe.cs`, con `PlazoHoras`, `Evaluar(incidente, ahora)`, `EsActivoSinQe` y umbral 0,75 (D6)
- [x] 3.2 Agregar `EscanearIncidentesSinQeAsync` a `VencimientoScanner.ScanAsync`: ramas PREAVISO y VENCIDO con `CicloClave` `QE_PREAVISO`/`QE_VENCIDO`, idempotencia por incidente y ciclo, destinatarios JCA y SUP activos sin duplicar, mensajes de la instrucción, `link /incidents/{id}`, y audit `PLAZO_QE_VENCIDO` solo en VENCIDO (D7)

## 4. Backend — dashboard

- [x] 4.1 Agregar `IncidentesSinQeVencidos` (`List<IncidenteResumen>`) e `IncidentesSinQeVencidosTotal` a `JefeCalidadDashboardData`
- [x] 4.2 `BuildJefeCalidad` recibe `ahora`, filtra con `IncidentePlazoQe`, ordena del más vencido al menos y toma 10. Actualizar la llamada en `ObtenerSummaryHandler`

## 5. Backend — enlaces de notificaciones y migración

- [x] 5.1 `IncidenteNotificationSender` → `/incidents/{id}`; `NoConformidadNotificationSender` (2 lugares) → `/nonconformities/{id}`
- [x] 5.2 `AsignacionNotificacion` suma `Link`, y los 3 call sites (Incidentes, NC y QE `ActualizarAccionCorrectiva*Handler`) pasan la ruta de su entidad de origen
- [x] 5.3 `VencimientoScanner.EvaluarYNotificarAsync` recibe `link`; cada `Join` arma la ruta de su origen
- [x] 5.4 Detener el backend y correr `dotnet ef migrations add FixLinksNotificacionesYEstadoIncidentes`. En `Up()`, solo SQL: los 2 `replace`, los 3 `UPDATE … FROM acciones_correctivas_*` con los nombres reales del snapshot, y la alineación del estado de los incidentes con su QE según el mapeo D6. `Down()` queda vacío, con un comentario. Verificar que el `ModelSnapshot` no cambió

## 6. Backend — tests

- [x] 6.1 `IncidenteQeSync`: mapeo de cada `QEEstado`, audit `ESTADO_SINCRONIZADO_QE`, QE sin incidente no hace nada, QE de otra empresa no toca el incidente
- [x] 6.2 Integración del ciclo de un QE O1: al crearlo el incidente tiene `QeId` y está en ABIERTO, al transicionar lo sigue, al firmar el cierre queda CERRADO, al verificar EFECTIVO sigue CERRADO, al reabrir pasa a EN_INVESTIGACION
- [x] 6.3 Eliminar y reactivar un QE: el incidente se desvincula, se vuelve a vincular, o la reactivación responde 422 `INCIDENTE_YA_VINCULADO`
- [x] 6.4 `PATCH /status`: a EN_INVESTIGACION → 422 `ESTADO_GOBERNADO_POR_QE`; a ANULADO sin QE → 200; a ANULADO con QE → 422. `PATCH /:id` con otro `qeId` → 422 `QE_VINCULO_GESTIONADO_POR_QE`
- [x] 6.5 Escáner con `ahora` fijo: ACCIDENTE con 19 h → preaviso sin audit; con 25 h → vencido con audit; la segunda corrida no duplica; con QE, eliminado o ANULADO → nada; usuarios inactivos o de otra empresa → nada
- [x] 6.6 Creación de incidentes: severidad MEDIA → JCA y SUP sin ALTA_DIRECCION; CRITICA → también ALTA_DIRECCION, con tipo `SEVERIDAD_CRITICA`; el actor queda excluido; si el sender falla, la respuesta sigue siendo 201
- [x] 6.7 Dashboard: `IncidentesSinQeVencidos` ordenado y limitado a 10, más el total
- [x] 6.8 Links: las notificaciones nuevas de incidente, NC, asignación de AC (3 orígenes) y vencimiento de AC llevan rutas válidas
- [x] 6.9 Paridad de `IncidentePlazoQe` con `PLAZO_QE_HORAS` del frontend

## 7. Frontend

- [x] 7.1 `IncidentDetailPage`: `IncidentSinQEBadge` junto a "Crear QE" cuando el nivel es AMARILLO o ROJO; si hay `qeId`, aviso `detail.qeGobiernaEstado` con enlace al QE y sin badge. Los hooks van antes de cualquier `return`; con variante `dark:` en todo el estilo
- [x] 7.2 `QualityEventForm`: quitar `mutateVincularQE` y navegar directo en O1. Eliminar `useVincularQE` de `features/incidents/hooks/useIncidents.ts` y de su export, si queda sin uso
- [x] 7.3 Invalidar `INCIDENT_QUERY_KEYS.all` en `useDeleteQualityEvent`, y en `useUpdateQEAccion` si cambia el estado de una AC (verificar). Los demás hooks ya lo hacen (design, divergencia 2)
- [x] 7.4 Mapear `ESTADO_GOBERNADO_POR_QE` y `QE_VINCULO_GESTIONADO_POR_QE` a `incidents:errors.*` en el manejo de errores existente
- [x] 7.5 Router: componente `LegacyRedirect` y rutas `/incidentes/:id` y `/no-conformidades/:id` dentro de `AppShell`
- [x] 7.6 Tipos del summary: `incidentesSinQeVencidos: IncidenteResumen[]` e `incidentesSinQeVencidosTotal: number` en `JefeCalidadDashboardData`
- [x] 7.7 Crear `features/dashboard/components/IncidentesSinQeVencidosWidget.tsx` (número, tipo, "Vencido hace …" con `getIncidentQEPlazoInfo`, enlace, estado vacío, dark mode) y montarlo en `JefeCalidadDashboard`
- [x] 7.8 i18n `es-PE`/`en-US`: `incidents:detail.qeGobiernaEstado`, `incidents:errors.ESTADO_GOBERNADO_POR_QE`, `incidents:errors.QE_VINCULO_GESTIONADO_POR_QE`, `dashboard:incidentesSinQeVencidos.{title,empty,vencidoHace}`, y las etiquetas de audit `ESTADO_SINCRONIZADO_QE`, `PLAZO_QE_VENCIDO` y `QE_VINCULADO` junto a las demás acciones del audit trail del incidente

## 8. MSW

- [x] 8.1 `incidents.handlers.ts`: `PATCH /:id/status` → 422 `ESTADO_GOBERNADO_POR_QE` salvo ANULADO sin `qeId`; `PATCH /:id` con otro `qeId` → 422 `QE_VINCULO_GESTIONADO_POR_QE`
- [x] 8.2 `quality-events.handlers.ts`: helper `syncIncidentFromQE` (mapeo D6 + audit) en todos los handlers que cambian `estado`; vinculación atómica en `POST` O1; desvinculación en `DELETE`; re-vinculación o 422 en la reactivación. Usar siempre `getIncidentsStore()`
- [x] 8.3 `dashboard.handlers.ts`: `incidentesSinQeVencidos` y su total para JEFE_CALIDAD
- [x] 8.4 Actualizar los tests de handlers que hoy usan `PATCH /status` para avanzar estados o `PATCH /:id { qeId }`

## 9. Frontend — tests

- [x] 9.1 `IncidentDetailPage`: sin QE y vencido → badge junto a "Crear QE"; con QE → aviso con número y enlace, sin badge
- [x] 9.2 `QualityEventForm`: al crear un QE O1 no se emite ningún PATCH al incidente y se invalida la caché de incidentes
- [x] 9.3 Router: `/incidentes/abc` → `/incidents/abc` y `/no-conformidades/abc` → `/nonconformities/abc`
- [x] 9.4 `IncidentesSinQeVencidosWidget`: con datos, vacío y enlace

## 10. Verificación

- [x] 10.1 Suite completa del frontend (`vitest run`) y del backend (`dotnet test`) en verde
- [x] 10.2 `tsc --noEmit` sin errores
- [x] 10.3 `npm run lint` con cero errores
- [x] 10.4 Detener el backend → `dotnet ef database update` → `dotnet build` → `dotnet run` → Ctrl+F5 (si aparece algo viejo, cerrar el `ShcMvpEndPoint.exe` colgado)
- [x] 10.5 Prueba manual con MSW apagado (los 6 pasos de la instrucción §6): la hace Toño
