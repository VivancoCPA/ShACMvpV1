## Why

`cutover-auth`, `cutover-catalogos`, `cutover-incidentes`, `cutover-documentos`, `cutover-no-conformidades` y `cutover-quality-events` ya verificaron y cerraron los primeros seis módulos del roadmap contra el backend .NET real (los dos últimos siguen sin archivar, pendientes de que Toño decida cuándo). Usuarios (M6) es el séptimo. La investigación previa (leyendo el código real de `Features/Users/**` y `src/features/users/**` + `src/api/endpoints/users.api.ts`) no encontró ningún mismatch de contrato bloqueante — es un módulo chico (5 endpoints backend, un componente de lista y uno de formulario) y el contrato coincide ruta por ruta y campo por campo, incluida la separación correcta entre `ShacUser` (global) y `UsuarioEmpresa.Rol` (por empresa) que el propio backend ya documenta como corrección de un bug conocido del mock.

## What Changes

- Apuntar `shc-controldoc` en desarrollo (`.env.development`, `VITE_ENABLE_MSW=false`) al backend .NET real y verificar: listar usuarios (con filtros `rol`/`activo`), crear usuario (incluida validación de avatar server-side y el flujo de contraseña temporal mostrada en `TemporaryPasswordModal`), editar usuario (nombre/apellido/email/rol/área/avatar — confirmando que cambiar el rol en una empresa no afecta el rol del mismo usuario en otra empresa a la que también pertenece), dar de baja/reactivar (`toggle-active`, sin validación de bloqueo por diseño), resetear contraseña — sin tocar `.env.production`.
- Confirmar por lectura de código (ya verificado en esta sesión, no solo heredado del handoff) que `/usuarios` en el frontend SÍ tiene guard de ruta (`RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.usersAdmin}` = `['ADMINISTRADOR_EMPRESA']`, `router/routeAccess.ts:51,85`) — el punto que el handoff de Toño marcaba como "a confirmar" ya no es una pregunta abierta, es un hecho verificado en el código antes de proponer este change (ver `design.md`).
- Documentar como hallazgo informativo (no bloqueante, no se corrige en este change) que la excepción `SUPERADMIN` de `GET /api/users` (decisión de backend ya confirmada por Toño en `be-crud-gestion-usuarios` D3/D9/D10, "ve todos los usuarios del sistema") no tiene ningún punto de entrada en el frontend: la ruta `/usuarios` solo admite `ADMINISTRADOR_EMPRESA`, y la página que sí es accesible para `SUPERADMIN` (`EmpresaUsuariosPage` en `/admin/empresas/:id/usuarios`) consume un endpoint distinto (`GET /api/empresas/:id/usuarios`, ya cutover-eado en `cutover-catalogos`), no `GET /api/users`. Se verifica la excepción `SUPERADMIN` por API directa.
- No se anticipa ningún cambio de código en backend ni frontend para cerrar un mismatch de contrato — la investigación previa no encontró ninguno. Cualquier discrepancia real que aparezca durante la verificación se corrige con causa raíz confirmada (mismo criterio que los cutovers anteriores), no se asume de antemano.
- Como en los cutovers anteriores: inspeccionar los tests de Usuarios antes de asumir que dependen de MSW (`users.handlers.test.ts` ya se confirmó, por lectura, que ejercita los handlers MSW mismos vía `setupServer` — mismo patrón no-migrable que `cutover-no-conformidades`/`cutover-incidentes`).
- Al cerrar: revertir `.env.development` a `VITE_ENABLE_MSW=true` (Dashboard y el resto de módulos transversales siguen dependiendo de MSW hasta que se decida cutover-earlos o se apague MSW globalmente).

## Capabilities

### New Capabilities

- `frontend-usuarios-cutover-verification`: escenarios de verificación manual/API para Usuarios contra el backend .NET real + Postgres real, sin MSW — listar con filtros, crear (con avatar y contraseña temporal), editar (incluida la independencia de `Rol` entre empresas), dar de baja/reactivar, resetear contraseña, el conflicto de email en sus dos variantes, y la excepción `SUPERADMIN` de `GET /api/users`. Equivalente de Usuarios a `frontend-no-conformidades-cutover-verification`.

### Modified Capabilities

(Ninguna — no se detectó ningún requirement de contrato de `Features/Users/**` que necesite cambiar; el contrato ya coincide.)

## Impact

- **Afectado (frontend)**: `shc-controldoc/.env.development` (ventana de verificación), tests de Usuarios que resulten depender de MSW tras inspección.
- **Afectado (backend)**: ninguno anticipado — a confirmar durante la verificación.
- **No afectado**: `users.api.ts`, `createUser.schema.ts`/`updateUser.schema.ts`/`avatarFile.schema.ts`, handlers MSW de Usuarios (se mantienen intactos para módulos aún no cutover-eados), el resto de `features/users/**`, `Features/Empresas/*` (`AsignarUsuarioEmpresa`, `ActualizarAsignacion`, `ListarUsuariosEmpresa`, `ResetPin`, `SetPin` — ya cutover-eados en `cutover-catalogos`).
- **Pendiente explícito, no se resuelve en este change**: no hay ninguna UI que consuma la rama `SUPERADMIN` de `GET /api/users` — se documenta como hallazgo informativo; construir esa UI (si algún día hace falta un panel global cross-empresa) es trabajo de producto nuevo, fuera de alcance salvo decisión explícita del usuario.
- **Fuera de alcance**: Dashboard (M5) — único módulo de dominio restante del roadmap original, más cualquier capa transversal que dependa de MSW globalmente hasta que se decida apagarlo por completo.
