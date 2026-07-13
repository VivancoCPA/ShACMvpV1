## MODIFIED Requirements

### Requirement: Tipos de resumen (proyecciones ligeras) para widgets de dashboard
El sistema SHALL definir en `src/features/dashboard/types/dashboardSummary.types.ts` los tipos `QEResumen`, `IncidenteResumen`, `NCResumen`, `DocumentoResumen` y `AccionCorrectivaResumen`, cada uno como una proyección de un subconjunto de campos de su entidad completa (nunca la entidad completa), suficiente para renderizar una fila de widget: identificador, número/código, estado, severidad (cuando aplique), fecha relevante y área. `AccionCorrectivaResumen` SHALL incluir `origenTipo: 'QE' | 'NC' | 'INCIDENTE'` y `origenId: string` para permitir navegar al detalle correcto sin importar de qué dominio proviene la acción correctiva. `QEResumen` SHALL incluir además el campo opcional `fechaVerificacionProgramada?: string`, proyectado del campo homónimo de la entidad completa `QualityEvent`, para permitir que los widgets de dashboard determinen si un QE tiene un plazo de verificación real (RN-QE-008) antes de aplicar un tratamiento visual de semáforo.

#### Scenario: QEResumen no expone campos internos de análisis de causa raíz
- **WHEN** se construye un `QEResumen`
- **THEN** el tipo no incluye `cincoPorques`, `ishikawa` ni `auditTrail` (campos exclusivos del detalle completo de `QualityEvent`)

#### Scenario: AccionCorrectivaResumen identifica su dominio de origen
- **WHEN** se construye un `AccionCorrectivaResumen` a partir de una acción correctiva de un `Incidente`
- **THEN** `origenTipo === 'INCIDENTE'` y `origenId` es el `id` del incidente padre

#### Scenario: QEResumen proyecta fechaVerificacionProgramada cuando existe
- **WHEN** se construye un `QEResumen` a partir de un `QualityEvent` con `fechaVerificacionProgramada: '2026-07-10'`
- **THEN** el `QEResumen` resultante incluye `fechaVerificacionProgramada: '2026-07-10'`

#### Scenario: QEResumen omite fechaVerificacionProgramada cuando la entidad no la tiene
- **WHEN** se construye un `QEResumen` a partir de un `QualityEvent` sin `fechaVerificacionProgramada` definido
- **THEN** el `QEResumen` resultante tiene `fechaVerificacionProgramada: undefined`, no un valor inventado
