# location-admin-mocks

## Purpose

Handlers MSW (`src/mocks/handlers/locales.handlers.ts`) que implementan el backend simulado de administración de Locales y Zonas (M6), incluyendo el store mutable en memoria y la validación de reglas de negocio RN-LOC-* / RN-ZON-*. TBD: ampliar con detalle de paginación/filtrado si se agregan a futuro.

## Requirements

### Requirement: Store mutable en memoria para Locales y Zonas
`src/mocks/handlers/locales.handlers.ts` SHALL mantener un store mutable a nivel de módulo, inicializado como copia de `localFixtures` y `zonaFixtures` (`src/mocks/fixtures/locales.fixtures.ts`). Los endpoints `GET /api/locales` y `GET /api/zonas` SHALL leer de este store mutable (reflejando altas, ediciones y cambios de estado hechos por los endpoints administrativos) en lugar de leer los fixtures originales directamente, sin cambiar sus query params (`activo`, `localId`) ni el shape de su respuesta. Antes de aplicar cualquier otro filtro, ambos endpoints SHALL restringir el resultado a locales/zonas cuyo `empresaId` coincida con el `empresaActivaId` de la sesión activa; `GET /api/locales/:id` SHALL responder `404` si el local existe en el store pero su `empresaId` no coincide con la empresa activa, de forma indistinguible de un id inexistente.

#### Scenario: Un local creado aparece en el listado inmediatamente
- **WHEN** se realiza `POST /api/locales` con datos válidos y luego `GET /api/locales`
- **THEN** el local recién creado está presente en la respuesta de `GET /api/locales`

#### Scenario: El listado excluye locales de otra empresa
- **WHEN** la empresa activa de la sesión es `empresa-001` y se realiza `GET /api/locales` sin filtros
- **THEN** ningún local con `empresaId === 'empresa-002'` aparece en la respuesta

#### Scenario: El listado de zonas excluye zonas de otra empresa
- **WHEN** la empresa activa de la sesión es `empresa-001` y se realiza `GET /api/zonas`
- **THEN** ninguna zona con `empresaId === 'empresa-002'` aparece en la respuesta, incluso si su `localId` coincide con un filtro solicitado

#### Scenario: Detalle de un local de otra empresa responde 404
- **WHEN** se realiza `GET /api/locales/:id` para un id que existe en el store pero cuyo `empresaId` difiere de la empresa activa de la sesión
- **THEN** la respuesta es `404`, indistinguible de la respuesta para un id inexistente

---

### Requirement: Creación de Local valida RN-LOC-001 (máximo 5 activos)
`POST /api/locales` SHALL asignar `empresaId` al local nuevo a partir de la empresa activa de la sesión (nunca un valor fijo ni enviado por el cliente); si la sesión no tiene empresa activa, SHALL responder `401` sin crear el local. SHALL usar `puedeCrearLocalActivo` (`src/features/locations/utils/localesBusinessRules.ts`) sobre el subconjunto del store de locales cuyo `empresaId` coincide con la empresa activa (RN-LOC-001 — "máximo 5 locales activos" es un límite por empresa, no global entre todas las empresas) para determinar si se permite crear un nuevo local con `activo: true`. Si la validación falla SHALL responder `400` con un mensaje descriptivo. Si pasa, SHALL crear el local con `id`, `codigo` generados (RN-EMP-003 — el correlativo de `codigo` se calcula sobre los locales de la misma empresa activa, no sobre el store completo) y agregarlo al store, respondiendo `201`.

#### Scenario: Con 4 locales activos se permite crear el quinto
- **WHEN** el store tiene exactamente 4 locales con `activo: true` y `empresaId` igual a la empresa activa, y se realiza `POST /api/locales` con datos válidos
- **THEN** la respuesta es `201` y el store contiene 5 locales activos de esa empresa

#### Scenario: Con 5 locales activos se rechaza la creación
- **WHEN** el store tiene exactamente 5 locales con `activo: true` y `empresaId` igual a la empresa activa, y se realiza `POST /api/locales`
- **THEN** la respuesta es `400` con un mensaje descriptivo y el store no cambia

#### Scenario: El límite de 5 locales activos es independiente por empresa
- **WHEN** `empresa-001` ya tiene 5 locales activos y `empresa-002` tiene 0, y se realiza `POST /api/locales` con datos válidos desde una sesión cuya empresa activa es `empresa-002`
- **THEN** la respuesta es `201` — el conteo de `empresa-001` no bloquea la creación en `empresa-002`

#### Scenario: Codigo de local es correlativo por empresa
- **WHEN** `empresa-001` ya tiene 2 locales y `empresa-002` no tiene ninguno, y se realiza `POST /api/locales` desde una sesión cuya empresa activa es `empresa-002`
- **THEN** el `codigo` del local creado es el primer correlativo de `empresa-002` (p.ej. `LOC-001`), no el tercero global

#### Scenario: Create rechaza cuando la sesión no tiene empresa activa
- **WHEN** se realiza `POST /api/locales` y `empresaActivaId` de la sesión es `null`
- **THEN** la respuesta es `401` y no se agrega ningún local al store

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
`PATCH /api/locales/:id/desactivar` SHALL responder `404` si el local existe en el store pero su `empresaId` no coincide con la empresa activa de la sesión, sin realizar ninguna otra validación. Cuando el local pertenece a la empresa activa, SHALL usar `puedeDesactivarLocal` (`src/features/locations/utils/localesBusinessRules.ts`) con el local y el subconjunto del store mutable en vivo de incidentes (`getIncidentsStore()`, exportado desde `src/mocks/handlers/incidents.handlers.ts`) filtrado por el mismo `empresaId` del local — un incidente de otra empresa nunca SHALL contar como bloqueante — para reflejar altas y cambios de estado de incidentes hechos en la misma sesión y no solo el fixture estático inicial. Si `permitido` es `false` SHALL responder `409` con un mensaje que incluye `incidentesBloqueantes`. Si es `true` SHALL marcar el local con `activo: false` en el store y responder `200`.

#### Scenario: Local sin incidentes bloqueantes se desactiva
- **WHEN** se realiza `PATCH /api/locales/:id/desactivar` sobre un local sin incidentes `ABIERTO`/`EN_INVESTIGACION` asociados de la misma empresa
- **THEN** la respuesta es `200` y el local resultante tiene `activo: false`

#### Scenario: Local con incidentes bloqueantes no se desactiva
- **WHEN** se realiza `PATCH /api/locales/:id/desactivar` sobre un local con al menos un incidente `ABIERTO` o `EN_INVESTIGACION` de la misma empresa asociado
- **THEN** la respuesta es `409` con un mensaje que incluye el conteo de incidentes bloqueantes y el local permanece `activo: true` en el store

#### Scenario: Un incidente de otra empresa no bloquea la desactivación
- **WHEN** se realiza `PATCH /api/locales/:id/desactivar` sobre un local de `empresa-001` que solo tiene incidentes `ABIERTO` pertenecientes a `empresa-002` asociados a su `localId`
- **THEN** la respuesta es `200` y el local resultante tiene `activo: false` — el incidente de `empresa-002` no cuenta como bloqueante

#### Scenario: Desactivar un local de otra empresa responde 404
- **WHEN** se realiza `PATCH /api/locales/:id/desactivar` para un `id` que existe en el store pero cuyo `empresaId` difiere de la empresa activa de la sesión
- **THEN** la respuesta es `404` y el local permanece sin cambios

---

### Requirement: Reactivación de Local valida RN-LOC-001 (máximo 5 activos)
`PATCH /api/locales/:id/reactivar` SHALL responder `404` si el local existe en el store pero su `empresaId` no coincide con la empresa activa de la sesión. Cuando el local pertenece a la empresa activa, SHALL usar `puedeCrearLocalActivo` (`src/features/locations/utils/localesBusinessRules.ts`) sobre el subconjunto del store de locales cuyo `empresaId` coincide con la empresa activa para determinar si se permite marcar el local como `activo: true`, ya que RN-LOC-001 ("máximo 5 locales activos simultáneamente por empresa") es un invariante de estado y no distingue entre creación y reactivación. Si la validación falla SHALL responder `400` con un mensaje descriptivo y el local permanece `activo: false` en el store. Si pasa, SHALL marcar el local con `activo: true` y responder `200`.

#### Scenario: Local inactivo se reactiva cuando hay menos de 5 activos en su empresa
- **WHEN** el store tiene menos de 5 locales con `activo: true` y `empresaId` igual al del local, y se realiza `PATCH /api/locales/:id/reactivar` sobre un local con `activo: false`
- **THEN** la respuesta es `200` y el local resultante tiene `activo: true`

#### Scenario: Con 5 locales activos en su empresa se rechaza la reactivación
- **WHEN** el store tiene exactamente 5 locales con `activo: true` y `empresaId` igual al del local, y se realiza `PATCH /api/locales/:id/reactivar` sobre un local con `activo: false` de esa misma empresa
- **THEN** la respuesta es `400` con un mensaje descriptivo y el local permanece `activo: false` en el store

#### Scenario: Reactivar un local de otra empresa responde 404
- **WHEN** se realiza `PATCH /api/locales/:id/reactivar` para un `id` que existe en el store pero cuyo `empresaId` difiere de la empresa activa de la sesión
- **THEN** la respuesta es `404` y el local permanece sin cambios

---

### Requirement: Creación de Zona sin límite de cantidad (RN-ZON-003)
`POST /api/locales/:id/zonas` SHALL responder `404` si el local de la ruta no existe, o existe pero su `empresaId` no coincide con la empresa activa de la sesión — ambos casos indistinguibles. Cuando el local pertenece a la empresa activa, SHALL crear una zona asociada al `localId` de la ruta con `empresaId` heredado del local (nunca un valor propio calculado aparte) sin validar ninguna cantidad máxima, con `codigo` correlativo por empresa (RN-EMP-003), respondiendo `201`.

#### Scenario: Se crea una sexta zona en el mismo local sin restricción
- **WHEN** un local ya tiene 5 zonas y se realiza `POST /api/locales/:id/zonas` con datos válidos
- **THEN** la respuesta es `201` y el local tiene 6 zonas en el store, todas con el mismo `empresaId` del local

#### Scenario: Local inexistente al crear zona
- **WHEN** se realiza `POST /api/locales/:id/zonas` con un `id` que no existe en el store
- **THEN** la respuesta es `404`

#### Scenario: Local de otra empresa al crear zona responde 404
- **WHEN** se realiza `POST /api/locales/:id/zonas` con un `id` que existe en el store pero cuyo `empresaId` difiere de la empresa activa de la sesión
- **THEN** la respuesta es `404` y no se crea ninguna zona

---

### Requirement: Desactivación de Zona valida RN-ZON-002 (incidentes bloqueantes)
`PATCH /api/zonas/:id/desactivar` SHALL responder `404` si la zona existe en el store pero su `empresaId` no coincide con la empresa activa de la sesión. Cuando la zona pertenece a la empresa activa, SHALL usar `puedeDesactivarZona` (`src/features/locations/utils/localesBusinessRules.ts`) con la zona y el subconjunto del store mutable en vivo de incidentes (`getIncidentsStore()`) filtrado por el mismo `empresaId` de la zona — un incidente de otra empresa nunca SHALL contar como bloqueante. Si `permitido` es `false` SHALL responder `409` con un mensaje que incluye `incidentesBloqueantes`. Si es `true` SHALL marcar la zona con `activo: false` en el store y responder `200`.

#### Scenario: Zona sin incidentes bloqueantes se desactiva
- **WHEN** se realiza `PATCH /api/zonas/:id/desactivar` sobre una zona sin incidentes `ABIERTO`/`EN_INVESTIGACION`/`EN_EJECUCION` de la misma empresa asociados
- **THEN** la respuesta es `200` y la zona resultante tiene `activo: false`

#### Scenario: Zona con incidente EN_EJECUCION no se desactiva
- **WHEN** se realiza `PATCH /api/zonas/:id/desactivar` sobre una zona con al menos un incidente `EN_EJECUCION` de la misma empresa asociado
- **THEN** la respuesta es `409` con un mensaje que incluye el conteo de incidentes bloqueantes y la zona permanece `activo: true` en el store

#### Scenario: Desactivar una zona de otra empresa responde 404
- **WHEN** se realiza `PATCH /api/zonas/:id/desactivar` para un `id` que existe en el store pero cuyo `empresaId` difiere de la empresa activa de la sesión
- **THEN** la respuesta es `404` y la zona permanece sin cambios

---

### Requirement: Reactivación de Zona
`PATCH /api/zonas/:id/reactivar` SHALL responder `404` si la zona existe en el store pero su `empresaId` no coincide con la empresa activa de la sesión. Cuando pertenece a la empresa activa, SHALL marcar la zona con `activo: true` en el store y responder `200`.

#### Scenario: Zona inactiva se reactiva
- **WHEN** se realiza `PATCH /api/zonas/:id/reactivar` sobre una zona con `activo: false` de la empresa activa
- **THEN** la respuesta es `200` y la zona resultante tiene `activo: true`

#### Scenario: Reactivar una zona de otra empresa responde 404
- **WHEN** se realiza `PATCH /api/zonas/:id/reactivar` para un `id` que existe en el store pero cuyo `empresaId` difiere de la empresa activa de la sesión
- **THEN** la respuesta es `404`

---

### Requirement: Actualización de Local y Zona sin restricciones de negocio adicionales
`PATCH /api/locales/:id` y `PATCH /api/zonas/:id` SHALL actualizar los campos editables del local/zona en el store y responder `200`. Si el `id` no existe en el store, o existe pero su `empresaId` no coincide con la empresa activa de la sesión, SHALL responder `404` (ambos casos indistinguibles). `empresaId` no SHALL estar entre los campos editables por este endpoint bajo ninguna circunstancia.

#### Scenario: Actualizar nombre de un local existente
- **WHEN** se realiza `PATCH /api/locales/:id` con `{ nombre: "Nuevo nombre" }` sobre un local existente de la empresa activa
- **THEN** la respuesta es `200` y el local resultante tiene `nombre: "Nuevo nombre"`

#### Scenario: Actualizar un local inexistente
- **WHEN** se realiza `PATCH /api/locales/:id` con un `id` que no existe en el store
- **THEN** la respuesta es `404`

#### Scenario: Actualizar un local de otra empresa responde 404
- **WHEN** se realiza `PATCH /api/locales/:id` para un `id` que existe en el store pero cuyo `empresaId` difiere de la empresa activa de la sesión
- **THEN** la respuesta es `404` y el local permanece sin cambios
