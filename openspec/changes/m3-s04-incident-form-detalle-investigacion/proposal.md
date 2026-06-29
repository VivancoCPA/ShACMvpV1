## Why

M3 ya tiene tipos, schemas, API hooks y la lista de incidentes (S01–S03), pero los usuarios no pueden crear, editar ni ver el detalle de un incidente. Este spec cierra la brecha de CRUD completo para el módulo de Gestión de Incidentes SyST, habilitando el flujo operativo principal antes de integrar con Quality Events en M4.

## What Changes

- Nuevo formulario `IncidentForm` para creación (`/incidents/nuevo`) y edición (`/incidents/:id/editar`) con bloques "Reporte inicial" e "Investigación"
- Nueva página de detalle `IncidentDetail` (`/incidents/:id`) con cabecera, sección de investigación y gestión de Acciones Correctivas provisionales
- Componente `EscaladoBanner` para alertas visuales de severidad ALTA/CRITICA
- Componente `IncidentACSection` para listar y agregar ACs asociadas al incidente
- 3 nuevas páginas: `IncidentNewPage`, `IncidentEditPage`, `IncidentDetailPage`
- Rutas nuevas en `src/router/index.tsx`: `/incidents/nuevo`, `/incidents/:id`, `/incidents/:id/editar`
- Schema Zod de formulario extendido en `src/features/incidents/schemas/`
- Guards de rol por ruta usando `getIncidentPermissions()`

## Capabilities

### New Capabilities

- `incident-form`: Formulario de creación y edición de incidentes con validación Zod, radio cards de tipo, cálculo automático de severidad con `getAutoSeveridad()`, bloque de investigación colapsable (solo edición), campos condicionales (`numLesionados`, `descripcionAtencionMedica`), y nota de plazo con `getPlazoInvestigacion()`
- `incident-detail`: Vista de detalle con cabecera (badges de tipo/estado/severidad), banner de escalado visual, sub-bloques colapsables de descripción e investigación, y sección de Acciones Correctivas provisionales con capacidad de agregar ACs

### Modified Capabilities

<!-- Sin cambios de requerimientos en specs existentes. Las rutas se agregan al router existente. -->

## Impact

- **Rutas**: `src/router/index.tsx` — 3 rutas nuevas integradas al router existente
- **Hooks reutilizados**: `useCreateIncident`, `useUpdateIncident`, `useIncident` (S02) — sin modificación
- **Utils reutilizados**: `getIncidentPermissions`, `getAutoSeveridad`, `getPlazoInvestigacion` (S01) — sin modificación
- **MSW**: Handlers de GET `/api/incidents/:id`, POST `/api/incidents`, PUT `/api/incidents/:id` ya existen en S02 — sin modificación
- **i18n**: Nuevas claves en `incidents` namespace para `es-PE.json` y `en-US.json`
- **No implementado en este spec**: firma electrónica, transiciones de estado (queda para M4)
