## 1. Datos: auditorAsignadoId y fix de esResponsable

- [x] 1.1 Agregar `auditorAsignadoId?: string` a `QualityEvent` en `src/features/quality-events/types/qualityEvent.types.ts`.
- [x] 1.2 Actualizar `forzarVencimientoVerificacion` en `src/features/quality-events/api/quality-events.api.ts` para aceptar `auditorAsignadoId` opcional y enviarlo en el body del PATCH.
- [x] 1.3 Actualizar `useForzarVencimientoVerificacion` (`src/features/quality-events/hooks/useForzarVencimientoVerificacion.ts`) para que `mutate` acepte `{ id, auditorAsignadoId? }`.
- [x] 1.4 Actualizar el handler `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion` en `src/mocks/handlers/quality-events.handlers.ts`: al forzar desde `CERRADO`, persistir `auditorAsignadoId` del body en el QE actualizado; al forzar desde `EN_VERIFICACION` (reapertura por vencimiento) no lo modifica.
- [x] 1.5 En `QEVerificacionSection.tsx`: agregar un `<select>` requerido de `auditorAsignadoId` (opciones = usuarios `AUDITOR_INTERNO`, vía el fixture/hook de usuarios ya usado en otros selects de asignación) visible mientras `qe.estado === 'CERRADO'`; deshabilitar el botón "Forzar vencimiento" hasta que haya un valor seleccionado; pasar el valor seleccionado a `mutate`.
- [x] 1.6 En `QEVerificacionSection.tsx` línea ~36: reemplazar `getQualityEventPermissions(qe.estado, user.rol, false)` por `getQualityEventPermissions(qe.estado, user.rol, user?.id === qe.auditorAsignadoId)`.
- [x] 1.7 Poblar `auditorAsignadoId` en `src/mocks/fixtures/quality-events.fixtures.ts` para todos los fixtures con `estado === 'EN_VERIFICACION'`, usando ids de usuarios `AUDITOR_INTERNO` existentes en `users.fixtures.ts`.
- [x] 1.8 Actualizar/agregar tests: `QEVerificacionSection.test.tsx` (form visible solo para el auditor asignado; select requerido antes de forzar desde CERRADO), `useForzarVencimientoVerificacion` y el handler de `quality-events.handlers.ts` (auditorAsignadoId persistido).

## 2. Hook y widget compartidos: useAccionesRequeridas / AccionesRequeridasWidget

- [x] 2.1 Crear `src/features/dashboard/types/accionesRequeridas.types.ts` (o agregar a `dashboardSummary.types.ts`) con el tipo `AccionRequerida`.
- [x] 2.2 Crear `src/features/dashboard/hooks/useAccionesRequeridas.ts`, consumiendo directamente `useQualityEvents({ pageSize: 200 })`, `useNonconformities({ pageSize: 200 })`, `useIncidents({ pageSize: 200 })`, `useDocuments({ pageSize: 200 })` (no los hooks `use*List()` acoplados a `useSearchParams`).
- [x] 2.3 Implementar la extracción de ítems de dominio QE: causa raíz (`JEFE_CALIDAD_SYST`), cerrar (`JEFE_CALIDAD_SYST`, replicando `showClosureForm || showFirstSignature` de `QECierreSection.tsx`), firmar cierre (`SUPERVISOR`/`ALTA_DIRECCION`, replicando `showSecondSignature` vía `resolveRolSegundaFirma`), verificar (`JEFE_CALIDAD_SYST` y `AUDITOR_INTERNO` con `auditorAsignadoId === user.id`).
- [x] 2.4 Implementar la extracción de ítems de dominio AC recorriendo `accionesCorrectivas` de QE, NC e Incidentes, filtrando por `responsableId === user.id`, estado `PENDIENTE`/`EN_EJECUCION` sin `descripcionEvidencia`, marcando `prioridad: 'alta'` cuando está vencida (vía `calcularEstadoSemaforoDesdeFecha`).
- [x] 2.5 Implementar la extracción de ítems de dominio Documento replicando la derivación de `DocRole` de `DocumentDetailPage.tsx` (revisor/EN_REVISION, aprobador/EN_APROBACION, autor/EN_REVISION_PERIODICA).
- [x] 2.6 Crear `src/features/dashboard/components/AccionesRequeridasWidget.tsx`: agrupado por dominio (QE, AC, Documento), ordenado por prioridad y fecha límite dentro de cada grupo, máximo 10 ítems + "ver todos", estado vacío explícito, clases `dark:` en todos los elementos visibles.
- [x] 2.7 Agregar claves i18n en `src/i18n/es-PE.json` y `src/i18n/en-US.json` bajo el namespace `dashboard` (título del widget, labels por `tipo`/`dominio`, estado vacío, "ver todos").
- [x] 2.8 Montar `AccionesRequeridasWidget` como primer widget en `OperarioDashboard.tsx`, `SupervisorDashboard.tsx`, `AltaDireccionDashboard.tsx`, `AuditorDashboard.tsx` y `JefeCalidadDashboard.tsx`, fuera del gate de `isLoading`/`data.rol` de cada página.
- [x] 2.9 Tests: `useAccionesRequeridas.test.ts` (casos de la tabla de la Decisión 2 de `design.md`: falso positivo de JEFE_CALIDAD_SYST evitado, AUDITOR_INTERNO filtrado por auditorAsignadoId, AC de los 3 orígenes, Documentos por rol) y `AccionesRequeridasWidget.test.tsx` (agrupación, límite de 10, estado vacío, navegación por click).

## 3. Dashboard nuevo para Jefe de Control Documentario

- [x] 3.1 Agregar `JefeControlDocDashboardData = Record<string, never>` y la variante `{ rol: 'JEFE_CONTROL_DOC'; data: JefeControlDocDashboardData }` a `DashboardSummaryData` en `src/features/dashboard/types/dashboardData.types.ts`.
- [x] 3.2 Actualizar `ROLE_TO_DASHBOARD_TYPE` en `src/features/dashboard/utils/dashboardRoleMapping.ts`: `JEFE_CONTROL_DOCUMENTARIO: 'JEFE_CONTROL_DOC'` (ya no `'JEFE_CALIDAD'`).
- [x] 3.3 En `src/mocks/handlers/dashboard.handlers.ts`: agregar `buildJefeControlDocumentarioData()` (retorna `{}`) y el `case 'JEFE_CONTROL_DOC'` en `buildDashboardSummary`; eliminar la rama `esControlDocumentario` de `buildJefeCalidadData` (comentario "ver design.md, decisión 4" incluido).
- [x] 3.4 Crear `src/features/dashboard/pages/JefeControlDocumentarioDashboard.tsx` siguiendo el patrón skeleton + gate por `data.rol === 'JEFE_CONTROL_DOC'` de los otros 5 dashboards, renderizando únicamente `AccionesRequeridasWidget`.
- [x] 3.5 Montar la nueva rama en `DashboardPage.tsx`: `if (dashboardType === 'JEFE_CONTROL_DOC') return <JefeControlDocumentarioDashboard />`.
- [x] 3.6 Agregar clave i18n del título del nuevo dashboard (namespace `dashboard`) en `es-PE.json`/`en-US.json`.
- [x] 3.7 Actualizar/agregar tests: `dashboardRoleMapping.test.ts` (JEFE_CONTROL_DOCUMENTARIO → JEFE_CONTROL_DOC), `dashboard.handlers.test.ts` (JEFE_CONTROL_DOCUMENTARIO ya no recibe forma de JefeCalidadDashboardData), `JefeControlDocumentarioDashboard.test.tsx`, `DashboardPage.test.tsx` (nueva rama), y ajustar cualquier test existente de `JefeCalidadDashboard.test.tsx`/`dashboard.handlers.test.ts` que hoy asuma que `JEFE_CONTROL_DOCUMENTARIO` comparte el dashboard de Jefe de Calidad.

## 4. Verificación final

- [x] 4.1 Ejecutar la suite de tests completa (`vitest run` o equivalente del proyecto) y confirmar que no quedan referencias rotas al mapeo anterior `JEFE_CONTROL_DOCUMENTARIO → JEFE_CALIDAD`.
- [x] 4.2 Probar manualmente en el navegador (MSW activo): login como cada uno de los 6 roles y confirmar que el panel "Requiere tu atención" aparece como primer widget con datos coherentes, y que `JEFE_CONTROL_DOCUMENTARIO` ve su propio dashboard.
- [x] 4.3 Probar manualmente el flujo dev-only: forzar vencimiento desde `CERRADO` seleccionando un auditor, confirmar que ese auditor (y ningún otro `AUDITOR_INTERNO`) ve el formulario REG-EFEC-001 y el ítem correspondiente en su panel.
