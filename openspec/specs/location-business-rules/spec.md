# Spec: location-business-rules

## Purpose

Define las reglas de negocio puras (RN-LOC-*, RN-ZON-*) que gobiernan la creación y desactivación de Locales y Zonas dentro del catálogo administrado en M6.

---

## Requirements

### Requirement: puedeCrearLocalActivo helper (RN-LOC-001)
El sistema SHALL exportar una función pura `puedeCrearLocalActivo(locales: Local[]): boolean` desde `src/features/locations/utils/localesBusinessRules.ts`. La función SHALL contar los elementos de `locales` con `activo === true` y retornar `false` si ese conteo es mayor o igual a 5. En caso contrario SHALL retornar `true`.

#### Scenario: Con 4 locales activos se permite crear el quinto
- **WHEN** se llama `puedeCrearLocalActivo(locales)` donde `locales` tiene exactamente 4 elementos con `activo: true` (y cualquier número de locales con `activo: false`)
- **THEN** el resultado es `true`

#### Scenario: Con 5 locales activos se bloquea la creación
- **WHEN** se llama `puedeCrearLocalActivo(locales)` donde `locales` tiene exactamente 5 elementos con `activo: true`
- **THEN** el resultado es `false`

#### Scenario: Locales inactivos no cuentan para el límite
- **WHEN** se llama `puedeCrearLocalActivo(locales)` donde `locales` tiene 5 elementos con `activo: false` y 0 con `activo: true`
- **THEN** el resultado es `true`

#### Scenario: Lista vacía permite crear
- **WHEN** se llama `puedeCrearLocalActivo([])`
- **THEN** el resultado es `true`

---

### Requirement: puedeDesactivarLocal helper (RN-LOC-002)
El sistema SHALL exportar una función pura `puedeDesactivarLocal(local: Local, incidentes: Incidente[]): { permitido: boolean; incidentesBloqueantes: number }` desde `src/features/locations/utils/localesBusinessRules.ts`. La función SHALL contar los elementos de `incidentes` cuyo `localId === local.id` y cuyo `estado` sea `'ABIERTO'` o `'EN_INVESTIGACION'`, asignando ese conteo a `incidentesBloqueantes`. `permitido` SHALL ser `true` únicamente cuando `incidentesBloqueantes === 0`.

#### Scenario: Local sin incidentes bloqueantes puede desactivarse
- **WHEN** se llama `puedeDesactivarLocal(local, incidentes)` donde ningún incidente tiene `localId === local.id` con estado `'ABIERTO'` o `'EN_INVESTIGACION'`
- **THEN** el resultado es `{ permitido: true, incidentesBloqueantes: 0 }`

#### Scenario: Local con un incidente ABIERTO no puede desactivarse
- **WHEN** se llama `puedeDesactivarLocal(local, incidentes)` donde exactamente un incidente tiene `localId === local.id` y `estado: 'ABIERTO'`
- **THEN** el resultado es `{ permitido: false, incidentesBloqueantes: 1 }`

#### Scenario: Incidentes en otros estados no bloquean la desactivación
- **WHEN** se llama `puedeDesactivarLocal(local, incidentes)` donde los incidentes con `localId === local.id` tienen `estado` en `'ANALISIS_COMPLETADO'`, `'EN_EJECUCION'`, `'PENDIENTE_CIERRE'`, `'CERRADO'` o `'ANULADO'`
- **THEN** el resultado es `{ permitido: true, incidentesBloqueantes: 0 }`

#### Scenario: Incidentes de otro local no cuentan
- **WHEN** se llama `puedeDesactivarLocal(local, incidentes)` donde todos los incidentes con estado `'ABIERTO'` o `'EN_INVESTIGACION'` tienen `localId` distinto de `local.id`
- **THEN** el resultado es `{ permitido: true, incidentesBloqueantes: 0 }`

---

### Requirement: puedeDesactivarZona helper (RN-ZON-002)
El sistema SHALL exportar una función pura `puedeDesactivarZona(zona: Zona, incidentes: Incidente[]): { permitido: boolean; incidentesBloqueantes: number }` desde `src/features/locations/utils/localesBusinessRules.ts`. La función SHALL contar los elementos de `incidentes` cuyo `zonaId === zona.id` y cuyo `estado` sea `'ABIERTO'`, `'EN_INVESTIGACION'` o `'EN_EJECUCION'`, asignando ese conteo a `incidentesBloqueantes`. `permitido` SHALL ser `true` únicamente cuando `incidentesBloqueantes === 0`.

#### Scenario: Zona sin incidentes bloqueantes puede desactivarse
- **WHEN** se llama `puedeDesactivarZona(zona, incidentes)` donde ningún incidente tiene `zonaId === zona.id` con estado `'ABIERTO'`, `'EN_INVESTIGACION'` o `'EN_EJECUCION'`
- **THEN** el resultado es `{ permitido: true, incidentesBloqueantes: 0 }`

#### Scenario: Zona con un incidente EN_EJECUCION no puede desactivarse
- **WHEN** se llama `puedeDesactivarZona(zona, incidentes)` donde exactamente un incidente tiene `zonaId === zona.id` y `estado: 'EN_EJECUCION'`
- **THEN** el resultado es `{ permitido: false, incidentesBloqueantes: 1 }`

#### Scenario: Incidentes en ANALISIS_COMPLETADO, PENDIENTE_CIERRE, CERRADO o ANULADO no bloquean la desactivación
- **WHEN** se llama `puedeDesactivarZona(zona, incidentes)` donde los incidentes con `zonaId === zona.id` tienen `estado` en `'ANALISIS_COMPLETADO'`, `'PENDIENTE_CIERRE'`, `'CERRADO'` o `'ANULADO'`
- **THEN** el resultado es `{ permitido: true, incidentesBloqueantes: 0 }`

#### Scenario: Múltiples incidentes bloqueantes se cuentan todos
- **WHEN** se llama `puedeDesactivarZona(zona, incidentes)` donde dos incidentes tienen `zonaId === zona.id` con estados `'ABIERTO'` y `'EN_INVESTIGACION'` respectivamente
- **THEN** el resultado es `{ permitido: false, incidentesBloqueantes: 2 }`
