## 1. i18n

- [x] 1.1 Agregar claves nuevas en `dashboard` namespace de
      `src/i18n/es-PE.json` y `src/i18n/en-US.json` (mismo nivel que
      `jefeCalidad`/`altaDireccion` existentes, ej. bajo un bloque
      `heatmapIncidentes`): título del widget, label del selector de local,
      label + opciones del selector de período (3/6/12, reutilizar patrón
      `rango.opciones.<n>` de `tendencia`), texto del badge de exclusión
      (con interpolación de conteo), y cualquier texto adicional del widget.

## 2. Widget `HeatmapIncidentesWidget`

- [x] 2.1 Crear `src/features/dashboard/components/HeatmapIncidentesWidget.tsx`:
      importar `useLocales` y `useIncidentList` de `features/incidents`,
      `IncidentMapCanvas` (+ tipo `MarkerGroup` si hace falta) de
      `features/incidents/components/IncidentMapCanvas`.
- [x] 2.2 Estado local: `selectedLocalId` (default `activeLocales[0]?.id ?? ''`,
      igual que `IncidentMapView.tsx`) y `rango` (`RANGOS = [3, 6, 12] as const`,
      default `6`, igual que `TendenciaMensualWidget.tsx`).
- [x] 2.3 Selector de local: mismo markup/clases que el `<select>` de
      `IncidentMapView.tsx` (label asociado vía `htmlFor`/`id`,
      `activeLocales.map(...)`), pero como `useState` local en vez de
      `useSearchParams` (el widget no tiene ruta propia).
- [x] 2.4 Selector de período: mismo markup que el grupo de botones de
      `TendenciaMensualWidget.tsx` (`role="group"`, `aria-label`,
      `aria-pressed`, clases `bg-coral`/hairline con variantes `dark:`).
- [x] 2.5 Filtrar `incidentes` de `useIncidentList()` por `fechaEvento`
      dentro de los últimos `rango` meses (`useMemo`, sin `useEffect`) →
      `incidentesEnPeriodo`.
- [x] 2.6 Badge de exclusión: `useMemo` que cuenta
      `incidentesEnPeriodo.filter(i => !i.ubicacion).length` y renderiza el
      texto localizado solo cuando el conteo es > 0.
- [x] 2.7 Renderizar `<IncidentMapCanvas incidentes={incidentesEnPeriodo}
      localId={selectedLocalId} planoPngUrl={selectedLocal?.planoPngUrl}
      onGroupClick={() => {}} />` — sin panel lateral.
- [x] 2.8 Estado de carga: mismo spinner/patrón que `IncidentMapView.tsx`
      mientras `localesLoading` (o el loading equivalente de
      `useIncidentList()`, si aplica) es `true`.
- [x] 2.9 Todas las clases Tailwind con variante `dark:` correspondiente;
      todo texto vía `t('dashboard:...')`.

## 3. Tests del widget

- [x] 3.1 Crear `HeatmapIncidentesWidget.test.tsx` (patrón de
      `TendenciaMensualWidget.test.tsx` / `ACsExtensionPlazoWidget.test.tsx`):
      render con MSW/QueryClient de test.
- [x] 3.2 Test: local con 6 incidentes con `ubicacion` en la misma zona
      dentro del período → `IncidentMapCanvas` recibe el array esperado
      (marcador grande rojo es responsabilidad de `IncidentMapCanvas`, ya
      cubierto por sus propios tests — aquí solo verificar que el widget le
      pasa los datos correctos).
- [x] 3.3 Test: cambiar el selector de local del widget no dispara refetch
      ni cambia props/estado de ningún KPI widget hermano (aislamiento,
      CA-ADD03-10 / S08-CA-02).
- [x] 3.4 Test: local sin incidentes con `ubicacion` en el período → se
      renderiza el estado vacío de `IncidentMapCanvas`, no un error.
- [x] 3.5 Test: cambiar el rango de período filtra correctamente por
      `fechaEvento` (incidentes fuera de rango no llegan a `IncidentMapCanvas`).
- [x] 3.6 Test: badge de exclusión muestra el conteo correcto de incidentes
      sin `ubicacion` en el período y se oculta cuando el conteo es 0.
- [x] 3.7 Test: onGroupClick no navega ni abre panel lateral (no-op).

## 4. Montaje en dashboards

- [x] 4.1 `JefeCalidadDashboard.tsx`: importar y renderizar
      `<HeatmapIncidentesWidget>` después de `<TendenciaMensualWidget>`,
      dentro de la rama ya gateada por `data.rol === 'JEFE_CALIDAD'` (sin
      guard nuevo).
- [x] 4.2 `AltaDireccionDashboard.tsx`: importar y renderizar
      `<HeatmapIncidentesWidget>` después de `<ACsExtensionPlazoWidget>`,
      dentro de la rama gateada por `data.rol === 'ALTA_DIRECCION'`.
- [x] 4.3 Actualizar (si existen) los tests de `JefeCalidadDashboard.test.tsx`
      / `AltaDireccionDashboard.test.tsx` y/o `DashboardPage.test.tsx` para
      cubrir S08-CA-05 (widget presente para ALTA_DIRECCION/JEFE_CALIDAD,
      ausente para OPERARIO, SUPERVISOR, AUDITOR_INTERNO,
      JEFE_CONTROL_DOCUMENTARIO, ADMINISTRADOR_SISTEMA).

## 5. Verificación final

- [x] 5.1 Confirmar que `IncidentMapCanvas.tsx`, `useLocales.ts` y
      `useIncidentList` no fueron modificados (diff limpio en esos archivos).
- [x] 5.2 Confirmar que `useDashboardSummary` y KPI-01–KPI-09 no cambiaron
      de comportamiento (diff limpio fuera de los dos dashboards y el
      widget nuevo).
- [x] 5.3 Correr suite de tests de `features/dashboard` y `features/incidents`
      completa; typecheck sin `any`.
- [x] 5.4 Verificación manual en navegador (light + dark mode): widget en
      ambos dashboards, selector de local, selector de período, tooltip,
      badge de exclusión, estado vacío.
