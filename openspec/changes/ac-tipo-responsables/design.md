## Context

`QEACSection` (y `QEVerificacionSection`, `NCForm`) consumen `useUsers()` → `GET /api/users`, restringido en backend a `ADMINISTRADOR_EMPRESA`/`SUPERADMIN`. Para el JCA la respuesta es 403 y el combo queda vacío. Los handlers `CrearAccionCorrectiva*` (QE/NC/incidente) resuelven el responsable con `db.Users.FirstOrDefaultAsync(u => u.Id == ...)` sin validar empresa ni rol. Las tres entidades de AC no tienen tipo. Ya existe un precedente exacto del patrón buscado: `ResponsableInvestigacionValidator` (Dapper, `usuarios_empresa.rol`, `FieldValidationException`) + `GET /api/quality-events/candidatos-responsable`.

## Goals / Non-Goals

**Goals:**
- `tipo` obligatorio y no editable en las tres AC; migración con default `CORRECTIVA`.
- Una única política de responsables por tipo usada por candidatos, crear y reasignar.
- Ningún selector operativo depende de `GET /api/users`; nunca se muestra un id como nombre.

**Non-Goals:**
- Formularios de creación de AC en NC e incidente (no existen en el frontend; solo se adapta backend + MSW).
- Cambiar los permisos de quién puede crear AC.
- Rediseñar `AsignarUsuarioModal`/`UserList` (pantallas de administración).

## Decisions

**D1 — `ResponsableAcPolicy` como servicio con Dapper, no `static`.** La instrucción sugiere `static ... EsResponsableValidoAsync(ShacDbContext db, ...)`. Se implementa como `sealed class ResponsableAcPolicy(DapperConnectionFactory)` registrada en DI, con `static RolesPermitidos(tipo)` + `GetCandidatosAsync(empresaId, tipo)` + `ValidarAsync(empresaId, tipo, usuarioId)` que lanza `FieldValidationException` y devuelve el candidato (su nombre alimenta `ResponsableNombre`). Motivo: es el mismo patrón que `ResponsableInvestigacionValidator` y `DocumentoAsignacionService` (una sola consulta para listar y validar, así nunca divergen). Ubicación: `Features/AccionesCorrectivas/Shared/ResponsableAcPolicy.cs`.

**D2 — `Tipo` nullable en el command de creación.** `JsonStringEnumConverter` deserializa un `tipo` ausente como el valor 0 (`CORRECTIVA`), y `IsInEnum()` lo aceptaría. Por eso el command declara `AccionCorrectivaTipo? Tipo` y el validator exige `NotNull().IsInEnum()`. Un valor de string inválido ya falla en la deserialización (400 del binding).

**D3 — Candidatos responde 400 por tipo inválido.** El endpoint recibe `string? tipo` y lo parsea con `Enum.TryParse(ignoreCase: false)` + `Enum.IsDefined`; si falla lanza `BadRequestBusinessException`. Ruta: `Features/AccionesCorrectivas/CandidatosResponsable/` con `RequireEmpresaActivaFilter`.

**D4 — Reasignación en los PATCH existentes.** No existe un endpoint dedicado de reasignación: los tres `ActualizarAccionCorrectiva*` aceptan `ResponsableId`. Cuando llega un `ResponsableId` distinto del actual se valida con el `Tipo` actual de la AC. Los commands de actualización no tienen `Tipo`, así que un `tipo` en el body se ignora por construcción.

**D5 — Notificación al crear.** Hoy los handlers de creación no notifican (solo el `PATCH` de reasignación vía `IAsignacionNotificationSender`), pero la prueba manual de la instrucción espera que "el responsable reciba su aviso de asignación" y el MSW de QE ya lo hace. Se agrega la notificación best-effort en los tres handlers de creación, mismo bloque try/catch que el PATCH, nunca en autoasignación.

**D6 — `AccionCorrectivaIncidente` sin `ResponsableNombre` persistido.** La entidad de incidente no guarda el nombre (el dashboard lo resuelve con `nombresUsuarios`). Se mantiene así; la política solo valida.

**D7 — Lecturas.** Las entidades se serializan tal cual en los detalles, así que `tipo` sale automáticamente en QE/NC/incidente y en `ListarAccionesCorrectivasQE`. Se agrega `Tipo` a `AcUnificada` y `AccionCorrectivaResumen` del dashboard. La exportación PDF del QE es frontend (`buildQualityEventPdf.ts`): se agrega la columna Tipo a la tabla de AC.

**D8 — `GET /api/users/candidatos`.** Slice `Features/Users/CandidatosUsuarios/`; parsea `roles` (CSV) contra `UserRole`, quita ADMINISTRADOR_EMPRESA/ADMINISTRADOR_SISTEMA/SUPERADMIN; si tras parsear no queda ningún rol válido → 400. Un rol desconocido → 400. Reusa la misma forma de DTO `{ id, nombreCompleto, rol, avatarUrl }`.

**D9 — Frontend del modal.** `tipo` se agrega a `createQEAccionSchema` (`z.enum`, con `preprocess('' → undefined)` para el mensaje de requerido). El cambio de tipo se maneja en el `onChange` del select de tipo (no `useEffect`): al cambiar, si el responsable actual no está en los candidatos del nuevo tipo se limpia. Como los candidatos del nuevo tipo pueden no estar en caché aún, la comprobación se hace en render con `useMemo` sobre `candidatos` + un estado `responsableDescartado` que se fija cuando la lista llega y no contiene al elegido; la limpieza ocurre en el handler del cambio de tipo vía `queryClient.fetchQuery` de los candidatos del nuevo tipo (await) antes de decidir. Esto evita derivar estado con `useEffect` (regla 1).

**D10 — NCList usa `responsableNombre`.** El DTO de AC de NC ya trae `responsableNombre` (persistido en backend); se usa directamente, con fallback `common:userNames.noDisponible`. No hace falta `useUserNames` ahí.

**D11 — i18n.** El namespace `common` existe (lo usa `useUserNames`), así que `common:acTipo.*` va ahí.

## Divergencias encontradas al implementar

- **Audit trail `AC_CREADA` sin el tipo.** La instrucción pide incluir el tipo "si ya registra datos de la AC". Las tres entradas `AC_CREADA` solo guardan el id de la AC en `ValorNuevo` (el frontend y los MSW lo usan así), no sus datos, así que no se agrega el tipo para no cambiar ese contrato. El tipo queda en la propia AC, que no es editable.
- **D9 simplificado.** El cambio de tipo se resuelve en el `onChange` del select de tipo: `queryClient.fetchQuery` de los candidatos del tipo nuevo y, si el responsable elegido no está, `setValue('responsableId', '')` + aviso inline. Sin `useEffect` y sin estado `responsableDescartado`.
- **Reasignación solo si cambia el responsable.** Los `PATCH` validan con la política solo cuando `responsableId` es distinto del actual. Así, reenviar el mismo responsable de una AC antigua que ya no cumple la política no falla.
- **`useUsers` de `features/nonconformities/hooks/` eliminado** junto con `getUsers()` de `nonconformities.api.ts`, porque quedaron sin uso. `useUsers()` de `features/users/` sigue solo en `AsignarUsuarioModal` y `UserList`/`UserFormModal` (administración).
- **Roles de los candidatos en la UI** usan las claves existentes `auth:roles.*`; no se crean claves nuevas.
- **Tests MSW de `/api/users`** pasan a autenticarse como `admin.empresa@shac.pe` (ADMINISTRADOR_EMPRESA). Antes usaban `admin@shac.pe` (ADMINISTRADOR_SISTEMA), que el backend real rechaza con 403 (`Listar_RolSinPermiso_Devuelve403`).
- **MSW de NC e incidente no notifican al crear la AC.** Esos handlers no tenían ninguna notificación de asignación, ni siquiera al reasignar, y no hay formulario de alta de AC de NC o incidente en el frontend. El backend real sí notifica en los tres casos (D5).
- **D7 corregido: las lecturas no son serialización directa de la entidad.** Los detalles de QE, NC e incidente, `ListarAccionesCorrectivasQE` y `DashboardDataFetcher` leen las AC con SQL Dapper que lista las columnas explícitamente. Sin `tipo AS "Tipo"`, la AC volvía con el default `CORRECTIVA`. Lo detectó el test `DetalleQE_IncluyeTipoEnLasAC`, y se agregó la columna en las 7 consultas.
- **Migración generada con `--configuration Release`.** Los DLL de `bin/Debug` estaban bloqueados por el backend en ejecución. El código de la migración es el mismo.

## Risks / Trade-offs

- [Contrato **BREAKING** del POST de AC: clientes que no envían `tipo` reciben 400] → el único cliente es el frontend, que se actualiza en este mismo cambio; MSW refleja la misma regla.
- [AC existentes con responsables que ya no cumplen la política] → no se revalidan retroactivamente; solo se valida al crear y al reasignar.
- [`GET /api/users` en MSW pasa a 403 para roles operativos] → puede romper tests que dependían del comportamiento laxo; se ajustan en este cambio.

## Migration Plan

1. Detener backend → `dotnet ef database update` (migración `AddTipoAccionCorrectiva`) → `dotnet build` → `dotnet run`.
2. Rollback: `dotnet ef database update <migración anterior>`; la columna se elimina y el frontend anterior no la usa.
