## 1. Tipos base

- [x] 1.1 `src/types/auth.types.ts`: agregar `'ADMINISTRADOR_EMPRESA'` y `'SUPERADMIN'` a `UserRole`; agregar `esSuperadminMultiempresa?: boolean` a `User`.
- [x] 1.2 `src/mocks/fixtures/auth.fixtures.ts`: `MockUser` NO extiende `User` (interfaz duplicada) — se agregó `esSuperadminMultiempresa?: boolean` explícitamente.
- [x] 1.3 `tsc -p tsconfig.app.json --noEmit` — el compilador SOLO señala los `Record<UserRole, ...>` (2 en `roleColors.ts`, resueltos en sección 10); los `switch` sin `Record` NO producen error (proyecto sin `strict`/`noImplicitReturns`) — se completó vía auditoría manual (`grep` de `switch (rol|userRole...)`), no solo vía la lista de errores del compilador. Ver detalle en 10.1.

## 2. Stores mutables de Empresa/UsuarioEmpresa y fixtures de verificación

- [x] 2.1 `src/mocks/fixtures/empresas.fixtures.ts`: exponer `getEmpresasStore(): Empresa[]` y `getUsuarioEmpresaStore(): UsuarioEmpresa[]` (mismo patrón que `getUsersStore()` en `auth.fixtures.ts`), reemplazando el uso directo de `empresaFixtures`/`usuarioEmpresaFixtures` dentro del propio archivo.
- [x] 2.2 Actualizar `getEmpresasActivasForUsuario` y `getRolEfectivo` para leer de los stores mutables nuevos, no de las constantes originales.
- [x] 2.3 Agregar a `auth.fixtures.ts` un usuario de verificación con `esSuperadminMultiempresa: true` (sin ninguna fila `UsuarioEmpresa`, para probar el caso "cero asignaciones" del proposal) y credenciales de login utilizables en el selector de rol de `LoginPage` (modo dev/MSW).
- [x] 2.4 Agregar en `empresas.fixtures.ts` al menos un usuario `ADMINISTRADOR_EMPRESA` por empresa existente (`empresa-001`, `empresa-002`), con contraparte en `auth.fixtures.ts` (patrón de fixtures sincronizados).
- [x] 2.5 Confirmar que `user-admin-001` (`ADMINISTRADOR_SISTEMA` existente) sigue teniendo credenciales de verificación válidas para `/admin/locales`/`/admin/areas` tras perder acceso a `/usuarios` — sin cambios necesarios, `user-admin-001` no toca `/usuarios` en los fixtures.

## 3. Resolución de sesión (empresa-session)

- [x] 3.1 `src/mocks/handlers/auth.handlers.ts`: agregar la rama Superadmin al inicio de `resolveSession()` — si `user.esSuperadminMultiempresa`, retorna `{ user: { ...userWithoutPassword, rol: 'SUPERADMIN' }, empresaActivaId: null, empresasDisponibles: [] }` ignorando `empresaId`. También se agregó la misma rama directa en `POST /api/auth/refresh` (no pasa por `resolveSession`, tenía su propia lógica inline).
- [x] 3.2 `POST /api/auth/switch-empresa`: rechazar con `403` si la sesión resuelta es `SUPERADMIN`, antes de invocar `resolveSession` con el `empresaId` del body.
- [x] 3.3 `src/stores/authStore.ts`: ensanchar `SessionPayload.empresaActivaId` a `string | null`, y los tipos inline de respuesta de `refreshToken()`/`bootstrap()` igual.
- [x] 3.4 `tsc -p tsconfig.app.json --noEmit` (nota: `tsc --noEmit` en la raíz no compila nada útil — `tsconfig.json` raíz es solo `references`, hay que apuntar a `tsconfig.app.json` directo) — sin errores nuevos por `empresaActivaId` nullable. Se encontró y corrigió una regresión real no listada originalmente: `ROLE_BG_CLASSES`/`ROLE_AVATAR_BG` (`src/components/ui/roleColors.ts`) son `Record<UserRole, string>` y les faltaban las 2 claves nuevas — TS2739. El resto de errores de `tsc` en el árbol son preexistentes (mismatch de versión zod/react-hook-form, matchers jest-dom sin tipos, `documentForm.schema.ts` que excluye deliberadamente `ADMINISTRADOR_SISTEMA` de su propio `userRoleEnum` — no relacionado a este cambio) y no se tocan aquí.
- [ ] 3.5 Actualizar/agregar tests de `auth.handlers.test.ts` cubriendo: login de Superadmin (un paso, sin selección), login de Superadmin con asignaciones `UsuarioEmpresa` existentes (rol sigue siendo `SUPERADMIN`), `switch-empresa` rechazado para Superadmin, refresh/bootstrap de Superadmin.

## 4. Permisos y schemas del módulo de administración de empresas

- [x] 4.1 `src/features/empresas/permissions/empresasPermissions.ts` (nuevo): `puedeAdministrarEmpresas`, `puedeAdministrarUsuariosEntreEmpresas` (ver `empresa-admin-permissions`).
- [x] 4.2 `src/features/empresas/schemas/empresaForm.schema.ts` (nuevo): `empresaFormSchema` (razonSocial, ruc, estado, logoBase64). La conversión a base64 y `validateAvatarFile` se invocan desde `EmpresaFormModal` (UI), igual que el patrón de avatar de Usuario — el schema en sí solo valida el string resultante.
- [x] 4.3 `src/features/empresas/schemas/asignarUsuarioEmpresa.schema.ts` (nuevo): `asignarUsuarioEmpresaSchema` (usuarioId, rol excluyendo `SUPERADMIN`).
- [ ] 4.4 Tests unitarios de ambos schemas (RUC de 11 dígitos, unicidad no probada aquí — es server-side, ver sección 5).

## 5. Handlers MSW del módulo de administración de empresas

- [x] 5.1 `src/mocks/handlers/empresas.handlers.ts` (nuevo): `GET /api/empresas`, `POST /api/empresas`, `PATCH /api/empresas/:id` (con cascada RN-EMP-005 inline).
- [x] 5.2 Mismo archivo: `GET /api/empresas/:id/usuarios`, `POST /api/empresas/:id/usuarios` (crea o reactiva), `PATCH /api/empresas/:id/usuarios/:usuarioId` (activar/desactivar puntual) — leyendo usuarios vía `getUsersStore()` (store cross-dominio, nunca el fixture estático).
- [x] 5.3 Registrar `empresasHandlers` en `src/mocks/handlers/index.ts`.
- [ ] 5.4 Tests de handlers cubriendo los escenarios de `empresa-admin-mocks`: alta, unicidad de RUC (409), cascada de desactivación, reactivación sin reactivar asignaciones, asignación nueva vs. reactivación de fila inactiva, rechazo por rol no-SUPERADMIN.

## 6. UI — CRUD de Empresa

- [x] 6.1 `src/features/empresas/components/EmpresaFormModal.tsx` (nuevo) + `LogoUploadField.tsx` con conversión a base64 (patrón `avatarBase64`, reutiliza `validateAvatarFile`) y previsualización.
- [x] 6.2 `src/features/empresas/components/EmpresaList.tsx` (nuevo): tabla con logo/placeholder, razón social, RUC, estado, fecha de alta; acciones de editar/activar/desactivar con permiso `puedeAdministrarEmpresas`; enlace a la pantalla de asignación por fila.
- [x] 6.3 `src/features/empresas/components/ConfirmModal.tsx` (nuevo, genérico y reutilizado también por la sección 7) con las advertencias de impacto especificadas en `empresa-list-view` — no se crearon dos componentes separados por decisión de simplicidad (mismo markup parametrizado).
- [x] 6.4 `src/features/empresas/pages/EmpresasAdminPage.tsx` (nuevo), siguiendo el patrón de `AreasAdminPage`.
- [x] 6.5 `src/features/empresas/hooks/useEmpresas.ts` (nuevo): `useEmpresas()`, `useCreateEmpresa()`, `useUpdateEmpresa()`, vía TanStack Query — nunca Axios directo en componentes.

## 7. UI — Asignación usuario↔empresa↔rol

- [x] 7.1 `src/features/empresas/pages/EmpresaUsuariosPage.tsx` (nuevo): listado de `UsuarioEmpresa` de la empresa `:id`, estado de "no encontrado" (`NotFoundPage`) si `:id` no existe.
- [x] 7.2 `src/features/empresas/components/AsignarUsuarioModal.tsx` (nuevo): búsqueda de usuario existente por email/nombre vía `SearchableSelect` + `useUsers()`, selector de rol (excluyendo `SUPERADMIN`), aviso de reactivación si ya existe una fila inactiva. **Gap descubierto en implementación:** `GET /api/users` (scoped por empresa desde 9.0) tenía que ganar una excepción explícita para `SUPERADMIN` — sin empresa activa, no puede buscar usuarios de ningún lado si el endpoint exige `empresaActivaId`; ahora `SUPERADMIN` ve todos los usuarios del sistema en ese único endpoint (coherente con su rol: es el único que administra usuarios entre empresas).
- [x] 7.3 Cubierto por `ConfirmModal.tsx` genérico de 6.3, reutilizado aquí para desactivar/reactivar una asignación puntual.
- [x] 7.4 `src/features/empresas/hooks/useUsuarioEmpresa.ts` (nuevo): `useUsuarioEmpresaPorEmpresa(empresaId)`, `useAsignarUsuarioEmpresa(empresaId)`, `useToggleUsuarioEmpresa(empresaId)`.

## 8. Routing y navegación

- [x] 8.1 `src/router/routeAccess.ts`: `ROUTE_ROLE_GROUPS.usersAdmin` pasa a `['ADMINISTRADOR_EMPRESA']`; nuevo grupo `areasAdmin: ['ADMINISTRADOR_SISTEMA']` para `/admin/areas` (separado de `usersAdmin`); nuevo grupo `empresasAdmin: ['SUPERADMIN']`; entradas nuevas en `ROUTE_ACCESS_TABLE` para `/admin/empresas` y `/admin/empresas/:id/usuarios`.
- [x] 8.2 `src/router/getDefaultRoute.ts`: `getDefaultRouteForRole('SUPERADMIN')` → `/admin/empresas`; `getDefaultRouteForRole('ADMINISTRADOR_EMPRESA')` → `/usuarios`; corregido `getDefaultRouteForRole('ADMINISTRADOR_SISTEMA')` → `/admin/locales` (drift confirmado y corregido).
- [x] 8.3 `src/router/index.tsx`: registradas `/admin/empresas` y `/admin/empresas/:id/usuarios` bajo `<RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.empresasAdmin}>`; `/admin/areas` movida a su propio `<RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.areasAdmin}>` separado del de `/usuarios`.
- [x] 8.4 `src/components/layout/Sidebar.tsx`: item `users` cambia `roles` a `['ADMINISTRADOR_EMPRESA']`; nuevo item `empresas` (`path: '/admin/empresas'`, ícono `Building2`, `roles: ['SUPERADMIN']`).
- [ ] 8.5 Test de `Sidebar.test.tsx`/`routeAccess` (si existen) actualizados a los nuevos roles esperados — pendiente, ver sección 13.

## 9. Gestión de usuarios existente (reasignación de permiso)

- [x] 9.0 **[Gap descubierto en implementación, fuera del alcance original]** `src/mocks/handlers/users.handlers.ts` no tenía ningún scoping por empresa. Corregido: `GET /api/users` filtra a usuarios con alguna fila `UsuarioEmpresa` en la empresa activa de la sesión; `POST /api/users` asigna `empresaId` desde la sesión del creador (ya no litera `'empresa-001'`); `PATCH .../:id`, `.../toggle-active` y `.../reset-password` usan el helper nuevo `requireUsuarioDeEmpresaActiva()` — 404 si el usuario objetivo no tiene fila `UsuarioEmpresa` en la empresa activa del actor; la sincronización de `rol` en `PATCH .../:id` solo toca la fila de esa empresa, no todas las del usuario. **Límite conocido, no resuelto aquí:** `User.activo` (usado por `toggle-active`/reset de contraseña) es un flag global de la entidad `Usuario`, no por-empresa — un `ADMINISTRADOR_EMPRESA` que desactiva/resetea a un usuario con asignaciones en más de una empresa afecta su acceso en todas ellas, no solo la propia. Redefinir esto (p. ej. activo por-`UsuarioEmpresa`) es un cambio de modelo de datos mayor, fuera de alcance de esta fase — documentado, no silenciado.
- [x] 9.1 `src/features/users/components/UserList.tsx:153`: `canAdminister` pasa de `authUser?.rol === 'ADMINISTRADOR_SISTEMA'` a `authUser?.rol === 'ADMINISTRADOR_EMPRESA'`. También se agregó `ADMINISTRADOR_EMPRESA` a `ROLE_VALUES` (filtro por rol de la lista).
- [x] 9.2 `src/features/users/schemas/createUser.schema.ts` y `updateUser.schema.ts`: el `userRoleEnum` gana `'ADMINISTRADOR_EMPRESA'`, sin agregar `'SUPERADMIN'`.
- [x] 9.3 `src/features/users/components/UserFormModal.tsx`: `ROLE_VALUES` gana `ADMINISTRADOR_EMPRESA` (nunca `SUPERADMIN`); `defaultValues.rol` guardado contra el caso `user.rol === 'SUPERADMIN'` (tipo, no debería ocurrir en la práctica ya que Superadmin no aparece en `/usuarios`).
- [ ] 9.4 Actualizar tests existentes de `UserList.test.tsx`/`UserFormModal.test.tsx`/schemas que asuman `ADMINISTRADOR_SISTEMA` como el rol administrador.

## 10. Auditoría de switches exhaustivos sobre UserRole (nota técnica M6-S01)

- [x] 10.1 Auditados todos los switches exhaustivos sobre `UserRole` en el árbol (`grep` de `switch (rol|userRole|...)` + inspección manual, ya que `tsc` sin `strict` NO detecta faltas de exhaustividad — confirmado empíricamente): `incidentPermissions.ts`, `ncPermissions.ts`, `qualityEventPermissions.ts` (2 switches: `getQualityEventPermissions` y `puedeExportarPDF`) — deny-all agregado para ambos roles nuevos. `documents/permissions.ts` switchea sobre `DocRole` (no `UserRole`), sin cambios necesarios — pero `DocumentListRow.tsx`'s `userRoleToDocRole()` sí switchea sobre `UserRole` y necesitaba los 2 casos nuevos (agregado, mapea a `'OPERARIO'` como el resto de roles de solo lectura/sin acceso). `dashboard.handlers.ts` switchea sobre `DashboardRol` (tipo propio de 6 valores, no `UserRole`) vía `Partial<Record<UserRole, DashboardRol>>` ya seguro con roles no mapeados — sin cambios.
- [ ] 10.2 Confirmar en el navegador que ni `ADMINISTRADOR_EMPRESA` ni `SUPERADMIN` pueden ver ni ejecutar ninguna acción de Documentos/Incidentes/NC/QE, aunque naveguen directo por URL.

## 11. i18n

- [x] 11.1 Namespace `empresas` agregado a `es-PE.json`/`en-US.json` (y registrado en `src/i18n/index.ts`, `ns: [...]`): labels de `EmpresasAdminPage`, `EmpresaFormModal`/`LogoUploadField` (incluidos mensajes de validación de `ruc`/`razonSocial`/logo), `EmpresaUsuariosPage`, `AsignarUsuarioModal`, modales de confirmación. Ambos JSON validados con `JSON.parse`.
- [x] 11.2 `nav` namespace: key `empresas` agregada. `users` se deja con el mismo label ("Usuarios"/"Users") — el texto no depende del rol que lo administra, no requería cambio de contenido.
- [x] 11.3 `auth` namespace: `roles.SUPERADMIN` y `roles.ADMINISTRADOR_EMPRESA` agregados (es-PE y en-US) para el badge de `TopNav`/`Sidebar`/`UserFormModal`.

## 12. Verificación manual end-to-end

- [ ] 12.1 Como `SUPERADMIN`: login en un solo paso, crear una empresa nueva, subirle un logo, confirmar que persiste en el CRUD (logo no visible aún en `TopNav`/`Login`, ver proposal).
- [x] 12.2 Verificado con Playwright headless contra el dev server: `admin.empresa@shac.pe` aterriza en `/usuarios`, la tabla muestra únicamente usuarios de `empresa-001` (confirmado ausentes `operario@ilo.pe`/"Jorge", usuarios de `empresa-002`); navegar a `/admin/empresas` redirige a `/no-autorizado`.
- [ ] 12.3 Como `SUPERADMIN`: asignar un usuario existente de `empresa-001` también a `empresa-002` con rol distinto; login de ese usuario expone el rol correcto en cada empresa.
- [ ] 12.4 Como `SUPERADMIN`: desactivar `empresa-002`; confirmar que un usuario exclusivo de esa empresa pierde acceso (no puede loguear) y que un usuario con acceso además a `empresa-001` conserva ese acceso.
- [x] 12.5 Verificado con Playwright: `admin@shac.pe` aterriza en `/admin/locales` (ya no en `/usuarios`), sidebar muestra solo Áreas y Locales; navegar a `/usuarios` redirige a `/no-autorizado`. (`/admin/areas` no se probó por click directo pero usa el mismo `RoleGuard` ya verificado en `/admin/locales`.)
- [ ] 12.6 Confirmar Dark Mode sin defectos visuales en las 3 pantallas nuevas (`EmpresasAdminPage`, `EmpresaFormModal`, `EmpresaUsuariosPage`).

## 13. Verificación final

- [ ] 13.1 `tsc --noEmit` limpio.
- [ ] 13.2 Suite de tests completa en verde.
- [ ] 13.3 Confirmar que `openspec/specs/empresa-types`/`empresa-usuario-types` (Fase 1, aún no sincronizadas) no quedan en conflicto con los tipos extendidos aquí — sincronizar Fase 1 antes o junto con el archivado de este cambio si sigue pendiente.
