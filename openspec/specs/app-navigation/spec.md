# Spec: app-navigation

## Purpose

Define the AppShell layout, sidebar navigation with role-based filtering, collapsible sidebar, TopNav with breadcrumb and global controls, UserAvatar component, PageWrapper, and dark mode application across the entire UI.

---

## Requirements

### Requirement: AppShell provee el layout principal de la aplicación
El sistema SHALL renderizar un layout de pantalla completa con sidebar izquierda fija y área principal (topnav + contenido). El sidebar SHALL estar visible por defecto en desktop (≥768px) y oculto por defecto en móvil (<768px). El estado de apertura del sidebar SHALL leerse de `uiStore.sidebarOpen`.

#### Scenario: Layout en desktop con sidebar abierto
- **WHEN** el usuario accede a cualquier ruta protegida en viewport ≥768px
- **THEN** el sidebar (240px) es visible a la izquierda, el área de contenido ocupa el resto, y el topnav aparece en la parte superior del área de contenido

#### Scenario: Layout en móvil con sidebar cerrado
- **WHEN** el usuario accede a cualquier ruta protegida en viewport <768px
- **THEN** el sidebar está oculto y el área de contenido ocupa el ancho completo

#### Scenario: Sidebar abierto como drawer en móvil
- **WHEN** `uiStore.sidebarOpen` es `true` en viewport <768px
- **THEN** el sidebar aparece como overlay sobre el contenido con fondo semitransparente detrás

---

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

---

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

---

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

---

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

---

### Requirement: Sidebar es colapsable a modo íconos
El sidebar SHALL poder colapsarse a 64px de ancho mostrando solo íconos. En modo colapsado, cada ícono SHALL tener un atributo `title` con el nombre del ítem como tooltip. El header con el texto "SHAC" SHALL colapsarse también.

#### Scenario: Sidebar se colapsa al presionar botón de colapso
- **WHEN** el usuario hace click en el botón de colapsar (con `aria-label` apropiado)
- **THEN** el sidebar transiciona de 240px a 64px con transición CSS
- **THEN** los textos de los ítems y el texto "SHAC" se ocultan
- **THEN** los íconos permanecen visibles con atributo `title`

#### Scenario: Footer del sidebar se oculta al colapsar
- **WHEN** el sidebar está colapsado
- **THEN** el `UserAvatar`, nombre completo y badge de rol en el footer del sidebar NO son visibles

---

### Requirement: TopNav muestra breadcrumb, controles globales y bloque de usuario
El TopNav SHALL mostrar en su parte izquierda el breadcrumb dinámico de la ruta actual y en la derecha los toggles de idioma, tema, y el bloque de usuario.

#### Scenario: Breadcrumb refleja la ruta actual
- **WHEN** el usuario navega a `/documentos`
- **THEN** el breadcrumb muestra el label correspondiente al ítem "Documentos"

#### Scenario: Toggle de idioma alterna entre ES y EN
- **WHEN** el usuario hace click en el toggle de idioma
- **THEN** `preferencesStore.setLanguage` es llamado con el idioma opuesto
- **THEN** los textos de la UI se actualizan al nuevo idioma

#### Scenario: Toggle de tema alterna entre light y dark
- **WHEN** el usuario hace click en el toggle de tema
- **THEN** `uiStore.setTheme` es llamado
- **THEN** la clase `dark` en `<html>` se añade o quita correspondientemente
- **THEN** la preferencia persiste en `localStorage` con clave `shac-theme`

#### Scenario: Badge de rol en TopNav tiene color semántico por rol
- **WHEN** el usuario autenticado tiene rol `JEFE_CALIDAD_SYST`
- **THEN** el badge muestra texto con clases `bg-coral/20 text-coral`

#### Scenario: Dropdown de usuario muestra opciones
- **WHEN** el usuario hace click en el bloque de usuario (avatar + nombre)
- **THEN** aparece un dropdown con opciones: "Mi perfil" (placeholder) y "Cerrar sesión"

#### Scenario: Logout limpia el store y redirige
- **WHEN** el usuario hace click en "Cerrar sesión"
- **THEN** `authStore` queda limpio (`user: null`, `accessToken: null`)
- **THEN** el usuario es redirigido a `/login`

---

### Requirement: UserAvatar muestra imagen o iniciales con color por rol
El componente `UserAvatar` SHALL renderizar una `<img>` si `avatarUrl` está presente, o un círculo con las iniciales del usuario si no. El color de fondo de las iniciales SHALL derivarse del rol del usuario usando el mismo mapa de colores que el badge de rol en TopNav.

#### Scenario: Avatar con URL muestra imagen
- **WHEN** `user.avatarUrl` está definida
- **THEN** el componente renderiza `<img>` con `alt` igual al nombre completo del usuario

#### Scenario: Avatar sin URL muestra iniciales
- **WHEN** `user.avatarUrl` es `undefined`
- **THEN** el componente muestra un círculo con la primera letra del nombre y la primera letra del apellido

#### Scenario: Tamaños de avatar
- **WHEN** `size='sm'` se pasa como prop
- **THEN** el avatar tiene 28px de diámetro
- **WHEN** `size='lg'` se pasa
- **THEN** el avatar tiene 48px de diámetro
- **WHEN** no se pasa `size`
- **THEN** el avatar tiene 36px (default)

---

### Requirement: PageWrapper provee estructura consistente de página
El `PageWrapper` SHALL renderizar un `<h1>` con el título, un slot de acciones opcionales, y los `children` de contenido.

#### Scenario: Página con título y acciones
- **WHEN** `PageWrapper` recibe `title` y `actions`
- **THEN** el `<h1>` con el título aparece en la parte superior
- **THEN** el slot de acciones aparece alineado a la derecha del título

---

### Requirement: Dark mode aplicado en toda la aplicación
Todo componente del sistema SHALL tener variantes `dark:` de Tailwind en todas sus clases de color, fondo y borde. El estado inicial SHALL derivarse de `uiStore.theme`; si es `'system'`, SHALL detectarse `prefers-color-scheme`.

#### Scenario: Dark mode se aplica al cargar la app
- **WHEN** `uiStore.theme` es `'dark'`
- **THEN** la clase `dark` está presente en `document.documentElement` antes del primer render visible

#### Scenario: Dark mode detecta preferencia del sistema
- **WHEN** `uiStore.theme` es `'system'` y `prefers-color-scheme: dark`
- **THEN** la clase `dark` se aplica en `document.documentElement`
