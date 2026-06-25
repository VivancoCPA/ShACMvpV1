## 1. Extend NoConformidad Types (nonconformity-types delta)

- [x] 1.1 Add `NCDominio` union type (`'CALIDAD' | 'SST' | 'ADUANERO' | 'OPERACIONAL'`) to `src/features/nonconformities/types/nonconformity.types.ts`
- [x] 1.2 Add `ACStatus` union type (`'PENDIENTE' | 'EN_EJECUCION' | 'COMPLETADA' | 'VENCIDA'`) to `nonconformity.types.ts`
- [x] 1.3 Add `AccionCorrectiva` interface (required: `id`, `ncId`, `descripcion`, `responsableId`, `plazoFecha`, `estado`, `creadoEn`, `actualizadoEn`; optional: `descripcionEvidencia`, `evidenciaUrl`, `fechaCierre`) to `nonconformity.types.ts`
- [x] 1.4 Add `NCNotificacionComercioExterior` interface (`fecha`, `referencia`, `descripcion`) to `nonconformity.types.ts`
- [x] 1.5 Add `CreateACInput`, `UpdateACInput`, and `CerrarACInput` types to `nonconformity.types.ts`
- [x] 1.6 Update `NoConformidad` interface: add required `dominio: NCDominio` and `accionesCorrectivas: AccionCorrectiva[]`; add optional `requiereIPER?: boolean` and `notificacionComercioExterior?: NCNotificacionComercioExterior`; update `numero` format doc comment to `NC-[DOMINIO_ABBR]-YYYY-NNN`
- [x] 1.7 Update `NCFilters` interface: add `dominio?: NCDominio`, `fechaDesde?: string`, `fechaHasta?: string` optional fields

## 2. API Client (nc-api-client)

- [x] 2.1 Create `src/features/nonconformities/api/nonconformities.api.ts` importing the shared `api` instance from `src/lib/axios.ts`
- [x] 2.2 Implement `getNonconformities(filters?: NCFilters)` calling `GET /api/nonconformities` with filters as query params
- [x] 2.3 Implement `getNonconformity(id: string)` calling `GET /api/nonconformities/:id`
- [x] 2.4 Implement `createNonconformity(data: CreateNCInput)` calling `POST /api/nonconformities`; return type includes optional `warning` and `ncsSimilares`
- [x] 2.5 Implement `updateNonconformity(id: string, data: UpdateNCInput)` calling `PATCH /api/nonconformities/:id`
- [x] 2.6 Implement `anularNonconformity(id: string, justificacion: string)` calling `POST /api/nonconformities/:id/anular`
- [x] 2.7 Implement `createAccionCorrectiva(ncId: string, data: CreateACInput)` calling `POST /api/nonconformities/:ncId/acciones-correctivas`
- [x] 2.8 Implement `updateAccionCorrectiva(ncId: string, acId: string, data: UpdateACInput)` calling `PATCH /api/nonconformities/:ncId/acciones-correctivas/:acId`
- [x] 2.9 Implement `cerrarAccionCorrectiva(ncId: string, acId: string, data: CerrarACInput)` calling `POST /api/nonconformities/:ncId/acciones-correctivas/:acId/cerrar`

## 3. MSW Fixtures (nc-msw-fixtures)

- [x] 3.1 Create `src/mocks/fixtures/nonconformities.fixtures.ts` with `nonconformityFixtures: NoConformidad[]`
- [x] 3.2 Add 2 NC-CAL fixtures: one in `DETECTADA` (MENOR), one in `EN_INVESTIGACION` (MAYOR) — each with 1–2 ACs
- [x] 3.3 Add 2 NC-SST fixtures: one in `EN_CORRECCION` with `requiereIPER: true` (CRITICA), one in `CERRADA` (MAYOR) — each with 1–3 ACs including a COMPLETADA AC
- [x] 3.4 Add 2 NC-ADU fixtures: one in `PENDIENTE_CIERRE` with `notificacionComercioExterior` populated (MAYOR), one in `REABIERTA` (CRITICA) — each with 1–2 ACs
- [x] 3.5 Add 2 NC-OPE fixtures: one in `DETECTADA` (MENOR), one in `EN_INVESTIGACION` (MAYOR) — each with 1–2 ACs
- [x] 3.6 Ensure at least one fixture has `qeGeneradoId` set (e.g., `'qe-001'`)
- [x] 3.7 Ensure AC variety: at least one AC in PENDIENTE, one in EN_EJECUCION, one in COMPLETADA across all fixtures
- [x] 3.8 Re-export `nonconformityFixtures` from `src/mocks/fixtures/index.ts`

## 4. MSW Handlers (nc-msw-handlers)

- [x] 4.1 Create `src/mocks/handlers/nonconformities.handlers.ts` with `const LATENCY = 400` and `let nonconformities = [...nonconformityFixtures]` in-memory store
- [x] 4.2 Implement `GET /api/nonconformities` handler: apply all NCFilters in memory (estado, tipo, severidad, dominio, areaAfectada, search, fechaDesde, fechaHasta), paginate, return `ApiResponse<NoConformidad[]>` with pagination
- [x] 4.3 Implement `GET /api/nonconformities/:id` handler: return NC with ACs or 404
- [x] 4.4 Implement `POST /api/nonconformities` handler: validate required fields (400), generate id and numero, initialize DETECTADA state, check 30-day duplicate (warn in 201), append audit trail entry `'CREADA'`
- [x] 4.5 Implement `PATCH /api/nonconformities/:id` handler: 404 if not found, 409 if CERRADA or ANULADA, apply UpdateNCInput fields, append audit trail entry `'CAMPO_EDITADO'` per changed field, return 200
- [x] 4.6 Implement `POST /api/nonconformities/:id/anular` handler: 404 if not found, 400 if justificacion empty, set estado `'ANULADA'`, append audit trail entry `'ANULADA'`, return 200
- [x] 4.7 Implement `POST /api/nonconformities/:ncId/acciones-correctivas` handler: 404 if NC not found, 400 if required AC fields missing, create AC with `estado: 'PENDIENTE'`, append to nc.accionesCorrectivas, audit trail `'AC_CREADA'`, return 201
- [x] 4.8 Implement `PATCH /api/nonconformities/:ncId/acciones-correctivas/:acId` handler: 404 if NC or AC not found, apply UpdateACInput, audit trail `'AC_ACTUALIZADA'`, return 200
- [x] 4.9 Implement `POST /api/nonconformities/:ncId/acciones-correctivas/:acId/cerrar` handler: 404 if NC or AC not found, 400 if descripcionEvidencia empty, set AC `estado: 'COMPLETADA'` and `fechaCierre`, audit trail `'AC_CERRADA'`, return 200
- [x] 4.10 Wire `nonconformityHandlers` export into `src/mocks/handlers/index.ts`

## 5. TanStack Query Hooks (nc-query-hooks)

- [x] 5.1 Create `src/features/nonconformities/hooks/useNonconformities.ts` with `QUERY_KEYS.nonconformities` key factory (`all`, `list`, `detail`)
- [x] 5.2 Implement `useNonconformities(filters?: NCFilters)` using `useQuery` with `staleTime: 5 * 60 * 1000`
- [x] 5.3 Implement `useNonconformity(id: string)` using `useQuery` with `enabled: !!id`
- [x] 5.4 Implement `useCreateNonconformity()`: invalidate `nonconformities.all`, toast success, toast warning if `POSIBLE_DUPLICADO`, toast error
- [x] 5.5 Implement `useUpdateNonconformity()`: invalidate `nonconformities.all`, toast success, toast error
- [x] 5.6 Implement `useAnularNonconformity()`: variables `{ id, justificacion }`, invalidate `nonconformities.all`, toast success, toast error
- [x] 5.7 Implement `useCreateAccionCorrectiva(ncId: string)`: invalidate `nonconformities.detail(ncId)`, toast success, toast error
- [x] 5.8 Implement `useUpdateAccionCorrectiva(ncId: string)`: variables `{ acId, data }`, invalidate `nonconformities.detail(ncId)`, toast success, toast error
- [x] 5.9 Implement `useCerrarAccionCorrectiva(ncId: string)`: variables `{ acId, data }`, invalidate `nonconformities.detail(ncId)`, toast success, toast error

## 6. i18n Keys

- [x] 6.1 Add `nonconformities.toasts` keys to `src/i18n/es-PE.json`: `created`, `posibleDuplicado`, `createError`, `updated`, `updateError`, `anulada`, `anularError`, `acCreada`, `acCreateError`, `acUpdated`, `acUpdateError`, `acCerrada`, `acCerrarError`
- [x] 6.2 Add `nonconformities.toasts` keys to `src/i18n/en-US.json` with English placeholder values
- [x] 6.3 Add `nonconformities.errors` keys to both i18n files: `notFound`, `editBlockedByStatus`
