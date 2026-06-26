## 1. Shared Constants y UI Constants

- [ ] 1.1 Crear `src/constants/shared.constants.ts` con `AREAS_SHAC` como `readonly string[]`
- [ ] 1.2 Crear `src/constants/ui.constants.ts` con `TABLE_ROW_CLASS` como string constante
- [ ] 1.3 Reemplazar `AREAS_SHAC` en `src/features/documents/constants.ts` con re-export desde `src/constants/shared.constants.ts`
- [ ] 1.4 Verificar que `DocumentListFilters.tsx` sigue funcionando con el re-export (no cambiar su import aún)

## 2. Tipos y Constantes NC — Agregar NC-PRV y fechaCierre

- [ ] 2.1 Agregar `'PROVEEDOR'` al tipo `NCDominio` en `nonconformity.types.ts`
- [ ] 2.2 Agregar campo `fechaCierre?: string` a la interfaz `NoConformidad` en `nonconformity.types.ts`
- [ ] 2.3 Agregar `'PROVEEDOR'` a la constante `NC_DOMINIO_VALUES` en `nonconformity.constants.ts`
- [ ] 2.4 Agregar `'PROVEEDOR'` al enum Zod en `createNC.schema.ts` (campo `dominio`)
- [ ] 2.5 Agregar claves i18n para `NC-PRV` en `es-PE.json` y `en-US.json` (`nonconformities:filters.dominio.PROVEEDOR`, `nonconformities:dominio.PROVEEDOR`)

## 3. Fixtures y Handlers MSW — NC-PRV y fechaCierre

- [ ] 3.1 Agregar `fechaCierre` a los fixtures existentes de NC con fechas representativas de los tres estados del semáforo (verde, ámbar, rojo)
- [ ] 3.2 Agregar un fixture de NC con `dominio: 'PROVEEDOR'` y `numero: 'NC-PRV-2026-001'`
- [ ] 3.3 Actualizar `nonconformities.handlers.ts` para aceptar `dominio=PROVEEDOR` en el filtro GET `/api/nonconformities`

## 4. Componente Compartido — DeadlineBadge

- [ ] 4.1 Crear `src/components/shared/DeadlineBadge.tsx` con props `fechaCierre: string | null` y `estado: string`
- [ ] 4.2 Implementar lógica de semáforo: verde (>14 días), ámbar (0–14 días), rojo (vencida), sin badge (CERRADA/ANULADA/null)
- [ ] 4.3 Formatear fecha con `Intl.DateTimeFormat` usando `{ day: '2-digit', month: 'short', year: 'numeric' }`
- [ ] 4.4 Agregar claves i18n para `DeadlineBadge` si se necesita texto localizado (e.g. `common:deadline.vencida`)

## 5. Componente Compartido — Pagination

- [ ] 5.1 Crear `src/components/shared/Pagination.tsx` con props `currentPage`, `totalPages`, `totalItems`, `pageSize`, `onPageChange`
- [ ] 5.2 Implementar sliding window de páginas (algoritmo extraído de NCList actual)
- [ ] 5.3 Implementar "Mostrando X–Y de Z" con clave i18n `common:pagination.showing`
- [ ] 5.4 Agregar clave i18n `common:pagination.showing` en `es-PE.json` y `en-US.json`
- [ ] 5.5 El componente no renderiza nada si `totalItems === 0`

## 6. Componente Compartido — FilterBar

- [ ] 6.1 Crear `src/components/shared/FilterBar.tsx` con props `children: React.ReactNode` y `className?: string`
- [ ] 6.2 Implementar como contenedor div con clases base `flex flex-wrap items-end gap-3 mb-4`

## 7. Refactorizar NCList

- [ ] 7.1 Eliminar columna **Dominio** de la tabla (header y celda en filas)
- [ ] 7.2 Agregar columna **Título**: mostrar `nc.descripcion` con clase `truncate max-w-[200px]` y atributo `title={nc.descripcion}`
- [ ] 7.3 Agregar columna **Fecha de Cierre** usando `<DeadlineBadge fechaCierre={nc.fechaCierre ?? null} estado={nc.estado} />`
- [ ] 7.4 Reemplazar lógica de paginación inline por el componente `<Pagination>` de shared
- [ ] 7.5 Aplicar `TABLE_ROW_CLASS` como base de la clase de `<tr>`, concatenando `opacity-50` condicionalmente para filas ANULADA
- [ ] 7.6 Ajustar `colSpan` de las celdas de loading/error/empty al nuevo número de columnas
- [ ] 7.7 Agregar claves i18n para el header de la columna Título (`nonconformities:list.columns.titulo`) y Fecha de Cierre (`nonconformities:list.columns.fechaCierre`) en `es-PE.json` y `en-US.json`

## 8. Refactorizar NCListFilters

- [ ] 8.1 Eliminar el filtro de **Dominio** (select y su lógica)
- [ ] 8.2 Reemplazar el `<input type="text">` de Área Afectada por `<select>` con opciones de `AREAS_SHAC` importado de `src/constants/shared.constants.ts`
- [ ] 8.3 Agregar label o texto "Fecha detección" visible junto a los inputs `fechaDesde`/`fechaHasta` (clave i18n `nonconformities:filters.fechaDeteccionLabel`)
- [ ] 8.4 Envolver el contenido del componente en `<FilterBar>` importado de shared
- [ ] 8.5 Agregar clave i18n `nonconformities:filters.fechaDeteccionLabel` en `es-PE.json` y `en-US.json`
- [ ] 8.6 Remover `dominio` del array `FILTER_PARAMS` en el componente

## 9. Refactorizar DocumentList y DocumentListFilters (M1)

- [ ] 9.1 Reemplazar la lógica de paginación inline en `DocumentList.tsx` por el componente `<Pagination>` de shared
- [ ] 9.2 Aplicar `TABLE_ROW_CLASS` como base de la clase `<tr>` en `DocumentList.tsx`
- [ ] 9.3 Envolver el contenido de `DocumentListFilters.tsx` en `<FilterBar>` importado de shared
- [ ] 9.4 Actualizar el import de `AREAS_SHAC` en `DocumentListFilters.tsx` a `src/constants/shared.constants.ts` (o mantener via re-export en `features/documents/constants.ts`)
- [ ] 9.5 Verificar que el patrón de truncado + tooltip ya está aplicado en `DocumentList.tsx`; si no, agregar `title={doc.titulo}` y clase `truncate` a la celda de título

## 10. Tests

- [ ] 10.1 Escribir test unitario para `DeadlineBadge`: verificar los tres colores de semáforo, el caso CERRADA/ANULADA y el caso null
- [ ] 10.2 Escribir test unitario para `Pagination`: verificar "Mostrando", paginación, disable de prev/next
- [ ] 10.3 Actualizar test de `NCList` / `useNCList` si existe — verificar que la columna Dominio no aparece y Título sí
