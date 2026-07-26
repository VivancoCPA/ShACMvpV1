## ADDED Requirements

### Requirement: Empresa interface
El sistema SHALL definir una interfaz `Empresa` en `src/features/empresas/types/empresa.types.ts` con los siguientes campos requeridos: `id` (string), `razonSocial` (string), `ruc` (string), `estado` (`EmpresaEstado`), `logoUrl` (string), `fechaAlta` (ISO 8601 string). Ningún campo es opcional.

#### Scenario: Empresa rechaza campos requeridos faltantes
- **WHEN** un desarrollador construye un `Empresa` sin `ruc`
- **THEN** TypeScript emite un error de compilación por el campo faltante

#### Scenario: Empresa acepta todos los campos requeridos presentes
- **WHEN** un desarrollador construye `{ id: 'empresa-001', razonSocial: 'Minera Andina del Sur S.A.C.', ruc: '20512345678', estado: 'ACTIVA', logoUrl: '/mock/empresas/empresa-001-logo.png', fechaAlta: '2026-01-01T00:00:00Z' }`
- **THEN** TypeScript acepta el objeto sin error como `Empresa`

---

### Requirement: EmpresaEstado union type
El sistema SHALL definir un tipo `EmpresaEstado = 'ACTIVA' | 'INACTIVA'` en `src/features/empresas/types/empresa.types.ts`.

#### Scenario: EmpresaEstado rechaza valores fuera del enum
- **WHEN** un desarrollador asigna `empresa.estado = 'SUSPENDIDA'`
- **THEN** TypeScript emite un error de compilación, ya que `'SUSPENDIDA'` no es un miembro de `EmpresaEstado`

#### Scenario: EmpresaEstado acepta ACTIVA e INACTIVA
- **WHEN** un desarrollador asigna `empresa.estado = 'INACTIVA'`
- **THEN** TypeScript acepta la asignación sin error
