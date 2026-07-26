## ADDED Requirements

### Requirement: Cliente Axios de administración de Áreas

El sistema SHALL exportar desde `src/features/areas/api/areas.api.ts` las funciones `listarAreas(): Promise<Area[]>`, `obtenerArea(id: string): Promise<Area>`, `crearArea(data: AreaFormInput): Promise<Area>`, `actualizarArea(id: string, data: Partial<AreaFormInput>): Promise<Area>`, `desactivarArea(id: string): Promise<Area>` y `reactivarArea(id: string): Promise<Area>`. Todas SHALL invocar la instancia Axios compartida (`src/lib/axios.ts`), nunca `fetch` directo ni una instancia propia.

#### Scenario: listarAreas retorna todas las áreas sin filtrar

- **WHEN** se llama `listarAreas()` y el backend tiene áreas con `activo: true` y `activo: false`
- **THEN** la función realiza `GET /api/areas` y la promesa resuelve un arreglo que incluye ambas

#### Scenario: crearArea envía el payload como JSON

- **WHEN** se llama `crearArea(data)`
- **THEN** la función realiza `POST /api/areas` con `data` serializado como JSON

#### Scenario: actualizarArea envía solo los campos provistos

- **WHEN** se llama `actualizarArea(id, { descripcion: 'Nueva descripción' })`
- **THEN** la función realiza `PATCH /api/areas/${id}` con un body que contiene únicamente `descripcion`

#### Scenario: desactivarArea invoca el endpoint dedicado

- **WHEN** se llama `desactivarArea(id)`
- **THEN** la función realiza `PATCH /api/areas/${id}/desactivar` sin body

#### Scenario: reactivarArea invoca el endpoint dedicado

- **WHEN** se llama `reactivarArea(id)`
- **THEN** la función realiza `PATCH /api/areas/${id}/reactivar` sin body

---

### Requirement: Módulo de administración de Áreas es independiente de cualquier cliente de solo lectura futuro

`src/features/areas/api/areas.api.ts` SHALL ser el único cliente Axios de Área en el sistema en el momento de esta spec — a diferencia de Local/Zona, no existe un cliente de solo lectura preexistente de Área (M3) que deba mantenerse desacoplado. Si en el futuro se agrega un cliente de consulta de Área para otro módulo, SHALL vivir en un archivo separado, replicando el patrón ya establecido por `src/api/endpoints/locales.api.ts` frente a `src/features/locations/api/locales.api.ts`.

#### Scenario: No existe un segundo cliente Axios de Área en esta spec

- **WHEN** se busca en el repositorio cualquier archivo `*.api.ts` que exporte funciones CRUD de `Area`
- **THEN** el único resultado es `src/features/areas/api/areas.api.ts`
