## Context

M5-S01 shipped 9 KPIs (`kpi.constants.ts`, `dashboard.handlers.ts`) as a documented business assumption, since no PRD was available in the repo at the time — its `design.md` explicitly flagged this and named the follow-up change that would reconcile against the real PRD once available: this change. SHAC-PRD-003 §5.2 is now available (provided by the user) and is authoritative. Browser verification of `JefeCalidadDashboard` (built in M5-S05a, still unarchived) surfaced the mismatch: none of the 9 KPI names/formulas match the PRD.

Investigating the PRD's 9 formulas against the actual `QualityEvent`/`AccionCorrectiva`/`NoConformidad`/`Incidente`/`Documento` types (`qualityEvent.types.ts`, `nonconformity.types.ts`, `incident.types.ts`) surfaced 5 additional data-model gaps beyond the one the user already flagged (KPI-04's meta type). Every gap is resolved below as an explicit, low-risk assumption — the same posture M5-S01 took, kept localized so a future correction (e.g. a real SLA-by-severity field, or an AC-level verification field) is a targeted change, not a type migration.

## Goals / Non-Goals

**Goals:**
- Replace all 9 `KPI_DEFINITIONS` entries and their `calcularKpiXX` implementations to match SHAC-PRD-003 §5.2 exactly (names, formulas, units, metas, frequencies).
- Extend `KpiDefinition`/`KpiResult` minimally to support KPI-04's relative-reduction meta and KPI-09's distribution shape, without turning the other 7 KPIs' scalar contract into something more complex than it needs to be.
- Fix `KpiGridWidget`'s dark-mode border bug and add rendering for the two special cases.
- Document every data-model gap as an explicit assumption, in the same style as M5-S01's design.md.

**Non-Goals:**
- No new UI beyond `KpiGridWidget`'s existing card grid (no separate heat-map visualization component, no charting library).
- No backend/schema changes to add genuinely missing fields (e.g. an AC-level `resultadoVerificacion`, a QE closure SLA field, a dedicated "análisis completado" timestamp) — all gaps are resolved with proxies over existing fields, since M5 is mock-only and a real backend will reimplement these formulas anyway (per M5-S01's design.md Decision 5).
- No re-scoping of `SupervisorDashboardData.kpisArea` beyond confirming the existing 5 KPI-id slots still make sense under the new definitions.

## Decisions

### 1. The 9 corrected KPIs (SHAC-PRD-003 §5.2 — replaces the M5-S01 assumption table)

| ID | Nombre | Fórmula | Unidad | Meta | Frecuencia |
|---|---|---|---|---|---|
| KPI-01 | Tasa de cierre de QE en plazo | % de QE con `estado` en `CERRADO`/`VERIFICADO`, `fechaCierre` en el período, y (`fechaCierre − fechaHoraReporte` en días hábiles) `<= plazoMaximo(severidad)` — suma por severidad de SHAC-PRD-003 §1.3 (`EN_INVESTIGACION` + `ANALISIS_COMPLETADO` 2d + `PENDIENTE_CIERRE` 5d; `EN_EJECUCION` excluido, ver §1.6): BAJA=22, MEDIA=17, ALTA=14, CRITICA=10 días hábiles | PORCENTAJE | ≥90% | Mensual |
| KPI-02 | Tiempo promedio de cierre de QE | Promedio en días hábiles de `fechaCierre − fechaHoraReporte` para QE en `CERRADO`/`VERIFICADO` cerrados en el período | DIAS | ≤15 días | Mensual |
| KPI-03 | Tasa de reincidencia (reaperturas) | % de QE con `ciclo > 1` sobre QE en `CERRADO`/`VERIFICADO` cerrados en el período | PORCENTAJE | ≤5% | Trimestral |
| KPI-04 | Índice de frecuencia de incidentes | (N.º incidentes con `huboLesionados=true` × 1,000,000) / horas trabajadas del período | TASA | Reducción ≥10% interanual | Mensual |
| KPI-05 | Tasa de eficacia de acciones correctivas | % de ACs (origen QE/NC) cuyo padre tiene `resultadoVerificacion='EFECTIVO'` sobre ACs cerradas cuyo padre fue verificado en el período | PORCENTAJE | ≥85% | Mensual |
| KPI-06 | % Documentos vigentes bajo control | % de `Documento` en `PUBLICADO` con `fechaRevisionProxima >= hoy` sobre el total de `Documento` en `PUBLICADO` (snapshot, no filtrado por período) | PORCENTAJE | 100% | Mensual |
| KPI-07 | Tiempo promedio de investigación | Promedio en días hábiles de `fechaAnalisisCompletado − fechaHoraReporte` para QE con una entrada de `auditTrail` (`accion === 'ESTADO_CAMBIADO'`, `estadoNuevo === 'ANALISIS_COMPLETADO'`) cuyo `timestamp` cae en el período; `fechaAnalisisCompletado` es el `timestamp` de esa entrada (la más reciente, si el QE fue reabierto y pasó por `ANALISIS_COMPLETADO` más de una vez) | DIAS | ≤7 días | Mensual |
| KPI-08 | ACs vencidas activas | Conteo de ACs (QE+NC+Incidente) con `estado` no terminal y `plazoFecha < hoy` | CONTEO | =0 ideal, ≤3 aceptable | Tiempo real |
| KPI-09 | NCs por área (mapa de calor) | Conteo de QE por `areaAfectada` en el período, ranking descendente | DISTRIBUCION | Identificar top 3 áreas | Mensual |

Every formula uses only fields confirmed to exist (see gaps below for the 3 that need a proxy). This table replaces M5-S01's design.md §2 table as the source of truth for `KPI_DEFINITIONS`.

**Naming note carried over from M5-S05a's proposal correction**: the PRD's KPI-09 name says "NCs por área" but its own formula counts *QE* by área (`QualityEvent.areaAfectada`), not `NoConformidad`. This spec follows the formula (QE count), keeping the PRD's literal label as `nombre`/`descripcion` text (matching the source verbatim) — this is a PRD wording inconsistency, not something to silently "fix" by guessing intent.

### 2. `metaTipo` discriminant on `KpiDefinition`/`KpiResult` (KPI-04's relative-reduction meta)

```typescript
export type KpiMetaTipo = 'ABSOLUTO' | 'REDUCCION_INTERANUAL'

export interface KpiDefinition {
  // ...existing fields
  metaTipo: KpiMetaTipo
  meta: number // ABSOLUTO: threshold value. REDUCCION_INTERANUAL: reduction % target (10)
}

export interface KpiResult {
  // ...existing fields
  metaTipo: KpiMetaTipo
  valorPeriodoAnterior?: number // only set for REDUCCION_INTERANUAL kpis: same period, año anterior
}
```
Only `KPI-04` uses `REDUCCION_INTERANUAL`; the other 8 keep `metaTipo: 'ABSOLUTO'` with unchanged scalar semantics. `KpiGridWidget` renders `t('...meta', { meta })` only for `ABSOLUTO`; for `REDUCCION_INTERANUAL` it renders a fixed i18n string ("Reducción ≥{{pct}}% anual"), never `formatValor(meta, unidad)`.

**Semaforo for KPI-04**: `reduccionReal = (valorPeriodoAnterior - valor) / valorPeriodoAnterior * 100`. `VERDE` if `reduccionReal >= meta` (10); `AMARILLO` if `0 <= reduccionReal < meta` (still improving, short of target); `ROJO` if `reduccionReal < 0` (worsened) or `valorPeriodoAnterior` is `0`/unavailable (can't compute — conservative default, never silently claim success).

**Alternative considered**: keep `meta` as today (absolute) and just relabel the UI text without changing the type, computing the prior-year comparison purely client-side. Rejected: `KpiResult` is the API contract (`GET /api/dashboard/kpis`); burying "this meta is actually relative" in a UI-only lookup table would let a future consumer treat `meta: 10` as an absolute threshold again — the same class of bug this whole change exists to fix. The type must carry the discriminant.

### 3. Standalone fixture for KPI-04's year-over-year comparison

Mock fixtures (`incidents.fixtures.ts`, `horasTrabajadas.fixtures.ts`) only cover Jan–Jul 2026 — no 2025 data exists to compute a genuine prior-year comparison. Rather than backfilling a full year of `Incidente`/`HorasTrabajadasEntry` records (invasive, and no other KPI needs 2025 data), add one small standalone fixture:
```typescript
// kpi04AnioAnterior.fixtures.ts
export interface Kpi04AnioAnteriorEntry { periodo: string; valor: number } // periodo del año actual; valor = índice ya calculado para el mismo período del año anterior
export const kpi04AnioAnteriorFixtures: Kpi04AnioAnteriorEntry[]
```
One entry per month covered by the existing incident fixtures (2026-01 through 2026-07), each holding a plausible precomputed index value for the "2025 equivalent" period — consistent with how `horasTrabajadasFixtures` was added standalone in M5-S01 for the same KPI. `calcularKpi04` looks up `valorPeriodoAnterior` from this fixture by `periodo`; if no entry exists for the requested period, `valorPeriodoAnterior` is `undefined` and the semaforo falls back to the conservative case above.

**Alternative considered**: reconstruct 2025 from scratch with full `Incidente` fixtures. Rejected — YAGNI; no other KPI or screen needs full 2025 incident-level detail, only the aggregate rate.

### 4. `distribucion` field + `INFORMATIVO` semaforo (KPI-09's heat-map shape)

```typescript
export type KpiSemaforo = 'VERDE' | 'AMARILLO' | 'ROJO' | 'INFORMATIVO'

export interface KpiResult {
  // ...existing fields
  semaforo: KpiSemaforo
  distribucion?: { area: string; valor: number }[] // only set for KPI-09
}
```
KPI-09's `valor` holds the top area's count (for consistency with `formatValor`/sorting), `distribucion` holds the full ranked breakdown by `areaAfectada` (all areas with `valor > 0`, sorted descending), and `semaforo` is always `'INFORMATIVO'` — the PRD's "meta" for KPI-09 is "identify top 3 areas," an instruction, not a pass/fail threshold, so no red/yellow/green judgment is meaningful. `KpiGridWidget` special-cases `kpiId === 'KPI-09'`: instead of the generic single-number card, it renders the top 3 entries of `distribucion` as a small ranked list, with `INFORMATIVO` mapped to a neutral (not semantic-colored) left border and no `VALOR_CLASSES` color on the text.

**Alternative considered**: force KPI-09 into the scalar contract by reporting only the #1 area's count as `valor` with an arbitrary `meta`/semaforo (mirroring how KPI-04 stretches the contract with `metaTipo`). Rejected — KPI-04's stretch (a different *meaning* of the same scalar) is qualitatively different from KPI-09's stretch (a fundamentally different *shape*, a ranked list vs a number); collapsing a top-3 breakdown into one number would lose the information the KPI exists to surface, defeating the PRD's own stated purpose ("identificar top 3 áreas").

### 5. Business-day fixes for KPI-02/KPI-07, and KPI-07's `ANALISIS_COMPLETADO` timestamp from `auditTrail`

Current `calcularKpi03` (soon-to-be KPI-02) divides by `86_400_000` (calendar days). Both KPI-02 and KPI-07 must use `contarDiasHabiles(desde, hasta)` (`src/utils/businessDays.ts`, already used elsewhere for AC deadlines) per the PRD's explicit "en días hábiles."

KPI-07 needs `fecha_analisis_completado`. `ANALISIS_COMPLETADO` is its own explicit state in the QE flow (SHAC-PRD-003 §1.3, state #3) — distinct from and prior to the root-cause signature/approval, which gates the later transition into `EN_EJECUCION` per `RN-QE-002`. Per `RN-QE-001`, every state transition is recorded in `auditTrail` with a `timestamp` (`QEAuditTrailEntry`, `qualityEvent.types.ts`), and the mock transition handler (`quality-events.handlers.ts`) already writes `accion: 'ESTADO_CAMBIADO'`, `estadoNuevo: <target state>` for every transition, including into `ANALISIS_COMPLETADO`. KPI-07 reads that entry's `timestamp` directly — no proxy needed. `causaRaizFirmadaEn` (the field used previously) is dropped from this formula: it is set at a later, distinct transition and does not mean "fecha de análisis completado."

If a QE was reabierto and passed through `ANALISIS_COMPLETADO` more than once (once per `ciclo`), KPI-07 uses the most recent matching `auditTrail` entry — consistent with treating a QE's "current" investigation cycle as the relevant one, and avoiding double-counting an earlier cycle's investigation time.

**Alternative considered (superseded)**: use `causaRaizFirmadaEn` as a proxy, on the theory that no other dashboard formula reads `auditTrail` and the two timestamps are set together in the current mock transition logic. Rejected on reinspection — `causaRaizFirmadaEn` is semantically the wrong field (it marks the causa-raíz signature, a state later than `ANALISIS_COMPLETADO`), and the PRD confirms `ANALISIS_COMPLETADO` is a first-class, separately-reached state (§1.3) whose transition is already timestamped in `auditTrail` by `RN-QE-001`. Reading it directly isn't a fragile workaround — it's the field that actually answers the question KPI-07 asks. The earlier proxy is removed.

### 6. KPI-01's "en plazo" cutoff is a per-severity sum grounded in SHAC-PRD-003 §1.3, not a flat 15 days

`QualityEvent` has no closure-deadline field (unlike `AccionCorrectiva.plazoFecha`), so KPI-01 cannot read a stored SLA directly — but SHAC-PRD-003 §1.3 ("Estados y Transiciones del QE") does define a maximum time budget per severity and per flow state:

| Severidad | EN_INVESTIGACION | ANALISIS_COMPLETADO | PENDIENTE_CIERRE |
|---|---|---|---|
| Baja | 15d | 2d hábiles | 5d hábiles |
| Media | 10d | 2d hábiles | 5d hábiles |
| Alta | 7d | 2d hábiles | 5d hábiles |
| Crítica | 3d | 2d hábiles | 5d hábiles |

KPI-01's "en plazo" cutoff (`plazoMaximo(severidad)`) is the SUM of the three applicable state budgets for the QE's `severidad`: `EN_INVESTIGACION + ANALISIS_COMPLETADO (2) + PENDIENTE_CIERRE (5)`. `EN_EJECUCION` is excluded — its plazo is per-AC (§1.6, `AccionCorrectiva.plazoFecha`), not part of the QE-level aggregate this KPI measures. This gives:

```typescript
export const PLAZO_MAXIMO_QE_DIAS_HABILES: Record<QESeverity, number> = {
  BAJA: 22,    // 15 + 2 + 5
  MEDIA: 17,   // 10 + 2 + 5
  ALTA: 14,    // 7 + 2 + 5
  CRITICA: 10, // 3 + 2 + 5
}
```

`calcularKpi01` looks up `PLAZO_MAXIMO_QE_DIAS_HABILES[qe.severidad]` per QE, replacing the old flat 15-business-day cutoff used for every severity.

**Documented interpretation, not literal PRD text**: §1.3 states per-state budgets, not "sum them for a QE-level closure SLA" in so many words — summing the three sequential state budgets into one QE-level cutoff is this change's interpretation, chosen because it's the only reading that produces a single number comparable to the QE's actual end-to-end `fechaCierre − fechaHoraReporte` duration (which KPI-01's own formula requires). It is substantially more faithful to the PRD than the flat-15-day placeholder it replaces: it now varies correctly by severity, and every component is traceable to a cited PRD table instead of reusing KPI-02's unrelated org-wide average target.

**Alternative considered (superseded)**: reuse KPI-02's own ≤15-business-day target as a flat cutoff for all severities. Rejected on reinspection — the PRD does define per-severity budgets (§1.3), so a flat number is no longer the best-available reading; using it would ignore evidence that exists in favor of convenience.

### 7. KPI-05's AC-level verification proxy

No `AccionCorrectiva*` type (QE, NC, or Incidente variant) has its own `resultadoVerificacion` field — only the parent `QualityEvent`/`NoConformidad` do, and `Incidente` has no verification concept at all. KPI-05 attributes the parent's `resultadoVerificacion` to all of its closed (`estado === 'CERRADA'`) ACs, scoped to QE- and NC-origin ACs only; Incidente-origin ACs are excluded from both numerator and denominator (not counted as "verified" or "not verified" — they're simply out of scope for this KPI, since there's no verification signal to attribute).

**Alternative considered**: treat every closed AC as implicitly "verified" using its parent's status alone (`CERRADO`/`VERIFICADO`) without requiring `resultadoVerificacion` to be set. Rejected — would silently count QEs that were closed but never went through `EN_VERIFICACION`/`VERIFICADO` as "efectivas," overstating the KPI. Requiring `resultadoVerificacion` to be explicitly `'EFECTIVO'`/`'NO_EFECTIVO'` (not `undefined`) is stricter and matches what "ACs totales verificadas" (the denominator) means.

### 8. KPI-08's band semaforo (not the generic ±20% deviation rule)

`calcularSemaforo`'s existing MAYOR_MEJOR/MENOR_MEJOR ± 20% deviation rule doesn't fit KPI-08's stated band ("=0 ideal, ≤3 aceptable"): a generic `MENOR_MEJOR` rule with `meta: 3` would mark `valor: 4` as within 20%-deviation `AMARILLO` (33% over) when the PRD's band implies anything above 3 is already `ROJO`. KPI-08 gets its own small-integer rule, special-cased in `calcularSemaforo` (or a new sibling function) rather than stretching the generic formula: `0 → VERDE`, `1..3 → AMARILLO`, `>3 → ROJO`. Computed over `collectAllACs(qes, ncs, incidentes)` (all 3 origins — the PRD doesn't restrict source, unlike KPI-05) filtered to `estado !== 'CERRADA' && estado !== 'COMPLETADA'` (the two non-terminal-closed states across the 3 AC type unions) and `plazoFecha < hoy`. No `periodo` filter — `frecuencia: 'Tiempo real'` is a new value alongside the existing `'MENSUAL'`/`'TRIMESTRAL'`, since `calcularKpis(periodo)` still runs on a schedule but KPI-08's result should reflect "right now," not a historical period window (`KpiResult.periodo` for KPI-08 is `'TIEMPO_REAL'`, not a `'YYYY-MM'` string).

### 9. `SUPERVISOR_KPI_IDS` re-evaluated, kept unchanged

The current 5 slots (`KPI-02, KPI-03, KPI-04, KPI-05, KPI-07`) were chosen under the old (wrong) meanings. Checked against the new meanings — tiempo promedio cierre QE, tasa de reincidencia, índice de frecuencia de incidentes, tasa de eficacia de AC, tiempo promedio de investigación — all 5 are still area-scoped operational metrics a Supervisor should see day-to-day, and none requires organization-wide data a Supervisor's `kpisArea` shouldn't expose (unlike KPI-06 docs, KPI-09's cross-area heat-map, or KPI-01's org-wide on-time rate). The 5 id slots are kept as-is; only the underlying formulas change. `dashboard-types`'s existing scenario ("SupervisorDashboardData no expone KPIs organizacionales completos") continues to hold.

## Risks / Trade-offs

- [KPI-01's per-severity cutoff sums three PRD-cited state budgets (§1.3) rather than reading a single literal "QE closure SLA" field — the summation itself is this change's interpretation, not literal PRD text] → Documented in Decision 6 with the source table; localized to one lookup table, cheap to correct if the PRD is later found to define the aggregate cutoff differently (e.g. non-additive, or including `EN_EJECUCION`).
- [KPI-05 undercounts "eficacia de AC" by excluding Incidente-origin ACs] → Documented; revisit if `Incidente` ever gains a verification field.
- [KPI-04's year-over-year fixture is a precomputed rate, not reconstructed from incident-level fixtures] → Acceptable for a mock; a real backend computes this from actual historical incident data, not a hand-authored fixture.
- [`KpiResult.semaforo` gaining a 4th value (`INFORMATIVO`) is a contract change for any future consumer that exhaustively switches on the 3 original values] → Only one current consumer (`KpiGridWidget`); its exhaustive switch/lookup (`VALOR_CLASSES`, `SEMAFORO_CLASSES`) is updated in this same change. Any switch missing the new case fails to typecheck (TS exhaustiveness), not silently at runtime.

## Migration Plan

No persisted data or backend to migrate — this is a mock-only (MSW) change. Deploy is: land the type/handler/fixture/component changes together in one PR (they're mutually dependent — `KpiGridWidget` cannot compile against the old `KpiResult` shape once `metaTipo`/`distribucion` are added as required/optional fields). No rollback concerns beyond a normal revert.

## Open Questions

- Is SHAC-PRD-003 §1.3's per-state budget table meant to be summed into a single QE-level "en plazo" cutoff (this change's interpretation, Decision 6), or does the PRD define the aggregate closure cutoff some other way?
- Should `AccionCorrectiva` (all 3 variants) eventually gain its own `resultadoVerificacion` field so KPI-05 doesn't need the parent-proxy assumption, and so Incidente-origin ACs can be included?
- Is the KPI-09 "NCs por área" vs "conteo de QE por área" naming/formula mismatch a PRD typo to flag back to the source, or intentional (e.g. QE count used as a proxy for NC concentration by area)?
