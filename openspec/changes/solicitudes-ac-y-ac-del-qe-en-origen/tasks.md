## 1. Backend — solicitudes

- [x] 1.1 `SolicitarACEnQE`: validar rol efectivo (OPERARIO, SUPERVISOR, JCA, ALTA_DIRECCION → 403 `SOLICITUD_AC_ROL_NO_PERMITIDO`) y estado (`CERRADO`/`EN_VERIFICACION`/`VERIFICADO` → 422 `SOLICITUD_AC_ESTADO_INVALIDO`)
- [x] 1.2 `CrearAccionCorrectivaQEHandler`: descontar `SolicitudesAC` si > 0 y registrar `SOLICITUD_AC_ATENDIDA` en la misma transacción
- [x] 1.3 Slice `DescartarSolicitudAC` (command, validator 20–500, handler, endpoint `POST …/solicitudes-ac/descartar`) + registro en `EndpointExtensions`
- [x] 1.4 Aviso best-effort al solicitante (FIFO sobre `AC_SOLICITADA`): `QESolicitudAcDescartadaNotificacion` + `NotificarSolicitudAcDescartadaAsync` en el sender real y en los dobles de test
- [x] 1.5 Tests de integración: solicitar/crear/descartar, 403/400/422, RN-QE-009 antes y después, contador no negativo, lectura de AC como OPERARIO (200) y otra empresa (404)

## 2. Frontend — QE

- [x] 2.1 API `descartarSolicitudAC` + hook `useDescartarSolicitudAC` (invalida `['quality-events']`, audit trail y dashboard; error `SIN_SOLICITUDES_PENDIENTES` localizado)
- [x] 2.2 `useCreateQEAccion` y `useSolicitarACEnQE` invalidan `QE_QUERY_KEYS.all` y el dashboard
- [x] 2.3 Schema Zod `descartarSolicitudAC.schema.ts` y modal `DescartarSolicitudACModal`
- [x] 2.4 `QEACSection`: botones "Crear AC" y "Descartar solicitud" en el aviso; `id="qe-ac-section"` en la sección
- [x] 2.5 Audit trail: etiquetas e iconos de `SOLICITUD_AC_ATENDIDA` y `SOLICITUD_AC_DESCARTADA`

## 3. Frontend — origen (incidente y NC)

- [x] 3.1 `components/shared/AccionCorrectivaReadOnlyRow.tsx` (tipo, responsable, estado, plazo con semáforo, enlace)
- [x] 3.2 `IncidentACSection` con `qeId`: AC del QE, título con número, contador de solicitudes, vacío, anteriores colapsadas
- [x] 3.3 `ACSection` de NC con `qeGeneradoId`: mismo tratamiento; eliminar import de fixtures MSW
- [x] 3.4 i18n es-PE / en-US (qualityEvents, incidents, nonconformities, common si aplica)

## 4. MSW

- [x] 4.1 `solicitar-ac` con rol/estado y autor en el audit; crear AC descuenta; handler `descartar`
- [x] 4.2 Fixture: incidente con QE que tiene 2 AC y `solicitudesAC = 1`

## 5. Tests frontend

- [x] 5.1 `QEACSection`: JCA ve "Crear AC" y "Descartar solicitud"; descartar oculta el aviso; validación del motivo; `readOnly` sin acciones
- [x] 5.2 `IncidentACSection`: con `qeId` (AC del QE, badges, enlace, contador, anteriores, vacío) y sin `qeId`
- [x] 5.3 `ACSection` NC: con `qeGeneradoId` y sin él
- [x] 5.4 Handlers MSW: descartar y crear AC descuenta

## 6. Cierre

- [ ] 6.1 Suite completa backend (`dotnet test`) y frontend, `tsc --noEmit` y `npm run lint` con cero errores
- [ ] 6.2 Prueba manual con MSW apagado (pasos 1 a 6 de la instrucción), a cargo de Toño
