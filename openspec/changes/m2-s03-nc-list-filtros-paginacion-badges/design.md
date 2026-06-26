## Context

M2-S01 y M2-S02 entregaron la capa de tipos (`NCStatus`, `NCTipo`, `NCSeveridad`, `NoConformidad`, `AccionCorrectiva`, `NCDominio`) y la capa de datos (API client, 8 fixtures, 8 handlers MSW, 8 hooks TanStack Query). M2-S03 construye la capa de presentación sobre esa base.

El backend aún no existe; MSW v2 es la única fuente de datos. El flujo de tres capas es inmutable:

```
NonconformityListPage → useNCList → useNonconformities → nonconformities.api.ts → MSW → fixtures
```

Adicionalmente, M2-S03 introduce dos correcciones de terminología que requieren actualizar los tipos definidos en M2-S01:
1. **NCStatus** se renombra de la terminología `DETECTADA/EN_CORRECCION/REABIERTA` a `ABIERTA/EN_INVESTIGACION/ANALISIS_COMPLETADO/EN_EJECUCION/PENDIENTE_CIERRE/CERRADA/ANULADA`, alineando el ciclo de vida de NCs con la nomenclatura del dominio SHAC y con el `QEStatus` del CLAUDE.md.
2. **NCSeveridad** se expande de 3 niveles ISO (MENOR/MAYOR/CRITICA) a 4 niveles SHAC (BAJA/MEDIA/ALTA/CRITICA), compatibles con el `QESeverity` de M4 y el `SeverityBadge` compartido.

Ambos cambios son breaking en los tipos TypeScript pero son cambios coherentes de schema — los fixtures y handlers MSW de M2-S02 deben actualizarse en consecuencia (fuera del scope de este spec; se trackea en Open Questions).

## Goals / Non-Goals

**Goals:**
- Página `/nonconformities` completamente funcional con filtros URL-driven, tabla paginada y estados de carga/vacío/error.
- `NCListFilters` sin estado local paralelo: única fuente de verdad en URL searchParams (patrón idéntico a M1).
- `NCList` con columnas: Número NC, Dominio, Área, Severidad, Estado, Responsable AC, Fecha, Acciones — filas ANULADA atenuadas, indicador de ACs vencidas.
- `NCStatusBadge` cubre los 7 estados del nuevo ciclo de vida, con colores semánticos y dark mode.
- `SeverityBadge` genérico con 4 niveles (BAJA/MEDIA/ALTA/CRITICA), reutilizable en M3 y M4.
- Ruta `/nonconformities` en router con `RoleGuard` (todos los roles autenticados).
- Entrada "No Conformidades" en Sidebar, oculta para OPERARIO.
- i18n completa: namespace `nonconformities` con valores reales en `es-PE.json` y `en-US.json`.

**Non-Goals:**
- Formulario de creación de NC (`NonconformityForm`) — M2-S04.
- Vista de detalle de NC (`NonconformityDetailPage`) — M2-S05.
- Actualización de fixtures y handlers MSW de M2-S02 para reflejar NCStatus/NCSeveridad nuevos — se trackea como deuda técnica.
- Integración real con backend.
- Pruebas de integración E2E.

## Decisions

### D1 — URL searchParams como única fuente de verdad para filtros

**Decision:** `NCListFilters` usa `useSearchParams` de react-router-dom para leer y escribir todos los filtros. Cero `useState` para valores de filtro. Igual al patrón de `DocumentListFilters` de M1-S03.

**Rationale:** (a) URLs filterables son compartibles y bookmarkeables. (b) El botón "atrás" del navegador restaura el estado de filtros gratuitamente. (c) Un solo lugar de verdad elimina la posibilidad de drift entre estado UI y URL.

**Alternativa descartada:** `useState` local con sincronización a URL. Rechazada: requiere lógica de sincronización bidireccional propensa a bugs, y viola el patrón establecido en M1.

### D2 — NCStatusBadge como componente separado de StatusBadge

**Decision:** Se crea `src/components/shared/NCStatusBadge.tsx` separado de `src/components/shared/StatusBadge.tsx` (que cubre `DocStatus | QEStatus`). El componente `NCStatusBadge` acepta `status: NCStatus`.

**Rationale:** Los estados NC (ABIERTA, EN_INVESTIGACION, ANALISIS_COMPLETADO, EN_EJECUCION, PENDIENTE_CIERRE, CERRADA, ANULADA) son un conjunto diferente a `DocStatus` y `QEStatus`. Añadir NC a `StatusBadge` crearía una unión de 20+ valores y rompería el tipado estricto. Separar por dominio es más claro y permite colores independientes.

**Alternativa descartada:** Extender `StatusBadge` con `NCStatus`. Rechazada: viola el principio de responsabilidad única del componente y complica el mapa de colores.

### D3 — SeverityBadge genérico con 4 niveles SHAC

**Decision:** `SeverityBadge` acepta `severity: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'` — la escala de 4 niveles usada en QE (CLAUDE.md). `NCSeveridad` se actualiza a este mismo conjunto en la spec `nonconformity-types`.

**Rationale:** (a) Unificar la escala de severidad entre M2 (NC), M3 (Incidentes) y M4 (QE) elimina fricciones de UX (un solo mapa mental para el usuario). (b) Un badge genérico se reutiliza sin adapter en los tres módulos. (c) La escala ISO 9001 (MENOR/MAYOR/CRITICA) se adapta al vocabulario operacional SHAC.

**Alternativa descartada:** Mantener NCSeveridad MENOR/MAYOR/CRITICA y crear un adaptador. Rechazada: añade complejidad sin beneficio y confunde al usuario que ve "MAYOR" en NCs y "ALTA" en QEs para el mismo concepto.

### D4 — Filtro "Tipo" en NCListFilters = NCDominio

**Decision:** El filtro de "Tipo" en `NCListFilters` corresponde a `NCDominio` (CALIDAD/SST/ADUANERO/OPERACIONAL) y se muestra como opciones "NC-CAL", "NC-SST", "NC-ADU", "NC-OPE". El URL param se llama `dominio` (no `tipo`) para evitar ambigüedad con `NCTipo` (PROCESO/PRODUCTO/SERVICIO).

**Rationale:** Los usuarios identifican las NCs por su prefijo de número (NC-CAL-2025-001). El filtro más útil en la lista es por dominio de negocio. `NCTipo` (tipo de defecto) es un campo de detalle relevante en la vista individual, no en la lista.

**Alternativa descartada:** Filtro por `NCTipo` (PROCESO/PRODUCTO/SERVICIO/SISTEMA/SST). Rechazada: los usuarios piensan en "¿qué área?" antes que "¿qué tipo de defecto?", y NC-CAL/SST/ADU/OPE es la clasificación de primer nivel.

### D5 — NCStatus actualizado a 7 estados con terminología unificada

**Decision:** El nuevo `NCStatus` es `'ABIERTA' | 'EN_INVESTIGACION' | 'ANALISIS_COMPLETADO' | 'EN_EJECUCION' | 'PENDIENTE_CIERRE' | 'CERRADA' | 'ANULADA'`. La máquina de estados sigue el flujo lineal más anulación como terminal negativo (sin reapertura de ciclo en M2 — diferencia con QE).

**Rationale:** (a) Alinea con la terminología del dominio SHAC y con el QEStatus (facilitando que los desarrolladores piensen en un modelo unificado). (b) ANULADA como estado terminal es más claro que REABIERTA para el flujo de NC (las reaperturas en M2 van a un nuevo QE via `qeGeneradoId`). (c) ANALISIS_COMPLETADO y EN_EJECUCION siguen los pasos de acciones correctivas sin ambigüedad.

**Alternativa descartada:** Mantener DETECTADA/EN_CORRECCION/REABIERTA de M2-S01. Rechazada: inconsistente con el dominio QE y con el vocabulario de NCS del brief del usuario para M2-S03.

### D6 — Indicador de ACs vencidas computado client-side

**Decision:** La columna de ACs vencidas en `NCList` computa `nc.accionesCorrectivas.some(ac => ac.estado === 'VENCIDA')` en render-time. No hay campo precalculado en el backend ni en los fixtures.

**Rationale:** El estado VENCIDA de las ACs está embebido en el detalle de NC (D5 de M2-S02). Computar client-side es correcto para el MVP dado el bajo número de ACs por NC (≤3 según fixtures). Si el volumen crece, se puede añadir un campo `tieneACsVencidas: boolean` en el endpoint de lista.

**Alternativa descartada:** Campo precalculado `tieneACsVencidas` en el endpoint de lista. Rechazada: requiere cambio en la ApiResponse shape del handler MSW sin necesidad real en el MVP.

### D7 — pageSize configurable con default 5 en development

**Decision:** El hook `useNCList` usa `pageSize: 5` por defecto (vs 20 en M1-S03) para facilitar el testing de paginación con los 8 fixtures disponibles. El valor es configurable como prop del componente.

**Rationale:** Con solo 8 fixtures, pageSize 20 mostraría todos en la primera página sin ejercitar la paginación. pageSize 5 produce 2 páginas completas, permitiendo verificar el comportamiento de la ventana deslizante.

## Risks / Trade-offs

- **[Risk] NCStatus breaking change respecto a M2-S01** → Los tipos en `nonconformity.types.ts`, los fixtures y los handlers MSW usarán los valores anteriores hasta que se actualicen explícitamente. La app fallará en TypeScript con errores de tipo. Mitigation: actualizar `nonconformity.types.ts` antes de implementar los componentes de esta spec.

- **[Risk] NCSeveridad cambia de 3 a 4 niveles** → Los fixtures y handlers de M2-S02 que usen MENOR/MAYOR/CRITICA generarán errores TypeScript. Mitigation: misma acción que el punto anterior — actualizar el tipo y fixtures en una tarea inicial de M2-S03.

- **[Risk] OPERARIO ve solo sus NCs** → El filtro se aplica en el handler MSW (D2 de M2-S02). Si el handler no filtra por `reportadoPorId` del usuario autenticado cuando el rol es OPERARIO, todos los usuarios verán todas las NCs. Mitigation: verificar en handler que `GET /api/nonconformities` aplica este filtro.

- **[Risk] Ventana deslizante de paginación fuera de sync con URL** → Si el usuario navega a página 3 y luego aplica un filtro, la página debe resetearse a 1. Mitigation: `NCListFilters` debe resetear el param `page` a 1 al cambiar cualquier otro filtro.

## Open Questions

- ¿Se actualiza en M2-S03 el handler MSW `GET /api/nonconformities` para filtrar por rol OPERARIO, o se trackea como deuda M2-S02? → Por ahora se asume que el handler ya aplica el filtro (comentado en M2-S02 diseño).
- ¿El botón "Nueva NC" está disponible para OPERARIO (reporte de campo) o solo para roles de supervisión? → Decisión pendiente del negocio. Esta spec lo deja abierto con `canCreate` definido como SUPERVISOR | JEFE_CALIDAD_SYST.
- ¿Los fixtures de M2-S02 se actualizan en una tarea de M2-S03 o en un hotfix separado de M2-S02? → Se incluirá como primera tarea en `tasks.md` de M2-S03.
