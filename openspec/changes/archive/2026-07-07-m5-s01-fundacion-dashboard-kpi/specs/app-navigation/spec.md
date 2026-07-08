## ADDED Requirements

### Requirement: Sidebar incluye ítem de navegación "Dashboard" visible para los 6 roles de dominio
El sistema SHALL corregir el ítem `dashboard` de `NAV_ITEMS` en `Sidebar.tsx` para que su lista de `roles` sea exactamente `['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION']`, alineada con el `RoleGuard` real de la ruta `/dashboard`. Antes de este change el ítem solo mostraba `['JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION']`, ocultando la navegación a `OPERARIO` y `SUPERVISOR` pese a que ahora tienen acceso real a la ruta.

#### Scenario: Ítem Dashboard visible para OPERARIO
- **WHEN** el usuario autenticado tiene rol `OPERARIO`
- **THEN** el ítem "Dashboard" con ícono `BarChart2` aparece en el sidebar

#### Scenario: Ítem Dashboard visible para SUPERVISOR
- **WHEN** el usuario autenticado tiene rol `SUPERVISOR`
- **THEN** el ítem "Dashboard" aparece en el sidebar

#### Scenario: Ítem Dashboard sigue visible para los 4 roles que ya lo veían
- **WHEN** el usuario autenticado tiene rol `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO` o `ALTA_DIRECCION`
- **THEN** el ítem "Dashboard" aparece en el sidebar

#### Scenario: Ítem Dashboard NO visible para ADMINISTRADOR_SISTEMA
- **WHEN** el usuario autenticado tiene rol `ADMINISTRADOR_SISTEMA`
- **THEN** el ítem "Dashboard" NO aparece en el sidebar
