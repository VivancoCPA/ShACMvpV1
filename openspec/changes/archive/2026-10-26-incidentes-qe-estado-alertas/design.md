## Context

La instrucción de Cowork (2026-10-21) diagnostica cinco huecos en la relación Incidente ↔ QE (ver proposal). Antes de escribir este diseño se verificó cada punto contra el código real. Las divergencias encontradas están en la sección **Divergencias con la instrucción**.

Estado actual relevante:

- `IncidentStateMachine` modela un flujo lineal ABIERTO → … → CERRADO, más ABIERTO → ANULADO. Solo lo usa `CambiarEstadoIncidenteHandler`, y ninguna pantalla lo invoca.
- Los cambios de `QualityEvent.Estado` (grep `\.Estado\s*=` en `Features/QualityEvents`) ocurren en:
  - `CrearQualityEventHandler` (ABIERTO, en el inicializador);
  - `TransicionarEstadoQEHandler:39` (genérico; incluye CERRADO → EN_VERIFICACION);
  - `CambiarEstadoAccionCorrectivaQEHandler:58` (→ PENDIENTE_CIERRE);
  - `FirmarCierreQEHandler:81` (→ CERRADO);
  - `VerificacionEficaciaQEHandler:26` (→ VERIFICADO);
  - `QEReaperturaHelper:16` (→ EN_INVESTIGACION), que comparten `VerificacionEficaciaQEHandler` (NO_EFECTIVO) y `ForzarVencimientoVerificacionHandler`.
  
  `CerrarQEHandler` **no** cambia el estado: solo registra `ResultadoCierre`. `EliminarQualityEventHandler` y `ReactivarQualityEventHandler` tampoco cambian el estado, pero sí afectan al vínculo (ver D5).
- El índice único parcial de notificaciones `(EntidadTipo, EntidadId, UsuarioId, CicloClave) WHERE tipo = 'VENCIMIENTO'` ya existe (migración `AddNotificacionCicloClave`).

## Goals / Non-Goals

**Goals:**
- El estado del incidente es siempre una función del estado de su QE, sin intervención manual y con trazabilidad.
- La vinculación Incidente ↔ QE es atómica server-side.
- El plazo para vincular un QE (RN-INC-006) tiene efecto real en el backend: notificación, audit trail y visibilidad en el dashboard.
- Toda notificación, nueva o ya guardada, lleva a una pantalla existente.

**Non-Goals:**
- La UI para **anular** un incidente: no existe hoy en el frontend (`useUpdateIncidentStatus` no tiene consumidores) y no se construye aquí. El backend deja el camino `ABIERTO → ANULADO` listo.
- Retirar `IncidentACSection`: queda como está. Con D1 las acciones correctivas se trabajan en el QE. Cowork se lo plantea a Toño.
- El escalado de PRD §3.3 para CONDICION_INSEGURA ("sin AC en 48 h → Jefe SyST"): en la práctica lo cubre D2 (48 h sin QE).
- Email (P-08).
- La vinculación NC ↔ QE (`useVincularNC`) tiene el mismo patrón no atómico de dos requests. Queda fuera de alcance y anotado para un change futuro.

## Decisions

### D1. `IncidenteQeSync` como helper estático invocado antes de cada `SaveChangesAsync`

`Features/Incidentes/Shared/IncidenteQeSync.cs`, con `SincronizarAsync(ShacDbContext db, QualityEvent qe, DateTime now, CancellationToken ct, string? motivo = null)`:

- Si `qe.IncidenteId` es null, no hace nada.
- Carga el incidente filtrando por `Id` **y** `EmpresaId == qe.EmpresaId`. Si no existe o está eliminado (`DeletedAt != null`), no hace nada.
- Calcula el destino con un `switch` exhaustivo sobre `QEEstado`, según la tabla D6 de la instrucción. Un estado `REABIERTO` persistido no existe en el backend (la reapertura va directo a EN_INVESTIGACION), así que no necesita un caso propio.
- Si el destino difiere del estado actual: asigna `Estado` y `ActualizadoEn`, y agrega `db.IncidenteAuditTrail.Add(...)` con `Accion = "ESTADO_SINCRONIZADO_QE"`, `EstadoAnterior`, `EstadoNuevo`, `ValorNuevo = qe.Numero`, `Motivo = motivo` (si la entidad tiene `Motivo`; si no, `CampoModificado = "motivo"`), `RealizadoPorId = "system"`, `RealizadoPorNombre = "Sistema"` y `GeneradoPorIA = true`.
- **No** valida contra `IncidentStateMachine`: el QE ya validó su propia transición, y una reapertura va de CERRADO a EN_INVESTIGACION.
- Devuelve el incidente si cambió (o null), para que el handler pueda disparar la notificación best-effort después del commit.

Puntos de llamada: `TransicionarEstadoQEHandler`, `CambiarEstadoAccionCorrectivaQEHandler` (solo dentro de la rama que asigna PENDIENTE_CIERRE), `FirmarCierreQEHandler` (rama de la segunda firma), `VerificacionEficaciaQEHandler` (rama EFECTIVO) y `QEReaperturaHelper.Reabrir`. Al ir dentro de `Reabrir`, cubre la reapertura por NO_EFECTIVO y `ForzarVencimientoVerificacion` sin duplicar código. Para eso `Reabrir` pasa a ser `async Task ReabrirAsync(...)`, y se actualizan sus 2 callers. `CrearQualityEventHandler` no necesita la llamada: el QE nace ABIERTO y el incidente ya está en ABIERTO, pero la vinculación sí se hace ahí (D3).

*Alternativa descartada:* un `SaveChangesInterceptor` de EF que detecte cambios de `QualityEvent.Estado`. Es más "mágico" y difícil de testear, y saca la lógica de dominio de los handlers. Se prefiere la llamada explícita, igual que con los audit trail existentes.

**Notificación tras la sincronización:** se implementa, reusando `IIncidenteNotificationSender.NotificarCambioEstadoAsync` con la misma resolución de destinatarios que `CambiarEstadoIncidenteHandler` (reportante + responsables de AC del incidente no cerradas, sin el actor). Esa resolución se extrae a un método estático compartido (`IncidenteNotificacionDestinatariosResolver`). Va best-effort, después del `SaveChangesAsync`, en los 5 handlers. Si la inyección del sender en `QEReaperturaHelper` complica (es estático), la reapertura notifica desde sus dos handlers llamantes.

### D2. Mapeo D6 en un único lugar, espejado en MSW

`IncidenteQeSync.MapearEstado(QEEstado) → IncidentEstado` es público y estático. El handler MSW de QE tiene su espejo `mapQEEstadoToIncidentEstado` en `mocks/handlers/quality-events.handlers.ts`. No se agrega al frontend de producción, porque ningún componente lo necesita.

### D3. Vinculación atómica en `CrearQualityEventHandler`

En la rama `O1_INCIDENTE_CAMPO`, la entidad `incidente` ya cargada (y validada) queda en una variable, y tras construir el QE se asigna `incidente.QeId = qe.Id; incidente.ActualizadoEn = now;`, además de una entrada de audit trail del incidente `QE_VINCULADO` (`ValorNuevo = qe.Numero`, actor real). Todo entra en la transacción existente. La validación "ya vinculado" no cambia.

**Concurrencia:** dos `POST` simultáneos sobre el mismo incidente podrían pasar ambos la validación. Se mitiga con un `UPDATE incidentes SET qe_id = @qe WHERE id = @id AND qe_id IS NULL` (`ExecuteUpdateAsync`) que verifique 1 fila afectada, en vez de la asignación por tracking. Si afecta 0 filas, responde 422 "El incidente ya está vinculado a otro Quality Event". El audit trail se agrega igual vía `db.IncidenteAuditTrail.Add`.

### D4. Endpoints de incidente que dejan de gobernar estado o vínculo

- `CambiarEstadoIncidenteHandler`: antes de la máquina de estados, si `command.Estado != ANULADO` **o** `incidente.QeId != null`, lanza `BusinessRuleException("El estado del incidente lo determina su Quality Event.", "ESTADO_GOBERNADO_POR_QE")`, que mapea a 422 con ese `errorCode`. `ABIERTO → ANULADO` sigue validado por `IncidentStateMachine`. La máquina de estados se conserva sin cambios, como documentación del flujo y porque el mapeo D6 la respeta en el sentido de avance.
- `ActualizarInvestigacionHandler`: si `command.QeId` viene con valor y es distinto de `incidente.QeId`, lanza 422 `QE_VINCULO_GESTIONADO_POR_QE`. Si coincide, se ignora en silencio (el frontend puede reenviar el incidente completo). El campo `QeId` se mantiene en el command, para que un cliente viejo reciba un 422 claro en vez de que se ignore lo que manda. Grep confirmado: el único consumidor del camino era `useVincularQE` en `QualityEventForm.tsx`.

### D5. Eliminar y reactivar el QE

`EliminarQualityEventHandler` solo permite eliminar en ABIERTO (soft delete), así que **no** está bloqueado para un QE con incidente: se respeta la instrucción y se desvincula. Si `qe.IncidenteId` no es null: `incidente.QeId = null`, y el estado queda en ABIERTO (ya lo estaba, porque el QE estaba en ABIERTO). Se registra `ESTADO_SINCRONIZADO_QE` con motivo "QE {numero} eliminado" **aunque el estado no cambie**, porque lo que cambia es el vínculo y tiene que quedar trazado. Para eso, `IncidenteQeSync` expone `DesvincularAsync(db, qe, now, motivo, ct)`. `QualityEvent.IncidenteId` se conserva en el QE eliminado, como referencia histórica.

**Divergencia:** la instrucción no menciona `ReactivarQualityEvent`. Sin tratarlo, reactivar un QE O1 dejaría un QE "vinculado" a un incidente que ya no lo apunta. Decisión: si el incidente sigue con `QeId == null`, no está eliminado y está en ABIERTO, se vuelve a vincular (mismo `UPDATE` condicional de D3, audit `QE_VINCULADO`). Si mientras tanto el incidente se vinculó a otro QE o se anuló, responde 422 `INCIDENTE_YA_VINCULADO` y el QE sigue eliminado.

### D6. Plazo para vincular el QE en el backend (`IncidentePlazoQe`)

`Features/Incidentes/Shared/IncidentePlazoQe.cs` es el puerto de `PLAZO_QE_HORAS` (ACCIDENTE 24, INCIDENTE 48, CUASI_ACCIDENTE 72, CONDICION_INSEGURA 48) con `UmbralPreaviso = 0.75m`. Expone:

- `PlazoHoras(IncidentTipo)`;
- `Evaluar(Incidente, DateTime ahora) → (Nivel: NINGUNO|PREAVISO|VENCIDO, horasTranscurridas, plazoHoras)`, con horas corridas desde `FechaEvento` en UTC;
- `EsActivoSinQe(Incidente)`: `QeId == null && DeletedAt == null && Estado no es CERRADO ni ANULADO`, el mismo criterio que `canCrearQE`.

Lo usan el escáner (D7) y el dashboard (D8). Un test de paridad compara la tabla con los valores del frontend, que están escritos a mano en el test (no hay forma de importarlos en .NET).

### D7. Bloque de escaneo `EscanearIncidentesSinQeAsync`

Sigue el patrón de `EscanearDocumentosAsync`:

- Consulta `db.Incidentes` con el criterio de `EsActivoSinQe`.
- Ramas excluyentes: PREAVISO (`CicloClave = "QE_PREAVISO"`) y VENCIDO (`CicloClave = "QE_VENCIDO"`).
- Idempotencia con `AnyAsync` por incidente y `CicloClave`, antes de generar el lote. Captura `DbUpdateException` con `ChangeTracker.Clear()`.
- **Índice:** el índice único parcial existente ya cubre el caso: `EntidadTipo = INCIDENTE`, una fila por destinatario y ciclo, y `tipo = 'VENCIMIENTO'`. No hace falta cambiar el esquema.
- La CicloClave es constante por incidente (el plazo no cambia, porque `FechaEvento` y `Tipo` no se editan por esta vía). Si en el futuro `incidentes-edicion-campos-basicos` permitiera editar `Tipo` o `FechaEvento`, habría que derivar la clave de esos valores; anotado como riesgo.
- El mensaje de preaviso usa las horas restantes redondeadas hacia arriba (`Math.Ceiling`), con un mínimo de 1.
- La rama VENCIDO agrega `PLAZO_QE_VENCIDO` al audit trail del incidente, con actor Sistema.
- Un incidente que pasa directo de NINGUNO a VENCIDO entre dos corridas (p. ej. el servidor estuvo apagado) solo recibe el aviso de VENCIDO; el preaviso perdido no se emite de forma retroactiva. Es el mismo criterio que con los documentos.

### D8. Dashboard

`BuildJefeCalidad` recibe un `DateTime ahora` (hoy usa `DateTime.UtcNow` en línea; se agrega el parámetro, con `ObtenerSummaryHandler` pasando `DateTime.UtcNow`). Filtra `incidentes` (ya scoped a la empresa y sin eliminados, en `FetchIncidentesAsync`, que trae `QeId`) con `EsActivoSinQe` y nivel VENCIDO, los ordena por `FechaEvento + plazo` ascendente (el más vencido primero) y toma 10. Se reusa `IncidenteResumen` (ya trae `FechaEvento` y `Tipo`), así que el frontend calcula "vencido hace" con `getIncidentQEPlazoInfo`, sin campo nuevo de horas. El rol JEFE_CONTROL_DOCUMENTARIO tiene su propio DTO vacío y no recibe el campo.

### D9. Enlaces de notificaciones

- `IncidenteNotificationSender` → `/incidents/{id}`; `NoConformidadNotificationSender` (2 lugares) → `/nonconformities/{id}`.
- `AsignacionNotificacion` suma el parámetro `string Link`. Cada uno de los 3 call sites lo arma con su origen (`/incidents/{incidente.Id}`, `/nonconformities/{nc.Id}`, `/quality-events/{qe.Id}`). Se prefiere frente a "resolver según el tipo de AC" dentro del sender (que pide la instrucción), porque el sender no sabe a qué tabla pertenece el `AccionCorrectivaId` sin hacer 3 consultas, y el call site ya tiene la entidad cargada.
- `VencimientoScanner.EvaluarYNotificarAsync` recibe `string link`, y cada `Join` lo arma con su origen.
- **Pestaña de acciones correctivas:** ni `QualityEventDetailPage` ni `NonconformityDetailPage` leen `?tab=` (grep de `useSearchParams` sin resultados en las páginas de detalle), así que se enlaza al detalle sin pestaña.
- `/documentos/{id}` (documentos) **es** una ruta válida en el router actual y no se toca.

### D10. Migración `FixLinksNotificacionesYEstadoIncidentes` (solo datos)

`Up()` con `migrationBuilder.Sql(...)`:

1. Reemplazar `/incidentes/` por `/incidents/` en `link`.
2. Reemplazar `/no-conformidades/` por `/nonconformities/` en `link`.
3. Tres `UPDATE notificaciones n SET link = '/<ruta>/' || ac.<fk> FROM acciones_correctivas_<x> ac WHERE n.link = '/acciones-correctivas/' || ac.id`. Los nombres de tabla y columna se toman de `ShacDbContextModelSnapshot` al implementar.
4. `UPDATE incidentes i SET estado = CASE q.estado … END, actualizado_en = now() FROM quality_events q WHERE i.qe_id = q.id AND i.deleted_at IS NULL AND i.estado <> <destino>`.

No escribe audit trail (es una corrección de datos, no una transición de dominio); queda documentado aquí. `Down()` vacío, con un comentario: los links viejos eran inválidos y el estado previo era incorrecto, así que no tiene sentido restaurarlos. La migración no cambia el esquema: el snapshot debe quedar idéntico (se verifica con `git diff` del snapshot).

### D11. Frontend

- `IncidentDetailPage`: renderiza `IncidentSinQEBadge` junto al botón "Crear QE" cuando `getIncidentQEAlertLevel` no es NINGUNO. Si el incidente tiene `qeId`, muestra un aviso informativo (`detail.qeGobiernaEstado`) con enlace a `/quality-events/{qeId}`. El número del QE sale del campo que ya expone el detalle si existe; si no, del hook `useQualityEvent(qeId)` llamado **antes** de cualquier `return` temprano, con `enabled: !!qeId` (lección de `usePlanoBlob`).
- `QualityEventForm`: quita `mutateVincularQE`; en éxito O1 navega directo. `useCreateQualityEvent` ya invalida `INCIDENT_QUERY_KEYS.all`. Se quita `useVincularQE` de `useIncidents.ts`, porque no le queda ningún consumidor (el homónimo de `documents` es otro hook y no se toca).
- **Invalidación de caché:** la instrucción pide replicar el patrón de `useFirmarCierre`. **Divergencia:** ya lo tienen `useTransitionQEStatus`, `useVerificacionEficacia`, `useFirmarCierre`, `useCerrarQEAccion`, `useForzarVencimientoVerificacion`, `useReactivateQualityEvent` y `useCreateQualityEvent`. Solo faltan `useDeleteQualityEvent` (la desvinculación de D5) y `useUpdateQEAccion`, si esta llama a `/acciones-correctivas/:acId/status` (se verifica al implementar; si no la llama, no se toca).
- **Router:** el componente `LegacyRedirect` (`useParams` + `<Navigate replace>`) se registra para `/incidentes/:id` y `/no-conformidades/:id`, hijo de `AppShell` y fuera de los `RoleGuard` específicos. El guard del destino decide el acceso.
- **Widget:** `IncidentesSinQeVencidosWidget` sigue el patrón de los widgets de lista existentes de `JefeCalidadDashboard`.

### D12. MSW

- `PATCH /api/incidents/:id/status` → 422 `{ errorCode: 'ESTADO_GOBERNADO_POR_QE' }` salvo `ANULADO` sin `qeId`.
- `PATCH /api/incidents/:id` con un `qeId` distinto → 422 `QE_VINCULO_GESTIONADO_POR_QE`.
- `POST /api/quality-events` O1 asigna `incidente.qeId` en el store de incidentes (`getIncidentsStore()`, por la regla de store cross-dominio).
- Todos los handlers de QE que cambian `estado` llaman a un helper `syncIncidentFromQE(qe)` que aplica el mapeo y agrega la entrada de audit.
- `DELETE` y `reactivar` de QE replican D5.
- El summary JEFE_CALIDAD calcula `incidentesSinQeVencidos` reusando `getIncidentQEAlertLevel`.
- **Divergencia:** los fixtures y la generación de notificaciones del mock **ya usan** `/incidents/`, `/nonconformities/` y `/quality-events/` (`notificationGeneration.ts`), así que no hay links que corregir en MSW. RN-INC-006 en el mock sigue notificando solo en ROJO, sin simular el preaviso (la instrucción no pide simular el escáner).

## Divergencias con la instrucción

| # | Instrucción | Código real / decisión |
|---|---|---|
| 1 | Tabla §1.6 de puntos de cambio de estado | Completa, más `ForzarVencimientoVerificacion` (vía `QEReaperturaHelper`). `CerrarQEHandler` no cambia el estado. |
| 2 | Replicar la invalidación de `useFirmarCierre` en las demás mutaciones | Ya está en 7 hooks; solo faltan `useDeleteQualityEvent` y, posiblemente, `useUpdateQEAccion`. |
| 3 | Resolver el link de AC "según el tipo" en `AsignacionNotificationSender` | El call site pasa el link (D9). |
| 4 | `ReactivarQualityEvent` no se menciona | Se vuelve a vincular, o 422 `INCIDENTE_YA_VINCULADO` (D5). |
| 5 | Links de los fixtures MSW | Ya eran correctos. |
| 6 | Índice único | Ya cubre el caso; no hay cambio de esquema. |
| 7 | NC ↔ QE no atómica | Mismo problema, fuera de alcance. |

## Risks / Trade-offs

- [Algún cliente llama a `PATCH /api/incidents/:id/status` para avanzar estados] → No hay consumidores en el frontend (grep). La app móvil offline solo usa `POST /api/incidents`. El 422 lleva un `errorCode` legible.
- [Carrera entre dos creaciones de QE sobre el mismo incidente] → `UPDATE … WHERE qe_id IS NULL` con verificación de filas afectadas (D3).
- [La migración altera el estado de incidentes históricos sin audit trail] → Documentado (D10). Solo afecta a incidentes con QE, cuyo estado ABIERTO era incorrecto por el bug.
- [Edición futura de `Tipo`/`FechaEvento` (change 3, aún no escrito) invalidaría la CicloClave constante] → Si ese change permite editar esos campos, debe derivar la CicloClave del plazo. Se anota para que Cowork lo tenga en cuenta.
- [Ruido de notificaciones: cada incidente nuevo avisa a todos los JCA y SUP de la empresa] → Es lo que pide D3; el volumen esperado es bajo.

## Migration Plan

1. Detener el backend → `dotnet ef migrations add FixLinksNotificacionesYEstadoIncidentes` → revisar que el snapshot no cambió → `dotnet ef database update` → `dotnet build` → `dotnet run`.
2. Rollback: revertir el código. Los datos corregidos por la migración siguen siendo válidos con el código anterior (los links nuevos funcionan con el router actual, y el estado sincronizado es un estado válido del enum).

## Open Questions

- ¿Se retira `IncidentACSection`? (Cowork → Toño.)
- ¿Debe `incidentes-edicion-campos-basicos` permitir editar `Tipo` o `FechaEvento`? Afecta a la CicloClave de D7.
