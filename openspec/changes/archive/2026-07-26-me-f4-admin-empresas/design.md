## Context

Verificado en código (`shc-controldoc/src/`), no solo en el proposal:

- **`resolveSession()` es el único punto de resolución de sesión** (`src/mocks/handlers/auth.handlers.ts:59-85`), usado por los tres endpoints `POST /api/auth/login`, `POST /api/auth/refresh` y `POST /api/auth/switch-empresa`. Hoy asume siempre que el usuario tiene al menos una fila `UsuarioEmpresa` activa (`empresasDisponibles.length === 0` → error) y siempre devuelve un `empresaActivaId: string` no nulo. Es el único lugar que necesita la rama nueva para `esSuperadminMultiempresa`.
- **`SessionPayload.empresaActivaId` está tipado `string`, no `string | null`** (`src/stores/authStore.ts:28-33`) — tanto en el store como en las respuestas de los tres endpoints de arriba. Un Superadmin sin empresa activa requiere ensanchar este tipo a `string | null` en el store, en `SessionPayload`, y en los tipos de respuesta inline de `useLogin`/`useSwitchEmpresa`/`bootstrap()` (`authStore.ts:104-138`).
- **`mockSession.ts` ya es null-safe**: `persistActiveEmpresaId(id: string | null)` y `readActiveEmpresaId(): string | null` (`src/lib/mockSession.ts:39,47`) — nada que cambiar ahí; `null` ya es un valor válido persistido (se usa hoy en logout).
- **`TopNav` ya degrada correctamente sin empresa activa**: el bloque del selector de empresa (`src/components/layout/TopNav.tsx:87-132`) solo renderiza si `empresaActiva` (resultado de `empresasDisponibles.find(...)`) existe. Con `empresasDisponibles: []` para un Superadmin, el bloque completo no se renderiza — cero cambios necesarios en `TopNav` para este caso.
- **`RoleGuard` ya es agnóstico al mecanismo de resolución de rol** (`src/router/RoleGuard.tsx:17`): solo compara `requiredRoles.includes(user.rol)`. Agregar `'SUPERADMIN'` como valor válido de `user.rol` (aunque se resuelva desde un flag global y no desde `UsuarioEmpresa`) es suficiente para reutilizar `RoleGuard`/`ROUTE_ROLE_GROUPS`/`isRouteAllowedForRole` sin ningún guard nuevo.
- **`ADMINISTRADOR_SISTEMA` ya administra usuarios hoy, no solo Locales/Áreas**: `/usuarios` y `/admin/areas` comparten el mismo grupo `ROUTE_ROLE_GROUPS.usersAdmin = ['ADMINISTRADOR_SISTEMA']` (`src/router/routeAccess.ts:51,66-67,82-83`), y `UserList.tsx:153` define `canAdminister = authUser?.rol === 'ADMINISTRADOR_SISTEMA'`. Mover la gestión de usuarios a `ADMINISTRADOR_EMPRESA` exige: (a) separar `/admin/areas` del mismo grupo que `/usuarios` (hoy comparten uno), (b) cambiar el rol de `usersAdmin` a `['ADMINISTRADOR_EMPRESA']`, (c) actualizar `UserList.tsx:153` y el item `users` de `Sidebar.tsx:61-66`.
- **El flujo de creación de usuario ya no toca `empresaId` en ningún schema/tipo de cliente** — `createUser.schema.ts` y `userManagement.types.ts` no tienen campo `empresaId`; el `rol` elegido en el formulario se envía tal cual (`userRoleEnum` en `createUser.schema.ts:3-11`). Esto confirma que el handler MSW de creación de usuario ya resuelve la empresa desde la sesión del creador (Fase 3) — coherente con que `ADMINISTRADOR_EMPRESA` siga usando exactamente el mismo formulario/schema, solo con permiso distinto y el enum de `rol` ampliado.
- **Patrón de referencia para el CRUD de Empresa**: `AreasAdminPage` (`src/features/areas/pages/AreasAdminPage.tsx`) — lista + un solo modal de formulario reutilizado para crear/editar (`formArea: Area | null | undefined`, `undefined` = cerrado, `null` = crear, `Area` = editar). Se sigue este patrón para `EmpresasAdminPage`, no el de páginas separadas de Locales (`LocalNewPage`/`LocalEditPage`), porque `Empresa` no tiene una entidad hija anidada (`Zona`) que justifique navegación propia.
- **Patrón de referencia para el logo**: `avatarBase64` en `UserFormModal.tsx:40,102,124,177` + `avatarFile.schema.ts` (validación pura de `{ type, size }`, reusable en el handler MSW) — el archivo se convierte a data URI en el cliente y se envía como string en el body JSON. Se prefiere sobre el patrón `PlanoUploadField` de Locales (`File` crudo en `FormData`) porque el logo, como el avatar, es una imagen pequeña sin necesidad de multipart.
- **`empresa.types.ts` (Fase 1) ya define `Empresa`/`UsuarioEmpresa`** (`src/features/empresas/types/empresa.types.ts`) y `empresas.fixtures.ts` (Fase 1) ya expone `getEmpresasActivasForUsuario`/`getRolEfectivo` de solo lectura sobre arrays estáticos (`empresaFixtures`, `usuarioEmpresaFixtures`) — ningún handler de escritura existe todavía. Este cambio necesita convertir esos dos arrays en stores mutables con getters (`getEmpresasStore()`/`getUsuarioEmpresaStore()`), mismo patrón que `getUsersStore()` en `auth.fixtures.ts` y `getIncidentsStore()` citado en el contexto de specs — no un array estático importado directo.

## Goals / Non-Goals

**Goals:**
- Un usuario con `esSuperadminMultiempresa: true` inicia sesión sin paso de selección de empresa, con `rol: 'SUPERADMIN'` y `empresaActivaId: null`, sin importar cuántas filas `UsuarioEmpresa` tenga.
- `SUPERADMIN` puede crear/editar/activar/desactivar `Empresa`, y asignar/desactivar usuarios existentes en cualquier empresa vía `UsuarioEmpresa` (`/admin/empresas`, `/admin/empresas/:id/usuarios`).
- Desactivar una `Empresa` desactiva en cascada todas sus filas `UsuarioEmpresa` (RN-EMP-005); reactivarla no las reactiva automáticamente.
- `ADMINISTRADOR_EMPRESA` reemplaza a `ADMINISTRADOR_SISTEMA` como dueño de `/usuarios`, sin cambiar el comportamiento existente del módulo (mismo formulario, mismo schema, mismo scoping por empresa activa de Fase 3) más allá del rol requerido y el enum de `rol` ampliado.
- `ADMINISTRADOR_SISTEMA` conserva `/admin/locales` y `/admin/areas` sin cambios de comportamiento.
- Cero regresión en los flujos de login/refresh/switch-empresa para usuarios sin el flag (todo el código existente de `resolveSession` para el caso no-superadmin queda intacto).

**Non-Goals (explícitamente diferido):**
- Conectar `Empresa.logoUrl` a `TopNav`/`LoginPage` (ver proposal, "Notas de implementación").
- Crear un usuario nuevo desde la pantalla de asignación (solo usuarios existentes — límite conocido documentado en el proposal).
- Que un Superadmin también pueda "entrar" a una empresa como usuario operativo normal (RN-EMP-004 — cada empresa sigue hermética; Superadmin es puramente administrativo, igual que `ADMINISTRADOR_SISTEMA` hoy respecto a módulos operativos).
- Filtrar dashboards/reportes cross-empresa (Fase 5).
- Sincronizar `empresa-types`/`empresa-usuario-types`/`empresa-msw-fixtures` de Fase 1 a `openspec/specs/` — se asume hecho en paralelo o antes; este cambio extiende esos tipos donde ya viven en código.

## Decisions

### D1 — `esSuperadminMultiempresa` como flag en `User`, resuelto dentro de `resolveSession()`
`resolveSession(user, empresaId)` gana una rama al principio: si `user.esSuperadminMultiempresa === true`, devuelve inmediatamente `{ user: { ...userWithoutPassword, rol: 'SUPERADMIN' }, empresaActivaId: null, empresasDisponibles: [] }`, ignorando `empresaId` y sin consultar `getEmpresasActivasForUsuario`/`getRolEfectivo`. Se reutiliza la misma función (no una nueva `resolveSuperadminSession()`) porque los tres call sites (`login`, `refresh`, `switch-empresa`) ya pasan por ella — bifurcar fuera de la función obligaría a triplicar el chequeo del flag en cada handler.
Alternativa descartada: modelar Superadmin como una fila `UsuarioEmpresa` con `empresaId` sentinela (ver pregunta al usuario) — descartada explícitamente porque obligaría a todo el filtrado por empresa de Fase 3 (`RN-EMP-003`, guards `404` de D2/Fase 3) a reconocer y excluir ese valor mágico en cada handler de dominio, en vez de contener el caso especial en un único punto (`resolveSession`).

### D2 — `switch-empresa` rechaza a un Superadmin con 403
Como `empresasDisponibles` de un Superadmin es siempre `[]`, no hay "otra empresa" a la que cambiar. `POST /api/auth/switch-empresa` valida `user.esSuperadminMultiempresa` antes de tocar `resolveSession` y responde `err('Superadmin no cambia de empresa', 403)`. No debería alcanzarse desde la UI (el selector de `TopNav` no se renderiza sin `empresaActiva`), pero el endpoint queda defendido igual, mismo criterio que el resto de handlers ante estados que "no deberían ocurrir" (ver `switch-empresa` actual, líneas 177-181, que ya trata un caso análogo como defensivo).

### D3 — `SessionPayload.empresaActivaId` y los tipos de respuesta de `authStore.ts` pasan a `string | null`
Cambio de tipos en `authStore.ts:28-33` y en los tipos inline de `refreshToken()`/`bootstrap()` (líneas 86,105-111). `login()`/`switchEmpresa()`/`bootstrap()` pasan `empresaActivaId` tal cual a `persistActiveEmpresaId`, que ya acepta `string | null` — el único ajuste real es de tipos, no de lógica de persistencia.

### D4 — `ADMINISTRADOR_SISTEMA` y `ADMINISTRADOR_EMPRESA` quedan con permisos disjuntos, no un rol contiene al otro
`ROUTE_ROLE_GROUPS.usersAdmin` (hoy `['ADMINISTRADOR_SISTEMA']`, cubre `/usuarios` y `/admin/areas`) se separa en dos grupos: `usersAdmin: ['ADMINISTRADOR_EMPRESA']` (solo `/usuarios`) y `areasAdmin: ['ADMINISTRADOR_SISTEMA']` (solo `/admin/areas`). `locationsAdmin` no cambia. Se evaluó dar a `ADMINISTRADOR_SISTEMA` acceso también a `/usuarios` (unión de ambos) para no perder capacidad de un admin ya existente en los fixtures — se descarta porque el proposal pide explícitamente responsabilidades disjuntas ("uno administra el catálogo físico/organizacional de su empresa, el otro administra las cuentas de usuario") y mezclar ambas reintroduce la ambigüedad de nombre que motivó separar los roles.
Consecuencia directa: `user-admin-001` (único usuario `ADMINISTRADOR_SISTEMA` en `empresas.fixtures.ts:35`) deja de poder entrar a `/usuarios` tras este cambio — la task de fixtures debe agregar un usuario `ADMINISTRADOR_EMPRESA` nuevo por empresa para poder verificar `/usuarios`, y un usuario con `esSuperadminMultiempresa: true` para verificar `/admin/empresas`.

### D5 — `EmpresaFormModal`/`EmpresaList` siguen el patrón de Áreas, no el de Locales
Ver Context. Un solo modal reutilizado (`formEmpresa: Empresa | null | undefined`), sin páginas de creación/edición separadas.

### D6 — Logo como data URI (`logoBase64`), no `FormData`
Ver Context — mismo patrón que `avatarBase64`. `Empresa.logoUrl` (ya existe desde Fase 1 como string) pasa a poder contener un data URI generado en el cliente, reemplazando el placeholder estático `/mock/empresas/empresa-00X-logo.png` de los fixtures cuando se edita desde el CRUD.

### D7 — Cascada de desactivación (RN-EMP-005) vive en el handler de `PATCH /api/empresas/:id`, no en una regla de negocio pura separada
Al recibir `estado: 'INACTIVA'`, el handler itera `getUsuarioEmpresaStore()` y pone `estado: 'INACTIVO'` en cada fila con ese `empresaId`, en la misma mutación — mismo nivel de la pila donde Fase 3 ya resuelve invariantes cross-entidad (ver `localesBusinessRules.ts`, citado en el design de Fase 3, que recibe arrays ya filtrados en vez de que el handler delegue el filtrado). No se crea una función pura `desactivarEmpresaCascada()` separada porque la cascada es una single-pass mutation sobre un store ya mutable, sin lógica condicional adicional que justifique extraerla y testearla en aislamiento — a diferencia de `puedeDesactivarLocal`, que sí es una decisión (permitir/bloquear) y no una mutación mecánica.
Reactivar (`estado: 'ACTIVA'`) no toca `UsuarioEmpresa` — decisión explícita del proposal, evita restaurar accesos revocados por otro motivo.

### D8 — Sesión de verificación (asignación cross-empresa) reutiliza `getRolEfectivo`/`getEmpresasActivasForUsuario` sin cambios
Como `UsuarioEmpresa` pasa a tener un store mutable (ver Context, último punto), asignar/desactivar una fila desde `/admin/empresas/:id/usuarios` se refleja automáticamente en el próximo login/refresh/switch-empresa de ese usuario — sin ningún cambio en `resolveSession` más allá de D1, porque esas dos funciones ya leen el store en el momento de la llamada, no un snapshot cacheado.

## Risks / Trade-offs

- **[Riesgo]** Ensanchar `SessionPayload.empresaActivaId` a `string | null` es un cambio de tipo en una interfaz ya consumida por `useLogin`, `useSwitchEmpresa`, `bootstrap()` y cualquier test que construya un `SessionPayload` a mano (`authStore.test.ts` ya referencia `logoUrl`, ver grep previo). → **Mitigación:** `tsc --noEmit` después del cambio de tipos, antes de tocar ningún handler — cualquier call site que asuma `string` no nulo (ej. lo pasa directo a otra función que espera `string`) aparece como error de compilación, no como bug silencioso en runtime.
- **[Riesgo]** Mover `/usuarios` de `ADMINISTRADOR_SISTEMA` a `ADMINISTRADOR_EMPRESA` dentro de un enum `UserRole` con switches exhaustivos en varios dominios (`incidentPermissions.ts`, `ncPermissions.ts`, `qualityEventPermissions.ts`, `documents/permissions.ts`, nota técnica M6-S01 de CLAUDE.md) — agregar dos roles nuevos (`ADMINISTRADOR_EMPRESA`, `SUPERADMIN`) sin revisar cada switch puede dejar un caso implícito con acceso no intencional (p.ej. un `default` permisivo) a un módulo operativo, violando el principio ya establecido para `ADMINISTRADOR_SISTEMA` ("rol de sistema puro... NO tiene acceso a ningún módulo operativo"). → **Mitigación:** task explícita de auditar los 4 archivos de permisos citados y agregar el caso deny-all explícito para ambos roles nuevos en cada uno, igual que exige la nota técnica existente.
- **[Riesgo]** Ningún usuario mock tiene hoy `esSuperadminMultiempresa: true` ni `rol: 'ADMINISTRADOR_EMPRESA'` — sin agregarlos a `auth.fixtures.ts`/`empresas.fixtures.ts`, ninguno de los tres flujos de verificación del proposal es probable en el navegador (mismo patrón de gap ya documentado como "fixtures desincronizados" en el contexto de specs del proyecto). → **Mitigación:** task explícita de fixtures antes de cualquier verificación manual, no al final.
- **[Riesgo]** `getUsuarioEmpresaStore()` nuevo (mutable) puede colisionar con el patrón de lectura estática que ya usan `getEmpresasActivasForUsuario`/`getRolEfectivo` si no se actualizan para leer del store mutable en vez de la constante `usuarioEmpresaFixtures` importada — dejaría la cascada de desactivación (D7) y la asignación nueva (D8) invisibles para el login, porque el login seguiría leyendo el array original congelado en el momento del import. → **Mitigación:** ambas funciones se actualizan en la misma task que introduce el store mutable, verificado con un test que asigna una empresa nueva y hace login inmediatamente después (mismo request de verificación, sin reiniciar MSW).

## Migration Plan

No hay backend real — aplicar en este orden, cada paso verificado antes del siguiente:
1. Tipos: `UserRole` gana `ADMINISTRADOR_EMPRESA`/`SUPERADMIN`; `User` gana `esSuperadminMultiempresa?: boolean` (`auth.types.ts`); `MockUser` en `auth.fixtures.ts` hereda el campo. `tsc --noEmit`.
2. Stores mutables: `empresas.fixtures.ts` gana `getEmpresasStore()`/`getUsuarioEmpresaStore()`; `getEmpresasActivasForUsuario`/`getRolEfectivo` leen de los stores, no de las constantes (D8).
3. `resolveSession()` gana la rama Superadmin (D1); `authStore.ts` ensancha `SessionPayload.empresaActivaId` (D3); `switch-empresa` rechaza Superadmin (D2). `tsc --noEmit` + `auth.handlers.test.ts`.
4. Fixtures de verificación: usuario `esSuperadminMultiempresa: true` sin `UsuarioEmpresa` (o con alguna, para probar que igual se ignora), usuario `ADMINISTRADOR_EMPRESA` por empresa existente.
5. `empresa-admin-permissions`/`empresa-admin-schemas`/`empresa-admin-mocks`: handlers `GET/POST/PATCH /api/empresas` y `GET/POST/PATCH /api/empresas/:id/usuarios`, cascada RN-EMP-005 (D7).
6. `empresa-form`/`empresa-list-view`/`empresa-user-assignment`: UI, siguiendo D5/D6.
7. Routing/navegación: split `usersAdmin`/`areasAdmin` (D4), nuevo grupo `empresasAdmin`, `getDefaultRouteForRole('SUPERADMIN')`, `Sidebar` (nuevos items + rol del item `users`), `UserList.tsx:153`.
8. Auditoría de switches exhaustivos sobre `UserRole` (ver Risks) — agregar deny-all explícito para los dos roles nuevos en los 4 archivos de permisos citados.
9. Verificación manual end-to-end de los 4 escenarios del proposal.

Rollback: revertir el commit del paso en curso — igual que Fase 3, se aplica por paso numerado, no como cambio monolítico.

## Open Questions

Ninguna abierta — las dos decisiones de modelado con más de una alternativa razonable (modelo de sesión de Superadmin, y si `ADMINISTRADOR_EMPRESA` es un rol nuevo o una re-etiqueta de `ADMINISTRADOR_SISTEMA`) ya se resolvieron explícitamente con Toño antes de este documento (D1 y D4 respectivamente).
