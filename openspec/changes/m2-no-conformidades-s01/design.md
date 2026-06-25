## Context

M1 (Control Documentario) estableció los patrones arquitecturales del proyecto: tipos en `features/[modulo]/types/`, schemas Zod en `features/[modulo]/schemas/`, constantes en `features/[modulo]/constants/`, y helpers de permisos en `features/[modulo]/utils/`. M2 sigue el mismo patrón en `features/nonconformities/`.

El backend aún no existe; MSW v2 es la fuente de datos. Esta spec no cubre MSW ni UI — solo la capa de tipos, validación y lógica de permisos.

La entidad `NoConformidad` está relacionada con `QualityEvent` (M4): una NC MAYOR o CRITICA puede generar automáticamente un QE con origen `O2_NC_DETECTADA`. Este vínculo es unidireccional desde NC → QE.

## Goals / Non-Goals

**Goals:**
- Definir el modelo de datos completo de `NoConformidad` con tipado estricto
- Establecer la máquina de estados NC y las transiciones permitidas por rol
- Definir schemas Zod para create/update/cambio de estado con mensajes localizados
- Implementar `getNCPermissions(nc, userRole)` como función pura testeable
- Extender `AuditTrailEntry.entidadTipo` para incluir `'NoConformidad'`

**Non-Goals:**
- MSW handlers y fixtures para NC (M2-S02)
- Hooks TanStack Query para NC (M2-S02)
- Componentes UI (M2-S03 y posteriores)
- Rutas y navegación
- Integración real con QE (requiere M4)

## Decisions

### Decisión: Máquina de estados NC simplificada vs. QE

La máquina de QE tiene 9 estados con flujo complejo. La NC tiene un flujo más lineal: detección → investigación → corrección → cierre. Se elige un modelo de 6 estados:

```
DETECTADA → EN_INVESTIGACION → EN_CORRECCION → PENDIENTE_CIERRE → CERRADA
                                                      ↑
REABIERTA ────────────────────────────────────────────┘
```

`REABIERTA` permite reiniciar el ciclo desde `EN_INVESTIGACION` si la corrección no fue efectiva, alineado con ISO 9001 §10.2.1(f).

**Alternativa descartada:** Incluir `ACCION_INMEDIATA` como estado separado. Rechazada porque la acción inmediata (contención) es un campo del formulario (`accionInmediata: string`), no un estado del ciclo de vida. Mezclar campos con estados complicaría las transiciones sin valor ISO.

### Decisión: NCSeveridad con 3 niveles vs. 4 (como QE)

QE usa `BAJA | MEDIA | ALTA | CRITICA`. NC usa `MENOR | MAYOR | CRITICA`. Esto sigue terminología ISO 9001 estándar donde "menor" y "mayor" son los términos canónicos para no conformidades de auditoría. Se añade `CRITICA` para alinearse con el sistema de escalada de SHAC.

**Alternativa descartada:** Usar los mismos 4 niveles de QE. Rechazada porque `BAJA` y `MEDIA` no tienen equivalente semántico en el lenguaje ISO para NCs — introduciría confusión en auditorías externas.

### Decisión: Separación de schemas create/update/cambiarEstado

Tres schemas independientes en lugar de uno parcial con `.partial()`:
- `createNCSchema` — campos requeridos al reportar una NC
- `updateNCSchema` — campos editables después de crear (limitados por estado)
- `cambiarEstadoNCSchema` — payload de transición con `nuevoEstado` + `comentario`

**Rationale:** Las reglas de validación son diferentes en cada operación. Compartir un schema base con `.partial()` haría más difícil razonar sobre qué campos son obligatorios en cada contexto, y dificulta los mensajes de error localizados.

### Decisión: `getNCPermissions` como función pura en `utils/`

Idéntico al patrón `getDocumentPermissions` de M1. Recibe `(nc: NoConformidad, userRole: UserRole)` y retorna `NCPermissions`. No usa hooks, no accede al store — facilita tests unitarios sin renderizar.

## Risks / Trade-offs

- **[Riesgo] Vínculo NC → QE sin M4** → El campo `qeGeneradoId: string | null` queda como referencia opaca en el tipo. La lógica de creación automática de QE se implementará en M2-S02 (handler MSW) y se refactorizará cuando M4 exista. Mitigación: tipo nullable + comentario en el campo.

- **[Riesgo] `entidadTipo` en `AuditTrailEntry` es un string literal union** → Agregar `'NoConformidad'` es un cambio de tipo sin cambio de runtime. No rompe código existente de M1 porque los valores son aditivos. Mitigación: delta spec sobre `document-types` con MODIFIED requirement.

- **[Trade-off] NCSeveridad diferente a QESeveridad** → Dos tipos distintos en el codebase para "severidad". Aceptable porque representan conceptos de dominios distintos (ISO NC vs. evento de calidad operacional). Un tipo unificado `Severidad` genérico sería prematura abstracción antes de tener M4.

## Open Questions

- ¿Las NCs de tipo `SST` siguen el mismo flujo de estados que las NCs de Calidad, o necesitan estados adicionales (ej. `NOTIFICADO_INDECI`)? → Decisión diferida a M3 cuando se diseñen Incidentes SyST.
- ¿El campo `mineralInvolucrado` en NC debe ser un ID referenciado de un catálogo o string libre? → Por ahora string libre, alineado con M1. Se normaliza cuando exista catálogo de minerales.
