## 1. Backend: consulta unificada y política de visibilidad

- [x] 1.1 Confirmar en `VerificarAccionCorrectivaQEHandler` si `fecha_cierre` siempre se llena al verificar (D5). Ajustar el `COALESCE` y anotarlo en design.md
- [x] 1.2 `Features/AccionesCorrectivas/Shared/AccionesCorrectivasVisibilidad.cs`: mapear rol → alcance (`Todas` | `Supervisor(areaIds, usuarioId)` | `Responsable(usuarioId)` | `Prohibido`), como función pura
- [x] 1.3 `Shared/AccionesCorrectivasQuery.cs`:
  - SQL `UNION ALL` de las tres tablas, con JOIN al origen, a `areas` y a `asp_net_users` (nombre del responsable en incidente);
  - filtros base y visibilidad en SQL;
  - ramas omitidas según `origenTipo`
- [x] 1.4 `Shared/AccionCorrectivaListadoRow` y su DTO de salida. Normalización de estado (D2), `Vencida` con `DashboardKpiCalculator.EsAcVencida` sobre el estado original, y `DiasHabilesRestantes` con signo (D6)
- [x] 1.5 `Shared/AccionesCorrectivasFiltros.cs`:
  - parseo y validación de query params (400 ante un valor inválido; `pageSize` máximo 100);
  - filtros de estado en C#;
  - orden (D7);
  - contadores (D4), con el período de cierre por defecto = mes actual en `America/Lima`

## 2. Backend: endpoints

- [x] 2.1 Slice `ListarAccionesCorrectivas/`: `GET /api/acciones-correctivas` → `{ items, pagination, contadores }`, con `RequireEmpresaActivaFilter`, `RequireAuthorization` y 403 por rol
- [x] 2.2 Slice `ExportarAccionesCorrectivas/`: `GET /api/acciones-correctivas/export`, sin paginar. Con más de 5.000 filas → 422 `EXPORT_DEMASIADAS_FILAS` (revisar cómo `ApiExceptionHandler` emite `errorCode`, y agregar la excepción si falta)
- [x] 2.3 Slice `ObtenerOrigenAccionCorrectiva/`: `GET /api/acciones-correctivas/{id:guid}/origen` → `{ origenTipo, origenId }`, con 404 y 403
- [x] 2.4 Registrar los tres endpoints y el handler en `Program.cs` (DI), siguiendo el patrón de `CandidatosResponsableACEndpoint`

## 3. Backend: índices

- [x] 3.1 `ShacDbContext`: `HasIndex(e => e.ResponsableId)` en `AccionCorrectivaQE`, `AccionCorrectivaNC` y `AccionCorrectivaIncidente`
- [x] 3.2 `dotnet ef migrations add AddIndicesResponsableAcciones`. Revisar que la migración solo cree índices, y que no queden cambios de modelo pendientes

## 4. Backend: tests (`ShcMvpEndPoint.Tests/Features/AccionesCorrectivas/`)

- [x] 4.1 Unificación: AC de QE, NC e incidente, cada una con su número y su área de origen
- [x] 4.2 Normalización: COMPLETADA (en las tres tablas) → `PENDIENTE_VERIFICACION`. VENCIDA de NC → `EN_EJECUCION` con `Vencida = true`
- [x] 4.3 Coherencia: `contadores.vencidas` es igual al KPI-08 (`GET /api/dashboard/kpis`) para un JCA con el mismo set de datos
- [x] 4.4 Visibilidad: el JCA ve todas; el SUP ve las de su área más las suyas de otra área, pero no las ajenas de otra área; el OPE ve solo las suyas; el ADMIN_EMPRESA recibe 403; otra empresa nunca aparece
- [x] 4.5 Contadores: cada uno es igual a `pagination.totalItems` con su filtro equivalente. Los filtros de estado no alteran los contadores
- [x] 4.6 Filtros y paginación: combinaciones de estado, vencida, porVencer, tipo, origen, área, responsable y search; `pageSize` > 100 → 400
- [x] 4.7 Se excluyen las AC con el origen eliminado
- [x] 4.8 Export: respeta los filtros y la visibilidad; con más de 5.000 filas → 422 `EXPORT_DEMASIADAS_FILAS`
- [x] 4.9 Origen: QE, NC e incidente → `{ origenTipo, origenId }`; inexistente u otra empresa → 404
- [x] 4.10 Unit tests de `AccionesCorrectivasVisibilidad` y del cálculo de días hábiles con signo

## 5. MSW

- [x] 5.1 Extraer `esAcVencida` y la unificación y normalización de AC a `src/mocks/utils/accionesCorrectivas.mock.ts`. `dashboard.handlers.ts` pasa a importarlo, sin cambio de comportamiento
- [x] 5.2 Handlers `GET /api/acciones-correctivas`, `/export` y `/:id/origen` en `acciones-correctivas.handlers.ts`, con visibilidad, filtros, contadores, 403, 404 y 422. Orden de registro: `export` y `candidatos-responsable` antes de `/:id/origen`
- [x] 5.3 Completar los fixtures existentes si hace falta, para que los seis contadores sean mayores que 0 y haya AC de los tres orígenes
- [x] 5.4 Tests de handlers: vencidas igual al KPI-08, visibilidad del OPE y del SUP, contadores iguales al total con su filtro, y 422

## 6. Frontend: datos

- [x] 6.1 Tipos `types/accionesCorrectivasListado.types.ts`
- [x] 6.2 API `api/accionesCorrectivasListado.api.ts`: listar, exportar y origen. Serializar `estado` como lista separada por comas
- [x] 6.3 Hooks `useAccionesCorrectivasListado` (key `['acciones-correctivas', 'listado', filtros]`, `keepPreviousData`) y `useOrigenAccionCorrectiva`
- [x] 6.4 `utils/filtrosUrl.ts`: parse y serialize de `ACListadoFiltros` ↔ `URLSearchParams`, definición de las tarjetas (filtro y activa), rango del mes actual en Lima, y `rutaOrigenAC`
- [x] 6.5 `invalidarDashboard` también invalida `['acciones-correctivas', 'listado']` (D11), con su test

## 7. Frontend: UI

- [x] 7.1 `AlertaCard`: nivel `success` (D13) y su test
- [x] 7.2 `components/ACContadores.tsx`: seis `AlertaCard` selectoras
- [x] 7.3 `components/ACFiltrosBar.tsx`: filtros en la URL, responsable oculto para el OPE, áreas del SUP y "Limpiar filtros"
- [x] 7.4 `components/ACTabla.tsx`: tabla ordenable y paginada (componente compartido de paginación), semáforo, navegación condicionada por `isRouteAllowedForRole`, tarjetas en móvil y estado vacío. Light y dark
- [x] 7.5 `utils/exportAccionesCorrectivas.ts`: `buildAccionesCorrectivasWorkbook` (fechas en Lima; plazo como fecha de calendario), nombre del archivo y descarga. Toast ante 422
- [x] 7.6 `pages/AccionesCorrectivasPage.tsx`: `PageWrapper`, título por rol, botón de exportar en `actions` y `ErrorBoundary`
- [x] 7.7 `components/AccionCorrectivaOrigenRedirect.tsx`
- [x] 7.8 Ancla de la sección de AC del QE: se reutiliza `id="qe-ac-section"` de `QEACSection`, que ahora se desplaza a la vista al montar con ese hash
- [x] 7.9 Enlace "Ver todas" en la pestaña "Vencidas" de `ACsVencidasPorVencerWidget`

## 8. Frontend: ruta, menú e i18n

- [x] 8.1 `ROUTE_ROLE_GROUPS.accionesCorrectivas` y su entrada en `ROUTE_ACCESS_TABLE`
- [x] 8.2 `router/index.tsx`: `/acciones-correctivas` y `/acciones-correctivas/:id`, con breadcrumb
- [x] 8.3 `Sidebar.tsx`: ítem `ListChecks` con los seis roles
- [x] 8.4 Namespace `accionesCorrectivas` (es-PE y en-US), `nav.accionesCorrectivas` y la clave "Ver todas" de `dashboard`. Registrar el namespace en `i18n/index.ts`

## 9. Frontend: tests

- [x] 9.1 Clic en "Vencidas": la URL tiene `vencida=true`, la tarjeta tiene `aria-pressed`, y el total de la tabla es igual al contador (paginando si hace falta)
- [x] 9.2 Los filtros persisten tras un re-render desde la URL (F5)
- [x] 9.3 El OPERARIO ve "Mis acciones correctivas", sin el filtro de responsable
- [x] 9.4 Clic en una fila de origen QE → `/quality-events/{id}#qe-ac-section`
- [x] 9.5 `buildAccionesCorrectivasWorkbook`: columnas, fechas en Lima y plazo sin corrimiento
- [x] 9.6 `AccionCorrectivaOrigenRedirect`: redirige al origen y, ante un 404, vuelve al listado
- [x] 9.7 Sidebar y routing: visible y accesible para los seis roles; los roles de administración, no

## 10. Verificación

- [ ] 10.1 Suite completa del backend (`dotnet test`)
- [x] 10.2 Suite completa del frontend, `tsc --noEmit` y `npm run lint` con cero errores — sin errores nuevos; quedan los preexistentes de HEAD: 18 de tsc (fixtures de documents, PanelPendientesAreaWidget), 37 de lint y el test documentReplaceOriginal.test.tsx
- [x] 10.3 Actualizar la tabla de módulos y las notas de `CLAUDE.md` si corresponde, y registrar en design.md cualquier divergencia encontrada al implementar
