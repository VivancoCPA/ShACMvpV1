# Spec: dashboard-acciones-requeridas

## Purpose

Define the shared "Requiere tu atención" panel: a hook (`useAccionesRequeridas`) that aggregates, per authenticated user (not by area or generic role), the Quality Events, Acciones Correctivas, and Documentos where that user can take a concrete action right now, and the `AccionesRequeridasWidget` component that renders that list as the first widget across the role dashboards.

---

## Requirements

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
El hook SHALL derivar ítems de dominio `QE` (vía `extraerAccionesQE`, en `src/features/dashboard/utils/accionesRequeridas.utils.ts`) calculados **por asignación del responsable de investigación**, más las tareas propias del `JEFE_CALIDAD_SYST`, reproduciendo las condiciones que ya usan los componentes de detalle correspondientes y no una versión simplificada de `getQualityEventPermissions`. Los QE con `deletedAt` SHALL quedar excluidos.

Reglas por asignación: se evalúan antes que las reglas por rol y con independencia de ellas, para cualquier rol.
- Responsable asignado, iniciar investigación (`QE_INICIAR_INVESTIGACION`): `qe.estado === 'ABIERTO' && qe.responsableInvestigacionId === user.id`.
- Responsable asignado, completar análisis (`QE_COMPLETAR_ANALISIS`): `qe.estado === 'EN_INVESTIGACION' && qe.responsableInvestigacionId === user.id`.

Reglas por rol:
- `JEFE_CALIDAD_SYST`, asignar responsable (`QE_ASIGNAR_RESPONSABLE`): `qe.estado === 'ABIERTO' && !qe.responsableInvestigacionId`.
- `JEFE_CALIDAD_SYST`, aprobar causa raíz (`QE_APROBAR_CAUSA_RAIZ`): `qe.estado ∈ {'EN_INVESTIGACION', 'ANALISIS_COMPLETADO'} && (qe.causaRaizDefinitiva?.trim().length ?? 0) >= 100 && !qe.causaRaizFirmadaEn`, sobre cualquier QE, sea o no su responsable.
- `JEFE_CALIDAD_SYST`, registrar resultado de cierre (`QE_REGISTRAR_CIERRE`): `qe.estado === 'PENDIENTE_CIERRE' && !qe.resultadoCierre`. Es la misma condición que `showClosureForm` en `QECierreSection`.
- `JEFE_CALIDAD_SYST`, firmar cierre como Jefe de Calidad (`QE_FIRMAR_CIERRE_JCA`): `qe.estado === 'PENDIENTE_CIERRE' && !!qe.resultadoCierre && !qe.cerradoPorId`. Es la misma condición que el botón de firma del JCA en `QECierreSection`.
- `SUPERVISOR` o `ALTA_DIRECCION`, firmar cierre (`QE_FIRMAR_CIERRE`): `qe.estado === 'PENDIENTE_CIERRE' && !!qe.cerradoPorId && !qe.cierreFirmaSupervisorId && user.rol === resolveRolSegundaFirma(qe.cerradoPorId, qe.areaId) && (user.areaIds ?? []).includes(qe.areaId)`.
- `JEFE_CALIDAD_SYST`, verificar (`QE_VERIFICAR`): `qe.estado === 'EN_VERIFICACION'`.
- `AUDITOR_INTERNO`, verificar (`QE_VERIFICAR`): `qe.estado === 'EN_VERIFICACION' && qe.auditorAsignadoId === user.id`.

Los tipos `QE_CERRAR` y `QE_CAUSA_RAIZ` NO SHALL existir.

Un mismo QE MAY generar más de un ítem para el mismo usuario. Por ejemplo, un JCA responsable de un QE en `EN_INVESTIGACION` con causa raíz de 100 caracteres o más ve `QE_COMPLETAR_ANALISIS` y `QE_APROBAR_CAUSA_RAIZ`. El `id` de cada ítem SHALL ser `QE-{tipo}-{qe.id}`, único por par tipo/QE.

La `prioridad` SHALL ser la de `qeSeveridadPrioridad(qe)` (`'alta'` para severidad `ALTA` o `CRITICA`). Además, para `QE_ASIGNAR_RESPONSABLE` y `QE_INICIAR_INVESTIGACION` SHALL ser `'alta'` cuando han transcurrido más de 48 h desde `qe.fechaHoraReporte` (o desde `qe.creadoEn`, si falta), que es el plazo de asignación del PRD §1.3. Esto solo afecta el orden visual y no genera notificaciones.

Un QE que no cumple ninguna condición para el usuario actual SHALL quedar fuera del panel. El hook NUNCA SHALL usar `getQualityEventPermissions(...).puedeCerrar` ni `.puedeFirmarCierre` directamente para decidir la inclusión, porque ambos flags son más amplios que la acción que realmente está pendiente en ese momento.

#### Scenario: JCA responsable de un QE ABIERTO ve iniciar investigación, no asignar
- **WHEN** un QE está en `ABIERTO` con `responsableInvestigacionId` igual al id del JCA autenticado
- **THEN** el panel del JCA incluye `QE_INICIAR_INVESTIGACION` para ese QE y no incluye `QE_ASIGNAR_RESPONSABLE`

#### Scenario: QE ABIERTO sin responsable
- **WHEN** un QE está en `ABIERTO` sin `responsableInvestigacionId`
- **THEN** el panel del JCA incluye `QE_ASIGNAR_RESPONSABLE` y el panel de un `SUPERVISOR` no incluye ningún ítem de ese QE

#### Scenario: Solo el Supervisor asignado ve iniciar investigación
- **WHEN** un QE está en `ABIERTO` con `responsableInvestigacionId` = Supervisor A
- **THEN** el panel de A incluye `QE_INICIAR_INVESTIGACION`, el de otro Supervisor B no lo incluye, y el del JCA no incluye `QE_INICIAR_INVESTIGACION` ni `QE_ASIGNAR_RESPONSABLE`

#### Scenario: Investigación de un Supervisor con causa raíz lista para aprobar
- **WHEN** un QE está en `EN_INVESTIGACION` con responsable Supervisor A, `causaRaizDefinitiva` de 100 caracteres o más y sin `causaRaizFirmadaEn`
- **THEN** A recibe `QE_COMPLETAR_ANALISIS`, y el JCA no recibe `QE_COMPLETAR_ANALISIS` pero sí `QE_APROBAR_CAUSA_RAIZ`

#### Scenario: Causa raíz firmada no genera aprobar causa raíz
- **WHEN** un QE en `ANALISIS_COMPLETADO` tiene `causaRaizFirmadaEn`
- **THEN** ningún usuario recibe `QE_APROBAR_CAUSA_RAIZ` para ese QE

#### Scenario: QE ABIERTO hace más de 48 h tiene prioridad alta
- **WHEN** un QE de severidad `BAJA` está en `ABIERTO` sin responsable y su `fechaHoraReporte` es de hace 50 h
- **THEN** el ítem `QE_ASIGNAR_RESPONSABLE` del JCA tiene `prioridad: 'alta'`

#### Scenario: QE eliminado no genera ítems
- **WHEN** un QE tiene `deletedAt`
- **THEN** no genera ningún ítem para ningún usuario

#### Scenario: PENDIENTE_CIERRE sin resultado genera registrar cierre
- **WHEN** un QE está en `PENDIENTE_CIERRE` sin `resultadoCierre`
- **THEN** el panel del JCA incluye `QE_REGISTRAR_CIERRE` para ese QE y no incluye `QE_FIRMAR_CIERRE_JCA`

#### Scenario: Resultado registrado sin firma del JCA genera firmar cierre JCA
- **WHEN** un QE está en `PENDIENTE_CIERRE` con `resultadoCierre` y sin `cerradoPorId`
- **THEN** el panel del JCA incluye `QE_FIRMAR_CIERRE_JCA` para ese QE y no incluye `QE_REGISTRAR_CIERRE`

#### Scenario: JEFE_CALIDAD_SYST no ve un QE PENDIENTE_CIERRE que ya firmó
- **WHEN** un QE está en `PENDIENTE_CIERRE` con `resultadoCierre` y `cerradoPorId` ya establecidos (solo falta la segunda firma)
- **THEN** ese QE no aparece en el panel de un usuario `JEFE_CALIDAD_SYST`, porque la acción pendiente ya no es suya

#### Scenario: SUPERVISOR ve el QE cuando le corresponde la segunda firma
- **WHEN** un QE está en `PENDIENTE_CIERRE` con `cerradoPorId` establecido, `resolveRolSegundaFirma(cerradoPorId, areaId)` retorna `'SUPERVISOR'` y el área del QE está en `user.areaIds`
- **THEN** ese QE aparece en el panel de ese `SUPERVISOR` con `tipo: 'QE_FIRMAR_CIERRE'`

#### Scenario: AUDITOR_INTERNO solo ve QE donde es el auditor asignado
- **WHEN** existen dos QE en `EN_VERIFICACION`, uno con `auditorAsignadoId === user.id` y otro con el `auditorAsignadoId` de otro usuario
- **THEN** el panel del `AUDITOR_INTERNO` autenticado incluye solo el primero

### Requirement: Ítems de AC agregan los tres orígenes (QE, NC, Incidente)
El hook SHALL recorrer las `accionesCorrectivas` embebidas en los tres dominios (`QualityEvent.accionesCorrectivas`, `NoConformidad.accionesCorrectivas` e `Incidente.accionesCorrectivas`).

- **AC de QE:** SHALL incluir un ítem `AC_EJECUTAR` (`dominio: 'AC'`) cuando `ac.responsableId === user.id` y `ac.estado ∈ {'PENDIENTE', 'EN_EJECUCION'}`, sin mirar `descripcionEvidencia`. Una AC devuelta vuelve a `EN_EJECUCION` con su descripción anterior y debe seguir apareciendo.
- **AC de NC e incidente:** se mantiene la condición previa: `ac.estado ∈ {'PENDIENTE', 'EN_EJECUCION'}` y sin `descripcionEvidencia`.

`prioridad` SHALL ser `'alta'` cuando la AC está vencida (el mismo criterio de `calcularEstadoSemaforoDesdeFecha` que ya usan `MisACsWidget` y `ACsPorVencerWidget`) y `'normal'` en otro caso. `href` SHALL apuntar al detalle del dominio de origen: `/quality-events/:id`, `/nonconformities/:id` o `/incidents/:id`.

#### Scenario: AC de origen NC aparece en el panel
- **WHEN** una `NoConformidad` tiene una AC con `responsableId === user.id`, `estado: 'PENDIENTE'` y sin `descripcionEvidencia`
- **THEN** el panel incluye un ítem `dominio: 'AC'` con `href` apuntando a `/nonconformities/:ncId`

#### Scenario: AC de NC o incidente con evidencia registrada no aparece
- **WHEN** una AC de NC o incidente tiene `responsableId === user.id`, `estado: 'EN_EJECUCION'` y `descripcionEvidencia` no vacía
- **THEN** esa AC no genera un ítem en el panel

#### Scenario: AC de QE devuelta sigue pendiente
- **WHEN** una AC de QE tiene `responsableId === user.id`, `estado: 'EN_EJECUCION'`, `descripcionEvidencia` no vacía y `motivoDevolucion`
- **THEN** el panel incluye un ítem `AC_EJECUTAR` para esa AC

#### Scenario: AC de QE ejecutada no aparece para el responsable
- **WHEN** una AC de QE del usuario está en `COMPLETADA`
- **THEN** no genera un ítem `AC_EJECUTAR`

#### Scenario: AC vencida se marca con prioridad alta
- **WHEN** una AC asignada al usuario tiene `plazoFecha` en el pasado según `calcularEstadoSemaforoDesdeFecha`
- **THEN** el ítem correspondiente tiene `prioridad: 'alta'`

---

### Requirement: Ítem AC_VERIFICAR para el Jefe de Calidad
Para un usuario con rol `JEFE_CALIDAD_SYST`, el hook SHALL incluir un ítem `AC_VERIFICAR` ("Verificar acción correctiva", `dominio: 'AC'`, `href` `/quality-events/:id`) por cada AC de QE en `COMPLETADA`, sin importar el responsable.

La tarjeta "Aprobaciones y cierres pendientes" de `JefeCalidadDashboard` SHALL contar `AC_VERIFICAR` junto con `QE_APROBAR_CAUSA_RAIZ`, `QE_FIRMAR_CIERRE_JCA` y `QE_REGISTRAR_CIERRE`, filtrando con el mismo conjunto de tipos para que el número y la lista coincidan.

Las mutaciones de iniciar, ejecutar y verificar SHALL invalidar `['dashboard']` y la lista de QE.

#### Scenario: JCA ve AC por verificar
- **WHEN** un QE tiene 2 AC en `COMPLETADA` y el usuario es JEFE_CALIDAD_SYST
- **THEN** el panel incluye 2 ítems `AC_VERIFICAR`

#### Scenario: Tarjeta de aprobaciones cuenta AC_VERIFICAR
- **WHEN** `useAccionesRequeridas` devuelve 1 `QE_APROBAR_CAUSA_RAIZ` y 2 `AC_VERIFICAR`
- **THEN** la tarjeta "Aprobaciones y cierres pendientes" muestra `3` y, al hacer clic, la lista muestra exactamente 3 filas

#### Scenario: Otros roles no ven AC_VERIFICAR
- **WHEN** un SUPERVISOR carga el panel con AC en `COMPLETADA`
- **THEN** no hay ítems `AC_VERIFICAR`

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
El sistema SHALL exportar `AccionesRequeridasWidget` en `src/features/dashboard/components/AccionesRequeridasWidget.tsx`. El widget SHALL consumir `useAccionesRequeridas()` internamente, sin recibir `acciones` por props, y SHALL aceptar las props opcionales `filtroTipos?: AccionRequeridaTipo[]`, `etiquetaFiltro?: string` y `onQuitarFiltro?: () => void`.

SHALL agrupar los ítems por `dominio` en el orden `QE`, `AC`, `DOCUMENTO`. Dentro de cada grupo, SHALL ordenarlos por `prioridad` (`'alta'` antes que `'normal'`) y luego por `fechaLimite` ascendente, con los ítems sin `fechaLimite` al final del grupo.

**Sin filtro**, SHALL mostrar como máximo 10 ítems en total, con un enlace "ver todos" cuando `acciones.length > 10`.

**Con `filtroTipos`**, SHALL:
- mostrar **todos** los ítems cuyo `tipo` está en `filtroTipos`, sin el corte de 10 y sin el enlace "ver todos";
- filtrar con `filtrarAccionesPorTipo(items, filtroTipos)`, la misma función pura exportada desde `accionesRequeridas.utils.ts` que usan las páginas para calcular el número de la tarjeta;
- mostrar arriba de la lista un chip con `t('dashboard:accionesRequeridas.mostrando', { etiqueta, n })` y un botón ✕ con `aria-label` `t('dashboard:accionesRequeridas.quitarFiltro')`, que llama a `onQuitarFiltro`.

Cuando la lista que corresponde mostrar está vacía y `!isLoading`, SHALL mostrar un estado vacío explícito, nunca un widget en blanco. Cada fila SHALL navegar a su `ruta` al hacer clic. Todas las clases Tailwind visibles SHALL tener su variante `dark:` correspondiente.

#### Scenario: Agrupación por dominio en el orden QE, AC, Documento
- **WHEN** existen ítems de los tres dominios
- **THEN** el DOM renderiza primero el grupo `QE`, luego `AC` y luego `DOCUMENTO`

#### Scenario: Límite de 10 ítems con enlace ver todos
- **WHEN** `useAccionesRequeridas()` retorna 14 ítems y no hay filtro
- **THEN** se renderizan exactamente 10 filas y un enlace "ver todos"

#### Scenario: Con filtro se muestran todos los ítems del filtro
- **WHEN** `useAccionesRequeridas()` retorna 12 ítems `QE_APROBAR_CAUSA_RAIZ` y 5 `AC_EJECUTAR`, y el widget recibe `filtroTipos: ['QE_APROBAR_CAUSA_RAIZ']` con `etiquetaFiltro: 'Aprobaciones y cierres pendientes'`
- **THEN** se renderizan exactamente 12 filas, sin enlace "ver todos", y el chip "Mostrando: Aprobaciones y cierres pendientes (12)"

#### Scenario: Quitar el filtro desde el chip
- **WHEN** el widget está filtrado y el usuario pulsa el ✕ del chip
- **THEN** se llama a `onQuitarFiltro`

#### Scenario: Estado vacío explícito
- **WHEN** `useAccionesRequeridas()` retorna `{ acciones: [], isLoading: false }`
- **THEN** se muestra el texto localizado de "no tienes acciones pendientes", no un contenedor vacío

#### Scenario: Click en un ítem navega a su ruta
- **WHEN** el usuario hace clic en un ítem de dominio `DOCUMENTO` con `ruta: '/documentos/doc-123'`
- **THEN** el router navega a `/documentos/doc-123`

---

### Requirement: AccionesRequeridasWidget es el primer widget en 5 de los 6 dashboards de rol
`AccionesRequeridasWidget` SHALL montarse como el primer widget de la columna principal de la zona "Mi trabajo y contexto" de `DashboardLayout` (`dashboard-layout`) en `OperarioDashboard.tsx`, `SupervisorDashboard.tsx`, `AltaDireccionDashboard.tsx` y `AuditorDashboard.tsx`, después de la zona de alertas y de la de indicadores, y fuera del bloque condicional de `isLoading`/`data.rol` de `useDashboardSummary()` de cada página: el widget gestiona su propio `isLoading` de forma independiente. Su contenedor SHALL tener `id="acciones-requeridas"`, destino de las alertas que enlazan a pendientes. El montaje en `JefeCalidadDashboard.tsx` y en `JefeControlDocumentarioDashboard.tsx` se cubre en sus respectivas capacidades (`dashboard-jefecalidad-view`, `dashboard-jefecontroldoc-view`).

#### Scenario: Widget visible antes de que carguen los KPIs de Operario
- **WHEN** `OperarioDashboard` renderiza mientras `useDashboardSummary()` sigue en `isLoading: true`
- **THEN** `AccionesRequeridasWidget` ya es visible, independientemente del estado de carga de los demás widgets

#### Scenario: Widget es el primero de la columna principal en SupervisorDashboard
- **WHEN** se inspecciona el árbol renderizado de `SupervisorDashboard`
- **THEN** `AccionesRequeridasWidget` es el primer widget dentro de la columna principal de "Mi trabajo y contexto", antes del panel de pendientes del área
