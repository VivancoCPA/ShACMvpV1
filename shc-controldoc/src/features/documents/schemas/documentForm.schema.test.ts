import { describe, it, expect } from 'vitest'
import { documentFormSchema } from './documentForm.schema'

const validPayload = {
  titulo: 'Procedimiento de Control de Documentos',
  tipo: 'PRC' as const,
  areaId: 'Calidad',
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

describe('documentFormSchema — RN-DOC-020 validación cruzada de fechas', () => {
  it('passes for a non-INF tipo with fechaRevisionProxima exactly 30 days after fechaVigencia (boundary)', () => {
    const result = documentFormSchema.safeParse({
      ...validPayload,
      tipo: 'PRC',
      fechaVigencia: '2026-01-01',
      fechaRevisionProxima: '2026-01-31',
    })
    expect(result.success).toBe(true)
  })

  it('passes for tipo PRC with fechaRevisionProxima = fechaVigencia + 12 months (typical autofill suggestion)', () => {
    const result = documentFormSchema.safeParse({
      ...validPayload,
      tipo: 'PRC',
      fechaVigencia: '2026-01-01',
      fechaRevisionProxima: '2027-01-01',
    })
    expect(result.success).toBe(true)
  })

  it('fails when fechaRevisionProxima is only 10 days after fechaVigencia (below the 30-day minimum)', () => {
    const result = documentFormSchema.safeParse({
      ...validPayload,
      tipo: 'PRC',
      fechaVigencia: '2026-01-01',
      fechaRevisionProxima: '2026-01-11',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('fechaRevisionProxima')
    }
  })

  it('fails when fechaRevisionProxima is before fechaVigencia (inverted dates)', () => {
    const result = documentFormSchema.safeParse({
      ...validPayload,
      tipo: 'PRC',
      fechaVigencia: '2026-02-01',
      fechaRevisionProxima: '2026-01-15',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('fechaRevisionProxima')
    }
  })

  it('fails when fechaVigencia is set but fechaRevisionProxima is missing for a non-INF tipo', () => {
    const result = documentFormSchema.safeParse({
      ...validPayload,
      tipo: 'MAT',
      fechaVigencia: '2026-01-01',
      fechaRevisionProxima: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('fechaRevisionProxima')
    }
  })

  it('passes for tipo INF without fechaRevisionProxima even when fechaVigencia is set (opcional)', () => {
    const result = documentFormSchema.safeParse({
      ...validPayload,
      tipo: 'INF',
      fechaVigencia: '2026-01-01',
      fechaRevisionProxima: '',
    })
    expect(result.success).toBe(true)
  })

  it('fails for tipo INF when fechaRevisionProxima is provided but under the 30-day minimum', () => {
    const result = documentFormSchema.safeParse({
      ...validPayload,
      tipo: 'INF',
      fechaVigencia: '2026-01-01',
      fechaRevisionProxima: '2026-01-11',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('fechaRevisionProxima')
    }
  })

  it('passes when fechaVigencia is not set at all, regardless of tipo (BORRADOR creation flow)', () => {
    const result = documentFormSchema.safeParse({
      ...validPayload,
      tipo: 'PRC',
      fechaVigencia: '',
      fechaRevisionProxima: '',
    })
    expect(result.success).toBe(true)
  })
})
