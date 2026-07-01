## Context

M4-S01 y M4-S02 establecieron la capa de tipos, schemas, permisos, API client, fixtures MSW y hooks TanStack Query para Quality Events. La UI aún no existe: no hay página, no hay badges de estado/origen/tipo ni hook de composición de filtros. M4-S03 construye exclusivamente la pantalla de listado, siguiendo el patrón canónico establecido por `NCList` (M2-S03) y la `IncidentListPage` (M3-S03).

El módulo M4 tiene nueve estados de ciclo de vida (vs. siete en M2/M3), cuatro orígenes sin equivalente en módulos anteriores, y la semántica de "reincidencia" (ciclo > 1) que requiere un indicador visual propio. La página también consume `DeadlineBadge` para QEs en `EN_VERIFICACION` y aplica el semáforo de vencimiento de `getSemaforoColor`.

Restricción clave: `SeverityBadge` está tipado como `NCSeveridad` (M2). Reutilizarlo para QE requeriría ampliar o duplicar el tipo. La decisión de diseño más limpia es un `QESeverityBadge` propio que usa `QE_SEVERITY_COLORS` de `shared.constants.ts` sin tocar el componente compartido.

## Goals / Non-Goals

**Goals:**
- Página `/quality-events` con tabla paginada, filtros URL-driven (multi-select para estado/tipo/severidad/origen, select para área, date range, checkbox reincidencias), badges removibles y estados vacío/skeleton/error.
- Tres nuevos badges encapsulados: `QEStatusBadge`, `QEOriginBadge`, `QETypeBadge`.
- Un nuevo `QESeverityBadge` que reutiliza `QE_SEVERITY_COLORS` sin modificar `SeverityBadge` de M2.
- Hook `useQEList` que mapea `useSearchParams` a `useQualityEvents` (mismo patrón que `useNCList`).
- Claves i18n completas bajo `qualityEvents:list.*`.
- Registro de la ruta en el router.

**Non-Goals:**
- Formulario de creación de QE (M4-S04).
- Página de detalle de QE (M4-S05).
- Modificar `SeverityBadge` ni `NCStatusBadge` compartidos.
- Cambios a fixtures MSW o endpoints (ya completos en M4-S02).

## Decisions

### D1 — QESeverityBadge propio, no extensión de SeverityBadge
`SeverityBadge` usa `NCSeveridad` como tipo y tiene colores distintos a `QE_SEVERITY_COLORS`. Crear `QESeverityBadge` en `features/quality-events/components/` que consuma `QE_SEVERITY_COLORS` directamente mantiene el aislamiento de módulos y evita el riesgo de romper M2/M3.

**Alternativa descartada:** Hacer `SeverityBadge` genérico con un prop `colorMap`. Requeriría modificar un componente compartido y sus tests, con blast radius amplio.

### D2 — Filtros multi-select implementados con `<select multiple>` o selects repetibles
Los filtros de estado, tipo, severidad y origen admiten múltiples valores. Se codificarán como params repetidos en la URL (`?estado=ABIERTO&estado=EN_INVESTIGACION`), leyéndolos con `searchParams.getAll('estado')`. En la UI se usarán `<select>` simples (single) para cada parámetro por ahora — consistente con el patrón M2/M3. El spec no prohíbe la transición a multi-select real en un sprint posterior.

**Alternativa descartada:** Checkboxes inline en panel colapsable. Mayor complejidad de UI sin demanda expresa en los criterios de aceptación.

### D3 — Filtro "Solo reincidencias" como checkbox booleano en URL
El param `soloReincidencias=true` se lee en `useQEList` y se pasa al hook `useQualityEvents` que filtra en memoria en MSW. Consistente con cómo M2 maneja `showDeleted=true`.

### D4 — Borde izquierdo CRITICA a nivel de fila `<tr>`, no wrapper
`border-l-4 border-error` se aplica directamente al `<tr>` mediante clases condicionales (mismo patrón que M3 `EscaladoBanner` pero como estilo de fila). Tailwind permite `border-l-*` en elementos de tabla sin layout issues.

### D5 — Badge "Reincidencia ×N" solo si ciclo > 1
Se renderiza inline junto al número de QE en la celda `numero`, usando una `<span>` con `bg-orange-100 text-orange-700` (o equivalente en el design system: `bg-amber/15 text-amber`). No requiere componente separado — es una condición en la celda.

### D6 — Estructura de carpetas de componentes QE
Los badges viven en `src/features/quality-events/components/` (co-localizados), no en `src/components/shared/` porque son específicos del dominio M4. Se re-exportan desde `src/features/quality-events/index.ts`.

## Risks / Trade-offs

- **Filtros multi-select con selects simples** → Solo un valor activo por dimensión a la vez. Riesgo: el CA-QE-S03-02 pide filtrar por `severidad=CRITICA`, lo que es un valor único — compatible. Si en el futuro se requieren múltiples selecciones simultáneas, habrá que migrar la UI (los params de URL ya soportan `getAll`).
- **`useQEList` como wrapper thin** → Si `useQualityEvents` cambia su contrato, `useQEList` rompe. Mitigación: `useQEList` importa directamente del módulo de hooks, no de index barrel.
- **DeadlineBadge consumido solo para EN_VERIFICACION** → Si el contrato de `DeadlineBadge` asume `fechaCierre`, necesitará el campo `fechaVerificacionProgramada` como prop alternativo. Mitigación: el spec define la prop correcta para el QE context.
