## MODIFIED Requirements

### Requirement: Estado de las dos firmas con nombres
While `qe.estado === 'PENDIENTE_CIERRE'` (with or without `qe.resultadoCierre`), `QECierreSection` SHALL show the steps block to every user who can open the QE, regardless of role, with three rows:
- **Paso 1 — Registrar el resultado del cierre (Jefe de Calidad)** (`detail.cierre.paso1`): if `qe.resultadoCierre` is set, "✓ {fecha}", where the date comes from the latest audit entry `CIERRE_INICIADO` (if absent, only "✓"); otherwise `detail.cierre.pendiente`. The closure form SHALL keep being shown only to `JEFE_CALIDAD_SYST` while `resultadoCierre` is not set.
- **Firma 1 — Jefe de Calidad** (`detail.cierre.firma1`): if `qe.cerradoPorId` is set, "✓ {qe.cerradoPorNombre} — {fecha y hora}", where the date comes from the audit entry `FIRMA_CIERRE_JEFE_CALIDAD` or, if absent, the latest `FIRMA_REGISTRADA` with `campoModificado === 'cerradoPorId'`; otherwise `detail.cierre.pendiente`.
- **Firma 2 — Supervisor de {área}** (`detail.cierre.firma2`, area name via `useArea(qe.areaId)`, fallback the id): if signed, "✓ {qe.cierreFirmaSupervisorNombre} — {fecha}"; if pending with the first signature done, `detail.cierre.pendiente` plus `detail.cierre.puedenFirmar` with the names in `qe.supervisoresArea` joined by ", " and `detail.cierre.avisoEnviado`; if pending without the first signature, `detail.cierre.esperaJCA`.

From CERRADO onward (`CERRADO`, `EN_VERIFICACION`, `VERIFICADO`) the three rows SHALL keep being shown together with the closure summary. Dates SHALL be formatted with `Intl.DateTimeFormat(i18n.language, …)`. All hooks of `QECierreSection` SHALL run before any early `return`.

#### Scenario: Supervisor sees the steps before the closure result is recorded
- **WHEN** the QE is in PENDIENTE_CIERRE without `resultadoCierre` and the current user is a SUPERVISOR
- **THEN** the section shows "Paso 1 — Registrar el resultado del cierre (Jefe de Calidad)" as "Pendiente", Firma 1 as "Pendiente" and Firma 2 as "Se habilita después de la firma del Jefe de Calidad.", and no closure form

#### Scenario: JCA still sees the closure form
- **WHEN** the QE is in PENDIENTE_CIERRE without `resultadoCierre` and the current user is JEFE_CALIDAD_SYST
- **THEN** the section shows the closure form and the three step rows

#### Scenario: Step 1 done
- **WHEN** the QE has `resultadoCierre` and an audit entry `CIERRE_INICIADO`
- **THEN** Paso 1 shows "✓" with that entry's formatted date

#### Scenario: First signature pending
- **WHEN** the QE has `resultadoCierre` but no `cerradoPorId`
- **THEN** Firma 1 shows "Pendiente" and Firma 2 shows "Se habilita después de la firma del Jefe de Calidad."

#### Scenario: First signature done with legacy audit entry
- **WHEN** `cerradoPorId` is set, `cerradoPorNombre: 'Ana Pérez'`, and the only signature audit entry is `FIRMA_REGISTRADA` with `campoModificado: 'cerradoPorId'`
- **THEN** Firma 1 shows "Ana Pérez" with that entry's formatted date

#### Scenario: Second signature pending lists who can sign
- **WHEN** `cerradoPorId` is set and `supervisoresArea` has "Luis Soto" and "Rosa Vega"
- **THEN** Firma 2 shows "Pendiente", "Pueden firmar: Luis Soto, Rosa Vega" and "Se les envió un aviso."
