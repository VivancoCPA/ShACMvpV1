## 1. Tipos — QE-AC-007 mínimo y resúmenes de dashboard

- [x] 1.1 Agregar `SolicitudAjustePlazoAC` y el campo opcional `solicitudAjustePlazo?: SolicitudAjustePlazoAC` a `AccionCorrectivaQE` en `src/features/quality-events/types/qualityEvent.types.ts`.
- [x] 1.2 Agregar `QEReaperturaResumen` (extiende `QEResumen` con `ciclo`, `fechaReapertura`) y `ACSolicitudAjustePlazoResumen` a `src/features/dashboard/types/dashboardSummary.types.ts`.
- [x] 1.3 Extender `AltaDireccionDashboardData` en `src/features/dashboard/types/dashboardData.types.ts`: `resumenPorModulo.qualityEvents` gana `abiertos`/`vencidos`; agregar `comparativaMensual`, `reaperturas`, `acsConSolicitudAjustePlazo`.

## 2. Fixtures — seed de solicitudAjustePlazo

- [x] 2.1 En `src/mocks/fixtures/quality-events.fixtures.ts`, agregar `solicitudAjustePlazo` con `estado: 'PENDIENTE'` a al menos 2 `AccionCorrectivaQE` de QEs `severidad: 'ALTA'` o `'CRITICA'` (en `qeAccionesCorrectivas`).
- [x] 2.2 Agregar al menos 1 `AccionCorrectivaQE` adicional con `solicitudAjustePlazo.estado` en `'APROBADA'` o `'RECHAZADA'` (fixture negativo para verificar el filtro por `PENDIENTE`).
- [x] 2.3 Confirmar que los QEs con `ciclo > 1` ya existentes (≥5 fixtures, requerido por `quality-event-msw-fixtures`) tienen entradas de `auditTrail` con `estadoNuevo: 'REABIERTO'` y `timestamp` válido — no se requiere fixture nuevo, solo verificar cobertura para el widget de reaperturas.

## 3. Backend mock — buildAltaDireccionData

- [x] ~~3.1 En `src/mocks/handlers/dashboard.handlers.ts`, calcular `resumenPorModulo.qualityEvents.abiertos` (`estado !== 'VERIFICADO'`) y `.vencidos` (subconjunto con `contarDiasHabiles(fechaHoraReporte, new Date()) > PLAZO_MAXIMO_QE_DIAS_HABILES[severidad]`, reutilizando `contarDiasHabiles` de `src/utils/businessDays.ts` y `PLAZO_MAXIMO_QE_DIAS_HABILES` de `kpi.constants.ts`).~~ **Corregido (ver 3.6):** este diseño original contaba QEs `CERRADO` como "abiertos" y comparaba contra `fechaHoraReporte` indefinidamente, marcando como "vencidos" QEs cerrados hace meses.
- [x] 3.2 Implementar helper `clasificarTendencia(actual, anterior)` (`'SUBE' | 'BAJA' | 'ESTABLE'`, umbral de 2 puntos) y calcular `comparativaMensual` para KPI-01/04/05 invocando `calcularKpi01`/`calcularKpi04`/`calcularKpi05` sobre `ultimosMeses(2)`.
- [x] 3.3 Calcular `reaperturas: QEReaperturaResumen[]` (QE con `ciclo > 1`, `fechaReapertura` = último `auditTrail` con `estadoNuevo === 'REABIERTO'`, fallback `actualizadoEn`, ordenado descendente).
- [x] 3.4 Calcular `acsConSolicitudAjustePlazo: ACSolicitudAjustePlazoResumen[]` (QEs `ALTA`/`CRITICA`, ACs con `solicitudAjustePlazo?.estado === 'PENDIENTE'`).
- [x] 3.5 Escribir/actualizar tests de `dashboard.handlers.test.ts` cubriendo los 4 cálculos anteriores (incluyendo el caso `REABIERTO` contado como abierto/vencido, y el filtro de severidad en ACs).
- [x] 3.6 **Corrección:** `resumenPorModulo.qualityEvents.abiertos` ahora excluye `CERRADO` además de `VERIFICADO`. `.vencidos` usa `plazoMaximoQEPorEstado(estado, severidad)` (`kpi.constants.ts`) — tabla por estado (`EN_INVESTIGACION`/`ANALISIS_COMPLETADO`/`PENDIENTE_CIERRE` por severidad, ya usada en KPI-01; `EN_VERIFICACION` fijo 10d hábiles por RN-QE-008; `ABIERTO`/`EN_EJECUCION`/`REABIERTO` sin presupuesto propio → nunca vencidos) — comparado contra `fechaEntradaEstadoActual(qe)` (último `auditTrail` con `estadoNuevo === qe.estado`, fallback `fechaHoraReporte`), no `fechaHoraReporte` a secas. Tests nuevos en `dashboard.handlers.test.ts` cubren: exclusión de `CERRADO`, no-vencimiento de `ABIERTO`/`EN_EJECUCION`, y uso de la fecha de entrada al estado vs. `fechaHoraReporte`.

## 4. Componentes — widgets de Alta Dirección

- [x] 4.1 Crear `KpisEjecutivosWidget.tsx` (5 tarjetas: QEs abiertos, QEs vencidos, KPI-01, KPI-04, KPI-05).
- [x] 4.2 Crear `ComparativaMensualWidget.tsx` (valor actual, valor mes anterior, ícono/etiqueta de tendencia ↑/↓/= para KPI-01/04/05).
- [x] 4.3 Crear `QEsCriticosWidget.tsx` (lista `alertasCriticas`, enlace a `/quality-events/:id`, estado vacío si no hay elementos).
- [x] 4.4 Crear `ReaperturasWidget.tsx` (lista `reaperturas` ya ordenada, muestra `ciclo`, enlace a `/quality-events/:id`).
- [x] 4.5 Crear `ACsExtensionPlazoWidget.tsx` (lista `acsConSolicitudAjustePlazo`, enlace a `/quality-events/:qeId`, sin botones de aprobar/rechazar).
- [x] 4.6 Test unitario por widget cubriendo su escenario principal (dato presente) y su estado vacío.

## 5. Página y routing

- [x] 5.1 Crear `AltaDireccionDashboard.tsx` en `src/features/dashboard/pages/` (patrón de `JefeCalidadDashboard.tsx`: `useDashboardSummary()`, guard de `isLoading`/`data.rol !== 'ALTA_DIRECCION'` con `WidgetSkeleton` x5, composición de los 5 widgets en `space-y-8` dentro de `PageWrapper`).
- [x] 5.2 Cablear en `src/features/dashboard/pages/DashboardPage.tsx` la rama `if (dashboardType === 'ALTA_DIRECCION') return <AltaDireccionDashboard />` (reemplaza el fallback `<ComingSoon />` para ese tipo).
- [x] 5.3 Test de `DashboardPage.test.ts`/`AltaDireccionDashboard.test.tsx` cubriendo el guard de carga y la composición de los 5 widgets.

## 6. i18n

- [x] 6.1 Agregar claves nuevas del namespace `dashboard` en `es-PE.json` y `en-US.json` para: título de la página, los 5 widgets, textos de tendencia (sube/baja/estable), estados vacíos.

## 7. Verificación

- [x] 7.1 `npm run typecheck` / `npm run test` (o equivalentes del proyecto) sin errores nuevos.
- [x] 7.2 Browser verification: iniciar sesión con `gerencia@shac.pe` / `Shac2025!`, navegar a `/dashboard`, confirmar los 5 widgets con datos reales del seed (Light y Dark mode).
- [x] 7.3 Confirmar que otros roles (`OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`) no cambian de comportamiento en `/dashboard`.
