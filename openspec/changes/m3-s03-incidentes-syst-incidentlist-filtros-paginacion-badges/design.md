## Context

M3-S01 definió tipos, schemas, permisos y utilidades. M3-S02 definió el API client, hooks TanStack Query, fixtures MSW y handlers. M3-S03 cierra el módulo con la capa de presentación: el listado operativo que usan los usuarios a diario. El listado de No Conformidades (NCList) en `src/features/nonconformities/components/NCList.tsx` es la referencia canónica de listados en SHAC y es visualmente maduro; cualquier desviación crearía inconsistencia perceptible e innecesaria en la UI.

## Goals / Non-Goals

**Goals:**
- Paridad visual completa con NCList: misma estructura, mismos patrones de interacción, misma fuente de verdad (URL search params).
- Dos nuevos badges especializados para incidentes (`IncidentStatusBadge`, `IncidentTypeBadge`) que se suman al ecosistema de badges compartidos.
- Rutas `/incidents` protegidas con `RoleGuard` correctamente parametrizado.
- Ítem de sidebar "Incidentes SyST" formalizado con roles explícitos.

**Non-Goals:**
- Formulario de creación ni página de detalle de incidente (M3-S04).
- Integración con backend real (MSW cubre todo el desarrollo).
- Virtualización de la tabla (el volumen de incidentes por página no lo justifica).

## Decisions

### 1. Clonar estructura de NCList, no abstraer

**Decisión:** `IncidentList` replica la estructura interna de `NCList` (hook data-bridge, FilterBar con `useSearchParams`, tabla con `TABLE_ROW_CLASS`, `Pagination` compartida) en lugar de crear una abstracción genérica de listado.

**Alternativa considerada:** crear un componente `BaseList<T>` parametrizado por tipo. Se descartó porque (a) dos instancias no justifican una abstracción, (b) los detalles de columnas y acciones son suficientemente distintos para que la abstracción añada más complejidad que valor, y (c) el CLAUDE.md prohíbe abstracciones prematuras.

### 2. `useIncidentList` como hook data-bridge

**Decisión:** Crear `src/features/incidents/hooks/useIncidentList.ts` que lee URL params y delega a `useIncidents()` de M3-S02. La misma separación que `useNCList` respecto de `useNonconformities`.

**Razón:** Los componentes de UI no deben conocer el shape de los search params; el hook es el traductor. Permite testear la lógica de mapeo en aislamiento.

### 3. Modales de confirmación para eliminar/restaurar

**Decisión:** Usar modales de confirmación (estado local `useState`) para eliminar y restaurar, no solo Sonner toast.

**Razón:** Eliminar y restaurar son acciones destructivas o reversibles-pero-disruptivas. El CLAUDE.md explícitamente indica que "Sonner no reemplaza los modales — son acciones destructivas". Sonner se usa para notificación de éxito/error después de confirmar.

### 4. Switch "Mostrar eliminados" solo para `JEFE_CALIDAD_SYST`

**Decisión:** El switch no es un filtro genérico; su visibilidad se controla con `userRole === 'JEFE_CALIDAD_SYST'` directamente, igual que en NCList. El param URL es `showDeleted=true`.

**Razón:** Los eliminados son registros de auditoría que solo el rol de mayor privilegio operativo debe ver. Exponer el switch a otros roles generaría confusión y posibles brechas de visibilidad.

### 5. `IncidentTypeBadge` como badge standalone, no parte de `SeverityBadge`

**Decisión:** `IncidentTypeBadge` es un componente propio de `src/features/incidents/components/`. No se generaliza en `src/components/shared/` porque el tipo de incidente es específico del dominio M3.

**Razón:** `SeverityBadge` ya es compartido entre M2 y M3 (misma escala BAJA/MEDIA/ALTA/CRITICA). El tipo de incidente (ACCIDENTE/INCIDENTE/CUASI_ACCIDENTE/CONDICION_INSEGURA) no tiene equivalente en M2, así que no hay beneficio de compartirlo.

### 6. Chips de filtros activos debajo del FilterBar

**Decisión:** Mostrar chips eliminables para cada filtro activo distinto del default, implementados dentro de `IncidentList` (no en `FilterBar` genérico).

**Razón:** NCList ya implementa este patrón; la consistencia manda. Los chips son específicos de la entidad (usan labels de `INCIDENT_STATUS_LABELS`, `INCIDENT_TYPE_LABELS`, etc.), lo que hace difícil generalizarlos en `FilterBar`.

## Risks / Trade-offs

- **Duplicación de estructura NCList** → Aceptada conscientemente por el principio del CLAUDE.md. Si se decide extraer una abstracción en el futuro, ambos listados serán el material de partida.
- **MSW como única fuente de datos** → Los criterios de aceptación (filtros, paginación, eliminación) dependen de que los handlers M3-S02 implementen correctamente el filtrado. Si los handlers tienen bugs, los tests de integración de la UI fallarán. Mitigación: los fixtures M3-S02 cubren 14 incidentes con variedad suficiente de tipos, estados y severidades.
- **Placeholder routes para M3-S04** → `/incidents/nuevo` e `/incidents/:id` muestran "Próximamente". Si el usuario navega allí accidentalmente, la experiencia es mínima pero no rota. Aceptable para un MVP iterativo.
