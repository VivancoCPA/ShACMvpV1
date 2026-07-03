## Context

M4 — Quality Event es el módulo central de SHAC. Los sprints M4-S03 y M4-S05 necesitan la capa de datos para construir el listado y el detalle del QE. El backend .NET aún no existe; MSW v2 es la única fuente de datos en desarrollo. El patrón de 3 capas ya está establecido en M1-S02, M2-S02 y M3-S02.

Estado actual: existen los tipos base en `src/features/quality-events/types/` y el directorio `src/features/quality-events/`, pero no hay API client, handlers ni hooks.

## Goals / Non-Goals

**Goals:**
- Implementar las 3 capas de datos (API client, MSW, hooks) sin componentes UI.
- Seguir el patrón establecido en M1-S02/M2-S02/M3-S02 sin desviaciones.
- Cubrir los 4 orígenes, ≥5 estados, 4 tipos y 4 severidades en fixtures.
- Implementar guards mock para RN-QE-002 y RN-QE-004 en el handler de transición de estado.
- Usar IDs reales de fixtures existentes (`nc-002`, `nc-003`, `inc-002`, `inc-001`).
- Incluir comentarios TODO(M4-S05) donde aplica para la decisión de ownership de ACs.

**Non-Goals:**
- Ningún componente UI (listas, formularios, detalle).
- Backend real .NET.
- Migración de ACs entre módulos (decisión M4-S05).
- Internacionalización de mensajes de error mock (solo se requiere en UI).

## Decisions

### 1. Misma estructura que M1-S02/M2-S02/M3-S02
**Decisión:** Replicar el patrón de 3 capas sin ninguna variación de convención.
**Rationale:** Consistencia del codebase; los desarrolladores de M4-S03 y M4-S05 podrán predecir la ubicación de cada archivo.
**Alternativa descartada:** Agrupar fixtures y handlers en un único archivo por entidad — rechazado porque dificulta el mantenimiento y rompe la convención establecida.

### 2. Estado mutable de fixtures en memoria (array local del handler)
**Decisión:** El handler POST y PATCH status mantiene un array mutable en el módulo del handler, inicializado desde los fixtures, para simular persistencia dentro de la sesión del Service Worker.
**Rationale:** MSW reinicia los datos con cada recarga, lo que es correcto para desarrollo; no necesitamos persistencia entre sesiones.
**Alternativa descartada:** Usar `localStorage` — añade complejidad innecesaria y acopla el mock al browser API.

### 3. Guards mock solo para RN-QE-002 y RN-QE-004
**Decisión:** Implementar únicamente los dos guards explicitados en el brief:
- `EN_EJECUCION` sin `causaRaizFirmadaEn` → 422 RN-QE-002
- `CERRADO` sin `cierreFirmaSupervisorId` → 422 RN-QE-004
**Rationale:** Suficiente para que M4-S03/S05 puedan demostrar el flujo de error sin over-engineering del mock.
**Alternativa descartada:** Implementar la máquina de estados completa en MSW — aumenta la complejidad del mock sin valor incremental en este sprint.

### 4. `QEStatusTransitionInput` como tipo propio
**Decisión:** Definir `{ nuevoEstado: QEStatus; comentario?: string; firmaPin?: string }` como tipo separado exportado desde el módulo de tipos.
**Rationale:** Permite a M4-S05 importar directamente el tipo para el formulario de transición sin duplicar la definición.

### 5. Numeración autonumérica en POST
**Decisión:** El handler POST genera el número `QE-2026-00N` usando `(fixtures.length + 1).toString().padStart(3, '0')`.
**Rationale:** Simple, determinista dentro de la sesión, sin dependencia de fecha real (coherente con el patrón de M2 y M3).

## Risks / Trade-offs

- [Riesgo: IDs de fixtures cruzados se desincronizarán si M2/M3 renombran sus fixtures] → Mitigation: Comentarios TODO(M4-S05) en los fixtures afectados documentan explícitamente la dependencia; se revisarán antes de M4-S05.
- [Riesgo: La decisión de ownership de ACs (Modelo A vs B) no resuelta] → Mitigation: Los fixtures de `qe-2026-002` y `qe-2026-006` incluyen el stub mínimo requerido; la decisión se delega a M4-S05.
- [Riesgo: El handler de transición de estado no implementa la máquina completa] → Mitigation: Solo los guards RN-QE-002 y RN-QE-004 están en scope; el resto de transiciones se validan en el backend real.
