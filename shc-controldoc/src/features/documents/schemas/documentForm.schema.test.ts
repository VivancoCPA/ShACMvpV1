import { describe, it, expect } from 'vitest'
import { documentFormSchema } from './documentForm.schema'

const validPayload = {
  titulo: 'Procedimiento de Control de Documentos',
  tipo: 'PRC' as const,
  area: 'Calidad',
  version: 'v1.0',
  confidencialidad: 'INTERNO' as const,
  revisorId: '550e8400-e29b-41d4-a716-446655440000',
  aprobadorId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
}

describe('documentFormSchema — RN-DOC-019 segregación revisor/aprobador', () => {
  it('fails when revisorId and aprobadorId are the same non-empty value', () => {
    const sameId = validPayload.revisorId
    const result = documentFormSchema.safeParse({
      ...validPayload,
      revisorId: sameId,
      aprobadorId: sameId,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('aprobadorId')
    }
  })

  it('passes when revisorId and aprobadorId are different users', () => {
    const result = documentFormSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('passes when aprobadorId is empty and revisorId is set', () => {
    const result = documentFormSchema.safeParse({
      ...validPayload,
      aprobadorId: '',
    })
    expect(result.success).toBe(true)
  })

  it('passes when revisorId is empty and aprobadorId is set', () => {
    const result = documentFormSchema.safeParse({
      ...validPayload,
      revisorId: '',
    })
    expect(result.success).toBe(true)
  })

  it('passes when both revisorId and aprobadorId are empty', () => {
    const result = documentFormSchema.safeParse({
      ...validPayload,
      revisorId: '',
      aprobadorId: '',
    })
    expect(result.success).toBe(true)
  })
})
