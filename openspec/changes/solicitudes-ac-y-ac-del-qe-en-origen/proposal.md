## Why

Toño cerró una AC en un QE y el aviso "AC pendiente desde el origen del QE" siguió apareciendo, y en el incidente que originó ese QE la AC creada no se veía. Al leer el código se confirmaron dos causas:

1. `SolicitudesAC` solo sube (`SolicitarACEnQEHandler`, `+= 1`) y nada lo descuenta. Por eso el aviso y el badge quedan para siempre, y RN-QE-009 traba todo QE que alguna vez recibió una solicitud en `EN_INVESTIGACION`.
2. Desde `incidentes-qe-estado-alertas` las AC se trabajan en el QE, pero `IncidentACSection` y `ACSection` (NC) siguen listando solo las AC propias del incidente o de la NC, que ahora quedan vacías.

## What Changes

- **Solicitar AC** (`PATCH /api/quality-events/{id}/solicitar-ac`): solo pueden solicitar OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST y ALTA_DIRECCION (los demás reciben 403). Con el QE en `CERRADO`, `EN_VERIFICACION` o `VERIFICADO` se responde 422.
- **Crear una AC en el QE atiende una solicitud pendiente.** Si `SolicitudesAC > 0`, se descuenta 1 en la misma transacción y se registra el audit `SOLICITUD_AC_ATENDIDA`. Esto incluye la AC creada desde el asistente de IA, que usa el mismo endpoint.
- **Nuevo** `POST /api/quality-events/{id}/solicitudes-ac/descartar` con `{ motivo }` (20 a 500 caracteres):
  - solo el JCA; cualquier otro rol recibe 403;
  - si no hay solicitudes pendientes, 422 `SIN_SOLICITUDES_PENDIENTES`;
  - descuenta 1, registra el audit `SOLICITUD_AC_DESCARTADA` y avisa (best-effort) al solicitante.
- **Aviso de solicitudes en el QE:** el JCA tiene dos acciones, "Crear AC" y "Descartar solicitud" (en un modal con el motivo). Al crear o descartar se invalidan el detalle y la lista del QE y el dashboard.
- **Incidente y NC con QE vinculado:**
  - muestran las AC del QE en solo lectura (descripción, tipo, responsable, estado y plazo), con enlace al QE y el contador "Solicitudes pendientes en el QE";
  - las AC propias antiguas se muestran debajo, colapsadas, como "anteriores".
- Nueva fila compartida `AccionCorrectivaReadOnlyRow`.
- `ACSection` de NC deja de importar fixtures MSW para resolver el número del QE (violaba la regla 13).
- MSW: los mismos comportamientos que el backend y un fixture de incidente con QE que tiene 2 AC y 1 solicitud pendiente.
- No hay migración: la columna `solicitudes_ac` ya existe.

## Capabilities

### New Capabilities
- `qe-solicitudes-ac`: ciclo de vida del contador de solicitudes de AC del QE. Cubre quién solicita, el descuento al crear una AC, el descarte por el JCA con su motivo, el audit trail, el aviso al solicitante, el aviso del QE con sus acciones y el espejo en MSW.
- `ac-del-qe-en-origen`: lectura de las AC del QE desde el incidente y la NC de origen. Cubre la lista en solo lectura, el contador de solicitudes pendientes, la sección de AC anteriores, la fila compartida y el acceso del OPERARIO.

### Modified Capabilities
- `quality-event-ac-section`: el requisito del aviso de solicitudes pendientes suma las acciones "Crear AC" y "Descartar solicitud", y la actualización inmediata del aviso, el badge y RN-QE-009.

## Impact

- **Backend** (`ShcMvpEndPoint/Features/QualityEvents/`):
  - se modifican `SolicitarACEnQE` y `CrearAccionCorrectivaQEHandler`;
  - se agrega el slice nuevo `DescartarSolicitudAC` y su registro en `EndpointExtensions`;
  - se agrega un método nuevo al notification sender de QE;
  - se agregan tests de integración.
- **Frontend:**
  - en `features/quality-events/` cambian `QEACSection`, la API y los hooks (`useDescartarSolicitudAC`) y se invalida la lista al crear una AC;
  - en `features/incidents/` cambia `IncidentACSection`;
  - en `features/nonconformities/` cambia `ACSection`;
  - se agrega `components/shared/AccionCorrectivaReadOnlyRow.tsx`;
  - se agregan las claves i18n en es-PE y en-US.
- **MSW:** cambian `quality-events.handlers.ts` y los fixtures de QE e incidentes.
- **Sin cambios de esquema** de base de datos.
