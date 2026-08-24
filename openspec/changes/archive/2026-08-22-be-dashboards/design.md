## Context

Dashboard (M5) es puramente un agregador de lectura sobre `QualityEvent`, `NoConformidad`, `Incidente` y sus acciones correctivas — los tres dominios ya existen en el backend .NET (`be-quality-events`, `be-no-conformidades`, `be-incidentes-catalogos`). El frontend ya consume un mock completo (`shc-controldoc/src/mocks/handlers/dashboard.handlers.ts`, 881 líneas) con 9 KPIs y 6 shapes de resumen por rol; este cambio reconstruye ese comportamiento contra datos reales, sin tocar el frontend.

La complejidad real de este cambio no está en los endpoints (dos GET, dos POST/PUT simples) sino en que **el mock modela algunos campos de fecha como valores literales que el backend real nunca persistió como columna** — la entidad `QualityEvent` de EF Core no tiene `FechaCierre`, `FechaAnalisisCompletado` ni `FechaVerificacionRealizada`; esas transiciones solo existen como filas de `QualityEventAuditTrail`, escritas por `TransicionarEstadoQEHandler` y `VerificacionEficaciaQEHandler`/`QEReaperturaHelper`. Este documento fija cómo derivarlas sin añadir columnas redundantes.

## Goals / Non-Goals

**Goals:**
- Reconstruir los 9 KPIs (fórmulas de la Sección 2 del brief de Cowork, verificadas línea por línea contra `dashboard.handlers.ts`) sobre datos reales, scoped a empresa activa.
- Reconstruir los 6 shapes de `GET /api/dashboard/summary` (uno por rol) con paridad exacta de campos frente al mock, salvo los puntos ya diferidos por dependencia de Documentos.
- Agregar las dos tablas de carga manual (`HorasTrabajadas`, `Kpi04ValorAnioAnterior`) con sus endpoints de escritura, gateados a `SUPERADMIN`.

**Non-Goals:**
- No implementar Documentos (M1) ni ningún dato que dependa de él más allá de responder con el valor diferido (`0` / `[]` / `{conEvidencia:0, sinEvidencia:total}`) — ver Decisión D7.
- No crear un job/scheduler de recomputación — ambos GET calculan en vivo en cada request, igual que el mock (que recalcula en cada `GET`, sin cron).
- No optimizar con vistas materializadas ni cacheo — confirmado explícitamente fuera de alcance por Cowork; el volumen de datos actual no lo justifica.
- No modificar `be-quality-events-api`, `be-no-conformidades` ni `be-incidentes-api` — este cambio solo lee de esos dominios (excepto que sí depende de que `QualityEventAuditTrail` siga registrando `ESTADO_CAMBIADO`/`VERIFICACION_EFICACIA`/`REABIERTO` tal como ya lo hace).

## Decisions

### D1 — Dapper para lectura, EF Core para las dos mutaciones nuevas
Mismo patrón CQRS que el resto del proyecto (`ListarQualityEventsHandler`/`ObtenerQualityEventHandler` usan `DapperConnectionFactory` + SQL crudo con agregación en memoria en C#; toda mutación de dominio usa `ShacDbContext`). `ObtenerKpisHandler` y `ObtenerSummaryHandler` consultan con Dapper por dominio (QE, NC, Incidentes, sus tres tablas de AC, `quality_event_audit_trail`) scoped a `empresa_id = @EmpresaId`, y agregan en memoria — exactamente como hace `calcularKpis`/`buildDashboardSummary` en el mock. `CargarHorasTrabajadasHandler`/`CargarKpi04AnioAnteriorHandler` usan EF Core (upsert simple), igual que `ResetPinHandler` y el resto de mutaciones de `Features/Empresas`.

### D2 — Scoping por empresa activa
Todas las consultas filtran por `user.GetEmpresaActivaId()` (mismo extension method que ya usan `ObtenerQualityEventEndpoint`/`VerificacionEficaciaQEEndpoint`), replicando `scopedQes()`/`scopedNcs()`/`scopedIncidentes()`/`scopedDocs()` del mock. `QualityEvent`, `NoConformidad` e `Incidente` ya tienen columna `empresa_id`; no hace falta ningún cambio de esquema para este punto.

### D3 — Fechas de QE derivadas de `QualityEventAuditTrail`, no de columnas nuevas
La entidad `QualityEvent` no tiene `FechaCierre`/`FechaAnalisisCompletado`/`FechaVerificacionRealizada`. Se agrega un helper puro `Features/Dashboard/Shared/QEFechaDerivadaResolver.cs` (equivalente server-side de `fechaEntradaEstado`/`fechaAnalisisCompletado`/`fechaEntradaEstadoActual` del mock) que opera sobre la lista de `QualityEventAuditTrail` ya cargada por empresa:

- `FechaCierre(qe)`: último registro con `Accion == "ESTADO_CAMBIADO" && EstadoNuevo == "CERRADO"`.
- `FechaAnalisisCompletado(qe)`: último registro con `Accion == "ESTADO_CAMBIADO" && EstadoNuevo == "ANALISIS_COMPLETADO"`.
- `FechaVerificacionRealizada(qe)`: último registro con `Accion == "VERIFICACION_EFICACIA"` **o** (`Accion == "REABIERTO" && ValorNuevo == "NO_EFECTIVO"`) — ambas ramas son escritas por `VerificacionEficaciaQEHandler`/`QEReaperturaHelper` en el mismo instante en que se fija `qe.ResultadoVerificacion`. Se excluye deliberadamente la reapertura `VENCIMIENTO_PLAZO` que escribe `ForzarVencimientoVerificacionHandler` (RN-QE-008, dev-only): esa reapertura nunca fija `ResultadoVerificacion`, así que no debe contar como "fecha de verificación realizada". Confirmado leyendo ambos handlers — los únicos dos escritores de `REABIERTO` en el código son `QEReaperturaHelper` (motivo `"NO_EFECTIVO"`) y `ForzarVencimientoVerificacionHandler` (motivo `"VENCIMIENTO_PLAZO"`).
- `FechaEntradaEstadoActual(qe)`: último registro con `EstadoNuevo == qe.Estado.ToString()`, o `qe.FechaHoraReporte` si no hay ninguno (mismo fallback que el mock, usado solo en `AltaDireccion.resumenPorModulo.qualityEvents.vencidos`).

Alternativa descartada: agregar columnas `FechaCierre`/`FechaVerificacionRealizada` a `QualityEvent` y poblarlas en `TransicionarEstadoQEHandler`/`VerificacionEficaciaQEHandler`. Se descarta porque duplicaría una fuente de verdad que el audit trail ya captura correctamente, y porque tocar esos handlers está fuera del alcance de este cambio (son de `be-quality-events-api`, no de Dashboard).

### D4 — `NoConformidad.FechaCierre` (revisada tras confirmación de Cowork — ver D13) / `FechaVerificacion` se usa tal cual
A diferencia de QE, `NoConformidad` sí tiene una columna `FechaVerificacion` persistida y editable vía `PATCH /api/nonconformidades/:id` (`ActualizarNoConformidadHandler`, siempre valor enviado por el cliente) que sí representa la fecha real en que se realizó la verificación de eficacia — se usa literalmente en KPI-05 (`fechaVerificacionPadre` para AC de origen NC), igual que el mock; sin discrepancia conocida para este campo. `FechaCierre`, en cambio, **no** representa la fecha real de cierre — ver D13, que reemplaza el uso literal que tenía originalmente esta decisión en `tendenciaTrimestral.ncCerradas`.

### D13 — `NoConformidad.FechaCierre` derivada de `NoConformidadAuditTrail` para `tendenciaTrimestral.ncCerradas` (fix post-implementación, confirmado por Cowork)
`NoConformidad.FechaCierre` es la fecha límite **esperada** de cierre — requerida en `POST /api/nonconformities`, editable manualmente vía `PATCH /:id`, pero **nunca actualizada automáticamente** cuando la NC transiciona a `CERRADA` (confirmado leyendo `ActualizarNoConformidadHandler.cs`, `CerrarAccionCorrectivaHandler.cs` y `nonconformities.handlers.ts` — ningún camino, ni backend ni mock, la sincroniza con el cierre real). D4 (versión original de este documento) asumía erróneamente que podía usarse tal cual para `tendenciaTrimestral.ncCerradas`; Cowork lo confirmó como bug real antes de archivar el cambio.

Fix: mismo patrón que D3 para QE. `Features/Dashboard/Shared/NCFechaDerivadaResolver.FechaCierreReal(nc)` deriva la fecha real de cierre como la última entrada de `NoConformidadAuditTrail` con `Accion == "CAMPO_EDITADO" && CampoModificado == "estado" && ValorNuevo == "CERRADA"` (escrita por `ActualizarNoConformidadHandler.TrackChange` — único camino que puede llevar una NC a `CERRADA`; `AnularNoConformidadHandler` escribe `Accion: "ANULADA"` sin tocar este campo, y nunca lleva a `CERRADA`). `DashboardDataFetcher.FetchNoConformidadesAsync` ahora también carga `NoConformidad.AuditTrail` (antes no se cargaba, porque nada lo necesitaba). `NoConformidad.FechaCierre` en sí **no se toca** — sigue siendo la fecha límite esperada correcta para todo lo que `be-no-conformidades` ya expone (detalle de NC).

### D5 — Constantes de plazo propias de Dashboard, no reutilización de `AjustePlazoCalculator`
`AjustePlazoCalculator` (ya existe en `Features/QualityEvents/Shared/`) expone `PlazoSugeridoDiasHabiles`/`PlazoMinimoDiasHabiles`, que sirven para RN-QE-014 (ajuste de plazo de una AC individual) — **no son la misma tabla** que `PLAZO_MAXIMO_QE_DIAS_HABILES` (BAJA=22, MEDIA=17, ALTA=14, CRITICA=10) que KPI-01/03 y `tasaCierreEnPlazoPorArea` usan para juzgar si un QE cerrado estuvo "en plazo" de punta a punta. Se agrega esta tabla y `PLAZO_MAXIMO_QE_POR_ESTADO_DIAS_HABILES`/`PlazoMaximoQEPorEstado(...)` (usada solo por `AltaDireccion.resumenPorModulo.qualityEvents.vencidos`) como constantes nuevas en `Features/Dashboard/Shared/DashboardKpiConstants.cs`, puerto directo de `kpi.constants.ts` (`PLAZO_MAXIMO_QE_DIAS_HABILES`, `PLAZO_MAXIMO_QE_POR_ESTADO_DIAS_HABILES`, `plazoMaximoQEPorEstado`). Sí se reutiliza `AjustePlazoCalculator.ContarDiasHabiles` para todo el conteo de días hábiles (KPI-01/02/03/07 y el cálculo de vencidos) — ya existe y es idéntico en semántica (lunes a viernes, sin calendario de feriados) al `contarDiasHabiles` del frontend.

### D6 — Semáforo de "por vencer" (`accionesCorrectivasPorVencer`, JefeCalidad) sin portar `semaforoPendientes.ts` completo
El mock usa `calcularEstadoSemaforoDesdeFecha(ac.plazoFecha).diasHabilesRestantes <= 5`. En vez de portar el módulo `semaforo.types`/`semaforoPendientes.ts` completo (que no tiene equivalente backend todavía), se resuelve inline con `AjustePlazoCalculator.ContarDiasHabiles(DateTime.UtcNow, ac.PlazoFecha) <= 5` — mismo resultado numérico, sin introducir un tipo `SemaforoEstadoFila` que Dashboard es el único consumidor.

### D7 — Puntos dependientes de Documentos: diferidos con el mismo criterio en los 4 lugares donde aparecen
Cowork ya definió el criterio para KPI-06 y `OperarioDashboardData.documentosPendientesLectura` (proposal.md, decisión 0.1). Al reconstruir los 6 shapes contra el código real del mock aparecen dos lugares adicionales con la misma dependencia, no mencionados explícitamente en el brief pero resueltos con el mismo criterio (sección "Qué NO hacer" del brief prohíbe implementar Documentos, no prohíbe extender el criterio de diferido):
- `AltaDireccionDashboardData.resumenPorModulo.documentos` → `{ total: 0, publicados: 0, vencidosRevision: 0 }`.
- `AuditorDashboardData.evidenciasHallazgos` → `{ conEvidencia: 0, sinEvidencia: hallazgosO3.Count }` (todo hallazgo cuenta como "sin evidencia" porque `QualityEvent.DocumentosVinculados` tampoco existe como columna en el backend — ver D8).
Todos con el mismo comentario `// TODO(be-documentos): ...` que KPI-06.

### D8 — `QualityEvent.DocumentosVinculados` no existe en el backend
El mock usa `qe.documentosVinculados.length > 0` para `evidenciasHallazgos` (rol AUDITOR). La entidad `.NET` no tiene ese campo (ni falta, porque documentos no existe). Se resuelve como parte de D7: siempre "sin evidencia". Si en un cambio futuro se implementa Documentos con vinculación a QE, este cálculo pasa a ser responsabilidad de ese cambio, no de una re-apertura de Dashboard.

### D9 — Gate de rol de `/api/dashboard/kpis`
El mock no gatea este endpoint por rol. Este cambio lo restringe a los 6 roles que sí mapean a un shape de `/summary` (`OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO, ALTA_DIRECCION`), replicando el mismo mapeo que `getDashboardDataTypeForRole` — consistente con el invariante de CLAUDE.md ("`ADMINISTRADOR_SISTEMA` NO tiene acceso a ningún módulo operativo"). `SUPERADMIN`/`ADMINISTRADOR_EMPRESA`/`ADMINISTRADOR_SISTEMA` reciben 403, igual que ya reciben en `/summary`.

### D10 — Carga manual: EF Core, upsert por clave natural, gate `SUPERADMIN`
`HorasTrabajadas` (clave natural `empresa_id + area_id + periodo`) y `Kpi04ValorAnioAnterior` (clave natural `empresa_id + periodo`) se modelan como entidades EF Core simples sin FK a `Area` (mismo criterio "sin FK enforcement" que `QualityEvent.AreaId`/`Incidente.AreaId`). El endpoint hace upsert (`INSERT ... ON CONFLICT DO UPDATE` vía EF Core `ExecuteUpdateAsync`/lectura-modificación simple) — no historiza versiones anteriores, coherente con que es un valor operacional que se corrige, no un hecho de auditoría. Gateado a `SUPERADMIN`: no existe en el proyecto un rol más específico para "carga de datos organizacionales" (verificado — los 7 endpoints existentes bajo `Features/Empresas/*` que hacen algo administrativo, incluido `ResetPin`, usan `SUPERADMIN` sin excepción).

### D11 — KPI-04: suma de horas de todas las áreas de la empresa, no solo del área del QE/incidente
Igual que el mock (`horasTrabajadasFixtures.filter(h => h.periodo === periodo).reduce(...)`, sin filtrar por área): `SUM(horas) FROM horas_trabajadas WHERE empresa_id = @EmpresaId AND periodo = @Periodo`, sin `GROUP BY area_id`. La tabla persiste `area_id` por fila (para que la carga manual pueda hacerse área por área, como pide Cowork) pero el KPI-04 real agrega sobre toda la empresa.

### D12 — Formato de `Periodo`
`YYYY-MM` como `string`, igual que el mock y el contrato ya usado en `KpiResult.periodo`. Se valida con `FluentValidation` (`Matches(@"^\d{4}-\d{2}$")`), mismo patrón de validación que el resto de comandos del proyecto.

## Risks / Trade-offs

- **[Riesgo]** La derivación de `FechaCierre`/`FechaAnalisisCompletado`/`FechaVerificacionRealizada` desde `QualityEventAuditTrail` asume que **todo** cambio de estado relevante pasó por `TransicionarEstadoQEHandler` (el único escritor de `ESTADO_CAMBIADO`). Si en el futuro se agrega otro camino que cambie `qe.Estado` sin escribir esa entrada de audit trail, KPI-01/02/03/07 quedarían silenciosamente incompletos. → **Mitigación**: es el mismo riesgo estructural que ya asume RN-QE-001 ("transiciones son inmutables en audit trail") en todo el resto del sistema; no es nuevo de este cambio, y un test de integración de KPI-01/07 sobre un QE cerrado por el flujo real (`TransicionarEstadoQE` real, no un fixture insertado a mano) lo cubre.
- **[Riesgo]** Calcular 9 KPIs + un resumen de rol en memoria en cada request, sobre todo el histórico de QE/NC/Incidentes de la empresa (sin paginación ni ventana de fecha en la consulta base), puede degradar con datasets grandes. → **Mitigación**: explícitamente aceptado por Cowork ("no optimices prematuramente"); si el volumen real de una empresa lo justifica, un cambio futuro dedicado puede acotar la consulta base por rango de fechas antes de agregar en memoria, sin cambiar el contrato de los endpoints.
- **[Trade-off]** `evidenciasHallazgos` y `resumenPorModulo.documentos` siempre devuelven "sin evidencia"/cero mientras Documentos no exista — el dashboard de AUDITOR/ALTA_DIRECCION mostrará esas secciones vacías en producción hasta que se implemente Documentos. Aceptado explícitamente por Cowork para KPI-06; se extiende el mismo trade-off a estos dos campos adicionales (D7).

## Migration Plan

1. Migración EF Core: dos tablas nuevas (`horas_trabajadas`, `kpi04_valor_anio_anterior`), sin tocar tablas existentes — sin riesgo de downtime ni de romper datos existentes.
2. Sin rollback especial: son tablas aditivas; un rollback de la migración simplemente las elimina (vacías al desplegar, se llenan solo vía los endpoints de carga manual que este mismo cambio introduce).
3. Los dos GET (`/kpis`, `/summary`) no requieren backfill — calculan en vivo desde el primer deploy; antes de que alguien cargue `HorasTrabajadas`/`Kpi04ValorAnioAnterior`, KPI-04 simplemente da `0`/semáforo `ROJO` (mismo comportamiento que el mock cuando no hay fixture para el periodo consultado).

## Open Questions

Recogidas también en proposal.md → Impact, para decisión humana antes de `/opsx:apply` (o durante, si Cowork prefiere resolverlas en el momento):

1. ~~¿`NoConformidad.FechaCierre` debe seguir tratándose como fecha real de cierre para `tendenciaTrimestral.ncCerradas`?~~ **Resuelta** — Cowork confirmó que es un bug real (no solo una discrepancia teórica) y pidió el fix; ver D13. `tendenciaTrimestral.ncCerradas` ahora usa `NCFechaDerivadaResolver.FechaCierreReal`, no el campo literal.
2. ¿Gatear `/api/dashboard/kpis` a los 6 roles operativos (D9) es aceptable, o debe quedar abierto a cualquier autenticado como en el mock? Se implementa gateado por defecto (más estricto, alineado con CLAUDE.md) salvo indicación contraria. **Sigue pendiente de confirmación.**
