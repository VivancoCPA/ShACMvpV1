## Why

M6-S01 dejó los permisos/rutas/schemas y M6-S02 la capa de datos (API/mocks/hooks) de administración de Locales/Zonas, pero `/admin/locales` sigue mostrando el placeholder `🚧 Próximamente` de M6-S01. Sin la UI real, ningún usuario (`ADMINISTRADOR_SISTEMA` ni `JEFE_CALIDAD_SYST`) puede administrar ni siquiera consultar el catálogo de Locales/Zonas, y los hooks de M6-S02 no tienen ningún consumidor. El diseño de filas expandibles ya fue validado con Toño mediante un mockup interactivo, por lo que esta spec construye esa UI concreta.

## What Changes

- Reemplaza el placeholder de `LocalesAdminPage` por `LocalList`: filas expandibles por Local (chevron, nombre, badge activo/inactivo, dirección, contador "X de Y zonas activas", acciones inline editar/desactivar-reactivar), que al expandirse muestran las Zonas del Local (nombre, badge, indicador de incidentes activos, acciones inline, enlace "Nueva zona").
- Header con contador "X de 5 locales activos" y botón "Nuevo local" (siempre habilitado; navega a `/admin/locales/new`, consistente con el patrón `navigate('/.../new')` ya usado en `NonconformityListPage`).
- Modal de confirmación simple antes de desactivar (Local o Zona) en el camino feliz (200); si el backend responde 409, modal específico con el desglose de incidentes bloqueantes y (cuando el módulo de incidentes lo soporte) enlace "Ver incidentes".
- Reactivar Local/Zona ejecuta la mutation directo sin modal de confirmación; si el backend responde 400 (RN-LOC-001), se muestra `toast.error` con el mensaje del servidor.
- Botones de "Nuevo local"/editar/desactivar/reactivar solo visibles si `puedeAdministrarLocales(usuario)`; `puedeConsultarLocales`-only (`JEFE_CALIDAD_SYST`) ve el listado completo sin acciones.
- Nuevas rutas placeholder `/admin/locales/new` y `/admin/locales/:localId/zonas/new` (contenido real en M6-S04), registradas bajo el mismo `RoleGuard` que `/admin/locales`.
- `/admin/locales/:id` deja de mostrar el placeholder de detalle y redirige (`Navigate replace`) a `/admin/locales`: el patrón de filas expandibles validado con el usuario cubre esa necesidad, por lo que la vista de detalle separada no se construye.
- Se extiende el cliente/hooks de M6-S02 con `listarZonas()`/`useZonas()` (consumen el endpoint `GET /api/zonas` ya existente, sin tocar handlers) para poder calcular el contador de zonas activas de cada Local sin N+1 requests.
- Nuevas claves i18n bajo el namespace `locations` (ya creado en M6-S02) para labels, modales y mensajes de error.

## Capabilities

### New Capabilities
- `location-list-view`: la página `LocalList` (filas expandibles de Locales/Zonas, contadores, loading/empty state, acciones inline de editar/desactivar/reactivar según permisos, modales de confirmación y de bloqueo por incidentes).

### Modified Capabilities
- `location-admin-hooks`: se agrega `useZonas()` (lista completa de Zonas, para computar contadores por Local en el listado) sobre el endpoint `GET /api/zonas` ya existente.
- `routing`: `/admin/locales/:id` cambia de placeholder a redirect hacia `/admin/locales`; se agregan `/admin/locales/new` y `/admin/locales/:localId/zonas/new` como rutas placeholder bajo el mismo `RoleGuard` que ya protege `/admin/locales`.

## Impact

- **Código nuevo**: `src/features/locations/components/LocalList.tsx` (y subcomponentes: fila de Local, fila de Zona, modales de confirmación/bloqueo), `src/features/locations/components/ActivoBadge.tsx`, tests de componente junto a cada archivo.
- **Código modificado**: `src/features/locations/pages/LocalesAdminPage.tsx` (monta `LocalList`), `src/features/locations/pages/LocalDetailPage.tsx` (pasa a ser un redirect), `src/features/locations/hooks/useLocales.ts` y `src/features/locations/api/locales.api.ts` (agregan `listarZonas`/`useZonas`), `src/router/index.tsx` (nuevas rutas placeholder), `src/router/locationsAccess.test.tsx` (el test de detalle debe reflejar el redirect, no el placeholder), `src/i18n/es-PE.json`/`en-US.json` (namespace `locations`).
- **Dependencias reutilizadas sin modificar**: `puedeAdministrarLocales`/`puedeConsultarLocales` (M6-S01), `puedeDesactivarLocal`/`puedeDesactivarZona` (M6-S01, reutilizadas en el cliente para mostrar el indicador de incidentes bloqueantes por Zona), hooks de mutación existentes de M6-S02 (`useCrearLocal` se usa recién en M6-S04; esta spec solo consume `useLocales`, `useDesactivarLocal`, `useReactivarLocal`, `useDesactivarZona`, `useReactivarZona`), `useIncidents` (`features/incidents/hooks/useIncidents.ts`) para calcular el indicador de incidentes activos por Zona sin tocar el módulo de Incidentes.
- **Fuera de alcance**: `LocalForm`/`ZonaForm` reales (M6-S04, esta spec solo deja las rutas placeholder), redirect de login por defecto para `ADMINISTRADOR_SISTEMA` (diferido a M6-S04), enlace funcional "Ver incidentes" si `/incidents` no soporta aún filtrar por `localId`/`zonaId` como query param (se documenta como pendiente en ese caso).
