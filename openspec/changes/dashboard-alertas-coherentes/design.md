## Context

`dashboard-layout-4-zonas` introdujo las tarjetas de "Requiere atención" (`AlertaCard`). Cada tarjeta calcula su número con una fuente y enlaza a un ancla (`#id`) que solo hace scroll, así que el número y lo que ve el usuario pueden no coincidir:

| Página | Tarjeta | Número | Destino | Problema |
|---|---|---|---|---|
| JCA | Esperan mi firma o aprobación | `QE_APROBAR_CAUSA_RAIZ` + `QE_CERRAR` | `#acciones-requeridas`, con todos los pendientes cortados en 10 | La lista no está filtrada. |
| JCA | AC vencidas | KPI-08 del summary (QE + NC + incidentes) | `#acs-por-vencer` (QE + NC, ≤ 5 días hábiles) | Son conjuntos distintos. |
| JCA | Incidentes sin QE | `incidentesSinQeVencidosTotal` | `#incidentes-sin-qe` (máx. 10 + total) | Ya coinciden: el widget muestra el total. |
| Supervisor | Esperan mi firma de cierre | `QE_FIRMAR_CIERRE` | `#acciones-requeridas` | La lista no está filtrada. |
| Supervisor | AC vencidas | `accionesCorrectivasVencidas.length` | `#acs-vencidas` | Mismo arreglo; solo es un ancla. |
| Operario | Vencidas / Por vencer | `contarAcsVencidasYPorVencer` | `#mis-acs`, con todas las AC asignadas | La lista no está filtrada. |
| Auditor | Verificaciones | `QE_VERIFICAR` | `#acciones-requeridas` | La lista no está filtrada. |
| Alta Dirección | Extensiones | `acsConSolicitudAjustePlazo.length` | `#acs-extension-plazo`, que solo muestra las PENDIENTE que requieren Gerencia | El número es más amplio que la lista. |

Refresco: `useDashboardSummary` y `useDashboardKpis` cuelgan de `['dashboard', …]`, pero nadie los invalida. Como `staleTime: 0`, al **volver** al dashboard se refetchea al montar; el problema es quedarse en la página. Además, `refetchOnWindowFocus` está **apagado globalmente** (`lib/queryClient.ts`).

## Goals / Non-Goals

**Goals:**
- Que el número de cada tarjeta sea siempre igual a la cantidad de filas que ve el usuario al hacer clic en ella.
- Que el summary y los KPI se refresquen después de cualquier acción propia y de cualquier notificación.
- Que el KPI-08 y la lista de AC vencidas usen un único predicado.

**Non-Goals:**
- Polling del dashboard.
- Cambiar el contenido de `accionesCorrectivasPorVencer` en el backend (lo consumen también los exportes).
- Cambiar las alertas de Jefe de Control Documentario, que llevan a otra pantalla (`/documentos`).

## Decisions

### D1 — Filtro en la URL (`?alerta=`) y la tarjeta como selector
- **Hook nuevo** `useAlertaSeleccionada()` (`features/dashboard/hooks/`):
  - lee `?alerta=` con `useSearchParams`;
  - expone `{ alerta, seleccionar(id), limpiar() }`;
  - escribe con `replace: true` y conserva los demás parámetros (p.ej. `periodo`), igual que `usePeriodoKpi`.
- **Clic en una tarjeta:**
  - si no está activa, la selecciona;
  - si ya está activa, la deselecciona (toggle). Así se puede quitar el filtro también desde una tarjeta cuya lista no muestra chip.
- **Scroll:**
  - El scroll suave al destino lo hace la página en el handler de clic: `document.getElementById(destino)?.scrollIntoView({ behavior: 'smooth', block: 'start' })`. Es un handler de evento, no un `useEffect`.
  - Al recargar con `?alerta=` el filtro se aplica, pero **no** se hace scroll automático. Se consideró un `useEffect` de montaje y se descartó: la regla del proyecto es no usar efectos para estado, y el scroll al recargar no es parte de lo pedido (el paso 6 de la prueba manual pide que el filtro se mantenga).
- **`AlertaCard`:**
  - con `onSelect` se renderiza como `<button type="button" aria-pressed={activa}>`;
  - activa, añade `ring-2 ring-offset-2` en el color del nivel (`ring-error`, `ring-amber`, `ring-blue-500`), con su variante `dark:` (`dark:ring-offset-surface-dark`);
  - `to` sigue siendo la vía para las tarjetas que llevan a otra pantalla. Se pasa `to` u `onSelect`, nunca los dos (unión discriminada en las props).

### D2 — Una sola fuente por tarjeta: la tabla `ALERTAS` de cada página
- Cada página declara una tabla constante `{ [id]: { tipos | predicado, destino } }`.
- El valor de la tarjeta y la lista filtrada salen de la **misma función pura** aplicada al **mismo arreglo**.
- **Acciones requeridas:**
  - La página y `AccionesRequeridasWidget` llaman a `useAccionesRequeridas()`, que deriva sus ítems de las mismas queries cacheadas por TanStack (misma fuente y mismos datos).
  - El filtro es `filtrarAccionesPorTipo(items, tipos)`, exportada desde `accionesRequeridas.utils.ts`. La usan la página (para contar) y el widget (para filtrar).
  - Se descartó pasar `items` por props al widget: el spec vigente fija que el widget consume el hook internamente y gestiona su propia carga (`dashboard-acciones-requeridas`).
- **AC del Operario:**
  - `contarAcsVencidasYPorVencer` pasa a `clasificarAcsVencidasYPorVencer`, que devuelve los **arreglos**, no los conteos.
  - La tarjeta usa `.length`, y `MisACsWidget` recibe el arreglo filtrado más la etiqueta del chip.
- **Extensiones de Alta Dirección:**
  - El filtro "solicitud PENDIENTE que requiere Gerencia" sale de `ACsExtensionPlazoWidget` a `filtrarSolicitudesGerenciaPendientes` (`alertasDashboard.utils.ts`).
  - La tarjeta cuenta ese resultado y el widget lo renderiza.
  - La lista ya es exactamente el conjunto de la tarjeta, así que la tarjeta solo se activa y hace scroll, sin chip.
- **AC vencidas del Supervisor:** igual que las extensiones de Alta Dirección (mismo arreglo, sin chip).
- **Chip:** se muestra solo en las listas que **realmente** se filtran (`AccionesRequeridasWidget` y `MisACsWidget`). En las listas que ya son el conjunto exacto, se activa la tarjeta y se hace scroll.

### D3 — `QE_CERRAR` → `QE_REGISTRAR_CIERRE` + `QE_FIRMAR_CIERRE_JCA`
- **Condiciones:**
  - `QE_REGISTRAR_CIERRE`: `estado === 'PENDIENTE_CIERRE' && !resultadoCierre`;
  - `QE_FIRMAR_CIERRE_JCA`: `estado === 'PENDIENTE_CIERRE' && !!resultadoCierre && !cerradoPorId`.
  
  Son las mismas condiciones que `QECierreSection` usa para `showClosureForm` y para el botón de firma del JCA.
- **Por qué se quita `!cierreFirmaSupervisorId`:** el predicado anterior lo exigía, pero en las dos situaciones es redundante. Sin `resultadoCierre` no hay firmas, y sin `cerradoPorId` la segunda firma no es posible.
- **Interpretación de "ambos" (Cowork):** la tarjeta "Aprobaciones y cierres pendientes" cuenta los tres tipos (`QE_APROBAR_CAUSA_RAIZ`, `QE_FIRMAR_CIERRE_JCA` y `QE_REGISTRAR_CIERRE`). **Si Toño quiso decir otra cosa, basta con quitar `QE_REGISTRAR_CIERRE` de `ALERTAS.aprobaciones.tipos` en `JefeCalidadDashboard.tsx`**, sin otros cambios.

### D4 — AC vencidas: predicado compartido y pestañas
- **Backend:**
  - Helper `DashboardKpiCalculator.EsAcVencida(string estado, DateTime plazoFecha, DateTime ahora)`, que equivale a `estado ∉ {CERRADA, COMPLETADA} && plazoFecha < ahora`.
  - Lo usan `CalcularKpi08`, `BuildSupervisor` (que ya tenía el mismo criterio, escrito aparte) y el nuevo `JefeCalidadDashboardData.AccionesCorrectivasVencidas`. Este campo es la lista **completa**, sin límite, ordenada de la más vencida a la menos y con QE, NC e incidentes.
  - `BuildJefeCalidad` recibe `nombresUsuarios`, porque las AC de incidente no denormalizan el nombre del responsable. El handler lo resuelve con `ResolveNombresParaIncidentesAsync`, como ya hace con el Operario y el Supervisor.
- **Frontend:**
  - La pestaña "Vencidas" es `summary.accionesCorrectivasVencidas`.
  - La pestaña "Por vencer" es `summary.accionesCorrectivasPorVencer` **sin las ya vencidas** (`plazoFecha >= ahora`), para que las pestañas no se solapen. El backend sigue incluyendo las vencidas en `porVencer`, porque lo consumen los exportes.
  - Los contadores de cada pestaña son el `.length` del arreglo que renderiza.
- **Divergencia con la instrucción:** la instrucción habla del "anillo del KPI-08", pero el JCA no lo muestra (`dashboard-layout-4-zonas` D7: KPI-08 pasó a la alerta). El KPI-08 de `/api/dashboard/kpis` y la lista comparten el helper, así que coinciden en cualquier consumidor.
- **Volumen:** la lista va completa. Una empresa con cientos de AC vencidas engordaría el summary, pero ese número ya es en sí una alarma. Si hiciera falta limitarla, el número de la tarjeta debe seguir saliendo de un `Count` aparte, y la pestaña debe mostrar "ver todas" con un enlace al listado.

**Nota de implementación:**
- `ACsVencidasPorVencerWidget` renderiza las dos pestañas con `SemaforoRow`, igual que `ACsVencidasWidget`, y no usa el banner crítico (`SemaforoCriticoBanner`). El banner agrupaba las AC en ROJO aparte de la lista, y eso rompía la regla "contador = filas" de la pestaña.
- `ACsPorVencerWidget` queda sin consumidor de producción. No se borra en este cambio: queda a decisión de Toño.
- Se actualizó la tabla de páginas dev de CLAUDE.md, porque `SemaforoCriticoBanner` vuelve a tener como único consumidor `/dev/semaforo-preview`.

### D5 — Refresco: `invalidarDashboard`
- **Helper:** `invalidarDashboard(queryClient)` (`features/dashboard/utils/invalidarDashboard.ts`) hace `invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.all })` y cubre el summary y los KPI de cualquier período.
- **Notificaciones:**
  - Se llama al inicio de `invalidarQueriesDeEntidad`, sin condiciones.
  - Esa función ya la usan las dos vías de entrega (el hub y el diffing del polling en `useNotificationToast`), así que cualquier notificación refresca el dashboard por cualquiera de las dos.
  - La instrucción pide hacerlo "en el hub"; esto lo cubre y además cubre la vía de polling.
- **Mutaciones:** se llama en el `onSuccess` de:
  - QE: `useCreateQualityEvent`, `useTransitionQEStatus`, `useAsignarResponsableQE`, `useUpdateQualityEvent` (guardar análisis), `useAprobarCausaRaiz`, `useCerrarQE` (iniciar cierre), `useFirmarCierre`, `useRechazarCierreQE`, `useVerificacionEficacia`, `useCreateQEAccion`, `useUpdateQEAccion` (cambiar estado de una AC), `useCerrarQEAccion`, `useRevisarAjustePlazoAC` y `useSolicitarAjustePlazoAC`;
  - NC: `useCreateAccionCorrectiva`, `useUpdateAccionCorrectiva` y `useCerrarAccionCorrectiva`;
  - incidentes: `useCreateIncident`, `useCreateIncidentOfflineSync`, `useCreateACIncidente`, `useUpdateACIncidente` y `useCerrarACIncidente`;
  - documentos: `useChangeStatus`, `useSignDocument`, `useConfirmarRevisionPeriodica`, `useCreateNuevaVersion` y `useExportarPdfControlado` (copia controlada).
  
  Las de solicitud y revisión de ajuste de plazo, y las de crear/actualizar AC, no estaban en la lista de la instrucción. Se agregan porque cambian las alertas de extensiones y de AC vencidas.
- **Divergencia:** la instrucción dice "mantener `refetchOnWindowFocus` (default de TanStack)", pero el proyecto lo tiene **apagado a nivel global** a propósito (`lib/queryClient.ts`; ver `pendientes-qe-asignacion-y-menus`). No se cambia: el refresco queda cubierto por las invalidaciones y por `staleTime: 0` al volver a montar.

### D6 — Pestaña de AC en la URL
`?alerta=acVencidas` abre la pestaña Vencidas y `?alerta=acPorVencer` abre Por vencer. Sin parámetro, la pestaña por defecto es "Vencidas" si tiene ítems, o "Por vencer" si no. Cambiar de pestaña escribe `?alerta=`, así que la tarjeta "AC vencidas" queda activa exactamente cuando la pestaña Vencidas está seleccionada desde la URL.

## Risks / Trade-offs

- [Invalidar `['dashboard']` en cada mutación también refetchea los KPI] → Es una sola query por período activo, y solo se refetchean las queries montadas.
- [La lista completa de AC vencidas engorda el summary] → Ver D4: si hace falta, se puede limitar más adelante con un `Count` aparte.
- [Quitar `QE_CERRAR` rompe a quien lo use] → Se verifica con grep que no queden usos (tipos, i18n, tests y exportes).
- [Al recargar con `?alerta=` no hay scroll automático] → El filtro y la tarjeta activa son visibles. Ver D1.

## Migration Plan

Sin migración de base de datos. El backend agrega un campo al DTO del JCA (no rompe compatibilidad). Despliegue: `dotnet build` y reinicio del backend, y luego el frontend.

## Open Questions

- D3: confirmar con Toño la interpretación de "ambos".
