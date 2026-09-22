# Instrucciones para Claude Code — Cutover: Dashboard

Fecha: 2026-09-22
Autor: Cowork, tras investigar el código real (frontend `shc-controldoc`, backend `.NET`) vía
device bridge. Octavo y último módulo de dominio del roadmap de cutover — Auth, Catálogos,
Incidentes, Documentos, No Conformidades, Quality Events y Usuarios ya quedaron cerrados y
verificados (los tres últimos siguen sin archivar, pendientes de que decidas cuándo).

Toño ya eligió seguir con Dashboard — **no le vuelvas a preguntar si conviene**.

## Contexto importante — este módulo ya tuvo una ronda previa de verificación, distinta a un cutover

A diferencia de los siete módulos anteriores, el backend de Dashboard (`Features/Dashboard/*`, change
`be-dashboards`) **ya fue implementado y verificado independientemente por mí el 2026-08-21**
(`SHAC-Verificacion-Dashboard-2026-08-21.md`, guardado en el Project) — en ese momento confirmé que
el backend es un puerto fiel de `dashboard.handlers.ts` (el mock), incluida una corrección real que
Claude Code encontró releyendo el mock en vez de confiar en mi brief original
(`accionesCorrectivasVencidas` del Supervisor no distingue `PENDIENTE` de `EN_EJECUCION`), más un
fix posterior de `NCFechaDerivadaResolver`. Esa verificación confirmó que el backend **coincide con
el comportamiento del mock**, con `dotnet test` en 257/257.

Lo que **nunca se hizo** es lo que sí se hizo en los otros siete módulos: apuntar el frontend real
contra este backend real con MSW apagado y verificar el contrato de red extremo a extremo. Esta
investigación (leyendo `dashboard.api.ts`, los tipos de ambos lados, y los archivos backend
relevantes) es esa comparación de contrato — y, en lo que revisé, **no encontré ningún mismatch**.

## 1. El contrato coincide — confirmado tipo por tipo

- `GET /api/dashboard/summary` ↔ `ObtenerSummaryHandler`: la unión discriminada por `rol`
  (`DashboardSummaryEnvelope(string Rol, object Data)`) coincide exactamente con
  `DashboardSummaryData` (frontend, unión por `rol: 'OPERARIO' | 'SUPERVISOR' | 'JEFE_CALIDAD' |
  'ALTA_DIRECCION' | 'AUDITOR' | 'JEFE_CONTROL_DOC'`). Comparé los 6 DTOs de cada rol
  (`OperarioDashboardData`, `SupervisorDashboardData`, `JefeCalidadDashboardData`,
  `AltaDireccionDashboardData`, `AuditorDashboardData`, `JefeControlDocDashboardData`) contra sus
  contrapartes TypeScript en `dashboardData.types.ts`/`dashboardSummary.types.ts` — cada campo
  coincide en nombre (PascalCase↔camelCase, serialización estándar) y forma, incluidos los tipos
  compuestos anidados (`SemaforoPlazosCount`, `ResumenPorModulo`, `TendenciaMensualKpiEntry`, etc.).
- `GET /api/dashboard/kpis` (`?periodo=YYYY-MM`) ↔ `ObtenerKpisHandler` → `List<KpiResult>`:
  coincide con `KpiResult`/`getDashboardKpis()`. Restringido a los 6 roles con acceso a dashboard
  (`ObtenerKpisEndpoint.cs`, ya confirmado por vos el 2026-08-21 como criterio vigente) — a
  diferencia del mock, que no lo gateaba por rol.
- `DashboardRoleMapping.cs` (backend) ↔ `dashboardRoleMapping.ts` (frontend): mapeo idéntico de
  `UserRole` → rol de dashboard, sin entrada para `SUPERADMIN`/`ADMINISTRADOR_EMPRESA`/
  `ADMINISTRADOR_SISTEMA` en ninguno de los dos lados (403 esperado).
- `DashboardKpiConstants.cs` ↔ `kpi.constants.ts`: verifiqué los valores numéricos de las tres
  tablas (`PlazoMaximoQEDiasHabiles` 22/17/14/10, `PlazoMaximoQEPorEstadoDiasHabiles` por estado y
  severidad, metas de KPI-01 a KPI-09) — coinciden exactamente, dígito por dígito, confirmando el
  puerto ya validado en agosto.
- Las 4 rutas de `Features/Dashboard/` están registradas en `EndpointExtensions.cs` (confirmado en
  una lectura anterior de esta misma sesión) y sus 4 handlers también.
- `documentosPendientesLectura` (Operario) permanece siempre `[]` en ambos lados — no es un
  hallazgo nuevo, es el mismo punto ya documentado como Open Question explícito desde
  `be-documentos` (sin definición de producto de "lectura confirmada" en ningún lado del sistema).
  El propio comentario de `DashboardSummaryDtos.cs` lo confirma como decisión deliberada, no un
  olvido — sigue siendo tuyo decidir si algún día se define esa semántica.

## 2. Informativo — dos endpoints sin ningún consumidor en la UI

`CargarHorasTrabajadas` (`PUT /api/empresas/:empresaId/dashboard/horas-trabajadas`) y
`CargarKpi04AnioAnterior` (`PUT .../dashboard/kpi04-anio-anterior`) están registrados, restringidos
a `SUPERADMIN`, y **no tienen ningún punto de entrada en `dashboard.api.ts` ni en ningún componente
del frontend** — confirmé por lectura que las únicas dos funciones de `dashboard.api.ts` son
`getDashboardKpis`/`getDashboardSummary`. Son endpoints de carga manual de datos que alimentan
KPI-04 (comparación interanual) y el cálculo de horas trabajadas para tasas de incidentes — sin una
UI de administración que los invoque, hoy solo son accesibles por API directa (`curl`/Postman) como
`SUPERADMIN`. No es un mismatch — es el mismo patrón "sin UI real" ya visto en otros módulos
(transiciones de estado de NC, exportación batch de QE en su momento) — decidí no bloquear el
cutover por esto, pero si alguna vez hace falta cargar estos datos en producción sin acceso directo
a la API, es una decisión de producto pendiente tuya.

## 3. Lo que no llegué a revisar en profundidad

- `DashboardDataFetcher.cs` (17KB) y `DashboardSummaryBuilder.cs` (19KB) — no los releí línea por
  línea en esta pasada; ya habían sido confirmados estructuralmente correctos en la verificación de
  agosto, y no encontré ninguna señal de que algo haya cambiado desde entonces que amerite
  desconfiar (los mtimes más recientes de esos archivos — 2026-09-something — probablemente
  corresponden a los cutovers de otros módulos que tocaron datos que Dashboard consume, no a un
  cambio de contrato de Dashboard en sí, pero no lo confirmé explícitamente).
- Los 25 componentes de widgets del frontend (`AccionesRequeridasWidget.tsx`,
  `KpisEjecutivosWidget.tsx`, etc.) — no los revisé uno por uno. Dado que el contrato de tipos ya
  coincide (Sección 1), el riesgo real está más en errores de renderizado/UX que en mismatches de
  red, pero vale la pena que la verificación real (navegador o API) toque al menos un dashboard por
  rol para confirmar que cada widget consume el campo correcto de la respuesta.
- Los archivos de exportación (`buildAltaDireccionExportSections.ts`,
  `buildJefeCalidadExportSections.ts`, `exportToExcel.ts`, `exportToPdf.ts`) — no los revisé. Dado
  el precedente de Quality Events (`exportQualityEventPdf` resultó estar más roto de lo que yo había
  concluido originalmente), vale la pena que confirmes que estos exports arman el PDF/Excel a partir
  de datos ya en memoria (el `summary`/`kpis` ya cargado), no de una llamada de red adicional que
  pueda tener su propio contrato distinto — por lo que vi en `dashboard.api.ts`, no hay ninguna
  función de exportación que llame a un endpoint de red propio, así que el riesgo de este patrón
  específico parece bajo, pero confirmalo antes de dar el módulo por cerrado.

## 4. Estrategia

1. Backend local (`dotnet run` + Postgres dev), `.env.development` local con MSW apagado mientras
   verificás — no toques `.env.production`.
2. Verificación funcional: cargar el dashboard como cada uno de los 6 roles con acceso
   (`OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`,
   `ALTA_DIRECCION`) y confirmar que cada widget renderiza con datos reales, sin errores de consola
   ni campos `undefined`. Confirmá también el 403 para los roles sin acceso
   (`ADMINISTRADOR_EMPRESA`/`ADMINISTRADOR_SISTEMA`/`SUPERADMIN`) en `/api/dashboard/kpis` — el
   propio `ObtenerSummaryEndpoint` no gatea por rol explícitamente (devuelve null → 403 genérico
   para cualquier rol sin mapeo), confirmá que el comportamiento observado coincide.
3. Probá al menos una exportación (Excel o PDF) desde el dashboard de Alta Dirección o Jefe de
   Calidad, dado que son los dos flujos de export existentes.
4. No hace falta tocar ningún endpoint ni command del backend para este cutover, salvo que
   encuentres algo que ni la verificación de agosto ni esta investigación vieron — documentalo con
   el mismo criterio de los cutovers anteriores (causa raíz, archivo + línea, Decision en
   `design.md`).
5. Revertí `.env.development` al terminar. No toques `.env.production`.

## 5. Ciclo OpenSpec

Sin hallazgos bloqueantes que documentar como Decision de antemano — si la verificación revela algo
real (especialmente en los widgets o exports no revisados, Sección 3), documentalo con causa raíz
confirmada antes de corregirlo. Con este módulo cerrado, los ocho módulos de dominio del roadmap
original quedan cutover-eados — solo faltaría, como trabajo de mantenimiento futuro, archivar los
`openspec/changes/` pendientes (`cutover-no-conformidades`, `cutover-quality-events`,
`cutover-usuarios`, y este) cuando decidas hacerlo, y resolver el Open Question de hosting/dominio
de producción heredado de `cutover-auth`, que sigue abierto en todos los changes de esta serie.
