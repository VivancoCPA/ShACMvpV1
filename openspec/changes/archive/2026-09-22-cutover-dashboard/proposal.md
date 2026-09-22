## Why

`cutover-auth`, `cutover-catalogos`, `cutover-incidentes`, `cutover-documentos`, `cutover-no-conformidades`, `cutover-quality-events` y `cutover-usuarios` ya verificaron y cerraron los primeros siete módulos del roadmap contra el backend .NET real (los tres últimos siguen sin archivar, pendientes de que Toño decida cuándo). Dashboard (M5) es el octavo y último módulo de dominio. A diferencia de los siete anteriores, el backend de Dashboard (`Features/Dashboard/*`, change `be-dashboards`) ya fue implementado y verificado como puerto fiel del mock el 2026-08-21 (`dotnet test` 257/257) — lo que nunca se hizo es apuntar el frontend real contra ese backend real con MSW apagado y verificar el contrato de red extremo a extremo. La investigación de contrato (leyendo `dashboard.api.ts`, los tipos de ambos lados y los archivos backend relevantes) no encontró ningún mismatch.

## What Changes

- Apuntar `shc-controldoc` en desarrollo (`.env.development`, `VITE_ENABLE_MSW=false`) al backend .NET real y verificar, para cada uno de los 6 roles con acceso a Dashboard (`OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`), que `GET /api/dashboard/summary` y `GET /api/dashboard/kpis` devuelven datos reales que cada widget renderiza sin errores de consola ni campos `undefined` — sin tocar `.env.production`.
- Confirmar el 403 esperado en `/api/dashboard/kpis` para los roles sin acceso (`ADMINISTRADOR_EMPRESA`/`ADMINISTRADOR_SISTEMA`/`SUPERADMIN`), y confirmar que el comportamiento observado de `/api/dashboard/summary` (sin gate explícito por rol, 403 genérico para cualquier rol sin mapeo en `DashboardRoleMapping`) coincide con lo documentado.
- Probar al menos una exportación (Excel o PDF) desde el dashboard de Alta Dirección o Jefe de Calidad, confirmando que arma el archivo a partir de datos ya en memoria (`summary`/`kpis` ya cargados) y no de una llamada de red adicional con contrato propio.
- Documentar como hallazgo informativo (no bloqueante, no se corrige en este change) que `CargarHorasTrabajadas` y `CargarKpi04AnioAnterior` (`SUPERADMIN`-only) no tienen ningún punto de entrada en `dashboard.api.ts` ni en ningún componente del frontend — mismo patrón "sin UI real" ya visto en otros módulos, verificado por API directa.
- No se anticipa ningún cambio de código en backend ni frontend para cerrar un mismatch de contrato — la investigación previa no encontró ninguno. Cualquier discrepancia real que aparezca durante la verificación se corrige con causa raíz confirmada, no se asume de antemano.
- Como en los cutovers anteriores: inspeccionar los tests de Dashboard antes de asumir que dependen de MSW.
- Al cerrar: revertir `.env.development` a `VITE_ENABLE_MSW=true`. Con este módulo, los ocho módulos de dominio del roadmap original quedan cutover-eados.

## Capabilities

### New Capabilities

- `frontend-dashboard-cutover-verification`: escenarios de verificación manual/API para Dashboard contra el backend .NET real + Postgres real, sin MSW — summary y kpis para los 6 roles con acceso, el 403 para roles sin acceso, al menos una exportación, y los dos endpoints `SUPERADMIN`-only sin consumidor en la UI. Equivalente de Dashboard a `frontend-usuarios-cutover-verification`.

### Modified Capabilities

(Ninguna — no se detectó ningún requirement de contrato de `Features/Dashboard/**` que necesite cambiar; el contrato ya coincide, confirmado en la verificación independiente de agosto y en la investigación previa a este proposal.)

## Impact

- **Afectado (frontend)**: `shc-controldoc/.env.development` (ventana de verificación), tests de Dashboard que resulten depender de MSW tras inspección.
- **Afectado (backend)**: ninguno anticipado — a confirmar durante la verificación.
- **No afectado**: `dashboard.api.ts`, `dashboardRoleMapping.ts`, `kpi.constants.ts`, handlers MSW de Dashboard (se mantienen intactos hasta que se decida apagar MSW globalmente), `DashboardDataFetcher.cs`/`DashboardSummaryBuilder.cs` (ya confirmados estructuralmente correctos en agosto), los 25 componentes de widgets del frontend, los archivos de exportación (`buildAltaDireccionExportSections.ts`, `buildJefeCalidadExportSections.ts`, `exportToExcel.ts`, `exportToPdf.ts`).
- **Pendiente explícito, no se resuelve en este change**: `documentosPendientesLectura` (Operario) permanece siempre `[]` en ambos lados — decisión deliberada, sin definición de producto de "lectura confirmada"; sigue siendo decisión de Toño. Tampoco se construye ninguna UI de administración para `CargarHorasTrabajadas`/`CargarKpi04AnioAnterior`.
- **Fuera de alcance**: cualquier capa transversal que dependa de MSW globalmente hasta que se decida apagarlo por completo. Como trabajo de mantenimiento futuro (no parte de este change): archivar los `openspec/changes/` pendientes (`cutover-no-conformidades`, `cutover-quality-events`, `cutover-usuarios`, y este) y resolver el Open Question de hosting/dominio de producción heredado de `cutover-auth`.
