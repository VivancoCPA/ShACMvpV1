## ADDED Requirements

### Requirement: puedeAdministrarAreas helper (RN-ARE-003)

El sistema SHALL exportar una función pura `puedeAdministrarAreas(usuario: User): boolean` desde `src/features/areas/permissions/areasPermissions.ts`. La función SHALL retornar `true` únicamente cuando `usuario.rol === 'ADMINISTRADOR_SISTEMA'`. Para cualquier otro rol, SHALL retornar `false`.

#### Scenario: ADMINISTRADOR_SISTEMA puede administrar áreas

- **WHEN** se llama `puedeAdministrarAreas({ ...usuario, rol: 'ADMINISTRADOR_SISTEMA' })`
- **THEN** el resultado es `true`

#### Scenario: Ningún otro rol puede administrar áreas

- **WHEN** se llama `puedeAdministrarAreas({ ...usuario, rol })` con `rol` igual a `'OPERARIO'`, `'SUPERVISOR'`, `'JEFE_CALIDAD_SYST'`, `'JEFE_CONTROL_DOCUMENTARIO'`, `'AUDITOR_INTERNO'` o `'ALTA_DIRECCION'`
- **THEN** el resultado es `false` en todos los casos

---

### Requirement: puedeConsultarAreas helper (catálogo de solo lectura para el resto de roles)

El sistema SHALL exportar una función pura `puedeConsultarAreas(usuario: User): boolean` desde `src/features/areas/permissions/areasPermissions.ts`. La función SHALL retornar `true` para cualquier usuario autenticado, independientemente de su rol — a diferencia de Local/Zona (donde solo `ADMINISTRADOR_SISTEMA` y `JEFE_CALIDAD_SYST` consultan el catálogo vía `puedeConsultarLocales`), ya que Área es consumida como combobox de formulario por prácticamente todos los roles operativos (QE, NC, Incidentes, alta de Supervisor).

#### Scenario: Cualquier rol autenticado puede consultar el catálogo de Áreas

- **WHEN** se llama `puedeConsultarAreas({ ...usuario, rol })` con `rol` igual a cualquier valor de `UserRole`
- **THEN** el resultado es `true` en todos los casos

#### Scenario: ADMINISTRADOR_SISTEMA puede consultar y administrar

- **WHEN** se llama `puedeConsultarAreas({ ...usuario, rol: 'ADMINISTRADOR_SISTEMA' })` y `puedeAdministrarAreas({ ...usuario, rol: 'ADMINISTRADOR_SISTEMA' })`
- **THEN** ambas funciones retornan `true`
