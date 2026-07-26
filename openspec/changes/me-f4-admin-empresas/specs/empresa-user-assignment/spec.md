## ADDED Requirements

### Requirement: Pantalla de asignación lista las UsuarioEmpresa de una empresa
`src/features/empresas/pages/EmpresaUsuariosPage.tsx` SHALL renderizarse en la ruta `/admin/empresas/:id/usuarios`, mostrando la razón social de la empresa (`:id`) como título y una tabla con las filas `UsuarioEmpresa` de esa empresa: nombre y apellido del usuario, email, rol, estado (activo/inactivo) y fecha de asignación. La página SHALL responder con `NotFoundPage` (o redirigir al listado) si `:id` no corresponde a ninguna empresa existente.

#### Scenario: Listado muestra las asignaciones de la empresa, activas e inactivas
- **WHEN** `SUPERADMIN` navega a `/admin/empresas/empresa-001/usuarios`
- **THEN** la tabla muestra todos los usuarios asignados a `empresa-001`, incluidos los que tienen `estado: 'INACTIVO'`

#### Scenario: Id de empresa inexistente muestra estado de no encontrado
- **WHEN** `SUPERADMIN` navega a `/admin/empresas/empresa-inexistente/usuarios`
- **THEN** se muestra un estado de "no encontrado", no un listado vacío indistinguible de una empresa real sin usuarios

### Requirement: Asignar un usuario existente busca por email y requiere seleccionar un rol
La acción "Asignar usuario" SHALL abrir un modal con un campo de búsqueda de usuario existente (por email o nombre, reutilizando `getUsersStore()` — nunca crea un `Usuario` nuevo, ver límite conocido del proposal) y un selector de `rol` (`enum` de `UserRole` excluyendo `SUPERADMIN`, ver `empresa-admin-schemas`). El modal SHALL indicar explícitamente si el usuario seleccionado ya tiene una asignación existente (activa o inactiva) hacia esta empresa, antes de confirmar.

#### Scenario: Asignar un usuario sin asignación previa a esta empresa
- **WHEN** `SUPERADMIN` busca `user-supervisor-001` (sin asignación previa a `empresa-002`), selecciona rol `JEFE_CALIDAD_SYST` y confirma
- **THEN** aparece una fila nueva en la tabla con `estado: 'ACTIVO'` y el rol elegido

#### Scenario: Asignar un usuario con una asignación inactiva existente la reactiva
- **WHEN** `SUPERADMIN` busca un usuario que ya tiene una fila `INACTIVO` hacia esta empresa
- **THEN** el modal indica explícitamente "Este usuario ya tuvo acceso a esta empresa (inactivo) — se reactivará con el rol elegido" antes de confirmar

#### Scenario: SUPERADMIN no aparece como opción de rol en el selector
- **WHEN** `SUPERADMIN` abre el selector de rol del modal de asignación
- **THEN** `SUPERADMIN` no está entre las opciones disponibles

### Requirement: Desactivar una asignación requiere confirmación
La acción "Desactivar" por fila SHALL abrir un modal de confirmación mostrando el nombre del usuario y la empresa antes de ejecutar el cambio de `estado` a `INACTIVO`.

#### Scenario: Desactivar pide confirmación antes de ejecutar
- **WHEN** `SUPERADMIN` hace click en "Desactivar" sobre una fila con `estado: 'ACTIVO'`
- **THEN** se abre un modal de confirmación con el nombre del usuario, y el cambio NO se ejecuta hasta confirmar

#### Scenario: Confirmar desactiva solo esa fila
- **WHEN** `SUPERADMIN` confirma la desactivación de la fila de `user-supervisor-001` en `empresa-002`
- **THEN** esa fila pasa a `estado: 'INACTIVO'`; cualquier otra fila `UsuarioEmpresa` del mismo usuario en otras empresas no se modifica
