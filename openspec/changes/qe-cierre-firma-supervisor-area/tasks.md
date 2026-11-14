## 1. Backend — supervisores del área y dominio

- [x] 1.1 `Features/QualityEvents/Shared/SupervisoresAreaResolver.cs` (`SupervisorArea`, `ResolverAsync`, `EsSupervisorDelAreaAsync`, `ObtenerNombreAreaAsync`) con el criterio de design.md D1
- [x] 1.2 `RolNotificationHelper.ResolverDestinatariosPorRolAsync` filtra `Estado == ACTIVO`
- [x] 1.3 `QualityEvent`: `[NotMapped] CerradoPorNombre`, `CierreFirmaSupervisorNombre`, `SupervisoresArea`

## 2. Backend — avisos

- [x] 2.1 `IQualityEventNotificationSender` / `QualityEventNotificationSender`: `NotificarListoParaCierreAsync`, `NotificarFirmaSupervisorPendienteAsync`, `NotificarCierreRechazadoAsync`, `NotificarCierreCompletoAsync`; retirar `NotificarCierreAsync` (sin llamadores) y actualizar los fakes de tests

## 3. Backend — handlers

- [x] 3.1 `CerrarQEHandler`: 422 `AREA_SIN_SUPERVISOR`
- [x] 3.2 `FirmarCierreQEHandler`: revalidación de área en la primera firma, 403 `NO_ES_SUPERVISOR_DEL_AREA` en la segunda, acciones `FIRMA_CIERRE_JEFE_CALIDAD`/`FIRMA_CIERRE_SUPERVISOR` con nombre, avisos P4 y P6
- [x] 3.3 `CambiarEstadoAccionCorrectivaQEHandler`: aviso P1 al pasar a PENDIENTE_CIERRE
- [x] 3.4 `TransicionarEstadoQEHandler`: RN-QE-003 hacia PENDIENTE_CIERRE + aviso P1
- [x] 3.5 Slice `RechazarCierreQE/` (command, validator 20–500, handler, endpoint) y registro en `EndpointExtensions`
- [x] 3.6 `ObtenerQualityEventHandler`: LEFT JOIN de firmantes con alias y `SupervisoresArea` en PENDIENTE_CIERRE

## 4. Backend — tests

- [x] 4.1 Helper de seed de supervisor del área; ajustar tests existentes de cierre/firma/notificaciones/sync
- [x] 4.2 Tests del resolver (incluye/excluye) y de `RolNotificationHelper` con asignación inactiva
- [x] 4.3 Tests de segunda firma (área ok → CERRADO, otra área 403, mismo usuario 422), `AREA_SIN_SUPERVISOR` en cerrar, audit con nombres y detalle con nombres/supervisores
- [x] 4.4 Tests de avisos P1/P4/P6 (destinatarios, sin actor, ALTA_DIRECCION solo ALTA/CRÍTICA) y fallo de notificación sin cambio de respuesta
- [x] 4.5 Tests de rechazo (válido con incidente sincronizado, 400, 422, 403, 404) y re-cierre (200 con AC cerradas, 422 con AC abierta)

## 5. Frontend — tipos, API, hooks

- [x] 5.1 `qualityEvent.types.ts`: `cerradoPorNombre?`, `cierreFirmaSupervisorNombre?`, `supervisoresArea?`
- [x] 5.2 `quality-events.api.ts`: `rechazarCierre(id, motivo)`; schema `rechazarCierre.schema.ts`; hook `useRechazarCierreQE`
- [x] 5.3 `useCerrarQE`/`useFirmarCierre`: sin toast para `AREA_SIN_SUPERVISOR` (y `NO_ES_SUPERVISOR_DEL_AREA` con texto i18n)
- [x] 5.4 `accionesRequeridas.utils.ts`: firma pendiente solo para supervisores con el área en `areaIds`

## 6. Frontend — UI e i18n

- [x] 6.1 `QECierreSection`: filas Firma 1/Firma 2 con nombres y fechas (incluye `FIRMA_REGISTRADA` legacy), quién puede firmar, gating por `supervisoresArea`, mensaje de otra área
- [x] 6.2 `QECierreSection`: botón y modal "Rechazar cierre" (RHF + Zod, contador), aviso ámbar en EN_EJECUCION, `AREA_SIN_SUPERVISOR` inline con enlace a Usuarios para JCA
- [x] 6.3 `QEAuditTrail`: etiquetas `FIRMA_CIERRE_JEFE_CALIDAD`, `FIRMA_CIERRE_SUPERVISOR`, `CIERRE_RECHAZADO`
- [x] 6.4 i18n `qualityEvents` es-PE y en-US con las claves de la instrucción

## 7. MSW

- [x] 7.1 Detalle con `supervisoresArea` y nombres; `cerrar`/`firmar-cierre` con 422/403 nuevos y acciones de audit nuevas; `POST rechazar-cierre` (fixtures sin cambios, ver design.md D10)

## 8. Frontend — tests

- [x] 8.1 `QECierreSection.test.tsx`: firma 1 pendiente/hecha (con entrada legacy), firma 2 pendiente con lista y aviso, botones para supervisor del área, mensaje para otra área, modal de rechazo con mínimo 20, aviso ámbar, `AREA_SIN_SUPERVISOR`
- [x] 8.2 Tests de handlers MSW (rechazo, 403, 422) y de `QEAuditTrail`/`accionesRequeridas` ajustados

## 9. Verificación

- [x] 9.1 Suite completa backend (`dotnet test`) y frontend (`npm test`)
- [ ] 9.2 `tsc --noEmit` y `npm run lint` con cero errores — los archivos de este cambio quedan sin errores; el repo arrastra errores previos ajenos (tsc en `documents.*`, 57 de lint), ver design.md
