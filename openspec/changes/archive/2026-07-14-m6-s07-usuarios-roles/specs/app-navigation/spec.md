## MODIFIED Requirements

### Requirement: Sidebar muestra navegación filtrada por rol
El sidebar SHALL mostrar ítems de navegación según el rol del usuario autenticado. El filtrado SHALL aplicarse en render-time leyendo `authStore.user.role`. El ítem "Usuarios" (`key: 'users'`, path `/usuarios`) SHALL tener `roles: ['ADMINISTRADOR_SISTEMA']`, alineado con el `RoleGuard` de la ruta — `JEFE_CALIDAD_SYST` y `ALTA_DIRECCION` dejan de verlo.

#### Scenario: Usuario OPERARIO ve navegación reducida
- **WHEN** el usuario autenticado tiene rol `OPERARIO`
- **THEN** el sidebar muestra: Documentos, Incidentes SyST, Dashboard
- **THEN** los ítems No Conformidades, Quality Events y Usuarios NO aparecen

#### Scenario: Usuario JEFE_CALIDAD_SYST ya NO ve el ítem Usuarios
- **WHEN** el usuario tiene rol `JEFE_CALIDAD_SYST`
- **THEN** el sidebar muestra No Conformidades, Quality Events y Dashboard
- **THEN** el ítem Usuarios NO aparece

#### Scenario: Usuario ALTA_DIRECCION ya NO ve el ítem Usuarios
- **WHEN** el usuario tiene rol `ALTA_DIRECCION`
- **THEN** el ítem Usuarios NO aparece

#### Scenario: Usuario SUPERVISOR ve navegación sin Usuarios
- **WHEN** el usuario tiene rol `SUPERVISOR`
- **THEN** el sidebar muestra: Documentos, No Conformidades, Incidentes SyST, Quality Events, Dashboard
- **THEN** el ítem Usuarios NO aparece

#### Scenario: Usuario ADMINISTRADOR_SISTEMA ve el ítem Usuarios
- **WHEN** el usuario autenticado tiene rol `ADMINISTRADOR_SISTEMA`
- **THEN** el ítem "Usuarios" con path `/usuarios` aparece en el sidebar

#### Scenario: Ítem activo resaltado
- **WHEN** la ruta actual coincide con el path de un ítem del sidebar
- **THEN** ese ítem tiene fondo `coral/10`, texto `coral` y borde izquierdo `border-l-2 border-coral`
