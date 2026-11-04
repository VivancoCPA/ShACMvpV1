## 1. Backend — nombres en la lectura

- [x] 1.1 Agregar `ReportadoPorNombre`, `LocalNombre` y `ZonaNombre` (`string?`, `[NotMapped]`) a `ShcMvpEndPoint.Domain/Entities/Incidente.cs`
- [x] 1.2 `ObtenerIncidenteHandler`: alias `i.` en todas las columnas, `LEFT JOIN asp_net_users u`, `locales l` y `zonas z`, y seleccionar `NULLIF(TRIM(CONCAT_WS(' ', u.nombre, u.apellido)), '') AS "ReportadoPorNombre"`, `l.nombre AS "LocalNombre"` y `z.nombre AS "ZonaNombre"` (design D2)
- [x] 1.3 `ListarIncidentesHandler`: calificar con `i.` el `whereClause` dinámico, el SELECT y el `ORDER BY`; usar `FROM incidentes i` también en el `COUNT`; agregar los mismos JOIN y columnas solo al SELECT de items (design D3)
- [x] 1.4 Confirmar que EF no detecta cambios de modelo (`dotnet ef migrations has-pending-model-changes` o equivalente). No generar migración
- [x] 1.5 Tests: el detalle trae los 3 nombres; sin local ni zona → `null` y 200; el listado trae los nombres y los filtros `tipo`, fechas, `search`, `showDeleted` y paginación siguen funcionando; el detalle de otra empresa da 404; `POST` con `ubicacionX`/`ubicacionY` y luego `GET` devuelve `ubicacion: { x, y }`

## 2. Frontend — tipos y capa API

- [x] 2.1 Agregar `reportadoPorNombre?: string` a `Incidente` en `types/incident.types.ts`
- [x] 2.2 Helper `toUbicacionPayload` en `api/incidents.api.ts`, aplicado en `createIncident`, `createIncidentOfflineSync` y `updateIncident` (envía `ubicacionX`/`ubicacionY` y nunca `ubicacion`)
- [x] 2.3 Tests de `incidents.api`: crear y actualizar con ubicación traducen bien; sin ubicación no se envía ninguno de los tres campos

## 3. Frontend — detalle

- [x] 3.1 `IncidentDetailPage`: mover `selectedLocal` y `usePlanoBlob` antes del primer `return`, y revisar que ningún hook del archivo (ni de sus subcomponentes) quede después de un `return`
- [x] 3.2 "Reportado por" muestra `reportadoPorNombre` o `detail.fields.usuarioDesconocido`; Local y Zona muestran el nombre o `—`; `alt` del plano = `localNombre ?? t('detail.fields.local')`
- [x] 3.3 Bloque Ubicación: plano `w-full` con máx 480 px; casos con punto, sin punto (`detail.ubicacion.sinPunto`) y sin plano (`detail.ubicacion.sinPlano`); skeleton mientras carga el blob (design D7)
- [x] 3.4 Tests: transición `isLoading` true → false sin error (regresión); ningún GUID visible, con nombres y con fallbacks; los tres casos del plano

## 4. Frontend — formulario y resto de M3

- [x] 4.1 `IncidentForm`: mostrar `form.ubicacion.sinPlano` cuando el local elegido no tiene plano; mantener el plano clicable a 360 px; confirmar que en edición se ve el pin guardado
- [x] 4.2 Revisar la regla de hooks en `IncidentForm.tsx`, `IncidentEditPage.tsx` e `IncidentMapView.tsx`
- [x] 4.3 Buscar `reportadoPorId`, `localId` y `zonaId` pintados como texto en la lista, `IncidentMapSidePanel`, `IncidentMapCanvas` y `HeatmapIncidentesWidget`, y aplicar el mismo criterio de nombre o fallback
- [x] 4.4 Tests de `IncidentForm` en edición: pin guardado visible; aviso con un local sin plano
- [x] 4.5 i18n `incidents` en `es-PE.json` y `en-US.json`: `detail.fields.usuarioDesconocido`, `detail.ubicacion.sinPunto`, `detail.ubicacion.sinPlano` y `form.ubicacion.sinPlano`

## 5. MSW

- [x] 5.1 Fixtures de incidentes: agregar `reportadoPorNombre` y asegurar `localNombre`/`zonaNombre` donde haya `localId`/`zonaId`
- [x] 5.2 Handlers: nombres en `GET /api/incidents` (cada item) y en `GET /api/incidents/:id`
- [x] 5.3 `POST /api/incidents` y `PATCH /api/incidents/:id`: leer `ubicacionX`/`ubicacionY`, devolver `ubicacion: { x, y }` y dejar de leer `body.ubicacion`

## 6. Verificación

- [x] 6.1 Suite completa frontend (`vitest run`) y backend (`dotnet test`) en verde
- [x] 6.2 `tsc --noEmit` sin errores (criterio: archivos del change; ver design.md)
- [x] 6.3 `npm run lint`: cero `react-hooks/rules-of-hooks` y cero errores en los archivos tocados; registrar en `design.md` cuántos errores quedan en el resto (línea base: 60)
- [x] 6.4 Registrar en `design.md` cualquier divergencia adicional respecto de la instrucción
- [x] 6.5 Dejar listo para la prueba manual con MSW apagado (detener backend → `dotnet build` → `dotnet run` → Ctrl+F5) según los 6 pasos de la instrucción
