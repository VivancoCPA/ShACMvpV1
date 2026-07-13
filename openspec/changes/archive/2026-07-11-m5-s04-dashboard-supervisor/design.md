## Context

M5-S01 dejó tipos, RBAC y hooks de dashboard listos; M5-S02 dejó `SemaforoRow`/`SemaforoCriticoBanner`; M5-S03 conectó ambos en `OperarioDashboard`, estableciendo el patrón que esta spec replica: `DashboardPage` hace switch por rol, cada widget es una `<section>` con contenedor bordeado (`overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20`), estado vacío como `<p>` centrado, y `SemaforoRow` solo se usa cuando la entidad tiene un plazo real (nunca inventado).

`SupervisorDashboardData` (tipo) y `buildSupervisorData` (handler MSW) ya existen desde M5-S01 con: `kpisArea`, `qePorEstado` (conteo, no itemizado), `accionesCorrectivasVencidas` (itemizado pero con semántica más amplia que la pedida), `incidentesRecientes` (itemizado, listo para usar), `semaforoPlazos` (solo conteo agregado verde/amarillo/rojo, sin items). Esta spec es el **primer consumidor real** de `SupervisorDashboardData` — hasta ahora el tipo y el handler existían sin ninguna UI que los leyera.

## Goals / Non-Goals

**Goals:**
- Vista real en `/dashboard` para `SUPERVISOR`, con los 4 widgets del PRD §5.1, filtrados estrictamente por `areasAsignadas`.
- Reutilizar sin duplicar: `SemaforoRow`, `QEStatusBadge`, patrón de widget de M5-S03, y (para la acción "ver timeline") `QEAuditTrail` tal cual.
- Extender `SupervisorDashboardData`/`buildSupervisorData` con los campos itemizados que faltan para que el panel de semáforo pueda renderizar filas individuales (hoy solo hay conteos).
- Dejar documentado, con evidencia de código, qué acciones de QE pedidas por el PRD ya son reutilizables desde M4 y cuáles no, para que la decisión de alcance de esta spec sea auditable.

**Non-Goals:**
- No se extrae ni generaliza el `PinModal` de `QEInvestigationSection`/`QECierreSection` en un `SignatureModal` reutilizable — se documenta como trabajo futuro, no bloquea esta spec.
- No se construye una función de "asignar/reasignar responsable" — no existe hoy ni para QE ni para AC post-creación; es un gap de M4, no de este dashboard.
- No se tocan los dashboards de `JEFE_CALIDAD_SYST`, `AUDITOR_INTERNO`, `ALTA_DIRECCION` (S05-S07).
- No se crean endpoints MSW nuevos; toda la data sigue viniendo de `GET /api/dashboard/summary`.

## Decisions

### 1. Gap-check de las 4 acciones del dashboard (verificado en código antes de diseñar)

| Acción pedida | ¿Existe reutilizable? | Evidencia | Decisión para S04 |
| --- | --- | --- | --- |
| Validar QEs del área | Parcial — la mutación de transición de estado (`useTransitionQEStatus`, `PATCH /api/quality-events/:id/status`) y sus utils de permisos/transición son genéricas, pero requieren el objeto `QualityEvent` completo + rol, no solo el `QEResumen` que trae el dashboard. La aprobación de causa raíz vive como estado local privado dentro de `QEInvestigationSection`, no exportada. | `src/features/quality-events/hooks/useTransitionQEStatus.ts`, `src/features/quality-events/components/QEStatusTransitionPanel.tsx`, `src/features/quality-events/components/QEInvestigationSection.tsx` | Navegar a `/quality-events/:id`; el Supervisor valida desde el detalle con el flujo ya existente. No se embebe `QEStatusTransitionPanel` en el dashboard (exigiría cargar el QE completo, fuera de alcance). |
| Asignar responsables | No existe. No hay mutación de reasignación post-creación de AC (`useUpdateQEAccion` solo acepta `estado`/`descripcionEvidencia`/`evidenciaUrl`); `QualityEvent` no tiene campo de responsable propio; no hay picker de usuario reutilizable (solo un `<select>` privado dentro de `AgregarQEACModal`). | `src/features/quality-events/hooks/useUpdateQEAccion.ts`, `src/features/quality-events/schemas/updateQEAccion.schema.ts`, `QEACSection.tsx` | Fuera de alcance. El dashboard navega al detalle (mismo link que "validar"); no se construye picker ni mutación nueva en esta spec. |
| Ver timeline de QE | Sí, completamente reutilizable — componente autocontenido, solo pide `qeId`. | `src/features/quality-events/components/QEAuditTrail.tsx` (`QEAuditTrail({ qeId })`, usa `useQEAuditTrail(qeId)` internamente) | Podría embeberse directo en el dashboard, pero dado que el resto de acciones navegan al detalle (para no fragmentar el flujo del Supervisor entre dos pantallas), esta spec también navega a `/quality-events/:id#timeline`-equivalente: click en la fila del widget de semáforo ya lleva al detalle, que ya incluye `QEAuditTrail`. No se agrega un modal de timeline separado en el dashboard. |
| Firmar cierre de QE | Mutación reutilizable (`useFirmarCierre`, `PATCH /api/quality-events/:id/firmar-cierre`), pero la UI de PIN está duplicada (dos `PinModal` privados casi idénticos) y entrelazada con estado local de `QECierreSection` (`showFirstSignature`/`showPendingSecondSignature`/etc.). | `src/features/quality-events/hooks/useFirmarCierre.ts`, `src/features/quality-events/components/QECierreSection.tsx` | Navegar a `/quality-events/:id`; extraer un `SignatureModal` genérico queda fuera de alcance (ver Non-Goals). |

Conclusión de diseño: **todas las acciones de QE del dashboard son enlaces de navegación a `/quality-events/:id`** (vía `onClick` en las filas de `SemaforoRow` o botones de widget), reutilizando el 100% de la lógica de validación/asignación/timeline/firma que ya vive en `QualityEventDetail`. Esto replica exactamente la decisión que M5-S03 ya tomó para el cierre de ACs ("click navega al detalle del dominio de origen, que ya tiene su propia sección de cierre").

### 2. Extensión de `SupervisorDashboardData` — solo 3 campos nuevos, sin endpoint nuevo

El tipo ya cubre 2 de los 4 widgets tal cual (`incidentesRecientes` para el widget 4; `accionesCorrectivasVencidas`, con un ajuste de filtro, para el widget 3). Faltan datos itemizados para los widgets 1 y 2:

```typescript
export interface SupervisorDashboardData {
  kpisArea: KpiResult[]
  qePorEstado: Record<QEStatus, number>
  qeAbiertosPorTipo: Record<QEType, number>              // NUEVO — widget 2
  qesEnVerificacionArea: QEResumen[]                      // NUEVO — widget 1 (lado QE)
  accionesCorrectivasPendientesArea: AccionCorrectivaResumen[] // NUEVO — widget 1 (lado AC)
  accionesCorrectivasVencidas: AccionCorrectivaResumen[]  // MODIFICADO: filtro ahora estado === 'EN_EJECUCION'
  incidentesRecientes: IncidenteResumen[]
  semaforoPlazos: { verde: number; amarillo: number; rojo: number }
}
```

- `qeAbiertosPorTipo`: mismo criterio de "abierto" que `qeCriticosAbiertos` en `buildJefeCalidadData` (`estado !== 'CERRADO' && estado !== 'VERIFICADO'`), calculado sobre `qes` (ya filtrado por área en `buildSupervisorData`), reduce por `qe.tipo`.
- `qesEnVerificacionArea`: `qes.filter(qe => qe.estado === 'EN_VERIFICACION' && qe.fechaVerificacionProgramada).map(toQEResumen)` — mismo criterio de elegibilidad de semáforo que `MisQEsWidget` (M5-S03), aplicado a nivel de área en vez de `reportadoPorId`.
- `accionesCorrectivasPendientesArea`: `collectACsWithOrigin(qes, ncs, incidentes).filter(({ac}) => ac.estado !== 'CERRADA').map(toACResumen)` — el mismo cálculo que hoy alimenta `semaforoPlazos` (variable `pendientes` en el handler), pero expuesto como lista itemizada en vez de solo agregado. `semaforoPlazos` se mantiene sin cambios (no tiene consumidor en esta spec, pero no se elimina — evita romper contrato del tipo).
- `accionesCorrectivasVencidas`: cambia el filtro de `ac.estado !== 'CERRADA'` a `ac.estado === 'EN_EJECUCION'` (además de `plazoFecha < hoy`), para igualar el criterio explícito del PRD. Como esta spec es el primer consumidor real, no hay regresión de comportamiento visible en ningún widget existente.

### 3. Widget 1 usa dos `SemaforoRow` lists en una sola sección, no dos widgets separados

El PRD pide un "panel de pendientes del área (semáforo)" único que junta QEs y ACs. Se implementa como una sola `<section>` con dos sub-listas internas (QEs primero, luego ACs), cada fila usando `SemaforoRow` con `calcularEstadoSemaforoDesdeFecha` (igual que `MisQEsWidget`/`MisACsWidget`), en vez de fusionar ambos arreglos en un tipo común — evita inventar un tipo union artificial solo para renderizar, y mantiene cada `onClick` apuntando a la ruta de detalle correcta (`/quality-events/:id` para QE, `${ORIGEN_ROUTE[origenTipo]}/${origenId}` para AC, reutilizando el mismo mapa de rutas que `MisACsWidget`).

### 4. Widget 2 (QEs por tipo) es un conteo simple, no una lista

`qeAbiertosPorTipo` es `Record<QEType, number>`; el widget renderiza 4 filas fijas (una por `QEType`) con el conteo, sin necesidad de paginación ni `SemaforoRow` (no hay plazo por tipo, es una agregación). Clic opcional en una fila podría filtrar el listado general de QEs por tipo+área, pero **queda fuera de alcance** — el PRD solo pide mostrar el conteo, no un filtro cruzado; se documenta como posible mejora futura, no se implementa un query-param de navegación no solicitado.

### 5. Integración en `DashboardPage` y router

Mismo patrón exacto que M5-S03:
```tsx
if (dashboardType === 'OPERARIO') return <OperarioDashboard />
if (dashboardType === 'SUPERVISOR') return <SupervisorDashboard />
return <ComingSoon label="Dashboard" />
```
No se toca `RoleGuard` ni `router/index.tsx` — la ruta `/dashboard` y su `RoleGuard` de 6 roles ya existen desde M5-S01/S03.

## Risks / Trade-offs

- [Cambiar el filtro de `accionesCorrectivasVencidas` de "no cerrada" a "EN_EJECUCION"] → Mitigación: ningún componente consume hoy ese campo (primer consumidor real es esta spec); se actualiza `dashboard.handlers.test.ts` en el mismo cambio para fijar el nuevo comportamiento como contrato explícito.
- [`Incidente` no tiene campo de área alineado a `AREAS_SHAC`, solo `localNombre`/`zonaNombre` — ya documentado como aproximación en el handler existente] → Mitigación: sin cambios en esta spec; se hereda la limitación conocida, no se expande su alcance. Si el PRD requiere precisión estricta de área para incidentes, es un gap de M3, no de S04.
- [Navegar-en-vez-de-embeber para 3 de las 4 acciones podría sentirse menos "todo en un solo dashboard"] → Mitigación: consistente con la decisión ya tomada en M5-S03 para cierre de ACs; evita duplicar lógica de PIN/firma/transición fuera de `QualityEventDetail`, que es justamente el criterio de "no reimplementar" pedido explícitamente para esta spec.

## Open Questions

Ninguna — el alcance de datos, filtrado y las 4 acciones quedó resuelto con la verificación de código de esta sección. Cualquier extracción futura de `SignatureModal` genérico o de un flujo de reasignación de responsable es trabajo de M4, a proponerse como spec independiente si se prioriza.
