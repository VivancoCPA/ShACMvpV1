## Why

Con Fases 1–3 aplicadas (`me-f1-modelo-datos`, `me-f2-sesion-rbac-login`, `me-f3-scoping-modulos`), el sistema ya tiene el modelo `Empresa`/`UsuarioEmpresa`, la sesión resuelve el rol efectivo por empresa activa, y los módulos operativos filtran por empresa. Pero las dos empresas de prueba (`empresa-001`, `empresa-002`) solo existen porque se insertaron directo en `empresas.fixtures.ts` — no hay ninguna pantalla para dar de alta una empresa nueva ni para asignar usuarios a ella. Esta fase construye el módulo real de administración que reemplaza esa carga manual.

## What Changes

- **ADDED**: Flag global `User.esSuperadminMultiempresa: boolean`, independiente de `UsuarioEmpresa`. Un usuario con este flag en `true` resuelve su sesión con `rol: 'SUPERADMIN'` y `empresaActivaId: null` — nunca pasa por el paso de selección de empresa, sin importar cuántas filas `UsuarioEmpresa` tenga además. `'SUPERADMIN'` es el único rol que administra usuarios **entre** empresas (RN-EMP-006): crea/edita/desactiva empresas, ve el listado completo del sistema, y asigna usuarios existentes a cualquier empresa con cualquier rol.
- **ADDED**: `UserRole` gana `'ADMINISTRADOR_EMPRESA'` — rol normal por-empresa (vive en `UsuarioEmpresa`, como cualquier otro rol). Gestiona usuarios (crear/editar/desactivar/reset de contraseña) únicamente **dentro de su propia empresa activa**; no ve ni administra otras empresas.
- **MODIFIED**: `/usuarios` (gestión de usuarios) pasa de `ADMINISTRADOR_SISTEMA` a `ADMINISTRADOR_EMPRESA`. `ADMINISTRADOR_SISTEMA` conserva sin cambios su alcance actual (`/admin/locales`, `/admin/areas`) — los dos roles quedan con responsabilidades disjuntas: uno administra el catálogo físico/organizacional de su empresa, el otro administra las cuentas de usuario de su empresa.
- **ADDED**: CRUD de `Empresa` (`/admin/empresas`, solo `SUPERADMIN`) — razón social, RUC, estado (activa/inactiva) y logo (imagen, mismo patrón de conversión a base64 que `avatarUrl` de Usuario). Sigue el patrón lista+modal ya usado en Áreas (`AreasAdminPage`/`AreaFormModal`), no el de páginas separadas de Locales.
- **ADDED**: Pantalla de asignación usuario↔empresa↔rol (`/admin/empresas/:id/usuarios`, solo `SUPERADMIN`) — asigna un usuario **existente** a la empresa `:id` con un rol específico (crea o reactiva una fila `UsuarioEmpresa`), o desactiva una asignación existente. No crea usuarios nuevos (ver Notas de implementación — límite conocido para la primera alta de una empresa sin ningún usuario existente elegible).
- **MODIFIED**: Desactivación de empresa (RN-EMP-005) — al pasar una `Empresa` a `INACTIVA`, todas sus filas `UsuarioEmpresa` pasan a `estado: 'INACTIVO'` en cascada (el resto de asignaciones del usuario, en otras empresas, no se toca). Reactivar la empresa **no** reactiva automáticamente esas filas — el Superadmin las reactiva una por una si corresponde, para no restaurar por accidente un acceso que se había revocado por otro motivo.
- **MODIFIED**: Guards de ruta — nuevo grupo `empresasAdmin` (`SUPERADMIN`) para el CRUD de empresas y la pantalla de asignación; `usersAdmin` pasa a `['ADMINISTRADOR_EMPRESA']`; se separa un grupo `areasAdmin` (`['ADMINISTRADOR_SISTEMA']`) para `/admin/areas`, hoy agrupado junto con `/usuarios`. `getDefaultRouteForRole('SUPERADMIN')` → `/admin/empresas`.

Explícitamente **fuera de alcance de este cambio**:
- Reportes o dashboards consolidados entre empresas (RN-EMP-004 — cada empresa sigue siendo hermética; esto no cambia con este módulo).
- Crear un usuario nuevo desde la pantalla de asignación (solo asigna usuarios ya existentes — ver límite conocido arriba).
- Verificación de exports/reportes cross-empresa del módulo QE (Fase 5).

## Capabilities

### New Capabilities
- `empresa-admin-types`: `UserRole` gana `ADMINISTRADOR_EMPRESA` y `SUPERADMIN`; `User` gana `esSuperadminMultiempresa?: boolean`.
- `empresa-admin-permissions`: quién puede administrar empresas (`SUPERADMIN` exclusivo), quién puede asignar/desactivar `UsuarioEmpresa` entre empresas (`SUPERADMIN` exclusivo, RN-EMP-006), cascada de desactivación (RN-EMP-005).
- `empresa-admin-schemas`: schemas Zod para crear/editar `Empresa` (razón social, RUC, estado, logo) y para asignar `UsuarioEmpresa` (usuarioId, empresaId, rol).
- `empresa-admin-mocks`: handlers MSW `GET/POST/PATCH /api/empresas` y `GET/POST/PATCH /api/empresas/:id/usuarios`, incluida la cascada RN-EMP-005.
- `empresa-form`: `EmpresaFormModal` (crear/editar empresa, campo de logo).
- `empresa-list-view`: `EmpresasAdminPage` + `EmpresaList` (listado, activar/desactivar).
- `empresa-user-assignment`: pantalla de asignación usuario↔empresa↔rol (listar asignaciones de una empresa, asignar usuario existente, desactivar asignación).

### Modified Capabilities
- `empresa-session`: login/refresh/`switch-empresa` special-casean `esSuperadminMultiempresa` — sesión resuelta sin selección de empresa, `rol: 'SUPERADMIN'`, `empresaActivaId: null`.
- `routing`: nuevo grupo `empresasAdmin`; `usersAdmin` restringido a `ADMINISTRADOR_EMPRESA`; nuevo grupo `areasAdmin` separado de `usersAdmin`; `getDefaultRouteForRole` gana el caso `SUPERADMIN`.
- `app-navigation`: `Sidebar` gana entradas para el módulo de administración de empresas (solo `SUPERADMIN`); la entrada de `/usuarios` cambia de rol requerido.
- `user-management-list-view`: el check de administración (`canAdminister`) pasa de `ADMINISTRADOR_SISTEMA` a `ADMINISTRADOR_EMPRESA`.
- `user-management-schemas`: `createUserSchema`/`updateUserSchema` — el `rol` valida contra `UserRole` **excluyendo** `SUPERADMIN` (nunca asignable desde este flujo; `ADMINISTRADOR_EMPRESA` sí queda incluido, como cualquier otro rol nuevo).

## Impact

- **Specs afectadas**: nuevo módulo de administración de empresas (7 specs nuevas); RBAC/routing/navegación (3 specs modificadas); gestión de usuarios existente, reasignada de `ADMINISTRADOR_SISTEMA` a `ADMINISTRADOR_EMPRESA` (2 specs modificadas).
- **Código afectado**: `src/types/auth.types.ts` (UserRole, User), `src/features/empresas/` (types existentes de Fase 1, extendidos), nuevo `src/features/empresas/{permissions,schemas,components,pages}/`, `src/mocks/fixtures/empresas.fixtures.ts` (store mutable + cascada), `src/mocks/handlers/empresas.handlers.ts` (nuevo), `src/router/routeAccess.ts`, `src/router/getDefaultRoute.ts`, `src/router/index.tsx`, `src/components/layout/Sidebar.tsx`, `src/features/users/components/{UserList,UserFormModal}.tsx`, `src/features/users/schemas/{createUser,updateUser}.schema.ts`, `src/features/auth/` (login/switch-empresa, resolución de `esSuperadminMultiempresa`).
- **Riesgo**: medio-alto — además del módulo nuevo, reasigna un permiso que ya está en producción (`/usuarios` de `ADMINISTRADOR_SISTEMA` a `ADMINISTRADOR_EMPRESA`), lo que exige un usuario mock `ADMINISTRADOR_EMPRESA` de verificación y revisar todo switch exhaustivo sobre `UserRole` (nota técnica de M6-S01 en CLAUDE.md) para los dos roles nuevos.
- **Dependencias**: requiere Fases 1–3 aplicadas (cumplido en código, aunque sus specs `empresa-types`/`empresa-usuario-types`/`empresa-msw-fixtures` de Fase 1 aún no están sincronizadas a `openspec/specs/` — este cambio las extiende igual, asumiendo que se sincronizan antes o junto con esta fase).

## Notas de implementación

**Logo de empresa no se conecta a `TopNav` ni a `LoginPage` en esta fase** (decisión explícita): hoy `TopNav` solo muestra `razonSocial` en texto (nunca `logoUrl`), y `LoginPage` muestra a propósito arte genérico de SHAC en el panel izquierdo — nunca el logo de una empresa — porque la empresa del usuario no se conoce hasta después de enviar credenciales. Esta fase solo agrega el campo `logoUrl` al CRUD (reemplazando el placeholder estático de Fase 1 por uno editable); conectarlo visualmente a `TopNav`/`LoginPage` queda para una fase posterior si se decide.

**Límite conocido — alta de la primera cuenta de una empresa nueva:** la pantalla de asignación solo vincula usuarios **ya existentes** a una empresa. Si una empresa nueva no tiene ningún usuario existente elegible para ser su primer `ADMINISTRADOR_EMPRESA`, el Superadmin no tiene, en esta fase, una forma de crear ese usuario desde cero y asignarlo en un solo paso — tendría que existir ya (p.ej. por tener cuenta en otra empresa). Documentado como limitación conocida, no bloqueante para la verificación con las dos empresas mock existentes (que ya tienen usuarios).

Verificación clave a pedirle a Toño:
1. Como Superadmin, crear una empresa nueva, subirle un logo, y confirmar que el CRUD la persiste correctamente (el logo no se ve aún en `TopNav`/`Login` — ver nota arriba).
2. Como `ADMINISTRADOR_EMPRESA`, confirmar que gestiona usuarios solo de su propia empresa y que `/admin/empresas` le es inaccesible por URL directa.
3. Como Superadmin, asignar un usuario existente de `empresa-001` también a `empresa-002` con un rol distinto, y confirmar que su sesión en cada empresa expone el rol correcto (ver `empresa-session`).
4. Desactivar una empresa y confirmar que los usuarios asignados solo a ella pierden acceso (su fila `UsuarioEmpresa` pasa a `INACTIVO`), mientras que un usuario con acceso a otra empresa además de la desactivada conserva su acceso a esa otra.

Al terminar, dejar un resumen corto de: qué rutas/páginas se agregaron, y qué guards protegen cada una.
