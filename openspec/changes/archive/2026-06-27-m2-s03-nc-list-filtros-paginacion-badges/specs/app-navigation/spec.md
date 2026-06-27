# app-navigation

## MODIFIED Requirements

### Requirement: Sidebar muestra navegación filtrada por rol
El sidebar SHALL mostrar ítems de navegación según el rol del usuario autenticado. El filtrado SHALL aplicarse en render-time leyendo `authStore.user.role`.

#### Scenario: Usuario OPERARIO ve navegación reducida
- **WHEN** el usuario autenticado tiene rol `OPERARIO`
- **THEN** el sidebar muestra solo: Documentos, Incidentes SyST
- **THEN** los ítems No Conformidades, Quality Events, Dashboard y Usuarios NO aparecen

#### Scenario: Usuario SUPERVISOR ve navegación sin Dashboard ni Usuarios
- **WHEN** el usuario tiene rol `SUPERVISOR`
- **THEN** el sidebar muestra: Documentos, No Conformidades, Incidentes SyST, Quality Events
- **THEN** los ítems Dashboard y Usuarios NO aparecen

#### Scenario: Usuario JEFE_CALIDAD_SYST ve navegación completa
- **WHEN** el usuario tiene rol `JEFE_CALIDAD_SYST`
- **THEN** el sidebar muestra todos los ítems incluyendo No Conformidades, Dashboard y Usuarios

#### Scenario: Ítem activo resaltado
- **WHEN** la ruta actual coincide con el path de un ítem del sidebar
- **THEN** ese ítem tiene fondo `coral/10`, texto `coral` y borde izquierdo `border-l-2 border-coral`

---

## ADDED Requirements

### Requirement: Sidebar incluye ítem de navegación "No Conformidades"
El sistema SHALL agregar un ítem "No Conformidades" al sidebar con path `/nonconformities` e ícono `ClipboardX` de lucide-react. El ítem SHALL ser visible para todos los roles autenticados excepto `OPERARIO`. El label SHALL provenir de `t('common:nav.nonconformities')`.

#### Scenario: Ítem No Conformidades visible para SUPERVISOR
- **WHEN** el usuario autenticado tiene rol `SUPERVISOR`
- **THEN** el ítem "No Conformidades" con ícono `ClipboardX` aparece en el sidebar

#### Scenario: Ítem No Conformidades visible para JEFE_CALIDAD_SYST
- **WHEN** el usuario autenticado tiene rol `JEFE_CALIDAD_SYST`
- **THEN** el ítem "No Conformidades" aparece en el sidebar

#### Scenario: Ítem No Conformidades visible para AUDITOR_INTERNO
- **WHEN** el usuario autenticado tiene rol `AUDITOR_INTERNO`
- **THEN** el ítem "No Conformidades" aparece en el sidebar (acceso de solo lectura)

#### Scenario: Ítem No Conformidades visible para ALTA_DIRECCION
- **WHEN** el usuario autenticado tiene rol `ALTA_DIRECCION`
- **THEN** el ítem "No Conformidades" aparece en el sidebar

#### Scenario: Ítem No Conformidades NO visible para OPERARIO
- **WHEN** el usuario autenticado tiene rol `OPERARIO`
- **THEN** el ítem "No Conformidades" NO aparece en el sidebar

#### Scenario: Ítem activo cuando ruta actual es /nonconformities
- **WHEN** la ruta actual es `/nonconformities` o cualquier subruta bajo `/nonconformities`
- **THEN** el ítem "No Conformidades" tiene fondo `coral/10`, texto `coral` y borde izquierdo `border-l-2 border-coral`

#### Scenario: Label del ítem usa i18n key
- **WHEN** el idioma de la UI es `es-PE`
- **THEN** el ítem muestra "No Conformidades"
- **WHEN** el idioma de la UI es `en-US`
- **THEN** el ítem muestra "Non-Conformities"
