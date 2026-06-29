## Why

El Módulo M3 (Gestión de Incidentes SyST) aún no tiene capa de tipos ni lógica de negocio en el frontend. Sin esta base, ningún spec posterior de M3 puede implementarse correctamente. Este spec establece el contrato de tipos, validaciones y permisos que todos los specs M3-S02 en adelante consumirán, siguiendo el mismo patrón que M2-S01 para no conformidades.

## What Changes

- Nuevos tipos TypeScript: `IncidentType`, `IncidentStatus`, `IncidentSeveridad`, `IncidentTurno`, `CondicionEntorno`, `Incidente`, `AccionCorrectivaIncidente`, `IncidentPermissions`
- Nuevo helper de permisos: `getIncidentPermissions(incidente, userRole)` con reglas RBAC completas
- Nuevo helper de severidad automática: `getAutoSeveridad(tipo, numLesionados)` — usado en M3-S04
- Nuevo helper de plazo de investigación: `getPlazoInvestigacion(severidad)` — retorna días hábiles
- Nuevos schemas Zod: `createIncidentSchema`, `updateIncidentInvestigacionSchema`, `createACIncidenteSchema`
- Barrel export en `src/features/incidents/index.ts`
- Constantes de etiquetas en `src/constants/shared.constants.ts`: `INCIDENT_TYPE_LABELS`, `INCIDENT_STATUS_LABELS`, `CONDICION_ENTORNO_LABELS`
- Campo `informeMedicoAdjunto?: string` en `Incidente` para soportar RN-INC-002 (validación en M3-S04)
- Campo `qeId?: string` como stub provisional de vinculación con M4

## Capabilities

### New Capabilities

- `incident-types`: Tipos TypeScript y enums del dominio de incidentes SyST (`Incidente`, `AccionCorrectivaIncidente`, enums de estado/tipo/severidad/turno/condición)
- `incident-permissions`: Helper `getIncidentPermissions()` con matriz RBAC por rol y estado del incidente
- `incident-schemas`: Schemas Zod para creación de incidente, actualización en investigación y creación de AC
- `incident-severidad`: Helper `getAutoSeveridad()` que calcula severidad según tipo e involucrados
- `incident-plazo`: Helper `getPlazoInvestigacion()` que retorna días hábiles según severidad
- `incident-constants`: Constantes de etiquetas (`INCIDENT_TYPE_LABELS`, `INCIDENT_STATUS_LABELS`, `CONDICION_ENTORNO_LABELS`) en shared.constants.ts

### Modified Capabilities

- `shared-constants`: Agregar `INCIDENT_TYPE_LABELS`, `INCIDENT_STATUS_LABELS` y `CONDICION_ENTORNO_LABELS` — nuevas claves, sin eliminar constantes existentes

## Impact

- `src/features/incidents/types/` — archivos nuevos (sin impacto en M1/M2)
- `src/features/incidents/utils/` — archivos nuevos
- `src/features/incidents/schemas/` — archivos nuevos
- `src/features/incidents/index.ts` — archivo nuevo
- `src/constants/shared.constants.ts` — additive: solo se agregan constantes, sin romper imports existentes
- Sin impacto en módulos M1 (documents) ni M2 (nonconformities) ni en la API layer
