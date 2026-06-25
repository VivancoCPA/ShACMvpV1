## 1. TypeScript Types

- [x] 1.1 Create `src/types/documents.types.ts` with `DocStatus`, `DocType`, `DocRole` string literal unions
- [x] 1.2 Add `VersionEntry` interface to `documents.types.ts`
- [x] 1.3 Add document-scoped `AuditTrailEntry` interface (with `entidadTipo: 'Documento'` literal) to `documents.types.ts`
- [x] 1.4 Add `Documento` interface with all required and optional fields to `documents.types.ts`
- [x] 1.5 Add `DocFilters` interface to `documents.types.ts`
- [x] 1.6 Write `src/types/documents.types.test.ts` with compile-time type assertion tests (valid/invalid shapes using `satisfies`)

## 2. Zod Schemas

- [x] 2.1 Create `src/features/documents/schemas/createDocument.schema.ts` with `createDocumentSchema` and `CreateDocumentInput` type
- [x] 2.2 Create `src/features/documents/schemas/updateDocument.schema.ts` with `updateDocumentSchema` (all fields optional) and `UpdateDocumentInput` type
- [x] 2.3 Create `src/features/documents/schemas/changeDocumentStatus.schema.ts` with `changeDocumentStatusSchema` and `ChangeDocumentStatusInput` type
- [x] 2.4 Write `createDocument.schema.test.ts` covering valid payload, titulo min/max violations, invalid tipo, invalid revisorId UUID, missing optional descripcion
- [x] 2.5 Write `updateDocument.schema.test.ts` covering partial update, empty object, invalid revisorId UUID
- [x] 2.6 Write `changeDocumentStatus.schema.test.ts` covering valid transition, invalid status value, optional comentario

## 3. Constants

- [x] 3.1 Create `src/features/documents/constants.ts` with `QUERY_KEYS.documents` factory (`all`, `list(filters)`, `detail(id)`) typed `as const`
- [x] 3.2 Add `DOC_STATUS_COLORS` map in `constants.ts` covering all six `DocStatus` values with design-system color tokens
- [x] 3.3 Add `DOC_STATUS_TRANSITIONS` map (`Record<DocStatus, DocStatus[]>`) reflecting the full M1 state machine in `constants.ts`
- [x] 3.4 Write `constants.test.ts` verifying: `QUERY_KEYS` key shapes, all statuses have a color, `OBSOLETO` has empty transitions array, all `DocStatus` keys are present in the transitions map

## 4. Permissions Helper

- [x] 4.1 Create `src/features/documents/permissions.ts` with `DocumentPermissions` interface and `getDocumentPermissions(estado, rol)` pure function signature
- [x] 4.2 Implement BORRADOR × all 5 roles in `getDocumentPermissions`
- [x] 4.3 Implement EN_REVISION × all 5 roles in `getDocumentPermissions`
- [x] 4.4 Implement EN_APROBACION × all 5 roles in `getDocumentPermissions`
- [x] 4.5 Implement PUBLICADO × all 5 roles in `getDocumentPermissions`
- [x] 4.6 Implement OBSOLETO × all 5 roles (all write flags false, enforcing RN-DOC-003) in `getDocumentPermissions`
- [x] 4.7 Implement EN_REVISION_PERIODICA × all 5 roles with context-aware isAssignedAuthor and canCancelReview for JEFE_CALIDAD
- [x] 4.8 Write `permissions.test.ts` with a parameterized test table covering all 31 state×role combinations (including AUTOR isAssignedAuthor context), asserting all 9 flags explicitly
