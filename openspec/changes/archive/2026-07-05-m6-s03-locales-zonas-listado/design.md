## Context

`useLocales()` (M6-S02) devuelve `Local[]` plano, sin Zonas embebidas — solo `useLocal(id)` (detalle) devuelve `LocalConZonas`. El diseño validado con Toño necesita, en el listado colapsado, un contador "X de Y zonas activas" por cada Local, y al expandir, la lista completa de Zonas de ese Local. Ninguno de esos dos usos calza exactamente con los hooks existentes: el primero necesitaría N llamadas a `useLocal(id)` solo para contar, y el segundo si se resuelve con `useLocal(id)` on-demand duplicaría la petición ya hecha para el contador.

Además, el mockup pide un "indicador de incidentes activos" junto a cada Zona. El módulo de Incidentes (M3) no expone un filtro por `localId`/`zonaId` ni en `IncidentFilters` ni en la UI de `/incidents` — solo `tipo`, `estado`, `severidad`, `areaId`, fechas, `search`, `showDeleted`. Extender ese filtro es un cambio de M3, fuera del alcance declarado de esta spec.

Por último, el mockup usa filas expandibles en vez de una vista de detalle separada, lo que deja sin uso la ruta `/admin/locales/:id` que M6-S01 registró como placeholder de detalle.

## Goals / Non-Goals

**Goals:**
- Construir `LocalList` como único punto de administración/consulta de Locales y Zonas, con filas expandibles, contadores, acciones inline y permisos.
- Resolver el contador de zonas por Local y el indicador de incidentes por Zona con una sola carga adicional de datos cada uno (no N+1), sin modificar M3 (Incidentes) ni los handlers MSW de M6-S02.
- Reutilizar `puedeDesactivarLocal`/`puedeDesactivarZona` (M6-S01) en el cliente para que el indicador visible coincida exactamente con lo que el backend evaluará al desactivar (mismo criterio de "bloqueante").
- Dejar `/admin/locales/:id` y las futuras rutas de formulario (`/admin/locales/new`, `/admin/locales/:localId/zonas/new`) en un estado coherente para M6-S04, sin construir los formularios.

**Non-Goals:**
- No se construyen `LocalForm`/`ZonaForm` (M6-S04); las rutas de creación quedan como placeholder `🚧 Próximamente`.
- No se modifica `IncidentFilters`, `getIncidents`, ni el handler `/api/incidents` para soportar `localId`/`zonaId` como query param — el conteo de incidentes por Zona se calcula en el cliente.
- No se modifican los handlers MSW de `locales.handlers.ts` (M6-S02); el único endpoint nuevo consumido (`GET /api/zonas`) ya existe.
- No se implementa el destino de login por defecto de `ADMINISTRADOR_SISTEMA`.

## Decisions

### 1. Contador de zonas por Local: `useZonas()` (todas las Zonas en una sola query) + agrupación client-side por `localId`
Se agrega `listarZonas(): Promise<Zona[]>` a `features/locations/api/locales.api.ts` (llama `GET /api/zonas`, que ya existe y ya soporta filtrar opcionalmente por `localId` — aquí se invoca sin filtro) y `useZonas()` a `features/locations/hooks/useLocales.ts` (query key `['locationsAdmin', 'zonas']`). `LocalList` combina `useLocales()` + `useZonas()` y agrupa por `localId` en memoria para calcular "X de Y zonas activas" de cada fila colapsada y para poblar el contenido expandido — una sola petición adicional total, no una por Local.
**Alternativa descartada**: usar `useLocal(id)` (detalle con Zonas embebidas) para cada Local visible. Con máximo 5 Locales activos (RN-LOC-001) el costo de red sería tolerable, pero duplicaría lógicamente la fuente de verdad de "Zonas de un Local" (detalle embebido vs. lista plana ya expuesta por `GET /api/zonas`) y dejaría el contador del header sin resolver antes de expandir ninguna fila.
**Alternativa descartada**: extender `GET /api/locales` para embeber Zonas o conteos. Es un cambio a `location-admin-mocks`, capability que M6-S02 ya cerró sin ese requisito; añadirlo ahí para un caso de uso puramente de presentación no se justifica cuando `GET /api/zonas` ya resuelve el dato sin tocar handlers.

### 2. Indicador de incidentes activos por Zona: `useIncidents()` con `pageSize` amplio + conteo client-side reutilizando `puedeDesactivarZona`
`LocalList` llama `useIncidents({ pageSize: 500 })` (una sola vez, no por Zona) y, para cada Zona visible, invoca `puedeDesactivarZona(zona, incidentes.items)` (helper puro de M6-S01) para obtener `incidentesBloqueantes`. Ese mismo número es el que se muestra junto a la Zona — así el usuario ve, antes de intentar desactivar, el mismo conteo que explicaría un eventual 409.
**Alternativa descartada**: agregar `localId`/`zonaId` a `IncidentFilters` y al handler `/api/incidents`. Resolvería el problema de forma más general pero modifica capabilities de M3 (`incident-api-client`, `incident-msw-handlers`) fuera del alcance declarado; se deja como mejora futura si el volumen real de incidentes crece más allá de lo que un `pageSize` amplio puede traer en una sola página.
**Trade-off aceptado**: `pageSize: 500` asume que el set de incidentes (fixtures + creados en la sesión de desarrollo) no supera ese umbral; es razonable para el estado actual del mock y no afecta producción (el backend real no existe todavía).

### 3. "Ver incidentes" desde el modal de bloqueo (409) no es un enlace funcional
El modal de bloqueo (Local y Zona) muestra el conteo/desglose de incidentes bloqueantes con un botón "Ver incidentes" deshabilitado (o ausente, a decidir en implementación según claridad visual) más una nota de que el filtrado por Local/Zona en `/incidents` está pendiente (fuera de alcance, ver Decisión 2). Se documenta explícitamente en vez de simular un enlace que no filtra nada.

### 4. `/admin/locales/:id` pasa de placeholder a `<Navigate to="/admin/locales" replace />`
El patrón de filas expandibles cubre completamente la necesidad de "ver el detalle de un Local con sus Zonas" sin navegación. Mantener la ruta (en vez de eliminarla) preserva compatibilidad con cualquier enlace externo/bookmark ya generado y con el `RoleGuard` ya probado en `locationsAccess.test.tsx`; solo cambia qué renderiza. El test existente que verificaba el texto placeholder de detalle se actualiza para verificar el redirect.
**Alternativa descartada**: eliminar la ruta. Rompería el guard ya cubierto por tests de regresión sin necesidad — un redirect es más seguro y no requiere tocar `RoleGuard` ni el árbol de rutas más de lo mínimo.

### 5. "Nuevo local"/"Nueva zona" navegan a rutas placeholder reales, no a un modal
Siguiendo el patrón ya establecido en `NonconformityListPage` (`navigate('/nonconformities/new')` hacia una página dedicada, no un modal), "Nuevo local" navega a `/admin/locales/new` y "Nueva zona" (al final de la lista expandida de un Local) navega a `/admin/locales/:localId/zonas/new`. Ambas rutas se registran en esta spec como placeholder `🚧 Próximamente` bajo el mismo `RoleGuard` que ya protege `/admin/locales`, y M6-S04 reemplaza el contenido por `LocalForm`/`ZonaForm` reales. Se prefiere página sobre modal para mantener consistencia de UX con NC/QE y porque un formulario con archivo (`planoUrl`, RN-LOC-003) es más natural en página completa que en modal.

### 6. Modales de desactivar/reactivar: componentes locales a `features/locations/components/`, sin dependencia de un `Modal` genérico
No existe un componente `Modal`/`Dialog` compartido en `components/ui/`; NC y QE construyen su propio modal inline por caso de uso (`AnularNCModal`, `DeleteConfirmModal`/`RestoreConfirmModal` en `NCList.tsx`). Esta spec sigue el mismo patrón: `ConfirmarDesactivarModal` (reutilizable para Local y Zona vía props) y `BloqueoIncidentesModal` (desglose 409), ambos con el mismo look and feel (`fixed inset-0 ... bg-ink/40`, botones `disabled={isPending}`) ya usado en `NCList.tsx`/`AnularNCModal.tsx`.

### 7. Reactivar sin modal, error 400 vía `toast.error`
`useReactivarLocal`/`useReactivarZona` (ya existentes de M6-S02) ya hacen `toast.success`/`toast.error` genérico internamente (`toasts.localReactivarError`, sin interpolar el mensaje del servidor). Para RN-LOC-001 (400 al reactivar con 5 locales activos ya alcanzados) el mensaje específico del backend es más útil que el genérico del hook; `LocalList` engancha `onError` a nivel de `mutate(id, { onError: (error) => toast.error(...) })` además del `onError` del hook — el toast genérico del hook se dispara primero (ya lo hace hoy) y el flujo de la UI no necesita suprimirlo: es aceptable ver el toast genérico seguido del specific, o bien (decisión de implementación) ajustar el hook `useReactivarLocal` para intentar leer `error.response.data.message` igual que ya hace `useDesactivarLocal`, mantenimiento consistencia entre ambos hooks de reactivar. Se opta por esta segunda opción: alinear `useReactivarLocal`/`useReactivarZona` con el mismo `getServerErrorMessage` que ya usan los hooks de desactivar (extendido a status 400 además de 409), evitando lógica adicional en el componente.

## Risks / Trade-offs

- **[Riesgo] `pageSize: 500` en `useIncidents` para calcular el indicador de Zona** podría quedarse corto si el fixture de incidentes crece mucho → **Mitigación**: es un valor de mock; se documenta la limitación y no aplica a producción (backend real aún no existe).
- **[Riesgo] Ajustar `getServerErrorMessage` a 400 además de 409 en `useReactivarLocal`/`useReactivarZona`** modifica hooks ya archivados de M6-S02 → **Mitigación**: es un cambio acotado y aditivo (extiende el status code que ya intercepta), cubierto por tests nuevos en esta spec; no cambia el contrato de éxito ni de invalidación de cache.
- **[Trade-off] Sin enlace funcional "Ver incidentes"** desde el modal de bloqueo → aceptado explícitamente (Decisión 3); documentado como pendiente para cuando `/incidents` soporte filtrar por Local/Zona.
- **[Riesgo] `locationsAccess.test.tsx` depende del texto placeholder de `/admin/locales/:id`** → **Mitigación**: se actualiza como parte de esta spec (tarea explícita), verificando el redirect en vez del texto.

## Open Questions

Ninguna pendiente — las dos ambigüedades señaladas en el brief (patrón de "Nuevo local": página vs. modal; destino de `/admin/locales/:id`) se resolvieron en las Decisiones 5 y 4 respectivamente.
