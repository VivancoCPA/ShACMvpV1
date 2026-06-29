## Context

M3-S01 entregó la capa de tipos TypeScript (`Incidente`, `AccionCorrectivaIncidente`, `AuditTrailEntry`), schemas Zod (`createIncidentSchema`, `updateIncidentInvestigacionSchema`, `createACIncidenteSchema`) y utilidades de negocio (`getAutoSeveridad`, `getPlazoInvestigacion`, `getIncidentPermissions`). Todo reside bajo `src/features/incidents/` y se re-exporta desde `index.ts`.

El backend (.NET 10) no existe aún. MSW v2 es la única fuente de datos en desarrollo. El patrón de tres capas establecido en M1 y M2 (componente → hook TanStack Query → api.ts → MSW) debe replicarse sin cambios en la arquitectura.

## Goals / Non-Goals

**Goals:**
- Exponer 9 funciones en `incidents.api.ts` usando la instancia Axios centralizada (`src/lib/axios.ts`) — misma convención que `nonconformities.api.ts`.
- 14 fixtures estáticos con cobertura completa de tipos, estados, severidades y turnos, incluyendo 1 registro soft-deleted.
- Handlers MSW v2 (`http.*` únicamente) que simulan: filtrado multi-criterio, paginación, validación de transiciones de estado, cálculo automático de severidad y detección de reporte tardío.
- 9 hooks TanStack Query v5 con query keys tipadas e invalidación de caché en `onSuccess`.
- Registro de `incidentHandlers` en `src/mocks/handlers/index.ts`.

**Non-Goals:**
- UI (páginas, formularios, componentes) — queda para M3-S03+.
- Lógica de reporte tardío compleja (solo detección simple: si `fechaEvento` es más de 24h antes de `fechaReporte`).
- Autenticación dentro de los handlers — MSW trabaja sin auth real.
- Tests unitarios de handlers (se validarán con los criterios de aceptación manualmente).

## Decisions

**D1 — Seguir el patrón exacto de M2 en el API client.**
`incidents.api.ts` retorna el dato desenvuelto directamente (no `ApiResponse<T>`) porque el interceptor Axios de `src/lib/axios.ts` ya extrae `response.data.data`. Verificado en `nonconformities.api.ts` líneas 26-28. Alternativa rechazada: retornar `ApiResponse<T>` completo — rompería la consistencia con M2 y duplicaría el unwrapping en hooks.

**D2 — Handlers MSW mantienen estado en memoria con una variable mutable.**
`let incidents = [...incidentFixtures]` al inicio del módulo, exactamente igual que `nonconformities.handlers.ts`. Los fixtures se clonan al inicio; las mutaciones (POST, PATCH, DELETE) modifican el array en memoria. Alternativa rechazada: re-importar fixtures en cada request — perdería el estado creado entre llamadas.

**D3 — `showDeleted` es aditivo: incluye eliminados sumados a los filtrados.**
Si `showDeleted=true`, el conjunto base es todos los incidentes (incluidos `deletedAt` definidos); después se aplican los demás filtros. Si `showDeleted` no está, se excluyen los que tienen `deletedAt`. Esto permite al admin ver eliminados junto a los activos filtrados sin cambiar el endpoint.

**D4 — Transiciones de estado validadas con tabla explícita.**
El handler `PATCH /api/incidents/:id/status` verifica que el estado destino esté en el set de transiciones válidas desde el estado actual. Se define un `Record<IncidentStatus, IncidentStatus[]>` con las aristas permitidas. Estado `ANULADO` solo desde `ABIERTO`. `CERRADO` solo desde `PENDIENTE_CIERRE`. Retorna 422 si la transición no es válida.

**D5 — Hooks de AC reciben `incidenteId` como parámetro del factory (igual que M2 recibe `ncId`).**
`useCreateACIncidente(incidenteId)` y `useUpdateACIncidente(incidenteId)` siguen el mismo patrón que `useCreateAccionCorrectiva(ncId)` en M2, invalidando solo el detalle del incidente afectado.

**D6 — Severidad auto-calculada en el handler POST solo si no viene en el body.**
`getAutoSeveridad` de `incidentSeveridad.ts` ya existe. El handler la importa directamente para consistencia. Si el body incluye `severidad`, se respeta; si no, se calcula. Esto evita duplicar la lógica y hace la función reutilizable.

**D7 — Descripción mínima de 20 caracteres validada en el handler POST.**
`createIncidentSchema` define `descripcion: z.string().min(20)`. El handler MSW valida manualmente este mínimo y retorna 400 si no se cumple, para que los criterios de aceptación (descripcion de 5 chars → 400) pasen correctamente sin depender de Zod en el mock.

## Risks / Trade-offs

- **Estado en memoria se pierde al recargar el SW** → Comportamiento esperado y documentado en M1/M2. Sin impacto.
- **`IncidentTurno` incluye `'TODOS'`** — en los fixtures se asigna solo `DIA | TARDE | NOCHE`; el filtro `turno=TODOS` no matchea ningún fixture de turno específico (comportamiento correcto: "TODOS" es un valor de filtro en UI, no de dato). El handler trata `TODOS` en el filtro como "sin filtro por turno".
- **Número de fixtures fijo (14)** — el auto-incremento del handler POST parte desde 15 basado en `incidents.length + 1`. Si se crean y borran registros en la misma sesión, el contador puede generar números no consecutivos. Aceptable en entorno mock.

## Migration Plan

1. Crear `src/features/incidents/api/incidents.api.ts`.
2. Crear `src/mocks/fixtures/incidents.fixtures.ts`.
3. Crear `src/mocks/handlers/incidents.handlers.ts`.
4. Actualizar `src/mocks/handlers/index.ts` — agregar `incidentHandlers`.
5. Crear `src/features/incidents/hooks/useIncidents.ts`.
6. Actualizar `src/features/incidents/index.ts` — re-exportar hooks y funciones de api.

Rollback: revertir `handlers/index.ts` elimina los handlers sin afectar M1 ni M2.

## Open Questions

- ¿Se requiere endpoint `PATCH /api/incidents/:id/anular` separado del status (como en M2 `POST .../anular`) o basta con `PATCH .../status` con `estado: 'ANULADO'`? Por ahora: status genérico cubre el caso. Si la UI necesita justificación obligatoria para anular, se añadirá en M3-S03.
