## ADDED Requirements

### Requirement: Página de listado de usuarios
`src/features/users/pages/UsersListPage.tsx` SHALL renderizarse en la ruta `/usuarios` (reemplazando `<ComingSoon label="Usuarios y Roles" />`), mostrando una tabla con nombre, email, rol (badge de color reutilizando el componente ya usado en `user-profile-view`), área, estado (activo/inactivo) y `lastLogin` formateado con `Intl.DateTimeFormat` según el locale activo. Listas largas SHALL usar paginación, siguiendo la regla global de listas largas de CLAUDE.md.

#### Scenario: Listado muestra todos los usuarios con sus datos clave
- **WHEN** `ADMINISTRADOR_SISTEMA` navega a `/usuarios`
- **THEN** la tabla muestra nombre, email, rol, área, estado y `lastLogin` de cada usuario

#### Scenario: lastLogin ausente se muestra de forma explícita
- **WHEN** un usuario del listado no tiene `lastLogin` (nunca inició sesión)
- **THEN** la celda correspondiente muestra un indicador explícito (p.ej. "Nunca") en vez de una fecha inválida o vacía

### Requirement: Filtros de listado por rol y estado
La página de listado SHALL incluir filtros por `rol` (todos los valores de `UserRole`) y por `activo` (Todos / Activos / Inactivos), aplicados vía los parámetros de `useUsers(filters)`.

#### Scenario: Filtrar por rol actualiza la tabla
- **WHEN** el admin selecciona el filtro de rol `JEFE_CALIDAD_SYST`
- **THEN** la tabla muestra únicamente usuarios con ese rol

#### Scenario: Filtrar por estado inactivo muestra solo bajas
- **WHEN** el admin selecciona el filtro de estado "Inactivos"
- **THEN** la tabla muestra únicamente usuarios con `activo: false`

### Requirement: Acción de baja/reactivación con confirmación
Cada fila SHALL incluir una acción de baja (si `activo: true`) o reactivación (si `activo: false`), que abre un modal de confirmación antes de ejecutar `useToggleUserActive()`. Tras confirmar, un toast de Sonner SHALL confirmar el resultado.

#### Scenario: Dar de baja requiere confirmación explícita
- **WHEN** el admin hace click en "Dar de baja" para un usuario activo
- **THEN** se abre un modal de confirmación y la baja NO se ejecuta hasta que el admin confirme

#### Scenario: Confirmar la baja actualiza el estado en la tabla
- **WHEN** el admin confirma la baja de un usuario
- **THEN** la fila de ese usuario refleja `activo: false` sin recargar la página, y se muestra un toast de éxito

#### Scenario: Reactivar un usuario dado de baja
- **WHEN** el admin hace click en "Reactivar" para un usuario inactivo y confirma
- **THEN** la fila refleja `activo: true` y se muestra un toast de éxito

### Requirement: Acción de reset de contraseña por fila requiere confirmación y permite copiar (RN-USR-004)
Cada fila SHALL incluir una acción "Resetear contraseña" que primero abre un modal de confirmación explícito (nunca `window.confirm`), indicando el nombre del usuario cuya contraseña se va a resetear y advirtiendo que la contraseña anterior queda invalidada de inmediato. Solo al confirmar en ese modal SHALL invocarse `useResetUserPassword()`. En éxito, SHALL mostrarse un modal de resultado (no un toast) con la `temporaryPassword` recibida y un botón "Copiar" junto a la contraseña que invoca `navigator.clipboard.writeText(temporaryPassword)`, mostrando feedback visual temporal (p.ej. cambio de ícono/texto a "Copiado") tras copiar. El modal de resultado NO se cierra automáticamente, hasta que el admin lo cierre manualmente.

#### Scenario: Resetear contraseña pide confirmación explícita antes de ejecutar
- **WHEN** el admin hace click en "Resetear contraseña" para un usuario
- **THEN** se abre un modal de confirmación mostrando el nombre de ese usuario, y el reset NO se ejecuta hasta que el admin confirme

#### Scenario: Confirmar el reset muestra la contraseña temporal en un modal con botón Copiar (CA-USR-08)
- **WHEN** el admin confirma el reset en el modal de confirmación
- **THEN** se genera la nueva contraseña temporal y se muestra en un modal de resultado que incluye un botón "Copiar" junto a la contraseña, y el modal NO se cierra automáticamente

#### Scenario: El botón Copiar copia la contraseña al portapapeles con feedback visual
- **WHEN** el admin hace click en el botón "Copiar" del modal de resultado del reset
- **THEN** `navigator.clipboard.writeText` se invoca con la `temporaryPassword` mostrada, y el botón muestra feedback visual temporal (p.ej. ícono o texto cambia a "Copiado") antes de volver a su estado original

### Requirement: Acceso exclusivo de ADMINISTRADOR_SISTEMA a las acciones del CRUD
Las acciones de alta, edición, baja/reactivación y reset de contraseña SHALL estar disponibles únicamente cuando `authStore.user.rol === 'ADMINISTRADOR_SISTEMA'`, verificado en render-time antes de mostrar los controles — consistente con la regla global de verificar rol antes de renderizar acciones protegidas (CLAUDE.md). Dado que `/usuarios` ya está protegida por `RoleGuard requiredRoles={['ADMINISTRADOR_SISTEMA']}`, esta verificación es redundante por diseño (defensa en profundidad), no una ruta de acceso alternativa.

#### Scenario: Todas las acciones visibles para ADMINISTRADOR_SISTEMA
- **WHEN** `ADMINISTRADOR_SISTEMA` visualiza `/usuarios`
- **THEN** los botones de alta, editar, baja/reactivación y reset de contraseña son visibles para cada fila
