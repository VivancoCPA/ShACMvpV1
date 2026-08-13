## ADDED Requirements

### Requirement: UsuarioEmpresa interface
El sistema SHALL definir una interfaz `UsuarioEmpresa` en `src/features/empresas/types/empresa.types.ts` con los siguientes campos requeridos: `usuarioId` (string — FK a `User.id`), `empresaId` (string — FK a `Empresa.id`), `rol` (`UserRole`, reutilizando el enum existente de `src/types/auth.types.ts`), `estado` (`UsuarioEmpresaEstado`), `fechaAsignacion` (ISO 8601 string). No tiene un campo `id` propio — la clave lógica es el par (`usuarioId`, `empresaId`). El rol vive exclusivamente en `UsuarioEmpresa`, no en `User` — un mismo `usuarioId` puede tener múltiples entradas `UsuarioEmpresa` (una por cada `empresaId` al que está asignado), cada una con su propio `rol` independiente.

#### Scenario: UsuarioEmpresa rechaza campos requeridos faltantes
- **WHEN** un desarrollador construye un `UsuarioEmpresa` sin `rol`
- **THEN** TypeScript emite un error de compilación por el campo faltante

#### Scenario: Un mismo usuario puede tener dos entradas UsuarioEmpresa con rol distinto
- **WHEN** se construyen `{ usuarioId: 'user-supervisor-001', empresaId: 'empresa-001', rol: 'SUPERVISOR', estado: 'ACTIVO', fechaAsignacion: '2026-01-01T00:00:00Z' }` y `{ usuarioId: 'user-supervisor-001', empresaId: 'empresa-002', rol: 'JEFE_CALIDAD_SYST', estado: 'ACTIVO', fechaAsignacion: '2026-07-01T00:00:00Z' }`
- **THEN** ambos objetos son válidos como `UsuarioEmpresa[]` sin conflicto de tipos, y sus campos `rol` difieren entre sí

#### Scenario: UsuarioEmpresa.rol reutiliza el enum UserRole existente
- **WHEN** un desarrollador asigna `usuarioEmpresa.rol = 'ADMINISTRADOR_SISTEMA'`
- **THEN** TypeScript acepta la asignación sin error, ya que `'ADMINISTRADOR_SISTEMA'` es un miembro válido de `UserRole`

---

### Requirement: UsuarioEmpresaEstado union type
El sistema SHALL definir un tipo `UsuarioEmpresaEstado = 'ACTIVO' | 'INACTIVO'` en `src/features/empresas/types/empresa.types.ts`.

#### Scenario: UsuarioEmpresaEstado rechaza valores fuera del enum
- **WHEN** un desarrollador asigna `usuarioEmpresa.estado = 'PENDIENTE'`
- **THEN** TypeScript emite un error de compilación, ya que `'PENDIENTE'` no es un miembro de `UsuarioEmpresaEstado`
