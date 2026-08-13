# Spec: empresa-admin-types

## Purpose

Define the supporting types introduced for multi-tenant empresa administration: the two new `UserRole` values (`SUPERADMIN`, `ADMINISTRADOR_EMPRESA`) and the `User.esSuperadminMultiempresa` flag that is the sole source of truth for the synthetic `SUPERADMIN` role, independent of any `UsuarioEmpresa` row.

---

## Requirements

### Requirement: `UserRole` gana `ADMINISTRADOR_EMPRESA` y `SUPERADMIN`
`UserRole` (`src/types/auth.types.ts`) SHALL ganar dos valores nuevos: `'ADMINISTRADOR_EMPRESA'` (rol normal, vive en `UsuarioEmpresa` como cualquier otro rol — administra usuarios dentro de su propia empresa activa) y `'SUPERADMIN'` (rol sintético, nunca almacenado en una fila `UsuarioEmpresa` — se resuelve exclusivamente desde `User.esSuperadminMultiempresa`, ver siguiente requirement). Todo switch exhaustivo existente sobre `UserRole` (`incidentPermissions.ts`, `ncPermissions.ts`, `qualityEventPermissions.ts`, `documents/permissions.ts` — nota técnica M6-S01 de CLAUDE.md) SHALL agregar explícitamente el caso deny-all para ambos roles nuevos en cada dominio operativo, igual que se exige para cualquier rol nuevo.

#### Scenario: ADMINISTRADOR_EMPRESA no tiene acceso a ningún módulo operativo
- **WHEN** un usuario con rol `ADMINISTRADOR_EMPRESA` intenta acceder a `/documentos`, `/incidents`, `/nonconformities`, `/quality-events` o `/dashboard`
- **THEN** es redirigido a `/no-autorizado`, mismo criterio ya aplicado a `ADMINISTRADOR_SISTEMA`

#### Scenario: SUPERADMIN no tiene acceso a ningún módulo operativo
- **WHEN** un usuario con rol `SUPERADMIN` intenta acceder a `/documentos`, `/incidents`, `/nonconformities`, `/quality-events` o `/dashboard`
- **THEN** es redirigido a `/no-autorizado`

### Requirement: `User.esSuperadminMultiempresa` es un flag global independiente de `UsuarioEmpresa`
`User` (`src/types/auth.types.ts`) SHALL ganar un campo opcional `esSuperadminMultiempresa?: boolean`. Este flag SHALL ser la única fuente de verdad para el rol `SUPERADMIN` — nunca se deriva de una fila `UsuarioEmpresa`, y su valor SHALL ser independiente de cuántas filas `UsuarioEmpresa` (activas o inactivas) tenga el usuario. Un usuario con este flag en `true` SHALL resolver su sesión con `rol: 'SUPERADMIN'` sin importar el contenido de sus asignaciones `UsuarioEmpresa`, si las tuviera.

#### Scenario: El flag es independiente de las asignaciones UsuarioEmpresa del usuario
- **WHEN** un usuario tiene `esSuperadminMultiempresa: true` y además una fila `UsuarioEmpresa` activa con `rol: 'OPERARIO'` en `empresa-001`
- **THEN** su sesión resuelve `rol: 'SUPERADMIN'`, nunca `'OPERARIO'`, y su empresa activa resuelta es `null` (ver `empresa-session`)

#### Scenario: Ausencia del flag no afecta la resolución de rol existente
- **WHEN** un usuario no tiene el campo `esSuperadminMultiempresa` (o es `false`/`undefined`)
- **THEN** su sesión se resuelve exactamente igual que antes de este cambio, exclusivamente vía `UsuarioEmpresa`
