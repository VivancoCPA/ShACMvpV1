## 1. Catálogo y tipos de normativa vinculada

- [x] 1.1 Definir `NormaISO` y `NormativaVinculada` en `src/features/quality-events/types/qualityEvent.types.ts`
- [x] 1.2 Crear `src/constants/clausulasISO.constants.ts` con `CLAUSULAS_ISO` (ISO 9001:2015 e ISO 45001:2018, cláusulas 4–10, con subcláusulas) y el tipo `ClausulaISO`
- [x] 1.3 Crear `NormativaVinculadaCombobox.tsx` en `src/features/quality-events/components/` (norma select + dropdown filtrable de cláusulas + fallback de texto libre + campos para `norma === 'OTRA'`)
- [x] 1.4 Test unitario de `NormativaVinculadaCombobox`: filtrado por texto, fallback a texto libre sin match, campos de `OTRA`, `onChange` emite el objeto completo

## 2. QualityEvent — tipos y schemas

- [x] 2.1 En `qualityEvent.types.ts`: eliminar `hallazgoAuditoriaRef` de `QualityEvent`, agregar `hallazgoCodigo?: string` y `normativaVinculada?: NormativaVinculada`
- [x] 2.2 En `qualityEventCreate.schema.ts`: rama O3 exige `hallazgoCodigo` y `normativaVinculada` (con `.refine` para `normaOtraDetalle` obligatorio cuando `norma === 'OTRA'`); eliminar `hallazgoAuditoriaRef` del schema
- [x] 2.3 En `qualityEventEditReporteInicial.schema.ts`: reemplazar `hallazgoAuditoriaRef` por `hallazgoCodigo`/`normativaVinculada` en los campos opcionales editables
- [x] 2.4 Actualizar tests de ambos schemas para las nuevas ramas O3 (rechazo sin `normativaVinculada`, rechazo sin `hallazgoCodigo`, rechazo `OTRA` sin `normaOtraDetalle`, aceptación válida ISO y `OTRA`)

## 3. QualityEventForm

- [x] 3.1 Reemplazar el input de texto `hallazgoAuditoriaRef` por el input `hallazgoCodigo` + `NormativaVinculadaCombobox` (vía `Controller`) en la sección condicional O3
- [x] 3.2 Actualizar el efecto de limpieza al cambiar `origen`: limpiar `hallazgoCodigo` y `normativaVinculada` (antes limpiaba `hallazgoAuditoriaRef`)
- [x] 3.3 Actualizar `QualityEventForm.test.tsx` y tests relacionados con la sección O3 (reemplazar aserciones sobre `hallazgoAuditoriaRef` por `hallazgoCodigo`/`normativaVinculada`)
- [x] 3.4 Agregar traducciones `qualityEvents:form.hallazgoCodigoPlaceholder` (y las que necesite el combobox) en `es-PE.json` y `en-US.json`; eliminar `form.hallazgoPlaceholder` si queda huérfana

## 4. Migración de fixtures

- [x] 4.1 Migrar QE-2026-003: `hallazgoCodigo: 'HAL-2026-001'`, `normativaVinculada: { norma: 'ISO_9001_2015', clausula: '8.4.1' }`
- [x] 4.2 Migrar QE-2026-007: `hallazgoCodigo: 'HAL-2026-002'`, `normativaVinculada: { norma: 'ISO_9001_2015', clausula: '7.1.5' }`
- [x] 4.3 Migrar QE-2026-011: `hallazgoCodigo: 'HAL-2026-003'`, `normativaVinculada: { norma: 'ISO_45001_2018', clausula: '8.2' }`; actualizar su entrada de `auditTrail` (`campoModificado: 'hallazgoAuditoriaRef'` → `'normativaVinculada'`)
- [x] 4.4 Migrar QE-2026-015: `hallazgoCodigo: 'HAL-2026-004'`, `normativaVinculada: { norma: 'OTRA', normaOtraDetalle: 'Auditoría Operacional', clausula: '3.2' }`
- [x] 4.5 Migrar QE-2026-019: `hallazgoCodigo: 'HAL-2026-005'`, `normativaVinculada: { norma: 'ISO_9001_2015', clausula: '8.5.2' }`; actualizar su entrada de `auditTrail`
- [x] 4.6 Verificar (grep) que no queda ningún `hallazgoAuditoriaRef` en `quality-events.fixtures.ts` ni en `quality-events.handlers.ts`

## 5. Dashboard de Auditor Interno

- [x] 5.1 Confirmar que `m5-s07-dashboard-auditorinterno` está archivado (o archivarlo primero) para que `dashboard-auditor-view` exista en `openspec/specs/` antes de aplicar el delta de este cambio
- [x] 5.2 Renombrar `buildHallazgosPorArea()` → `buildHallazgosPorNorma()` en `dashboard.handlers.ts`, agrupando por `normativaVinculada.norma` (con `'OTRA'` colapsado a una sola fila, sin desglose por `normaOtraDetalle`)
- [x] 5.3 Renombrar `AuditorDashboardData['hallazgosPorArea']` → `hallazgosPorNorma: { norma: NormaISO; total: number }[]`
- [x] 5.4 Renombrar el componente `HallazgosPorAreaWidget.tsx` → `HallazgosPorNormaWidget.tsx`, mostrando etiquetas legibles (`'ISO 9001:2015'`, `'ISO 45001:2018'`, `'Otra normativa'`)
- [x] 5.5 Actualizar `AuditorDashboard.tsx` para importar y montar `HallazgosPorNormaWidget`
- [x] 5.6 Actualizar/renombrar los tests existentes de `HallazgosPorAreaWidget.test.tsx` → `HallazgosPorNormaWidget.test.tsx` y los de `dashboard.handlers.test.ts`/`AuditorDashboard.test.tsx` que referencian `hallazgosPorArea`

## 6. Verificación final

- [x] 6.1 Confirmar que KPI-01 a KPI-09 no leen `hallazgosPorArea`/`buildHallazgosPorArea` (deben ser independientes de este widget)
- [x] 6.2 Ejecutar la suite completa de `quality-events` y `dashboard` (`npm test` o equivalente) y confirmar verde
- [x] 6.3 Verificar manualmente en el navegador: crear un QE origen O3 sin `normativaVinculada` es rechazado; el combobox filtra y permite texto libre; el dashboard de `AUDITOR_INTERNO` muestra hallazgos agrupados por norma
- [x] 6.4 Actualizar `CLAUDE.md` con la nota de spec activa (normativa vinculada) — nota agregada bajo la etiqueta M4-S10 (M4-S08 ya está ocupado por `2026-07-04-m4-s08-edicion-qe-ventana-correccion`, archivado previamente)
