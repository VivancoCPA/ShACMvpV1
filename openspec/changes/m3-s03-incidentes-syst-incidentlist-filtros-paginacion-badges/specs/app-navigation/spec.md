## ADDED Requirements

### Requirement: Sidebar incluye ítem de navegación "Incidentes SyST"
El sistema SHALL agregar un ítem "Incidentes SyST" al sidebar con path `/incidents` e ícono `ShieldAlert` de lucide-react. El ítem SHALL posicionarse después del ítem "No Conformidades" y antes del ítem "Quality Events". El ítem SHALL ser visible para los roles `OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `AUDITOR_INTERNO`, y `ALTA_DIRECCION`. El ítem SHALL ser invisible para `JEFE_CONTROL_DOCUMENTARIO`. El label SHALL provenir de `t('common:nav.incidents')`.

#### Scenario: Ítem Incidentes SyST visible para OPERARIO
- **WHEN** el usuario autenticado tiene rol `OPERARIO`
- **THEN** el ítem "Incidentes SyST" con ícono `ShieldAlert` aparece en el sidebar

#### Scenario: Ítem Incidentes SyST visible para SUPERVISOR
- **WHEN** el usuario autenticado tiene rol `SUPERVISOR`
- **THEN** el ítem "Incidentes SyST" aparece en el sidebar

#### Scenario: Ítem Incidentes SyST visible para JEFE_CALIDAD_SYST
- **WHEN** el usuario autenticado tiene rol `JEFE_CALIDAD_SYST`
- **THEN** el ítem "Incidentes SyST" aparece en el sidebar

#### Scenario: Ítem Incidentes SyST visible para AUDITOR_INTERNO
- **WHEN** el usuario autenticado tiene rol `AUDITOR_INTERNO`
- **THEN** el ítem "Incidentes SyST" aparece en el sidebar

#### Scenario: Ítem Incidentes SyST visible para ALTA_DIRECCION
- **WHEN** el usuario autenticado tiene rol `ALTA_DIRECCION`
- **THEN** el ítem "Incidentes SyST" aparece en el sidebar

#### Scenario: Ítem Incidentes SyST NO visible para JEFE_CONTROL_DOCUMENTARIO
- **WHEN** el usuario autenticado tiene rol `JEFE_CONTROL_DOCUMENTARIO`
- **THEN** el ítem "Incidentes SyST" NO aparece en el sidebar

#### Scenario: Ítem activo cuando ruta actual es /incidents
- **WHEN** la ruta actual es `/incidents` o cualquier subruta bajo `/incidents`
- **THEN** el ítem "Incidentes SyST" tiene fondo `coral/10`, texto `coral` y borde izquierdo `border-l-2 border-coral`

#### Scenario: Ítem Incidentes SyST se posiciona entre No Conformidades y Quality Events
- **WHEN** el sidebar renderiza la lista de navegación
- **THEN** el ítem "Incidentes SyST" aparece inmediatamente después de "No Conformidades" y antes de "Quality Events"

#### Scenario: Label del ítem usa i18n key
- **WHEN** el idioma de la UI es `es-PE`
- **THEN** el ítem muestra "Incidentes SyST"
- **WHEN** el idioma de la UI es `en-US`
- **THEN** el ítem muestra "SyST Incidents"
