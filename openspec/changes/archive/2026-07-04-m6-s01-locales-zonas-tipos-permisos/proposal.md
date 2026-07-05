## Why

M6 (Gestión de Usuarios y Roles) incluye la administración del catálogo de Locales y Zonas como deuda técnica heredada de ADD-03: hoy `Local` y `Zona` (definidos en M3-S01 para el módulo de Incidentes) no tienen una capa de permisos ni de validación de negocio propia — solo se consumen como catálogo de solo lectura desde `IncidentForm` y la vista de Mapa. Antes de construir la UI de administración (M6-S03/S04) se necesita la base de permisos, rutas protegidas y reglas de negocio (RN-LOC-*, RN-ZON-*) que gobiernan quién puede crear, consultar y desactivar Locales y Zonas.

## What Changes

- Nueva feature folder `src/features/locations/` con helpers de permisos (`puedeAdministrarLocales`, `puedeConsultarLocales`) y helpers de reglas de negocio (`puedeCrearLocalActivo`, `puedeDesactivarLocal`, `puedeDesactivarZona`).
- Nuevo rol `ADMINISTRADOR_SISTEMA` agregado a `UserRole` (`src/types/auth.types.ts`). **BREAKING** en el sentido de que extiende un union type compartido: cualquier `switch` exhaustivo sobre `UserRole` en el código existente (p. ej. `getIncidentPermissions`) deja de ser exhaustivo y requiere un caso adicional o un `default`.
- Nuevas rutas protegidas `/admin/locales` y `/admin/locales/:id` registradas en el router, con guard de acceso mínimo (`puedeConsultarLocales`) y control de acciones de administración (`puedeAdministrarLocales`) dentro de la página.
- Nuevos schemas Zod `localFormSchema` y `zonaFormSchema` en `src/features/locations/schemas/`.
- Esta spec NO redefine `Local` ni `Zona` (siguen viviendo en `src/features/incidents/types/incident.types.ts`); tampoco incluye UI de listado/formulario, API client, handlers MSW ni lógica de mapa.

## Capabilities

### New Capabilities
- `location-permissions`: helpers `puedeAdministrarLocales` y `puedeConsultarLocales`, y la extensión de `UserRole` con `ADMINISTRADOR_SISTEMA` que ambos helpers requieren.
- `location-schemas`: schemas Zod `localFormSchema` (validación de archivo PNG ≤2MB, dimensiones auto-calculadas) y `zonaFormSchema`.
- `location-business-rules`: helpers puros `puedeCrearLocalActivo`, `puedeDesactivarLocal`, `puedeDesactivarZona` que implementan RN-LOC-001, RN-LOC-002 y RN-ZON-002.

### Modified Capabilities
- `routing`: se agregan los requisitos de las rutas `/admin/locales` y `/admin/locales/:id`, protegidas según `puedeConsultarLocales`/`puedeAdministrarLocales` en lugar de una lista estática de roles en `RoleGuard`.

## Impact

- **Código nuevo**: `src/features/locations/permissions/`, `src/features/locations/schemas/`, `src/features/locations/utils/` (o equivalente para los helpers de reglas de negocio), tests unitarios junto a cada helper.
- **Código modificado**: `src/types/auth.types.ts` (nuevo valor de `UserRole`), `src/router/` (nuevas rutas y su registro en el árbol de rutas protegidas).
- **Dependencias reutilizadas sin modificar**: `src/features/incidents/types/incident.types.ts` (`Local`, `Zona`, y su relación con `Incidente` vía `localId`/`zonaId`).
- **Fuera de alcance**: UI de listado/formularios (M6-S03/S04), API client y handlers MSW de locales/zonas (M6-S02), lógica de mapa o selección visual (ya cubierta en M3-S04/S05).
