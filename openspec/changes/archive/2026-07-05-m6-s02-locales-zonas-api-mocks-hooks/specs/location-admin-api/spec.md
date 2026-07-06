## ADDED Requirements

### Requirement: Cliente Axios de administración de Locales
El sistema SHALL exportar desde `src/features/locations/api/locales.api.ts` las funciones `crearLocal(data: LocalFormInput): Promise<Local>`, `actualizarLocal(id: string, data: Partial<LocalFormInput>): Promise<Local>`, `desactivarLocal(id: string): Promise<Local>`, `reactivarLocal(id: string): Promise<Local>`, `listarLocales(): Promise<Local[]>` y `obtenerLocal(id: string): Promise<Local>` (este último incluye las zonas del local embebidas en la respuesta). Todas SHALL invocar la instancia Axios compartida (`src/lib/axios.ts`), nunca `fetch` directo ni una instancia propia.

#### Scenario: crearLocal sin archivo de plano envía JSON
- **WHEN** se llama `crearLocal(data)` donde `data.planoUrl` es `undefined`
- **THEN** la función realiza `POST /api/locales` con el body serializado como JSON

#### Scenario: crearLocal con archivo de plano envía multipart
- **WHEN** se llama `crearLocal(data)` donde `data.planoUrl` es una instancia de `File`
- **THEN** la función realiza `POST /api/locales` con el body serializado como `FormData` que incluye el archivo

#### Scenario: obtenerLocal retorna zonas embebidas
- **WHEN** se llama `obtenerLocal(id)` sobre un local existente con zonas asociadas
- **THEN** la promesa resuelve un objeto que incluye las zonas de ese local

---

### Requirement: Cliente Axios de administración de Zonas
El sistema SHALL exportar desde `src/features/locations/api/locales.api.ts` las funciones `crearZona(localId: string, data: ZonaFormInput): Promise<Zona>`, `actualizarZona(zonaId: string, data: Partial<ZonaFormInput>): Promise<Zona>`, `desactivarZona(zonaId: string): Promise<Zona>` y `reactivarZona(zonaId: string): Promise<Zona>`.

#### Scenario: crearZona asocia la zona al local indicado
- **WHEN** se llama `crearZona(localId, data)`
- **THEN** la función realiza `POST /api/locales/${localId}/zonas` con `data` como body JSON y la promesa resuelve la `Zona` creada con `localId` igual al parámetro recibido

#### Scenario: actualizarZona no requiere localId
- **WHEN** se llama `actualizarZona(zonaId, data)`
- **THEN** la función realiza `PATCH /api/zonas/${zonaId}` con `data` como body JSON, sin depender de conocer el `localId` de la zona

---

### Requirement: Independencia del cliente de solo lectura de M3
El cliente de administración (`src/features/locations/api/locales.api.ts`) SHALL ser un módulo distinto de `src/api/endpoints/locales.api.ts` (cliente de solo lectura de M3). Ninguna función de `src/api/endpoints/locales.api.ts` SHALL modificarse como parte de esta capacidad.

#### Scenario: El módulo de solo lectura permanece sin cambios de contrato
- **WHEN** se invoca `localesApi.getLocales()` (de `src/api/endpoints/locales.api.ts`)
- **THEN** el comportamiento y la firma son idénticos a los existentes antes de esta capacidad
