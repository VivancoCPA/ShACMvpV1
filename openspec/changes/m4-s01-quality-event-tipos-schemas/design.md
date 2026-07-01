## Context

M4-S01 establece la capa de tipos para el módulo Quality Event (QE), la entidad central del sistema SHAC. Sigue el patrón establecido en M1-S01 (document-types), M2-S01 (nonconformity-types) y M3-S01 (incident-types). El backend aún no existe; todo el estado de desarrollo usa MSW. Este spec no toca API, MSW ni UI.

El módulo M2 (No Conformidades) y M3 (Incidentes SyST) ya existen con sus propios tipos, schemas y constantes. Los QE referencian esos módulos mediante `ncId` e `incidenteId` — stubs provisionales hasta M4-S0X.

## Goals / Non-Goals

**Goals:**
- Definir tipos TypeScript completos para `QualityEvent` y sus sub-entidades
- Implementar la máquina de estados como mapa de transiciones (única fuente de verdad)
- Proveer validadores de reglas de negocio (RN-QE-002/003/004/005/008) como funciones puras
- Proveer helper de permisos por rol/estado
- Schemas Zod para creación y cierre del QE
- Constantes de labels y colores para uso en badges
- Tests unitarios de todo lo anterior

**Non-Goals:**
- API client (M4-S02+)
- MSW handlers/fixtures (M4-S02+)
- Componentes UI (M4-S03+)
- Migración de `ncId`/`qeId` stub en M2/M3 (M4-S0X)
- Implementación de notificación urgente real a Gerencia (M4-S02+)
- Lógica de reapertura automática por vencimiento (M4-S0X)

## Decisions

### Organización de archivos

Seguir el patrón de M3-S01 de forma estricta:

```
src/features/quality-events/
  types/
    qualityEvent.types.ts          # Interfaces QualityEvent, CincoPorques, Ishikawa, QEAuditTrailEntry
    qualityEventPermissions.types.ts  # Interface QEPermissions
  utils/
    qualityEventTransitions.ts     # getValidQETransitions()
    qualityEventPermissions.ts     # getQualityEventPermissions() + validadores RN-QE-*
    qualityEventHelpers.ts         # requiereNotificacionUrgente(), estaVencidaVerificacion()
  schemas/
    qualityEventCreate.schema.ts   # qualityEventCreateSchema + cincoPorquesSchema + ishikawaSchema
    qualityEventCierre.schema.ts   # qualityEventCierreSchema
src/constants/
  shared.constants.ts              # QE_STATUS_LABELS, QE_TYPE_LABELS, QE_SEVERITY_LABELS,
                                   # QE_ORIGIN_LABELS, QE_SEVERITY_COLORS (adición)
```

**Alternativa descartada**: separar constants en `src/constants/qualityEvent.constants.ts`.
Motivo del descarte: M3 ya colocó `INCIDENT_*_LABELS` en `shared.constants.ts`; mantener consistencia cross-módulo facilita que los badges compartan colores de severidad (que son iguales para M2, M3 y M4).

### Función `getValidQETransitions` como mapa explícito

Se implementa como `Record<QEStatus, QEStatus[]>` en `qualityEventTransitions.ts`, no como lógica switch/if-else. Ventaja: legible como documentación, exhaustivo por TypeScript, usable directamente en M4-S04 para UI de selección de siguiente estado.

**Alternativa descartada**: switch/case dentro de la función. Motivo: el switch no es tipable de forma exhaustiva sin discriminante union; el mapa garantiza que cada estado del tipo tenga su entrada.

### Validadores RN-QE-* como funciones puras separadas

Los validadores (RN-QE-002, 003, 004) se exportan como funciones independientes desde `qualityEventPermissions.ts`, no embebidas en `getValidQETransitions`. Motivo: los validadores necesitan acceso a datos de ACs (`accionesCorrectivas`) que no son parte de la máquina de estados pura; mezclarlos crearía acoplamiento innecesario.

### `AccionCorrectivaQE` como interface stub en types

Se define una interface mínima `AccionCorrectivaQE` en `qualityEvent.types.ts` con solo los campos necesarios para RN-QE-003 (`estado`, `evidencia`). El tipo completo de AC se definirá en M4-S0X cuando se migre el stub. Esto evita duplicar tipos con M2/M3 mientras permite que los validadores funcionen.

### Cálculo de días hábiles en `estaVencidaVerificacion`

La función calcula días hábiles excluyendo sábados y domingos (sin festivos — los festivos peruanos se agregarán en M4-S0X si se requiere). Motivo: los festivos varían por año y localidad; agregar hardcoding de festivos en este spec sería prematuro y frágil.

## Risks / Trade-offs

- **[Riesgo] `AccionCorrectivaQE` stub puede divergir** del tipo real cuando se migre en M4-S0X → Mitigación: el TODO comment explícito en el archivo de tipos marca el punto de migración; el tipo stub solo expone `estado` y `evidencia` para minimizar superficie de cambio.
- **[Trade-off] Días hábiles sin festivos** subestima ligeramente el plazo real de 10 días → Mitigación aceptada: el sistema avisará antes de tiempo, no después; false positives son preferibles a false negatives en contexto de seguridad.
- **[Riesgo] `QE_SEVERITY_COLORS` en shared.constants.ts** puede confundirse con colores de M2/M3 → Mitigación: los colores de severidad son idénticos entre módulos (misma paleta SHAC); unificarlos en shared.constants.ts es correcto y no genera confusión.
