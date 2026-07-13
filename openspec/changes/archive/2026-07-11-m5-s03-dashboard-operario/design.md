## Context

M5-S01 (archivado) dejó `useDashboardSummary()` retornando `OperarioDashboardData` ya filtrado server-side por `reportadoPorId`/`responsableId` del usuario autenticado, y `RoleGuard` ya protege `/dashboard` para los 6 roles de dominio. M5-S02 (implementado, pendiente de archivar) dejó `SemaforoRow` y `SemaforoCriticoBanner` como componentes puros sin consumidor todavía. `/dashboard` sigue renderizando `<ComingSoon label="Dashboard" />` de forma incondicional para todos los roles.

Se investigaron los tres flujos que el PRD pide reutilizar antes de escribir código nuevo:
- **Crear reporte O1**: `QualityEventForm` (`/quality-events/nuevo`) ya lee `origen` de `useSearchParams()` para preseleccionar el origen — confirmado en `QualityEventForm.tsx:85`. No hace falta ningún componente nuevo.
- **Cerrar AC con evidencia**: no existe un componente único reutilizable — cada dominio de origen (`QE`, `NC`, `INCIDENTE`) tiene su propia sección de cierre embebida en su página de detalle (`QEACSection`, `ACSection`, `IncidentACSection` respectivamente), cada una con su propio modal de cierre con `descripcionEvidencia`/`evidenciaUrl`. Extraer un componente genérico de cierre sería una refactorización mayor fuera del alcance de esta spec y duplicaría lógica de negocio ya validada por dominio.
- **Notificaciones**: no existe ningún sistema de notificaciones (confirmado por búsqueda en todo `src/`). Excluido de esta spec por decisión explícita del usuario.

## Goals / Non-Goals

**Goals:**
- Reemplazar el placeholder de `/dashboard` por una vista real cuando `user.rol === 'OPERARIO'`.
- Mostrar "Mis QEs reportados" y "Mis ACs asignadas" reusando los datos ya filtrados de `useDashboardSummary()` y los componentes visuales de M5-S02.
- Dar acceso de un click a: crear reporte O1, ver detalle de QE, ir a cerrar una AC en su pantalla de origen.

**Non-Goals:**
- Dashboards de los otros 5 roles (S04-S07) — siguen mostrando `<ComingSoon>`.
- Widget de notificaciones — excluido, ver Context.
- Widgets de `misIncidentesReportados` y `documentosPendientesLectura` — datos ya disponibles en `OperarioDashboardData` pero fuera del alcance pedido para esta iteración.
- Un componente de "cerrar AC" genérico/reutilizable entre dominios — se navega al existente por dominio en vez de construir uno nuevo.

## Decisions

**1. `DashboardPage` hace el switch por rol, no el router.**
`router/index.tsx` reemplaza `<ComingSoon label="Dashboard" />` por `<DashboardPage />` una sola vez. `DashboardPage` lee `user.rol` de `authStore`, resuelve `getDashboardDataTypeForRole` (ya existente) y renderiza `<OperarioDashboard />` solo para `'OPERARIO'`; para los otros 4 valores de retorno (`SUPERVISOR`, `JEFE_CALIDAD`, `ALTA_DIRECCION`, `AUDITOR`) renderiza `<ComingSoon label="Dashboard" />`. Alternativa descartada: 5 rutas separadas (`/dashboard` con lógica en el router) — se descarta porque el router ya no tiene acceso directo al rol resuelto sin duplicar el mapeo, y porque las specs futuras (S04-S07) solo necesitan agregar un `case` dentro de `DashboardPage`, no tocar `router/index.tsx` de nuevo.

**2. `SemaforoRow` en "Mis QEs" solo aplica cuando hay un plazo real (`EN_VERIFICACION` + `fechaVerificacionProgramada`).**
Ningún otro estado del ciclo de vida de QE tiene una regla de negocio (`RN-QE-*`) que defina un plazo — inventar uno violaría el principio de no generar comportamiento no soportado por las reglas de negocio del proyecto. Se extiende `QEResumen` con `fechaVerificacionProgramada?: string` (ya existe en la entidad completa `QualityEvent`, solo falta proyectarlo). Cuando el campo está ausente o el estado no es `EN_VERIFICACION`, `MisQEsWidget` renderiza una fila simple con `QEStatusBadge` (ya existente) en vez de `SemaforoRow`. Alternativa descartada: usar `fechaHoraReporte` como pseudo-plazo — se descarta por no representar ninguna regla de negocio real, generando una señal visual engañosa.

**3. "Cerrar AC" navega al detalle de origen; no se abre un modal desde el dashboard.**
`MisACsWidget` resuelve la ruta de destino a partir de `AccionCorrectivaResumen.origenTipo`: `QE → /quality-events/:origenId`, `NC → /nonconformities/:origenId`, `INCIDENTE → /incidents/:origenId`. El cierre real ocurre en la sección de AC ya existente de cada página de detalle. Alternativa descartada: extraer `CerrarQEACModal` a un componente compartido invocable desde el dashboard — significaría re-arquitecturar 3 componentes ya probados y en producción por una ganancia marginal (evitar una navegación), fuera de proporción para esta spec.

**4. Los dos widgets muestran una lista simple sin paginación propia.**
`misQEReportados` y `accionesCorrectivasAsignadas` ya vienen acotados a "lo mío" desde el handler (no son listas globales), consistente con el patrón de los demás widgets de resumen de M5-S01 (`qeCriticosAbiertos`, `alertasCriticas`, etc., ninguno paginado). Si el volumen crece en producción, es responsabilidad de una spec de dashboard posterior introducir un límite/paginación — no se anticipa aquí (YAGNI).

## Risks / Trade-offs

- **[Riesgo] Un Operario con muchos QEs/ACs abiertos ve una lista larga sin paginar** → Mitigación: fuera de alcance por ahora (ver Decisión 4); el dato ya viene filtrado a "lo mío", que en la práctica es un conjunto pequeño por usuario.
- **[Riesgo] La regla "solo `EN_VERIFICACION` tiene semáforo" puede no coincidir con la expectativa visual del usuario final (que pidió semáforo para todos los QEs)** → Mitigación: documentado explícitamente en proposal.md y aquí; es una decisión reversible en una spec de ajuste si el usuario de negocio confirma otro criterio de plazo.
- **[Riesgo] Extender `QEResumen` es un cambio a un contrato ya archivado (M5-S01)** → Mitigación: es un campo opcional (`?`), no rompe ningún consumidor existente de `QEResumen`; se declara como Modified Capability en `dashboard-types` y `dashboard-msw-handlers`.

## Open Questions

- ¿Debería `misIncidentesReportados` sumarse a "Mis QEs reportados" en una futura iteración, o vive como su propio widget? No se resuelve aquí — el dato ya existe en `OperarioDashboardData` sin consumir.
