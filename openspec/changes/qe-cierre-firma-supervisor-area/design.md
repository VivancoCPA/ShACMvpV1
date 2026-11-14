## Context

El cierre de un QE (PRD §1.5) tiene hoy dos firmas: Jefe de Calidad (`CerradoPorId`) y "Supervisor" (`CierreFirmaSupervisorId`). `FirmaCierreResolver` devuelve siempre `SUPERVISOR` (RN-QE-004 reconciliada, be-quality-events D15) y `FirmarCierreQEHandler` acepta a cualquier SUPERVISOR de la empresa. No hay avisos en P1/P4, no existe el rechazo (P5) y el aviso final (P6) solo llega a los JCA con ALTA/CRÍTICA. En el frontend, `QECierreSection` busca `FIRMA_CIERRE_JEFE_CALIDAD`, que el backend real nunca escribe (escribe `FIRMA_REGISTRADA`), así que la información de la primera firma nunca aparece contra el backend real. Decisiones de Toño D1–D3 en la instrucción de Cowork (2026-11-04).

## Goals / Non-Goals

**Goals:**
- La segunda firma (y el rechazo) solo la da un supervisor activo del área del QE.
- Avisos en P1, P4, P5 (rechazo) y P6.
- Rechazo del cierre con motivo, vuelta a EN_EJECUCION y re-cierre sin crear AC nuevas.
- La pantalla muestra quién firmó, cuándo, y quién puede firmar.

**Non-Goals:**
- Plazos de 5/3 días hábiles del PRD y su escalado.
- Email (P-08).
- Asignar supervisores a un área desde el QE (sigue en Usuarios).

## Decisions

### D1 — Criterio "supervisor del área": solo `AreaIds` (divergencia)
La instrucción pide "el área del QE en `AreaIds` o en `AreaId`" y a la vez "usar el mismo criterio que `FetchUsuarioAreaIdsAsync`". Ese método (y `EditarReporteInicialQEHandler`, RN-QE-014) usa **solo** `area_ids`, y CLAUDE.md dice explícitamente que "¿este Supervisor gestiona el área X?" se responde con `areasAsignadas.includes(area)`, nunca con `area`. Se usa solo `AreaIds`. `AreaId` es el departamento propio del usuario y no implica supervisión.
Condiciones completas: `UsuariosEmpresa` de la empresa con `Rol == SUPERVISOR` y `Estado == ACTIVO`, `ShacUser.Activo == true`, `AreaIds` contiene `qe.AreaId`. Orden por nombre.

### D2 — `SupervisoresAreaResolver` con EF; `ObtenerQualityEventHandler` recibe `ShacDbContext`
El resolver es una clase estática con `ResolverAsync` / `EsSupervisorDelAreaAsync` sobre `ShacDbContext` (mismo estilo que `RolNotificationHelper`). `AreaIds` es `text[]` en PostgreSQL; `u.AreaIds.Contains(areaId)` se traduce con Npgsql. El detalle (Dapper) inyecta además `ShacDbContext` solo para llamar al resolver cuando `Estado == PENDIENTE_CIERRE`, en vez de duplicar la consulta en SQL. Alternativa descartada: versión Dapper del resolver — dos implementaciones del mismo criterio.

### D3 — Nombre del área
Los mensajes y el error `AREA_SIN_SUPERVISOR` usan `Area.Nombre` (`Areas` por `(EmpresaId, Id)`); si no se encuentra, el id. El 422 `AREA_SIN_SUPERVISOR` lleva el nombre en el `message`; el frontend muestra su propio texto i18n con el nombre que resuelve con `useArea`.

### D4 — Orden de validaciones en la segunda firma
PIN → "ya tiene ambas firmas" → "mismo usuario" (422, como hoy) → rol (403) → supervisor del área (403 `NO_ES_SUPERVISOR_DEL_AREA`). En la primera firma, después del rol JCA, se revalida que el área tenga supervisores (422 `AREA_SIN_SUPERVISOR`).

### D5 — Avisos
Todos post-`SaveChanges`, `try/catch` + `LogWarning`, sin el actor, sin duplicados, `Link = /quality-events/{id}`.
- P1 `NotificarListoParaCierreAsync` (`CAMBIO_ESTADO`): JCA con asignación activa + supervisores del área. Se dispara en `CambiarEstadoAccionCorrectivaQEHandler` (auto-transición) y en `TransicionarEstadoQEHandler` cuando el destino es PENDIENTE_CIERRE (re-cierre tras un rechazo).
- P4 `NotificarFirmaSupervisorPendienteAsync` (`ASIGNACION`): supervisores del área.
- P5 `NotificarCierreRechazadoAsync` (`CAMBIO_ESTADO`): el JCA que firmó si sigue con asignación JCA activa en la empresa y usuario activo; si no, todos los JCA activos.
- P6 `NotificarCierreCompletoAsync` (`CIERRE`, que además hace push SignalR): reportante, responsable de investigación, JCA activos y ALTA_DIRECCION si ALTA/CRÍTICA. El reportante y el responsable se notifican sin chequear asignación (son personas puntuales del QE, mismo criterio que `NotificarResponsableAsignadoAsync`).
- `NotificarCierreAsync` queda sin llamadores; se elimina del contrato (y de los fakes de tests) para no dejar código muerto.
- Fecha de verificación en el mensaje P6: `FechaVerificacionProgramada` con formato `dd/MM/yyyy` (`CultureInfo.InvariantCulture`), fecha UTC.

### D6 — Rechazo sin PIN
`POST /api/quality-events/{id}/rechazar-cierre` no pide PIN: rechazar no es firmar, y el motivo obligatorio + audit trail dejan trazabilidad suficiente. Efecto: `Estado = EN_EJECUCION`, `CerradoPorId = null`, se conserva `ResultadoCierre` y `PlazoVerificacionDias`, audit `CIERRE_RECHAZADO` (`EstadoAnterior`/`EstadoNuevo`, `ValorNuevo = motivo`), `IncidenteQeSync` antes del `SaveChanges` y `NotificarCambioAsync` después. La transición PENDIENTE_CIERRE → EN_EJECUCION no está en `QualityEventTransitionValidator` y **no** se agrega: es exclusiva de este endpoint (igual que la reapertura de verificación).
Validaciones: 404 tenancy → 422 si no está en PENDIENTE_CIERRE con `CerradoPorId` y sin `CierreFirmaSupervisorId` → 403 si no es SUPERVISOR del área → 400 por el validador del motivo (corre antes por el `ValidationFilter`).

### D7 — RN-QE-003 en EN_EJECUCION → PENDIENTE_CIERRE manual (hallazgo)
`TransicionarEstadoQEHandler` hoy **no** valida las AC al pasar a PENDIENTE_CIERRE. Se agrega el mismo criterio que `CerrarQEHandler`: ninguna AC fuera de `CERRADA` o sin `DescripcionEvidencia`; si no, 422 `RN-QE-003`. Con cero AC pasa (mismo criterio que `CerrarQEHandler` y que el botón del `QEStatusTransitionPanel`). El frontend ya deshabilita el botón con AC abiertas; no cambia.

### D8 — Audit trail y nombres
Primera firma `FIRMA_CIERRE_JEFE_CALIDAD`, segunda `FIRMA_CIERRE_SUPERVISOR`; `ValorNuevo` = nombre completo del firmante (`actor.Nombre + " " + actor.Apellido` desde la BD, mismo valor que `RealizadoPorNombre`), `CampoModificado` sin cambio. Las entradas viejas `FIRMA_REGISTRADA` quedan; el frontend acepta ambas. El detalle agrega `CerradoPorNombre` y `CierreFirmaSupervisorNombre` (`[NotMapped]`, LEFT JOIN `asp_net_users` con alias `cu`/`su`) y `SupervisoresArea` (`[NotMapped] List<SupervisorArea>?`, solo en PENDIENTE_CIERRE; `null` en otros estados y en los endpoints de escritura).

### D9 — Frontend
- `QECierreSection` se renderiza también en EN_EJECUCION, **solo** para el aviso ámbar de rechazo: se muestra cuando, entre las entradas `CIERRE_RECHAZADO` y las de entrada a PENDIENTE_CIERRE (`ESTADO_CAMBIADO`/`TRANSICION_AUTOMATICA` con `estadoNuevo === 'PENDIENTE_CIERRE'`), la última es `CIERRE_RECHAZADO`. Sin rechazo → `null` como hoy.
- Botones de segunda firma y rechazo: `user.rol === 'SUPERVISOR'` y `qe.supervisoresArea?.some(s => s.id === user.id)`. `resolveRolSegundaFirma` se conserva (sigue devolviendo SUPERVISOR) para el rol enviado en la firma.
- `AREA_SIN_SUPERVISOR`: `useCerrarQE`/`useFirmarCierre` no muestran toast para ese `errorCode`; la sección lo lee de `mutation.error` (sin `useEffect`) y muestra el mensaje con enlace a `/usuarios` para JCA.
- Nombre del área con `useArea(qe.areaId)` (mismo hook que `QEHeaderSection`); fallback al id.
- **Hallazgo:** `accionesRequeridas.utils.ts` (dashboard) también ofrece la firma pendiente a cualquier SUPERVISOR. Se alinea con `user.areaIds?.includes(qe.areaId)` (el listado no trae `supervisoresArea`).

### D9b — Firmas también en el resumen
Las filas Firma 1 / Firma 2 se muestran también desde CERRADO en adelante (encima del resumen), para que quede visible quién cerró. La fecha de la segunda firma acepta además la acción `FIRMA_CIERRE_SEGUNDA` que escribía el mock anterior.

### D10 — MSW
Paridad: supervisores del área desde `getUsersStore()` con rol efectivo SUPERVISOR en la empresa, activos y `areaIds` con el área; detalle con `supervisoresArea` y nombres; 422/403 nuevos; `rechazar-cierre`; acciones de audit nuevas (el mock usaba `FIRMA_CIERRE_SEGUNDA`, pasa a `FIRMA_CIERRE_SUPERVISOR`).

### D11 — `cerrar` y `firmar-cierre` exigen PENDIENTE_CIERRE (hallazgo en apply)
Como el rechazo conserva `ResultadoCierre` y vuelve a EN_EJECUCION, `FirmarCierreQEHandler` (que solo miraba `ResultadoCierre`) permitiría al JCA firmar en EN_EJECUCION y al supervisor cerrar el QE sin pasar por PENDIENTE_CIERRE. Ambos handlers responden ahora 422 si `Estado != PENDIENTE_CIERRE` (el mock de `/cerrar` ya lo hacía).

## Risks / Trade-offs

- [QE existentes en PENDIENTE_CIERRE de áreas sin supervisor quedan bloqueados] → el mensaje indica asignar uno en Usuarios; es el comportamiento pedido (D1 de Toño).
- [Fixtures MSW: `qe-2026-003` (PENDIENTE_CIERRE, `area-017`) no tiene ningún supervisor con esa área] → no se tocaron las `areaIds` de `user-supervisor-001` para no alterar RN-QE-014 en otros QE de `area-017`; con MSW, ese QE muestra la segunda firma sin firmantes posibles (que es justamente el caso `AREA_SIN_SUPERVISOR`). Los tests de handlers crean sus propios QE con `area-010`.
- [Verificación] `tsc --noEmit -p tsconfig.app.json` y `npm run lint` reportan errores previos en archivos que este cambio no toca (`documents.fixtures.ts`/`documents.handlers.ts`/`documents.types.test.ts` en tsc; 57 errores de lint en otros módulos). Los archivos de este cambio quedan sin errores. También falla en HEAD `router/documentReplaceOriginal.test.tsx` (RN-DOC-013), ajeno a este cambio.
- [Tests de integración existentes de cierre usan un SUPERVISOR sin área] → se agrega un helper de seed de supervisor del área y se actualizan.
- [El JCA puede cerrar desde `PATCH /:id/status` PENDIENTE_CIERRE → CERRADO sin firmas] → hallazgo fuera de alcance (ver Open Questions); la UI excluye CERRADO de los botones.

## Migration Plan

Sin migración de esquema. Despliegue: detener backend → `dotnet build` → `dotnet run`. Rollback: revertir el commit.

## Open Questions

- `QualityEventTransitionValidator` permite PENDIENTE_CIERRE → CERRADO por `PATCH /:id/status`, lo que saltea la doble firma. No se toca en este cambio (no está en la instrucción); se propone a Toño bloquearlo en un cambio aparte.
