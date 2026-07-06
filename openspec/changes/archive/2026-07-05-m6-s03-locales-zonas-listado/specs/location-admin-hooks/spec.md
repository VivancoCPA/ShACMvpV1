## ADDED Requirements

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
