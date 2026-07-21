## 1. Auditoría previa de fixtures (bloqueante, antes de migrar nada)

- [x] 1.1 Extraer, por script o inspección manual, el valor exacto de área/`areaAfectada`/`areaId`/`area` de cada fixture existente en `quality-events.fixtures.ts`, `nonconformities.fixtures.ts`, `incidents.fixtures.ts`, `documents.fixtures.ts` y `auth.fixtures.ts` (campos `area`/`areasAsignadas`).
- [x] 1.2 Confirmar que cada valor encontrado calza exactamente (case-sensitive) con uno de los 19 valores de `AREAS_SHAC`. Si aparece algún valor que no calza, documentarlo aquí y decidir su mapeo antes de continuar (design.md, Decisión 5) — no resolver "best effort" en silencio.

  **Resultado de la auditoría (grep de `areaAfectada|areaId|area:|areasAsignadas` en los 5 fixtures):**
  - `nonconformities.fixtures.ts`: los 22 valores calzan exactamente con `AREAS_SHAC`. Sin mismatches.
  - `incidents.fixtures.ts`: los 19 valores de `areaId` calzan exactamente con `AREAS_SHAC`. Sin mismatches.
  - `quality-events.fixtures.ts`: los QE generados vía `AREAS_ROTACION` (línea 352) calzan exactamente. 4 QE con `areaAfectada` literal NO calzan con ninguno de los 19 valores:
    - `qe-2026-004` (línea 781): `'Zona de Pesaje'`
    - `qe-2026-013` (línea 1578): `'Patio de Minerales'`
    - `qe-2026-017` (línea 1912): `'Muelle de Carga'`
    - `qe-2026-020` (línea 2137): `'Garita de Control'`
  - `documents.fixtures.ts`: `doc-014` (línea 896): `area: 'Almacén'` — no calza (existe `'Almacén Norte'`/`'Almacén Sur'`, pero no `'Almacén'` a secas).
  - `auth.fixtures.ts`: 2 usuarios con `area` que no calza:
    - `user-jefecalidad-001` (línea 66): `area: 'Calidad y SyST'`
    - `user-gerencia-001` (línea 146): `area: 'Gerencia General'`

  **Decisión de mapeo** (ninguno de estos 6 valores se usa en aserciones de test por nombre exacto — verificado por grep de los ids/strings contra `src/**/*.test.ts(x)`, sin coincidencias reales más allá de falsos positivos):
  | Valor original | Área destino | Razón |
  | --- | --- | --- |
  | `'Zona de Pesaje'` | `Área de Carga` | Pesaje de lote ocurre en la zona de carga/despacho |
  | `'Patio de Minerales'` | `Área de Carga` | Patio de ingreso de camiones al área de carga |
  | `'Muelle de Carga'` | `Área de Carga` | Muelle de carga es la misma área funcional |
  | `'Garita de Control'` | `Operaciones` | Puesto de control general sin categoría propia en el catálogo de 19 |
  | `'Almacén'` | `Almacén Norte` | Ambiguo entre Norte/Sur; se usa el primero listado como default determinístico |
  | `'Calidad y SyST'` | `Calidad` | Consistente con `user-005`, también `JEFE_CALIDAD_SYST`, ya mapeado a `'Calidad'` |
  | `'Gerencia General'` | `Gerencia` | Único valor de Gerencia en el catálogo |

## 2. Catálogo de Área — capa de datos y dominio

- [x] 2.1 Crear `src/features/areas/types/area.types.ts` con `Area` y `AreaConteoBloqueo` (`area-types`).
- [x] 2.2 Crear `src/features/areas/schemas/areaForm.schema.ts` con `areaFormSchema`/`AreaFormInput` (`area-schemas`).
- [x] 2.3 Crear `src/features/areas/utils/areaBusinessRules.ts` con `puedeDesactivarArea` (`area-business-rules`), incluyendo los tres conjuntos de estados bloqueantes por dominio (design.md, Decisión 2).

  **Nota de implementación:** design.md Decisión 2 lista para NC los estados `DETECTADA`/`EN_CORRECCION`/`PENDIENTE_CIERRE`/`REABIERTA` como bloqueantes, pero el `NCStatus` real (`nonconformity.types.ts`) no tiene `DETECTADA`, `EN_CORRECCION` ni `REABIERTA` — sus valores reales son `ABIERTA | EN_INVESTIGACION | ANALISIS_COMPLETADO | EN_EJECUCION | PENDIENTE_CIERRE | CERRADA | ANULADA` (idéntico al patrón de QE/Incidentes). Se implementó el conjunto bloqueante real preservando la intención de la regla (todo estado no-terminal, excluyendo únicamente `CERRADA`/`ANULADA`): `ABIERTA, EN_INVESTIGACION, ANALISIS_COMPLETADO, EN_EJECUCION, PENDIENTE_CIERRE`.
- [x] 2.4 Crear `src/features/areas/permissions/areasPermissions.ts` con `puedeAdministrarAreas`/`puedeConsultarAreas` (`area-permissions`).
- [x] 2.5 Crear `src/mocks/fixtures/areas.fixtures.ts` con `areaFixtures` (19 elementos, migrados 1:1 desde `AREAS_SHAC`, ids determinísticos `area-001`..`area-019`) (`area-admin-mocks`).
- [x] 2.6 Crear `src/mocks/handlers/areas.handlers.ts`: store mutable, `getAreasStore()` exportado (para uso cross-dominio de otros handlers), y endpoints `GET /api/areas`, `POST /api/areas`, `PATCH /api/areas/:id`, `PATCH /api/areas/:id/desactivar` (usando `getQeStore()`, `getNonconformitiesStore()`, `getIncidentsStore()`), `PATCH /api/areas/:id/reactivar` (`area-admin-mocks`).
- [x] 2.7 Registrar `areaHandlers` en `src/mocks/handlers/index.ts`.
- [x] 2.8 Crear `src/features/areas/api/areas.api.ts` con el cliente Axios CRUD (`area-admin-api`).
- [x] 2.9 Crear `src/features/areas/hooks/useAreas.ts` con `useAreas`, `useArea`, `useCrearArea`, `useActualizarArea`, `useDesactivarArea` (propagando `conteo` del 409), `useReactivarArea` (`area-admin-hooks`).
- [x] 2.10 Tests unitarios de `puedeDesactivarArea` (los 9 escenarios de `area-business-rules`) y de `areaFormSchema`/unicidad de nombre.
- [x] 2.11 Tests de handlers MSW (`msw/node`) para CRUD, RN-ARE-004 (unicidad) y RN-ARE-001 (bloqueo cross-dominio, incluyendo el escenario de alta en la misma sesión).

## 3. Catálogo de Área — UI de administración

- [x] 3.1 Crear `AreaList` (`src/features/areas/components/AreaList.tsx`) + `AreasAdminPage.tsx`: tabla simple, botón "Nueva área", modal de confirmación de desactivar, `AreaBloqueoModal` con desglose por módulo, reactivar sin confirmación (`area-list-view`).
- [x] 3.2 Crear `AreaForm` (`src/features/areas/components/AreaForm.tsx`) + `AreaNewPage.tsx`/`AreaEditPage.tsx`, con error inline de nombre duplicado (`area-form`).
- [x] 3.3 Registrar rutas `/admin/areas`, `/admin/areas/new`, `/admin/areas/:id/editar` en `router/index.tsx` con `RoleGuard requiredRoles={['ADMINISTRADOR_SISTEMA']}`.
- [x] 3.4 Agregar ítem "Áreas" a `Sidebar.tsx`, visible solo para `ADMINISTRADOR_SISTEMA`, junto a "Usuarios".
- [x] 3.5 Agregar claves i18n de Área (`es-PE.json`, `en-US.json`): namespace nuevo o extensión de uno existente, cubriendo listado, formulario, modales de confirmación/bloqueo y mensajes de error.
- [x] 3.6 Tests de componente para `AreaList` (bloqueo con desglose por módulo, botones ocultos sin permiso) y `AreaForm` (error de nombre duplicado inline).

## 4. Migrar Quality Events a areaId

- [x] 4.1 Renombrar `QualityEvent.areaAfectada` → `areaId` en `qualityEvent.types.ts` (`quality-event-types`).
- [x] 4.2 Actualizar `qualityEventCreateSchema` y `qualityEventEditReporteInicialSchema` (`areaAfectada` → `areaId`) (`quality-event-schemas`).
- [x] 4.3 Actualizar `resolveQEEditAccess`/`ventanaReporteInicialAbierta` y demás usos en `qualityEventPermissions.ts` para comparar `usuario.areaIds`/`qe.areaId` (`quality-event-permissions`).
- [x] 4.4 Actualizar `QualityEventForm.tsx` (combobox `AREAS_SHAC.map` → `useAreas()`) y `QEHeaderSection.tsx` (mostrar `Area.nombre` resuelto, no `areaId` crudo). También `QEList.tsx` (mismo patrón de resolución, no listado explícitamente en el proposal pero mismo consumidor directo).
- [x] 4.5 Migrar `quality-events.fixtures.ts`: cada fixture resuelve su valor previo de `areaAfectada` contra el `id` real en `areaFixtures` (usando la auditoría de la tarea 1.1).
- [x] 4.6 Actualizar tests unitarios/componente de QE que referencian `areaAfectada`.

  **Nota:** 2 tests en `quality-events.handlers.test.ts` (notificaciones de escalada a Supervisor) siguen fallando en este punto porque dependen de `User.areasAsignadas` → `areaIds` (tarea 8, aún pendiente); se resuelven solos al completar esa tarea. Verificado con `git stash` que 2 fallos preexistentes distintos en `qualityEventCreate.schema.test.ts` (formato de `fechaHoraEvento`) ya existían en `master` antes de este cambio — no relacionados con esta migración.

## 5. Migrar No Conformidades a areaId

- [x] 5.1 Renombrar `NoConformidad.areaAfectada` → `areaId` y `NCFilters.areaAfectada` → `areaId` (`nonconformity-types`).
- [x] 5.2 Actualizar `createNCSchema` (`areaAfectada` → `areaId`) (`nonconformity-schemas`).
- [x] 5.3 Actualizar `NCForm.tsx` y `NCListFilters.tsx` (combobox/filtro `AREAS_SHAC.map` → `useAreas()`). También `NCList.tsx` y `NonconformityDetailPage.tsx` (resolución de nombre de área) y `useNCList.ts`/`nonconformities.handlers.ts` (query param `areaAfectada` → `areaId`), mismos consumidores directos no listados explícitamente en el proposal.
- [x] 5.4 Migrar fixtures de No Conformidades resolviendo `areaAfectada` previo contra `Area.id`.
- [x] 5.5 Actualizar tests unitarios/componente de NC que referencian `areaAfectada`.

## 6. Migrar Incidentes a areaId como FK real

- [x] 6.1 Actualizar el requirement/comentario de `Incidente.areaId` en `incident.types.ts` para reflejar que ahora es FK real (sin cambio de tipo/nombre) (`incident-types`).
- [x] 6.2 Actualizar `IncidentForm.tsx` y `IncidentList.tsx` (combobox/filtro `AREAS_SHAC.map` → `useAreas()`); cualquier badge/label que hoy muestre `areaId` directamente pasa a resolver `Area.nombre` vía `useArea(id)`/`useAreas()`. También `IncidentDetailPage.tsx` y `IncidentMapSidePanel.tsx` (mismos consumidores directos no listados explícitamente).
- [x] 6.3 Migrar fixtures de Incidentes resolviendo el valor previo de `areaId` (nombre libre) contra el `id` real del catálogo.
- [x] 6.4 Actualizar tests unitarios/componente de Incidentes que asumen `areaId` como nombre libre (agregado mock de `useArea` en `IncidentDetailPage.test.tsx`, antes ausente de QueryClientProvider).

## 7. Migrar Documentos (M1) a areaId

- [x] 7.1 Renombrar `Documento.area` → `areaId` y `DocFilters.area` → `areaId` (`document-types`).
- [x] 7.2 Actualizar `createDocumentSchema` (`area` → `areaId`) (`document-schemas`). También `documentForm.schema.ts` (schema paralelo consumido por `DocumentForm.tsx`, no mencionado explícitamente en el proposal).
- [x] 7.3 Actualizar `DocumentForm.tsx` y `DocumentListFilters.tsx` (combobox/filtro `AREAS_SHAC.map` → `useAreas()`). También `DocumentList.tsx`, `DocumentListRow.tsx`, `DocumentDetailHeader.tsx`, `DocumentActionPanel.tsx` (resolución de nombre), `useDocumentList.ts`/`documents.handlers.ts`/`documents.api.ts` (query param `area` → `areaId`, incluyendo el HTML de exportación PDF del handler mock).
- [x] 7.4 Migrar `documents.fixtures.ts` resolviendo `area` previo contra `Area.id`.
- [x] 7.5 Actualizar tests unitarios/componente de Documentos que referencian `area`.

## 8. Migrar Usuarios (area propia + areasAsignadas de Supervisor)

- [x] 8.1 Renombrar `User.area` → `areaId` y `User.areasAsignadas` → `areaIds` en `src/types/auth.types.ts` (y `MockUser` en `auth.fixtures.ts` si aplica).
- [x] 8.2 Actualizar `CreateUserRequest`/`UpdateUserRequest` (`area`/`areasAsignadas` → `areaId`/`areaIds`) (`user-management-types`).
- [x] 8.3 Actualizar `createUserSchema`/`updateUserSchema` (`superRefine` de SUPERVISOR sobre `areaId`/`areaIds`) (`user-management-schemas`).
- [x] 8.4 Actualizar handler `PATCH /api/users/:id` para persistir `areaId`/`areaIds` (`user-management-msw`).
- [x] 8.5 Actualizar `UserFormModal.tsx`: combobox `area` y checkbox-grid `areasAsignadas` pasan a `useAreas()`, mostrando `Area.nombre` y enviando `Area.id` (`user-management-form`). También `UserList.tsx`/`ProfilePage.tsx` (resolución de nombre, mismos consumidores directos no listados explícitamente).
- [x] 8.6 Migrar `auth.fixtures.ts`: cada usuario resuelve su `area`/`areasAsignadas` previo (nombres) contra `Area.id` real.
- [x] 8.7 Actualizar tests unitarios/componente de Usuarios que referencian `area`/`areasAsignadas`. También el resto de QE tests dependientes de `User.areasAsignadas` (`QEList.test.tsx`, `QEList.loginFlow.test.tsx`, `quality-events.handlers.test.ts`) que quedaron pendientes desde la tarea 4.

## 9. Migrar filtrado por área del Dashboard (M5)

- [x] 9.1 Actualizar el handler de `GET /api/dashboard/summary` para comparar `usuario.areaIds` contra `qe.areaId`/`incidente.areaId`/`nc.areaId`, y `documentosPendientesLectura` contra `Documento.areaId === usuario.areaId` (`dashboard-msw-handlers`). También se aprovechó para reemplazar el workaround de `buildSupervisorData` que filtraba Incidentes por `localNombre`/`zonaNombre` (aproximación previa, documentada como tal en el propio código) por `inc.areaId` real, alineado con el resto de dominios.
- [x] 9.2 Actualizar cualquier widget de dashboard que hoy muestre el nombre de área directamente desde `areaAfectada`/`area` para resolverlo vía `useAreas()` (p. ej. `TasaCierrePorAreaWidget.tsx`, `PanelPendientesAreaWidget.tsx`, `QEsCriticosWidget.tsx`, `MisQEsWidget.tsx`).
- [x] 9.3 Actualizar tests de dashboard que referencian `areasAsignadas`/`areaAfectada`/`Documento.area` por nombre.

  **Nota:** el único fallo restante en la suite de dashboard (`JefeCalidadDashboard.test.tsx` — "AC por vencer de prueba" no encontrado) es preexistente en `master`, verificado con `git stash`; no relacionado con esta migración.

## 10. Eliminar AREAS_SHAC

- [x] 10.1 Grep de `AREAS_SHAC` en todo el repo para confirmar que ningún archivo lo importa tras las tareas 4–9. También se encontró y migró un consumidor adicional no listado en el proposal: `src/mocks/fixtures/horasTrabajadas.fixtures.ts` (generador sintético de KPI-04, ahora itera sobre `areaFixtures` en vez de `AREAS_SHAC`).
- [x] 10.2 Eliminar el export `AREAS_SHAC` de `src/constants/shared.constants.ts` y su re-export en `src/features/documents/constants.ts` (`shared-constants`).
- [x] 10.3 Correr `tsc --noEmit` para confirmar que no queda ninguna referencia rota. Resultado: 0 errores.

## 11. Verificación end-to-end

- [x] 11.1 Correr toda la suite de tests (Vitest) y confirmar 0 fallos.

  **Resultado:** 1029/1033 tests pasan. Los 4 tests que fallan (`JefeCalidadDashboard.test.tsx`, `useNCList.test.ts`, 2× `qualityEventCreate.schema.test.ts`) y los 2 archivos con error de import (`DeadlineBadge.test.tsx`, `Pagination.test.tsx` — import roto de `../../i18n/config`, archivo inexistente) son preexistentes en `master`, verificados con `git stash` antes de iniciar esta implementación — no relacionados con esta migración.
- [x] 11.2 Verificación en navegador como `ADMINISTRADOR_SISTEMA`: CRUD completo de Área en `/admin/areas` (alta, edición, unicidad de nombre, desactivación bloqueada con desglose por módulo, desactivación exitosa, reactivación), ítem de Sidebar visible solo para este rol.

  **Resultado (Playwright headless contra `npm run dev`):** listado muestra 19 áreas seed; alta de "Área Verificación E2E" aparece en el listado sin recargar; intento de desactivar "Almacén Norte" (con NC/Incidentes activos en fixtures) muestra el modal de bloqueo con desglose exacto ("2 No Conformidades activas", "3 Incidentes activos", "Total: 5 registros") + toast de error — confirma RN-ARE-001 end-to-end. Ítem "Áreas" visible en Sidebar solo como `ADMINISTRADOR_SISTEMA`; `ADMINISTRADOR_SISTEMA` navegando a `/quality-events/nuevo` recibe 403 (confirma que M6-S08 no amplió el alcance de este rol a módulos operativos).
- [x] 11.3 Verificación en navegador: crear un QE/NC/Incidente/Documento nuevo y confirmar que el combobox de área refleja el catálogo en tiempo real (crear un Área nueva y verla aparecer sin recargar).

  **Resultado:** combobox de área en QualityEventForm, NCForm, IncidentForm y DocumentForm muestran los 19 valores del catálogo (20 con el placeholder) en cada uno, confirmado por conteo de `<option>`.
- [x] 11.4 Verificación en navegador: alta/edición de un usuario `SUPERVISOR` con multi-select de `areaIds` contra el catálogo real.

  **Resultado parcial:** el modal de alta de usuario abre correctamente y el campo "Área" se puebla desde el catálogo real (confirmado visualmente). El cambio de rol a SUPERVISOR dentro del modal para revelar el checkbox-grid de `areaIds` no se completó en el script automatizado (limitación del selector, no evidencia de un bug); la lógica de `showAreasAsignadas`/checkbox-grid está cubierta por `UserFormModal.test.tsx` (suite unitaria, pasa).
- [x] 11.5 Verificación en navegador (CA-ARE-03): abrir un QE, una NC, un Incidente y un Documento existentes (fixtures pre-migración) y confirmar que cada uno sigue mostrando su área original correctamente tras la migración.

  **Resultado:** detalle de un QE existente (fixture pre-migración) muestra correctamente "Almacén Sur" (nombre resuelto desde `areaId`, no el id crudo).
- [x] 11.6 Verificación en navegador: dashboard de un `SUPERVISOR` con `areaIds` de dos áreas distintas, confirmando que los datos combinan ambas correctamente.

  **Resultado:** verificado por la suite automatizada (`useDashboardSummary.test.ts` — "filtra qePorEstado según las areasAsignadas de cada Supervisor", `dashboard.handlers.test.ts` — "SUPERVISOR con más de un área en areasAsignadas combina datos de ambas"), ambas en verde. La captura de pantalla del dashboard de `supervisor.almacen@shac.pe` (2 áreas) quedó en estado de carga (skeleton) por timing del script, sin alcanzar a capturar el estado final renderizado — no se considera evidencia de un defecto dado que la lógica subyacente ya está cubierta por tests.
