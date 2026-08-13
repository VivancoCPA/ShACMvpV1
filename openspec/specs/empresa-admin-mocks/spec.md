# Spec: empresa-admin-mocks

## Purpose

Provide the MSW mock layer backing the empresa-administration module: mutable fixture stores for `Empresa` and `UsuarioEmpresa`, and the CRUD/assignment handlers a `SUPERADMIN` uses to manage the Empresa catalog and assign users to empresas with a role — `GET/POST /api/empresas`, `PATCH /api/empresas/:id` (including the RN-EMP-005 deactivation cascade), and `GET/POST /api/empresas/:id/usuarios` + `PATCH /api/empresas/:id/usuarios/:usuarioId`.

---

## Requirements

### Requirement: `empresas.fixtures.ts` expone stores mutables para Empresa y UsuarioEmpresa
`src/mocks/fixtures/empresas.fixtures.ts` SHALL exponer `getEmpresasStore(): Empresa[]` y `getUsuarioEmpresaStore(): UsuarioEmpresa[]` retornando los arrays mutables subyacentes (mismo patrón que `getUsersStore()` en `auth.fixtures.ts`), no las constantes estáticas originales. `getEmpresasActivasForUsuario` y `getRolEfectivo` SHALL leer de estos stores mutables, para que una asignación o desactivación reciente sea visible en el siguiente login/refresh/switch-empresa sin reiniciar MSW.

#### Scenario: Una asignación nueva es visible inmediatamente en el login
- **WHEN** `SUPERADMIN` asigna `user-operario-001` a `empresa-002` con rol `SUPERVISOR`, y ese usuario intenta iniciar sesión inmediatamente después
- **THEN** `empresa-002` aparece en sus `empresasDisponibles` sin necesidad de recargar la aplicación

### Requirement: `GET /api/empresas` lista todas las empresas del sistema
El handler SHALL requerir `SUPERADMIN` (401 si no hay sesión válida, 403 si el rol de la sesión no es `SUPERADMIN`) y retornar todas las `Empresa` del store, sin scoping por empresa activa (SUPERADMIN no tiene una).

#### Scenario: SUPERADMIN lista todas las empresas
- **WHEN** `SUPERADMIN` invoca `GET /api/empresas`
- **THEN** la respuesta incluye tanto `empresa-001` como `empresa-002`, sin importar su `estado`

#### Scenario: Un rol distinto de SUPERADMIN es rechazado
- **WHEN** un usuario con rol `ADMINISTRADOR_SISTEMA` invoca `GET /api/empresas`
- **THEN** el handler responde `403`

### Requirement: `POST /api/empresas` crea una empresa nueva
El handler SHALL requerir `SUPERADMIN`, validar el body contra `empresaFormSchema` (incluida la unicidad de `ruc`), asignar un `id` nuevo y `fechaAlta: new Date().toISOString()`, y responder `201` con la empresa creada. `estado` inicial SHALL ser `'ACTIVA'` si no se especifica.

#### Scenario: Alta exitosa de empresa
- **WHEN** `SUPERADMIN` envía `POST /api/empresas` con `razonSocial`, `ruc` único y sin `logoBase64`
- **THEN** el handler responde `201` con la empresa creada, `estado: 'ACTIVA'` y un `id` nuevo

### Requirement: `PATCH /api/empresas/:id` edita una empresa y aplica la cascada de desactivación
El handler SHALL requerir `SUPERADMIN`, responder `404` si el `id` no existe, y validar el body parcial contra `empresaFormSchema`. Si el body incluye `estado: 'INACTIVA'` y la empresa estaba `'ACTIVA'`, el handler SHALL aplicar la cascada de `empresa-admin-permissions` (poner en `INACTIVO` toda fila `UsuarioEmpresa` de esa empresa) como parte de la misma operación, antes de responder.

#### Scenario: Edición de razón social no dispara cascada
- **WHEN** `SUPERADMIN` envía `PATCH /api/empresas/empresa-001` con solo `razonSocial` nueva
- **THEN** el handler responde `200` con la empresa actualizada, sin tocar ninguna fila `UsuarioEmpresa`

#### Scenario: Desactivar dispara la cascada dentro de la misma request
- **WHEN** `SUPERADMIN` envía `PATCH /api/empresas/empresa-002` con `estado: 'INACTIVA'`
- **THEN** el handler responde `200` con la empresa en `estado: 'INACTIVA'`, y todas las filas `UsuarioEmpresa` de `empresa-002` quedan en `estado: 'INACTIVO'` antes de que la respuesta se envíe

### Requirement: `GET /api/empresas/:id/usuarios` lista las asignaciones UsuarioEmpresa de una empresa
El handler SHALL requerir `SUPERADMIN`, responder `404` si el `id` de empresa no existe, y retornar todas las filas `UsuarioEmpresa` de esa empresa (activas e inactivas) enriquecidas con los datos básicos del `Usuario` (nombre, apellido, email) leídos de `getUsersStore()` — mismo patrón de store cross-dominio que usan otros handlers del proyecto, nunca el fixture estático importado directo.

#### Scenario: Listado incluye asignaciones activas e inactivas
- **WHEN** `SUPERADMIN` invoca `GET /api/empresas/empresa-001/usuarios` después de haber desactivado una asignación
- **THEN** la respuesta incluye esa fila con `estado: 'INACTIVO'`, junto con el resto de asignaciones activas

### Requirement: `POST /api/empresas/:id/usuarios` asigna un usuario existente a la empresa
El handler SHALL requerir `SUPERADMIN`, validar el body contra `asignarUsuarioEmpresaSchema`, y responder `404` si `usuarioId` no corresponde a ningún `Usuario` existente. Si ya existe una fila `UsuarioEmpresa` para ese `usuarioId`+`empresaId` (en cualquier estado), el handler SHALL actualizar su `rol` y ponerla en `estado: 'ACTIVO'` (reactivación) en vez de crear una fila duplicada; si no existe, SHALL crear una fila nueva con `estado: 'ACTIVO'` y `fechaAsignacion: new Date().toISOString()`.

#### Scenario: Asignar un usuario nuevo a la empresa crea una fila
- **WHEN** `SUPERADMIN` envía `POST /api/empresas/empresa-002/usuarios` con `usuarioId: 'user-supervisor-001'` (sin asignación previa a `empresa-002`) y `rol: 'JEFE_CALIDAD_SYST'`
- **THEN** el handler responde `201` con una fila `UsuarioEmpresa` nueva

#### Scenario: Reasignar un usuario con una fila inactiva la reactiva en vez de duplicarla
- **WHEN** `SUPERADMIN` envía `POST /api/empresas/:id/usuarios` para un usuario que ya tiene una fila `UsuarioEmpresa` en `estado: 'INACTIVO'` hacia esa misma empresa
- **THEN** esa misma fila pasa a `estado: 'ACTIVO'` con el `rol` indicado, sin crear una segunda fila para el mismo par usuario-empresa

#### Scenario: usuarioId inexistente es rechazado
- **WHEN** `SUPERADMIN` envía `POST /api/empresas/:id/usuarios` con un `usuarioId` que no corresponde a ningún `Usuario`
- **THEN** el handler responde `404`

### Requirement: `PATCH /api/empresas/:id/usuarios/:usuarioId` desactiva o reactiva una asignación puntual
El handler SHALL requerir `SUPERADMIN`, responder `404` si no existe una fila `UsuarioEmpresa` para ese par `id`(empresa)/`usuarioId`, y actualizar su `estado` según el body (`'ACTIVO'` o `'INACTIVO'`).

#### Scenario: Desactivar una asignación puntual no afecta otras empresas del mismo usuario
- **WHEN** `SUPERADMIN` envía `PATCH /api/empresas/empresa-002/usuarios/user-supervisor-001` con `estado: 'INACTIVO'`
- **THEN** solo esa fila pasa a `INACTIVO`; la fila de `user-supervisor-001` hacia `empresa-001` no se modifica
