## Why

`JefeCalidadDashboardData.tendenciaMensualCierres` existe desde M5-S01 pero nunca tuvo un consumidor real — M5-S05a (dashboard de `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO`) documentó explícitamente su ausencia como diferida a esta spec. Sin un widget de tendencia, el Jefe de Calidad solo ve el estado puntual del mes actual (KPIs, QEs por estado, ACs por vencer) y no puede detectar si el desempeño mejora o empeora mes a mes, ni comparar volumen de apertura vs. cierre de Quality Events.

## What Changes

- Nuevo widget "Tendencia mensual" en `JefeCalidadDashboard`, con selector de rango (3/6/12 meses, default 6) que controla ambos gráficos:
  - **Volumen de QEs por mes**: `LineChart` (recharts) con dos series — QEs abiertos (por `fechaHoraReporte`) y QEs cerrados (por `fechaCierre`) — por mes.
  - **KPIs clave por mes**: `LineChart` con la evolución mensual de KPI-01 (Tasa de cierre en plazo), KPI-04 (Índice de frecuencia de incidentes) y KPI-05 (Tasa de eficacia de ACs), recalculando cada KPI para cada mes del rango reutilizando las funciones de cálculo ya existentes en `dashboard.handlers.ts` (`calcularKpi01`/`calcularKpi04`/`calcularKpi05`), no una fórmula nueva.
- **Nueva dependencia**: se instala `recharts` (primera vez en el proyecto) — se valida que la build/bundle no se rompe.
- `JefeCalidadDashboardData` gana la estructura de datos necesaria para poblar ambos gráficos (payload calculado server-side/MSW, no en el cliente).
- **Fix de seed data (bloqueante)**: los fixtures actuales no soportan un rango histórico de 12 meses con variación real:
  - `horasTrabajadasFixtures` solo cubre `2026-01`→`2026-06` (6 periodos) — no alcanza ni para el mes actual (`2026-07`) ni para un rango de 12 meses hacia atrás (`2025-08`→`2026-07`). Se extiende su cobertura.
  - Los QE del seed tienen `fechaHoraReporte`/`fechaCierre` concentrados de forma desigual (algunos meses sin ningún cierre, ej. la mayoría de 2025). Se agrega/redistribuye volumen para que KPI-01/04/05 mensuales no den `0` o el mismo valor en todos los meses del rango — mismo tipo de fix que M5-S01-fix-kpis-prd, aplicado ahora por cada mes del rango en lugar de solo el periodo actual.

## Capabilities

### New Capabilities
- `dashboard-trend-widget`: widget "Tendencia mensual" (2 gráficos de líneas con recharts + selector de rango 3/6/12 meses), montado dentro de `JefeCalidadDashboard` junto a los 3 widgets existentes (KPIs, QEs por estado, ACs por vencer).

### Modified Capabilities
- `dashboard-types`: `JefeCalidadDashboardData` agrega la estructura de tendencia mensual (volumen QE abiertos/cerrados + serie histórica de KPI-01/04/05 por mes), reemplazando el actual `tendenciaMensualCierres` (que solo tenía `cerrados`, sin `abiertos` ni KPIs) — campo sin consumidor real hasta ahora.
- `dashboard-msw-handlers`: `buildJefeCalidadData`/`GET /api/dashboard/summary` calculan la tendencia mensual reutilizando `calcularKpi01`/`calcularKpi04`/`calcularKpi05` por cada mes de un rango de hasta 12 meses (no solo el periodo actual).
- `dashboard-msw-fixtures`: `horasTrabajadasFixtures` extiende su cobertura de 6 a al menos 12 periodos mensuales consecutivos (incluyendo el mes actual), necesario para que KPI-04 histórico sea calculable en todo el rango.
- `quality-event-msw-fixtures`: fechas (`fechaHoraReporte`/`fechaCierre`) de los QE del seed se redistribuyen/amplían para dar variación mensual real a lo largo de 12 meses hacia atrás desde la fecha actual del sistema.

Nota: `JefeCalidadDashboard` (la página, spec `dashboard-jefecalidad-view` de M5-S05a) todavía no está sincronizada a `openspec/specs/` porque esa spec no ha sido archivada — el wiring del widget nuevo en la página se documenta como parte de `dashboard-trend-widget` en vez de una capability modificada inexistente en el árbol de specs principal.

## Impact

- **Código afectado**: `src/features/dashboard/types/dashboardData.types.ts`, `src/mocks/handlers/dashboard.handlers.ts`, `src/features/dashboard/pages/JefeCalidadDashboard.tsx`, nuevo componente de widget en `src/features/dashboard/components/`, `src/mocks/fixtures/horasTrabajadas.fixtures.ts`, `src/mocks/fixtures/quality-events.fixtures.ts`.
- **Dependencias**: se agrega `recharts` a `package.json` — primera librería de gráficos del proyecto; se verifica que no rompe el build existente (Vite) ni el bundle.
- **i18n**: nuevas claves en `es-PE.json`/`en-US.json` para el título del widget, labels de series y opciones del selector de rango.
- **Fuera de alcance**: no se agregan más KPIs a la tendencia además de KPI-01/04/05; no se implementa exportación del gráfico (diferido a S09/v1.1); el selector de rango no persiste preferencia entre sesiones.
