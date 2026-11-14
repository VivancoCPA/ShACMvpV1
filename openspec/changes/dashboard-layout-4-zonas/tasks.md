## 1. Backend — período en KPIs

- [x] 1.1 `Features/Dashboard/Shared/KpiPeriodo.cs`: `TryParse` (`yyyy-MM`, `yyyy-Qn`, `yyyy`), `Start`/`End`/`Label`/`Tipo`, `Anterior()`, `MismoPeriodoAnioAnterior()`, `Meses`, `ActualLima()`
- [x] 1.2 `DashboardKpiCalculator`: funciones por rango `(start, end)` + sobrecargas mensuales por `string`; `CalcularKpis(KpiPeriodo, …)` con `ValorPeriodoAnterior` según la tabla de `design.md` D3; KPI-04 suma las horas de `Meses` y calcula `DatosIncompletos`
- [x] 1.3 `KpiResult.DatosIncompletos` (`bool?`, se omite si es null)
- [x] 1.4 `ObtenerKpisEndpoint`: default el mes actual en Lima; 400 `PERIODO_INVALIDO`; el handler recibe `KpiPeriodo`
- [x] 1.5 Summary: los llamadores de `CalcularKpis` pasan `KpiPeriodo` mensual; JCA `tendenciaMensualKpis` + KPI-02/07; DIR `TendenciaMensualKpis` (KPI-01/04/05); `JefeControlDocDashboardData` con `DocumentosRevisionVencida`/`DocumentosRevisionProxima`
- [x] 1.6 Tests: parseo y rangos de `KpiPeriodo`; KPIs con `2026-11`, `2026-Q4` y `2026` (rangos y anterior); 400 con período inválido; KPI-04 trimestral con un mes sin horas → `DatosIncompletos`; summary de JCD con los conteos; tendencias de DIR

## 2. Frontend — tipos, constantes, hooks y MSW

- [x] 2.1 `kpi.types.ts`: `KpiDireccion`, `KpiDefinition.direccion`, `KpiResult.datosIncompletos`, `valorPeriodoAnterior` nullable, `KpiPeriodoTipo`; `KPI_DEFINITIONS` con `direccion`
- [x] 2.2 `dashboardData.types.ts`: `tendenciaMensualKpis` del JCA ampliado, del DIR nuevo, y `JefeControlDocDashboardData` con conteos
- [x] 2.3 `usePeriodoKpi` (URL + período en Lima + rango) y `useDashboardKpis` con `keepPreviousData`
- [x] 2.4 `kpiRing.utils.ts`: `calcularAvanceKpi`, `calcularVariacionKpi`, `formatValorKpi` (compartido con `KpiGridWidget`/`KpisEjecutivosWidget`) y `sparklinePoints`
- [x] 2.5 MSW `dashboard.handlers.ts`: los 3 formatos de período, `valorPeriodoAnterior`, `datosIncompletos`, 400, tendencias del JCA y del DIR, y conteos de JCD; actualizar `dashboard.handlers.test.ts`

## 3. Frontend — componentes de layout

- [x] 3.1 `components/layout/DashboardLayout.tsx` (+ test: zonas vacías, columna principal a todo el ancho, orden)
- [x] 3.2 `components/layout/AlertaCard.tsx` (+ test: valor 0 neutro con "Todo en orden", color del nivel, `Link` vs. ancla `#`, `aria-label`)
- [x] 3.3 `components/layout/KpiRingCard.tsx` (+ test: avance ≥/≤/0/clamp/reducción, color por semáforo, variación y su color, sin anterior, sin tendencia, `aria-label`, datos incompletos)
- [x] 3.4 `components/layout/PeriodoSelector.tsx` (+ test: cambia `?periodo=` y la queryKey de KPIs; `aria-pressed` desde la URL)
- [x] 3.5 `KpiGridWidget` → grilla de `KpiRingCard` con `kpiIds` y `tendencias`, sin section/h2; `KpisEjecutivosWidget` → 2 tarjetas de conteo + 3 anillos; actualizar sus tests
- [x] 3.6 i18n `dashboard` (es-PE y en-US): `layout.*`, `kpi.meta`, `kpi.datosIncompletos`, `kpi.semaforo.*`, `alertas.<rol>.*`

## 4. Frontend — dashboards por rol

- [x] 4.1 `JefeCalidadDashboard` (4 alertas, 6 anillos + período, trabajo, mapa) + test
- [x] 4.2 `AltaDireccionDashboard` (3 alertas, KpisEjecutivos + período, trabajo, mapa) + test
- [x] 4.3 `SupervisorDashboard` (3 alertas, trabajo) + test
- [x] 4.4 `AuditorDashboard` (2 alertas, trabajo) + test
- [x] 4.5 `OperarioDashboard` (2 alertas, trabajo con notificaciones en la columna lateral) + test
- [x] 4.6 `JefeControlDocumentarioDashboard` (2 alertas, AccionesRequeridas a todo el ancho) + test
- [x] 4.7 Quitar márgenes externos sobrantes de los widgets reubicados, si los hay (sin tocar su lógica)

## 5. Verificación

- [x] 5.1 Suite completa de frontend (`npm test`) y de backend (`dotnet test`)
  - Frontend: 1883 OK; los fallos restantes son ajenos (`documentReplaceOriginal.test`, falla también con HEAD). Dashboard: 46 archivos / 275 tests OK.
  - Backend: Dashboard + KpiPeriodo 90/90 OK. La suite completa se colgó en los tests de LibreOffice/PDF de Documentos (preexistentes, ajenos).
- [x] 5.2 `tsc --noEmit` y `npm run lint` con cero errores
  - Cero errores en los archivos del cambio. En el repo quedan errores preexistentes ajenos: `tsc` en `documents.*` y 56 de lint en otros módulos.
- [ ] 5.3 Prueba manual con MSW apagado (pasos 1 a 6 de la instrucción, comparando con `SHAC-Dashboard-Combinado.html`), a cargo de Toño
