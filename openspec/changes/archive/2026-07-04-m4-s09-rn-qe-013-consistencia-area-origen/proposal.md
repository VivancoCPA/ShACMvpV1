## Why

RN-QE-010 (M4-S08) ya usa `areaAfectada` del QE como base para decidir permisos de edición del Supervisor, pero hoy ese campo se ingresa sin ninguna relación con el área ya registrada en la NC o Incidente que originó el QE. Además, no existe todavía un punto de entrada para crear un QE directamente desde el detalle de una NC o Incidente — solo existe navegación hacia un QE que **ya** está vinculado. Sin ese punto de entrada, no hay forma de prellenar ni comparar áreas. Esta propuesta cierra ambos huecos: agrega el botón "Crear QE" en NC e Incidente, y usa la información que ese botón transporta para prellenar y advertir sobre divergencias de área en `QualityEventForm`.

## What Changes

- Nueva regla de negocio **RN-QE-013**: al crear un QE con origen O2 (NC) u O1 (Incidente), `areaAfectada` se prellena con el área de la entidad origen; si el usuario la cambia y el valor final difiere al guardar, se muestra una advertencia no bloqueante con el tipo, número y área exacta de la entidad origen.
- **Corrección de alcance sobre la propuesta original**: solo los orígenes **O1 (Incidente)** y **O2 (NC)** tienen una entidad vinculada con campo de área propio (`areaId` / `areaAfectada`) contra el cual comparar. O3 (`hallazgoAuditoriaRef`) y O4 (`reporteExternoRef`) son referencias de texto libre sin entidad de origen ni campo de área — RN-QE-013 no aplica a ellos.
- Nuevo botón **"Crear QE"** en el detalle de NC (`nc-detail-page`) y en el detalle de Incidente (`incident-detail`), visible solo para `SUPERVISOR` y `JEFE_CALIDAD_SYST` cuando la entidad no tiene ya un QE vinculado (`qeGeneradoId` / `qeId` ausente) y no está en un estado terminal/anulado. El botón navega a `/quality-events/nuevo` con query params que incluyen origen, id, número y área de la entidad origen.
- Nueva bandera de permiso `canCrearQE` en `NCPermissions` (M2) e `IncidentPermissions` (M3), siguiendo el mismo patrón de `canAddAC`.
- `QualityEventForm` (M4-S04) lee los nuevos query params al montar en modo creación, prellena `origen`, el campo específico de origen (`ncId`/`incidenteId`), y ahora también `areaAfectada`; compara en tiempo real el valor final de `areaAfectada` contra el área de origen y muestra la advertencia exacta si difieren al momento de guardar.

## Capabilities

### New Capabilities

(ninguna — todos los cambios extienden capacidades existentes)

### Modified Capabilities

- `quality-event-form`: al prellenar desde query params de vinculación NC/Incidente, agrega prellenado de `areaAfectada` y comparación/advertencia en tiempo real contra el área de la entidad origen (RN-QE-013).
- `nc-detail-page`: agrega el botón "Crear QE" que navega a `/quality-events/nuevo` con query params de vinculación cuando la NC no tiene QE vinculado.
- `nonconformity-types`: agrega la bandera `canCrearQE` a la interfaz `NCPermissions`.
- `nonconformity-permissions`: agrega la regla de cómputo de `canCrearQE` en `getNCPermissions`.
- `incident-detail`: agrega el botón "Crear QE" que navega a `/quality-events/nuevo` con query params de vinculación cuando el Incidente no tiene QE vinculado.
- `incident-permissions`: agrega la bandera `canCrearQE` a `IncidentPermissions` y su regla de cómputo.

## Impact

- **Código afectado**: `src/features/quality-events/pages/QualityEventForm.tsx`, `src/features/nonconformities/pages/NonconformityDetailPage.tsx`, `src/features/nonconformities/utils/ncPermissions.ts`, `src/features/nonconformities/types/nonconformity.types.ts`, `src/features/incidents/pages/IncidentDetailPage.tsx` (o equivalente), `src/features/incidents/utils/incidentPermissions.ts`, `src/features/incidents/types/incidentPermissions.types.ts`.
- **i18n**: nuevas claves en `qualityEvents` (mensaje de advertencia de área, botón no aplica aquí) y en `nonconformities`/`incidents` (texto del botón "Crear QE") para `es-PE` y `en-US`.
- **No afecta**: backend/mock de vínculo inverso (no se setea `qeGeneradoId`/`qeId` en la NC/Incidente al crear el QE — queda fuera de alcance, es un stub provisional ya documentado); RN-QE-010/011/012 (el área que prevalece para permisos de edición del QE sigue siendo la del propio QE); orígenes O3/O4.
