## ADDED Requirements

### Requirement: Hooks de consulta de administración de Áreas

`src/features/areas/hooks/useAreas.ts` SHALL exportar `useAreas()` (query de listado, todas las áreas sin filtrar por `activo`, usando `useQuery` de TanStack Query v5) y `useArea(id: string)` (query de detalle), bajo una query key propia `AREA_QUERY_KEYS`.

#### Scenario: useAreas expone todas las áreas incluyendo inactivas

- **WHEN** se invoca `useAreas()` y el backend tiene áreas con `activo: true` y `activo: false`
- **THEN** el resultado incluye ambas, sin filtrar por `activo`

#### Scenario: useArea retorna el detalle de un Área existente

- **WHEN** se invoca `useArea(id)` sobre un Área existente
- **THEN** el resultado es el objeto `Area` correspondiente a ese `id`

---

### Requirement: Mutations de administración de Áreas invalidan cache correctamente

`useAreas.ts` SHALL exportar `useCrearArea()` (invalida la query de listado en éxito), `useActualizarArea()`, `useDesactivarArea()` y `useReactivarArea()` (estas tres invalidan tanto el detalle del Área afectada como la query de listado en éxito), todas como `useMutation` de TanStack Query v5.

#### Scenario: Crear un Área invalida el listado

- **WHEN** `useCrearArea().mutate(data)` completa exitosamente
- **THEN** la query de listado de `AREA_QUERY_KEYS` queda invalidada

#### Scenario: Desactivar un Área invalida detalle y listado

- **WHEN** `useDesactivarArea().mutate(id)` completa exitosamente
- **THEN** tanto la query de detalle de ese `id` como la query de listado quedan invalidadas

---

### Requirement: Propagación del desglose de bloqueo en desactivaciones fallidas

`useDesactivarArea()` SHALL, ante un error de respuesta HTTP `409`, mostrar un `toast.error` (Sonner) con un mensaje derivado del `conteo` (`AreaConteoBloqueo`) devuelto por el backend mock (`error.response.data.conteo`), y SHALL dejar ese mismo objeto `conteo` accesible en `mutation.error` para que la UI consumidora (`area-list-view`) pueda renderizar el desglose por módulo sin tener que volver a interpretar un string.

#### Scenario: Desactivación bloqueada expone el desglose estructurado

- **WHEN** `useDesactivarArea().mutate(id)` recibe una respuesta `409` con `conteo: { qe: 1, nc: 0, incidentes: 2, total: 3 }`
- **THEN** se invoca `toast.error` y `mutation.error` expone un objeto desde el cual se puede leer `conteo.qe`, `conteo.nc`, `conteo.incidentes` y `conteo.total` individualmente

#### Scenario: Desactivación exitosa no muestra error

- **WHEN** `useDesactivarArea().mutate(id)` completa exitosamente (sin referencias bloqueantes)
- **THEN** no se invoca `toast.error`
