## Why

En la prueba manual de M3 Incidentes (2026-10-20), Toño reportó que "al grabar un incidente da error" y que "al editar se muestran códigos en Reportado por, Local y Zona". La revisión del código confirmó que el guardado sí funciona: lo que se cae es el detalle (`IncidentDetailPage`), por un hook (`usePlanoBlob`) que se llama después de los `return` anticipados. Además el backend no devuelve ningún nombre (solo GUIDs), y la ubicación marcada en el plano nunca se guarda porque el frontend manda `ubicacion: { x, y }` y el backend espera `ubicacionX` / `ubicacionY`. Son tres defectos que dejan el detalle del incidente inutilizable en el entorno real (MSW apagado).

## What Changes

- **Detalle que se cae:** `selectedLocal` y `usePlanoBlob` pasan a llamarse antes de cualquier `return` anticipado en `IncidentDetailPage`. Se revisan también `IncidentForm`, `IncidentEditPage` e `IncidentMapView` para que ningún hook quede después de un `return`.
- **Nombres en lugar de códigos (backend):** `GET /api/incidents/{id}` y `GET /api/incidents` devuelven `reportadoPorNombre`, `localNombre` y `zonaNombre`, resueltos con `LEFT JOIN` a `asp_net_users`, `locales` y `zonas`. Son propiedades `[NotMapped]` de la entidad `Incidente`, así que **no hay migración**.
- **Nombres en lugar de códigos (frontend):** "Reportado por" muestra el nombre o "Usuario no disponible". Local y Zona muestran el nombre o `—`. Nunca se pinta un GUID. Se aplica el mismo criterio al resto de M3 (lista, panel y canvas del mapa) y al `HeatmapIncidentesWidget`.
- **Ubicación en el plano (defecto A):** `incidents.api.ts` traduce `ubicacion: { x, y }` a `ubicacionX` / `ubicacionY` en `createIncident`, `createIncidentOfflineSync` y `updateIncident`. Los formularios y schemas no cambian.
- **Plano en el detalle:** el plano sube a un ancho máximo de 480 px (`w-full` en móvil) y se muestra aunque no haya punto marcado, con un aviso. Si el local no tiene plano, se ve un aviso. Mientras carga el blob se muestra un skeleton.
- **Plano en la edición:** si el local elegido no tiene plano, se ve un aviso. En edición aparece el punto guardado.
- **MSW:** los handlers y fixtures devuelven `reportadoPorNombre`, `localNombre` y `zonaNombre` en el detalle y en el listado. `POST` y `PATCH` aceptan `ubicacionX` / `ubicacionY`, igual que el backend real.
- **Verificación:** `npm run lint` pasa a formar parte de las verificaciones del change (decisión D4), con cero errores de `react-hooks/rules-of-hooks`.

Fuera de alcance: que se puedan editar los campos básicos en ABIERTO (siguiente change, `incidentes-edicion-campos-basicos`). También que "Limpiar ubicación" borre la ubicación guardada, porque `ActualizarInvestigacionHandler` ignora los nulos.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `be-incidentes-api`: el detalle y el listado de incidentes devuelven los nombres resueltos de quien reportó, del local y de la zona.
- `incident-types`: `Incidente` suma `reportadoPorNombre?`.
- `incident-api-client`: la creación (online y offline-sync) y la actualización traducen `ubicacion` a `ubicacionX` / `ubicacionY`.
- `incident-detail`: el detalle se renderiza sin error al pasar de carga a datos. La cabecera muestra el nombre de quien reportó, nunca el GUID. El bloque Ubicación muestra el plano a 480 px, con los casos con punto, sin punto y sin plano.
- `incident-form`: aviso cuando el local elegido no tiene plano. En edición se ve el punto guardado.
- `incident-msw-handlers`: los nombres van en el detalle y en el listado, y la ubicación usa el contrato `ubicacionX` / `ubicacionY` en POST y PATCH.

## Impact

- **Backend:** `Domain/Entities/Incidente.cs`, `Features/Incidentes/ObtenerIncidente/ObtenerIncidenteHandler.cs`, `Features/Incidentes/ListarIncidentes/ListarIncidentesHandler.cs` y tests en `ShcMvpEndPoint.Tests`. Sin migración.
- **Frontend:** `features/incidents/pages/IncidentDetailPage.tsx`, `components/IncidentForm.tsx`, `api/incidents.api.ts`, `types/incident.types.ts`, la lista, el panel y el canvas del mapa, `features/dashboard/components/HeatmapIncidentesWidget.tsx` (solo si pinta IDs), `i18n/es-PE.json` y `i18n/en-US.json`.
- **MSW:** `mocks/handlers/incidents.handlers.ts` y `mocks/fixtures/incidents.fixtures.ts`.
- **Contrato API:** solo se agregan campos de lectura. El cliente empieza a usar el contrato de escritura de ubicación que el backend ya tenía. No hay cambios incompatibles.
