# INSTRUCCIONES PARA CLAUDE CODE — Dashboard: layout común de 4 zonas (alertas, indicadores en anillo, trabajo y mapa)

- **Fecha:** 2026-11-06
- **Autor:** Cowork (para Toño)
- **Origen:** Toño observó que el dashboard muestra la información clave, pero apila todo en vertical y no aprovecha el espacio. Pidió más impacto visual.
- **Referencia visual aprobada:** `Claude outputs\SHAC-Dashboard-Combinado.html`. Es una maqueta estática con datos de ejemplo; la decisión fue la mezcla de B y A, con los anillos de la opción C. Las alternativas descartadas están en `Claude outputs\SHAC-Dashboard-Alternativas.html`.
- **Change OpenSpec:** `dashboard-layout-4-zonas`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Dependencia:** se aplica **después** de `pendientes-qe-asignacion-y-menus`, porque usa los tipos de pendientes nuevos.
- **Sin migración.**

---

## 1. Diagnóstico confirmado leyendo el código

- `features/dashboard/pages/JefeCalidadDashboard.tsx` apila todos los widgets en un `<div className="space-y-8">`:
  - `AccionesRequeridas`
  - `KpiGrid`
  - `QEPorEstado`
  - `ACsPorVencer`
  - `IncidentesSinQeVencidos`
  - `TendenciaMensual`
  - `Heatmap`
- `KpiGridWidget.tsx:45` usa como máximo 3 columnas (`lg:grid-cols-3`). Cada KPI es una tarjeta con borde de semáforo, sin tendencia.
- Los demás dashboards siguen el mismo patrón vertical, cada uno con sus widgets:

  | Dashboard | Widgets actuales |
  |---|---|
  | Operario | AccionesRequeridas, MisACs, MisQEs |
  | Supervisor | AccionesRequeridas, ACsVencidas, IncidentesRecientes, PanelPendientesArea, QEPorTipo |
  | Jefe Control Documentario | solo AccionesRequeridas |
  | Auditor | AccionesRequeridas, EvidenciasHallazgos, HallazgosPorEstado, HallazgosPorNorma, TasaCierrePorArea |
  | Alta Dirección | AccionesRequeridas, ACsExtensionPlazo, ComparativaMensual, Heatmap, KpisEjecutivos, QEsCriticos, Reaperturas |

- **KPIs en el backend:**
  - `GET /api/dashboard/kpis?periodo=yyyy-MM` (`ObtenerKpisEndpoint.cs:36`) solo acepta **meses**;
  - `KpiResult` ya trae `Valor`, `Meta`, `MetaTipo`, `Semaforo`, `ValorPeriodoAnterior` y `Distribucion`;
  - el summary del JCA ya trae `TendenciaMensualKpis` (un diccionario por KPI), que sirve para los minigráficos.

---

## 2. Decisiones de Toño

- **D1:** el layout es la maqueta combinada, en 4 zonas y en este orden:
  1. **Requiere atención:** de 2 a 4 tarjetas de alerta grandes, con color de semáforo y número grande; cada una enlaza a su lista filtrada. Si el valor es 0, la tarjeta se ve en gris con "Todo en orden".
  2. **Indicadores:** los KPIs como **anillos** de avance contra la meta. Cada uno muestra el valor en el centro, el nombre, la meta, la variación respecto del período anterior (▲▼, en verde o rojo según el sentido de la meta) y un **minigráfico** de tendencia.
  3. **Mi trabajo y contexto:** dos columnas. La ancha (2/3) lleva "Mis acciones requeridas" y un gráfico; la angosta (1/3) lleva listas y distribuciones cortas.
  4. **Dónde ocurre:** el mapa de calor, a todo el ancho, solo en los roles que lo tienen.
- **D2:** el layout se aplica a **todos** los dashboards. Cada rol llena las zonas con sus propios widgets, y una zona sin contenido para un rol no se renderiza.
- **D3:** los indicadores tienen un **filtro de período**: Mes, Trimestre o Año. No hay filtro por área.

---

## 3. Qué implementar

### 3.1 Componentes base (`features/dashboard/components/layout/`)

- **`DashboardLayout`:** recibe `alertas?`, `indicadores?`, `trabajoPrincipal?`, `trabajoLateral?` y `mapa?` como `ReactNode`. Renderiza solo las zonas que tienen contenido, cada una con un label pequeño en mayúsculas (`text-[11px] uppercase tracking-wide text-muted`):
  - "Requiere atención"
  - "Indicadores", con el selector de período a la derecha
  - "Mi trabajo y contexto"
  - "Dónde ocurre"

  **Grilla:**
  - zona de trabajo: `grid-cols-1 lg:grid-cols-3`, con la principal en `lg:col-span-2` y la lateral en `lg:col-span-1`; si falta una de las dos, la otra ocupa todo el ancho;
  - alertas: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`;
  - indicadores: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`.

  **Separación:** `gap-3` entre tarjetas y `mt-6` entre zonas. Ya no usar `space-y-8`.
- **`AlertaCard`:** recibe `{ valor: number, titulo, subtitulo?, nivel: 'error' | 'warning' | 'info', to: string }`.
  - Es un `<Link>` con fondo suave del color del nivel (los tokens `error`, `amber` y `blue` que ya existen, en /10–/15), el número a `text-3xl font-bold` y el título debajo.
  - Con `valor === 0`, se muestra en estilo neutro (`bg-surface-soft text-muted`) con el subtítulo "Todo en orden" (i18n), y sigue enlazando.
  - Tiene foco visible y `aria-label` con el número y el título.
- **`KpiRingCard`:** recibe un `KpiResult` más `definicion` (nombre y formato desde las definiciones que ya usa `KpiGridWidget`) y `tendencia?: number[]`.
  - **Anillo** en SVG de 84 px: `circle` de fondo `stroke-hairline` y otro de progreso con `stroke-dasharray`, que arranca a las 12 (`rotate(-90)`) y tiene `stroke-linecap="round"`. El color sale del `semaforo` (VERDE → success, AMARILLO → amber, ROJO → error). El valor formateado va en el centro.
  - **Porcentaje de avance:** para metas de tipo "mayor o igual", `valor / meta`; para "menor o igual" (tiempos, reaperturas, AC vencidas), `meta / valor`. En los dos casos se limita a [0, 1], y si el valor es 0 en una meta "menor o igual", cuenta como 1. Usar `MetaTipo` del backend y documentar en `design.md` cómo se interpreta cada KPI.
  - **A la derecha del anillo:** el nombre, la meta ("meta ≥ 90 %"), la variación contra `valorPeriodoAnterior` (▲/▼ con la diferencia; verde si mejora según el sentido de la meta, rojo si empeora; se oculta si no hay valor anterior) y el minigráfico (SVG `polyline` de 100×28) cuando llega `tendencia`.
  - **Accesibilidad:** `role="img"` con `aria-label` "Cierre en plazo: 87 %, meta 90 %, en alerta". No depender solo del color: la variación lleva la flecha y el texto.
  - **Reemplaza** a la tarjeta actual de `KpiGridWidget` (que pasa a ser una grilla de `KpiRingCard`) y se reutiliza en `KpisEjecutivosWidget` (Alta Dirección).
- **`PeriodoSelector`:** control segmentado Mes / Trimestre / Año. El valor se guarda en la URL (`?periodo=mes|trimestre|anio`), para que sobreviva a F5. Por defecto, mes.
- **Widgets existentes:** los que se reubican en las zonas mantienen su lógica. Solo se ajusta el contenedor: quitar el `section` con su `h2` grande si el layout ya pone el label, y quitar los márgenes externos. **No duplicar** la lógica de datos.

### 3.2 Período en los KPIs (D3)

- **Backend, `GET /api/dashboard/kpis`:** aceptar `periodo` como `yyyy-MM` (lo actual), `yyyy-Qn` (trimestre) o `yyyy` (año). Por defecto, el mes actual en hora de Lima.
  - `DashboardKpiCalculator.CalcularKpis` calcula sobre el rango `[inicio, fin)` del período.
  - `ValorPeriodoAnterior` se calcula sobre el período **equivalente anterior**: el mes, trimestre o año previo.
  - **KPI-04**, el índice de frecuencia, depende de `HorasTrabajadas`, que se cargan por mes: para un trimestre o un año, sumar las horas de los meses que lo componen. Si falta algún mes, devolver el valor con un indicador `datosIncompletos: true` y mostrar "datos incompletos" en la tarjeta.
  - Un formato inválido devuelve 400.
  - Revisar si el summary (`ObtenerSummary`) también calcula KPIs con el mes fijo. Si lo hace, aceptar el mismo parámetro o hacer que el frontend tome los KPIs del endpoint de KPIs. Elegir la opción más simple y anotarla en `design.md`.
- **Frontend:**
  - `PeriodoSelector` arma el `periodo`: el mes actual (`2026-11`), el trimestre actual (`2026-Q4`) o el año actual (`2026`);
  - el hook de KPIs incluye el período en la queryKey.
  - La **tendencia** de los minigráficos sigue siendo **mensual, de los últimos 6 meses**, con cualquier período. Viene de `tendenciaMensualKpis`; si un rol no la recibe, la tarjeta se muestra sin minigráfico.

### 3.3 Contenido por rol (D2)

Cada página `*Dashboard.tsx` pasa a usar `DashboardLayout`. Las **alertas** se calculan con datos que **ya** llegan: del summary del rol o de `useAccionesRequeridas`. Si alguna necesita un dato que hoy no llega, agregar al summary del rol un conteo simple y anotarlo en `design.md`. Los enlaces van a la lista correspondiente con su filtro. Si una lista no soporta ese filtro por query param, enlazar a la lista sin filtro y dejarlo anotado.

| Rol | 1 · Alertas | 2 · Indicadores | 3a · Trabajo (ancha) | 3b · Contexto (angosta) | 4 · Mapa |
|---|---|---|---|---|---|
| **Jefe de Calidad** | AC vencidas (error) · Incidentes sin QE vencidos (error) · Esperan mi firma o aprobación, es decir, pendientes `QE_APROBAR_CAUSA_RAIZ` + `QE_CERRAR` (warning) · QE críticos activos (info) | KPIs del summary en anillos + período | AccionesRequeridas · TendenciaMensual | QEPorEstado · ACsPorVencer · IncidentesSinQeVencidos | Heatmap |
| **Alta Dirección** | QE críticos activos (error) · Reaperturas del período (warning) · Extensiones de plazo por aprobar (warning) | KpisEjecutivos en anillos + período | AccionesRequeridas · ComparativaMensual | QEsCriticos · Reaperturas · ACsExtensionPlazo | Heatmap |
| **Supervisor** | AC vencidas de mi área (error) · Esperan mi firma de cierre, es decir, `QE_FIRMAR_CIERRE` (warning) · Incidentes recientes de mi área, últimos 7 días (info) | — (sin KPIs hoy; la zona no se muestra) | AccionesRequeridas · PanelPendientesArea | ACsVencidas · IncidentesRecientes · QEPorTipo | — |
| **Auditor** | Verificaciones asignadas pendientes (warning) · Hallazgos abiertos (info) | TasaCierrePorArea, si cabe como indicador; si no, va al contexto | AccionesRequeridas · HallazgosPorEstado | HallazgosPorNorma · EvidenciasHallazgos · TasaCierrePorArea | — |
| **Operario** | Mis AC vencidas (error) · Mis AC por vencer en 5 días (warning) | — | AccionesRequeridas · MisACs | MisQEs | — |
| **Jefe Control Documentario** | Documentos con revisión vencida (error) · Revisión en 30 días o menos (warning) · Copias controladas por recoger (warning). Esto requiere conteos: usar `ResumenModuloDocumentos` (`Total`, `Publicados`, `VencidosRevision`) si ya llega, y agregar lo que falte | — | AccionesRequeridas | — (si no hay más widgets, AccionesRequeridas ocupa todo el ancho) | — |

- Los nombres exactos de los campos del summary de cada rol están en `DashboardSummaryDtos.cs`. Usar los reales.

### 3.4 i18n (`dashboard`, es-PE y en-US)

| Clave | es-PE | en-US |
|---|---|---|
| `layout.zonas.alertas` | Requiere atención | Needs attention |
| `layout.zonas.indicadores` | Indicadores | Indicators |
| `layout.zonas.trabajo` | Mi trabajo y contexto | My work and context |
| `layout.zonas.mapa` | Dónde ocurre | Where it happens |
| `layout.todoEnOrden` | Todo en orden | All clear |
| `layout.periodo.mes` | Mes | Month |
| `layout.periodo.trimestre` | Trimestre | Quarter |
| `layout.periodo.anio` | Año | Year |
| `kpi.meta` | meta {{op}} {{valor}} | target {{op}} {{valor}} |
| `kpi.datosIncompletos` | Datos incompletos | Incomplete data |

Agregar también los títulos de cada alerta por rol (`alertas.*`).

### 3.5 MSW

- `GET /api/dashboard/kpis` acepta los tres formatos de `periodo` y devuelve un `valorPeriodoAnterior` de ejemplo.
- Los fixtures del summary incluyen los conteos nuevos que se agreguen y `tendenciaMensualKpis` para el JCA y la DIR.

---

## 4. Tests

**Backend**
- KPIs con `periodo=2026-11`, `2026-Q4` y `2026`: rangos correctos y `ValorPeriodoAnterior` del período equivalente.
- Un período inválido devuelve 400.
- KPI-04 con un mes sin horas en un trimestre: `datosIncompletos = true`.

**Frontend**
- `DashboardLayout`: no renderiza las zonas vacías, y si falta la columna lateral, la principal ocupa todo el ancho.
- `KpiRingCard`:
  - el porcentaje se calcula bien para metas ≥ y ≤ (incluido el caso valor = 0 con meta ≤);
  - el color sale del semáforo;
  - la flecha y el color de la variación siguen el sentido de la meta;
  - sin `valorPeriodoAnterior` no se muestra la variación;
  - sin tendencia no se muestra el minigráfico;
  - el `aria-label` es completo.
- `AlertaCard`: con valor 0 se ve neutra y con "Todo en orden"; con valor mayor a 0 usa el color del nivel; el enlace es correcto.
- `PeriodoSelector`: cambia `?periodo=` y la queryKey de KPIs.
- Cada `*Dashboard.test.tsx` existente se actualiza: renderiza las zonas que le corresponden según la tabla de §3.3.

---

## 5. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend) + `tsc --noEmit` + **`npm run lint` con cero errores**.
- Antes de la prueba manual: **detener el backend → `dotnet build`** (sin migración) → `dotnet run` → Ctrl+F5.
- **Prueba manual con MSW apagado**, comparando con `SHAC-Dashboard-Combinado.html`:
  1. Como JCA a 1280 px: las alertas, los 6 anillos y la zona de trabajo se ven **sin hacer scroll** o casi. El mapa queda abajo. Hacer clic en cada alerta lleva a su lista.
  2. Cambiar el período a Trimestre y luego a Año: los anillos se recalculan y la URL guarda el período. Con F5, se mantiene.
  3. Revisar los otros 5 roles: cada uno muestra solo sus zonas y no aparecen zonas vacías.
  4. A 375 px de ancho, todo queda en una columna, sin scroll horizontal.
  5. En modo oscuro: los anillos, las alertas y los minigráficos se ven bien.
  6. Una alerta en 0 se ve gris, con "Todo en orden".
- Toño avisa con **"listo"** para que Cowork verifique.
