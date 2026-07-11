## MODIFIED Requirements

### Requirement: JefeCalidadDashboard renderiza los 9 KPIs completos
El sistema SHALL implementar `JefeCalidadDashboard` en `src/features/dashboard/pages/JefeCalidadDashboard.tsx`, consumiendo `useDashboardSummary()` y renderizando, cuando `data.rol === 'JEFE_CALIDAD'`, un widget `KpiGridWidget` que muestra las 9 entradas de `data.data.kpis` (`KpiResult[]`). Cada tarjeta con `metaTipo: 'ABSOLUTO'` y `semaforo` distinto de `'INFORMATIVO'` SHALL mostrar: `kpiId`, el `nombre` correspondiente desde `KPI_DEFINITIONS`, el `valor` calculado formateado según `unidad` (`PORCENTAJE` con símbolo `%`, `DIAS` con sufijo de días, `TASA` como tasa por 1,000,000, `CONTEO` como entero), la `meta`, y un indicador visual de color derivado de `semaforo` (`VERDE`/`AMARILLO`/`ROJO`) mediante un borde izquierdo de 3px cuyo color SHALL renderizarse correctamente tanto en Light Mode como en Dark Mode (sin que un shorthand `border`/`dark:border-*` de mayor especificidad Tailwind pise el color del borde izquierdo). La tarjeta de `KPI-04` (`metaTipo: 'REDUCCION_INTERANUAL'`) SHALL mostrar su meta como texto ("Reducción ≥{{meta}}% anual"), nunca como `formatValor(meta, unidad)`. La tarjeta de `KPI-09` (`semaforo: 'INFORMATIVO'`) SHALL renderizar las primeras 3 entradas de `distribucion` como una lista rankeada de área+conteo en vez de un único número, con un borde izquierdo neutro (no semántico) y sin aplicar `VALOR_CLASSES` de color al texto.

#### Scenario: Las 9 tarjetas de KPI se renderizan
- **WHEN** `JefeCalidadDashboard` recibe `data.data.kpis` con 9 elementos
- **THEN** se renderizan exactamente 9 tarjetas, una por cada `KpiId`

#### Scenario: Valor de KPI en PORCENTAJE se formatea con símbolo
- **WHEN** un `KpiResult` tiene `unidad: 'PORCENTAJE'` (vía `KPI_DEFINITIONS[kpiId].unidad`) y `valor: 87.5`
- **THEN** la tarjeta muestra el valor con el símbolo `%`

#### Scenario: Semáforo ROJO se refleja visualmente
- **WHEN** un `KpiResult` tiene `semaforo: 'ROJO'`
- **THEN** la tarjeta correspondiente usa el color semántico de error (`error`/rojo), no el de éxito ni advertencia

#### Scenario: Borde izquierdo de color visible en Dark Mode
- **WHEN** el tema activo es `dark` y una tarjeta tiene `semaforo: 'VERDE'`
- **THEN** el borde izquierdo de 3px se renderiza en el color semántico de éxito, sin ser sobreescrito por las clases `dark:border-*` del resto del borde

#### Scenario: KPI-04 muestra su meta como reducción interanual, no como umbral
- **WHEN** se renderiza la tarjeta de `KPI-04` con `metaTipo: 'REDUCCION_INTERANUAL'` y `meta: 10`
- **THEN** el texto de meta mostrado es "Reducción ≥10% anual" (o su traducción equivalente), nunca `"Meta: 10.00"` ni `"Meta: 10%"` como si fuera un umbral absoluto

#### Scenario: KPI-09 muestra una lista de áreas, no un porcentaje
- **WHEN** se renderiza la tarjeta de `KPI-09` con `distribucion: [{ area: 'Almacén Norte', valor: 5 }, { area: 'Calidad', valor: 2 }, { area: 'Laboratorio de Calidad', valor: 1 }]`
- **THEN** la tarjeta muestra las 3 áreas con su conteo respectivo, no un único valor numérico con `%`/`d`/tasa

#### Scenario: KPI-09 no usa color semántico de semáforo
- **WHEN** se renderiza la tarjeta de `KPI-09` (`semaforo: 'INFORMATIVO'`)
- **THEN** el borde izquierdo y el color del valor no usan las clases de `VERDE`/`AMARILLO`/`ROJO`
