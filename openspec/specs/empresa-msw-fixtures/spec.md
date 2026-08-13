# Spec: empresa-msw-fixtures

## Purpose

MSW fixture dataset for the multi-company (`Empresa`/`UsuarioEmpresa`) data model. Provides the in-memory seed data — `empresaFixtures`, `usuarioEmpresaFixtures`, and the new `empresa-002` users added to `authFixtures` — that other domain fixtures (documents, incidents, non-conformities, quality events) reference when tagging their own records with `empresaId`. Lives in `src/mocks/fixtures/empresas.fixtures.ts` (and `src/mocks/fixtures/auth.fixtures.ts` for the new users). (Purpose is brief/TBD pending broader multi-empresa design docs beyond this phase.)

## Requirements

### Requirement: Empresa fixtures
El sistema SHALL exportar una constante `empresaFixtures: Empresa[]` desde `src/mocks/fixtures/empresas.fixtures.ts` con exactamente 2 elementos:
- `empresa-001` — **Minera Andina del Sur S.A.C.** (`ruc: '20512345678'`, `estado: 'ACTIVA'`, `logoUrl: '/mock/empresas/empresa-001-logo.png'`)
- `empresa-002` — **Terminal Portuario Ilo S.A.C.** (`ruc: '20598765432'`, `estado: 'ACTIVA'`, `logoUrl: '/mock/empresas/empresa-002-logo.png'`)

#### Scenario: empresaFixtures tiene exactamente 2 elementos
- **WHEN** se importa `empresaFixtures`
- **THEN** el array tiene exactamente 2 elementos

#### Scenario: Ambas empresas están ACTIVA
- **WHEN** se filtra `empresaFixtures` por `estado === 'ACTIVA'`
- **THEN** se obtienen los 2 elementos

#### Scenario: Los logoUrl son distintos entre empresas
- **WHEN** se comparan `empresaFixtures[0].logoUrl` y `empresaFixtures[1].logoUrl`
- **THEN** los valores son distintos entre sí

### Requirement: UsuarioEmpresa fixtures
El sistema SHALL exportar una constante `usuarioEmpresaFixtures: UsuarioEmpresa[]` desde `src/mocks/fixtures/empresas.fixtures.ts`. Debe incluir: (1) una entrada por cada usuario existente de `empresa-001` con `empresaId: 'empresa-001'` y `rol` igual al `rol` actual de ese usuario en `authFixtures`; (2) una entrada para cada uno de los 4 usuarios nuevos de `empresa-002` (`user-operario-101`, `user-supervisor-101`, `user-jefecalidad-101`, `user-jefedocs-101`) con `empresaId: 'empresa-002'`; (3) una segunda entrada para `user-supervisor-001` con `empresaId: 'empresa-002'` y `rol: 'JEFE_CALIDAD_SYST'` (distinto de su rol `SUPERVISOR` en `empresa-001`). Todo `usuarioId` referenciado SHALL corresponder a un `id` real presente en `authFixtures` (`src/mocks/fixtures/auth.fixtures.ts`).

#### Scenario: user-supervisor-001 tiene dos entradas UsuarioEmpresa con rol distinto
- **WHEN** se filtra `usuarioEmpresaFixtures` por `usuarioId === 'user-supervisor-001'`
- **THEN** se obtienen exactamente 2 entradas, una con `empresaId: 'empresa-001'` y `rol: 'SUPERVISOR'`, y otra con `empresaId: 'empresa-002'` y `rol: 'JEFE_CALIDAD_SYST'`

#### Scenario: Todo usuarioId de usuarioEmpresaFixtures existe en authFixtures
- **WHEN** se itera cada `usuarioId` de `usuarioEmpresaFixtures`
- **THEN** existe un elemento en `authFixtures` con ese mismo `id`

#### Scenario: empresa-002 tiene al menos 4 usuarios asignados
- **WHEN** se filtra `usuarioEmpresaFixtures` por `empresaId === 'empresa-002'`
- **THEN** se obtienen al menos 4 entradas

### Requirement: Usuarios nuevos de empresa-002 en authFixtures
El sistema SHALL agregar 4 usuarios nuevos a `authFixtures` (`src/mocks/fixtures/auth.fixtures.ts`), cada uno con credenciales de login mock válidas (incluyendo `password`, consistente con el resto de `MockUser`): `user-operario-101` (`rol: 'OPERARIO'`), `user-supervisor-101` (`rol: 'SUPERVISOR'`), `user-jefecalidad-101` (`rol: 'JEFE_CALIDAD_SYST'`), `user-jefedocs-101` (`rol: 'JEFE_CONTROL_DOCUMENTARIO'`). Estos usuarios SHALL poder autenticarse mediante `POST /api/auth/login` igual que cualquier usuario existente de `empresa-001`, ya que en esta fase el login no filtra por empresa (Fase 2).

#### Scenario: Los 4 usuarios nuevos existen en authFixtures
- **WHEN** se buscan los ids `user-operario-101`, `user-supervisor-101`, `user-jefecalidad-101`, `user-jefedocs-101` en `authFixtures`
- **THEN** los 4 existen con el `rol` indicado

#### Scenario: Un usuario nuevo de empresa-002 puede loguearse
- **WHEN** se realiza `POST /api/auth/login` con las credenciales de `user-jefecalidad-101`
- **THEN** la respuesta es exitosa y retorna un `accessToken` válido para ese usuario, igual que para cualquier usuario de `empresa-001`
