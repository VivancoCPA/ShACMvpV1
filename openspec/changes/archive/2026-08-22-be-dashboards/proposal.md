## Why

Incidentes, No Conformidades y Quality Events ya corren contra el backend .NET real; Dashboard (M5) es el módulo de agregación de solo lectura sobre esos tres dominios y no tiene bloqueantes de dependencia salvo Documentos (M1, todavía no implementado), que ya se difiere explícitamente para los dos puntos que dependen de él. El resto del módulo (9 KPIs + resumen por rol) puede construirse ahora reutilizando datos que el backend ya persiste.

## What Changes

- Nuevo endpoint `GET /api/dashboard/kpis`: calcula en vivo los 9 KPIs de SHAC-PRD-003 §5.2, scoped a la empresa activa, con query opcional `periodo` (`YYYY-MM`, default mes actual). KPI-06 (dependiente de Documentos) responde `valor: 0` con TODO explícito, no una tabla nueva.
- Nuevo endpoint `GET /api/dashboard/summary`: shape de `data` dependiente del rol efectivo del usuario en la empresa activa (`OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD`, `ALTA_DIRECCION`, `AUDITOR`, `JEFE_CONTROL_DOC`), reconstruido carácter por carácter contra `dashboard.handlers.ts` del frontend. Todo lo que ese resumen expone y depende de Documentos (`documentosPendientesLectura`, `resumenPorModulo.documentos`, `evidenciasHallazgos` de hallazgos O3) se difiere con el mismo criterio que KPI-06.
- Dos tablas nuevas de carga manual (sin integración externa, RR.HH. no existe todavía): `HorasTrabajadas` (empresaId, areaId, periodo, horas) — denominador de KPI-04 — y `Kpi04ValorAnioAnterior` (empresaId, periodo, valor) — comparación interanual del semáforo de KPI-04. Cada una con su endpoint de carga/actualización, gateado a `SUPERADMIN` (mismo rol que ya gatea toda la administración organizacional de Empresas, ver Impact).
- Dos decisiones de derivación de fechas no cubiertas por el mock (que las modela como campos literales) porque el backend real no persiste esas columnas — ver design.md: `QualityEvent.FechaCierre`/`FechaAnalisisCompletado`/`FechaVerificacionRealizada` se derivan de `QualityEventAuditTrail` en vez de añadir columnas nuevas.
- **BREAKING**: ninguno — ambos endpoints principales son nuevos, no modifican contratos existentes.

## Capabilities

### New Capabilities
- `be-dashboard-api`: los dos endpoints de solo lectura (`/api/dashboard/kpis`, `/api/dashboard/summary`) — cálculo de los 9 KPIs y los 6 shapes de resumen por rol, scoped a empresa activa, con los puntos dependientes de Documentos diferidos.
- `be-dashboard-carga-manual`: las dos tablas y endpoints de carga manual (`HorasTrabajadas`, `Kpi04ValorAnioAnterior`) que alimentan el denominador y el semáforo interanual de KPI-04, gateados a `SUPERADMIN`.

### Modified Capabilities
(ninguna — no existen specs backend previas de Dashboard; los specs `dashboard-*` en `openspec/specs/` describen el frontend/mock, no el backend, y no se tocan)

## Impact

- **Código nuevo**: `ShcMvpEndPoint/Features/Dashboard/**` (endpoints `ObtenerKpis`, `ObtenerSummary`, `CargarHorasTrabajadas`, `CargarKpi04AnioAnterior`), entidades de dominio nuevas (`HorasTrabajadas`, `Kpi04ValorAnioAnterior`), migración EF Core, `DbSet` nuevos en `ShacDbContext`.
- **Patrón de acceso a datos**: 100% Dapper para los dos GET de agregación (mismo patrón que `ListarQualityEventsHandler`/`ObtenerQualityEventHandler` — consulta por dominio + agregación en memoria en C#, sin EF Core ni vistas materializadas); EF Core para las dos mutaciones simples de carga manual (mismo patrón que el resto de mutaciones del proyecto, incluido `ResetPinHandler`).
- **Tests**: nuevos tests de integración en `ShcMvpEndPoint.Tests/Features/Dashboard`, partiendo de la suite actual.
- **Discrepancias detectadas contra el mock real, para decisión humana antes o durante `design.md`** (no resueltas unilateralmente, ver design.md sección de discrepancias):
  1. `QualityEvent` (entidad .NET) no tiene columnas `FechaCierre`, `FechaAnalisisCompletado` ni `FechaVerificacionRealizada` — el mock las trata como campos literales del `QualityEvent` de TypeScript, pero en el backend real solo existen como transiciones dentro de `QualityEventAuditTrail`. Se derivan por consulta al audit trail en vez de agregar columnas redundantes (evita duplicar la fuente de verdad que ya escriben `TransicionarEstadoQEHandler`/`VerificacionEficaciaQEHandler`).
  2. **Resuelta (fix post-implementación, confirmado por Cowork)**: `NoConformidad.FechaCierre` está documentado en el propio código (`NoConformidad.cs`) como "fecha límite ESPERADA de cierre... se persiste tal cual la envía el cliente, sin cálculo server-side" y nunca se sincroniza con el cierre real — usarla literalmente en `tendenciaTrimestral.ncCerradas` (como hacía la primera versión de este cambio) era un bug real, no solo una discrepancia teórica. Se corrigió: `tendenciaTrimestral.ncCerradas` ahora deriva la fecha real de cierre de `NoConformidadAuditTrail` (ver design.md D13), sin tocar `NoConformidad.FechaCierre` ni el contrato de `be-no-conformidades`.
  3. `/api/dashboard/kpis` no tiene ningún gate de rol en el mock (cualquier usuario autenticado lo puede llamar). Este cambio lo gatea a los mismos 6 roles operativos que sí tienen acceso a `/summary` (excluye `ADMINISTRADOR_SISTEMA`/`ADMINISTRADOR_EMPRESA`/`SUPERADMIN`, consistente con el invariante de CLAUDE.md de que `ADMINISTRADOR_SISTEMA` no accede a ningún módulo operativo) — endurecimiento deliberado respecto al mock, no un contrato roto (el mock nunca dependió de que roles administrativos lo llamaran).
