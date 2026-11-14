## Why

En el detalle del QE, con solicitudes de AC pendientes, el JCA ve dos botones que hacen lo mismo: "+ Crear AC" en el aviso de solicitudes y "+ Nueva AC" en el encabezado de la sección. Ambos abren el mismo modal con la misma condición (`canAsignarAC`), y crear la AC desde cualquiera ya descuenta la solicitud en el backend. El del aviso es redundante y Toño pidió quitarlo.

## What Changes

- `QEACSection`: se elimina el botón "+ Crear AC" del aviso de solicitudes pendientes. En el aviso queda solo "Descartar solicitud" (condición actual: `!readOnly`).
- El texto del aviso indica cómo atender la solicitud: "{{count}} solicitud(es) de nueva AC pendientes — registradas desde el origen del QE. Créala con «Nueva AC» o descártala."
- i18n `qualityEvents` (es-PE, en-US): se elimina `detail.acSection.crearDesdeSolicitud` y se actualiza `detail.acSection.solicitudesACBanner`.
- Tests de `QEACSection` actualizados: el aviso no tiene "Crear AC", sí "Descartar solicitud", el encabezado sigue con "Nueva AC", y crear la AC desde "Nueva AC" con una solicitud pendiente hace desaparecer el aviso.
- No cambia el botón "Crear AC" del panel de sugerencias de la IA (`detail.investigation.ia.crearAC`), que precarga la acción sugerida.

## Capabilities

### New Capabilities

_(ninguna)_

### Modified Capabilities

- `quality-event-ac-section`: el aviso de solicitudes pendientes ya no incluye "Crear AC"; su texto remite a «Nueva AC».
- `qe-solicitudes-ac`: el requisito "Aviso de solicitudes en el QE con acciones para el JCA" deja de ofrecer "Crear AC" en el aviso; la creación se hace desde "Nueva AC" del encabezado.

## Impact

- `shc-controldoc/src/features/quality-events/components/QEACSection.tsx` y su test.
- `shc-controldoc/src/i18n/es-PE.json`, `shc-controldoc/src/i18n/en-US.json`.
- Sin cambios de backend, API, MSW ni tipos.
