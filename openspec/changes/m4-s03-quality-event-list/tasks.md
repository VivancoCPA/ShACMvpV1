## 1. Badges de dominio M4

- [x] 1.1 Crear `src/features/quality-events/components/QEStatusBadge.tsx` con los 9 estados, colores semánticos y variantes dark
- [x] 1.2 Crear `src/features/quality-events/components/QEOriginBadge.tsx` con iconos Lucide (AlertTriangle, ClipboardX, Search, Mail) y etiquetas compactas
- [x] 1.3 Crear `src/features/quality-events/components/QETypeBadge.tsx` con chips de color suave para los 4 tipos y variantes dark
- [x] 1.4 Crear `src/features/quality-events/components/QESeverityBadge.tsx` que consuma `QE_SEVERITY_COLORS` de `shared.constants.ts` (no modificar `SeverityBadge` existente)

## 2. Hook de composición de filtros

- [x] 2.1 Crear `src/features/quality-events/hooks/useQEList.ts` que lee `estado`, `tipo`, `severidad`, `origen`, `areaAfectada`, `fechaDesde`, `fechaHasta`, `soloReincidencias` y `page` de `useSearchParams`, construye `QEListParams` con `pageSize: 10` y delega a `useQualityEvents`
- [x] 2.2 Verificar que `useQEList` retorna `{ qualityEvents, isLoading, isError, pagination, refetch }` sin lógica UI

## 3. Componente QEListFilters

- [x] 3.1 Crear `src/features/quality-events/components/QEListFilters.tsx` con selects para estado (9 valores), tipo (4), severidad (4) y origen (4 con etiquetas de `QE_ORIGIN_LABELS`)
- [x] 3.2 Añadir select de `areaAfectada` poblado con `AREAS_SHAC` de `shared.constants.ts`
- [x] 3.3 Añadir inputs de fecha `fechaDesde` / `fechaHasta` con `lang="es-PE"` y `type="date"`
- [x] 3.4 Añadir checkbox "Solo reincidencias" que escribe `soloReincidencias=true` en la URL
- [x] 3.5 Implementar botón "Limpiar filtros" visible cuando hay al menos un param activo (excepto `page`), que limpia todos los params y resetea `page=1`
- [x] 3.6 Asegurar que cambiar cualquier filtro (distinto a `page`) resetea `page=1`

## 4. Componente QEList (tabla)

- [x] 4.1 Crear `src/features/quality-events/components/QEList.tsx` con 9 columnas (Número, Tipo+Origen, Descripción, Área, Severidad, Estado, Ciclo, Vencimiento, Acciones) usando `TABLE_ROW_CLASS`
- [x] 4.2 Implementar `TableSkeleton` con 5 filas de `animate-pulse` para estado `isLoading`
- [x] 4.3 Implementar estado vacío con `t('qualityEvents:list.empty')` cuando no hay resultados
- [x] 4.4 Implementar estado de error con mensaje y botón "Reintentar" que llama `refetch`
- [x] 4.5 Columna Número: font-mono, incluir badge "Reincidencia ×N" en amber si `ciclo > 1` (usando `t('qualityEvents:list.reincidencia', { count: ciclo })`)
- [x] 4.6 Columna Tipo+Origen: `QETypeBadge` + `QEOriginBadge` en la misma celda
- [x] 4.7 Columna Descripción: truncar a 80 chars con class `truncate max-w-[240px]` y `title` con texto completo
- [x] 4.8 Columna Severidad: usar `QESeverityBadge`; filas CRITICA reciben `border-l-4 border-error` en el `<tr>`
- [x] 4.9 Columna Estado: usar `QEStatusBadge`
- [x] 4.10 Columna Vencimiento: `<DeadlineBadge fechaCierre={qe.fechaVerificacionProgramada ?? null} estado={qe.estado} />` solo si `estado === 'EN_VERIFICACION'`; demás filas muestran `—`
- [x] 4.11 Columna Acciones: botón Ver (Eye) siempre visible con `aria-label` i18n; botón Editar (Pencil) solo si `getQualityEventPermissions(...).puedeEditarCabecera`
- [x] 4.12 Implementar badges removibles de filtros activos entre los filtros y la tabla (mismo patrón que `NCList`)
- [x] 4.13 Integrar `<Pagination />` pasando `currentPage`, `totalPages`, `totalItems`, `pageSize` y `onPageChange`

## 5. Página QualityEventListPage

- [x] 5.1 Crear `src/features/quality-events/pages/QualityEventListPage.tsx` con `PageWrapper`, `QEListFilters`, `ErrorBoundary` y `QEList`
- [x] 5.2 Mostrar botón "Nuevo Quality Event" solo para roles `OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST` (leer `user.rol` desde `authStore`)

## 6. Internacionalización

- [x] 6.1 Añadir claves `qualityEvents:list.*` en `src/i18n/es-PE.json`: título, columnas (numero, tipoOrigen, descripcion, area, severidad, estado, ciclo, vencimiento, acciones), `empty`, `reincidencia`, filtros (estado, tipo, severidad, origen, areaAfectada, fechaDesde, fechaHasta, soloReincidencias, limpiar, todos), acciones (nueva, ver, editar, reintentar, errorMsg)
- [x] 6.2 Añadir las mismas claves bajo `qualityEvents:list.*` en `src/i18n/en-US.json`

## 7. Router y exportaciones

- [x] 7.1 Reemplazar la ruta placeholder `/quality-events` en `src/App.tsx` (o el archivo de rutas) por `<QualityEventListPage />` dentro de `<RoleGuard>` con todos los roles autenticados
- [x] 7.2 Re-exportar `QualityEventListPage`, `QEStatusBadge`, `QEOriginBadge`, `QETypeBadge`, `QESeverityBadge` y `useQEList` desde `src/features/quality-events/index.ts`

## 8. Test unitario

- [x] 8.1 Escribir al menos un test de `QEStatusBadge` que verifique que VERIFICADO renderiza la clase de color correcto y el label esperado
