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
    canViewArchivoOriginal: false,
    canReplaceArchivoOriginal: false,
    canViewArchivoDistribucion: false,
    ...overrides,
  }
}

describe('getDocumentPermissions — BORRADOR', () => {
  it('AUTOR: canRead, canEdit, canDelete, canViewArchivoOriginal, canReplaceArchivoOriginal', () => {
    expect(getDocumentPermissions('BORRADOR', 'AUTOR')).toEqual(
      deny({ canRead: true, canEdit: true, canDelete: true, canViewArchivoOriginal: true, canReplaceArchivoOriginal: true }),
    )
  })

  it('REVISOR: canRead, canViewArchivoOriginal (no canReplaceArchivoOriginal — RN-DOC-013/018)', () => {
    expect(getDocumentPermissions('BORRADOR', 'REVISOR')).toEqual(
      deny({ canRead: true, canViewArchivoOriginal: true }),
    )
  })

  it('APROBADOR: canRead, canViewArchivoOriginal (no canReplaceArchivoOriginal — RN-DOC-013/018)', () => {
    expect(getDocumentPermissions('BORRADOR', 'APROBADOR')).toEqual(
      deny({ canRead: true, canViewArchivoOriginal: true }),
    )
  })

  it('JEFE_CALIDAD: canRead, canEdit, canComment, canDelete, canViewArchivoOriginal, canReplaceArchivoOriginal', () => {
    expect(getDocumentPermissions('BORRADOR', 'JEFE_CALIDAD')).toEqual(
      deny({ canRead: true, canEdit: true, canComment: true, canDelete: true, canViewArchivoOriginal: true, canReplaceArchivoOriginal: true }),
    )
  })

  it('OPERARIO: all denied', () => {
    expect(getDocumentPermissions('BORRADOR', 'OPERARIO')).toEqual(deny())
  })
})

describe('getDocumentPermissions — EN_REVISION', () => {
  it('AUTOR: canRead, canViewArchivoOriginal, canReplaceArchivoOriginal', () => {
    expect(getDocumentPermissions('EN_REVISION', 'AUTOR')).toEqual(
      deny({ canRead: true, canViewArchivoOriginal: true, canReplaceArchivoOriginal: true }),
    )
  })

  it('REVISOR: canRead, canComment, canApprove, canReject, canViewArchivoOriginal (no canReplaceArchivoOriginal — RN-DOC-013/018)', () => {
    expect(getDocumentPermissions('EN_REVISION', 'REVISOR')).toEqual(
      deny({ canRead: true, canComment: true, canApprove: true, canReject: true, canViewArchivoOriginal: true }),
    )
  })

  it('APROBADOR: canRead, canViewArchivoOriginal (no canReplaceArchivoOriginal — RN-DOC-013/018)', () => {
    expect(getDocumentPermissions('EN_REVISION', 'APROBADOR')).toEqual(
      deny({ canRead: true, canViewArchivoOriginal: true }),
    )
  })

  it('JEFE_CALIDAD: canRead, canEdit, canComment, canDelete, canViewArchivoOriginal, canReplaceArchivoOriginal', () => {
    expect(getDocumentPermissions('EN_REVISION', 'JEFE_CALIDAD')).toEqual(
      deny({ canRead: true, canEdit: true, canComment: true, canDelete: true, canViewArchivoOriginal: true, canReplaceArchivoOriginal: true }),
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

  it('REVISOR: canRead, canViewArchivoDistribucion', () => {
    expect(getDocumentPermissions('PUBLICADO', 'REVISOR')).toEqual(
      deny({ canRead: true, canViewArchivoDistribucion: true }),
    )
  })

  it('APROBADOR: canRead, canViewArchivoDistribucion', () => {
    expect(getDocumentPermissions('PUBLICADO', 'APROBADOR')).toEqual(
      deny({ canRead: true, canViewArchivoDistribucion: true }),
    )
  })

  it('JEFE_CALIDAD: canRead, canStartReview, canViewArchivoDistribucion', () => {
    expect(getDocumentPermissions('PUBLICADO', 'JEFE_CALIDAD')).toEqual(
      deny({ canRead: true, canStartReview: true, canViewArchivoDistribucion: true }),
    )
  })

  it('OPERARIO: canRead, canViewArchivoDistribucion', () => {
    expect(getDocumentPermissions('PUBLICADO', 'OPERARIO')).toEqual(
      deny({ canRead: true, canViewArchivoDistribucion: true }),
    )
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

  it('no archivo permissions in OBSOLETO state', () => {
    for (const rol of ['AUTOR', 'REVISOR', 'APROBADOR', 'JEFE_CALIDAD', 'OPERARIO'] as const) {
      const perms = getDocumentPermissions('OBSOLETO', rol)
      expect(perms.canViewArchivoOriginal, `${rol} canViewArchivoOriginal`).toBe(false)
      expect(perms.canReplaceArchivoOriginal, `${rol} canReplaceArchivoOriginal`).toBe(false)
      expect(perms.canViewArchivoDistribucion, `${rol} canViewArchivoDistribucion`).toBe(false)
    }
  })
})

describe('getDocumentPermissions — EN_REVISION_PERIODICA', () => {
  it('AUTOR (isAssignedAuthor: true): canRead, canEdit, canComment, canViewArchivoDistribucion', () => {
    expect(
      getDocumentPermissions('EN_REVISION_PERIODICA', 'AUTOR', { isAssignedAuthor: true }),
    ).toEqual(deny({ canRead: true, canEdit: true, canComment: true, canViewArchivoDistribucion: true }))
  })

  it('AUTOR (isAssignedAuthor: false): canRead, canViewArchivoDistribucion', () => {
    expect(
      getDocumentPermissions('EN_REVISION_PERIODICA', 'AUTOR', { isAssignedAuthor: false }),
    ).toEqual(deny({ canRead: true, canViewArchivoDistribucion: true }))
  })

  it('AUTOR (no context): defaults to isAssignedAuthor false → canRead, canViewArchivoDistribucion', () => {
    expect(getDocumentPermissions('EN_REVISION_PERIODICA', 'AUTOR')).toEqual(
      deny({ canRead: true, canViewArchivoDistribucion: true }),
    )
  })

  it('REVISOR: canRead, canComment, canViewArchivoDistribucion', () => {
    expect(getDocumentPermissions('EN_REVISION_PERIODICA', 'REVISOR')).toEqual(
      deny({ canRead: true, canComment: true, canViewArchivoDistribucion: true }),
    )
  })

  it('REVISOR: canApprove and canReject are false', () => {
    const perms = getDocumentPermissions('EN_REVISION_PERIODICA', 'REVISOR')
    expect(perms.canApprove).toBe(false)
    expect(perms.canReject).toBe(false)
  })

  it('APROBADOR: canRead, canViewArchivoDistribucion', () => {
    expect(getDocumentPermissions('EN_REVISION_PERIODICA', 'APROBADOR')).toEqual(
      deny({ canRead: true, canViewArchivoDistribucion: true }),
    )
  })

  it('JEFE_CALIDAD: canRead, canEdit, canComment, canCancelReview, canViewArchivoDistribucion', () => {
    expect(getDocumentPermissions('EN_REVISION_PERIODICA', 'JEFE_CALIDAD')).toEqual(
      deny({ canRead: true, canEdit: true, canComment: true, canCancelReview: true, canViewArchivoDistribucion: true }),
    )
  })

  it('JEFE_CALIDAD: canStartReview is false (periodic review already in progress)', () => {
    expect(getDocumentPermissions('EN_REVISION_PERIODICA', 'JEFE_CALIDAD').canStartReview).toBe(false)
  })

  it('OPERARIO: canRead, canViewArchivoDistribucion', () => {
    expect(getDocumentPermissions('EN_REVISION_PERIODICA', 'OPERARIO')).toEqual(
      deny({ canRead: true, canViewArchivoDistribucion: true }),
    )
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

describe('getDocumentPermissions — archivo permissions (ADD-02)', () => {
  it('canViewArchivoOriginal is true for every docRole except OPERARIO in BORRADOR/EN_REVISION (RN-DOC-013, widened in practice to REVISOR/APROBADOR)', () => {
    for (const estado of ['BORRADOR', 'EN_REVISION'] as const) {
      for (const rol of ['AUTOR', 'REVISOR', 'APROBADOR', 'JEFE_CALIDAD'] as const) {
        expect(getDocumentPermissions(estado, rol).canViewArchivoOriginal, `${rol} in ${estado}`).toBe(true)
      }
    }
  })

  it('canViewArchivoOriginal is false for OPERARIO in any state', () => {
    for (const estado of ['BORRADOR', 'EN_REVISION', 'EN_APROBACION', 'PUBLICADO', 'OBSOLETO', 'EN_REVISION_PERIODICA'] as const) {
      expect(getDocumentPermissions(estado, 'OPERARIO').canViewArchivoOriginal, `OPERARIO in ${estado}`).toBe(false)
    }
  })

  it('canViewArchivoOriginal is false outside BORRADOR/EN_REVISION', () => {
    for (const estado of ['EN_APROBACION', 'PUBLICADO', 'OBSOLETO', 'EN_REVISION_PERIODICA'] as const) {
      for (const rol of ['AUTOR', 'REVISOR', 'APROBADOR', 'JEFE_CALIDAD'] as const) {
        expect(getDocumentPermissions(estado, rol).canViewArchivoOriginal, `${rol} in ${estado}`).toBe(false)
      }
    }
  })

  it('canReplaceArchivoOriginal is true only for AUTOR/JEFE_CALIDAD in BORRADOR/EN_REVISION (RN-DOC-018 — narrower than canViewArchivoOriginal)', () => {
    for (const estado of ['BORRADOR', 'EN_REVISION'] as const) {
      expect(getDocumentPermissions(estado, 'AUTOR').canReplaceArchivoOriginal, `AUTOR in ${estado}`).toBe(true)
      expect(getDocumentPermissions(estado, 'JEFE_CALIDAD').canReplaceArchivoOriginal, `JEFE_CALIDAD in ${estado}`).toBe(true)
    }
  })

  it('canReplaceArchivoOriginal is false for REVISOR/APROBADOR even though they can view (RN-DOC-018)', () => {
    for (const estado of ['BORRADOR', 'EN_REVISION'] as const) {
      expect(getDocumentPermissions(estado, 'REVISOR').canReplaceArchivoOriginal, `REVISOR in ${estado}`).toBe(false)
      expect(getDocumentPermissions(estado, 'APROBADOR').canReplaceArchivoOriginal, `APROBADOR in ${estado}`).toBe(false)
    }
  })

  it('canReplaceArchivoOriginal is false when archivoOriginalBloqueado is true', () => {
    expect(getDocumentPermissions('BORRADOR', 'AUTOR', { archivoOriginalBloqueado: true }).canReplaceArchivoOriginal).toBe(false)
    expect(getDocumentPermissions('EN_REVISION', 'JEFE_CALIDAD', { archivoOriginalBloqueado: true }).canReplaceArchivoOriginal).toBe(false)
  })

  it('canReplaceArchivoOriginal is true when not blocked and in editable state', () => {
    expect(getDocumentPermissions('BORRADOR', 'AUTOR', { archivoOriginalBloqueado: false }).canReplaceArchivoOriginal).toBe(true)
    expect(getDocumentPermissions('EN_REVISION', 'JEFE_CALIDAD').canReplaceArchivoOriginal).toBe(true)
  })

  it('canViewArchivoDistribucion is true for readers in PUBLICADO', () => {
    expect(getDocumentPermissions('PUBLICADO', 'REVISOR').canViewArchivoDistribucion).toBe(true)
    expect(getDocumentPermissions('PUBLICADO', 'OPERARIO').canViewArchivoDistribucion).toBe(true)
    expect(getDocumentPermissions('PUBLICADO', 'JEFE_CALIDAD').canViewArchivoDistribucion).toBe(true)
  })

  it('canViewArchivoDistribucion is false for AUTOR in PUBLICADO (no read access)', () => {
    expect(getDocumentPermissions('PUBLICADO', 'AUTOR').canViewArchivoDistribucion).toBe(false)
  })

  it('canViewArchivoDistribucion is true for all readers in EN_REVISION_PERIODICA', () => {
    for (const rol of ['AUTOR', 'REVISOR', 'APROBADOR', 'JEFE_CALIDAD', 'OPERARIO'] as const) {
      expect(getDocumentPermissions('EN_REVISION_PERIODICA', rol).canViewArchivoDistribucion, `${rol}`).toBe(true)
    }
  })

  it('canViewArchivoDistribucion is false in non-distribution states', () => {
    for (const estado of ['BORRADOR', 'EN_REVISION', 'EN_APROBACION', 'OBSOLETO'] as const) {
      expect(getDocumentPermissions(estado, 'JEFE_CALIDAD').canViewArchivoDistribucion, `JEFE_CALIDAD in ${estado}`).toBe(false)
    }
  })
})
