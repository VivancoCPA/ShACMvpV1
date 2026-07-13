## Why

RN-QE-010 exige que los Quality Events de origen `O3_HALLAZGO_AUDITORIA` registren obligatoriamente la cláusula de la norma incumplida, pero hoy el único campo disponible es `hallazgoAuditoriaRef` (texto libre). No hay forma de validar la regla en creación, ni de agrupar o reportar hallazgos por norma/cláusula real — el widget `HallazgosPorAreaWidget` del dashboard de Auditor Interno tuvo que descoparse a agrupar por `areaAfectada` precisamente por esta falta de dato estructurado.

## What Changes

- **BREAKING** (interno, sin backend real): se elimina `hallazgoAuditoriaRef` de `QualityEvent`, reemplazado por `hallazgoCodigo` (código del hallazgo, ya contemplado en el PRD) y `normativaVinculada` (objeto estructurado `{ norma, clausula, normaOtraDetalle? }`).
- Nuevo tipo `NormaISO` (`'ISO_9001_2015' | 'ISO_45001_2018' | 'OTRA'`) y `NormativaVinculada`.
- Nuevo catálogo curado `clausulasISO.constants.ts` con cláusulas de ISO 9001:2015 e ISO 45001:2018 en 2 niveles (cláusula principal + subcláusula).
- Nuevo combobox con búsqueda para seleccionar `norma`/`clausula` del catálogo (mismo patrón que el combobox manual ya usado en `QualityEventForm` para el prelinking de área), con entrada de texto libre habilitada cuando `norma === 'OTRA'` o no hay match en el catálogo.
- `qualityEventCreateSchema` (rama O3): `normativaVinculada` pasa a ser obligatorio para guardar el QE (bloquea creación, no solo advertencia) — restaura RN-QE-010 con su significado original del PRD. `hallazgoCodigo` mantiene su obligatoriedad actual (sin cambio).
- Migración manual de fixtures: todo QE mock existente con `origen === 'O3_HALLAZGO_AUDITORIA'` y `hallazgoAuditoriaRef` se reparte caso por caso en `hallazgoCodigo` + `normativaVinculada` (no hay parser automático confiable para el texto libre heterogéneo existente).
- `HallazgosPorAreaWidget` (dashboard Auditor Interno) se corrige para agrupar por `normativaVinculada.norma` (y opcionalmente por cláusula principal) en vez de `areaAfectada`, manteniendo el guardrail de selector aislado que no filtra ni recalcula KPI-01 a KPI-09.
- Ambos campos (`hallazgoCodigo`, `normativaVinculada`) son editables dentro de la ventana de corrección RN-QE-014 (renumerada desde RN-QE-010 en un fix previo) como campos específicos del origen O3.

## Capabilities

### New Capabilities
- `quality-event-normativa-catalog`: tipo `NormaISO`/`NormativaVinculada`, catálogo curado de cláusulas ISO 9001:2015/45001:2018 (`clausulasISO.constants.ts`), y el combobox con búsqueda + fallback de texto libre para seleccionar norma/cláusula.

### Modified Capabilities
- `quality-event-types`: la interfaz `QualityEvent` reemplaza `hallazgoAuditoriaRef` (eliminado) por `hallazgoCodigo` y `normativaVinculada` (ambos opcionales a nivel de tipo; la obligatoriedad condicional por origen se enforce en el schema Zod, no en el tipo).
- `quality-event-schemas`: la rama O3 de `qualityEventCreateSchema` exige `normativaVinculada` además de `hallazgoCodigo`; se elimina toda referencia a `hallazgoAuditoriaRef`. El schema de edición de reporte inicial (RN-QE-014) incluye ambos campos como editables para origen O3.
- `quality-event-form`: reemplaza el input de texto libre de `hallazgoAuditoriaRef` por el combobox de normativa vinculada + el campo `hallazgoCodigo`, condicionado a `origen === 'O3_HALLAZGO_AUDITORIA'`, tanto en modo creación como en el subconjunto de campos editables de RN-QE-014.
- `quality-event-msw-fixtures`: fixtures de QEs O3 existentes migran manualmente de `hallazgoAuditoriaRef` a `hallazgoCodigo` + `normativaVinculada`, sin `hallazgoAuditoriaRef` remanente.
- `dashboard-auditor-view`: `HallazgosPorAreaWidget` agrupa por `normativaVinculada.norma`/cláusula principal en vez de `areaAfectada`. Nota: esta capability aún no está sincronizada a `openspec/specs/` (pendiente de archivo de `m5-s07-dashboard-auditorinterno`), aunque el widget ya existe implementado en código; el delta spec de este cambio asume que esa sincronización ya ocurrió o ocurre antes de aplicar este cambio.

## Impact

- Código: `src/features/quality-events/types/qualityEvent.types.ts`, `qualityEventCreate.schema.ts`, `qualityEventEditReporteInicial.schema.ts`, `QualityEventForm.tsx`, nuevo `clausulasISO.constants.ts`, nuevo componente combobox de normativa vinculada, `src/mocks/fixtures/quality-events.fixtures.ts`, `src/features/dashboard/components/HallazgosPorAreaWidget.tsx`.
- Sin cambios de backend real (no existe todavía); MSW handlers de creación no requieren cambio ya que la validación de campos condicionales por origen ya vive únicamente en el schema Zod del cliente (mismo patrón que O1/O2/O4).
- No afecta KPI-01 a KPI-09 (el widget corregido nunca fue un KPI oficial, era un widget descoped) — se verifica explícitamente antes de archivar este cambio.
- Fuera de alcance: comparativa de KPIs por norma entre locales (diferido a v2.0, OBS-ADD03-003); cualquier cambio a RN-QE-014 (antes RN-QE-010, ventana de corrección — ya resuelta en el fix de renumeración previo a esta propuesta).
