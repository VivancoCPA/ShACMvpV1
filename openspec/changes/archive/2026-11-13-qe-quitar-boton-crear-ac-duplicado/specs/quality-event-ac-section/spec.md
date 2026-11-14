## MODIFIED Requirements

### Requirement: QEACSection shows a pending-AC-requests banner for JEFE_CALIDAD_SYST
When `qe.solicitudesAC > 0`, `QEACSection` SHALL render a banner visible only to `JEFE_CALIDAD_SYST` reading "N solicitud(es) de nueva AC pendientes — registradas desde el origen del QE. Créala con «Nueva AC» o descártala." (N = `qe.solicitudesAC`). The banner SHALL NOT render when `solicitudesAC` is 0 or for other roles.

The banner SHALL include only a "Descartar solicitud" button (opens a reason modal, 20–500 characters; not when `readOnly`). The banner MUST NOT include its own "Crear AC" button: ACs are created with the "Nueva AC" button in the section header, which opens the same add-AC modal. Creating an AC consumes one pending request server-side, and dismissing consumes one with a reason; both refresh the QE detail, the QE list and the dashboard so the banner, the list badge and RN-QE-009 update immediately.

#### Scenario: Banner shown for JEFE_CALIDAD_SYST when solicitudesAC > 0
- **WHEN** `QEACSection` renders with `qe.solicitudesAC === 2` and role `JEFE_CALIDAD_SYST`
- **THEN** a banner reading "2 solicitud(es) de nueva AC pendientes — registradas desde el origen del QE. Créala con «Nueva AC» o descártala." is visible

#### Scenario: Banner hidden when solicitudesAC is 0
- **WHEN** `QEACSection` renders with `qe.solicitudesAC === 0`
- **THEN** no pending-AC-requests banner is rendered

#### Scenario: Banner hidden for other roles
- **WHEN** `QEACSection` renders with `qe.solicitudesAC === 2` and role `SUPERVISOR`
- **THEN** no pending-AC-requests banner is rendered

#### Scenario: Banner offers only Descartar solicitud
- **WHEN** `QEACSection` renders with `qe.solicitudesAC === 1`, `qeEstado: 'EN_INVESTIGACION'` and role `JEFE_CALIDAD_SYST`
- **THEN** the banner shows "Descartar solicitud" and no "Crear AC" button, and the section header shows "Nueva AC"

#### Scenario: Creating from Nueva AC clears the banner
- **WHEN** the JCA creates an AC from "Nueva AC" on a QE with `solicitudesAC === 1` and the refreshed QE comes back with `solicitudesAC === 0`
- **THEN** the banner is no longer rendered

#### Scenario: Read-only hides banner actions
- **WHEN** `QEACSection` renders with `readOnly` and `qe.solicitudesAC === 1` for a JEFE_CALIDAD_SYST
- **THEN** the banner text is shown without "Descartar solicitud"
