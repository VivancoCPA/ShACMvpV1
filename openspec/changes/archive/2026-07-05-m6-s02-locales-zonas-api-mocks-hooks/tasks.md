## 1. Store mutable y handlers de lectura existentes

- [x] 1.1 En `src/mocks/handlers/locales.handlers.ts`, reemplazar el uso directo de `localFixtures`/`zonaFixtures` por un store mutable a nivel de módulo (`let locales: Local[]`, `let zonas: Zona[]`, copias de los fixtures) del que lean `GET /api/locales` y `GET /api/zonas` ya existentes, sin cambiar sus query params ni el shape de su respuesta.
- [x] 1.2 Agregar helpers internos `ok`/`err`, `generateId`/`generateCodigo` para locales y zonas, siguiendo el patrón ya usado en `incidents.handlers.ts`/`documents.handlers.ts`.

## 2. Handlers MSW de administración — Locales

- [x] 2.1 Implementar `GET /api/locales/:id` (incluye zonas embebidas del store; `404` si no existe).
- [x] 2.2 Implementar `POST /api/locales`, validando RN-LOC-001 con `puedeCrearLocalActivo` (`400` si falla) y RN-LOC-003 (tipo `image/png`, tamaño ≤2MB cuando el request trae `multipart/form-data` con archivo; `400` con mensaje descriptivo si falla). En éxito, generar `id`/`codigo`, asignar `planoPngUrl` determinística (`/mock/plano-${id}.png`) si hubo archivo válido, agregar al store y responder `201`.
- [x] 2.3 Implementar `PATCH /api/locales/:id`, actualizando campos editables del store (incluida la misma validación RN-LOC-003 si el request trae archivo nuevo); `404` si no existe.
- [x] 2.4 Implementar `PATCH /api/locales/:id/desactivar`, usando `puedeDesactivarLocal` con el store en vivo de incidentes (`getIncidentsStore()`, exportado desde `incidents.handlers.ts`, no el fixture estático); `409` con mensaje que incluye el conteo si está bloqueado, `200` con `activo: false` si procede.
- [x] 2.5 Implementar `PATCH /api/locales/:id/reactivar`, validando RN-LOC-001 con `puedeCrearLocalActivo` igual que `POST /api/locales` (`400` si ya hay 5 activos). Corrección post-revisión: la redacción original de esta tarea decía "sin revalidar RN-LOC-001", pero el invariante ("máximo 5 locales activos simultáneamente") no distingue creación de reactivación — se corrigió el handler, el spec y los tests.

## 3. Handlers MSW de administración — Zonas

- [x] 3.1 Implementar `POST /api/locales/:id/zonas` (sin límite de cantidad — RN-ZON-003; `404` si el local no existe; `201` en éxito).
- [x] 3.2 Implementar `PATCH /api/zonas/:id` (actualiza campos editables; `404` si no existe).
- [x] 3.3 Implementar `PATCH /api/zonas/:id/desactivar`, usando `puedeDesactivarZona` con el store en vivo de incidentes (`getIncidentsStore()`); `409` con mensaje que incluye el conteo si está bloqueado, `200` con `activo: false` si procede.
- [x] 3.4 Implementar `PATCH /api/zonas/:id/reactivar` (marca `activo: true`, `200`).

## 4. Tests de handlers MSW

- [x] 4.1 Crear `src/mocks/handlers/locales.handlers.test.ts` (usando `setupServer` de `msw/node`) cubriendo: RN-LOC-001 en creación (4 activos permite crear, 5 activos bloquea) y en reactivación (menos de 5 activos permite reactivar, 5 activos bloquea la reactivación con 400), RN-LOC-002 (sin incidentes bloqueantes desactiva, con incidente `ABIERTO`/`EN_INVESTIGACION` responde 409 con conteo), RN-LOC-003 (PNG ≤2MB acepta, >2MB rechaza, no-PNG rechaza), RN-ZON-002 (sin incidentes desactiva, con incidente `EN_EJECUCION` responde 409), RN-ZON-003 (crear zona adicional sin límite), y que `GET /api/locales` refleja un `POST` inmediatamente anterior. Nota: la validación de tamaño (>2MB) se prueba mediante la función pura exportada `validatePlano`, ya que el entorno jsdom del proyecto no transporta correctamente el contenido binario real de un `File` de varios MB a través de `FormData`/XHR interceptado por MSW; el resto de escenarios (tipo no-PNG, aceptación, resto de reglas) se prueban end-to-end vía Axios contra los handlers.

## 5. API client de administración

- [x] 5.1 Crear `src/features/locations/api/locales.api.ts` con `listarLocales`, `obtenerLocal`, `crearLocal`, `actualizarLocal`, `desactivarLocal`, `reactivarLocal`, `crearZona`, `actualizarZona`, `desactivarZona`, `reactivarZona`, todas sobre la instancia Axios compartida (`src/lib/axios.ts`).
- [x] 5.2 En `crearLocal`/`actualizarLocal`, construir `FormData` cuando `data.planoUrl` es instancia de `File`; de lo contrario enviar JSON plano.

## 6. Hooks TanStack Query v5

- [x] 6.1 Crear `src/features/locations/hooks/useLocales.ts` con `LOCATION_ADMIN_QUERY_KEYS` (namespace distinto de `['locales', 'list', ...]` usado por `src/features/incidents/hooks/useLocales.ts`) y las queries `useLocales()`, `useLocal(id)`.
- [x] 6.2 Agregar mutations `useCrearLocal()`, `useActualizarLocal()`, `useDesactivarLocal()`, `useReactivarLocal()` con invalidación de detalle + listado según corresponda.
- [x] 6.3 Agregar mutations `useCrearZona()`, `useActualizarZona()`, `useDesactivarZona()`, `useReactivarZona()`, todas invalidando el detalle del local padre en éxito.
- [x] 6.4 En `useDesactivarLocal()`/`useDesactivarZona()`, leer `error.response?.data?.message` en `onError` y mostrarlo con `toast.error` (Sonner), dejando el error accesible en `mutation.error`.

## 7. i18n

- [x] 7.1 Agregar el namespace `locations` a `ns` en `src/i18n/index.ts`.
- [x] 7.2 Agregar claves `locations.toasts.*` (creado/creado error, actualizado/actualizado error, desactivado/desactivado error, reactivado/reactivado error, para Local y Zona) en `src/i18n/es-PE.json` y `src/i18n/en-US.json`.

## 8. Tests de hooks

- [x] 8.1 Crear `src/features/locations/hooks/useLocales.test.ts` (patrón `renderHook` + `QueryClientProvider` + `setupServer(...localesHandlers)`, mockeando `sonner`) cubriendo: creación exitosa de un local (invalidación de listado), desactivación bloqueada por incidentes activos (toast.error con el mensaje del backend, `mutation.error` accesible), e invalidación de cache tras una mutación de zona (detalle del local padre).

## 9. Verificación

- [x] 9.1 Ejecutar `tsc --noEmit` y la suite de tests (`vitest run`) del proyecto para confirmar que no hay regresiones en M3 (`IncidentForm`, Mapa) ni en los tests existentes de `location-business-rules`. `tsc --noEmit` sin errores. `vitest run`: 509/511 tests pasan; los 2 fallos restantes (`qualityEventCreate.schema.test.ts`) y los 2 archivos de test que no cargan (`Pagination.test.tsx`, `DeadlineBadge.test.tsx`, por un import roto a `i18n/config`) son preexistentes y no están relacionados con archivos tocados por este cambio.
