import { describe, it, expect } from 'vitest'
import { updateDocumentSchema } from './updateDocument.schema'

describe('updateDocumentSchema', () => {
  it('passes with an empty object (all fields optional)', () => {
    const result = updateDocumentSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('passes with only titulo provided', () => {
    const result = updateDocumentSchema.safeParse({ titulo: 'Nuevo Título Válido' })
    expect(result.success).toBe(true)
  })

  it('passes with a partial update of several fields', () => {
    const result = updateDocumentSchema.safeParse({
      titulo: 'Procedimiento Actualizado',
      descripcion: 'Descripción nueva',
    })
    expect(result.success).toBe(true)
  })

  it('fails when titulo is below minimum length', () => {
    const result = updateDocumentSchema.safeParse({ titulo: 'Hi' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('titulo')
    }
  })

  it('fails when titulo exceeds maximum length', () => {
    const result = updateDocumentSchema.safeParse({ titulo: 'A'.repeat(201) })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('titulo')
    }
  })

  it('fails when revisorId is not a valid UUID', () => {
    const result = updateDocumentSchema.safeParse({ revisorId: 'not-a-uuid' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('revisorId')
    }
  })

  it('fails when aprobadorId is not a valid UUID', () => {
    const result = updateDocumentSchema.safeParse({ aprobadorId: 'invalid' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('aprobadorId')
    }
  })

  it('passes with a valid UUID for revisorId', () => {
    const result = updateDocumentSchema.safeParse({
      revisorId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })
})
