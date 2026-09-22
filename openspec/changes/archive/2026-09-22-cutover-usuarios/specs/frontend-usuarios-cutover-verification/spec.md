## ADDED Requirements

### Requirement: El listado de Usuarios funciona de punta a punta contra el backend .NET real sin MSW

Con `VITE_ENABLE_MSW=false` y `VITE_API_BASE_URL` apuntando al backend .NET real corriendo localmente contra Postgres real, el sistema SHALL completar el listado de Usuarios de la empresa activa, con filtros `rol`/`activo`, con el mismo comportamiento observable que hoy contra MSW.

#### Scenario: Listado de Usuarios con filtros reales contra el backend real

- **WHEN** un `ADMINISTRADOR_EMPRESA` navega `/usuarios` y aplica los filtros con control de UI real (`rol`, `activo`)
- **THEN** `UserList` renderiza correctamente los usuarios reales de la empresa activa vía `GET /api/users`, resolviendo el rol efectivo por empresa mediante el JOIN a `usuarios_empresa`

#### Scenario: Acceso a `/usuarios` bloqueado para un rol no autorizado

- **WHEN** un usuario autenticado con un rol distinto de `ADMINISTRADOR_EMPRESA` navega a `/usuarios`
- **THEN** `RoleGuard` redirige a `/no-autorizado` antes de disparar `GET /api/users`, y una llamada directa al endpoint con ese rol responde 403

### Requirement: La creación de Usuario funciona contra el backend real, incluido avatar y contraseña temporal

El sistema SHALL completar la creación de un Usuario desde `UserFormModal` contra el backend .NET real, incluida la validación de avatar y la exhibición de la contraseña temporal generada.

#### Scenario: Creación de Usuario desde el formulario contra el backend real

- **WHEN** un `ADMINISTRADOR_EMPRESA` crea un Usuario completando nombre, apellido, email, rol y (si `rol === 'SUPERVISOR'`) área y áreas asignadas
- **THEN** el Usuario se crea contra el backend real con una fila `UsuarioEmpresa` en estado `ACTIVO` para la empresa activa del actor, y `TemporaryPasswordModal` muestra la contraseña temporal real devuelta por el backend (`CrearUsuarioResponse.temporaryPassword`)

#### Scenario: Validación de avatar espejada en frontend y backend

- **WHEN** se envía `POST /api/users` con un `avatarBase64` que no es JPEG/PNG o que excede 2MB
- **THEN** el backend responde 400 aunque el formulario ya lo hubiera bloqueado client-side, confirmando la defensa en profundidad

#### Scenario: Conflicto de email al crear — mismo email ya en la empresa activa

- **WHEN** se envía `POST /api/users` con un email que ya tiene una fila `UsuarioEmpresa` en la empresa activa del actor
- **THEN** el backend responde 409 con el mensaje simple de email duplicado

#### Scenario: Conflicto de email al crear — email existente en otra empresa

- **WHEN** se envía `POST /api/users` con un email que existe como `ShacUser` pero sin fila `UsuarioEmpresa` en la empresa activa del actor
- **THEN** el backend responde 409 con el mensaje que indica que la vía correcta es `AsignarUsuarioEmpresa` (SUPERADMIN-only)

### Requirement: La edición de Usuario funciona contra el backend real y respeta el rol por empresa

El sistema SHALL completar la edición parcial de un Usuario contra el backend .NET real, y el campo `rol`, cuando se envía, SHALL modificar únicamente la fila `UsuarioEmpresa` de la empresa activa del actor, sin afectar el rol del mismo usuario en otras empresas a las que pertenezca.

#### Scenario: Edición parcial de campos básicos contra el backend real

- **WHEN** un `ADMINISTRADOR_EMPRESA` edita nombre, apellido, área, áreas asignadas o avatar de un Usuario vía `useUpdateUser()`
- **THEN** el backend real persiste los campos enviados en `ShacUser`

#### Scenario: Cambiar el rol de un usuario en una empresa no afecta su rol en otra empresa

- **WHEN** un Usuario tiene fila `UsuarioEmpresa` en dos empresas distintas con roles distintos, y se envía `PATCH /api/users/:id { rol }` desde una de esas empresas activas
- **THEN** solo la fila `UsuarioEmpresa` de la empresa activa del actor cambia de rol; la fila `UsuarioEmpresa` de la otra empresa conserva su rol original

#### Scenario: Conflicto de email al editar

- **WHEN** se envía `PATCH /api/users/:id` con un email que ya pertenece a otro `ShacUser`
- **THEN** el backend responde 409 y no aplica ningún otro campo del payload

### Requirement: La baja/reactivación y el reseteo de contraseña de Usuario funcionan contra el backend real

El sistema SHALL completar la baja (desactivación) y reactivación de un Usuario, y el reseteo de su contraseña de login, contra el backend .NET real. La baja/reactivación SHALL tener éxito sin ninguna validación de bloqueo, independientemente de cuántos QE/NC/Incidentes/AC tenga asignados el usuario.

#### Scenario: Dar de baja y reactivar un Usuario sin validación de bloqueo

- **WHEN** un `ADMINISTRADOR_EMPRESA` invoca `PATCH /api/users/:id/toggle-active` dos veces sobre el mismo Usuario
- **THEN** ambas operaciones se completan (200) contra el backend real, alternando `activo` sin ninguna verificación de asignaciones pendientes

#### Scenario: Resetear la contraseña de un Usuario

- **WHEN** un `ADMINISTRADOR_EMPRESA` invoca `POST /api/users/:id/reset-password`
- **THEN** el backend real genera una nueva contraseña temporal (vía `RemovePasswordAsync`+`AddPasswordAsync` de Identity) y la devuelve en la respuesta, distinta del flujo de reseteo de PIN de firma (`Features/Empresas/ResetPin`)

### Requirement: La excepción `SUPERADMIN` de `GET /api/users` se verifica por API directa

Ningún punto de la UI invoca `GET /api/users` como `SUPERADMIN` (`/usuarios` solo admite `ADMINISTRADOR_EMPRESA`; la página accesible a `SUPERADMIN`, `EmpresaUsuariosPage`, consume `GET /api/empresas/:id/usuarios`, un endpoint distinto). El sistema SHALL completar el listado global de Usuarios para `SUPERADMIN` contra el backend real vía API directa, sin pasar por un punto de entrada de la UI. Construir esa UI queda fuera de alcance de este change (ver `design.md`).

#### Scenario: `SUPERADMIN` lista todos los usuarios del sistema sin filtro de empresa

- **WHEN** se envía `GET /api/users` autenticado como `SUPERADMIN`, sin empresa activa en la sesión
- **THEN** el backend responde con usuarios de todas las empresas, y cada usuario tiene `rol: null` (sin un rol efectivo bien definido fuera del contexto de una empresa)

### Requirement: MSW se revierte a activo al cerrar la verificación de Usuarios

El sistema SHALL dejar `shc-controldoc/.env.development` con `VITE_ENABLE_MSW=true` una vez completada la verificación de este change, para no bloquear el desarrollo diario de los módulos aún dependientes de MSW.

#### Scenario: Estado del entorno de desarrollo al cerrar el change

- **WHEN** se inspecciona `shc-controldoc/.env.development` después de cerrado este change
- **THEN** `VITE_ENABLE_MSW` es `true`, igual que antes de iniciar la verificación
