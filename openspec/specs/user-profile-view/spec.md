# Spec: user-profile-view

## Purpose

Vista de perfil propio (`/perfil`) para los 7 roles: información de cuenta de solo lectura (avatar, nombre, email, rol con badge, área, áreas asignadas) reutilizando el botón "Mi perfil" ya existente en el dropdown de avatar de `TopNav`. No es un módulo de dominio (M1-M5); es información personal accesible por sesión autenticada sin restricción de rol, y no aparece en `Sidebar.tsx`.

---

## Requirements

### Requirement: Ruta de perfil accesible a los 7 roles
El sistema SHALL exponer la ruta `/perfil` como hija directa de `AppShell`, protegida únicamente por autenticación (sin `requiredRoles` adicional en `RoleGuard`), de modo que los 7 roles (`OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`, `ADMINISTRADOR_SISTEMA`) puedan acceder a su propia información de cuenta.

#### Scenario: Usuario autenticado de cualquier rol accede a /perfil
- **WHEN** un usuario autenticado con cualquiera de los 7 roles navega directamente a `/perfil`
- **THEN** el sistema renderiza la página de perfil con su propia información, sin redirigir a `/no-autorizado`

#### Scenario: Usuario no autenticado intenta acceder a /perfil
- **WHEN** un usuario sin sesión activa navega a `/perfil`
- **THEN** el sistema redirige a `/login`

### Requirement: Entrada de navegación desde el dropdown de TopNav
El dropdown de avatar en `TopNav` ya incluye un botón "Mi perfil" (previamente inerte, cuyo `onClick` solo cerraba el dropdown). El sistema SHALL reutilizar ese mismo botón — sin agregar un ítem duplicado al dropdown — conectando su `onClick` para que además navegue a `/perfil`, preservando el cierre del dropdown como comportamiento adicional (no como reemplazo).

#### Scenario: Click en "Mi perfil" desde el dropdown
- **WHEN** el usuario abre el dropdown de su avatar en TopNav y hace click en el botón existente "Mi perfil"
- **THEN** el dropdown se cierra y el sistema navega a `/perfil`

#### Scenario: No se agrega un ítem duplicado al dropdown
- **WHEN** se implementa la navegación a `/perfil`
- **THEN** el dropdown de avatar conserva únicamente el botón "Mi perfil" ya existente (más "Cerrar sesión"), sin ítems adicionales para el mismo destino

### Requirement: /perfil no aparece en Sidebar
`/perfil` SHALL ser accesible únicamente por ruta directa y por el dropdown de TopNav, y NUNCA SHALL aparecer como ítem de navegación en `Sidebar.tsx`.

#### Scenario: Revisión del Sidebar para cualquier rol
- **WHEN** cualquiera de los 7 roles visualiza el Sidebar
- **THEN** no existe ningún ítem de navegación que enlace a `/perfil`

### Requirement: Sección de solo lectura con datos de cuenta
La página `/perfil` SHALL mostrar, en modo de solo lectura: avatar del usuario en tamaño grande, nombre completo, email, rol (con el mismo badge de color semántico usado en TopNav vía `ROLE_BG_CLASSES`), y área propia (`area`).

#### Scenario: Cualquier usuario ve su información básica
- **WHEN** un usuario autenticado abre `/perfil`
- **THEN** ve su avatar, nombre completo, email, badge de rol con el color correspondiente a su `rol`, y su `area`

### Requirement: Áreas asignadas condicionales para SUPERVISOR
Cuando `rol === 'SUPERVISOR'`, la página SHALL mostrar `areasAsignadas[]` como una lista de tags. Para los demás roles, esta fila SHALL omitirse por completo (no se muestra vacía).

#### Scenario: Un SUPERVISOR ve sus áreas asignadas
- **WHEN** un usuario con `rol === 'SUPERVISOR'` y `areasAsignadas` no vacío abre `/perfil`
- **THEN** ve una lista de tags con cada área de `areasAsignadas`

#### Scenario: Un rol distinto de SUPERVISOR no ve la fila de áreas asignadas
- **WHEN** un usuario con `rol !== 'SUPERVISOR'` abre `/perfil`
- **THEN** la fila de "áreas asignadas" no se renderiza en la página

### Requirement: Fechas de cuenta: creación y último acceso
La página `/perfil` SHALL mostrar la fila "Cuenta creada" con `createdAt` del usuario autenticado formateado vía `Intl.DateTimeFormat` (ej. "12 mar 2025") — `createdAt` es un campo obligatorio de `MockUser`, por lo que esta fila SHALL mostrarse siempre. La página SHALL mostrar además la fila "Último acceso" con `lastLogin` formateado (ej. "hoy, 10:32 am" o fecha relativa) únicamente cuando `lastLogin` esté definido.

#### Scenario: Usuario con historial de login ve ambas fechas
- **WHEN** un usuario autenticado con `createdAt` y `lastLogin` definidos abre `/perfil`
- **THEN** ve la fila "Cuenta creada" formateada y la fila "Último acceso" formateada

#### Scenario: Usuario que nunca inició sesión en el mock no ve la fila de último acceso
- **WHEN** un usuario autenticado con `lastLogin` en `undefined` (nunca inició sesión en el mock desde que se agregó el campo) abre `/perfil`
- **THEN** ve la fila "Cuenta creada" pero la fila "Último acceso" se omite por completo, sin mostrar un valor vacío o placeholder
