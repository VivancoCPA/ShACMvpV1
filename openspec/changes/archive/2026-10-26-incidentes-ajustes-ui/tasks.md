## 1. Tooltip "Sin QE vinculado" (D1)

- [x] 1.1 `getIncidentQEPlazoInfo(incidente, now)` en `utils/incidentQEAlert.ts` (floor; negativo si venció), sin tocar `getIncidentQEAlertLevel`
- [x] 1.2 Tests en `incidentQEAlert.test.ts`: plazo por tipo, `horasRestantes` positivo antes y negativo después; los tests existentes siguen en verde
- [x] 1.3 `IncidentSinQEBadge` recibe `incidente` (+ `now` opcional), formatea la duración (`X h` / `X d Y h`) y pone el mismo texto en `title` y `aria-label`
- [x] 1.4 `IncidentList.tsx` le pasa `incidente={inc}` al badge
- [x] 1.5 i18n `incidents:list.sinQEBadge.tooltip.*` + `duracion.*` en es-PE y en-US
- [x] 1.6 Tests de `IncidentSinQEBadge`: AMARILLO "vence en", ROJO "vencido hace", `aria-label` igual a `title`, NONE no renderiza

## 2. Mapa (D2)

- [x] 2.1 `IncidentMapCanvas`: root centrado; envoltorio `relative inline-block max-w-full` con `<img>` `max-h-[70vh]` sin `object-contain`; marcadores y tooltips dentro del envoltorio
- [x] 2.2 `IncidentMapView`: `min-h-[500px]` → `min-h-[320px]`; `IncidentMapSidePanel` con `max-h-[70vh]`
- [x] 2.3 Revisar `HeatmapIncidentesWidget` (reutiliza el canvas; anotado en design.md, sin cambios)
- [x] 2.4 Test: los marcadores son descendientes del elemento que contiene el `<img>`; el `<img>` tiene `max-h-[70vh]` y no `object-contain`

## 3. Barra de acciones fija (D3)

- [x] 3.1 `IncidentForm`: el bloque Actions pasa a ser una barra sticky (dentro del `<form>`, con dark mode)
- [x] 3.2 Test: el contenedor de las acciones tiene `sticky` y el submit está dentro del `<form>`

## 4. Verificación

- [x] 4.1 Suite completa frontend (`vitest run`) y backend (`dotnet test`)
- [x] 4.2 `tsc --noEmit` sin errores en los archivos del change (hay errores preexistentes en documents; ver design.md)
- [x] 4.3 `npm run lint` con cero errores (criterio: archivos del change; ver design.md)
- [x] 4.4 Prueba manual con MSW apagado (lista/tooltip, mapa, alta, edición, modo oscuro): la hace Toño
