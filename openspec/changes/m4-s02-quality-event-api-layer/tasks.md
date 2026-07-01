## 1. Tipos TypeScript

- [x] 1.1 Agregar `QEListParams` a `src/features/quality-events/types/qualityEvent.types.ts` con campos `estado?`, `tipo?`, `severidad?`, `origen?`, `areaAfectada?`, `fechaDesde?`, `fechaHasta?`, `ciclo?`, `page`, `pageSize`
- [x] 1.2 Agregar `QEStatusTransitionInput` = `{ nuevoEstado: QEStatus; comentario?: string; firmaPin?: string }` al mismo archivo de tipos
- [x] 1.3 Agregar `QualityEventCreateInput` y `QualityEventUpdateInput` (Partial de los campos editables de `QualityEvent`) al mismo archivo

## 2. API Client

- [x] 2.1 Crear `src/features/quality-events/api/quality-events.api.ts` con las 5 funciones Axios puras usando la instancia `api` de `src/lib/axios.ts`
- [x] 2.2 Implementar `getQualityEvents(params: QEListParams)` con `api.get('/api/quality-events', { params })`
- [x] 2.3 Implementar `getQualityEvent(id: string)` con `api.get(\`/api/quality-events/${id}\`)`
- [x] 2.4 Implementar `createQualityEvent(data: QualityEventCreateInput)` con `api.post('/api/quality-events', data)`
- [x] 2.5 Implementar `updateQualityEvent(id, data: QualityEventUpdateInput)` con `api.patch(\`/api/quality-events/${id}\`, data)`
- [x] 2.6 Implementar `transitionQEStatus(id, data: QEStatusTransitionInput)` con `api.patch(\`/api/quality-events/${id}/status\`, data)`

## 3. Fixtures MSW

- [x] 3.1 Leer `shc-controldoc/src/mocks/fixtures/incidents.fixtures.ts` y `nonconformities.fixtures.ts` para confirmar los IDs: `inc-002` (CRITICA), `inc-001` (ALTA), `nc-002` (NC-CAL), `nc-003` (NC-SST)
- [x] 3.2 Crear `shc-controldoc/src/mocks/fixtures/quality-events.fixtures.ts` con `qe-2026-001`: O1·SST·CRITICA·EN_INVESTIGACION, `incidenteId: 'inc-002'`, sin `causaRaizFirmadaEn`, auditTrail 2 entradas, comentario TODO(M4-S05)
- [x] 3.3 Agregar `qe-2026-002`: O2·CALIDAD·ALTA·EN_EJECUCION, `ncId: 'nc-002'`, `causaRaizFirmadaEn` presente, auditTrail 3 entradas, comentario TODO(M4-S05)
- [x] 3.4 Agregar `qe-2026-003`: O3·ADUANERO·MEDIA·PENDIENTE_CIERRE, `hallazgoAuditoriaRef: 'HAL-2026-001 · ISO 9001:2015 · §8.4.1'`, `cerradoPorId` presente, `cierreFirmaSupervisorId` ausente
- [x] 3.5 Agregar `qe-2026-004`: O4·OPERACIONAL·BAJA·VERIFICADO, `resultadoVerificacion: 'EFECTIVO'`, auditTrail ≥7 entradas cubriendo ciclo completo
- [x] 3.6 Agregar `qe-2026-005`: O1·SST·ALTA·REABIERTO·ciclo:2, `incidenteId: 'inc-001'`, `resultadoVerificacion` anterior `'NO_EFECTIVO'`, comentario TODO(M4-S05)
- [x] 3.7 Agregar `qe-2026-006`: O2·SST·CRITICA·ABIERTO·ciclo:1, `ncId: 'nc-003'`, sin investigación iniciada, comentario TODO(M4-S05)
- [x] 3.8 Agregar `qe-2026-007`: O3·CALIDAD·MEDIA·ANALISIS_COMPLETADO, `metodoAnalisis: '5_PORQUES'`, array `cincoPorques` de 5 entradas, `causaRaizFirmadaEn` ausente
- [x] 3.9 Agregar `qe-2026-008`: O4·OPERACIONAL·ALTA·EN_VERIFICACION, `plazoVerificacionDias: 60`, `fechaVerificacionProgramada` a 15 días hábiles desde 2026-07-01
- [x] 3.10 Exportar `qualityEventFixtures: QualityEvent[]` como export nombrado del archivo

## 4. MSW Handlers

- [x] 4.1 Crear `shc-controldoc/src/mocks/handlers/quality-events.handlers.ts` con array mutable `let qeStore = [...qualityEventFixtures]` para simular persistencia en sesión
- [x] 4.2 Implementar `GET /api/quality-events`: filtrar `qeStore` por `estado`, `tipo`, `severidad`, `origen` si están en query params; paginar con `page`/`pageSize`; retornar `ApiResponse<QualityEvent[]>` con `pagination`; `await delay(400)`
- [x] 4.3 Implementar `GET /api/quality-events/:id`: buscar en `qeStore` por `id`; 404 si no existe; `await delay(400)`
- [x] 4.4 Implementar `POST /api/quality-events`: validar campo de vinculación según `origen` (O1→`incidenteId`, O2→`ncId`, O3→`hallazgoAuditoriaRef`, O4→`reporteExternoRef`); 422 si falta; generar `numero` autonumérico; push a `qeStore`; retornar 201; `await delay(400)`
- [x] 4.5 Implementar `PATCH /api/quality-events/:id`: actualizar campos editables del QE en `qeStore`; no cambia estado; retornar QE actualizado; `await delay(400)`
- [x] 4.6 Implementar `PATCH /api/quality-events/:id/status`: guard RN-QE-002 (`nuevoEstado === 'EN_EJECUCION'` sin `causaRaizFirmadaEn` → 422); guard RN-QE-004 (`nuevoEstado === 'CERRADO'` sin `cierreFirmaSupervisorId` → 422); caso válido → actualizar estado, agregar entrada a `auditTrail`, retornar QE; `await delay(400)`
- [x] 4.7 Exportar `qualityEventHandlers` como export nombrado del archivo

## 5. Registro en handlers index

- [x] 5.1 Importar `qualityEventHandlers` en `shc-controldoc/src/mocks/handlers/index.ts`
- [x] 5.2 Agregar `...qualityEventHandlers` al array de handlers exportado

## 6. Hooks TanStack Query

- [x] 6.1 Crear `shc-controldoc/src/features/quality-events/hooks/useQualityEvents.ts` con `QE_QUERY_KEYS` exportado y hook `useQualityEvents(filters: QEListParams)` usando `useQuery`
- [x] 6.2 Crear `shc-controldoc/src/features/quality-events/hooks/useQualityEvent.ts` con hook `useQualityEvent(id: string)` y `enabled: Boolean(id)`
- [x] 6.3 Crear `shc-controldoc/src/features/quality-events/hooks/useCreateQualityEvent.ts` con `useMutation`; `onSuccess`: invalidar `QE_QUERY_KEYS.all` + `toast.success` con número de QE
- [x] 6.4 Crear `shc-controldoc/src/features/quality-events/hooks/useUpdateQualityEvent.ts` con `useMutation`; `onSuccess`: invalidar `QE_QUERY_KEYS.list` y `QE_QUERY_KEYS.detail(id)`
- [x] 6.5 Crear `shc-controldoc/src/features/quality-events/hooks/useTransitionQEStatus.ts` con `useMutation`; `onSuccess`: invalidar list + detail; `onError`: `toast.error(error.response?.data?.message ?? 'Error al cambiar estado')`

## 7. Barrel export

- [x] 7.1 Verificar que `shc-controldoc/src/features/quality-events/index.ts` re-exporta los hooks, el api client y los tipos necesarios para M4-S03

## 8. Test unitario

- [x] 8.1 Crear `shc-controldoc/src/features/quality-events/hooks/useTransitionQEStatus.test.ts` con setup de MSW server usando `setupServer(...qualityEventHandlers)`
- [x] 8.2 Implementar test: renderizar `useTransitionQEStatus` con `renderHook` + `QueryClientProvider`; llamar `mutate({ id: 'qe-2026-001', data: { nuevoEstado: 'EN_EJECUCION' } })`; `await waitFor`; verificar que `toast.error` fue llamado con string que contiene `'RN-QE-002'`
- [x] 8.3 Mockear `sonner` con `vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))` y verificar la llamada
