# location-admin-hooks

## Purpose

Hooks de TanStack Query v5 (`src/features/locations/hooks/useLocales.ts`) para consulta y mutación de Locales y Zonas en el módulo de administración (M6), con invalidación de cache y propagación de errores de negocio hacia la UI. TBD: ampliar con detalle de manejo de estados de carga/optimistic updates no cubierto aún por requisitos explícitos.

## Requirements

### Requirement: Hooks de consulta de administración de Locales
`src/features/locations/hooks/useLocales.ts` SHALL exportar `useLocales()` (query de listado, todos los locales sin filtrar por `activo`) y `useLocal(id: string)` (query de detalle que incluye las zonas del local) usando `useQuery` de TanStack Query v5, bajo una query key propia (`LOCATION_ADMIN_QUERY_KEYS`) distinta de la usada por `src/features/incidents/hooks/useLocales.ts`.

#### Scenario: useLocales expone todos los locales incluyendo inactivos
- **WHEN** se invoca `useLocales()` y el backend tiene locales con `activo: true` y `activo: false`
- **THEN** el resultado incluye ambos, sin filtrar por `activo`

#### Scenario: useLocal incluye zonas del local
- **WHEN** se invoca `useLocal(id)` sobre un local con zonas asociadas
- **THEN** el resultado incluye esas zonas

---

### Requirement: Mutations de administración de Locales invalidan cache correctamente
`useLocales.ts` SHALL exportar `useCrearLocal()` (invalida la query de listado en éxito), `useActualizarLocal()`, `useDesactivarLocal()` y `useReactivarLocal()` (estas tres invalidan tanto el detalle del local afectado como la query de listado en éxito), todas como `useMutation` de TanStack Query v5.

#### Scenario: Crear un local invalida el listado
- **WHEN** `useCrearLocal().mutate(data)` completa exitosamente
- **THEN** la query de listado de `LOCATION_ADMIN_QUERY_KEYS` queda invalidada

#### Scenario: Desactivar un local invalida detalle y listado
- **WHEN** `useDesactivarLocal().mutate(id)` completa exitosamente
- **THEN** tanto la query de detalle de ese `id` como la query de listado quedan invalidadas

---

### Requirement: Mutations de administración de Zonas invalidan el detalle del local padre
`useLocales.ts` SHALL exportar `useCrearZona()`, `useActualizarZona()`, `useDesactivarZona()` y `useReactivarZona()` como `useMutation`. Todas SHALL, en éxito, invalidar la query de detalle (`LOCATION_ADMIN_QUERY_KEYS.detail`) del local padre de la zona afectada.

#### Scenario: Crear una zona invalida el detalle de su local padre
- **WHEN** `useCrearZona().mutate({ localId, data })` completa exitosamente
- **THEN** la query de detalle de ese `localId` queda invalidada

---

### Requirement: Propagación del mensaje de error 409 en desactivaciones bloqueadas
`useDesactivarLocal()` y `useDesactivarZona()` SHALL, ante un error de respuesta HTTP `409`, mostrar un `toast.error` (Sonner) con el mensaje descriptivo devuelto por el backend mock (`error.response.data.message`), y SHALL dejar ese mismo mensaje accesible en `mutation.error` para que la UI consumidora (fuera de alcance de esta spec) pueda mostrarlo directamente sin tener que volver a interpretarlo.

#### Scenario: Desactivación bloqueada muestra el mensaje del backend
- **WHEN** `useDesactivarLocal().mutate(id)` recibe una respuesta `409` con `message: "No se puede desactivar: 2 incidentes activos/en investigación asociados"`
- **THEN** se invoca `toast.error` con ese mismo mensaje y `mutation.error` expone un objeto desde el cual se puede leer ese mensaje

#### Scenario: Desactivación exitosa no muestra error
- **WHEN** `useDesactivarZona().mutate(id)` completa exitosamente (sin incidentes bloqueantes)
- **THEN** no se invoca `toast.error`

---

### Requirement: Hook de consulta de todas las Zonas para cómputo de contadores en el listado
`src/features/locations/hooks/useLocales.ts` SHALL exportar `useZonas()`, una query de TanStack Query v5 que invoca `listarZonas()` (`GET /api/zonas` sin filtro de `localId`) bajo la query key `LOCATION_ADMIN_QUERY_KEYS.zonas`. Esta query SHALL permitir calcular, en el cliente, el contador "X de Y zonas activas" por Local y el contenido de la lista expandida de Zonas, sin requerir una llamada por Local.

#### Scenario: useZonas expone todas las zonas de todos los locales
- **WHEN** se invoca `useZonas()` y el backend tiene zonas asociadas a 3 locales distintos
- **THEN** el resultado incluye las zonas de los 3 locales en un único arreglo

#### Scenario: useZonas incluye zonas inactivas
- **WHEN** el backend tiene zonas con `activo: true` y `activo: false`
- **THEN** el resultado de `useZonas()` incluye ambas, sin filtrar por `activo`

---

### Requirement: Propagación del mensaje de error 400 en reactivaciones bloqueadas por RN-LOC-001
`useReactivarLocal()` y `useReactivarZona()` SHALL, ante un error de respuesta HTTP `400` (RN-LOC-001: ya existen 5 locales activos), mostrar un `toast.error` (Sonner) con el mensaje descriptivo devuelto por el backend mock (`error.response.data.message`), en vez del mensaje genérico de traducción, siguiendo el mismo mecanismo de extracción ya usado por `useDesactivarLocal`/`useDesactivarZona` para el error `409`.

#### Scenario: Reactivar un local bloqueado por el límite de 5 activos muestra el mensaje del backend
- **WHEN** `useReactivarLocal().mutate(id)` recibe una respuesta `400` con `message: "No se puede reactivar el local: ya existen 5 locales activos"`
- **THEN** se invoca `toast.error` con ese mismo mensaje, no con el mensaje genérico `toasts.localReactivarError`

#### Scenario: Reactivación exitosa no muestra error
- **WHEN** `useReactivarZona().mutate(id)` completa exitosamente
- **THEN** no se invoca `toast.error`
