## ADDED Requirements

### Requirement: UserRole incluye ADMINISTRADOR_SISTEMA
El sistema SHALL agregar `'ADMINISTRADOR_SISTEMA'` como valor del union type `UserRole` en `src/types/auth.types.ts`. Todo `switch` exhaustivo existente sobre `UserRole` sin cláusula `default` (p. ej. en `src/features/incidents/utils/incidentPermissions.ts`, `src/features/nonconformities/utils/ncPermissions.ts`, `src/features/quality-events/utils/qualityEventPermissions.ts`, `src/features/documents/permissions.ts`) SHALL actualizarse para manejar el nuevo caso retornando el equivalente de "sin permisos" de ese dominio, de modo que `tsc --noEmit` siga pasando sin usar `any` ni suprimir el chequeo de exhaustividad.

#### Scenario: ADMINISTRADOR_SISTEMA es un valor válido de UserRole
- **WHEN** un desarrollador asigna `rol: 'ADMINISTRADOR_SISTEMA'` a un objeto `User`
- **THEN** TypeScript acepta la asignación sin error de tipo

#### Scenario: getIncidentPermissions maneja ADMINISTRADOR_SISTEMA sin romper la exhaustividad del switch
- **WHEN** un desarrollador llama `getIncidentPermissions(null, 'ADMINISTRADOR_SISTEMA')`
- **THEN** la función retorna un objeto `IncidentPermissions` con todos los flags en `false` y `tsc --noEmit` no reporta error de "switch no exhaustivo"

---

### Requirement: puedeAdministrarLocales helper
El sistema SHALL exportar una función pura `puedeAdministrarLocales(usuario: User): boolean` desde `src/features/locations/permissions/localesPermissions.ts`. La función SHALL retornar `true` únicamente cuando `usuario.rol === 'ADMINISTRADOR_SISTEMA'`. Para cualquier otro rol, SHALL retornar `false`.

#### Scenario: ADMINISTRADOR_SISTEMA puede administrar locales
- **WHEN** se llama `puedeAdministrarLocales({ ...usuario, rol: 'ADMINISTRADOR_SISTEMA' })`
- **THEN** el resultado es `true`

#### Scenario: JEFE_CALIDAD_SYST no puede administrar locales
- **WHEN** se llama `puedeAdministrarLocales({ ...usuario, rol: 'JEFE_CALIDAD_SYST' })`
- **THEN** el resultado es `false`

#### Scenario: Ningún otro rol puede administrar locales
- **WHEN** se llama `puedeAdministrarLocales({ ...usuario, rol })` con `rol` igual a `'OPERARIO'`, `'SUPERVISOR'`, `'JEFE_CONTROL_DOCUMENTARIO'`, `'AUDITOR_INTERNO'` o `'ALTA_DIRECCION'`
- **THEN** el resultado es `false` en todos los casos

---

### Requirement: puedeConsultarLocales helper (RN-ZON-004)
El sistema SHALL exportar una función pura `puedeConsultarLocales(usuario: User): boolean` desde `src/features/locations/permissions/localesPermissions.ts`. La función SHALL retornar `true` cuando `usuario.rol` sea `'ADMINISTRADOR_SISTEMA'` o `'JEFE_CALIDAD_SYST'` (RN-ZON-004: el Jefe de Calidad puede consultar el catálogo de Locales/Zonas pero no modificarlo). Para cualquier otro rol, SHALL retornar `false`.

#### Scenario: ADMINISTRADOR_SISTEMA puede consultar locales
- **WHEN** se llama `puedeConsultarLocales({ ...usuario, rol: 'ADMINISTRADOR_SISTEMA' })`
- **THEN** el resultado es `true`

#### Scenario: JEFE_CALIDAD_SYST puede consultar pero no administrar (RN-ZON-004)
- **WHEN** se llama `puedeConsultarLocales({ ...usuario, rol: 'JEFE_CALIDAD_SYST' })` y `puedeAdministrarLocales({ ...usuario, rol: 'JEFE_CALIDAD_SYST' })`
- **THEN** `puedeConsultarLocales` retorna `true` y `puedeAdministrarLocales` retorna `false`

#### Scenario: Ningún otro rol puede consultar locales
- **WHEN** se llama `puedeConsultarLocales({ ...usuario, rol })` con `rol` igual a `'OPERARIO'`, `'SUPERVISOR'`, `'JEFE_CONTROL_DOCUMENTARIO'` o `'AUDITOR_INTERNO'`
- **THEN** el resultado es `false` en todos los casos
