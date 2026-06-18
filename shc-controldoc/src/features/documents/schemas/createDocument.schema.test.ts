import { describe, it, expect } from 'vitest'
import { createDocumentSchema } from './createDocument.schema'

const validPayload = {
  titulo: 'Procedimiento de Control de Documentos',
  tipo: 'PRC' as const,
  area: 'Calidad',
  revisorId: '550e8400-e29b-41d4-a716-446655440000',
  aprobadorId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
}

describe('createDocumentSchema', () => {
  it('passes with a complete valid payload', () => {
    const result = createDocumentSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('passes without optional descripcion', () => {
    const result = createDocumentSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('passes with optional descripcion included', () => {
    const result = createDocumentSchema.safeParse({
      ...validPayload,
      descripcion: 'Descripción del procedimiento',
    })
    expect(result.success).toBe(true)
  })

  it('fails when titulo is below minimum length (< 5 chars)', () => {
    const result = createDocumentSchema.safeParse({ ...validPayload, titulo: 'Proc' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('titulo')
    }
  })

  it('fails when titulo exceeds maximum length (> 200 chars)', () => {
    const result = createDocumentSchema.safeParse({
      ...validPayload,
      titulo: 'A'.repeat(201),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('titulo')
    }
  })

  it('fails when tipo is not a valid DocType value', () => {
    const result = createDocumentSchema.safeParse({ ...validPayload, tipo: 'INVALID' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('tipo')
    }
  })

  it('fails when revisorId is not a valid UUID', () => {
    const result = createDocumentSchema.safeParse({ ...validPayload, revisorId: 'not-a-uuid' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('revisorId')
    }
  })

  it('fails when aprobadorId is not a valid UUID', () => {
    const result = createDocumentSchema.safeParse({ ...validPayload, aprobadorId: 'not-a-uuid' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('aprobadorId')
    }
  })

  it('fails when descripcion exceeds 2000 chars', () => {
    const result = createDocumentSchema.safeParse({
      ...validPayload,
      descripcion: 'D'.repeat(2001),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('descripcion')
    }
  })

  it('fails when area is empty', () => {
    const result = createDocumentSchema.safeParse({ ...validPayload, area: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('area')
    }
  })
})
