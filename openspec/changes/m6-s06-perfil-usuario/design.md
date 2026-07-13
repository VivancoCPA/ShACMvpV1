## Context

`features/users/` (M6) existe hoy solo como carpeta vacía (`.gitkeep`) — M6 aún no tiene ningún artefacto construido. Esta spec (M6-S06) es la primera pieza real de ese módulo, y es intencionalmente pequeña: una vista de cuenta personal, no gestión de usuarios (eso queda para specs futuras de M6 bajo `ADMINISTRADOR_SISTEMA`).

Piezas existentes que esta spec reutiliza directamente:
- `TopNav.tsx` ya tiene un botón "Mi perfil" (`t('myProfile')`, namespace `nav`) en el dropdown de avatar, pero hoy solo cierra el dropdown (`onClick={() => setDropdownOpen(false)}`) sin navegar a ningún lado.
- `UserAvatar` ya soporta tamaño `lg` (`w-12 h-12`).
- `ROLE_BG_CLASSES` (`components/ui/roleColors.ts`) ya define el color semántico por rol usado en TopNav — se reutiliza igual en `/perfil`.
- `resetPassword.schema.ts` ya define `PASSWORD_RULES` y el validador Zod de fortaleza de contraseña (mayúscula, minúscula, dígito, especial, mínimo 8) con mensajes en namespace `auth:validation.*` — el nuevo schema de cambio de contraseña reutiliza el mismo `passwordField` en vez de duplicar reglas.
- `auth.fixtures.ts` (`MockUser[]`) incorpora `createdAt` (obligatorio, semilla fija por usuario) y `lastLogin` (opcional, actualizado por el handler de login en cada inicio de sesión exitoso) — la fila de "fecha de creación / último acceso" del proposal ya no se omite (ver spec actualizada `user-profile-view`).
- El patrón de ruta dev-only (`/dev/semaforo-preview`, hijo directo de `AppShell`, sin `RoleGuard requiredRoles`) es el precedente ya documentado en `CLAUDE.md` para rutas autenticadas sin restricción de rol — se reutiliza igual para `/perfil`, que tampoco es un módulo de dominio (M1-M5).

## Goals / Non-Goals

**Goals:**
- Página `/perfil` accesible por los 7 roles vía sesión autenticada, sin entrada en `Sidebar.tsx`.
- Sección de solo lectura con avatar grande, nombre, email, badge de rol, área, y `areasAsignadas` (solo SUPERVISOR).
- Formulario de cambio de contraseña propia con validación RHF + Zod, mutación mock que actualiza `authFixtures` en memoria (sin persistencia real).
- Error claro y sin mutación cuando la contraseña actual es incorrecta.

**Non-Goals:**
- PIN de firma electrónica (RN-DOC-004) — no se toca.
- Edición de rol, área o `areasAsignadas` propias.
- Persistencia real de la nueva contraseña más allá de la sesión de navegador actual (limitación conocida del entorno mock).

## Decisions

**Ubicación de la página**: `src/features/users/pages/ProfilePage.tsx`. Es la primera pieza de M6; vive en `features/users/` (el directorio ya reservado por la tabla de módulos de `CLAUDE.md`) en vez de crear un `features/profile/` nuevo, para no fragmentar el módulo antes de que exista.

**Namespace i18n**: nuevo namespace `users` (agregado al arreglo `ns` de `i18n/index.ts`) para los textos propios de `/perfil` (títulos de sección, labels de campos de solo lectura, botón de guardar). Los mensajes de validación de contraseña reutilizan las claves existentes `auth:validation.password*` (mismo `passwordField` de `resetPassword.schema.ts`), evitando duplicar strings de validación ya traducidos.

**Ruta y guard**: `/perfil` se agrega en `router/index.tsx` como hijo directo de `AppShell`, junto a `/dev/semaforo-preview`, sin envolver en un `<RoleGuard requiredRoles={...}>` adicional — hereda el `RoleGuard` raíz (solo exige `isAuthenticated`). Alternativa descartada: agregar `requiredRoles` con los 7 roles explícitos — es funcionalmente equivalente pero más verboso y no sigue el patrón ya establecido para páginas no-modulares.

**Entrada de navegación**: el botón "Mi perfil" en `TopNav.tsx` gana `onClick={() => { setDropdownOpen(false); navigate('/perfil') }}` usando `useNavigate` de `react-router-dom` (mismo patrón que otros componentes de navegación programática en el proyecto). No se agrega a `Sidebar.tsx` por decisión explícita del proposal.

**Cambio de contraseña — API y mutación mock**: nuevo endpoint `POST /api/auth/change-password` en `auth.handlers.ts`, body `{ currentPassword: string; newPassword: string }`. El handler busca al usuario autenticado por el `Authorization: Bearer` (extraer el `userId` del mismo patrón de token mock `mock-access-token-<userId>-<timestamp>` ya usado, vía regex análoga a `readRefreshUserId`), valida `currentPassword === user.password`, y si es correcto muta `user.password = newPassword` directamente sobre el objeto en `authFixtures` (el array es un módulo importado, mutable en memoria durante la sesión del dev server/browser). Si es incorrecto, responde `401` con mensaje descriptivo (`err('Contraseña actual incorrecta', 401)`, siguiendo el helper `err()` ya existente en el archivo). Alternativa descartada: exigir el `userId` en el body del request — es redundante e inseguro por convención (el backend real derivará el usuario del JWT, no de un campo de body enviado por el cliente); replicar esa forma en el mock mantiene el contrato realista de cara a la futura migración a backend real.

**Schema Zod**: `changePasswordSchema` en `src/features/auth/schemas/changePassword.schema.ts` (junto a `resetPassword.schema.ts`, mismo dominio de auth) — reutiliza el `passwordField` exportado/factorizado de `resetPassword.schema.ts` para `newPassword`/`confirmPassword`, y agrega `currentPassword: z.string().min(1, 'auth:validation.passwordRequired')`. Requiere extraer `passwordField` de `resetPassword.schema.ts` a un export reutilizable (hoy es una constante privada del módulo) para no duplicar las 4 reglas regex.

**Hook de mutación**: `useChangePassword()` en `features/auth/hooks/useChangePassword.ts`, mismo patrón que `useResetPassword` (TanStack `useMutation`, toast de éxito/error vía Sonner, sin `navigate` al terminar — el usuario se queda en `/perfil`). No invalida ninguna query (el cambio de contraseña no afecta datos cacheados de TanStack Query).

## Risks / Trade-offs

- [Riesgo] Mutar `authFixtures` directamente desde el handler MSW es un patrón nuevo (los demás handlers de auth solo leen el arreglo) → Mitigación: es el único mecanismo posible sin backend real y está explícitamente marcado como limitación de sesión en el proposal; no se filtra a componentes/hooks (Regla MSW #13 de `CLAUDE.md` se respeta — el mock vive solo en la capa de handlers).
- [Riesgo] Extraer `passwordField` de `resetPassword.schema.ts` a un export compartido podría romper su import actual si otro archivo depende de la forma actual del módulo → Mitigación: es un cambio aditivo (nuevo export), `resetPasswordSchema` sigue funcionando igual.
- [Trade-off] No hay endpoint de "último acceso" ni auditoría del cambio de contraseña en `AuditTrailEntry` — el cambio de contraseña propia no es una entidad de negocio (`QualityEvent`/`Documento`/`AccionCorrectiva`) por lo que la Regla #12 de audit trail de `CLAUDE.md` no aplica aquí; se documenta como decisión consciente, no omisión.

## Open Questions

Ninguna — alcance y exclusiones ya confirmados con Toño en la propuesta original (contraseña de login únicamente, PIN de firma fuera de alcance).
