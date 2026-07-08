## Context

M5 es hoy un placeholder de router (`/dashboard` → "Próximamente") sin ningún tipo, mock ni hook. No existe un documento PRD accesible en el repo con las fórmulas oficiales de los 9 KPIs de SHAC (el `AGENTS.md` referenciado en la tarea no existe; `openspec/AGENTS.mdt` es una copia parcial de `CLAUDE.md` sin sección de KPIs). Ante la ausencia de esa fuente, este change define un set de 9 KPIs plausibles para un sistema de calidad/SyST bajo ISO 9001:2015 §7.5 + ISO 45001:2018 §10.2, **calculables exclusivamente con campos que ya existen** en los dominios `quality-events`, `documents`, `nonconformities` e `incidents` (confirmado por inspección de `*.types.ts` y fixtures), más un fixture nuevo (`horasTrabajadas`) para el único KPI (frecuencia de incidentes) que lo requiere.

**Esto es una asunción de negocio, no un hecho del PRD.** Debe marcarse como tal y quedar abierta a corrección cuando el PRD real esté disponible — ver Open Questions.

Los 4 dominios fuente ya usan un store mutable en memoria por módulo (el mismo array que mutan sus propios handlers MSW, no el fixture estático re-importado) — este patrón ya está establecido por M1-M4 y este change lo reutiliza en modo lectura, sin añadir un quinto store propio para KPIs.

## Goals / Non-Goals

**Goals:**
- Tipos TS para 9 KPIs con fórmula/meta/frecuencia/fuente, sobre un contrato común parametrizado.
- 5 tipos `*DashboardData` específicos por rol (no un modelo genérico de widgets).
- RBAC real de `/dashboard` en `RoleGuard` (hoy solo visual en `Sidebar.tsx`).
- Fixture `horasTrabajadas` + handlers MSW + hooks TanStack Query que agregan en vivo sobre los stores de QE/NC/Incidentes/Documentos.

**Non-Goals:**
- Ninguna UI de dashboard (gráficos, cards, layouts) — eso es S02-S08.
- No se valida ni se re-deriva el PRD real; si aparece, este change puede requerir ajuste de fórmulas sin cambiar la forma de los tipos (ver Decisión 1).
- No se agrega un rol/tipo de dashboard para `JEFE_CONTROL_DOCUMENTARIO` distinto de `JefeCalidadDashboardData` (ver Decisión 4).

## Decisions

### 1. Un tipo común parametrizado (`KpiDefinition`/`KpiResult`) en vez de 9 interfaces
Los 9 KPIs comparten forma — `id`, `nombre`, `meta`, `frecuencia`, `fuente`, `semaforo` — y solo difieren en la fórmula de cálculo y el shape del `valor` resultante (porcentaje, tasa por 1,000,000 de horas, días promedio, conteo). Se define:
```typescript
type KpiId = 'KPI-01' | 'KPI-02' | ... | 'KPI-09'
type KpiFrecuencia = 'MENSUAL' | 'TRIMESTRAL'
type KpiUnidad = 'PORCENTAJE' | 'DIAS' | 'TASA' | 'CONTEO'

interface KpiDefinition {
  id: KpiId
  nombre: string
  descripcion: string
  formula: string          // texto legible, no ejecutable — la ejecución vive en el handler
  unidad: KpiUnidad
  meta: number
  frecuencia: KpiFrecuencia
  fuente: string            // dominio(s) de origen, texto legible
}

interface KpiResult {
  kpiId: KpiId
  valor: number
  meta: number
  semaforo: 'VERDE' | 'AMARILLO' | 'ROJO'
  periodo: string            // 'YYYY-MM' o 'YYYY-Qn' según frecuencia
  calculadoEn: string        // ISO 8601
}
```
**Alternativa considerada**: una interfaz por KPI (`Kpi01Documentos`, `Kpi02CierreOportuno`, ...). Descartada: para 9 tipos que comparten 6 de 7 campos, produce duplicación sin beneficio de tipado — ningún consumidor necesita acceso a un campo exclusivo de un KPI específico fuera de `formula`/`fuente`, que son solo texto descriptivo. El registro de las 9 definiciones vive como una constante (`KPI_DEFINITIONS: Record<KpiId, KpiDefinition>`), no como 9 tipos.

### 2. Los 9 KPIs propuestos (asunción de negocio — ver Open Questions)

| ID | Nombre | Fórmula | Meta | Frecuencia | Fuente |
|---|---|---|---|---|---|
| KPI-01 | Cumplimiento de Revisión Documentaria | % `Documento` en `PUBLICADO` con `fechaRevisionProxima >= hoy` | ≥95% | Mensual | Documentos |
| KPI-02 | Cierre Oportuno de Acciones Correctivas | % de AC (QE + NC + Incidentes) con `fechaCierre <= plazoFecha` sobre AC cerradas en el periodo | ≥90% | Mensual | QE, NC, Incidentes |
| KPI-03 | Tiempo Promedio de Cierre de Quality Events | Promedio en días de `fechaCierre - fechaHoraReporte` para QE en `CERRADO`/`VERIFICADO` | ≤15 días | Mensual | Quality Events |
| KPI-04 | Índice de Frecuencia de Incidentes | (N.º incidentes con `huboLesionados=true` × 1 000 000) / horas trabajadas del periodo | ≤5 | Mensual | Incidentes + `horasTrabajadas` |
| KPI-05 | Tasa de Reporte Proactivo SyST | % de `Incidente` con `tipo` en `CUASI_ACCIDENTE`/`CONDICION_INSEGURA` sobre el total de incidentes del periodo | ≥60% | Mensual | Incidentes |
| KPI-06 | Efectividad de Verificación de No Conformidades | % de `NoConformidad` con `resultadoVerificacion='EFECTIVO'` sobre NC verificadas en el periodo | ≥90% | Trimestral | No Conformidades |
| KPI-07 | Tasa de Reincidencia de Quality Events | % de `QualityEvent` con `ciclo > 1` sobre el total de QE del periodo | ≤10% | Trimestral | Quality Events |
| KPI-08 | Cierre Oportuno de Hallazgos de Auditoría | % de `QualityEvent` con `origen='O3_HALLAZGO_AUDITORIA'` en `CERRADO`/`VERIFICADO` sobre el total con ese origen en el periodo | ≥85% | Trimestral | Quality Events |
| KPI-09 | Cumplimiento de Firma Dual en Cierre de QE Críticos | % de `QualityEvent` con `severidad='CRITICA'` en `CERRADO`/`VERIFICADO` que tienen `cierreFirmaSupervisorId` registrado | 100% | Mensual | Quality Events |

Cada fórmula usa únicamente campos confirmados en `qualityEvent.types.ts`, `documents.types.ts`, `nonconformity.types.ts`, `incident.types.ts` (ver reporte de exploración) — ninguna referencia a un campo de "días perdidos"/`horasHombre`, que no existe en `Incidente`.

**Alternativa considerada para KPI-04**: un índice de severidad (tipo LTIFR con días perdidos). Descartada porque `Incidente` no tiene ningún campo de días/jornadas perdidas; usar `huboLesionados` (booleano ya existente) como proxy de "incidente con lesión" es la única fórmula computable sin inventar un campo nuevo en un dominio ya congelado (M3).

### 3. `horasTrabajadas.fixtures.ts` como fixture plano indexado por área+mes
```typescript
interface HorasTrabajadasEntry {
  area: string        // valor de AREAS_SHAC
  periodo: string      // 'YYYY-MM'
  horas: number
}
export const horasTrabajadasFixtures: HorasTrabajadasEntry[]
```
Se genera para las 19 áreas de `AREAS_SHAC` × 6 meses (alineados con el rango de fechas ya usado en `incidents.fixtures.ts`), con valores plausibles (p. ej. 800-4000 horas/mes según tamaño de área). Es un fixture estático de solo lectura — no tiene store mutable propio ni endpoints de escritura, porque no hay ninguna pantalla de M5 (S01-S08) que capture horas trabajadas; si se necesita en el futuro, se agrega como M5 posterior o RR.HH.

### 4. `JEFE_CONTROL_DOCUMENTARIO` reutiliza `JefeCalidadDashboardData`
El punto 2 del pedido original nombra exactamente 5 tipos (`Operario`, `Supervisor`, `JefeCalidad`, `AltaDireccion`, `Auditor`), pero el punto 3 exige RBAC para 6 roles. `JEFE_CONTROL_DOCUMENTARIO` no tiene un tipo propio. Se resuelve con un mapeo explícito `getDashboardDataTypeForRole(rol): 'OPERARIO' | 'SUPERVISOR' | 'JEFE_CALIDAD' | 'ALTA_DIRECCION' | 'AUDITOR'` donde `JEFE_CONTROL_DOCUMENTARIO → 'JEFE_CALIDAD'` — ambos son roles "jefe" con visibilidad completa de KPIs; los widgets de `JefeCalidadDashboardData` que dependen de datos fuera del alcance de Control Documentario (p. ej. `qeCriticosAbiertos`) se devuelven con arrays vacíos para ese rol en el handler, sin que el tipo necesite una variante. Si una spec futura pide un dashboard documentario distintivo, se extiende ahí — no se anticipa aquí (YAGNI).

**Alternativa considerada**: agregar un sexto tipo `JefeControlDocumentarioDashboardData`. Descartada por ahora: violaría el pedido explícito de "exactamente estos 5 tipos" sin una razón de negocio confirmada; el mapeo de reutilización es reversible y de bajo costo si luego se decide lo contrario.

### 5. Endpoints y hooks
- `GET /api/dashboard/kpis?periodo=YYYY-MM` → `KpiResult[]` (9 resultados). Sin filtro de área — los KPIs son organizacionales; el filtrado por área ocurre en el `*DashboardData` de cada rol, no en el endpoint de KPIs.
- `GET /api/dashboard/summary` → una de las 5 formas de `*DashboardData`, determinada server-side por el rol del usuario autenticado (vía el mismo mecanismo mock-auth ya usado por otros handlers, no por un query param de rol) y filtrada por `areasAsignadas`/`area` cuando corresponde (Supervisor/Operario).
- Hooks: `useDashboardKpis(periodo?)` y `useDashboardSummary()`, ambos `useQuery`, sin mutaciones (M5-S01 es de solo lectura). `QUERY_KEYS.dashboard = { kpis: (periodo) => [...], summary: () => [...] }`.
- Todo handler agrega sobre los stores mutables en vivo de cada dominio, nunca sobre el fixture estático (`qualityEventFixtures`, etc.) importado directamente. El patrón de exposición cross-módulo ya existe (`incidents.handlers.ts` exporta `getIncidentsStore(): Incidente[]`, consumido hoy por `locales.handlers.ts`); este change replica el mismo patrón agregando `getQeStore(): QualityEvent[]` en `quality-events.handlers.ts`, `getDocumentsStore(): Documento[]` en `documents.handlers.ts` y `getNonconformitiesStore(): NoConformidad[]` en `nonconformities.handlers.ts` — cada uno un getter de una línea sobre el `let` privado ya existente en ese archivo, sin alterar su comportamiento actual. `dashboard.handlers.ts` importa los 4 getters y nunca los fixtures.

### 6. RBAC de `/dashboard`
`RoleGuard requiredRoles={['OPERARIO','SUPERVISOR','JEFE_CALIDAD_SYST','JEFE_CONTROL_DOCUMENTARIO','AUDITOR_INTERNO','ALTA_DIRECCION']}` — los 6 roles de dominio, excluyendo `ADMINISTRADOR_SISTEMA` (rol de sistema puro, sin acceso a M1-M5 por regla ya establecida en `CLAUDE.md`). Esto amplía el acceso real más allá de lo que hoy filtra `Sidebar.tsx` (`JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`), así que `Sidebar.tsx` se corrige en el mismo change para no dejar el ítem de navegación inconsistente con el guard real.

## Risks / Trade-offs

- [Los 9 KPIs son una asunción, no el PRD real] → Documentado explícitamente en proposal/design; `KPI_DEFINITIONS` vive en un único archivo (`kpi.constants.ts`) para que ajustar fórmulas/metas cuando el PRD esté disponible sea un cambio localizado, no una migración de tipos.
- [`horasTrabajadas` es un fixture estático sin mutación] → Si una futura pantalla de RR.HH. necesita editarlo, requiere agregar store mutable + endpoints de escritura en ese momento; no se anticipa aquí.
- [`JEFE_CONTROL_DOCUMENTARIO` comparte tipo con `JefeCalidadDashboardData`] → Riesgo bajo: si S02-S08 revela que ambos roles necesitan widgets muy distintos, el tipo se puede especializar más adelante sin romper el contrato de los otros 4 roles.
- [Cálculo de KPIs en el handler MSW, no en un servicio de dominio compartido] → Aceptable para MVP mock-only; al migrar a backend .NET real, la fórmula de cada KPI se reimplementa server-side de todos modos (MSW nunca se porta 1:1).

## Open Questions

- ¿Existe el PRD real (`SHAC-PRD-003` sección 5.1/5.2) en algún sistema externo (Confluence, Drive, Linear)? Si aparece, este change (o un follow-up `m5-s01-fix-kpis-prd`) debe reconciliar `KPI_DEFINITIONS` y los widgets por rol contra el documento oficial.
- ¿`JEFE_CONTROL_DOCUMENTARIO` necesita un dashboard propio a mediano plazo, o el mapeo a `JefeCalidadDashboardData` es aceptable de forma permanente?
