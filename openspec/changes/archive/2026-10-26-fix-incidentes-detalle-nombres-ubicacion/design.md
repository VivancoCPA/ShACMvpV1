## Context

En la prueba manual de M3 con MSW apagado (2026-10-20) aparecieron tres defectos encadenados. La instrucción de Cowork es `Claude outputs/INSTRUCCIONES-CLAUDE-CODE-fix-incidentes-detalle-nombres-ubicacion-2026-10-20.md`.

1. **El detalle se cae.** `IncidentDetailPage.tsx` sale por `if (isLoading) return <SkeletonBlock />` (línea 220) y por `if (isError || !incident)` (línea 222) antes de llamar a `usePlanoBlob` (línea 248). En el primer render sin caché, React registra N hooks; con datos registra N+1 y lanza "Rendered more hooks…". El bug entró con `proteccion-documental` D7 (plano como blob autenticado). ESLint lo detecta: es el **único** error `react-hooks/rules-of-hooks` del repo.
2. **Se muestran GUIDs.** `ObtenerIncidenteHandler` y `ListarIncidentesHandler` (Dapper, SQL a mano) leen solo de `incidentes`. `localNombre` y `zonaNombre` existían únicamente en MSW, y no había ningún campo para el nombre de quien reportó.
3. **La ubicación nunca se guarda (defecto A).** El frontend envía `ubicacion: { x, y }` y el backend espera `UbicacionX` / `UbicacionY` en `CrearIncidenteCommand` y `ActualizarInvestigacionCommand`. La lectura sí funciona: la entidad expone `Ubicacion` como propiedad calculada.

Línea base de `npx eslint .` antes del change: **60 errores** (27 `no-unused-vars`, 7 `set-state-in-effect`, 5 `no-fallthrough`, etc.). De ellos, 1 es `rules-of-hooks` (`IncidentDetailPage.tsx:248`).

## Goals / Non-Goals

**Goals:**
- Que el detalle no se caiga nunca al pasar de carga a datos.
- Que en M3 no se pinte ningún GUID como texto visible para reportante, local o zona, con cualquier rol.
- Que la ubicación marcada en el plano se guarde al crear y al editar, y se vea en el detalle y en la edición.
- Mejorar el plano del detalle: 480 px, casos sin punto y sin plano, skeleton mientras carga.
- Sumar `npm run lint` a las verificaciones.

**Non-Goals:**
- Que los campos básicos se puedan editar en ABIERTO. Va en el siguiente change, `incidentes-edicion-campos-basicos`.
- Que "Limpiar ubicación" borre la ubicación ya guardada. `ActualizarInvestigacionHandler` ignora los `null` (`if (command.UbicacionX is not null)`), así que enviar `null` no la borra. Hace falta una semántica explícita de borrado (p.ej. un flag `limpiarUbicacion`), que va en el siguiente change.
- Mapa GPS. Se trata del plano del local.

## Decisions

### D1. Nombres resueltos en backend con `LEFT JOIN` y propiedades `[NotMapped]`
Se agregan `ReportadoPorNombre`, `LocalNombre` y `ZonaNombre` (`string?`, con setter, porque Dapper las llena) a `Incidente` con `[NotMapped]`. A diferencia de `Ubicacion`, que es get-only y EF ya ignora por convención, estas tienen setter, y sin `[NotMapped]` EF las tomaría como columnas. Se verifica con `dotnet ef migrations has-pending-model-changes` (o generando y descartando una migración vacía).
- *Alternativa descartada:* resolver los nombres en el frontend con `useUsers`/`useLocales`. Un OPERARIO no puede listar usuarios (decisión D2 de Toño), y sería un N+1 en la lista.

### D2. Nombre completo con `CONCAT_WS`, no con `||`
La instrucción propone `TRIM(u.nombre || ' ' || u.apellido)`. En PostgreSQL, `||` con un `NULL` da `NULL`, así que un usuario sin apellido quedaría sin nombre. Se usa `NULLIF(TRIM(CONCAT_WS(' ', u.nombre, u.apellido)), '') AS "ReportadoPorNombre"`. **Divergencia deliberada** respecto de la instrucción, por robustez. Las columnas `asp_net_users.nombre` / `apellido` y `locales.nombre` / `zonas.nombre` se confirman en `DocumentoAsignacionService`, `ListarLocalesHandler` y `ListarZonasPorLocalHandler`.

### D3. Alias `i.` en todas las columnas del listado, incluido el `COUNT`
`ListarIncidentesHandler` comparte un único `whereClause` dinámico entre el `COUNT` y el SELECT de items. Al calificar el WHERE con `i.` (`i.empresa_id`, `i.deleted_at`, `i.tipo`, `i.fecha_evento`, `i.numero`, `i.descripcion`), el `COUNT` también pasa a `FROM incidentes i` (sin JOINs, no los necesita). `ORDER BY` pasa a `i.fecha_reporte`. En `ObtenerIncidenteHandler` se mantiene `WHERE i.id = @Id` con la verificación de empresa en código, que ya existía y conserva el 404 sin cambios.

### D4. Las escrituras siguen devolviendo los nombres en `null`
Todas las mutaciones de `useIncidents.ts` hacen `invalidateQueries` (ninguna hace `setQueryData` con la respuesta), así que el detalle siempre se vuelve a pedir y llega con nombres. No se reutiliza `ObtenerIncidenteHandler` al final de crear, actualizar ni cambiar estado: sería una query extra sin beneficio visible.

### D5. La traducción de ubicación va en la capa API
Un helper `toUbicacionPayload<T extends { ubicacion?: IncidenteUbicacion }>(data)` en `api/incidents.api.ts` devuelve el objeto sin `ubicacion` y con `ubicacionX` / `ubicacionY` si venía. Lo usan `createIncident`, `createIncidentOfflineSync` y `updateIncident`. Así los schemas Zod, los formularios y la cola offline (que guarda el input del formulario) no cambian. Para la cola offline, los items ya encolados con `ubicacion` se traducen al sincronizar, sin necesidad de migrar la cola. El reporte rápido mobile (`IncidentQuickReportForm` / `mobileIncidentReport.schema.ts`) no captura `ubicacion`, así que no se toca.

### D6. Hooks antes de cualquier `return`
En `IncidentDetailPage` se suben `selectedLocal = locales.find((l) => l.id === incident?.localId)` y `usePlanoBlob(...)` antes del primer `return`. Se revisan con la misma regla los subcomponentes del archivo, `IncidentForm.tsx` (sus `return` tempranos están en subcomponentes o callbacks, pero hay que confirmarlo), `IncidentEditPage.tsx` e `IncidentMapView.tsx`. La red de seguridad es `npm run lint`: cero `rules-of-hooks`.

### D7. Estados del plano en el detalle
`usePlanoBlob` devuelve `planoUrl` (y su estado de carga). En el render: si hay `planoPngUrl` y el blob está cargando, skeleton `w-full max-w-[480px] aspect-[4/3]`; si ya está, la imagen con el pin opcional, y el texto `sinPunto` si no hay `ubicacion`; si no hay `planoPngUrl`, el texto `sinPlano`. Si `usePlanoBlob` no expone el estado de carga, se deriva como `planoPngUrl && !planoUrl && !isError`, sin `useEffect`.

### D8. Lint como verificación
`npm run lint` entra en las verificaciones del change. Hay que corregir todos los `rules-of-hooks` (hoy solo hay uno) y los errores de los archivos que toca este change. El resto queda registrado aquí con su cuenta final al cerrar el apply.

## Risks / Trade-offs

- [Columna ambigua que se escapa en un filtro poco usado] → Tests de integración del listado con cada filtro (`tipo`, fechas, `search`, `showDeleted`, paginación).
- [La instrucción menciona un filtro por `estado` que el listado backend no tiene] → **Divergencia:** el endpoint real solo filtra por `tipo`, `fechaDesde`, `fechaHasta`, `search` y `showDeleted` (spec `be-incidentes-api`). Los tests cubren esos filtros. No se agrega un filtro por estado (fuera de alcance).
- [EF toma las propiedades nuevas como columnas] → `[NotMapped]` y verificar que no queden cambios de modelo pendientes. Si aparecen, se revisa antes de seguir. **No se genera migración.**
- [Usuario reportante eliminado o de otra empresa] → `LEFT JOIN` da `null` y el frontend muestra "Usuario no disponible".
- [Items offline encolados antes del fix] → La traducción ocurre al enviar (D5), así que también se cubren.

## Migration Plan

Sin migración de BD. El despliegue es: detener el backend → `dotnet build` → `dotnet run` → recargar el frontend (Ctrl+F5). El rollback es revertir el commit, porque solo hay campos de lectura agregados y el contrato de escritura ya existía.

## Open Questions

Ninguna bloqueante.

## Notas de implementación (apply 2026-10-20)

Divergencias y hallazgos respecto de la instrucción y de las decisiones de arriba:

- **SQL compartido:** `ObtenerIncidenteHandler` y `ListarIncidentesHandler` tenían la misma lista de columnas duplicada. Se extrajo a `Features/Incidentes/Shared/IncidenteSql.cs` (`Columnas`, `ColumnasNombres`, `FromConNombres`), toda calificada con `i.`, para que los alias no puedan divergir entre detalle y listado.
- **Sin migración, verificado por test:** `IncidentesNombresUbicacionEndpointTests.Modelo_NombresNoSonColumnasDeEf` comprueba que el modelo EF no tiene `ReportadoPorNombre`, `LocalNombre` ni `ZonaNombre`. No se corrió `dotnet ef` porque el backend local de Toño estaba en ejecución y bloquea `bin/`. Build y tests se corrieron con `--artifacts-path` en un directorio temporal, sin detener su proceso.
- **MSW, nombres resueltos al responder:** la tarea 5.1 pedía agregar `reportadoPorNombre` a los fixtures. En cambio, `incidents.handlers.ts` resuelve los tres nombres al responder (`withNombres`), con `resolveUserDisplayName` y `localFixtures`/`zonaFixtures`. Así también los incidentes creados en sesión llegan con nombres, igual que con el LEFT JOIN real, y no se duplican nombres en ~40 fixtures. Si el usuario es desconocido se devuelve `undefined`, nunca el id (paridad con el `null` del backend).
- **MSW `POST /api/incidents`:** `reportadoPorId` pasa a tomarse del usuario de sesión (antes era el literal `'user-mock-001'`), igual que el backend. Sin esto, el paso 6 de la prueba manual (OPERARIO ve su nombre) no se podía reproducir en mock.
- **MSW `PATCH /api/incidents/:id`:** los campos planos `ubicacionX`/`ubicacionY` se quitan del spread del body para no dejarlos guardados en el incidente. Si son nulos o faltan no tocan la ubicación, mismo criterio que `ActualizarInvestigacionHandler`.
- **Locales inactivos:** el detalle resuelve el plano con `useLocales()`, que solo trae locales activos. Un incidente en un local desactivado muestra "Este local no tiene plano cargado." aunque el local tenga plano. Es un caso borde aceptado y no se cambia aquí.
- **Mientras cargan los locales:** el bloque Ubicación muestra el skeleton del plano, no el aviso "sin plano", para no mostrar un falso negativo antes de saber si el local tiene plano.
- **Test de regresión de hooks:** el mock de `usePlanoBlob` llama un hook real (`useMemo`). Con un mock que no llama hooks, el test pasaba incluso con el código roto. Se verificó que el test falla contra la versión anterior de `IncidentDetailPage.tsx` y pasa con la nueva.
- **`tsc` en `IncidentForm.tsx:412` (preexistente):** al editar, `...data` arrastraba el campo de formulario `evidencias: File[]` al tipo del PATCH. Se corrigió sobreescribiendo `evidencias` siempre: las subidas o `undefined`, que se omite al serializar. El comportamiento en runtime no cambia, porque el formulario nunca asigna ese campo.
- **Lint (D8):** línea base 60 errores, final **58**. `react-hooks/rules-of-hooks` quedó en **0** (el único era este bug). Se corrigieron también los errores de los archivos tocados (un `no-unused-vars` preexistente en `incidents.handlers.test.ts`). Los 58 restantes están en archivos que este change no toca, entre ellos 4 en `features/incidents/hooks/useOfflineIncidentSync.ts` (`react-hooks/refs`, refs asignadas durante el render), que conviene revisar en un change aparte.
- **`tsc --noEmit` (fuera de alcance):** quedan 17 errores, todos en Documentos (`mocks/fixtures/documents.fixtures.ts`, `mocks/handlers/documents.handlers.ts`, `types/documents.types.test.ts`), por `archivoUrl` ya no presente en `Documento` y por `string | null`. Son trabajo sin commitear en Documentos, ajeno a este change. Incidentes queda en 0.
- **Cierre de verificaciones (2026-10-21, decisión de Toño):** suite, `tsc` y lint se dan por cumplidos con el criterio "cero errores en los archivos del change". Línea base del repo al cerrar: `vitest run` 1705 ok / 1 fallo ajeno (`router/documentReplaceOriginal.test.tsx`) y 3 *unhandled errors* de `sesion-timeout-inactividad` en `IncidentQuickReportForm.test.tsx`; `tsc` 17 errores, todos en Documentos; lint 58 errores, ninguno en los archivos del change. `dotnet test`: la corrida con el backend detenido la cortó el sistema por falta de memoria antes de terminar; hasta ahí solo se vio un fallo en `DocumentosPdfConversionTests` (Documentos). Falta una corrida completa del backend, porque este change sí toca `IncidenteSql`.
