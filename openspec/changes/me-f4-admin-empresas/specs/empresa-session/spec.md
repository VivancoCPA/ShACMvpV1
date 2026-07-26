## MODIFIED Requirements

### Requirement: `authStore` mantiene `empresaActivaId`, `empresasDisponibles` y rol efectivo
El sistema SHALL extender `authStore` con `empresaActivaId: string | null` y `empresasDisponibles: Empresa[]` (empresas con `estado === 'ACTIVO'` en `UsuarioEmpresa` para el usuario logueado). El `user.rol` expuesto por `authStore` SHALL ser siempre el rol efectivo resuelto para `empresaActivaId` (vía `UsuarioEmpresa`), nunca un valor fijo independiente de la empresa activa — **excepto** para un usuario con `esSuperadminMultiempresa: true`, cuyo `user.rol` SHALL ser siempre `'SUPERADMIN'` y cuyo `empresaActivaId` SHALL ser siempre `null`, sin importar sus asignaciones `UsuarioEmpresa` si las tuviera (ver `empresa-admin-types`). Ningún otro campo ni la forma de `User` cambia.

#### Scenario: Sesión expone el rol correspondiente a la empresa activa
- **WHEN** `user-supervisor-001` inicia sesión con `empresaActivaId = 'empresa-001'`
- **THEN** `authStore.user.rol` es `'SUPERVISOR'`

#### Scenario: El mismo usuario en otra empresa expone un rol distinto
- **WHEN** `user-supervisor-001` tiene `empresaActivaId = 'empresa-002'` en la sesión
- **THEN** `authStore.user.rol` es `'JEFE_CALIDAD_SYST'`

#### Scenario: `empresasDisponibles` refleja solo asignaciones activas
- **WHEN** `user-supervisor-001` inicia sesión
- **THEN** `authStore.empresasDisponibles` contiene `empresa-001` y `empresa-002`, en el orden en que existen sus filas `UsuarioEmpresa`

#### Scenario: Un Superadmin siempre resuelve rol SUPERADMIN y empresaActivaId null
- **WHEN** un usuario con `esSuperadminMultiempresa: true` inicia sesión
- **THEN** `authStore.user.rol` es `'SUPERADMIN'`, `authStore.empresaActivaId` es `null`, y `authStore.empresasDisponibles` es `[]`

### Requirement: Resolución de empresa activa en el login según cantidad de empresas asignadas
El sistema SHALL autoseleccionar la empresa activa sin fricción cuando el usuario tiene exactamente una fila `UsuarioEmpresa` con `estado === 'ACTIVO'`. Cuando el usuario tiene más de una, el sistema SHALL exigir una selección explícita antes de completar el login — nunca autoseleccionar silenciosamente entre varias, incluso si existe una empresa usada previamente. Si el usuario tiene `esSuperadminMultiempresa: true`, el sistema SHALL saltar por completo este paso de resolución (sin importar cuántas filas `UsuarioEmpresa` tenga) y completar el login en un solo paso con `rol: 'SUPERADMIN'` y `empresaActivaId: null` — cualquier `empresaId` recibido en el body SHALL ser ignorado.

#### Scenario: Usuario con una sola empresa asignada no ve paso de selección
- **WHEN** `user-operario-001` (asignado únicamente a `empresa-001`) envía credenciales válidas a `POST /api/auth/login` sin `empresaId`
- **THEN** la respuesta incluye `accessToken`, `user` y `empresaActivaId: 'empresa-001'` — login completo en un solo paso

#### Scenario: Usuario con más de una empresa asignada debe elegir explícitamente
- **WHEN** `user-supervisor-001` (asignado a `empresa-001` y `empresa-002`) envía credenciales válidas a `POST /api/auth/login` sin `empresaId`
- **THEN** la respuesta es `{ requiresEmpresaSelection: true, empresasDisponibles: [...] }`, sin `accessToken` ni `user`
- **THEN** el frontend NO invoca `authStore.login()` con esta respuesta

#### Scenario: Login se completa al reenviar con la empresa elegida
- **WHEN** `user-supervisor-001` reenvía las mismas credenciales a `POST /api/auth/login` con `empresaId: 'empresa-002'`
- **THEN** la respuesta incluye `accessToken`, `user.rol: 'JEFE_CALIDAD_SYST'` y `empresaActivaId: 'empresa-002'`

#### Scenario: `empresaId` de una empresa no asignada al usuario es rechazado
- **WHEN** se envía `POST /api/auth/login` con credenciales válidas y `empresaId: 'empresa-002'` para un usuario sin ninguna fila `UsuarioEmpresa` hacia `empresa-002`
- **THEN** el sistema responde con error (no autoriza el login para esa empresa)

#### Scenario: Un Superadmin nunca ve el paso de selección de empresa
- **WHEN** un usuario con `esSuperadminMultiempresa: true` (con o sin filas `UsuarioEmpresa`) envía credenciales válidas a `POST /api/auth/login` sin `empresaId`
- **THEN** la respuesta incluye `accessToken`, `user.rol: 'SUPERADMIN'` y `empresaActivaId: null` en un solo paso, nunca `{ requiresEmpresaSelection: true }`

### Requirement: Cambio de empresa activa sin cerrar sesión
El sistema SHALL exponer `POST /api/auth/switch-empresa` (autenticado) que, dado `{ empresaId }`, valida que el usuario de la sesión tenga una fila `UsuarioEmpresa` activa hacia esa empresa, resuelve el nuevo rol efectivo, y retorna una sesión completa nueva (`accessToken`, `user` con `rol` actualizado, `empresaActivaId`, `empresasDisponibles`). Tras un cambio exitoso, el sistema SHALL limpiar por completo el caché de TanStack Query (`queryClient.clear()`). Si la ruta actual del usuario no está permitida para el rol resuelto en la nueva empresa, el sistema SHALL redirigir a `getDefaultRouteForRole` de ese nuevo rol. Para una sesión `SUPERADMIN`, el sistema SHALL rechazar `POST /api/auth/switch-empresa` con `403` — un Superadmin no tiene empresa activa entre la cual cambiar.

#### Scenario: Cambio de empresa actualiza el rol sin re-login
- **WHEN** `user-supervisor-001`, autenticado con `empresaActivaId = 'empresa-001'` (rol `SUPERVISOR`), invoca el switcher y elige `empresa-002`
- **THEN** `authStore.user.rol` pasa a `'JEFE_CALIDAD_SYST'` y `authStore.empresaActivaId` pasa a `'empresa-002'`
- **THEN** el usuario permanece autenticado, sin pasar por `/login`

#### Scenario: Cambio de empresa limpia el caché de queries
- **WHEN** el cambio de empresa se completa exitosamente
- **THEN** `queryClient.clear()` es invocado antes de que cualquier vista vuelva a leer datos cacheados

#### Scenario: Cambio de empresa redirige si la ruta actual ya no es válida para el nuevo rol
- **WHEN** un usuario en `/usuarios` (solo `ADMINISTRADOR_EMPRESA`) cambia a una empresa donde su rol resuelto es `OPERARIO`
- **THEN** es redirigido a `getDefaultRouteForRole('OPERARIO')`

#### Scenario: Cambio de empresa no redirige si la ruta actual sigue siendo válida
- **WHEN** un usuario en `/dashboard` cambia de empresa y su nuevo rol resuelto también tiene acceso a `/dashboard`
- **THEN** permanece en `/dashboard`

#### Scenario: Intento de cambiar a una empresa no asignada es rechazado
- **WHEN** se invoca `POST /api/auth/switch-empresa` con un `empresaId` sin fila `UsuarioEmpresa` activa para el usuario de la sesión
- **THEN** el sistema responde con error y `authStore` no se modifica

#### Scenario: Un Superadmin no puede invocar switch-empresa
- **WHEN** una sesión `SUPERADMIN` invoca `POST /api/auth/switch-empresa` con cualquier `empresaId`
- **THEN** el sistema responde `403` y `authStore` no se modifica

### Requirement: `empresaActivaId` persiste a través de un refresh de página
El sistema SHALL persistir `empresaActivaId` (mock-only, mismo mecanismo que el refresh token en `localStorage`) en cada login/switch exitoso, y limpiarlo en logout. `POST /api/auth/refresh` SHALL recibir este valor y usarlo para resolver el rol efectivo correcto al restaurar la sesión. Para un usuario con `esSuperadminMultiempresa: true`, `empresaActivaId` persistido SHALL ser `null` y `POST /api/auth/refresh` SHALL restaurar `rol: 'SUPERADMIN'` sin consultar `UsuarioEmpresa`, ignorando cualquier header de empresa activa recibido.

#### Scenario: Refresh de página conserva la empresa activa
- **WHEN** `user-supervisor-001` cambia su empresa activa a `empresa-002` y luego recarga la página completa
- **THEN** `authStore.bootstrap()` restaura la sesión con `empresaActivaId: 'empresa-002'` y `user.rol: 'JEFE_CALIDAD_SYST'`

#### Scenario: Logout limpia la empresa activa persistida
- **WHEN** el usuario cierra sesión
- **THEN** el valor persistido de `empresaActivaId` se elimina de `localStorage`

#### Scenario: Refresh de página de un Superadmin restaura la sesión sin empresa activa
- **WHEN** un usuario con `esSuperadminMultiempresa: true` recarga la página completa
- **THEN** `authStore.bootstrap()` restaura la sesión con `empresaActivaId: null` y `user.rol: 'SUPERADMIN'`, sin error
