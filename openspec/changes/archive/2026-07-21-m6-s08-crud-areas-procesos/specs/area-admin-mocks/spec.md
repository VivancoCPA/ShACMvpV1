## ADDED Requirements

### Requirement: Store mutable en memoria para Áreas

`src/mocks/handlers/areas.handlers.ts` SHALL mantener un store mutable a nivel de módulo, inicializado como copia de `areaFixtures` (`src/mocks/fixtures/areas.fixtures.ts`). El endpoint `GET /api/areas` SHALL leer de este store mutable (reflejando altas, ediciones y cambios de estado hechos por los endpoints administrativos), no de los fixtures originales directamente.

#### Scenario: Un Área creada aparece en el listado inmediatamente

- **WHEN** se realiza `POST /api/areas` con datos válidos y luego `GET /api/areas`
- **THEN** el Área recién creada está presente en la respuesta de `GET /api/areas`

---

### Requirement: Creación de Área sin límite de cantidad (RN-ARE-002)

`POST /api/areas` SHALL crear el Área con `id` generado, `activo: true` y agregarla al store, respondiendo `201`, sin validar ningún conteo máximo de áreas activas.

#### Scenario: Crear un Área con 50 áreas activas ya existentes

- **WHEN** el store tiene 50 áreas con `activo: true` y se realiza `POST /api/areas` con datos válidos
- **THEN** la respuesta es `201` y el store contiene 51 áreas activas

---

### Requirement: Creación/edición de Área valida unicidad de nombre (RN-ARE-004)

`POST /api/areas` y `PATCH /api/areas/:id` SHALL validar, contra el store actual, que no exista ya otra Área cuyo `nombre` coincida (comparación no case-sensitive) con el `nombre` provisto, excluyendo el propio registro en el caso de edición. Si la validación falla SHALL responder `409` con un mensaje descriptivo. Si pasa, SHALL crear/actualizar el Área y responder `201`/`200` respectivamente.

#### Scenario: Crear con nombre duplicado es rechazado

- **WHEN** el store ya tiene un Área con `nombre: 'Almacén Norte'` y se realiza `POST /api/areas` con `{ nombre: 'ALMACÉN NORTE' }`
- **THEN** la respuesta es `409` con un mensaje descriptivo y el store no cambia

#### Scenario: Editar sin cambiar el propio nombre no es rechazado

- **WHEN** se realiza `PATCH /api/areas/:id` sobre un Área con `nombre: 'Almacén Norte'` enviando `{ nombre: 'Almacén Norte', descripcion: 'Actualizada' }`
- **THEN** la respuesta es `200`

---

### Requirement: Desactivación de Área valida RN-ARE-001 con desglose por módulo cross-dominio

`PATCH /api/areas/:id/desactivar` SHALL usar `puedeDesactivarArea` (`src/features/areas/utils/areaBusinessRules.ts`) con el Área y los stores mutables en vivo de los tres dominios consumidores — `getQeStore()` (`src/mocks/handlers/quality-events.handlers.ts`), `getNonconformitiesStore()` (`src/mocks/handlers/nonconformities.handlers.ts`) y `getIncidentsStore()` (`src/mocks/handlers/incidents.handlers.ts`) — nunca los fixtures estáticos importados directamente, para reflejar altas y cambios de estado hechos en la misma sesión de los tres dominios. Si `permitido` es `false` SHALL responder `409` con un body que incluye el objeto `conteo` (`AreaConteoBloqueo`) completo, no solo un mensaje de texto agregado. Si es `true` SHALL marcar el Área con `activo: false` en el store y responder `200`.

#### Scenario: Área sin referencias bloqueantes se desactiva

- **WHEN** se realiza `PATCH /api/areas/:id/desactivar` sobre un Área sin QE/NC/Incidentes en estado no-terminal asociados
- **THEN** la respuesta es `200` y el Área resultante tiene `activo: false`

#### Scenario: Área con referencias bloqueantes en múltiples módulos no se desactiva

- **WHEN** se realiza `PATCH /api/areas/:id/desactivar` sobre un Área con 1 QE y 2 Incidentes en estado no-terminal asociados
- **THEN** la respuesta es `409` con un body que incluye `{ qe: 1, nc: 0, incidentes: 2, total: 3 }` y el Área permanece `activo: true` en el store

#### Scenario: El bloqueo refleja altas hechas en la misma sesión, no solo el fixture inicial

- **WHEN** se crea un QE nuevo referenciando el Área vía `POST /api/quality-events` (quedando en estado `ABIERTO`) y luego se intenta `PATCH /api/areas/:id/desactivar` sobre esa misma Área
- **THEN** la respuesta es `409` y `conteo.qe` incluye ese QE recién creado

---

### Requirement: Reactivación de Área sin restricción de cupo

`PATCH /api/areas/:id/reactivar` SHALL marcar el Área con `activo: true` en el store y responder `200`, sin ninguna validación de conteo máximo (a diferencia de `PATCH /api/locales/:id/reactivar`, que sí valida RN-LOC-001).

#### Scenario: Área inactiva se reactiva sin restricciones

- **WHEN** se realiza `PATCH /api/areas/:id/reactivar` sobre un Área con `activo: false`, independientemente de cuántas otras áreas estén activas
- **THEN** la respuesta es `200` y el Área resultante tiene `activo: true`

---

### Requirement: Actualización de Área sin restricciones de negocio adicionales

`PATCH /api/areas/:id` SHALL actualizar los campos editables (`nombre`, `descripcion`) del Área en el store y responder `200` (sujeto a la validación de unicidad de nombre ya descrita). Si el `id` no existe en el store SHALL responder `404`.

#### Scenario: Actualizar la descripción de un Área existente

- **WHEN** se realiza `PATCH /api/areas/:id` con `{ descripcion: 'Nueva descripción operativa' }` sobre un Área existente
- **THEN** la respuesta es `200` y el Área resultante tiene esa `descripcion`

#### Scenario: Actualizar un Área inexistente

- **WHEN** se realiza `PATCH /api/areas/:id` con un `id` que no existe en el store
- **THEN** la respuesta es `404`

---

### Requirement: Fixtures iniciales migradas 1:1 desde AREAS_SHAC

`src/mocks/fixtures/areas.fixtures.ts` SHALL exportar `areaFixtures: Area[]` con exactamente 19 elementos, uno por cada valor literal de la constante `AREAS_SHAC` previa (`'Almacén Norte'`, `'Almacén Sur'`, `'Área de Carga'`, `'Área de Contenedores'`, `'Archivo Documentario'`, `'Auditoría'`, `'Calidad'`, `'Control de Calidad'`, `'Control Documentario'`, `'Galpón B'`, `'Galpón C'`, `'Gerencia'`, `'Laboratorio de Calidad'`, `'Laboratorio de Muestras'`, `'Logística'`, `'Operaciones'`, `'Operaciones Aduaneras'`, `'RR.HH.'`, `'SyST'`), en el mismo orden, cada uno con `activo: true` y un `id` determinístico (p. ej. `area-001` .. `area-019`). Ninguno de estos 19 valores SHALL renombrarse ni agregarse un valor nuevo no presente en la lista original.

#### Scenario: areaFixtures contiene exactamente los 19 valores originales

- **WHEN** se inspecciona `areaFixtures.map(a => a.nombre)`
- **THEN** el resultado es exactamente el arreglo de 19 nombres listado en este requirement, en el mismo orden

#### Scenario: Todos los fixtures iniciales están activos

- **WHEN** se inspecciona cualquier elemento de `areaFixtures`
- **THEN** su campo `activo` es `true`
