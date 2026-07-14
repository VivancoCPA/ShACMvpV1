## Context

M5 ya tiene 5 dashboards de rol (`OperarioDashboard`, `SupervisorDashboard`, `JefeCalidadDashboard`, `AltaDireccionDashboard`, `AuditorDashboard`) alimentados por `useDashboardSummary()`, que consume `GET /api/dashboard/summary` y devuelve un `DashboardSummaryData` (unión discriminada por `rol`) construido server-side (mock) por área/rol, no por usuario individual. `JEFE_CONTROL_DOCUMENTARIO` no tiene dashboard propio: `dashboardRoleMapping.ts` lo mapea a `'JEFE_CALIDAD'` — una decisión documentada explícitamente en un comentario de `dashboard.handlers.ts` (`buildJefeCalidadData`, "ver design.md, decisión 4" de un change anterior) que este change **reemplaza**.

Se verificó contra el código real (no solo contra la propuesta) antes de diseñar:

1. **`QEStatusTransitionPanel.tsx` no necesita el fix de `esResponsable`.** Su `EXCLUDED_TARGETS` (`['CERRADO', 'EN_VERIFICACION', 'VERIFICADO', 'REABIERTO']`) ya filtra toda transición relacionada a verificación/cierre — nunca depende de `puedeVerificar` ni `puedeFirmarCierre`. El único call site real del gap es `QEVerificacionSection.tsx:36`.
2. **`getQualityEventPermissions(...).puedeFirmarCierre` no es el gate real de la firma de cierre.** `QECierreSection.tsx` no lo usa: calcula `showFirstSignature`/`showSecondSignature` directamente comparando `user.rol` contra `resolveRolSegundaFirma(qe.cerradoPorId, qe.areaAfectada)` (un rol, no un `user.id`). El panel nuevo debe replicar esa lógica real, no inventar un `esResponsable` para `puedeFirmarCierre` que ningún componente de producción usa hoy.
3. **`getQualityEventPermissions(...).puedeCerrar` es más amplio que la acción real pendiente.** Es `true` en todo `PENDIENTE_CIERRE` para `JEFE_CALIDAD_SYST`, incluso después de que ya llenó el formulario y firmó primero — en ese punto la acción pendiente es de Supervisor/Alta Dirección, no de él. Usarlo tal cual produciría un falso positivo persistente en el panel.
4. **Las acciones correctivas (AC) viven embebidas en tres dominios**, no solo QE + Incidente: `QualityEvent.accionesCorrectivas`, `NoConformidad.accionesCorrectivas` e `Incidente.accionesCorrectivas` — consistente con `AccionCorrectivaResumen.origenTipo: 'QE' | 'NC' | 'INCIDENTE'` ya definido en `dashboardSummary.types.ts`. La propuesta original omitía NC; se corrige aquí.
5. **Los hooks `use*List()` (`useQEList`, `useNCList`, `useIncidentList`, `useDocumentList`) están acoplados a `useSearchParams()`** de la ruta actual (paginación/filtros de las páginas de listado, `pageSize: 10`). Reusarlos tal cual dentro de un widget de dashboard leería accidentalmente los query params de `/dashboard` (vacíos) y truncaría a 10 ítems. El hook nuevo debe llamar a los hooks base sin acoplar (`useQualityEvents`, `useNonconformities`, `useIncidents`, `useDocuments`) con filtros explícitos y `pageSize` amplio.
6. **La transición `CERRADO → EN_VERIFICACION` no tiene disparador automático real** en este MVP — el único mecanismo existente es el botón dev-only "Forzar vencimiento" (`useForzarVencimientoVerificacion`, gateado por `import.meta.env.DEV`). El select de asignación de auditor debe vivir ahí; no existe otro punto de transición al que engancharlo.

## Goals / Non-Goals

**Goals:**
- Panel "Requiere tu atención" como primer widget en los 6 dashboards de rol, agregando ítems accionables individuales (QE, AC, Documento) con la máxima fidelidad posible a la lógica de permisos/gating que ya usan los componentes de detalle reales (no una reimplementación paralela con reglas inventadas).
- Dashboard propio para `JEFE_CONTROL_DOCUMENTARIO`, corrigiendo el mapeo a `'JEFE_CALIDAD'`.
- Cerrar el gap de `esResponsable` hardcodeado en `QEVerificacionSection.tsx`, con su precondición de datos (`auditorAsignadoId`) y flujo de asignación mínimo viable (select en el forzado dev-only).

**Non-Goals:**
- No se agrega un endpoint `/api/dashboard/mis-acciones` — se agrega en cliente sobre los hooks existentes. Se documenta como candidato futuro si el volumen de datos lo justifica (fuera de alcance).
- No se toca `QEStatusTransitionPanel.tsx` (ver hallazgo 1) — no aplica el fix ahí.
- No se construye un flujo de asignación de auditor "real" (backend, notificaciones) más allá de un select síncrono en el mock existente.
- No se agregan KPIs ni endpoints nuevos para `JefeControlDocumentarioDashboard` más allá del panel.
- No se construye "aprobar extensión de plazo" (gap de M4 ya documentado, no construido).

## Decisions

### 1. Fuente de datos del hook: hooks base sin acoplar a URL, no los `use*List()`
`useAccionesRequeridas()` llama directamente a `useQualityEvents({ pageSize: 200 })`, `useNonconformities({ pageSize: 200 })`, `useIncidents({ pageSize: 200 })`, `useDocuments({ pageSize: 200 })` (sin filtros de estado/área — se filtra en cliente por permiso/asignación). `pageSize: 200` es suficiente para el volumen de fixtures MVP; queda documentado como limitación conocida a resolver con un endpoint agregado si el dataset real lo supera (ver Riesgos).

### 2. Cada dominio replica la lógica real de su componente de detalle, no `getQualityEventPermissions` a ciegas
| Dominio | Condición exacta usada por el hook | Réplica de |
|---|---|---|
| QE — `JEFE_CALIDAD_SYST` causa raíz | `estado ∈ {EN_INVESTIGACION, ANALISIS_COMPLETADO} && !causaRaizFirmadaEn` | `getQualityEventPermissions(...).puedeEditarCausaRaiz`, acotado con el mismo dato que ya usa `QECausaRaizSection` para no reflejarlo como pendiente si ya está firmada |
| QE — `JEFE_CALIDAD_SYST` cerrar | `estado === 'PENDIENTE_CIERRE' && !cierreFirmaSupervisorId && (!resultadoCierre || !cerradoPorId)` | `showClosureForm \|\| showFirstSignature` de `QECierreSection.tsx` |
| QE — `SUPERVISOR`/`ALTA_DIRECCION` firmar cierre | `estado === 'PENDIENTE_CIERRE' && !!cerradoPorId && !cierreFirmaSupervisorId && user.rol === resolveRolSegundaFirma(cerradoPorId, areaAfectada)` | `showSecondSignature` de `QECierreSection.tsx` |
| QE — `JEFE_CALIDAD_SYST` verificar | `estado === 'EN_VERIFICACION'` | `getQualityEventPermissions(...).puedeVerificar` (ya correcto hoy, sin `esResponsable`) |
| QE — `AUDITOR_INTERNO` verificar | `estado === 'EN_VERIFICACION' && auditorAsignadoId === user.id` | `getQualityEventPermissions('EN_VERIFICACION', 'AUDITOR_INTERNO', esResponsable)` **una vez corregido** el fix de la Decisión 4 |
| AC (cualquier origen) | `responsableId === user.id && estado ∈ {PENDIENTE, EN_EJECUCION} && !descripcionEvidencia` | Mismo criterio que `MisACsWidget`/RN aplicable, extendido a los 3 orígenes |
| Documento revisar | `revisorId === user.id && estado === 'EN_REVISION'` | `DocumentDetailPage.tsx` (derivación de `DocRole`) |
| Documento aprobar | `aprobadorId === user.id && estado === 'EN_APROBACION'` | ídem |
| Documento revisión periódica | `autorId === user.id && estado === 'EN_REVISION_PERIODICA'` | ídem |

Esto evita dos clases de bug: falsos positivos (JEFE_CALIDAD_SYST viendo un QE que en realidad ya pasó a ser responsabilidad de Supervisor) y falsos negativos silenciosos (AUDITOR_INTERNO nunca viendo nada, como pasa hoy).

### 3. Auditor se asigna en el control dev-only "Forzar vencimiento" (único disparador real de `CERRADO → EN_VERIFICACION`)
`QEVerificacionSection.tsx`, mientras `qe.estado === 'CERRADO'` y el usuario es `JEFE_CALIDAD_SYST`, agrega un `<select>` (`auditorAsignadoId`, requerido, opciones = usuarios con `rol === 'AUDITOR_INTERNO'` desde `useUsers()`/fixture existente) que habilita el botón "Forzar vencimiento" solo cuando hay un valor seleccionado. `useForzarVencimientoVerificacion().mutate({ id, auditorAsignadoId })`. El handler `PATCH /forzar-vencimiento-verificacion` persiste `auditorAsignadoId` en el QE junto con la transición a `EN_VERIFICACION`. Este mecanismo es explícitamente dev-only hoy (como el resto del flujo de verificación); cuando exista backend real, el punto de enganche natural será el job que dispare esa misma transición — no es responsabilidad de este change definirlo.

### 4. Fix de `esResponsable` acotado a `QEVerificacionSection.tsx` únicamente
Línea 36: `getQualityEventPermissions(qe.estado, user.rol, false)` → `getQualityEventPermissions(qe.estado, user.rol, user?.id === qe.auditorAsignadoId)`. `QEStatusTransitionPanel.tsx` no se toca (hallazgo verificado, ver Contexto).

### 5. Tipo de dashboard nuevo en la unión discriminada, no un objeto vacío suelto
Se agrega `JefeControlDocDashboardData = Record<string, never>` y la variante `{ rol: 'JEFE_CONTROL_DOC'; data: JefeControlDocDashboardData }` a `DashboardSummaryData`, siguiendo el mismo patrón "skeleton + gate por `data.rol`" que los 5 dashboards existentes (consistencia > ahorro de código), en vez de que `JefeControlDocumentarioDashboard` omita `useDashboardSummary()` como caso especial. `dashboard.handlers.ts` gana `buildJefeControlDocumentarioData()` (retorna `{}`) y un `case 'JEFE_CONTROL_DOC'` en `buildDashboardSummary`; se elimina la rama `esControlDocumentario` dentro de `buildJefeCalidadData` (ya no aplica — ese rol nunca vuelve a llegar ahí).

### 6. Orden, agrupación y límite del widget (confirmado con Toño)
Agrupado por dominio (QE → AC → Documento), cada grupo ordenado por `prioridad` (`alta` primero) y luego por `fechaLimite` ascendente. Máximo 10 ítems visibles + enlace "ver todos" cuando hay más. Estado vacío explícito por i18n key.

### 7. `AccionesRequeridasWidget` gestiona su propio loading, independiente de `useDashboardSummary()`
El widget no depende del `isLoading`/`data.rol` gate de cada página — usa el `isLoading` propio de `useAccionesRequeridas()`. Se monta fuera (antes) del bloque condicional existente en cada dashboard, para que aparezca incluso mientras el resto de KPIs sigue cargando.

## Risks / Trade-offs

- **[Riesgo] Agregación 100% cliente con 4 fetches de `pageSize: 200` en cada carga de dashboard** → costo aceptable a escala de fixtures MVP; mitigación futura: endpoint `/api/dashboard/mis-acciones` server-side si el dataset real lo justifica (ya anotado como no-bloqueante en la propuesta).
- **[Riesgo] Duplicar lógica de gating ya existente en `QECierreSection`/`QEVerificacionSection` dentro del hook nuevo** → riesgo de que diverjan con el tiempo. Mitigación: extraer las condiciones de "firmar cierre" y "verificar" a funciones puras compartidas (`utils/qualityEventPermissions.ts` o un nuevo `utils/qualityEventActionable.ts`) reutilizadas tanto por los componentes de detalle como por el hook del panel, en vez de copiar la expresión booleana dos veces.
- **[Riesgo] `pageSize: 200` sin filtro de estado trae QEs/NC/Incidentes/Documentos ya cerrados/publicados** → costo de payload en mock es irrelevante; en cliente se descartan igual vía los filtros de permiso. Aceptado para este spec.
- **[Trade-off] El select de auditor solo existe en el flujo dev-only** → coherente con que hoy no existe ningún flujo de producción para esa transición; se documenta explícitamente como deuda a resolver junto con el resto del flujo de verificación automática (fuera de alcance de M5-S10).

## Migration Plan

1. **Fase 1 — datos**: `auditorAsignadoId` en `QualityEvent`, select en el forzado dev-only, handler actualizado, fixtures pobladas para QEs en `EN_VERIFICACION`, fix de `esResponsable` en `QEVerificacionSection.tsx`.
2. **Fase 2 — hook y widget compartidos**: `useAccionesRequeridas()`, `AccionesRequeridasWidget`, montados en los 5 dashboards existentes.
3. **Fase 3 — dashboard nuevo**: tipo `JEFE_CONTROL_DOC`, fix de `dashboardRoleMapping.ts`, `buildJefeControlDocumentarioData` en el handler, `JefeControlDocumentarioDashboard.tsx` montado en `DashboardPage.tsx`.

Sin rollback especial — cambios aditivos sobre mocks/tipos; el único cambio de comportamiento visible para usuarios existentes es que `JEFE_CONTROL_DOCUMENTARIO` deja de ver el dashboard de Jefe de Calidad (esperado y es el objetivo del fix).

## Open Questions

Ninguna pendiente — las 3 decisiones abiertas de la propuesta original (mecanismo de asignación de auditor, límite de ítems, orden de agrupación) fueron confirmadas con Toño antes de generar este documento.
