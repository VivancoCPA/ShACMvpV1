## Why

En la prueba manual de M3 Incidentes (2026-10-21) Toño hizo tres observaciones de UI:
1. No se entiende por qué INC-2026-003 muestra "Sin QE vinculado" y los demás no. La regla RN-INC-006 funciona bien, pero el tooltip habla del "plazo de investigación" (es el plazo para **vincular un QE**) y no dice horas ni cuánto falta.
2. En la vista mapa el plano sale enorme, y los marcadores quedan corridos cuando `object-contain` deja franjas vacías.
3. En el alta y la edición, el botón Guardar queda fuera de la vista al final de un formulario largo.

## What Changes

- **Tooltip "Sin QE vinculado" (D1):** nueva función pura `getIncidentQEPlazoInfo(incidente, now)` → `{ plazoHoras, horasRestantes }` en `incidentQEAlert.ts`. `getIncidentQEAlertLevel` no cambia. `IncidentSinQEBadge` recibe el incidente y muestra "Plazo para vincular un QE: {{plazo}} h · vence en {{restante}}" (AMARILLO) o "… · vencido hace {{vencido}}" (ROJO), con duración `X h` (< 48 h) o `X d Y h` (≥ 48 h). El mismo texto va en `title` y `aria-label`.
- **Mapa (D2):** `IncidentMapCanvas` envuelve la imagen en un contenedor que mide lo mismo que ella (`relative inline-block`), con la imagen limitada a `max-h-[70vh]` y `max-w-full`, sin `object-contain`. Los marcadores y sus tooltips se posicionan en % de ese envoltorio. `IncidentMapView` baja su alto mínimo a `min-h-[320px]`, y el panel lateral queda limitado a `max-h-[70vh]`.
- **Barra de acciones fija (D3):** el bloque de acciones de `IncidentForm` pasa a ser una barra `sticky bottom-0`, dentro del `<form>`, con Cancelar y Guardar siempre visibles en alta y edición.
- RN-INC-006, backend, MSW y migraciones no cambian.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `incident-list-view`: se suma el requisito del badge "Sin QE vinculado", con el tooltip y el `aria-label` que indican el plazo para vincular un QE y el tiempo restante o vencido.
- `incident-map-view`: el plano se ajusta a un alto máximo de 70vh y los marcadores se posicionan sobre el área real de la imagen, no sobre el contenedor.
- `incident-form`: se agrega la barra de acciones fija al pie (sticky) en alta y edición.

## Impact

- **Frontend:** `features/incidents/utils/incidentQEAlert.ts`, `components/IncidentSinQEBadge.tsx`, `components/IncidentList.tsx`, `components/IncidentMapCanvas.tsx`, `pages/IncidentMapView.tsx`, `components/IncidentMapSidePanel.tsx` (solo el alto máximo) y `components/IncidentForm.tsx`, más los tests de cada uno.
- **i18n:** `incidents:list.sinQEBadge.tooltip.*` en `es-PE.json` y `en-US.json`, más las unidades de duración.
- **Consumidor indirecto:** `features/dashboard/components/HeatmapIncidentesWidget.tsx` reutiliza `IncidentMapCanvas` y recibe el mismo ajuste sin cambios de código.
- **Orden de archivo:** este change toca `IncidentForm.tsx`, igual que `fix-incidentes-detalle-nombres-ubicacion`, que sigue activo. El código se aplica sobre el árbol de trabajo actual, que ya contiene aquel fix. Para archivar, primero va `fix-incidentes-detalle-nombres-ubicacion` y después este.
