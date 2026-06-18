import { describe, it, expect } from 'vitest'
import { changeDocumentStatusSchema } from './changeDocumentStatus.schema'
import type { DocStatus } from '../../../types/documents.types'

const validStatuses: DocStatus[] = [
  'BORRADOR',
  'EN_REVISION',
  'EN_APROBACION',
  'PUBLICADO',
  'OBSOLETO',
  'EN_REVISION_PERIODICA',
]

describe('changeDocumentStatusSchema', () => {
  it.each(validStatuses)('passes with valid status %s', (nuevoEstado) => {
    const result = changeDocumentStatusSchema.safeParse({ nuevoEstado })
    expect(result.success).toBe(true)
  })

  it('passes without optional comentario', () => {
    const result = changeDocumentStatusSchema.safeParse({ nuevoEstado: 'EN_REVISION' })
    expect(result.success).toBe(true)
  })

  it('passes with optional comentario provided', () => {
    const result = changeDocumentStatusSchema.safeParse({
      nuevoEstado: 'PUBLICADO',
      comentario: 'Aprobado por Jefe de Calidad',
    })
    expect(result.success).toBe(true)
  })

  it('fails when nuevoEstado is not a valid DocStatus', () => {
    const result = changeDocumentStatusSchema.safeParse({ nuevoEstado: 'INVALID_STATE' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('nuevoEstado')
    }
  })

  it('fails when nuevoEstado is missing', () => {
    const result = changeDocumentStatusSchema.safeParse({})
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('nuevoEstado')
    }
  })

  it('fails when comentario exceeds 1000 chars', () => {
    const result = changeDocumentStatusSchema.safeParse({
      nuevoEstado: 'EN_REVISION',
      comentario: 'C'.repeat(1001),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('comentario')
    }
  })
})
