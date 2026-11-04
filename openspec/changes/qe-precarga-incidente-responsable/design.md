## Context

Instrucción de Cowork del 2026-10-22 (observaciones de Toño al crear un QE desde un incidente). Depende de `incidentes-qe-estado-alertas` (archivado 2026-10-26): la vinculación QE↔incidente ya es atómica en `CrearQualityEventHandler` (`IncidenteQeSync.VincularAsync`) y la transición del QE sincroniza el estado del incidente (`IncidenteQeSync.SincronizarAsync`).

Estado verificado en el código antes de proponer:

- `IncidentDetailPage.tsx` navega a `/quality-events/nuevo?origen=O1_INCIDENTE_CAMPO&incidenteId&incidenteNumero&incidenteArea`. `QualityEventForm.tsx` solo usa el área (defaults de alta y `onChange` del combo).
- `QualityEvent.ResponsableInvestigacionId` existe (columna `responsable_investigacion_id`) y se lee en Obtener/Listar y en `DocumentoQualityEventLinkService`, pero ningún command lo escribe. **No hay índice** sobre la columna (solo `(EmpresaId, Numero)` y `EmpresaId`).
- `QualityEventNotificationSender` solo resuelve alertas por un rol (`NotificarPorRolAsync`).
- Frontend: `QEStatusTransitionPanel` llama `getQualityEventPermissions(qe.estado, rol, false)` — `esResponsable` está fijo en `false`. `QEVerificacionSection` usa `user.id === qe.auditorAsignadoId` (otro concepto).
- `toDatetimeLocalValue` es una función privada de `IncidentForm.tsx`.

## Goals / Non-Goals

**Goals:**
- Precarga editable de los datos del incidente (D1), con confirmación al reemplazar datos tocados.
- Responsable de investigación asignable según PRD §1.3 (D2), obligatorio para ABIERTO → EN_INVESTIGACION.
- Avisos de asignación y de creación (D3).
- Corregir el corrimiento de 5 h de `fechaHoraEvento` en la edición del QE.

**Non-Goals:**
- Aviso de "QE sin responsable a las 48 h" (decisión de Toño).
- Precarga desde una NC (O2): sigue precargando solo el área. Si se quiere el mismo tratamiento, va en otro change.
- Agregar control de rol a `TransicionarEstadoQEHandler` (hoy no valida rol; fuera de alcance).

## Decisions

**D1 — Slices y validador compartido.** `CandidatosResponsable/` (GET) y `AsignarResponsableQE/` (PATCH) siguen el patrón de `Documentos/CandidatosAsignacion`. `Shared/ResponsableInvestigacionValidator` encapsula la consulta Dapper (`asp_net_users` ⨝ `usuarios_empresa`, `u.activo`, `ue.estado = 'ACTIVO'`, `ue.rol IN (SUPERVISOR, JEFE_CALIDAD_SYST)`) con dos usos: listar y validar un id. Ante un id inválido lanza `FieldValidationException({ responsableInvestigacionId: … })` → **400** (el formato existente de esa excepción), no 422; la instrucción admitía 400/422 y se usa la excepción ya existente, igual que RN-DOC-021. El rol que cuenta para ser candidato es el **rol de empresa** (`usuarios_empresa.rol`), igual que los candidatos de M1.

**D2 — Permiso del PATCH por rol global.** `RequireAuthorization(p => p.RequireRole(JEFE_CALIDAD_SYST))`, mismo patrón que `EditarSeveridadQEEndpoint`. Estados cerrados → `BusinessRuleException(…, "QE_CERRADO")` (422).

**D3 — Audit con nombres.** `ValorAnterior`/`ValorNuevo` guardan nombres (el anterior se resuelve con una consulta al usuario actual). El audit de la asignación al crear va en la misma transacción que el `CREADO`.

**D4 — Gate de transición.** En `TransicionarEstadoQEHandler`, junto a RN-QE-002/009: `Estado == ABIERTO && NuevoEstado == EN_INVESTIGACION && ResponsableInvestigacionId is null` → `BusinessRuleException(…, "QE_SIN_RESPONSABLE")`. **Divergencia con la instrucción:** la instrucción condicionaba solo por `NuevoEstado == EN_INVESTIGACION`, pero el validador de transiciones también admite `EN_VERIFICACION → EN_INVESTIGACION` por este endpoint (reapertura manual), y en el mock existe `REABIERTO → EN_INVESTIGACION` (fixtures qe-2026-005/017). Las dos son reaperturas, y la instrucción pide no bloquearlas, así que el gate se limita al origen `ABIERTO` (backend, MSW y panel). `QEReaperturaHelper` tampoco pasa por este handler. Un QE viejo sin responsable puede reabrir a EN_INVESTIGACION sin él (aceptado: el JCA lo asigna después desde la cabecera).

**D5 — Notificación de creación con el helper existente.** Se reutiliza `RolNotificationHelper.ResolverDestinatariosPorRolAsync` para JCA y SUPERVISOR y se unen con `Distinct()`. **Divergencia:** el helper filtra por `usuarios_empresa` (empresa + rol, sin el actor) pero **no** por `estado = ACTIVO` ni `ShacUser.Activo`, mientras D3 dice "activos". Se mantiene el helper sin cambios porque lo comparten todos los avisos de NC/QE existentes; filtrar inactivos en todos es un fix transversal que va aparte. `NotificarResponsableAsignadoAsync` no usa el helper (destinatario único). Ninguno de los dos tipos nuevos (`ASIGNACION`, `CAMBIO_ESTADO`) entra al push SignalR, que sigue limitado a `SEVERIDAD_CRITICA`/`CIERRE`.

**D6 — Lectura con `LEFT JOIN`.** Obtener y Listar pasan a `FROM quality_events q LEFT JOIN asp_net_users ru ON ru.id = q.responsable_investigacion_id`, con todas las columnas y filtros calificados con `q.`. `ResponsableInvestigacionNombre` es `[NotMapped]` en `QualityEvent` (patrón de `Incidente.ReportadoPorNombre`), y se agrega `[NotMapped]` para que no aparezca en la migración.

**D7 — Migración solo de índice.** Como el índice no existe, `HasIndex(e => e.ResponsableInvestigacionId)` + `dotnet ef migrations add AddIndexResponsableInvestigacionQE`. La migración no debe tocar columnas.

**D8 — Precarga sin `useEffect`.** Regla del proyecto: nada de `useEffect` para derivar estado.
- **Incidente en la URL:** la página `QualityEventForm` llama `useIncident(initialIncidenteId)` antes de cualquier `return`, muestra el skeleton mientras carga y pasa el incidente al body, que lo usa en los `defaultValues`. Si el incidente falla al cargar, el formulario se abre con los defaults actuales (solo área).
- **Incidente elegido en el combo:** el `onChange` hace `queryClient.fetchQuery` con la misma query key que `useIncident` (`INCIDENT_QUERY_KEYS.detail(id)`) y aplica `setValue` en el callback. Si hay campos precargables en `dirtyFields`, abre un diálogo de confirmación propio (Sonner/`confirm()` están vetados para esto por CLAUDE.md) y solo sobrescribe si se confirma.
- La nota `form.precargaIncidente` se muestra cuando el incidente aplicado es el seleccionado actualmente.

**D9 — Helper de fecha compartido.** `toDatetimeLocalValue`/`fromDatetimeLocalValue` se mueven de `IncidentForm.tsx` a `src/utils/datetimeLocal.ts` y los usan `IncidentForm` y `QualityEventForm` (alta y edición). En edición, el submit compara contra `toDatetimeLocalValue(qe.fechaHoraEvento)` y envía `fromDatetimeLocalValue` cuando cambia.

**D10 — Modal de asignación compartido.** `QEAsignarResponsableModal` (SearchableSelect + `useAsignarResponsableQE`) se usa desde `QEHeaderSection` y desde el enlace del `QEStatusTransitionPanel`; cada uno controla su propia instancia con `useState` local (estado de UI, no derivado). La mutación invalida el detalle, la lista y el audit trail del QE.

**D11 — `esResponsable`.** Nuevo helper `esResponsableInvestigacion(qe, usuario)` en `qualityEventPermissions.ts`; `QEStatusTransitionPanel` lo usa en lugar de `false`. Efecto real: `puedeEditarCabecera` de SUPERVISOR pasa a ser `true` en ABIERTO cuando es el responsable, pero **hoy ningún componente de producción consume `puedeEditarCabecera`** (la edición usa `resolveQEEditAccess`, RN-QE-014), así que no hay cambio visible. Quién puede avanzar de ABIERTO no cambia: SUPERVISOR y JCA, ahora con responsable asignado. `QEVerificacionSection` conserva `auditorAsignadoId`.

**D12 — Mensaje de error por código.** `useTransitionQEStatus.onError` traduce `errorCode` con `t('qualityEvents:errors.<code>')` cuando existe la clave, y si no cae al `message` del servidor como hoy.

**D13 — Notas de implementación (divergencias menores).**
- `IncidentTurno` admite `TODOS`, que el QE no tiene: en ese caso `turno` no se precarga y el usuario lo elige.
- Para mostrar la foto en la cabecera, detalle y listado también devuelven `responsableInvestigacionAvatarUrl` (`[NotMapped]`, mismo `LEFT JOIN`).
- La confirmación de reemplazo es un aviso en línea (`role="alertdialog"`) bajo el combo de incidente, no un modal: CLAUDE.md prohíbe `confirm()`.
- El MSW no replica el aviso de creación a JCA/SUP (`NotificarCreacionAsync`). Solo replica el aviso de asignación, que es el que se ve en las pruebas con mock. El aviso de creación se prueba contra el backend real.
- Tests existentes que llevaban un QE de ABIERTO a EN_INVESTIGACION sin responsable (backend: `QualityEventsStateMachine`, `IncidenteQeSync`, `IncidenteCreacionNotificacion`; MSW: sincronización Incidente/NC ← QE) ahora siembran un responsable.

## Risks / Trade-offs

- [QE existentes en ABIERTO sin responsable quedan bloqueados para avanzar] → Es el comportamiento pedido por el PRD; el JCA los desbloquea asignando desde la cabecera.
- [Avisos de creación a usuarios inactivos de la empresa (D5)] → Mismo comportamiento que los avisos existentes; queda anotado para un fix transversal.
- [Doble fuente del incidente en el combo (lista vs detalle)] → El detalle se pide con `fetchQuery` y se cachea con la misma key de `useIncident`, sin duplicar lógica.

## Migration Plan

1. Detener el backend → `dotnet ef database update` (índice `AddIndexResponsableInvestigacionQE`) → `dotnet build` → `dotnet run`.
2. Rollback: revertir la migración (`dotnet ef database update <anterior>`); solo quita el índice.
