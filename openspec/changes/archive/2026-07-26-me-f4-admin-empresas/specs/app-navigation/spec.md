## MODIFIED Requirements

### Requirement: Sidebar muestra navegación filtrada por rol
El sidebar SHALL mostrar ítems de navegación según el rol del usuario autenticado. El filtrado SHALL aplicarse en render-time leyendo `authStore.user.role`. El ítem "Usuarios" (`key: 'users'`, path `/usuarios`) SHALL tener `roles: ['ADMINISTRADOR_EMPRESA']`, alineado con el `RoleGuard` de la ruta — `ADMINISTRADOR_SISTEMA` deja de verlo.

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

#### Scenario: Usuario ADMINISTRADOR_SISTEMA ya NO ve el ítem Usuarios
- **WHEN** el usuario autenticado tiene rol `ADMINISTRADOR_SISTEMA`
- **THEN** el ítem "Usuarios" NO aparece en el sidebar (conserva los ítems "Áreas" y "Locales")

#### Scenario: Usuario ADMINISTRADOR_EMPRESA ve el ítem Usuarios
- **WHEN** el usuario autenticado tiene rol `ADMINISTRADOR_EMPRESA`
- **THEN** el ítem "Usuarios" con path `/usuarios` aparece en el sidebar

#### Scenario: Ítem activo resaltado
- **WHEN** la ruta actual coincide con el path de un ítem del sidebar
- **THEN** ese ítem tiene fondo `coral/10`, texto `coral` y borde izquierdo `border-l-2 border-coral`

### Requirement: TopNav muestra el nombre de la empresa activa; el control de cambio solo aparece con más de una empresa asignada
El sistema SHALL mostrar en `TopNav` el nombre (`razonSocial`) de la empresa activa siempre que `authStore` tenga una empresa activa resuelta, independientemente de cuántas empresas tenga asignadas el usuario. El control interactivo para cambiar de empresa (botón con chevron + dropdown de opciones) SHALL aparecer únicamente cuando `authStore.empresasDisponibles` tiene más de un elemento — con una sola empresa asignada, el nombre se muestra como texto simple, sin control de cambio (no hay entre qué cambiar). Al elegir una empresa distinta a la activa desde el control, el sistema SHALL invocar el flujo de cambio de empresa (`empresa-session`: `switch-empresa`, limpieza de caché, redirect condicional) sin cerrar la sesión. Para una sesión `SUPERADMIN` (`empresaActivaId: null`, `empresasDisponibles: []`), el bloque completo de empresa activa SHALL no renderizarse.

#### Scenario: Usuario de una sola empresa ve el nombre sin control de cambio
- **WHEN** `user-operario-001` (asignado únicamente a `empresa-001`) está autenticado
- **THEN** `TopNav` muestra "Minera Andina del Sur S.A.C." como texto
- **THEN** no hay botón ni dropdown asociado a ese texto — no es interactivo

#### Scenario: Usuario multi-empresa ve el nombre con control de cambio
- **WHEN** `user-supervisor-001` (asignado a `empresa-001` y `empresa-002`) está autenticado
- **THEN** `TopNav` muestra la empresa activa como un botón con chevron, que al hacer click despliega ambas opciones

#### Scenario: Elegir otra empresa dispara el cambio de contexto
- **WHEN** el usuario multi-empresa abre el control y elige una empresa distinta a la activa
- **THEN** se invoca el cambio de empresa activa (sin navegar a `/login`, sin perder la sesión)

#### Scenario: Badge de rol en TopNav refleja el rol de la nueva empresa tras el cambio
- **WHEN** `user-supervisor-001` cambia de `empresa-001` (`SUPERVISOR`) a `empresa-002` (`JEFE_CALIDAD_SYST`) usando el control de cambio
- **THEN** el badge de rol junto al nombre del usuario en `TopNav` pasa a mostrar `JEFE_CALIDAD_SYST`

#### Scenario: SUPERADMIN no ve ningún bloque de empresa activa en TopNav
- **WHEN** un usuario con rol `SUPERADMIN` está autenticado
- **THEN** `TopNav` no muestra ningún nombre de empresa ni control de cambio — el bloque completo está ausente

## ADDED Requirements

### Requirement: Sidebar incluye ítem de navegación "Empresas" exclusivo de SUPERADMIN
El sistema SHALL agregar un ítem "Empresas" al sidebar con path `/admin/empresas` e ícono `Building2` de lucide-react (mismo ícono ya usado por `TopNav` para el bloque de empresa activa). El ítem SHALL ser visible únicamente para el rol `SUPERADMIN`, alineado con el `RoleGuard` de la ruta.

#### Scenario: Ítem Empresas visible solo para SUPERADMIN
- **WHEN** el usuario autenticado tiene rol `SUPERADMIN`
- **THEN** el ítem "Empresas" con path `/admin/empresas` aparece en el sidebar

#### Scenario: Ítem Empresas NO visible para ningún otro rol
- **WHEN** el usuario autenticado tiene rol `ADMINISTRADOR_SISTEMA`, `ADMINISTRADOR_EMPRESA`, o cualquier rol operativo
- **THEN** el ítem "Empresas" NO aparece en el sidebar

#### Scenario: SUPERADMIN solo ve el ítem Empresas en el sidebar
- **WHEN** el usuario autenticado tiene rol `SUPERADMIN`
- **THEN** ningún otro ítem de navegación (Documentos, No Conformidades, Incidentes SyST, Quality Events, Dashboard, Usuarios, Áreas, Locales) aparece en el sidebar
