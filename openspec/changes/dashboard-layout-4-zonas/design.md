## Context

- Instrucción de origen: `Claude outputs/INSTRUCCIONES-CLAUDE-CODE-dashboard-layout-4-zonas-2026-11-06.md`. Maqueta aprobada: `Claude outputs/SHAC-Dashboard-Combinado.html`.
- Hoy los 6 dashboards de rol (`features/dashboard/pages/*Dashboard.tsx`) apilan sus widgets en `space-y-8`, con `AccionesRequeridasWidget` arriba y fuera del bloque de carga del summary.
- `KpiGridWidget` (JCA) y `KpisEjecutivosWidget` (DIR) muestran los KPIs del **summary**, que el backend calcula siempre con `CurrentPeriodo()` (mes UTC). `GET /api/dashboard/kpis` ya existe, pero hoy solo acepta `yyyy-MM`, y ninguna página lo usa.
- `KpiResult` del backend trae `Valor`, `Meta`, `MetaTipo` (`ABSOLUTO | REDUCCION_INTERANUAL`), `Semaforo`, `ValorPeriodoAnterior` y `Distribucion`. La **dirección** de la meta (mayor o menor es mejor) no viaja: vive en `DashboardKpiConstants.Definiciones` (`KpiDireccion`), solo en el servidor. Hoy `ValorPeriodoAnterior` solo se llena para KPI-04, con el valor de **un año antes** cargado a mano (`Kpi04ValorAnioAnterior`).
- El summary del JCA trae `tendenciaMensualKpis` (12 meses) solo para KPI-01, KPI-04 y KPI-05. El de DIR no la trae.
- El summary de JEFE_CONTROL_DOC es `{}`.

## Goals / Non-Goals

**Goals:**
- Un solo layout de 4 zonas reutilizado por los 6 dashboards, sin zonas vacías.
- KPIs en anillo contra la meta, con variación y minigráfico, y un filtro de período (Mes / Trimestre / Año) que sobrevive a F5.
- Alertas de 2 a 4 tarjetas por rol, calculadas con datos que ya llegan al cliente.

**Non-Goals:**
- Filtro por área (D3 lo descarta).
- Cambiar la lógica de datos de los widgets reubicados.
- Indicadores para Supervisor, Operario ni JCD (hoy no tienen KPIs en pantalla).
- Cambiar el período del summary (sigue en el mes actual).

## Decisions

### D1. KPIs del endpoint `/kpis`, no del summary
JCA y DIR toman los indicadores de `useDashboardKpis(periodo)`; el resto del summary queda igual (mes actual). Es la opción más simple que la instrucción permite: no hay que agregar `periodo` al summary ni invalidar el summary entero al cambiar de período. `ExportButton` sigue exportando los KPIs del summary (mes actual), sin cambios.
- *Alternativa descartada:* `?periodo=` en el summary. Obligaría a recalcular y volver a enviar todo el payload del rol solo para cambiar los anillos.

### D2. Formato y rango del período (backend)
Un `KpiPeriodo` (nuevo, `Features/Dashboard/Shared/KpiPeriodo.cs`) parsea `yyyy-MM` → MES, `yyyy-Qn` (n entre 1 y 4) → TRIMESTRE y `yyyy` → ANIO, con un `TryParse` estricto (regex anclada y mes entre 01 y 12). Expone `Start`/`End` (`[inicio, fin)` en UTC), `Label` normalizado, `Anterior()` (el período equivalente previo), `MismoPeriodoAnioAnterior()` y `Meses` (los `yyyy-MM` que lo componen).
- Sin `periodo`, se usa el mes actual en `America/Lima`, el mismo `TimeZoneInfo` que ya usan `Documentos`.
- Un formato inválido responde **400** con `ApiResponse` de error (`errorCode: "PERIODO_INVALIDO"`).
- El summary sigue usando `CurrentPeriodo()` (UTC). No se toca, para no cambiar los resultados del summary en las 5 horas de diferencia de fin de mes (queda en Open Questions).

### D3. `DashboardKpiCalculator` por rango
Las funciones `CalcularKpiNN` reciben `(start, end)`. Se conservan sobrecargas por `string periodo` (mensual), que delegan en ellas, para el builder del summary (tendencias, comparativa). `CalcularKpis(KpiPeriodo, …)` reemplaza la firma con `string`; los llamadores del summary pasan `KpiPeriodo.Mes(CurrentPeriodo())`.

| KPI | Período del valor | `ValorPeriodoAnterior` |
|---|---|---|
| KPI-01, 02, 05, 07 | el rango pedido | el mismo cálculo sobre `Anterior()` |
| KPI-03 | MES → el trimestre que lo contiene (se mantiene el comportamiento actual, `Periodo = yyyy-Qn`); TRIMESTRE → ese trimestre; ANIO → el año | el trimestre (o año) anterior |
| KPI-04 | el rango pedido: incidentes con lesionados del rango × 10⁶ ÷ la suma de `HorasTrabajadas` de `Meses` | **Divergencia:** se mantiene la semántica **interanual** (meta `REDUCCION_INTERANUAL`, y el semáforo depende de este valor). MES → el valor manual `Kpi04ValorAnioAnterior` del mes, como hoy. TRIMESTRE o ANIO → se calcula sobre `MismoPeriodoAnioAnterior()` con incidentes y horas reales, y es `null` si faltan horas de algún mes de ese período |
| KPI-06 | foto actual (no depende del período) | `null`: no hay historial |
| KPI-08 | tiempo real (`Periodo = "TIEMPO_REAL"`) | `null` |
| KPI-09 | el rango pedido | `null` (es informativo) |

- **`DatosIncompletos` (KPI-04):** es `true` cuando algún mes de `Meses` no tiene fila en `HorasTrabajadas`, también en el período MES (un mes sin horas hoy devuelve 0 en silencio). El valor se calcula igual, con las horas que hay. Para los demás KPI el campo es `null` y no se serializa (`JsonIgnoreCondition.WhenWritingNull`, si ya está configurado global; si no, `[JsonIgnore(Condition = WhenWritingNull)]` en la propiedad).

### D4. Dirección de la meta en el frontend
`KpiDefinition` suma `direccion: 'MAYOR_MEJOR' | 'MENOR_MEJOR' | null`, espejo de `DashboardKpiConstants.Definiciones`: 01, 05 y 06 → MAYOR; 02, 03, 07 y 08 → MENOR; KPI-04 → MENOR (menos incidentes es mejor; su meta se interpreta aparte, por `metaTipo`); KPI-09 → `null`. No se envía `direccion` por la API: es una constante de la definición, igual que `unidad` y `nombre`, que ya viven en `KPI_DEFINITIONS`.

### D5. Avance del anillo (`calcularAvanceKpi`, puro, en `features/dashboard/utils/kpiRing.utils.ts`)
| Caso | Avance |
|---|---|
| `metaTipo ABSOLUTO`, MAYOR_MEJOR (KPI-01 cierre en plazo, 05 eficacia de AC, 06 documentos vigentes) | `valor / meta` |
| `metaTipo ABSOLUTO`, MENOR_MEJOR (KPI-02 tiempo de cierre, 03 reaperturas, 07 investigación, 08 AC vencidas) | `meta / valor`; si `valor === 0`, cuenta como 1 |
| `REDUCCION_INTERANUAL` (KPI-04) | `reducción / meta`, con `reducción = (anterior − valor) / anterior × 100`; sin `valorPeriodoAnterior` (o con 0), el avance es 0 |
| `semaforo INFORMATIVO` o `direccion null` (KPI-09) | no se dibuja anillo: la tarjeta muestra la distribución (top 3), como hoy |

El resultado se limita siempre a [0, 1]. El color del arco sale del `semaforo` (VERDE → `success`, AMARILLO → `amber`, ROJO → `error`), no del avance: el semáforo del backend usa una banda de ±20 % que no coincide 1:1 con el porcentaje del arco. `MetaTipo` del backend distingue ABSOLUTO de REDUCCION_INTERANUAL; la dirección dentro de ABSOLUTO sale de D4.

**Variación:** `diff = valor − valorPeriodoAnterior`. Es mejora si `diff > 0` con MAYOR_MEJOR, o si `diff < 0` con MENOR_MEJOR (KPI-04 incluido). ▲ si `diff > 0`, ▼ si `diff < 0`; verde si mejora y rojo si empeora; con `diff === 0`, "=" en gris. Se oculta si `valorPeriodoAnterior` es `undefined`/`null`. La diferencia se formatea en la unidad del KPI: puntos (`pts`) para PORCENTAJE, `d` para DIAS, entero para CONTEO y 2 decimales para TASA. En KPI-04, la variación es contra el mismo período del año anterior (D3).

**Minigráfico:** `polyline` en un `viewBox` de 100×28, normalizado al min/max de la serie (una serie plana se dibuja en la mitad de la altura). Se muestra si llegan 2 puntos o más. La serie es mensual, de los últimos 6 meses (`slice(-6)` de `tendenciaMensualKpis[kpiId]`), con cualquier período.

### D6. `tendenciaMensualKpis`: alcance
- **JCA:** se agregan KPI-02 y KPI-07 (los dos son mensuales y ya tienen su cálculo por mes). KPI-03 (trimestral) y KPI-06 (foto) siguen sin serie, y su tarjeta se ve sin minigráfico. El tipo pasa a `Record<'KPI-01'|'KPI-04'|'KPI-05', …> & Partial<Record<'KPI-02'|'KPI-07', …>>`, así que `TendenciaMensualWidget` no cambia.
- **DIR:** se agrega `tendenciaMensualKpis` con KPI-01, KPI-04 y KPI-05 (12 meses, la misma construcción que en el JCA).

### D7. Qué KPIs muestra cada rol
- **JCA:** los 6 anillos de la maqueta: KPI-01, 02, 03, 05, 07 y 06, en ese orden. **Divergencia:** KPI-08 pasa a la alerta "AC vencidas" y ya no es tarjeta. KPI-04 se sigue viendo en `TendenciaMensualWidget` (su serie) y en el dashboard de DIR. KPI-09 deja de mostrarse en el JCA (la maqueta no lo incluye; el mapa de la zona 4 es de incidentes, no de QE por área). Queda en Open Questions.
- **DIR:** `KpisEjecutivosWidget` = 2 tarjetas de conteo ("QE abiertos" y "QE vencidos", sin meta y sin anillo) + 3 anillos (KPI-01, 04 y 05), en la misma grilla. Son 5 elementos, como hoy.
- **Auditor:** `TasaCierrePorAreaWidget` es una lista por área, no un indicador único con meta, así que va al contexto (zona 3b). El Auditor no tiene zona de indicadores.

### D8. Período en la URL (`usePeriodoKpi`)
Es un hook en `features/dashboard/hooks/usePeriodoKpi.ts`: lee `?periodo=mes|trimestre|anio` con `useSearchParams`; cualquier otro valor, o la ausencia, equivale a `mes`. Devuelve `{ tipo, setTipo, periodo }`, donde `periodo` es el string de la API calculado con la fecha actual en `America/Lima` (`Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year, month })`): `2026-11`, `2026-Q4` o `2026`. `setTipo` usa `setSearchParams(…, { replace: true })` y conserva los demás parámetros. `useDashboardKpis(periodo)` ya incluye `periodo` en la queryKey (`['dashboard','kpis',periodo]`).

### D9. Alertas por rol y enlaces
Las alertas se calculan en el cliente, en un `useMemo` de cada página, con datos que ya llegan. `AlertaCard` acepta un `to` que empieza con `#` y entonces renderiza `<a href="#…">` (el ancla nativa hace scroll; `<Link>` de React Router no hace scroll a un hash). Cada página pone `id` al contenedor del widget de destino; los widgets no cambian. Reglas de enlace:
1. la lista con su filtro, si la lista lo soporta por query param;
2. si no lo soporta y el widget que lista esos ítems está en la misma página, el ancla al widget;
3. si no, la lista sin filtro.

No existe una lista de AC (las AC viven dentro de QE, NC e incidentes), así que toda alerta de AC usa la regla 2.

| Rol | Alerta (nivel) | Valor | Enlace |
|---|---|---|---|
| JCA | AC vencidas (error) | `kpis` del summary → KPI-08 `valor` (empresa, QE + NC + incidentes, tiempo real) | `#acs-por-vencer` |
| JCA | Incidentes sin QE vencidos (error) | `incidentesSinQeVencidosTotal` | `#incidentes-sin-qe` |
| JCA | Esperan mi firma o aprobación (warning) | ítems de `useAccionesRequeridas` con `tipo ∈ {QE_APROBAR_CAUSA_RAIZ, QE_CERRAR}` | `#acciones-requeridas` |
| JCA | QE críticos activos (info) | `qeCriticosAbiertos.length` | `/quality-events?severidad=CRITICA` |
| DIR | QE críticos activos (error) | `alertasCriticas.length` | `/quality-events?severidad=CRITICA` |
| DIR | Reaperturas del período (warning) | `reaperturas` con `fechaReapertura` dentro del rango del período elegido | `/quality-events?soloReincidencias=true` |
| DIR | Extensiones de plazo por aprobar (warning) | `acsConSolicitudAjustePlazo.length` | `#acs-extension-plazo` |
| Supervisor | AC vencidas de mi área (error) | `accionesCorrectivasVencidas.length` | `#acs-vencidas` |
| Supervisor | Esperan mi firma de cierre (warning) | ítems `QE_FIRMAR_CIERRE` | `#acciones-requeridas` |
| Supervisor | Incidentes recientes, 7 días (info) | `incidentesRecientes` con `fechaEvento` en los últimos 7 días | `/incidents?fechaDesde=<hoy−7, yyyy-MM-dd>` |
| Auditor | Verificaciones asignadas pendientes (warning) | ítems `QE_VERIFICAR` (ya filtrados por `auditorAsignadoId`) | `#acciones-requeridas` |
| Auditor | Hallazgos abiertos (info) | suma de `hallazgosPorEstado` sin `CERRADO` ni `VERIFICADO` | `/quality-events?origen=O3_HALLAZGO_AUDITORIA` |
| Operario | Mis AC vencidas (error) | `accionesCorrectivasAsignadas` no terminales (`CERRADA`/`COMPLETADA`) con `plazoFecha < ahora` | `#mis-acs` |
| Operario | Mis AC por vencer en 5 días (warning) | no terminales con `plazoFecha` entre ahora y ahora + 5 días | `#mis-acs` |
| JCD | Documentos con revisión vencida (error) | `documentosRevisionVencida` (nuevo, del summary) | `/documentos?estado=PUBLICADO` |
| JCD | Revisión en 30 días o menos (warning) | `documentosRevisionProxima` (nuevo, del summary) | `/documentos?estado=PUBLICADO` |

Divergencias:
- **Copias controladas por recoger (JCD):** se omite. El sistema no modela la entrega ni el retiro de copias: la "copia controlada" es solo una descarga de PDF (`document-copia-controlada`), sin ningún estado "por recoger". Sería un concepto de producto nuevo, fuera de alcance.
- **Incidentes recientes (Supervisor):** `incidentesRecientes` llega limitado a 10, así que el conteo de 7 días también se topa en 10. Es aceptable para una alerta informativa; no se agrega un conteo nuevo.
- **QE críticos → `severidad=CRITICA`:** la lista no filtra por "estado activo" (el estado admite un solo valor), así que la lista enlazada puede incluir QE críticos ya cerrados. El número de la tarjeta sí cuenta solo los activos.
- **Documentos (JCD):** la lista de documentos no filtra por fecha de revisión, así que se enlaza a los publicados.

### D10. Summary de JEFE_CONTROL_DOC
`JefeControlDocDashboardData` pasa a ser `{ DocumentosRevisionVencida, DocumentosRevisionProxima }`, calculados sobre los documentos `PUBLICADO` no eliminados de la empresa activa: vencida si `FechaRevisionProxima < hoy`, con el mismo criterio que `ResumenModuloDocumentos.VencidosRevision`; próxima si `hoy ≤ FechaRevisionProxima ≤ hoy + 30 días` (RN-DOC-006, aviso por defecto de 30 días). No se aplica la confidencialidad: son conteos agregados, sin datos del documento, igual que `resumenPorModulo.documentos` de DIR.

### D11. Contenedor de los widgets reubicados
- `KpiGridWidget` pierde su `<section>` y su `h2`, porque la zona "Indicadores" ya pone el label; ahora es solo la grilla de tarjetas.
- Los widgets de las zonas 3 y 4 **conservan** su título propio (identifica cada bloque dentro de la zona), y se quitan solo los márgenes externos que traigan.
- Las páginas ya no envuelven `AccionesRequeridasWidget` en `mb-8`.
- Mientras carga el summary, cada zona que depende de él muestra el skeleton dentro de la zona. `AccionesRequeridasWidget` sigue fuera del bloque de carga del summary (su carga es independiente).
- La sección "Notificaciones pendientes" del Operario va a la columna lateral, debajo de `MisQEsWidget`, en lugar de quedar suelta al final de la página.

### D12. Notas de implementación (divergencias encontradas al aplicar)
- **Color "info":** no existe un token `blue` en `tailwind.config.ts`. `AlertaCard` usa la paleta azul de Tailwind (`bg-blue-500/10`, `text-blue-700` / `dark:text-blue-300`), igual que `QEStatusBadge` y `QETypeBadge`.
- **Separación dentro de la zona 3:** las tarjetas de las grillas usan `gap-3`, como pide la instrucción. Los widgets apilados en una columna (cada uno con su título) usan `space-y-6`, porque con 12 px el título queda pegado al widget de arriba.
- **Mapa (JCA y DIR):** se monta solo cuando el summary ya cargó y es del rol correcto. Así se conserva el comportamiento anterior: el heatmap no aparece ni hace fetch para otro rol ni durante la carga.
- **Cálculos de las alertas:** viven en `utils/alertasDashboard.utils.ts` como funciones puras que reciben `ahora`. La regla `react-hooks/purity` no permite `Date.now()` en el render, ni siquiera dentro de `useMemo`.
- **Skeletons:** se extrajeron a `components/layout/Skeletons.tsx`, en lugar de copiar `WidgetSkeleton` en cada página.
- **Helpers del anillo:** `KPI_IDS_JEFE_CALIDAD`, `ultimosValores` y `TendenciasKpi` viven en `utils/kpiRing.utils.ts`, no en `KpiGridWidget.tsx`, por la regla `react-refresh/only-export-components`.
- **`JefeCalidadDashboard.test`:** la AC "por vencer" del fixture vence en +2 días corridos. Un viernes eso cae en domingo (0 días hábiles), y `ACsPorVencerWidget` la muestra en el banner crítico ("… — Quality Event"). El test ahora busca el texto con un regex y deja de depender del día en que corre.

## Risks / Trade-offs

- [El JCA deja de ver KPI-09 y la tarjeta de KPI-04] → Se documenta como divergencia, alineada a la maqueta aprobada. Si Toño lo quiere de vuelta, el cambio es agregar el id a la lista de `KpiGridWidget` (Open Question 1).
- [Dos fuentes de KPIs en la misma página (summary para alertas y export; `/kpis` para los anillos)] → Solo KPI-08 (la alerta) sale del summary y es de tiempo real, así que coincide con cualquier período.
- [Anclas `#` y React Router] → Una navegación por hash no desmonta la página. Se cubre con un test de que el `href` es correcto; el scroll lo hace el navegador.
- [KPI-04 interanual para trimestre o año sin horas del año anterior] → `ValorPeriodoAnterior = null`, así que la variación se oculta y el semáforo queda en ROJO (es la regla actual de `CalcularSemaforoKpi04` sin valor anterior).

## Migration Plan

Sin migración de base de datos. Despliegue normal: backend y frontend juntos (el frontend envía `yyyy-Qn`/`yyyy`, que el backend viejo rechazaría con 500 al parsear). Rollback: revertir los dos.

## Open Questions

1. ¿El JCA debe volver a ver KPI-04 y KPI-09 como tarjetas, aunque la maqueta tenga 6? (Hoy: no.)
2. ¿El summary debería pasar de UTC a la hora de Lima para su "mes actual"? Fuera de alcance.
3. Copias controladas "por recoger": requiere definir el concepto de entrega física de copias.
