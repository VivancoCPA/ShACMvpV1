## ADDED Requirements

### Requirement: 8 fixtures de Quality Event con referencias cruzadas reales
El sistema SHALL definir 8 fixtures en `src/mocks/fixtures/quality-events.fixtures.ts` cubriendo los 4 orígenes (`O1_INCIDENTE_CAMPO`, `O2_NC_DETECTADA`, `O3_HALLAZGO_AUDITORIA`, `O4_REPORTE_EXTERNO`), al menos 5 estados distintos, los 4 tipos (`CALIDAD`, `SST`, `ADUANERO`, `OPERACIONAL`) y las 4 severidades (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`).

Los campos de vinculación de origen DEBEN usar IDs reales de fixtures existentes:
- `incidenteId`: `'inc-002'` (CRITICA) y `'inc-001'` (ALTA) de `incidents.fixtures.ts`
- `ncId`: `'nc-002'` (NC-CAL) y `'nc-003'` (NC-SST) de `nonconformities.fixtures.ts`

Los fixtures `qe-2026-001`, `qe-2026-002`, `qe-2026-005` y `qe-2026-006` DEBEN incluir el comentario TODO(M4-S05) sobre la decisión de ownership de ACs.

#### Scenario: Fixture qe-2026-001 — guard RN-QE-002
- **WHEN** se lee el fixture `qe-2026-001`
- **THEN** el campo `causaRaizFirmadaEn` está ausente y `incidenteId` es `'inc-002'`

#### Scenario: Fixture qe-2026-006 — notificación urgente CRITICA
- **WHEN** se lee el fixture `qe-2026-006`
- **THEN** `severidad` es `'CRITICA'`, `estado` es `'ABIERTO'`, `ciclo` es `1` y `ncId` es `'nc-003'`

#### Scenario: Fixture qe-2026-004 — ciclo completo
- **WHEN** se lee el fixture `qe-2026-004`
- **THEN** `resultadoVerificacion` es `'EFECTIVO'`, `estado` es `'VERIFICADO'` y `auditTrail` tiene ≥7 entradas

#### Scenario: Fixture qe-2026-005 — reapertura
- **WHEN** se lee el fixture `qe-2026-005`
- **THEN** `ciclo` es `2`, `estado` es `'REABIERTO'` e `incidenteId` es `'inc-001'`

#### Scenario: Fixture qe-2026-003 — guard RN-QE-004
- **WHEN** se lee el fixture `qe-2026-003`
- **THEN** `cerradoPorId` está presente y `cierreFirmaSupervisorId` está ausente

### Requirement: Handler GET lista con filtros en memoria
El sistema SHALL implementar `GET /api/quality-events` que filtra el array de fixtures en memoria por `estado`, `tipo`, `severidad` y `origen` cuando están presentes en los query params, aplica paginación con `page` y `pageSize`, y retorna `ApiResponse<QualityEvent[]>` con metadatos de paginación. Latencia simulada: 400 ms.

#### Scenario: Lista sin filtros
- **WHEN** `GET /api/quality-events?page=1&pageSize=20`
- **THEN** retorna todos los fixtures (8) en `data`, `pagination.totalItems` es `8` con status 200

#### Scenario: Filtro por estado
- **WHEN** `GET /api/quality-events?estado=ABIERTO&page=1&pageSize=10`
- **THEN** retorna solo los fixtures con `estado === 'ABIERTO'`

#### Scenario: Filtro por severidad CRITICA
- **WHEN** `GET /api/quality-events?severidad=CRITICA&page=1&pageSize=10`
- **THEN** retorna solo los fixtures con `severidad === 'CRITICA'`

### Requirement: Handler GET detalle por ID
El sistema SHALL implementar `GET /api/quality-events/:id` que retorna el fixture correspondiente. Si el ID no existe, retorna 404 con `{ success: false, message: 'Quality Event no encontrado' }`. Latencia: 400 ms.

#### Scenario: ID existente
- **WHEN** `GET /api/quality-events/qe-2026-001`
- **THEN** retorna status 200 con `data` igual al fixture `qe-2026-001`

#### Scenario: ID inexistente
- **WHEN** `GET /api/quality-events/qe-9999-999`
- **THEN** retorna status 404 con `success: false`

### Requirement: Handler POST creación con validación de origen
El sistema SHALL implementar `POST /api/quality-events` que:
- Genera `numero` autonumérico en formato `QE-2026-00N`.
- Establece `estado: 'ABIERTO'` y `ciclo: 1` siempre.
- Valida que el campo de vinculación requerido por `origen` esté presente: O1→`incidenteId`, O2→`ncId`, O3→`hallazgoAuditoriaRef`, O4→`reporteExternoRef`.
- Retorna 422 con `{ success: false, message: '<campo> requerido para origen <origen>' }` si falta el campo.
- Retorna 201 con el nuevo QE si la validación pasa. Latencia: 400 ms.

#### Scenario: Creación válida O1
- **WHEN** `POST /api/quality-events` con `{ origen: 'O1_INCIDENTE_CAMPO', incidenteId: 'inc-002', ... }`
- **THEN** retorna status 201 con `data.estado === 'ABIERTO'` y `data.numero` en formato `QE-2026-00N`

#### Scenario: Creación inválida — campo de vinculación ausente
- **WHEN** `POST /api/quality-events` con `{ origen: 'O2_NC_DETECTADA' }` sin `ncId`
- **THEN** retorna status 422 con `success: false`

### Requirement: Handler PATCH status con guards RN-QE-002 y RN-QE-004
El sistema SHALL implementar `PATCH /api/quality-events/:id/status` que valida:
- Si `nuevoEstado === 'EN_EJECUCION'` y el QE no tiene `causaRaizFirmadaEn` → retorna 422 `{ success: false, message: 'RN-QE-002: causa raíz no firmada' }`.
- Si `nuevoEstado === 'CERRADO'` y el QE no tiene `cierreFirmaSupervisorId` → retorna 422 `{ success: false, message: 'RN-QE-004: se requiere firma dual' }`.
- En caso válido, actualiza el estado del QE en el array en memoria, agrega una entrada en `auditTrail` y retorna el QE actualizado con status 200. Latencia: 400 ms.

#### Scenario: Transición bloqueada por RN-QE-002
- **WHEN** `PATCH /api/quality-events/qe-2026-001/status` con `{ nuevoEstado: 'EN_EJECUCION' }`
- **THEN** retorna status 422 con `message` que contiene `'RN-QE-002'`

#### Scenario: Transición bloqueada por RN-QE-004
- **WHEN** `PATCH /api/quality-events/qe-2026-003/status` con `{ nuevoEstado: 'CERRADO' }`
- **THEN** retorna status 422 con `message` que contiene `'RN-QE-004'`

#### Scenario: Transición válida
- **WHEN** `PATCH /api/quality-events/qe-2026-004/status` con `{ nuevoEstado: 'EN_VERIFICACION' }`
- **THEN** retorna status 200 con `data.estado === 'EN_VERIFICACION'` y un nuevo entry en `data.auditTrail`

### Requirement: Handlers registrados en el índice central
El sistema SHALL agregar `...qualityEventHandlers` al array exportado de `src/mocks/handlers/index.ts`.

#### Scenario: Integración en Service Worker
- **WHEN** MSW inicializa con `VITE_ENABLE_MSW=true`
- **THEN** los 5 endpoints de Quality Event están interceptados sin necesidad de modificar `browser.ts`
