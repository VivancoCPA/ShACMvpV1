## MODIFIED Requirements

### Requirement: QEACSection shows a pending-AC-requests banner for JEFE_CALIDAD_SYST
When `qe.solicitudesAC > 0`, `QEACSection` SHALL render a banner visible only to `JEFE_CALIDAD_SYST` reading "N solicitudes de nueva AC pendientes — registradas desde el origen del QE" (N = `qe.solicitudesAC`). The banner SHALL NOT render when `solicitudesAC` is 0 or for other roles.

The banner SHALL include a "Crear AC" button (opens the add-AC modal; only when the QE state allows creating ACs and the section is not `readOnly`) and a "Descartar solicitud" button (opens a reason modal, 20–500 characters; not when `readOnly`). Creating an AC consumes one pending request server-side, and dismissing consumes one with a reason; both refresh the QE detail, the QE list and the dashboard so the banner, the list badge and RN-QE-009 update immediately.

#### Scenario: Banner shown for JEFE_CALIDAD_SYST when solicitudesAC > 0
- **WHEN** `QEACSection` renders with `qe.solicitudesAC === 2` and role `JEFE_CALIDAD_SYST`
- **THEN** a banner reading "2 solicitudes de nueva AC pendientes — registradas desde el origen del QE" is visible

#### Scenario: Banner hidden when solicitudesAC is 0
- **WHEN** `QEACSection` renders with `qe.solicitudesAC === 0`
- **THEN** no pending-AC-requests banner is rendered

#### Scenario: Banner hidden for other roles
- **WHEN** `QEACSection` renders with `qe.solicitudesAC === 2` and role `SUPERVISOR`
- **THEN** no pending-AC-requests banner is rendered

#### Scenario: Banner offers Crear AC and Descartar solicitud
- **WHEN** `QEACSection` renders with `qe.solicitudesAC === 1`, `qeEstado: 'EN_INVESTIGACION'` and role `JEFE_CALIDAD_SYST`
- **THEN** the banner shows "Crear AC" and "Descartar solicitud" buttons

#### Scenario: Read-only hides banner actions
- **WHEN** `QEACSection` renders with `readOnly` and `qe.solicitudesAC === 1` for a JEFE_CALIDAD_SYST
- **THEN** the banner text is shown without "Crear AC" or "Descartar solicitud"
