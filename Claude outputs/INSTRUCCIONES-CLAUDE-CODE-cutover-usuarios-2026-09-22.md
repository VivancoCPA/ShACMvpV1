# Instrucciones para Claude Code — Cutover: Usuarios

Fecha: 2026-09-22
Autor: Cowork, tras investigar el código real (frontend `shc-controldoc`, backend `.NET`) vía
device bridge — funcionando normalmente en esta sesión (a diferencia de sesiones anteriores, sin
necesidad del fallback `device_list_dir`/`device_stage_files`, aunque igual fue el mecanismo usado
por cómo está armada esta sesión). Séptimo módulo del roadmap de cutover — Auth, Catálogos,
Incidentes, Documentos, No Conformidades y Quality Events ya quedaron cerrados y verificados
(`cutover-no-conformidades` y `cutover-quality-events` siguen sin archivar, pendientes de que
decidas cuándo).

Toño ya eligió seguir con Usuarios — **no le vuelvas a preguntar si conviene**. Al igual que No
Conformidades, **no encontré ningún mismatch de contrato bloqueante** — es un módulo chico (5
endpoints backend, un componente de lista y uno de formulario en el frontend) y viene prolijo.

## 1. El contrato coincide — confirmado ruta por ruta y campo por campo

Las 5 rutas de `Features/Users/` están registradas en `EndpointExtensions.cs` y coinciden 1:1 con
`src/api/endpoints/users.api.ts` (nota: a diferencia de otros módulos, las funciones de Usuarios
viven en `src/api/endpoints/users.api.ts`, no dentro de `features/users/`):

- `GET /api/users` (`rol`/`activo` como query params opcionales) ↔ `ListarUsuariosHandler` (Dapper,
  un solo JOIN a `usuarios_empresa` para resolver el rol efectivo por empresa activa, evitando
  N+1). Restringido a `ADMINISTRADOR_EMPRESA` + `SUPERADMIN` (única excepción del módulo — las
  otras 4 rutas son `ADMINISTRADOR_EMPRESA`-only), coincide con `canAdminister` del frontend
  (`UserList.tsx`, gateado por `authUser?.rol === 'ADMINISTRADOR_EMPRESA'` para mostrar los botones
  de acción — la lista en sí se carga para cualquier usuario autenticado que llegue a la página,
  algo a confirmar en la verificación por si hace falta un guard de ruta adicional, ver Sección 3).
- `POST /api/users` ↔ `CrearUsuarioCommand(Nombre, Apellido, Email, Rol?, AreaId?, AreaIds?, AvatarBase64?)`:
  coincide campo por campo con `createUserSchema` (`nombre`, `apellido`, `email`, `rol`, `areaId?`,
  `areaIds?`). Devuelve `CrearUsuarioResponse` aplanado (`UserDto` + `temporaryPassword` al mismo
  nivel) — coincide con lo que `useCreateUser`/`UserFormModal.tsx` esperan (`created.id`,
  `created.temporaryPassword`, leídos directo sin wrapper anidado).
- `PATCH /api/users/:id` ↔ `ActualizarUsuarioCommand` (todos los campos opcionales, edición
  parcial): coincide con `updateUserSchema`. Confirmé un detalle de diseño correcto y explícito en
  el propio código backend (`ActualizarUsuarioHandler.cs`): `Rol`, si viene, nunca toca `ShacUser`
  (la entidad global) — se escribe únicamente en la fila `UsuarioEmpresa` de la empresa activa del
  actor, con un comentario que documenta un bug ya conocido del mock (escribir el rol en el usuario
  global filtraba el cambio hacia todas las empresas del usuario). Nada que corregir acá — el
  backend ya lo hace bien.
- `PATCH /api/users/:id/toggle-active` ↔ `ToggleActivoUsuarioHandler`: sin body, coincide con
  `toggleUserActive(id)`. Confirmé que, a diferencia de Área/Local/Zona, no hay ninguna validación
  de bloqueo — dar de baja a un usuario siempre tiene éxito sin importar cuántos QE/NC/Incidentes/AC
  tenga asignados (comentario propio del código lo documenta como decisión de diseño, no un olvido).
- `POST /api/users/:id/reset-password` ↔ `ResetPasswordUsuarioHandler`: sin body, coincide con
  `resetUserPassword(id)`. Usa `RemovePasswordAsync`+`AddPasswordAsync` de Identity (evita el paso
  extra de un token de reset, decisión razonable para una acción admin-a-admin) — distinto del
  reset de PIN de firma (`Features/Empresas/ResetPin`), que resetea `PinHash`, no el password de
  login; son dos flujos separados y ninguno se confunde con el otro en el frontend.
- El cambio de contraseña propia (`ProfilePage.tsx`, sección "Cambiar contraseña") usa
  `useChangePassword`/`changePasswordSchema` de `features/auth/` — ya cutover-eado en `cutover-auth`,
  no requiere trabajo nuevo acá. Confirmé que `ProfilePage.tsx` no llama a ningún endpoint de
  Usuarios para esto.
- Validaciones espejadas correctamente en ambos lados: `SUPERADMIN` excluido como rol asignable
  (es un flag global `EsSuperadminMultiempresa`, nunca un rol de `UsuarioEmpresa`) tanto en
  `createUserSchema`/`updateUserSchema` (frontend) como en `CrearUsuarioValidator`/
  `ActualizarUsuarioValidator` (backend, `NotEqual(UserRole.SUPERADMIN)`); `SUPERVISOR` exige
  `areaId` + `areaIds` no vacío en ambos lados (zod `superRefine` ↔ `RuleFor(...).When(x => x.Rol == SUPERVISOR)`);
  el avatar (JPEG/PNG, máx. 2MB) se valida en el frontend (`avatarFile.schema.ts`) y **también** en
  el backend (`CrearUsuarioValidator.TieneMimeValido`/`NoExcedeTamanoMaximo`) — confirmé que el
  backend no confía ciegamente en la validación del formulario, con un comentario propio que lo
  llama "defensa en profundidad", mismo criterio que `PlanoValidator` de Locales.
- El manejo de conflicto de email (409) está bien pensado: `CrearUsuarioHandler` distingue
  explícitamente entre "el email ya existe en esta empresa" (409 simple) y "existe en otra empresa"
  (409 con mensaje que indica que la vía correcta es `AsignarUsuarioEmpresa`, ya cutover-eado en
  `cutover-catalogos`) — más una red de seguridad TOCTOU si el pre-check no atómico deja pasar un
  duplicado real hacia el insert de Identity. `ActualizarUsuarioHandler` verifica unicidad de email
  **antes** de aplicar cualquier otro cambio, para que un 409 no deje ningún campo a medio
  actualizar — coincide con lo que la spec exige.

## 2. Nada bloqueante — sin código muerto relevante tampoco

A diferencia de otros módulos, no encontré código muerto de contrato (schemas sin consumidor,
campos que viajan siempre vacíos, etc.) — el módulo es chico y cada pieza del frontend que revisé
(`UserList.tsx`, `UserFormModal.tsx`, `TemporaryPasswordModal.tsx`, `useUsers.ts`) tiene su
contraparte real en uso.

## 3. Único punto a confirmar durante la verificación (no es un mismatch, es una pregunta de alcance)

No verifiqué si existe algún guard de ruta que impida que un usuario sin rol `ADMINISTRADOR_EMPRESA`
(ej. un `OPERARIO`) llegue a cargar la página de lista de usuarios y dispare igual `GET /api/users`
— el backend rechazaría con 403 (`RequireRole`), así que no hay riesgo de fuga de datos, pero
confirmá en la verificación si la UI hoy oculta el enlace de navegación a "Usuarios" para roles sin
permiso (esperable que sí, dado el patrón ya usado en otros módulos con RBAC), o si un usuario sin
permiso ve una página vacía/con error en vez de no ver el enlace en absoluto. No es bloqueante para
el cutover — es una observación de UX a confirmar, no algo que yo haya visto roto.

## 4. Estrategia

1. Backend local (`dotnet run` + Postgres dev), `.env.development` local con MSW apagado mientras
   verificás — no toques `.env.production`.
2. Verificación funcional: listar usuarios (con filtros `rol`/`activo`), crear usuario (incluida la
   validación de avatar y el flujo de contraseña temporal — confirmá que `TemporaryPasswordModal`
   muestra la contraseña real devuelta por el backend), editar usuario (nombre/apellido/email/rol/
   área/avatar, incluida la verificación de que cambiar el rol de un usuario en una empresa no
   afecta su rol en otra empresa si el usuario tiene múltiples asignaciones — el escenario que el
   comentario de `ActualizarUsuarioHandler.cs` describe como bug ya conocido del mock), dar de
   baja/reactivar, resetear contraseña (confirmá el mensaje de ayuda que ya existe en la UI sobre
   qué hacer con la contraseña temporal). Confirmá también el 409 de email duplicado en ambas
   variantes (misma empresa vs. otra empresa).
3. No hace falta tocar ningún endpoint ni command del backend para este cutover — no encontré
   ningún mismatch de contrato que lo requiera. Si encontrás algo que yo no vi, documentalo con el
   mismo criterio de los cutovers anteriores (causa raíz, archivo + línea, Decision en `design.md`).
4. Revertí `.env.development` al terminar. No toques `.env.production`.

## 5. Ciclo OpenSpec

Sin hallazgos bloqueantes que documentar como Decision — si la verificación en el paso 2 revela
algo real, documentalo con causa raíz confirmada antes de corregirlo, mismo criterio que el resto de
la serie. La Sección 3 de este documento es, en el peor caso, un hallazgo informativo de UX, no un
bloqueante de contrato.
