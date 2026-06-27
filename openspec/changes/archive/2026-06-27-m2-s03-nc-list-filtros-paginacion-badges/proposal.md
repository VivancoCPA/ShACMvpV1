## Why

M2-S01 y M2-S02 establecieron la capa de tipos, schemas, constantes, permisos y datos (API client, fixtures MSW, handlers y hooks TanStack Query) para No Conformidades. Sin la capa de UI, el módulo M2 no tiene presencia visible en la aplicación: los usuarios no pueden consultar, filtrar ni acceder a ninguna NC. M2-S03 entrega esa capa: la página de lista, los filtros URL-driven, la tabla paginada y los badges de estado/severidad reutilizables en M3 y M4.

## What Changes

- Nueva página `NonconformityListPage` en `/nonconformities` con título, botón "Nueva NC" restringido por rol, y composición de filtros + lista.
- Nuevo componente `NCListFilters` con filtros de dominio, severidad, estado, área, fechas y búsqueda — fuente de verdad exclusivamente en URL searchParams, debounce 300ms en búsqueda.
- Nuevo componente `NCList` con tabla paginada (ventana deslizante, pageSize configurable), fila clickeable a `/nonconformities/:id`, atenuación visual de filas ANULADA, e icono de alerta para ACs vencidas.
- Nuevo componente `NCStatusBadge` en `src/components/shared/` — cubre los 7 estados del ciclo de vida NC (ABIERTA · EN_INVESTIGACION · ANALISIS_COMPLETADO · EN_EJECUCION · PENDIENTE_CIERRE · CERRADA · ANULADA) con colores semánticos diferenciados y variantes dark mode.
- Nuevo componente `SeverityBadge` en `src/components/shared/` — 4 niveles (BAJA/MEDIA/ALTA/CRITICA) con colores del design system, reutilizable en M3 (Incidentes) y M4 (Quality Events).
- Registro de la ruta `/nonconformities` en el router con `RoleGuard` (todos los roles autenticados; OPERARIO ve solo sus NCs — filtro aplicado en MSW).
- Entrada "No Conformidades" en el Sidebar con icono lucide-react apropiado, restringida por roles según la spec `app-navigation`.
- Claves i18n completas en `es-PE.json` y `en-US.json` para el namespace `nonconformities` (etiquetas de filtros, estados, dominios, mensajes vacío/error, toasts).

## Capabilities

### New Capabilities
- `nc-list-view`: Página principal del módulo M2, filtros URL-driven, tabla paginada con badges e indicadores visuales, y hook `useNCList` que mapea URL params a `useNonconformities`.
- `nc-status-badge`: Componente pill `NCStatusBadge` para los 7 estados del ciclo de vida NC, con colores semánticos y variantes dark mode.
- `severity-badge`: Componente pill `SeverityBadge` para los 4 niveles de severidad (BAJA · MEDIA · ALTA · CRITICA), reutilizable en M3, M4 y futuros módulos.

### Modified Capabilities
- `nonconformity-types`: Actualizar `NCStatus` de 6 valores (DETECTADA/EN_CORRECCION/REABIERTA…) a 7 valores (ABIERTA/EN_INVESTIGACION/ANALISIS_COMPLETADO/EN_EJECUCION/PENDIENTE_CIERRE/CERRADA/ANULADA), alineando la terminología NC con el dominio QE. Actualizar `NCSeveridad` de 3 niveles ISO (MENOR/MAYOR/CRITICA) a 4 niveles SHAC (BAJA/MEDIA/ALTA/CRITICA). Añadir campos `dominio?: NCDominio`, `fechaDesde?: string`, `fechaHasta?: string` a `NCFilters`.
- `routing`: Agregar la ruta `/nonconformities` con `RoleGuard` al router de la aplicación. Remover `/nonconformities` del placeholder de módulos pendientes.
- `app-navigation`: Agregar entrada "No Conformidades" al Sidebar con icono `ClipboardX` de lucide-react y restricción de roles (`OPERARIO` no la ve según la spec existente).

## Impact

- Nuevo: `src/features/nonconformities/pages/NonconformityListPage.tsx`
- Nuevo: `src/features/nonconformities/components/NCListFilters.tsx`
- Nuevo: `src/features/nonconformities/components/NCList.tsx`
- Nuevo: `src/features/nonconformities/hooks/useNCList.ts`
- Nuevo: `src/components/shared/NCStatusBadge.tsx`
- Nuevo: `src/components/shared/SeverityBadge.tsx`
- Modificación: `src/router/` (agregar ruta `/nonconformities`)
- Modificación: `src/components/layout/Sidebar.tsx` (agregar ítem de navegación)
- Modificación: `src/i18n/es-PE.json` y `src/i18n/en-US.json` (namespace `nonconformities` completo)
- Depende de: `nc-query-hooks`, `nonconformity-types`, `nonconformity-constants`, `nonconformity-permissions` (todos entregados en M2-S01 y M2-S02)
- Sin modificaciones en handlers MSW, fixtures, ni schemas Zod
