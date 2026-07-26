## MODIFIED Requirements

### Requirement: Acceso exclusivo de ADMINISTRADOR_EMPRESA a las acciones del CRUD
Las acciones de alta, edición, baja/reactivación y reset de contraseña SHALL estar disponibles únicamente cuando `authStore.user.rol === 'ADMINISTRADOR_EMPRESA'`, verificado en render-time antes de mostrar los controles — consistente con la regla global de verificar rol antes de renderizar acciones protegidas (CLAUDE.md). Dado que `/usuarios` ya está protegida por `RoleGuard requiredRoles={['ADMINISTRADOR_EMPRESA']}`, esta verificación es redundante por diseño (defensa en profundidad), no una ruta de acceso alternativa. `ADMINISTRADOR_SISTEMA` deja de tener acceso a esta página (ver `routing` modificado).

#### Scenario: Todas las acciones visibles para ADMINISTRADOR_EMPRESA
- **WHEN** `ADMINISTRADOR_EMPRESA` visualiza `/usuarios`
- **THEN** los botones de alta, editar, baja/reactivación y reset de contraseña son visibles para cada fila

#### Scenario: ADMINISTRADOR_SISTEMA ya no puede acceder a /usuarios
- **WHEN** un usuario con rol `ADMINISTRADOR_SISTEMA` navega a `/usuarios` por URL directa
- **THEN** es redirigido a `/no-autorizado`, sin ver ninguna acción del CRUD de usuarios
