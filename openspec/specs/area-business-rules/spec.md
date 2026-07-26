# area-business-rules

## Purpose

Reglas de negocio de Área (M6-S08 — Admin CRUD Áreas/Procesos): helper puro de bloqueo de desactivación con desglose por módulo cross-dominio, y ausencia deliberada de límite de cantidad.

## Requirements

### Requirement: puedeDesactivarArea helper con desglose por módulo (RN-ARE-001)

El sistema SHALL exportar una función pura `puedeDesactivarArea(area: Area, qes: QualityEvent[], ncs: NoConformidad[], incidentes: Incidente[]): { permitido: boolean; conteo: AreaConteoBloqueo }` desde `src/features/areas/utils/areaBusinessRules.ts`.

La función SHALL contar, por separado:
- `conteo.qe`: elementos de `qes` cuyo `areaId === area.id` y cuyo `estado` sea uno de `'ABIERTO'`, `'EN_INVESTIGACION'`, `'ANALISIS_COMPLETADO'`, `'EN_EJECUCION'`, `'PENDIENTE_CIERRE'` o `'EN_VERIFICACION'`.
- `conteo.nc`: elementos de `ncs` cuyo `areaId === area.id` y cuyo `estado` sea uno de `'DETECTADA'`, `'EN_INVESTIGACION'`, `'EN_CORRECCION'`, `'PENDIENTE_CIERRE'` o `'REABIERTA'`.
- `conteo.incidentes`: elementos de `incidentes` cuyo `areaId === area.id` y cuyo `estado` sea uno de `'ABIERTO'`, `'EN_INVESTIGACION'`, `'ANALISIS_COMPLETADO'`, `'EN_EJECUCION'` o `'PENDIENTE_CIERRE'`.

`conteo.total` SHALL ser la suma de `conteo.qe + conteo.nc + conteo.incidentes`. `permitido` SHALL ser `true` únicamente cuando `conteo.total === 0`.

#### Scenario: Área sin referencias activas en ningún módulo puede desactivarse

- **WHEN** se llama `puedeDesactivarArea(area, qes, ncs, incidentes)` donde ningún elemento de los tres arreglos tiene `areaId === area.id` en un estado bloqueante
- **THEN** el resultado es `{ permitido: true, conteo: { qe: 0, nc: 0, incidentes: 0, total: 0 } }`

#### Scenario: Área con un QE en EN_EJECUCION no puede desactivarse

- **WHEN** se llama `puedeDesactivarArea(area, qes, ncs, incidentes)` donde exactamente un elemento de `qes` tiene `areaId === area.id` y `estado: 'EN_EJECUCION'`, y no hay referencias bloqueantes en `ncs` ni `incidentes`
- **THEN** el resultado es `{ permitido: false, conteo: { qe: 1, nc: 0, incidentes: 0, total: 1 } }`

#### Scenario: Área con referencias bloqueantes en los tres módulos simultáneamente

- **WHEN** se llama `puedeDesactivarArea(area, qes, ncs, incidentes)` donde hay 2 QE, 1 NC y 3 Incidentes con `areaId === area.id` en estados bloqueantes
- **THEN** el resultado es `{ permitido: false, conteo: { qe: 2, nc: 1, incidentes: 3, total: 6 } }`

#### Scenario: NC en estado REABIERTA cuenta como bloqueante

- **WHEN** se llama `puedeDesactivarArea(area, qes, ncs, incidentes)` donde exactamente un elemento de `ncs` tiene `areaId === area.id` y `estado: 'REABIERTA'`
- **THEN** `conteo.nc` es `1` y `permitido` es `false`

#### Scenario: QE en estado CERRADO, VERIFICADO o REABIERTO no bloquea

- **WHEN** se llama `puedeDesactivarArea(area, qes, ncs, incidentes)` donde los elementos de `qes` con `areaId === area.id` tienen `estado` en `'CERRADO'`, `'VERIFICADO'` o `'REABIERTO'`
- **THEN** `conteo.qe` es `0`

#### Scenario: NC en estado CERRADA o ANULADA no bloquea

- **WHEN** se llama `puedeDesactivarArea(area, qes, ncs, incidentes)` donde los elementos de `ncs` con `areaId === area.id` tienen `estado` en `'CERRADA'` o `'ANULADA'`
- **THEN** `conteo.nc` es `0`

#### Scenario: Incidente en estado CERRADO o ANULADO no bloquea

- **WHEN** se llama `puedeDesactivarArea(area, qes, ncs, incidentes)` donde los elementos de `incidentes` con `areaId === area.id` tienen `estado` en `'CERRADO'` o `'ANULADO'`
- **THEN** `conteo.incidentes` es `0`

#### Scenario: Referencias de otra Área no cuentan

- **WHEN** se llama `puedeDesactivarArea(area, qes, ncs, incidentes)` donde todos los elementos en estado bloqueante de los tres arreglos tienen `areaId` distinto de `area.id`
- **THEN** el resultado es `{ permitido: true, conteo: { qe: 0, nc: 0, incidentes: 0, total: 0 } }`

---

### Requirement: Ausencia de límite de cantidad de Áreas (RN-ARE-002)

El sistema SHALL NOT implementar ninguna función equivalente a `puedeCrearLocalActivo` (RN-LOC-001) para Área. La creación y reactivación de Área SHALL proceder sin ninguna validación de conteo máximo de áreas activas, a diferencia de Local.

#### Scenario: Crear una Área nueva con un número arbitrariamente grande de áreas activas existentes

- **WHEN** el store tiene 50 áreas con `activo: true` y se realiza `POST /api/areas` con datos válidos
- **THEN** la respuesta es `201`, sin ninguna validación de cupo máximo
