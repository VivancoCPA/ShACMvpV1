## 1. Migración de tipos M2-S01 (prerequisito)

- [x] 1.1 Actualizar `NCStatus` en `src/features/nonconformities/types/nonconformity.types.ts` de 6 valores (DETECTADA/EN_CORRECCION/REABIERTA…) a 7 valores (ABIERTA/EN_INVESTIGACION/ANALISIS_COMPLETADO/EN_EJECUCION/PENDIENTE_CIERRE/CERRADA/ANULADA)
- [x] 1.2 Actualizar `NCSeveridad` en el mismo archivo de 3 niveles (MENOR/MAYOR/CRITICA) a 4 niveles SHAC (BAJA/MEDIA/ALTA/CRITICA)
- [x] 1.3 Añadir campos `dominio?: NCDominio`, `fechaDesde?: string`, `fechaHasta?: string` a la interfaz `NCFilters`
- [x] 1.4 Actualizar las fixtures existentes en `src/mocks/fixtures/nonconformities.fixtures.ts` para sustituir los valores anteriores de `NCStatus` (DETECTADA→ABIERTA, EN_CORRECCION→EN_EJECUCION, REABIERTA→ANULADA, etc.) y `NCSeveridad` (MENOR→BAJA, MAYOR→ALTA) por los nuevos valores
- [x] 1.5 Ampliar `nonconformities.fixtures.ts` de las NCs actuales a mínimo 18 — añadir las NCs necesarias para cubrir la distribución requerida: al menos 3 con `severidad: 'CRITICA'`, 2 con `estado: 'ANULADA'`, 3 con al menos una AC en `estado: 'VENCIDA'`, y `fechaDeteccion` distribuida en los últimos 6 meses (no todas en la misma fecha); objetivo: paginación con pageSize 5 visible desde el primer render sin crear datos manualmente
- [x] 1.6 Actualizar los handlers MSW de M2-S02 (`src/mocks/handlers/nonconformities.handlers.ts`) para reflejar los nuevos estados y severidades (incluyendo `NC_STATE_TRANSITIONS`)
- [x] 1.7 Actualizar `getNCPermissions` en `src/features/nonconformities/utils/ncPermissions.ts` para la nueva máquina de estados NCStatus

## 2. Componentes shared — badges

- [x] 2.1 Crear `src/components/shared/SeverityBadge.tsx` con el mapa de colores exhaustivo: BAJA=muted-soft/20, MEDIA=amber/20, ALTA=error/10, CRITICA=error/20 font-semibold; etiquetas desde `t('common:severity.<level>')`; variantes `dark:`
- [x] 2.2 Añadir claves `common.severity.BAJA/MEDIA/ALTA/CRITICA` a `src/i18n/es-PE.json` y `src/i18n/en-US.json`
- [x] 2.3 Crear `src/components/shared/NCStatusBadge.tsx` con el mapa de colores exhaustivo para los 7 estados NC; etiquetas desde `t('nonconformities:status.<estado>')`; ANULADA con `line-through`; variantes `dark:`
- [x] 2.4 Añadir claves `nonconformities.status.*` (7 estados) a `es-PE.json` y `en-US.json`

## 3. Hook useNCList

- [x] 3.1 Crear `src/features/nonconformities/hooks/useNCList.ts` que lea `search`, `estado`, `dominio`, `severidad`, `areaAfectada`, `fechaDesde`, `fechaHasta`, `page` de `useSearchParams`, construya un `NCFilters` con `pageSize: 5` y delegue a `useNonconformities()`
- [x] 3.2 Verificar que el hook retorna `{ nonconformidades, isLoading, isError, pagination, refetch }` sin lógica UI

## 4. Componente NCListFilters

- [x] 4.1 Crear `src/features/nonconformities/components/NCListFilters.tsx` con selects para dominio (NC-CAL/NC-SST/NC-ADU/NC-OPE), severidad (BAJA/MEDIA/ALTA/CRITICA) y estado (7 opciones NCStatus); inputs de texto para `areaAfectada`; date inputs para `fechaDesde`/`fechaHasta`; campo `search` con debounce 300ms
- [x] 4.2 Implementar toda la lógica de filtros exclusivamente via `useSearchParams` — cero `useState` para valores de filtro
- [x] 4.3 Implementar botón "Limpiar filtros" visible solo cuando hay al menos un param activo; al hacer click, elimina todos los params (incluyendo `page`)
- [x] 4.4 Implementar reset automático de `page` a 1 al cambiar cualquier filtro que no sea `page`
- [x] 4.5 Añadir claves i18n de filtros (`nonconformities:filters.*`) a `es-PE.json` y `en-US.json`

## 5. Componente NCList

- [x] 5.1 Crear `src/features/nonconformities/components/NCList.tsx` con columnas: Número NC, Dominio, Área Afectada, Severidad (SeverityBadge), Estado (NCStatusBadge), Responsable AC, Fecha Detección, Acciones
- [x] 5.2 Implementar estado de carga: 5 filas skeleton con `bg-hairline animate-pulse`
- [x] 5.3 Implementar estado vacío: mensaje `t('nonconformities:list.empty')` sin filas
- [x] 5.4 Implementar estado de error: mensaje de error + botón "Reintentar" que llama `refetch`
- [x] 5.5 Implementar click en fila → `navigate('/nonconformities/:id')`
- [x] 5.6 Implementar atenuación de filas ANULADA: clase `opacity-50`, sin botones de escritura en Acciones
- [x] 5.7 Implementar indicador de ACs vencidas: ícono de alerta con `text-error` y `aria-label` cuando `nc.accionesCorrectivas.some(ac => ac.estado === 'VENCIDA')` y `nc.estado !== 'CERRADA' && nc.estado !== 'ANULADA'`
- [x] 5.8 Implementar paginación con ventana deslizante y texto "Mostrando X–Y de Z" desde i18n
- [x] 5.9 Añadir claves i18n de lista (`nonconformities:list.*`) a `es-PE.json` y `en-US.json`

## 6. Página NonconformityListPage

- [x] 6.1 Crear `src/features/nonconformities/pages/NonconformityListPage.tsx` que componga `NCListFilters` + `NCList` dentro de `PageWrapper` con título `t('nonconformities:list.title')`
- [x] 6.2 Añadir botón "Nueva NC" visible solo para roles `SUPERVISOR` y `JEFE_CALIDAD_SYST` (leer rol desde `authStore`)
- [x] 6.3 Envolver `NCList` en un `ErrorBoundary` para que los filtros sigan activos cuando la lista falla

## 7. Enrutamiento y navegación

- [x] 7.1 Registrar la ruta `/nonconformities` en el router con `<RoleGuard>` que permita acceso a todos los roles autenticados, renderizando `NonconformityListPage`
- [x] 7.2 Remover `/nonconformities` (o `/no-conformidades`) del listado de rutas placeholder
- [x] 7.3 Añadir ítem "No Conformidades" al Sidebar con ícono `ClipboardX` de lucide-react, path `/nonconformities`, oculto para rol `OPERARIO`
- [x] 7.4 Añadir clave `common:nav.nonconformities` a `es-PE.json` ("No Conformidades") y `en-US.json` ("Non-Conformities")

## 8. Verificación

- [x] 8.1 Verificar Light Mode y Dark Mode sin defectos visuales en NCStatusBadge (7 estados) y SeverityBadge (4 niveles)
- [x] 8.2 Verificar que los filtros URL-driven persisten al recargar la página y al usar el botón "atrás"
- [x] 8.3 Verificar que el reset de `page` a 1 funciona al cambiar cualquier filtro
- [x] 8.4 Verificar que usuario OPERARIO no ve el ítem NC en el Sidebar ni el botón "Nueva NC"
- [x] 8.5 Verificar que fila ANULADA aparece con `opacity-50` y sin botones de escritura
- [x] 8.6 Verificar que el indicador de ACs vencidas aparece/no aparece correctamente según el estado de las ACs embebidas
- [x] 8.7 Escribir al menos un test unitario para `useNCList` (mapping de URL params a NCFilters)
- [x] 8.8 Escribir al menos un test unitario para `NCStatusBadge` (cobertura de los 7 estados)
- [x] 8.9 Escribir al menos un test unitario para `SeverityBadge` (cobertura de los 4 niveles)
