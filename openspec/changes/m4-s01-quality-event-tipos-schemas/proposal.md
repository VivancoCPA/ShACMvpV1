## Why

M4 — Quality Event (QE) es la entidad central del sistema SHAC que unifica No Conformidades (M2) e Incidentes SyST (M3) bajo un único objeto trazable con ciclo de vida completo. Sin la base de tipos, schemas y helpers de permisos, ningún spec posterior de M4 (API, MSW, UI) puede construirse de forma coherente. Este spec establece esa base siguiendo el mismo patrón de M1-S01, M2-S01 y M3-S01.

## What Changes

- Introducir todos los tipos TypeScript del módulo M4: `QualityEvent`, `QEStatus`, `QEOrigin`, `QEType`, `QESeverity`, `CincoPorques`, `Ishikawa`, `QEPermissions`
- Implementar `getValidQETransitions(estado)` como única fuente de verdad de la máquina de estados
- Implementar validadores de reglas de negocio invariantes (RN-QE-002, RN-QE-003, RN-QE-004, RN-QE-005, RN-QE-008)
- Implementar `getQualityEventPermissions(estado, rol, esResponsable)` como helper de permisos por rol
- Agregar constantes de labels y colores (`QE_STATUS_LABELS`, `QE_TYPE_LABELS`, `QE_SEVERITY_LABELS`, `QE_ORIGIN_LABELS`, `QE_SEVERITY_COLORS`)
- Agregar schemas Zod: `qualityEventCreateSchema`, `qualityEventCierreSchema`, `cincoPorquesSchema`, `ishikawaSchema`
- Tests unitarios cubriendo transiciones, validadores de RN y helper de permisos

## Capabilities

### New Capabilities

- `quality-event-types`: Tipos TypeScript completos para `QualityEvent` y sus sub-entidades (`CincoPorques`, `Ishikawa`), enums de estado/origen/tipo/severidad, interfaz `QEPermissions`, y función `getValidQETransitions`
- `quality-event-constants`: Constantes de labels (es-PE) y colores para status, tipo, severidad y origen del QE; sigue el patrón de `incident-constants` y `shared-constants`
- `quality-event-permissions`: Helper `getQualityEventPermissions` que retorna flags de acción por combinación rol/estado/responsable, y validadores de reglas de negocio RN-QE-002/003/004/005/008
- `quality-event-schemas`: Schemas Zod para creación (`qualityEventCreateSchema` con discriminación por origen), cierre (`qualityEventCierreSchema`), y análisis de causa raíz (`cincoPorquesSchema`, `ishikawaSchema`)

### Modified Capabilities

- `shared-constants`: Agregar exportación de `QE_SEVERITY_COLORS` si se decide colocarlo junto a `INCIDENT_SEVERITY_COLORS` para coherencia cross-módulo

## Impact

- Nuevos archivos en `src/features/quality-events/types/`
- Nuevos archivos en `src/features/quality-events/schemas/`
- Posible adición menor a `src/constants/shared.constants.ts` (colores de severidad QE)
- Tests en `src/features/quality-events/types/__tests__/` y `src/features/quality-events/schemas/__tests__/`
- No hay cambios en API, MSW ni componentes UI (alcance limitado a capa de tipos/lógica pura)
- Las ACs de M2/M3 siguen usando su stub `qeId` actual — la migración real es responsabilidad de un spec posterior (M4-S0X)
