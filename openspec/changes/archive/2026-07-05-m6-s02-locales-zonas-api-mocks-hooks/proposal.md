## Why

M6-S01 dejó listos los tipos, permisos y schemas de administración de Locales/Zonas, pero la única capa de datos existente (`src/api/endpoints/locales.api.ts`, `src/mocks/handlers/locales.handlers.ts`, `src/features/incidents/hooks/useLocales.ts`) es de solo lectura y fue construida para el caso de uso de M3 (selector en `IncidentForm`/Mapa). Antes de construir la UI de administración (M6-S03/S04) se necesita la capa de API/mocks/hooks que permita crear, editar, desactivar y reactivar Locales y Zonas aplicando las reglas de negocio RN-LOC-001/002/003 y RN-ZON-002/003 ya definidas como helpers puros en M6-S01.

## What Changes

- Nuevo API client `src/features/locations/api/locales.api.ts` con funciones de administración (`crearLocal`, `actualizarLocal`, `desactivarLocal`, `reactivarLocal`, `crearZona`, `actualizarZona`, `desactivarZona`, `reactivarZona`, `listarLocales`, `obtenerLocal`) — separado del `localesApi.getLocales` de solo lectura en `src/api/endpoints/locales.api.ts`, que no se modifica.
- Nuevo archivo de handlers MSW `src/mocks/handlers/locales.handlers.ts` con los endpoints administrativos (`POST/PATCH /api/locales*`, `POST/PATCH /api/zonas*`) sobre un store mutable en memoria inicializado desde los fixtures existentes de M3, además de los endpoints de lectura ya existentes en ese mismo archivo (que se conservan tal cual).
- Los handlers reutilizan `puedeCrearLocalActivo`, `puedeDesactivarLocal` y `puedeDesactivarZona` (`src/features/locations/utils/localesBusinessRules.ts`, de M6-S01) para no duplicar la lógica de validación; las respuestas de bloqueo devuelven 409 con el conteo de incidentes bloqueantes.
- Nuevo archivo de hooks `src/features/locations/hooks/useLocales.ts` (namespace distinto de `src/features/incidents/hooks/useLocales.ts`, que sigue existiendo sin cambios) con queries y mutations de TanStack Query v5 para el flujo de administración, incluyendo invalidación de cache y propagación del mensaje de error 409 hacia la UI consumidora.
- Tests de handlers (casos positivo/negativo de RN-LOC-001/002/003 y RN-ZON-002) y de hooks (creación exitosa, bloqueo por incidentes activos, invalidación de cache tras mutación).

## Capabilities

### New Capabilities
- `location-admin-api`: cliente Axios de administración de Locales/Zonas (`locales.api.ts` en `features/locations/api/`) y sus tipos de entrada/salida.
- `location-admin-mocks`: handlers MSW administrativos de Locales/Zonas con store mutable en memoria, validaciones RN-LOC-001/002/003 y RN-ZON-002/003, y códigos de respuesta (201/200/400/404/409).
- `location-admin-hooks`: hooks TanStack Query v5 (`useLocales`, `useLocal`, `useCrearLocal`, `useActualizarLocal`, `useDesactivarLocal`, `useReactivarLocal`, `useCrearZona`, `useActualizarZona`, `useDesactivarZona`, `useReactivarZona`) que envuelven el cliente de administración con invalidación de cache y manejo de error 409.

### Modified Capabilities
(ninguna — no cambia el comportamiento de especificación de `location-business-rules` ni de `location-permissions`, solo se consumen)

## Impact

- **Código nuevo**: `src/features/locations/api/locales.api.ts`, `src/mocks/handlers/locales.handlers.ts` (agrega endpoints administrativos a los ya existentes de solo lectura), `src/features/locations/hooks/useLocales.ts`, y tests junto a cada archivo.
- **Código modificado**: `src/mocks/handlers/index.ts` no requiere cambios (ya registra `localesHandlers`); si el archivo de handlers se reestructura en múltiples exports, se actualiza el registro correspondiente.
- **Dependencias reutilizadas sin modificar**: `Local`/`Zona`/`Incidente` (`src/features/incidents/types/incident.types.ts`), fixtures `localFixtures`/`zonaFixtures` (`src/mocks/fixtures/locales.fixtures.ts`), `incidentFixtures` (para validar bloqueos), helpers de reglas de negocio y schemas Zod de M6-S01.
- **Fuera de alcance**: UI de listado/formularios (M6-S03/S04), redefinición de `Local`/`Zona` o cambios en M3, lógica de destino de login para `ADMINISTRADOR_SISTEMA` (M6-S03).
