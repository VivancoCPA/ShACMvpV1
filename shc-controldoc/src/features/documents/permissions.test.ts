import { describe, it, expect } from 'vitest'
import { getDocumentPermissions } from './permissions'
import type { DocumentPermissions } from '../../types/documents.types'

function deny(overrides: Partial<DocumentPermissions> = {}): DocumentPermissions {
  return {
    canRead: false,
    canEdit: false,
    canDelete: false,
    canComment: false,
    canApprove: false,
    canReject: false,
    canSign: false,
    canStartReview: false,
    canCancelReview: false,
    ...overrides,
  }
}

describe('getDocumentPermissions — BORRADOR', () => {
  it('AUTOR: canRead, canEdit, canDelete', () => {
    expect(getDocumentPermissions('BORRADOR', 'AUTOR')).toEqual(
      deny({ canRead: true, canEdit: true, canDelete: true }),
    )
  })

  it('REVISOR: canRead only', () => {
    expect(getDocumentPermissions('BORRADOR', 'REVISOR')).toEqual(deny({ canRead: true }))
  })

  it('APROBADOR: canRead only', () => {
    expect(getDocumentPermissions('BORRADOR', 'APROBADOR')).toEqual(deny({ canRead: true }))
  })

  it('JEFE_CALIDAD: canRead, canEdit, canComment, canDelete', () => {
    expect(getDocumentPermissions('BORRADOR', 'JEFE_CALIDAD')).toEqual(
      deny({ canRead: true, canEdit: true, canComment: true, canDelete: true }),
    )
  })

  it('OPERARIO: all denied', () => {
    expect(getDocumentPermissions('BORRADOR', 'OPERARIO')).toEqual(deny())
  })
})

describe('getDocumentPermissions — EN_REVISION', () => {
  it('AUTOR: canRead only', () => {
    expect(getDocumentPermissions('EN_REVISION', 'AUTOR')).toEqual(deny({ canRead: true }))
  })

  it('REVISOR: canRead, canComment, canApprove, canReject', () => {
    expect(getDocumentPermissions('EN_REVISION', 'REVISOR')).toEqual(
      deny({ canRead: true, canComment: true, canApprove: true, canReject: true }),
    )
  })

  it('APROBADOR: canRead only', () => {
    expect(getDocumentPermissions('EN_REVISION', 'APROBADOR')).toEqual(deny({ canRead: true }))
  })

  it('JEFE_CALIDAD: canRead, canEdit, canComment, canDelete', () => {
    expect(getDocumentPermissions('EN_REVISION', 'JEFE_CALIDAD')).toEqual(
      deny({ canRead: true, canEdit: true, canComment: true, canDelete: true }),
    )
  })

  it('OPERARIO: all denied', () => {
    expect(getDocumentPermissions('EN_REVISION', 'OPERARIO')).toEqual(deny())
  })
})

describe('getDocumentPermissions — EN_APROBACION', () => {
  it('AUTOR: canRead only', () => {
    expect(getDocumentPermissions('EN_APROBACION', 'AUTOR')).toEqual(deny({ canRead: true }))
  })

  it('REVISOR: canRead only', () => {
    expect(getDocumentPermissions('EN_APROBACION', 'REVISOR')).toEqual(deny({ canRead: true }))
  })

  it('APROBADOR: canRead, canSign, canReject', () => {
    expect(getDocumentPermissions('EN_APROBACION', 'APROBADOR')).toEqual(
      deny({ canRead: true, canSign: true, canReject: true }),
    )
  })

  it('JEFE_CALIDAD: canRead only', () => {
    expect(getDocumentPermissions('EN_APROBACION', 'JEFE_CALIDAD')).toEqual(deny({ canRead: true }))
  })

  it('OPERARIO: all denied', () => {
    expect(getDocumentPermissions('EN_APROBACION', 'OPERARIO')).toEqual(deny())
  })
})

describe('getDocumentPermissions — JEFE_CALIDAD canDelete scope', () => {
  it('canDelete is false in EN_APROBACION', () => {
    expect(getDocumentPermissions('EN_APROBACION', 'JEFE_CALIDAD').canDelete).toBe(false)
  })

  it('canDelete is false in PUBLICADO', () => {
    expect(getDocumentPermissions('PUBLICADO', 'JEFE_CALIDAD').canDelete).toBe(false)
  })

  it('canDelete is false in OBSOLETO', () => {
    expect(getDocumentPermissions('OBSOLETO', 'JEFE_CALIDAD').canDelete).toBe(false)
  })

  it('canDelete is false in EN_REVISION_PERIODICA', () => {
    expect(getDocumentPermissions('EN_REVISION_PERIODICA', 'JEFE_CALIDAD').canDelete).toBe(false)
  })
})

describe('getDocumentPermissions — PUBLICADO', () => {
  it('AUTOR: all denied', () => {
    expect(getDocumentPermissions('PUBLICADO', 'AUTOR')).toEqual(deny())
  })

  it('REVISOR: canRead only', () => {
    expect(getDocumentPermissions('PUBLICADO', 'REVISOR')).toEqual(deny({ canRead: true }))
  })

  it('APROBADOR: canRead only', () => {
    expect(getDocumentPermissions('PUBLICADO', 'APROBADOR')).toEqual(deny({ canRead: true }))
  })

  it('JEFE_CALIDAD: canRead, canStartReview', () => {
    expect(getDocumentPermissions('PUBLICADO', 'JEFE_CALIDAD')).toEqual(
      deny({ canRead: true, canStartReview: true }),
    )
  })

  it('OPERARIO: canRead only', () => {
    expect(getDocumentPermissions('PUBLICADO', 'OPERARIO')).toEqual(deny({ canRead: true }))
  })
})

describe('getDocumentPermissions — OBSOLETO (RN-DOC-003)', () => {
  it('AUTOR: all denied (no read access)', () => {
    expect(getDocumentPermissions('OBSOLETO', 'AUTOR')).toEqual(deny())
  })

  it('REVISOR: canRead only', () => {
    expect(getDocumentPermissions('OBSOLETO', 'REVISOR')).toEqual(deny({ canRead: true }))
  })

  it('APROBADOR: canRead only', () => {
    expect(getDocumentPermissions('OBSOLETO', 'APROBADOR')).toEqual(deny({ canRead: true }))
  })

  it('JEFE_CALIDAD: canRead only (no write of any kind)', () => {
    const perms = getDocumentPermissions('OBSOLETO', 'JEFE_CALIDAD')
    expect(perms.canRead).toBe(true)
    expect(perms.canEdit).toBe(false)
    expect(perms.canDelete).toBe(false)
    expect(perms.canComment).toBe(false)
    expect(perms.canApprove).toBe(false)
    expect(perms.canReject).toBe(false)
    expect(perms.canSign).toBe(false)
    expect(perms.canStartReview).toBe(false)
    expect(perms.canCancelReview).toBe(false)
  })

  it('OPERARIO: all denied (no read access)', () => {
    expect(getDocumentPermissions('OBSOLETO', 'OPERARIO')).toEqual(deny())
  })
})

describe('getDocumentPermissions — EN_REVISION_PERIODICA', () => {
  it('AUTOR (isAssignedAuthor: true): canRead, canEdit, canComment', () => {
    expect(
      getDocumentPermissions('EN_REVISION_PERIODICA', 'AUTOR', { isAssignedAuthor: true }),
    ).toEqual(deny({ canRead: true, canEdit: true, canComment: true }))
  })

  it('AUTOR (isAssignedAuthor: false): canRead only', () => {
    expect(
      getDocumentPermissions('EN_REVISION_PERIODICA', 'AUTOR', { isAssignedAuthor: false }),
    ).toEqual(deny({ canRead: true }))
  })

  it('AUTOR (no context): defaults to isAssignedAuthor false → canRead only', () => {
    expect(getDocumentPermissions('EN_REVISION_PERIODICA', 'AUTOR')).toEqual(deny({ canRead: true }))
  })

  it('REVISOR: canRead, canComment', () => {
    expect(getDocumentPermissions('EN_REVISION_PERIODICA', 'REVISOR')).toEqual(
      deny({ canRead: true, canComment: true }),
    )
  })

  it('REVISOR: canApprove and canReject are false', () => {
    const perms = getDocumentPermissions('EN_REVISION_PERIODICA', 'REVISOR')
    expect(perms.canApprove).toBe(false)
    expect(perms.canReject).toBe(false)
  })

  it('APROBADOR: canRead only', () => {
    expect(getDocumentPermissions('EN_REVISION_PERIODICA', 'APROBADOR')).toEqual(
      deny({ canRead: true }),
    )
  })

  it('JEFE_CALIDAD: canRead, canEdit, canComment, canCancelReview', () => {
    expect(getDocumentPermissions('EN_REVISION_PERIODICA', 'JEFE_CALIDAD')).toEqual(
      deny({ canRead: true, canEdit: true, canComment: true, canCancelReview: true }),
    )
  })

  it('JEFE_CALIDAD: canStartReview is false (periodic review already in progress)', () => {
    expect(getDocumentPermissions('EN_REVISION_PERIODICA', 'JEFE_CALIDAD').canStartReview).toBe(false)
  })

  it('OPERARIO: canRead only', () => {
    expect(getDocumentPermissions('EN_REVISION_PERIODICA', 'OPERARIO')).toEqual(deny({ canRead: true }))
  })

  it('canCancelReview is false for all roles except JEFE_CALIDAD', () => {
    const nonJefe = ['AUTOR', 'REVISOR', 'APROBADOR', 'OPERARIO'] as const
    for (const rol of nonJefe) {
      expect(
        getDocumentPermissions('EN_REVISION_PERIODICA', rol).canCancelReview,
        `expected canCancelReview=false for ${rol}`,
      ).toBe(false)
    }
  })
})
