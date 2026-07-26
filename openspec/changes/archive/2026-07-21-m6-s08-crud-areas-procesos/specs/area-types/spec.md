## ADDED Requirements

### Requirement: Area interface

El sistema SHALL definir una interfaz `Area` en `src/features/areas/types/area.types.ts` con los siguientes campos: `id` (string), `nombre` (string), `activo` (boolean), `creadoEn` (ISO 8601 string). La interfaz SHALL incluir el siguiente campo opcional: `descripcion` (string). Área es una lista plana — la interfaz SHALL NOT incluir ningún campo de jerarquía o anidamiento (p. ej. `padreId`), a diferencia de `Zona`, que sí referencia a `Local` mediante `localId`.

#### Scenario: Area requiere los campos obligatorios

- **WHEN** un desarrollador construye un `Area` sin `nombre`
- **THEN** TypeScript emite un error de compilación por el campo faltante

#### Scenario: Area acepta descripcion ausente

- **WHEN** un desarrollador construye un `Area` con `descripcion` omitido
- **THEN** TypeScript acepta el objeto sin error

#### Scenario: Area no expone campo de jerarquía

- **WHEN** un desarrollador intenta asignar un campo `padreId` a un objeto `Area`
- **THEN** TypeScript emite un error de compilación, ya que la propiedad no existe en la interfaz

---

### Requirement: AreaConteoBloqueo interface para el desglose de bloqueo de desactivación

El sistema SHALL definir una interfaz `AreaConteoBloqueo` en `src/features/areas/types/area.types.ts` con los siguientes campos requeridos: `qe` (number), `nc` (number), `incidentes` (number), `total` (number). Esta interfaz representa el desglose por módulo devuelto por `puedeDesactivarArea` (ver `area-business-rules`) y por la respuesta `409` del endpoint de desactivación (ver `area-admin-mocks`).

#### Scenario: AreaConteoBloqueo requiere los cuatro contadores

- **WHEN** un desarrollador construye un `AreaConteoBloqueo` sin el campo `nc`
- **THEN** TypeScript emite un error de compilación por el campo faltante

#### Scenario: AreaConteoBloqueo con todos los contadores en cero es válido

- **WHEN** un desarrollador construye `{ qe: 0, nc: 0, incidentes: 0, total: 0 }` como `AreaConteoBloqueo`
- **THEN** TypeScript acepta el objeto sin error
