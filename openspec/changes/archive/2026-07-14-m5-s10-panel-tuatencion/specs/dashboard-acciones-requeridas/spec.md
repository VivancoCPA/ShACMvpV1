## ADDED Requirements

### Requirement: useAccionesRequeridas agrega ítems accionables por usuario, no por área ni rol genérico
El sistema SHALL exportar un hook `useAccionesRequeridas()` en `src/features/dashboard/hooks/useAccionesRequeridas.ts` que retorna `{ acciones: AccionRequerida[]; isLoading: boolean }`, donde `AccionRequerida` es `{ id: string; dominio: 'QE' | 'AC' | 'DOCUMENTO'; tipo: string; titulo: string; referencia: string; prioridad: 'normal' | 'alta'; fechaLimite?: string; href: string }`. El hook SHALL obtener sus datos llamando directamente a `useQualityEvents({ pageSize: 200 })`, `useNonconformities({ pageSize: 200 })`, `useIncidents({ pageSize: 200 })` y `useDocuments({ pageSize: 200 })` — nunca a `useQEList()`, `useNCList()`, `useIncidentList()` ni `useDocumentList()`, que están acoplados a `useSearchParams()` de la ruta actual y truncan a `pageSize: 10`. `isLoading` SHALL ser `true` mientras cualquiera de las cuatro queries esté cargando.

#### Scenario: El hook no usa los hooks acoplados a la URL de listado
- **WHEN** se inspecciona `useAccionesRequeridas.ts`
- **THEN** no importa `useQEList`, `useNCList`, `useIncidentList` ni `useDocumentList`

#### Scenario: isLoading refleja las cuatro queries
- **WHEN** la query de Documentos sigue cargando pero las otras tres ya resolvieron
- **THEN** `useAccionesRequeridas().isLoading` es `true`

---

### Requirement: Ítems de QE replican la lógica real de gating de cada componente de detalle
El hook SHALL derivar ítems de dominio `QE` reproduciendo exactamente las condiciones ya usadas por los componentes de detalle correspondientes, no una versión simplificada de `getQualityEventPermissions`:
- `JEFE_CALIDAD_SYST`, causa raíz: `qe.estado ∈ {'EN_INVESTIGACION', 'ANALISIS_COMPLETADO'} && !qe.causaRaizFirmadaEn`.
- `JEFE_CALIDAD_SYST`, cerrar: `qe.estado === 'PENDIENTE_CIERRE' && !qe.cierreFirmaSupervisorId && (!qe.resultadoCierre || !qe.cerradoPorId)`.
- `SUPERVISOR` o `ALTA_DIRECCION`, firmar cierre: `qe.estado === 'PENDIENTE_CIERRE' && !!qe.cerradoPorId && !qe.cierreFirmaSupervisorId && user.rol === resolveRolSegundaFirma(qe.cerradoPorId, qe.areaAfectada)`.
- `JEFE_CALIDAD_SYST`, verificar: `qe.estado === 'EN_VERIFICACION'`.
- `AUDITOR_INTERNO`, verificar: `qe.estado === 'EN_VERIFICACION' && qe.auditorAsignadoId === user.id`.

Un QE que no cumple ninguna condición para el rol del usuario actual SHALL quedar excluido del panel — el hook NUNCA SHALL usar `getQualityEventPermissions(...).puedeCerrar` ni `.puedeFirmarCierre` directamente para decidir inclusión, dado que ambos flags son más amplios que la acción real pendiente en ese momento.

#### Scenario: JEFE_CALIDAD_SYST no ve un QE PENDIENTE_CIERRE que ya firmó
- **WHEN** un QE está en `PENDIENTE_CIERRE` con `resultadoCierre` y `cerradoPorId` ya establecidos (falta solo la segunda firma)
- **THEN** ese QE no aparece en el panel de un usuario `JEFE_CALIDAD_SYST` (la acción pendiente ya no es suya)

#### Scenario: SUPERVISOR ve el QE cuando le corresponde la segunda firma
- **WHEN** un QE está en `PENDIENTE_CIERRE` con `cerradoPorId` establecido y `resolveRolSegundaFirma(cerradoPorId, areaAfectada)` retorna `'SUPERVISOR'`
- **THEN** ese QE aparece en el panel de un usuario `SUPERVISOR` cuyo `rol` coincide, con `tipo: 'firmar_cierre'`

#### Scenario: AUDITOR_INTERNO solo ve QE donde es el auditor asignado
- **WHEN** existen dos QE en `EN_VERIFICACION`, uno con `auditorAsignadoId === user.id` y otro con `auditorAsignadoId` de otro usuario
- **THEN** el panel del `AUDITOR_INTERNO` autenticado incluye solo el primero

---

### Requirement: Ítems de AC agregan los tres orígenes (QE, NC, Incidente)
El hook SHALL recorrer `accionesCorrectivas` embebidas en los tres dominios (`QualityEvent.accionesCorrectivas`, `NoConformidad.accionesCorrectivas`, `Incidente.accionesCorrectivas`) e incluir un ítem `dominio: 'AC'` cuando `ac.responsableId === user.id && ac.estado ∈ {'PENDIENTE', 'EN_EJECUCION'} && (!ac.descripcionEvidencia || ac.descripcionEvidencia.trim() === '')`. `prioridad` SHALL ser `'alta'` cuando la AC está vencida (mismo criterio de `calcularEstadoSemaforoDesdeFecha` ya usado por `MisACsWidget`/`ACsPorVencerWidget`), `'normal'` en otro caso. `href` SHALL apuntar al detalle del dominio de origen (`/quality-events/:id`, `/nonconformities/:id`, `/incidents/:id`).

#### Scenario: AC de origen NC aparece en el panel
- **WHEN** una `NoConformidad` tiene una AC con `responsableId === user.id`, `estado: 'PENDIENTE'`, sin `descripcionEvidencia`
- **THEN** el panel incluye un ítem `dominio: 'AC'` con `href` apuntando a `/nonconformities/:ncId`

#### Scenario: AC con evidencia registrada no aparece
- **WHEN** una AC tiene `responsableId === user.id`, `estado: 'EN_EJECUCION'`, y `descripcionEvidencia` no vacío
- **THEN** esa AC no genera un ítem en el panel

#### Scenario: AC vencida se marca con prioridad alta
- **WHEN** una AC asignada al usuario tiene `plazoFecha` en el pasado según `calcularEstadoSemaforoDesdeFecha`
- **THEN** el ítem correspondiente tiene `prioridad: 'alta'`

---

### Requirement: Ítems de Documento replican la derivación de DocRole de DocumentDetailPage
El hook SHALL incluir un ítem `dominio: 'DOCUMENTO'` cuando, para el usuario actual: `documento.revisorId === user.id && documento.estado === 'EN_REVISION'` (`tipo: 'revisar_documento'`), o `documento.aprobadorId === user.id && documento.estado === 'EN_APROBACION'` (`tipo: 'aprobar_documento'`), o `documento.autorId === user.id && documento.estado === 'EN_REVISION_PERIODICA'` (`tipo: 'actualizar_revision_periodica'`).

#### Scenario: Revisor ve solo sus propios documentos en revisión
- **WHEN** dos documentos están en `EN_REVISION` con `revisorId` distintos
- **THEN** el panel del usuario autenticado incluye únicamente el documento cuyo `revisorId === user.id`

#### Scenario: Autor no revisor no ve un documento en EN_REVISION
- **WHEN** un documento está en `EN_REVISION` con `autorId === user.id` pero `revisorId` de otro usuario
- **THEN** ese documento no aparece en el panel de ese autor

---

### Requirement: AccionesRequeridasWidget agrupa por dominio, ordena por prioridad y fecha, limita a 10
El sistema SHALL exportar `AccionesRequeridasWidget` en `src/features/dashboard/components/AccionesRequeridasWidget.tsx`, consumiendo `useAccionesRequeridas()` internamente (sin recibir `acciones` por props). SHALL agrupar los ítems por `dominio` en el orden `QE`, `AC`, `DOCUMENTO`; dentro de cada grupo, SHALL ordenar por `prioridad` (`'alta'` antes que `'normal'`) y luego por `fechaLimite` ascendente (los ítems sin `fechaLimite` al final del grupo). SHALL mostrar como máximo 10 ítems en total, con un enlace "ver todos" cuando `acciones.length > 10`. Cuando `acciones.length === 0` y `!isLoading`, SHALL mostrar un estado vacío explícito (nunca un widget en blanco). Cada fila SHALL navegar a `href` al hacer click. Todas las clases Tailwind visibles SHALL tener su variante `dark:` correspondiente.

#### Scenario: Agrupación por dominio en el orden QE, AC, Documento
- **WHEN** existen ítems de los tres dominios
- **THEN** el DOM renderiza primero el grupo `QE`, luego `AC`, luego `DOCUMENTO`

#### Scenario: Límite de 10 ítems con enlace ver todos
- **WHEN** `useAccionesRequeridas()` retorna 14 ítems
- **THEN** se renderizan exactamente 10 filas y un enlace "ver todos"

#### Scenario: Estado vacío explícito
- **WHEN** `useAccionesRequeridas()` retorna `{ acciones: [], isLoading: false }`
- **THEN** se muestra el texto localizado de "no tienes acciones pendientes", no un contenedor vacío

#### Scenario: Click en un ítem navega a su href
- **WHEN** el usuario hace click en un ítem de dominio `DOCUMENTO` con `href: '/documents/doc-123'`
- **THEN** el router navega a `/documents/doc-123`

---

### Requirement: AccionesRequeridasWidget es el primer widget en 5 de los 6 dashboards de rol
`AccionesRequeridasWidget` SHALL montarse como el primer elemento visible (antes de cualquier otro widget) en `OperarioDashboard.tsx`, `SupervisorDashboard.tsx`, `AltaDireccionDashboard.tsx` y `AuditorDashboard.tsx`, fuera del bloque condicional de `isLoading`/`data.rol` de `useDashboardSummary()` de cada página — el widget gestiona su propio `isLoading` de forma independiente. El montaje en `JefeCalidadDashboard.tsx` y en el nuevo `JefeControlDocumentarioDashboard.tsx` se cubre en sus respectivas capacidades (`dashboard-jefecalidad-view`, `dashboard-jefecontroldoc-view`).

#### Scenario: Widget visible antes de que carguen los KPIs de Operario
- **WHEN** `OperarioDashboard` renderiza mientras `useDashboardSummary()` sigue en `isLoading: true`
- **THEN** `AccionesRequeridasWidget` ya es visible, independientemente del estado de carga de los demás widgets

#### Scenario: Widget es el primer hijo en SupervisorDashboard
- **WHEN** se inspecciona el árbol renderizado de `SupervisorDashboard`
- **THEN** `AccionesRequeridasWidget` precede a `KpiGridWidget`/cualquier otro widget de esa página
