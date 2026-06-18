import { describe, it, expectTypeOf } from 'vitest'
import type {
  DocStatus,
  DocType,
  DocRole,
  DocumentPermissions,
  VersionEntry,
  AuditTrailEntry,
  Documento,
  DocFilters,
} from './documents.types'

describe('DocStatus', () => {
  it('covers all six M1 lifecycle states', () => {
    expectTypeOf<DocStatus>().toEqualTypeOf<
      | 'BORRADOR'
      | 'EN_REVISION'
      | 'EN_APROBACION'
      | 'PUBLICADO'
      | 'OBSOLETO'
      | 'EN_REVISION_PERIODICA'
    >()
  })
})

describe('DocType', () => {
  it('covers all seven document type abbreviations', () => {
    expectTypeOf<DocType>().toEqualTypeOf<
      'POL' | 'PRC' | 'INS' | 'REG' | 'INF' | 'MAT' | 'PLAN'
    >()
  })
})

describe('DocRole', () => {
  it('covers all five M1 actor roles', () => {
    expectTypeOf<DocRole>().toEqualTypeOf<
      'AUTOR' | 'REVISOR' | 'APROBADOR' | 'JEFE_CALIDAD' | 'OPERARIO'
    >()
  })
})

describe('DocumentPermissions', () => {
  it('has all nine required boolean flags', () => {
    expectTypeOf<DocumentPermissions>().toHaveProperty('canRead').toBeBoolean()
    expectTypeOf<DocumentPermissions>().toHaveProperty('canEdit').toBeBoolean()
    expectTypeOf<DocumentPermissions>().toHaveProperty('canDelete').toBeBoolean()
    expectTypeOf<DocumentPermissions>().toHaveProperty('canComment').toBeBoolean()
    expectTypeOf<DocumentPermissions>().toHaveProperty('canApprove').toBeBoolean()
    expectTypeOf<DocumentPermissions>().toHaveProperty('canReject').toBeBoolean()
    expectTypeOf<DocumentPermissions>().toHaveProperty('canSign').toBeBoolean()
    expectTypeOf<DocumentPermissions>().toHaveProperty('canStartReview').toBeBoolean()
    expectTypeOf<DocumentPermissions>().toHaveProperty('canCancelReview').toBeBoolean()
  })
})

describe('VersionEntry', () => {
  it('has required fields and optional hashArchivo', () => {
    expectTypeOf<VersionEntry>().toHaveProperty('version').toBeString()
    expectTypeOf<VersionEntry>().toHaveProperty('fechaPublicacion').toBeString()
    expectTypeOf<VersionEntry>().toHaveProperty('autorId').toBeString()
    expectTypeOf<VersionEntry>().toHaveProperty('descripcionCambios').toBeString()
    expectTypeOf<VersionEntry>().toHaveProperty('hashArchivo').toEqualTypeOf<string | undefined>()
  })
})

describe('AuditTrailEntry', () => {
  it('narrows entidadTipo to the literal Documento', () => {
    expectTypeOf<AuditTrailEntry['entidadTipo']>().toEqualTypeOf<'Documento'>()
  })

  it('has required and optional fields', () => {
    expectTypeOf<AuditTrailEntry>().toHaveProperty('id').toBeString()
    expectTypeOf<AuditTrailEntry>().toHaveProperty('generadoPorIA').toBeBoolean()
    expectTypeOf<AuditTrailEntry>().toHaveProperty('estadoAnterior').toEqualTypeOf<string | undefined>()
  })
})

describe('Documento', () => {
  it('has all required fields', () => {
    expectTypeOf<Documento>().toHaveProperty('id').toBeString()
    expectTypeOf<Documento>().toHaveProperty('codigo').toBeString()
    expectTypeOf<Documento>().toHaveProperty('titulo').toBeString()
    expectTypeOf<Documento>().toHaveProperty('tipo').toEqualTypeOf<DocType>()
    expectTypeOf<Documento>().toHaveProperty('estado').toEqualTypeOf<DocStatus>()
    expectTypeOf<Documento>().toHaveProperty('qeVinculados').toEqualTypeOf<string[]>()
    expectTypeOf<Documento>().toHaveProperty('historialVersiones').toEqualTypeOf<VersionEntry[]>()
    expectTypeOf<Documento>().toHaveProperty('auditTrail').toEqualTypeOf<AuditTrailEntry[]>()
  })

  it('has optional fields typed correctly', () => {
    expectTypeOf<Documento>().toHaveProperty('revisorId').toEqualTypeOf<string | undefined>()
    expectTypeOf<Documento>().toHaveProperty('aprobadorId').toEqualTypeOf<string | undefined>()
    expectTypeOf<Documento>().toHaveProperty('hashArchivo').toEqualTypeOf<string | undefined>()
  })
})

describe('DocFilters', () => {
  it('has all optional filter fields', () => {
    expectTypeOf<DocFilters>().toHaveProperty('estado').toEqualTypeOf<DocStatus | undefined>()
    expectTypeOf<DocFilters>().toHaveProperty('tipo').toEqualTypeOf<DocType | undefined>()
    expectTypeOf<DocFilters>().toHaveProperty('page').toEqualTypeOf<number | undefined>()
    expectTypeOf<DocFilters>().toHaveProperty('pageSize').toEqualTypeOf<number | undefined>()
  })
})
