## Why

La implementación inicial de M2-S03 (NCList, filtros y badges) entregó la estructura correcta pero tiene deficiencias UX identificadas en revisión post-implementación: el filtro de Dominio no agrega valor en la tabla (ocupa columna y espacio de filtro sin que el usuario lo use para discriminar visualmente), el Área Afectada usa texto libre en lugar del select estándar de la aplicación, las fechas del filtro no muestran el formato `dd/mm/yyyy` esperado en es-PE, y no hay visibilidad de Fecha de Cierre con indicador de urgencia. Además, los componentes de paginación, barra de filtros e interlineado de tabla no están estandarizados entre M1 y M2, lo que genera inconsistencia visual y duplicación de lógica.

## What Changes

- Eliminar columna **Dominio** de la tabla NCList y el filtro de Dominio de NCListFilters.
- Agregar columna **Título** (campo `descripcion` truncado a max-w con tooltip nativo) en NCList.
- Agregar columna **Fecha de Cierre** con `DeadlineBadge` semáforo (verde/ámbar/rojo) en NCList; sin badge para CERRADA/ANULADA.
- Agregar campo `fechaCierre?: string` a `NoConformidad` (fecha límite de cierre esperada, no la fecha real de cierre).
- Agregar `NC-PRV` (Proveedor/Contratista) al enum `NCDominio` con soporte completo: tipos, constantes, fixtures, handlers MSW, schemas Zod, claves i18n.
- Reemplazar el input de texto libre de Área Afectada en NCListFilters por un `<select>` usando `AREAS_SHAC`.
- Mover `AREAS_SHAC` de `src/features/documents/constants.ts` a `src/constants/shared.constants.ts` para uso compartido entre M1 y M2. Actualizar todos los imports existentes.
- Agregar etiqueta "Fecha detección" junto a los inputs de fecha en NCListFilters para que el usuario sepa sobre qué campo filtra.
- Crear `src/components/shared/DeadlineBadge.tsx` — recibe `fechaCierre: string | null` y `estado: string`; calcula días restantes y asigna color semáforo.
- Crear `src/components/shared/Pagination.tsx` — componente genérico de paginación con ventana deslizante, "Mostrando X–Y de Z" desde i18n, reutilizable en M1 y M2.
- Crear `src/components/shared/FilterBar.tsx` — contenedor estilizado para barras de filtro, que NCListFilters y DocumentListFilters composen internamente.
- Centralizar las clases de fila de tabla en `src/constants/ui.constants.ts` (`TABLE_ROW_CLASS`) y aplicarlas en NCList y DocumentList.
- Refactorizar `NCList` para usar `Pagination` y `FilterBar` compartidos.
- Refactorizar `DocumentList` y `DocumentListFilters` para usar `Pagination`, `FilterBar` y `TABLE_ROW_CLASS`.
- Claves i18n completas en `es-PE.json` y `en-US.json` para todas las adiciones (NC-PRV, DeadlineBadge, componentes shared).

## Capabilities

### New Capabilities
- `deadline-badge`: Componente `DeadlineBadge` reutilizable que muestra Fecha de Cierre con semáforo visual (verde/ámbar/rojo) basado en días restantes. Reutilizable en M3 (Incidentes) y M4 (Quality Events).
- `shared-pagination`: Componente `Pagination` genérico extraído de NCList, reemplaza paginación inline en M1 y M2.
- `shared-filter-bar`: Componente `FilterBar` contenedor para áreas de filtro, estandariza layout entre módulos.
- `shared-constants`: Constantes de aplicación compartidas entre módulos (`AREAS_SHAC`, `TABLE_ROW_CLASS`) en `src/constants/`.

### Modified Capabilities
- `nc-list-view`: Cambios de columnas (quitar Dominio, agregar Título con truncado y Fecha de Cierre con DeadlineBadge), cambio de filtro de área (texto libre → select), etiqueta de campo en filtro de fechas, uso de componentes shared de paginación y filtros.
- `nonconformity-types`: Agregar `'PROVEEDOR'` al enum `NCDominio` (valor lógico, prefijo NC-PRV). Agregar campo opcional `fechaCierre?: string` a `NoConformidad`.

## Impact

- Modificación: `src/features/nonconformities/types/nonconformity.types.ts` (NCDominio + fechaCierre)
- Modificación: `src/features/nonconformities/constants/nonconformity.constants.ts` (agregar NC-PRV)
- Modificación: `src/features/nonconformities/components/NCListFilters.tsx` (área select, quitar dominio, etiqueta fechas)
- Modificación: `src/features/nonconformities/components/NCList.tsx` (quitar dominio, agregar título + DeadlineBadge, usar Pagination)
- Modificación: `src/mocks/fixtures/nonconformities.fixtures.ts` (agregar fechaCierre + fixture NC-PRV)
- Modificación: `src/mocks/handlers/nonconformities.handlers.ts` (soporte NC-PRV en filtros)
- Modificación: `src/features/nonconformities/schemas/createNC.schema.ts` (agregar PROVEEDOR al enum Zod)
- Modificación: `src/features/documents/constants.ts` → reemplazar `AREAS_SHAC` con re-export desde shared
- Modificación: `src/features/documents/components/DocumentList.tsx` (usar Pagination + TABLE_ROW_CLASS)
- Modificación: `src/features/documents/components/DocumentListFilters.tsx` (usar FilterBar)
- Modificación: `src/i18n/es-PE.json` y `src/i18n/en-US.json` (NC-PRV, DeadlineBadge, shared)
- Nuevo: `src/constants/shared.constants.ts` (AREAS_SHAC)
- Nuevo: `src/constants/ui.constants.ts` (TABLE_ROW_CLASS)
- Nuevo: `src/components/shared/DeadlineBadge.tsx`
- Nuevo: `src/components/shared/Pagination.tsx`
- Nuevo: `src/components/shared/FilterBar.tsx`
