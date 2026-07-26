## Context

"Área/Proceso afectado" es hoy `AREAS_SHAC` (`src/constants/shared.constants.ts`), una constante `readonly string[]` con 19 valores hardcodeados. Es consumida como texto libre (`z.string().min(1)`, sin `z.enum`) por Quality Events (`areaAfectada`), No Conformidades (`areaAfectada`), Incidentes (`areaId` — nombrado como FK pero hoy almacena el string literal) y `areasAsignadas` de Supervisor. No existe backend real; MSW v2 es la única fuente de datos.

El sistema ya tiene un precedente arquitectónico directo y reciente: Local/Zona (M6-S01–M6-S04), un catálogo administrado con CRUD exclusivo de `ADMINISTRADOR_SISTEMA`, store mutable en MSW, hooks TanStack Query dedicados, y una regla de bloqueo de desactivación por referencias activas. Esta spec replica esa arquitectura para Área, con una diferencia estructural: Área es consumida por tres dominios (QE, NC, Incidentes) en paralelo, no solo por uno (Incidentes, para Local/Zona), por lo que la regla de bloqueo de desactivación necesita agregar sobre tres stores en vez de uno.

## Goals / Non-Goals

**Goals:**
- CRUD completo de `Area` (alta, edición, desactivación, reactivación), exclusivo de `ADMINISTRADOR_SISTEMA`, en `/admin/areas`.
- Migrar los 19 valores actuales de `AREAS_SHAC` a fixtures de `Area` sin pérdida ni invención de datos, y migrar los campos que hoy almacenan el nombre de área como string libre en QE/NC/Incidentes/Usuarios a `areaId`/`areaIds` (FK), preservando qué área tenía asignada cada registro existente.
- Bloqueo de desactivación de Área con desglose por módulo (QE / NC / Incidentes) de cuántos registros activos en estado no-terminal la referencian.
- Eliminar `AREAS_SHAC` como fuente de verdad una vez migrados todos sus consumidores.

**Non-Goals:**
- Jerarquía de Áreas (sub-áreas) — lista plana, igual que se usa hoy.
- Vincular Área con Local/Zona de ADD-03 — son catálogos independientes (proceso vs. ubicación física); no se cruzan en esta spec.
- Importación masiva de Áreas — alta uno por uno, igual que Locales/Zonas.
- Validación de integridad referencial de `areaId` en los handlers MSW de QE/NC/Incidentes/Usuarios (rechazar un `areaId` inexistente al crear un QE, por ejemplo) — fuera de alcance porque el patrón de Local/Zona tampoco la implementa para `localId`/`zonaId` en Incidentes, y añadirla infla el alcance de esta spec sin que ningún criterio de aceptación (`CA-ARE-*`) del proposal la requiera. Los combobox de esos formularios siempre ofrecen únicamente IDs válidos del catálogo, por lo que el caso de un `areaId` huérfano solo podría ocurrir manipulando el request directamente.

## Decisions

### 1. Área es una lista plana sin límite de cantidad (a diferencia de Local)
Local tiene `RN-LOC-001` (máximo 5 activos) porque modela infraestructura física finita. Área es un catálogo de clasificación de proceso sin ese tipo de restricción natural — `RN-ARE-002` documenta explícitamente la ausencia de límite. Esto simplifica el CRUD de Área respecto a Local: no hay validación de cupo al crear/reactivar.

### 2. Desactivación bloqueada por 3 dominios simultáneos, no solo 1
`puedeDesactivarLocal`/`puedeDesactivarZona` reciben un solo array (`incidentes: Incidente[]`). `puedeDesactivarArea` SHALL recibir tres arrays (`qes`, `ncs`, `incidentes`) y retornar un desglose por módulo, no solo un conteo agregado — a diferencia de `BloqueoIncidentesModal` (Local/Zona), que en la implementación real solo muestra un mensaje agregado de una fuente. Se justifica el desglose real aquí porque el criterio de aceptación explícito del proposal (`CA-ARE-02`) lo pide y porque, a diferencia de Local/Zona, el usuario necesita saber en qué módulo están los registros bloqueantes para poder ir a resolverlos.

**Estados no-terminal considerados bloqueantes por dominio** (siguiendo la definición de "no-terminal" ya usada en RN-ARE-001 del proposal):
- QE: `ABIERTO`, `EN_INVESTIGACION`, `ANALISIS_COMPLETADO`, `EN_EJECUCION`, `PENDIENTE_CIERRE`, `EN_VERIFICACION` (excluye `CERRADO`, `VERIFICADO`, `REABIERTO` — este último es un motivo de auditoría, no un estado persistente real, ver `quality-event-types`).
- NC: `DETECTADA`, `EN_INVESTIGACION`, `EN_CORRECCION`, `PENDIENTE_CIERRE` (excluye `CERRADA`, `REABIERTA`... — nota: `REABIERTA` SÍ es un estado activo real en NC, a diferencia de QE; SHALL incluirse como bloqueante. Excluye `CERRADA` y `ANULADA`).
- Incidentes: `ABIERTO`, `EN_INVESTIGACION`, `ANALISIS_COMPLETADO`, `EN_EJECUCION`, `PENDIENTE_CIERRE` (excluye `CERRADO`, `ANULADO`), consistente con el conjunto ya usado por `puedeDesactivarZona` (RN-ZON-002) extendido con los dos estados adicionales del ciclo de vida de Incidente que RN-ZON-002 no necesitaba distinguir.

### 3. `puedeDesactivarArea` compara por `areaId`, no por nombre
A diferencia de hoy (donde `areaAfectada`/`areaId` almacena el nombre literal), tras la migración todos los dominios almacenan `areaId` (FK). La función de bloqueo compara `registro.areaId === area.id`, evitando cualquier ambigüedad de matching por string (mayúsculas, espacios, renombres futuros del Área).

### 4. Renombrar también `User.area` (no solo `areasAsignadas`)
El proposal original (`CA-ARE-04`) solo pide catálogo real para `areasAsignadas` del Supervisor. Sin embargo, `User.area` (área propia del usuario, todos los roles) también se popula hoy desde `AREAS_SHAC.map` en `UserFormModal.tsx`. Dado que `AREAS_SHAC` se elimina por completo (Goal explícito), dejar `User.area` como string libre sin catálogo de respaldo generaría un campo huérfano sin fuente de datos. Decisión: renombrar `User.area` → `User.areaId` (FK) en el mismo movimiento, con el mismo combobox ahora alimentado por `useAreas()`. Esto es una ampliación menor de alcance respecto al proposal explícito, documentada aquí para que quien apruebe el design la vea antes de tasks.

### 5. Migración de fixtures es determinística por nombre, no por heurística
Cada fixture existente de QE/NC/Incidente/Usuario que hoy tiene un valor de área en texto libre SHALL resolverse contra el `nombre` del `Area` fixture recién creado (case-sensitive exacto, ya que los 19 valores de `AREAS_SHAC` se copian literalmente a `areas.fixtures.ts` sin normalización). Si algún fixture existente tuviera un valor de área que no calce exactamente con ninguno de los 19 (no detectado en la investigación previa, pero a validar durante implementación), tasks.md SHALL incluir un paso explícito de auditoría de fixtures antes de la migración, no una resolución "best effort" silenciosa.

### 6. `AREAS_SHAC` se elimina al final, no se deja como alias muerto
Siguiendo el patrón de "no compatibility shims" del proyecto: una vez todos los consumidores (`QualityEventForm`, `NCForm`, `NCListFilters`, `IncidentForm`, `IncidentList`, `UserFormModal`, `DocumentForm`, `DocumentListFilters`) leen de `useAreas()`, `AREAS_SHAC` y su re-export en `src/features/documents/constants.ts` SHALL eliminarse en el mismo cambio, no marcarse `@deprecated`.

## Risks / Trade-offs

- **[Riesgo] Migración de fixtures cruzados (QE/NC/Incidentes/Usuarios) es la parte de mayor superficie de esta spec — un error de mapeo nombre→id rompe silenciosamente el área mostrada en datos de prueba existentes.** → Mitigación: `CA-ARE-03` exige verificación explícita post-migración de que cada fixture conserva su área correcta; tasks.md incluye un paso de verificación en navegador dedicado a esto, no solo tests automatizados.
- **[Riesgo] Ampliar el renombre a `User.area` (Decisión 4) no estaba en el pedido explícito del usuario.** → Mitigación: documentado explícitamente en este design.md antes de generar tasks.md, para que sea visible y objetable antes de implementación.
- **[Trade-off] No se valida integridad referencial de `areaId` en los handlers consumidores (Non-Goal explícito).** → Aceptado conscientemente porque el patrón Local/Zona ya establece este mismo trade-off para `localId`/`zonaId`, y añadirlo aquí requeriría tocar los handlers de 4 dominios sin que ningún `CA-ARE-*` lo pida.
- **[Riesgo] `Documento.area` SÍ es un campo persistido y requerido (`document-types` requirement "Documento interface"), no solo un combobox de UI — corregido durante la escritura de esta spec tras verificar el spec real; el proposal original asumía "M1 sin impacto".** → Mitigación: `document-types` y `document-schemas` se incluyen como Modified Capabilities (`Documento.area` → `areaId`, `createDocumentSchema` ajustado), `documents.fixtures.ts` se migra igual que los otros tres dominios, y `GET /api/dashboard/summary` (que hoy compara `Documento.area === usuario.area` para `documentosPendientesLectura` de `OPERARIO`) se actualiza en la misma spec (`dashboard-msw-handlers`).

## Migration Plan

1. **Fixtures y catálogo primero**: crear `areas.fixtures.ts` (semilla desde los 19 valores de `AREAS_SHAC`) y los handlers MSW de `Area` (store mutable) antes de tocar ningún consumidor — el catálogo debe existir y ser consultable antes de migrar referencias hacia él.
2. **Migrar consumidores uno por uno** (QE → NC → Incidentes → Usuarios → Documentos-UI-only), cada uno con: (a) rename de tipo/campo, (b) update de schema Zod, (c) update de fixtures del dominio resolviendo nombre→`areaId`, (d) update de formulario/filtro para usar `useAreas()` en vez de `AREAS_SHAC`, (e) tests actualizados.
3. **Eliminar `AREAS_SHAC`** solo después de confirmar (grep) que ningún archivo del repo lo importa.
4. Sin rollback formal — es un cambio de datos mock en desarrollo, no una migración de base de datos productiva; revertir es `git revert` del commit/PR correspondiente.

## Open Questions

- Ninguna pendiente de decisión humana: no se detectaron colisiones de numeración RN-ARE-*/CA-ARE-* contra specs existentes (verificado por grep antes de escribir esta spec).
