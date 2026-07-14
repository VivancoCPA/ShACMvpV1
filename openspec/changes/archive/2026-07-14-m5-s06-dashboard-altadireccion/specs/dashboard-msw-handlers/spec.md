## ADDED Requirements

### Requirement: buildAltaDireccionData calcula QEs abiertos/vencidos, comparativa mensual, reaperturas y ACs con solicitud de ajuste de plazo pendiente
`buildAltaDireccionData()` SHALL calcular, sin duplicar lógica existente:
- `resumenPorModulo.qualityEvents.abiertos`: conteo de QE con `estado !== 'VERIFICADO'`.
- `resumenPorModulo.qualityEvents.vencidos`: subconjunto de los anteriores donde `contarDiasHabiles(new Date(qe.fechaHoraReporte), new Date()) > PLAZO_MAXIMO_QE_DIAS_HABILES[qe.severidad]`, reutilizando la misma función y tabla de `kpi.constants.ts` que usa `calcularKpi01`.
- `comparativaMensual`: para cada uno de KPI-01/04/05, invoca `calcularKpi01`/`calcularKpi04`/`calcularKpi05` sobre los 2 períodos de `ultimosMeses(2)` y clasifica la tendencia con un umbral de 2 puntos (`Math.abs(actual - anterior) < 2` → `'ESTABLE'`).
- `reaperturas`: QE con `ciclo > 1`, proyectados a `QEReaperturaResumen` con `fechaReapertura` derivada de la entrada de `auditTrail` más reciente con `estadoNuevo === 'REABIERTO'` (fallback `actualizadoEn`), ordenados descendentemente por `fechaReapertura`.
- `acsConSolicitudAjustePlazo`: ACs de QEs con `severidad === 'ALTA' || severidad === 'CRITICA'` cuyo `solicitudAjustePlazo?.estado === 'PENDIENTE'`, proyectadas a `ACSolicitudAjustePlazoResumen`.

#### Scenario: vencidos es subconjunto de abiertos
- **WHEN** se calcula `resumenPorModulo.qualityEvents` para el store en vivo
- **THEN** todo QE contado en `vencidos` también está contado en `abiertos`

#### Scenario: comparativaMensual reutiliza calcularKpi01/04/05
- **WHEN** se calcula `comparativaMensual`
- **THEN** los valores `actual`/`anterior` de cada KPI son idénticos a invocar directamente `calcularKpi01`/`calcularKpi04`/`calcularKpi05` con los mismos 2 períodos de `ultimosMeses(2)`

#### Scenario: reaperturas ordenadas por fecha de reapertura descendente
- **WHEN** el store tiene al menos 2 QE con `ciclo > 1` y distintas `fechaReapertura`
- **THEN** `reaperturas[0].fechaReapertura >= reaperturas[1].fechaReapertura`

#### Scenario: acsConSolicitudAjustePlazo excluye severidad MEDIA/BAJA y estados no pendientes
- **WHEN** el store tiene ACs con `solicitudAjustePlazo.estado` en `'PENDIENTE'`, `'APROBADA'` y `'RECHAZADA'`, y QE de severidad `MEDIA`, `ALTA` y `CRITICA`
- **THEN** `acsConSolicitudAjustePlazo` solo incluye ACs con `solicitudAjustePlazo.estado === 'PENDIENTE'` cuyo QE padre es `ALTA` o `CRITICA`
