## ADDED Requirements

### Requirement: Store mutable en memoria para Locales y Zonas
`src/mocks/handlers/locales.handlers.ts` SHALL mantener un store mutable a nivel de módulo, inicializado como copia de `localFixtures` y `zonaFixtures` (`src/mocks/fixtures/locales.fixtures.ts`). Los endpoints `GET /api/locales` y `GET /api/zonas` ya existentes SHALL leer de este store mutable (reflejando altas, ediciones y cambios de estado hechos por los endpoints administrativos) en lugar de leer los fixtures originales directamente, sin cambiar sus query params (`activo`, `localId`) ni el shape de su respuesta.

#### Scenario: Un local creado aparece en el listado inmediatamente
- **WHEN** se realiza `POST /api/locales` con datos válidos y luego `GET /api/locales`
- **THEN** el local recién creado está presente en la respuesta de `GET /api/locales`

---

### Requirement: Creación de Local valida RN-LOC-001 (máximo 5 activos)
`POST /api/locales` SHALL usar `puedeCrearLocalActivo` (`src/features/locations/utils/localesBusinessRules.ts`) sobre el store actual de locales para determinar si se permite crear un nuevo local con `activo: true`. Si la validación falla SHALL responder `400` con un mensaje descriptivo. Si pasa, SHALL crear el local con `id`, `codigo` generados y agregarlo al store, respondiendo `201`.

#### Scenario: Con 4 locales activos se permite crear el quinto
- **WHEN** el store tiene exactamente 4 locales con `activo: true` y se realiza `POST /api/locales` con datos válidos
- **THEN** la respuesta es `201` y el store contiene 5 locales activos

#### Scenario: Con 5 locales activos se rechaza la creación
- **WHEN** el store tiene exactamente 5 locales con `activo: true` y se realiza `POST /api/locales`
- **THEN** la respuesta es `400` con un mensaje descriptivo y el store no cambia

---

### Requirement: Creación/edición de Local valida RN-LOC-003 (plano PNG ≤2MB)
`POST /api/locales` y `PATCH /api/locales/:id` SHALL, cuando el request incluye un archivo de plano (`multipart/form-data`), validar que el tipo MIME sea `image/png` y que el tamaño sea ≤2MB. Si alguna validación falla SHALL responder `400` con un mensaje descriptivo indicando cuál falló. Si ambas pasan, SHALL asignar `planoPngUrl` en el local con una URL mock determinística.

#### Scenario: Archivo PNG de 1MB se acepta
- **WHEN** se realiza `POST /api/locales` (o `PATCH /api/locales/:id`) con un archivo `image/png` de 1MB
- **THEN** la respuesta es exitosa y el local resultante tiene `planoPngUrl` definido

#### Scenario: Archivo mayor a 2MB se rechaza
- **WHEN** se realiza `POST /api/locales` con un archivo `image/png` de 3MB
- **THEN** la respuesta es `400` con un mensaje que indica que el tamaño excede el límite

#### Scenario: Archivo que no es PNG se rechaza
- **WHEN** se realiza `POST /api/locales` con un archivo `image/jpeg`
- **THEN** la respuesta es `400` con un mensaje que indica que el formato no es válido

---

### Requirement: Desactivación de Local valida RN-LOC-002 (incidentes bloqueantes)
`PATCH /api/locales/:id/desactivar` SHALL usar `puedeDesactivarLocal` (`src/features/locations/utils/localesBusinessRules.ts`) con el local y el store mutable en vivo de incidentes (`getIncidentsStore()`, exportado desde `src/mocks/handlers/incidents.handlers.ts`) como argumentos, para reflejar altas y cambios de estado de incidentes hechos en la misma sesión y no solo el fixture estático inicial. Si `permitido` es `false` SHALL responder `409` con un mensaje que incluye `incidentesBloqueantes`. Si es `true` SHALL marcar el local con `activo: false` en el store y responder `200`.

#### Scenario: Local sin incidentes bloqueantes se desactiva
- **WHEN** se realiza `PATCH /api/locales/:id/desactivar` sobre un local sin incidentes `ABIERTO`/`EN_INVESTIGACION` asociados
- **THEN** la respuesta es `200` y el local resultante tiene `activo: false`

#### Scenario: Local con incidentes bloqueantes no se desactiva
- **WHEN** se realiza `PATCH /api/locales/:id/desactivar` sobre un local con al menos un incidente `ABIERTO` o `EN_INVESTIGACION` asociado
- **THEN** la respuesta es `409` con un mensaje que incluye el conteo de incidentes bloqueantes y el local permanece `activo: true` en el store

---

### Requirement: Reactivación de Local valida RN-LOC-001 (máximo 5 activos)
`PATCH /api/locales/:id/reactivar` SHALL usar `puedeCrearLocalActivo` (`src/features/locations/utils/localesBusinessRules.ts`) sobre el store actual de locales para determinar si se permite marcar el local como `activo: true`, ya que RN-LOC-001 ("máximo 5 locales activos simultáneamente") es un invariante de estado y no distingue entre creación y reactivación. Si la validación falla SHALL responder `400` con un mensaje descriptivo y el local permanece `activo: false` en el store. Si pasa, SHALL marcar el local con `activo: true` y responder `200`.

#### Scenario: Local inactivo se reactiva cuando hay menos de 5 activos
- **WHEN** el store tiene menos de 5 locales con `activo: true` y se realiza `PATCH /api/locales/:id/reactivar` sobre un local con `activo: false`
- **THEN** la respuesta es `200` y el local resultante tiene `activo: true`

#### Scenario: Con 5 locales activos se rechaza la reactivación
- **WHEN** el store tiene exactamente 5 locales con `activo: true` y se realiza `PATCH /api/locales/:id/reactivar` sobre un local con `activo: false`
- **THEN** la respuesta es `400` con un mensaje descriptivo y el local permanece `activo: false` en el store

---

### Requirement: Creación de Zona sin límite de cantidad (RN-ZON-003)
`POST /api/locales/:id/zonas` SHALL crear una zona asociada al `localId` de la ruta sin validar ninguna cantidad máxima, respondiendo `201`. Si el local de la ruta no existe SHALL responder `404`.

#### Scenario: Se crea una sexta zona en el mismo local sin restricción
- **WHEN** un local ya tiene 5 zonas y se realiza `POST /api/locales/:id/zonas` con datos válidos
- **THEN** la respuesta es `201` y el local tiene 6 zonas en el store

#### Scenario: Local inexistente al crear zona
- **WHEN** se realiza `POST /api/locales/:id/zonas` con un `id` que no existe en el store
- **THEN** la respuesta es `404`

---

### Requirement: Desactivación de Zona valida RN-ZON-002 (incidentes bloqueantes)
`PATCH /api/zonas/:id/desactivar` SHALL usar `puedeDesactivarZona` (`src/features/locations/utils/localesBusinessRules.ts`) con la zona y el store mutable en vivo de incidentes (`getIncidentsStore()`, exportado desde `src/mocks/handlers/incidents.handlers.ts`) como argumentos. Si `permitido` es `false` SHALL responder `409` con un mensaje que incluye `incidentesBloqueantes`. Si es `true` SHALL marcar la zona con `activo: false` en el store y responder `200`.

#### Scenario: Zona sin incidentes bloqueantes se desactiva
- **WHEN** se realiza `PATCH /api/zonas/:id/desactivar` sobre una zona sin incidentes `ABIERTO`/`EN_INVESTIGACION`/`EN_EJECUCION` asociados
- **THEN** la respuesta es `200` y la zona resultante tiene `activo: false`

#### Scenario: Zona con incidente EN_EJECUCION no se desactiva
- **WHEN** se realiza `PATCH /api/zonas/:id/desactivar` sobre una zona con al menos un incidente `EN_EJECUCION` asociado
- **THEN** la respuesta es `409` con un mensaje que incluye el conteo de incidentes bloqueantes y la zona permanece `activo: true` en el store

---

### Requirement: Reactivación de Zona
`PATCH /api/zonas/:id/reactivar` SHALL marcar la zona con `activo: true` en el store y responder `200`.

#### Scenario: Zona inactiva se reactiva
- **WHEN** se realiza `PATCH /api/zonas/:id/reactivar` sobre una zona con `activo: false`
- **THEN** la respuesta es `200` y la zona resultante tiene `activo: true`

---

### Requirement: Actualización de Local y Zona sin restricciones de negocio adicionales
`PATCH /api/locales/:id` y `PATCH /api/zonas/:id` SHALL actualizar los campos editables del local/zona en el store y responder `200`. Si el `id` no existe en el store SHALL responder `404`.

#### Scenario: Actualizar nombre de un local existente
- **WHEN** se realiza `PATCH /api/locales/:id` con `{ nombre: "Nuevo nombre" }` sobre un local existente
- **THEN** la respuesta es `200` y el local resultante tiene `nombre: "Nuevo nombre"`

#### Scenario: Actualizar un local inexistente
- **WHEN** se realiza `PATCH /api/locales/:id` con un `id` que no existe en el store
- **THEN** la respuesta es `404`
