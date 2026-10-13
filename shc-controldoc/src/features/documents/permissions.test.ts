import { describe, it, expect } from 'vitest'
import { canManagePeriodicReview, getDocumentPermissions, resolveDocRoleForUser } from './permissions'
import type { DocumentPermissions, Documento } from '../../types/documents.types'
import type { UserRole } from '../../types/auth.types'

function doc(overrides: Partial<Pick<Documento, 'autorId' | 'revisorId' | 'aprobadorId'>> = {}) {
  return { autorId: 'autor-1', revisorId: 'revisor-1', aprobadorId: 'aprobador-1', ...overrides }
}

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

describe('resolveDocRoleForUser — precedencia AUTOR → REVISOR → APROBADOR → JEFE_CALIDAD → OPERARIO', () => {
  // nueva-version-autor-permisos: misma precedencia que DocumentPermissionResolver.ResolveDocRole
  // (backend real) — single source of truth compartida con DocumentDetailPage/DocumentActionPanel.
  it('AUTOR gana sobre cualquier otro rol', () => {
    const d = doc({ autorId: 'u1' })
    expect(resolveDocRoleForUser(d, { id: 'u1', rol: 'OPERARIO' })).toBe('AUTOR')
  })

  it('REVISOR cuando no es autor', () => {
    const d = doc({ revisorId: 'u1' })
    expect(resolveDocRoleForUser(d, { id: 'u1', rol: 'SUPERVISOR' })).toBe('REVISOR')
  })

  it('APROBADOR cuando no es autor ni revisor', () => {
    const d = doc({ aprobadorId: 'u1' })
    expect(resolveDocRoleForUser(d, { id: 'u1', rol: 'ALTA_DIRECCION' })).toBe('APROBADOR')
  })

  it('JEFE_CALIDAD (rol global JEFE_CALIDAD_SYST/JEFE_CONTROL_DOCUMENTARIO) solo si no es autor/revisor/aprobador de este documento', () => {
    const d = doc()
    expect(resolveDocRoleForUser(d, { id: 'otro', rol: 'JEFE_CALIDAD_SYST' })).toBe('JEFE_CALIDAD')
    expect(resolveDocRoleForUser(d, { id: 'otro', rol: 'JEFE_CONTROL_DOCUMENTARIO' })).toBe('JEFE_CALIDAD')
  })

  it('un JCA/JCD que es revisor o aprobador de ESTE documento resuelve a REVISOR/APROBADOR, no a JEFE_CALIDAD', () => {
    expect(resolveDocRoleForUser(doc({ revisorId: 'u1' }), { id: 'u1', rol: 'JEFE_CALIDAD_SYST' })).toBe('REVISOR')
    expect(resolveDocRoleForUser(doc({ aprobadorId: 'u1' }), { id: 'u1', rol: 'JEFE_CONTROL_DOCUMENTARIO' })).toBe('APROBADOR')
  })

  it('OPERARIO cuando no tiene ninguna relación con el documento', () => {
    const d = doc()
    expect(resolveDocRoleForUser(d, { id: 'otro', rol: 'OPERARIO' })).toBe('OPERARIO')
  })

  it('OPERARIO cuando no hay usuario autenticado', () => {
    expect(resolveDocRoleForUser(doc(), null)).toBe('OPERARIO')
    expect(resolveDocRoleForUser(doc(), undefined)).toBe('OPERARIO')
  })
})

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
  // autor-lectura-publicado (2026-10-08, decisión de Toño): AUTOR lee su documento publicado
  // igual que REVISOR/APROBADOR — diverge a propósito del PRD §4.2 ("Sin acceso" se interpreta
  // como "sin edición", no "sin lectura"). canEdit/canDelete/canStartReview siguen en false.
  it('AUTOR: canRead, canViewArchivoDistribucion (sin edición)', () => {
    expect(getDocumentPermissions('PUBLICADO', 'AUTOR')).toEqual(
      deny({ canRead: true, canViewArchivoDistribucion: true }),
    )
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
  // autor-lectura-publicado: mismo razonamiento que PUBLICADO — AUTOR lee, no edita.
  it('AUTOR: canRead only (sin edición — RN-DOC-003)', () => {
    expect(getDocumentPermissions('OBSOLETO', 'AUTOR')).toEqual(deny({ canRead: true }))
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

  // autor-lectura-publicado: AUTOR ahora tiene canRead en PUBLICADO, así que hereda
  // canViewArchivoDistribucion igual que REVISOR/APROBADOR/OPERARIO/JEFE_CALIDAD.
  it('canViewArchivoDistribucion is true for AUTOR in PUBLICADO (now has read access)', () => {
    expect(getDocumentPermissions('PUBLICADO', 'AUTOR').canViewArchivoDistribucion).toBe(true)
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

// revision-periodica-permiso-por-rol (D1): canManagePeriodicReview es por rol GLOBAL, sin
// relación con docRole/getDocumentPermissions — gatea iniciar/confirmar/cancelar revisión
// periódica aunque el actor sea autor/revisor/aprobador del documento.
describe('canManagePeriodicReview — rol global, independiente del docRole', () => {
  it('JEFE_CALIDAD_SYST puede gestionar la revisión periódica', () => {
    expect(canManagePeriodicReview('JEFE_CALIDAD_SYST')).toBe(true)
  })

  it('JEFE_CONTROL_DOCUMENTARIO puede gestionar la revisión periódica', () => {
    expect(canManagePeriodicReview('JEFE_CONTROL_DOCUMENTARIO')).toBe(true)
  })

  it('ningún otro rol puede gestionar la revisión periódica', () => {
    const otrosRoles: UserRole[] = [
      'OPERARIO',
      'SUPERVISOR',
      'AUDITOR_INTERNO',
      'ALTA_DIRECCION',
      'ADMINISTRADOR_SISTEMA',
      'ADMINISTRADOR_EMPRESA',
      'SUPERADMIN',
    ]
    for (const rol of otrosRoles) {
      expect(canManagePeriodicReview(rol), rol).toBe(false)
    }
  })
})
