## Context

`/usuarios` es hoy un placeholder (`ComingSoon`) sin CRUD real, con
`RoleGuard requiredRoles={['JEFE_CALIDAD_SYST', 'ALTA_DIRECCION']}`
(`src/router/index.tsx`) y el ítem correspondiente del sidebar
(`src/components/layout/Sidebar.tsx`, `key: 'users'`) con el mismo set de
roles. `features/users/` solo contiene el autoservicio de perfil
(`ProfilePage.tsx`, M6-S06: edición de datos propios y cambio de
contraseña propia contra `authFixtures` en memoria). No existe ningún
handler MSW, tipo, hook ni schema de administración de usuarios.

El modelo `User`/`MockUser` (`src/types/auth.types.ts`,
`src/mocks/fixtures/auth.fixtures.ts`) ya tiene todos los campos que este
CRUD necesita excepto `activo`. `avatarUrl` ya existe y ya es consumido
por `UserAvatar`/`TopNav` — no requiere cambio de schema, solo un
productor nuevo (el formulario de esta spec).

El patrón de referencia más cercano en el código es el CRUD administrativo
de Locales/Zonas (M6, `features/locations/`): store mutable exportado
consumido por handlers de otros dominios, mutations que invalidan
listado + detalle, y bloqueo de baja con `409` + mensaje descriptivo
propagado a un `toast.error`. Este CRUD de usuarios sigue el mismo
esqueleto donde aplica, con una diferencia clave: la baja de un usuario
**nunca se bloquea** por referencias existentes (RN-USR-001 exige
preservar integridad referencial vía soft delete, no impedir la baja).

## Goals / Non-Goals

**Goals:**
- CRUD completo de usuarios (alta, edición, baja/reactivación, reset de
  contraseña, carga de avatar) accesible solo para `ADMINISTRADOR_SISTEMA`.
- Bloqueo de login para usuarios `activo: false`, con mensaje explícito.
- Preservar integridad referencial: ningún usuario se elimina del store
  mock; ninguna referencia histórica (`reportadoPorId`, `responsableId`,
  etc.) se invalida al editar o dar de baja.
- Corregir el RBAC de `/usuarios` (router + sidebar) a
  `['ADMINISTRADOR_SISTEMA']` exclusivamente.

**Non-Goals:**
- Forzar cambio de contraseña en el próximo login tras un reset (backlog).
- Filtrar selectores existentes de usuarios (`reportadoPorId`,
  `auditorAsignadoId`, etc.) para excluir usuarios inactivos (backlog).
- Envío real de credenciales por correo (no hay backend de email).
- Auditoría de "quién editó a quién" (no solicitado).
- Persistencia de avatar/CRUD más allá de la sesión del navegador — mismo
  límite conocido que el resto del mock (`user-profile-change-password`).

## Decisions

### 1. `activo` es el único campo de estado (binario)
No se introduce un enum de estados (`SUSPENDIDO`, `PENDIENTE`, etc.).
Alternativa considerada: reusar un patrón de estado más rico como
`DocStatus`/`QEStatus`. Rechazada porque el PRD de Toño pide
explícitamente un booleano simple y no hay caso de uso para estados
intermedios en usuarios.

### 2. Store mutable de usuarios reexporta `authFixtures`, no lo duplica
Los handlers de usuarios (`users.handlers.ts`) y el handler de login
(`auth.handlers.ts`) SHALL operar sobre el mismo array mutable exportado
desde `auth.fixtures.ts` (patrón `getUsersStore()` / mutación in-place),
igual que `getIncidentsStore()` en otros dominios. Evita el bug de
"fixture estático vs. store mutable" ya visto en M4-S08/M6-S02: si login
y el CRUD de usuarios leyeran copias distintas, una baja hecha desde
`/usuarios` no bloquearía el login hasta un refresh completo del mock.

### 3. Contraseña temporal: alfanumérica de 8 caracteres, no `PASSWORD_RULES`
RN-USR-004/005 piden explícitamente "8 caracteres alfanuméricos"
generados aleatoriamente. Se decide NO reutilizar
`PASSWORD_RULES` (mínimo 8, mayúscula, minúscula, dígito, especial) del
flujo de reset-password de login (`resetPassword.schema.ts`) porque el
PRD es explícito sobre el formato y una contraseña puramente alfanumérica
es más fácil de comunicar verbalmente/por chat al usuario afectado. La
contraseña generada SÍ debe poder loguear (no pasa por `PASSWORD_RULES`
porque ese schema solo aplica al flujo de autoservicio, no a contraseñas
sembradas por el admin).

### 4. Avatar: conversión a base64 en el cliente, sin endpoint de upload
Un input de archivo (`accept=".jpg,.jpeg,.png"`) se lee con
`FileReader.readAsDataURL` en el formulario; el resultado (`data:image/...`)
se envía como parte del payload de alta/edición y se guarda tal cual en
`avatarUrl`. No se crea un endpoint MSW de upload de archivos separado —
consistente con que no hay backend de almacenamiento real (mismo
principio que "Transición a backend real" en CLAUDE.md: el backend
.NET real reemplazaría esto por una URL de storage real sin tocar
componentes).

### 5. Un solo formulario para alta y edición
`UserFormModal`/`UserForm` se reutiliza para ambos flujos (mismo patrón
que `location-form`), diferenciando alta/edición por la presencia de un
`userId` inicial. La contraseña inicial solo se pide/genera en alta; en
edición no hay campo de contraseña (el reset es una acción de fila
separada, RN-USR-004).

### 6. Baja de usuario nunca se bloquea (a diferencia de Locales/Zonas)
`useToggleUserActive()` NO replica el patrón `409` de
`useDesactivarLocal()`. RN-USR-001 es explícito: la baja es lógica y
siempre permitida, precisamente para preservar integridad referencial sin
fricción — no hay condición de bloqueo que evaluar.

## Risks / Trade-offs

- [Riesgo] Un admin da de baja a un usuario que sigue siendo
  `responsableInvestigacionId` de un QE en curso, sin que la UI se lo
  advierta → Mitigación: fuera de alcance explícito (§6 backlog del
  proposal); RN-USR-001 ya garantiza que la referencia no se rompe, solo
  que el usuario no podrá loguear para seguir trabajando en él — Toño
  decide filtrar selectores en una iteración futura si lo confirma
  necesario.
- [Riesgo] Contraseña temporal mostrada en un toast no persistente podría
  cerrarse antes de que el admin la copie → Mitigación: RN-USR-004 exige
  un modal de resultado persistente (no auto-dismiss) con botón "Copiar"
  (`navigator.clipboard.writeText`), además de un modal de confirmación
  previo a ejecutar el reset para evitar resets accidentales. RN-USR-005
  reutiliza el mismo modal de resultado para la contraseña temporal
  generada al dar de alta un usuario (CA-USR-09), en vez del toast
  original — mismo componente para evitar duplicar la mitigación.
- [Riesgo] Email duplicado entre alta de usuario nuevo y un usuario dado
  de baja (soft-deleted) → Mitigación: la validación de unicidad de email
  (RN-USR-005) SHALL considerar TODOS los usuarios del store,
  independientemente de `activo`, para evitar colisiones de login futuras
  si el usuario se reactiva.
- [Riesgo] Recarga del mock pierde avatares/altas — mismo límite conocido
  documentado en `user-profile-change-password`; se documenta igual aquí,
  no se resuelve (fuera de alcance, requiere backend real).

## Migration Plan

1. Extender `User`/`MockUser` con `activo` (default `true` en fixtures
   existentes) — cambio aditivo, no rompe consumidores actuales.
2. Agregar bloqueo de login para `activo: false` en `auth.handlers.ts`.
3. Construir tipos, schemas, API client, hooks y handlers MSW de usuarios.
4. Construir `UsersListPage` y `UserFormModal`, montados en
   `/usuarios` reemplazando `<ComingSoon label="Usuarios y Roles" />`.
5. Como último paso, cambiar el `RoleGuard` de `/usuarios` (router) y el
   `roles` del ítem `users` en `Sidebar.tsx` a
   `['ADMINISTRADOR_SISTEMA']` — se deja al final para no bloquear el
   desarrollo/QA manual de los pasos 3-4 con el rol actual mientras se
   construye.
6. No hay rollback especial: es un módulo nuevo aislado en MSW; revertir
   es revertir el commit/PR.

## Open Questions

- Ninguna bloqueante. Namespace i18n de las nuevas claves (`users` propio
  vs. reutilizar `common`) queda a criterio de implementación en tasks.md,
  siguiendo el namespace `users` ya existente si aplica en `es-PE.json`/
  `en-US.json`, o creándolo si no existe.
