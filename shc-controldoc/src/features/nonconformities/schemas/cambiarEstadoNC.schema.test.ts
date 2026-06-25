import { describe, it, expect } from 'vitest'
import { cambiarEstadoNCSchema } from './cambiarEstadoNC.schema'

describe('cambiarEstadoNCSchema', () => {
  it('rejects missing comentario', () => {
    const result = cambiarEstadoNCSchema.safeParse({ nuevoEstado: 'EN_INVESTIGACION' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('comentario')
    }
  })

  it('requires correccionEvidenciaUrl when transitioning to PENDIENTE_CIERRE', () => {
    const result = cambiarEstadoNCSchema.safeParse({
      nuevoEstado: 'PENDIENTE_CIERRE',
      comentario: 'Corrección completada.',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('correccionEvidenciaUrl')
    }
  })

  it('accepts PENDIENTE_CIERRE with correccionEvidenciaUrl', () => {
    const result = cambiarEstadoNCSchema.safeParse({
      nuevoEstado: 'PENDIENTE_CIERRE',
      comentario: 'Corrección completada.',
      correccionEvidenciaUrl: 'https://example.com/evidencia.pdf',
    })
    expect(result.success).toBe(true)
  })

  it('does not require correccionEvidenciaUrl for other transitions', () => {
    const result = cambiarEstadoNCSchema.safeParse({
      nuevoEstado: 'EN_INVESTIGACION',
      comentario: 'Iniciando investigación.',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid nuevoEstado value', () => {
    const result = cambiarEstadoNCSchema.safeParse({
      nuevoEstado: 'INEXISTENTE',
      comentario: 'Test.',
    })
    expect(result.success).toBe(false)
  })
})
