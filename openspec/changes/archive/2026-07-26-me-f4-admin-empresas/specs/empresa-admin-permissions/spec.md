## ADDED Requirements

### Requirement: Solo SUPERADMIN administra el CRUD de Empresa
`src/features/empresas/permissions/empresasPermissions.ts` SHALL exportar `puedeAdministrarEmpresas(usuario: User): boolean`, retornando `true` únicamente cuando `usuario.rol === 'SUPERADMIN'`. Toda acción de crear, editar, activar o desactivar una `Empresa` SHALL verificar este permiso en render-time antes de mostrar el control, siguiendo la regla global de CLAUDE.md.

#### Scenario: SUPERADMIN puede administrar empresas
- **WHEN** un usuario con rol `SUPERADMIN` visualiza `/admin/empresas`
- **THEN** los botones de crear, editar y activar/desactivar son visibles

#### Scenario: Ningún otro rol puede administrar empresas
- **WHEN** un usuario con rol `ADMINISTRADOR_SISTEMA`, `ADMINISTRADOR_EMPRESA`, o cualquier rol operativo intenta acceder a `/admin/empresas` por URL directa
- **THEN** es redirigido a `/no-autorizado`

### Requirement: Solo SUPERADMIN asigna o desactiva usuarios entre empresas (RN-EMP-006)
`src/features/empresas/permissions/empresasPermissions.ts` SHALL exportar `puedeAdministrarUsuariosEntreEmpresas(usuario: User): boolean`, retornando `true` únicamente cuando `usuario.rol === 'SUPERADMIN'`. `ADMINISTRADOR_EMPRESA` SHALL poder gestionar los usuarios ya asignados a su propia empresa activa (crear/editar/desactivar `Usuario`, ver `user-management-list-view` modificado) pero SHALL NUNCA poder crear, editar el rol de, ni desactivar una fila `UsuarioEmpresa` de una empresa distinta a la suya, ni asignar un usuario existente a una empresa adicional — esas dos operaciones son exclusivas de `SUPERADMIN`.

#### Scenario: SUPERADMIN asigna un usuario existente a una empresa adicional
- **WHEN** `SUPERADMIN` asigna `user-supervisor-001` (ya asignado a `empresa-001`) también a `empresa-002` con rol `JEFE_CALIDAD_SYST`
- **THEN** se crea una nueva fila `UsuarioEmpresa` (`usuarioId: 'user-supervisor-001', empresaId: 'empresa-002', rol: 'JEFE_CALIDAD_SYST', estado: 'ACTIVO'`) sin alterar su fila existente en `empresa-001`

#### Scenario: ADMINISTRADOR_EMPRESA no puede acceder a la pantalla de asignación
- **WHEN** un usuario con rol `ADMINISTRADOR_EMPRESA` navega a `/admin/empresas/:id/usuarios` por URL directa
- **THEN** es redirigido a `/no-autorizado`

### Requirement: Desactivar una Empresa desactiva en cascada sus asignaciones UsuarioEmpresa (RN-EMP-005)
Al pasar `Empresa.estado` a `'INACTIVA'`, el sistema SHALL poner `estado: 'INACTIVO'` en toda fila `UsuarioEmpresa` cuyo `empresaId` corresponda a esa empresa, sin afectar las filas `UsuarioEmpresa` de esos mismos usuarios en otras empresas. Reactivar la empresa (`estado: 'ACTIVA'`) SHALL NO reactivar automáticamente ninguna fila `UsuarioEmpresa` — cada una se reactiva manualmente desde la pantalla de asignación si corresponde.

#### Scenario: Desactivar una empresa revoca el acceso de sus usuarios exclusivos
- **WHEN** `SUPERADMIN` desactiva `empresa-002`, y `user-operario-101` solo tiene una fila `UsuarioEmpresa` activa (hacia `empresa-002`)
- **THEN** esa fila pasa a `estado: 'INACTIVO'`, y `user-operario-101` ya no puede iniciar sesión (mismo criterio de `empresa-session`: "El usuario no tiene ninguna empresa asignada")

#### Scenario: Desactivar una empresa no afecta el acceso de un usuario con otra empresa activa
- **WHEN** `SUPERADMIN` desactiva `empresa-002`, y `user-supervisor-001` tiene además una fila `UsuarioEmpresa` activa hacia `empresa-001`
- **THEN** `user-supervisor-001` conserva acceso normal a `empresa-001`; solo su fila hacia `empresa-002` pasa a `INACTIVO`

#### Scenario: Reactivar una empresa no restaura automáticamente los accesos revocados
- **WHEN** `SUPERADMIN` reactiva `empresa-002` (`estado: 'ACTIVA'`) después de haberla desactivado
- **THEN** las filas `UsuarioEmpresa` de esa empresa permanecen en `estado: 'INACTIVO'` hasta que se reactivan individualmente desde la pantalla de asignación
