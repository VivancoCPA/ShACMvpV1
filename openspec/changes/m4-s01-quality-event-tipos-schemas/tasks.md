## 1. Tipos del dominio QE

- [x] 1.1 Crear `src/features/quality-events/types/qualityEvent.types.ts` con los tipos `QEOrigin`, `QEType`, `QESeverity`, `QEStatus`, `AnalisisCausaRaizMetodo`, `IshikawaCategoria` y la interfaz `ReporteExternoRef`
- [x] 1.2 Agregar las interfaces `CincoPorques` e `Ishikawa` en `qualityEvent.types.ts`
- [x] 1.3 Agregar la interfaz `QEAuditTrailEntry` (con `entidadTipo: 'QualityEvent'`) en `qualityEvent.types.ts`
- [x] 1.4 Agregar la interfaz `AccionCorrectivaQE` (stub con TODO comment) en `qualityEvent.types.ts`
- [x] 1.5 Agregar la interfaz `QualityEvent` completa (todos los campos requeridos y opcionales) en `qualityEvent.types.ts`
- [x] 1.6 Crear `src/features/quality-events/types/qualityEventPermissions.types.ts` con la interfaz `QEPermissions` (8 flags boolean)

## 2. Máquina de estados

- [x] 2.1 Crear `src/features/quality-events/utils/qualityEventTransitions.ts` con el mapa exhaustivo `VALID_QE_TRANSITIONS: Record<QEStatus, QEStatus[]>` y la función `getValidQETransitions(estado)`

## 3. Helpers y validadores de negocio

- [x] 3.1 Crear `src/features/quality-events/utils/qualityEventPermissions.ts` con la función `getQualityEventPermissions(estado, rol, esResponsable)` respetando la matriz RBAC completa
- [x] 3.2 Agregar `validateTransitionToEnEjecucion(qe)` en `qualityEventPermissions.ts` (RN-QE-002)
- [x] 3.3 Agregar `validateTransitionToPendienteCierre(qe)` en `qualityEventPermissions.ts` (RN-QE-003)
- [x] 3.4 Agregar `validateTransitionToCerrado(qe)` en `qualityEventPermissions.ts` (RN-QE-004)
- [x] 3.5 Crear `src/features/quality-events/utils/qualityEventHelpers.ts` con `requiereNotificacionUrgente(qe)` (RN-QE-005) y `estaVencidaVerificacion(qe, hoy)` con cálculo de días hábiles (RN-QE-008)

## 4. Schemas Zod

- [x] 4.1 Crear `src/features/quality-events/schemas/qualityEventCreate.schema.ts` con `cincoPorquesSchema` (array length 5) y `CincoPorquesInput`
- [x] 4.2 Agregar `ishikawaSchema` (array min 1, enum de categorías) y `IshikawaInput` en `qualityEventCreate.schema.ts`
- [x] 4.3 Agregar `qualityEventCreateSchema` (discriminated union por `origen`, con campos obligatorios por rama O1/O2/O3/O4) y `QualityEventCreateInput` en `qualityEventCreate.schema.ts`
- [x] 4.4 Crear `src/features/quality-events/schemas/qualityEventCierre.schema.ts` con `qualityEventCierreSchema` (resultadoCierre min 100, firmas duales, plazo con default 60) y `QualityEventCierreInput`

## 5. Constantes compartidas

- [x] 5.1 Agregar `QE_STATUS_LABELS`, `QE_TYPE_LABELS`, `QE_SEVERITY_LABELS` y `QE_ORIGIN_LABELS` en `src/constants/shared.constants.ts` sin modificar constantes existentes
- [x] 5.2 Agregar `QE_SEVERITY_COLORS` en `src/constants/shared.constants.ts` con las clases Tailwind por severidad

## 6. Barrel export

- [x] 6.1 Crear `src/features/quality-events/index.ts` con barrel exports de todos los tipos, interfaces, helpers, validadores y schemas del módulo M4

## 7. Tests unitarios

- [x] 7.1 Crear `src/features/quality-events/utils/__tests__/qualityEventTransitions.test.ts` con tests para `getValidQETransitions` cubriendo los 9 estados (incluyendo VERIFICADO terminal y REABIERTO → EN_EJECUCION)
- [x] 7.2 Crear `src/features/quality-events/utils/__tests__/qualityEventPermissions.test.ts` con tests para `validateTransitionToEnEjecucion` (RN-QE-002), `validateTransitionToPendienteCierre` (RN-QE-003) y `validateTransitionToCerrado` (RN-QE-004)
- [x] 7.3 Agregar tests para `getQualityEventPermissions` en `qualityEventPermissions.test.ts` cubriendo combinaciones rol/estado clave: OPERARIO, SUPERVISOR (ABIERTO vs EN_INVESTIGACION), JEFE_CALIDAD_SYST, AUDITOR_INTERNO (esResponsable true vs false), ALTA_DIRECCION, JEFE_CONTROL_DOCUMENTARIO
- [x] 7.4 Crear `src/features/quality-events/utils/__tests__/qualityEventHelpers.test.ts` con tests para `requiereNotificacionUrgente` (CRITICA/no-CRITICA) y `estaVencidaVerificacion` (vencida, no vencida, sin fecha, con realizada)
- [x] 7.5 Crear `src/features/quality-events/schemas/__tests__/qualityEventCreate.schema.test.ts` con tests para `cincoPorquesSchema` (exactamente 5), `ishikawaSchema` (min 1, enum) y `qualityEventCreateSchema` (discriminación O1/O2/O3/O4, validaciones base)
- [x] 7.6 Crear `src/features/quality-events/schemas/__tests__/qualityEventCierre.schema.test.ts` con tests para `qualityEventCierreSchema` (min 100 chars, firmas requeridas, default plazo 60)

## 8. Verificación TypeScript

- [x] 8.1 Ejecutar `tsc --noEmit` y confirmar cero errores de tipo en los archivos nuevos
- [x] 8.2 Verificar que `VALID_QE_TRANSITIONS` cubre exhaustivamente todos los valores de `QEStatus` (TypeScript error si falta algún key)
- [x] 8.3 Verificar que `QE_STATUS_LABELS`, `QE_SEVERITY_LABELS`, `QE_TYPE_LABELS` y `QE_ORIGIN_LABELS` son exhaustivos (TypeScript error si falta algún key)
- [x] 8.4 Ejecutar `npm test -- --testPathPattern=quality-events` y confirmar que todos los tests pasan
