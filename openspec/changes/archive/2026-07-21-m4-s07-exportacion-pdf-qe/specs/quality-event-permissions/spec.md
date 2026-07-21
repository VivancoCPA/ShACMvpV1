## ADDED Requirements

### Requirement: puedeExportarPDF helper gates PDF export independent of QE estado
The system SHALL export a pure function `puedeExportarPDF(rol: UserRole): boolean` from `src/features/quality-events/utils/qualityEventPermissions.ts`, using an exhaustive `switch` over every `UserRole` value with no `default` case (per the M6-S01 convention of naming every role explicitly). The function SHALL return `true` for `JEFE_CALIDAD_SYST`, `SUPERVISOR`, `AUDITOR_INTERNO`, and `ALTA_DIRECCION`, and `false` for `OPERARIO`, `JEFE_CONTROL_DOCUMENTARIO`, and `ADMINISTRADOR_SISTEMA`. Unlike `getQualityEventPermissions`, this function does not take `estado` or `esResponsable` — export is available for a QE in any state, to any of the four allowed roles, regardless of whether they are the assigned responsible party. This is the sole function `QEHeaderSection` and `QEList` SHALL use to decide whether export affordances (button, toolbar, selection checkboxes) render.

#### Scenario: Allowed roles return true
- **WHEN** a developer calls `puedeExportarPDF(rol)` for `rol` equal to each of `'JEFE_CALIDAD_SYST'`, `'SUPERVISOR'`, `'AUDITOR_INTERNO'`, and `'ALTA_DIRECCION'`
- **THEN** each call returns `true`

#### Scenario: Denied roles return false
- **WHEN** a developer calls `puedeExportarPDF(rol)` for `rol` equal to each of `'OPERARIO'`, `'JEFE_CONTROL_DOCUMENTARIO'`, and `'ADMINISTRADOR_SISTEMA'`
- **THEN** each call returns `false`

#### Scenario: Result does not depend on estado
- **WHEN** a developer calls `puedeExportarPDF('JEFE_CALIDAD_SYST')` for a QE in `'ABIERTO'` and separately for a QE in `'VERIFICADO'`
- **THEN** both calls return `true`, since `estado` is not a parameter of this function
