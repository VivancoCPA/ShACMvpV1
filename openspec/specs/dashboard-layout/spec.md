# dashboard-layout Specification

## Purpose
Layout común de 4 zonas de los dashboards de rol (Requiere atención, Indicadores, Mi trabajo y contexto, Dónde ocurre) y sus componentes base: `DashboardLayout`, `AlertaCard`, `KpiRingCard` y `PeriodoSelector`.

## Requirements

### Requirement: DashboardLayout renderiza 4 zonas en orden fijo y omite las vacías
El sistema SHALL exportar `DashboardLayout` en `src/features/dashboard/components/layout/DashboardLayout.tsx`, con props opcionales `alertas`, `indicadores`, `periodoSelector`, `trabajoPrincipal`, `trabajoLateral` y `mapa` (`ReactNode`). SHALL renderizar, en este orden y solo cuando la prop tiene contenido (no `null`/`undefined`/`false`):
1. zona "Requiere atención" (`alertas`), grilla `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3`;
2. zona "Indicadores" (`indicadores`), grilla `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3`, con `periodoSelector` alineado a la derecha del label;
3. zona "Mi trabajo y contexto" (`trabajoPrincipal`/`trabajoLateral`), grilla `grid-cols-1 lg:grid-cols-3 gap-3`: la principal en `lg:col-span-2` y la lateral en `lg:col-span-1`. Si falta una de las dos, la otra ocupa `lg:col-span-3`;
4. zona "Dónde ocurre" (`mapa`), a todo el ancho.

Cada zona SHALL ser una `<section>` con `aria-labelledby` apuntando a su label, que es un `<h2>` con `text-[11px] uppercase tracking-wide text-muted dark:text-on-dark-soft` y el texto `t('dashboard:layout.zonas.<zona>')`. Entre zonas, la separación SHALL ser `mt-6` (la primera zona renderizada no lleva margen superior). El layout no SHALL usar `space-y-8`.

#### Scenario: Zonas vacías no se renderizan
- **WHEN** `DashboardLayout` recibe solo `alertas` y `trabajoPrincipal`
- **THEN** se renderizan las secciones "Requiere atención" y "Mi trabajo y contexto", y no existen en el DOM las secciones "Indicadores" ni "Dónde ocurre"

#### Scenario: Sin columna lateral, la principal ocupa todo el ancho
- **WHEN** `DashboardLayout` recibe `trabajoPrincipal` y no recibe `trabajoLateral`
- **THEN** el contenedor de la columna principal tiene `lg:col-span-3`, no `lg:col-span-2`

#### Scenario: Orden de las zonas
- **WHEN** `DashboardLayout` recibe las 4 zonas
- **THEN** los labels aparecen en el DOM en el orden "Requiere atención", "Indicadores", "Mi trabajo y contexto", "Dónde ocurre"

### Requirement: AlertaCard es un enlace con número grande y color de nivel, neutro cuando vale 0
El sistema SHALL exportar `AlertaCard` en `src/features/dashboard/components/layout/AlertaCard.tsx` con props `{ valor: number; titulo: string; subtitulo?: string; nivel: 'error' | 'warning' | 'info'; to: string }`. SHALL renderizar un `<Link to={to}>` de React Router, salvo que `to` empiece con `#`, en cuyo caso SHALL renderizar `<a href={to}>` (ancla nativa al widget de la misma página). El número SHALL ir en `text-3xl font-bold` y el título debajo.
- Con `valor > 0`, el fondo SHALL ser el tono suave del nivel (`error` → `bg-error/10`, `warning` → `bg-amber/15`, `info` → el token azul existente al 10–15 %), con su variante `dark:`, y el número en el color del nivel. Se muestra `subtitulo` si viene.
- Con `valor === 0`, SHALL usar el estilo neutro `bg-surface-soft text-muted` (con variante `dark:`) y el subtítulo `t('dashboard:layout.todoEnOrden')`, ignorando `subtitulo`. Sigue siendo un enlace.

El enlace SHALL tener foco visible (`focus-visible:ring-2`) y `aria-label` con el número y el título (p.ej. "5 AC vencidas").

#### Scenario: Valor cero se ve neutro con "Todo en orden"
- **WHEN** `AlertaCard` recibe `valor: 0`, `nivel: 'error'`
- **THEN** la tarjeta usa `bg-surface-soft`, no `bg-error/10`, y muestra "Todo en orden"

#### Scenario: Valor mayor a cero usa el color del nivel
- **WHEN** `AlertaCard` recibe `valor: 5`, `nivel: 'error'`, `titulo: 'AC vencidas'`
- **THEN** la tarjeta usa `bg-error/10`, muestra `5` y su `aria-label` es "5 AC vencidas"

#### Scenario: Enlace a una lista
- **WHEN** `AlertaCard` recibe `to: '/quality-events?severidad=CRITICA'`
- **THEN** el elemento renderizado es un enlace con `href` `/quality-events?severidad=CRITICA`

#### Scenario: Enlace a un ancla de la misma página
- **WHEN** `AlertaCard` recibe `to: '#acciones-requeridas'`
- **THEN** se renderiza un `<a href="#acciones-requeridas">`

### Requirement: KpiRingCard muestra el avance contra la meta en un anillo
El sistema SHALL exportar `KpiRingCard` en `src/features/dashboard/components/layout/KpiRingCard.tsx` con props `{ kpi: KpiResult; definicion: KpiDefinition; tendencia?: number[] }`. Para todo KPI con `semaforo !== 'INFORMATIVO'` SHALL dibujar un anillo SVG de 84 px: un `circle` de fondo con `stroke-hairline` y un `circle` de progreso con `stroke-dasharray` proporcional al avance, que arranca a las 12 (`rotate(-90)`) y tiene `stroke-linecap="round"`. El color del progreso SHALL derivarse de `semaforo` (`VERDE` → `success`, `AMARILLO` → `amber`, `ROJO` → `error`). El valor formateado según `definicion.unidad` va en el centro del anillo.

El avance SHALL calcularse con la función pura `calcularAvanceKpi(kpi, definicion)` (`features/dashboard/utils/kpiRing.utils.ts`), limitada a [0, 1]:
- `metaTipo: 'ABSOLUTO'` con `direccion: 'MAYOR_MEJOR'`: `valor / meta`;
- `metaTipo: 'ABSOLUTO'` con `direccion: 'MENOR_MEJOR'`: `meta / valor`, y 1 si `valor === 0`;
- `metaTipo: 'REDUCCION_INTERANUAL'`: `((anterior − valor) / anterior × 100) / meta`, y 0 si `valorPeriodoAnterior` falta o es 0.

Un KPI con `semaforo: 'INFORMATIVO'` (KPI-09) SHALL mostrar, en lugar del anillo, la lista de las 3 primeras entradas de `distribucion`.

#### Scenario: Meta mayor o igual
- **WHEN** `calcularAvanceKpi` recibe KPI-01 con `valor: 87`, `meta: 90`
- **THEN** el resultado es `87 / 90`

#### Scenario: Meta menor o igual
- **WHEN** `calcularAvanceKpi` recibe KPI-02 con `valor: 20`, `meta: 15`
- **THEN** el resultado es `0.75`

#### Scenario: Valor cero con meta menor o igual
- **WHEN** `calcularAvanceKpi` recibe KPI-03 con `valor: 0`, `meta: 5`
- **THEN** el resultado es `1`

#### Scenario: Avance limitado a 1
- **WHEN** `calcularAvanceKpi` recibe KPI-01 con `valor: 100`, `meta: 90`
- **THEN** el resultado es `1`

#### Scenario: Reducción interanual sin valor anterior
- **WHEN** `calcularAvanceKpi` recibe KPI-04 sin `valorPeriodoAnterior`
- **THEN** el resultado es `0`

#### Scenario: Color del anillo según el semáforo
- **WHEN** `KpiRingCard` recibe un KPI con `semaforo: 'AMARILLO'`
- **THEN** el círculo de progreso usa la clase de trazo `amber`, no `success` ni `error`

### Requirement: KpiRingCard muestra nombre, meta, variación y minigráfico
A la derecha del anillo, `KpiRingCard` SHALL mostrar:
- el nombre (`definicion.nombre`);
- la meta, como `t('dashboard:kpi.meta', { op, valor })` con `op` `≥` para `MAYOR_MEJOR` y `≤` para `MENOR_MEJOR`; para `REDUCCION_INTERANUAL`, el texto de reducción interanual existente (`jefeCalidad.kpis.metaReduccionInteranual`);
- la variación contra `valorPeriodoAnterior`, con `diff = valor − valorPeriodoAnterior`: ▲ si `diff > 0`, ▼ si `diff < 0` y "=" si es 0, seguida de `|diff|` formateado en la unidad del KPI. El color es verde (`success`) si mejora según la dirección (sube con `MAYOR_MEJOR`, baja con `MENOR_MEJOR` o `REDUCCION_INTERANUAL`), rojo (`error`) si empeora y `muted` si `diff === 0`. La variación no SHALL renderizarse cuando `valorPeriodoAnterior` es `undefined` o `null`;
- un minigráfico SVG `polyline` de `viewBox="0 0 100 28"`, cuando `tendencia` trae 2 o más puntos; si no, no se renderiza;
- el texto `t('dashboard:kpi.datosIncompletos')` cuando `kpi.datosIncompletos === true`.

La tarjeta SHALL tener `role="img"` y un `aria-label` que incluya el nombre, el valor formateado, la meta y el estado del semáforo (p.ej. "Cierre en plazo: 87 %, meta ≥ 90 %, en alerta"). La variación no SHALL depender solo del color: siempre lleva la flecha o el "=" y el número.

#### Scenario: Mejora en un KPI de menor es mejor
- **WHEN** KPI-02 tiene `valor: 13` y `valorPeriodoAnterior: 15`
- **THEN** se muestra "▼ 2.0 d" en color `success`

#### Scenario: Empeora en un KPI de mayor es mejor
- **WHEN** KPI-01 tiene `valor: 87` y `valorPeriodoAnterior: 90`
- **THEN** se muestra "▼ 3.0 pts" en color `error`

#### Scenario: Sin valor anterior no se muestra la variación
- **WHEN** el KPI no trae `valorPeriodoAnterior`
- **THEN** no se renderiza ningún elemento de variación (ni flecha ni "=")

#### Scenario: Sin tendencia no se muestra el minigráfico
- **WHEN** `KpiRingCard` no recibe `tendencia`
- **THEN** no existe ningún `polyline` en la tarjeta

#### Scenario: aria-label completo
- **WHEN** KPI-01 tiene `valor: 87`, `meta: 90` y `semaforo: 'AMARILLO'`
- **THEN** el `aria-label` incluye el nombre del KPI, "87", "90" y el texto del estado AMARILLO

#### Scenario: Datos incompletos
- **WHEN** KPI-04 llega con `datosIncompletos: true`
- **THEN** la tarjeta muestra "Datos incompletos"

### Requirement: PeriodoSelector guarda Mes, Trimestre o Año en la URL
El sistema SHALL exportar `PeriodoSelector` (`components/layout/PeriodoSelector.tsx`) y el hook `usePeriodoKpi()` (`hooks/usePeriodoKpi.ts`). `usePeriodoKpi` SHALL leer `?periodo=` con `useSearchParams`: `mes`, `trimestre` o `anio`; cualquier otro valor, o la ausencia, equivale a `mes`. SHALL devolver `{ tipo, setTipo, periodo, rango }`, donde `periodo` es el string que espera la API, calculado con la fecha actual en `America/Lima`: `yyyy-MM` (mes), `yyyy-Qn` (trimestre) o `yyyy` (año); y `rango` es `{ desde, hasta }` (`[desde, hasta)`) de ese período. `setTipo` SHALL reemplazar solo el parámetro `periodo` de la URL (`replace: true`) y conservar los demás.

`PeriodoSelector` SHALL ser un control segmentado de 3 botones (`role="group"` con `aria-label`), con `aria-pressed` en el botón activo y textos `t('dashboard:layout.periodo.mes|trimestre|anio')`.

#### Scenario: Por defecto es el mes actual
- **WHEN** la URL no tiene `periodo` y la fecha en Lima es 2026-11-06
- **THEN** `usePeriodoKpi()` devuelve `tipo: 'mes'` y `periodo: '2026-11'`

#### Scenario: Trimestre y año
- **WHEN** la URL tiene `?periodo=trimestre` (o `?periodo=anio`) y la fecha en Lima es 2026-11-06
- **THEN** `periodo` es `'2026-Q4'` (o `'2026'`)

#### Scenario: Cambiar el período actualiza la URL y la queryKey de KPIs
- **WHEN** el usuario pulsa "Trimestre" en `PeriodoSelector`
- **THEN** la URL pasa a tener `periodo=trimestre`, y `useDashboardKpis` se consulta con la queryKey `['dashboard', 'kpis', '2026-Q4']`

#### Scenario: El período sobrevive a la recarga
- **WHEN** la página se monta con `?periodo=anio`
- **THEN** el botón "Año" tiene `aria-pressed="true"`
