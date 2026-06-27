import { describe, it, expect } from 'vitest'
import { anularNCSchema } from './anularNC.schema'

describe('anularNCSchema', () => {
  it('accepts a valid justificacion of 20+ characters', () => {
    const result = anularNCSchema.safeParse({
      justificacion: 'Justificación válida con más de veinte caracteres.',
    })
    expect(result.success).toBe(true)
  })

  it('rejects justificacion shorter than 20 characters', () => {
    const result = anularNCSchema.safeParse({ justificacion: 'Muy corta' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('justificacion')
    }
  })

  it('rejects empty justificacion', () => {
    const result = anularNCSchema.safeParse({ justificacion: '' })
    expect(result.success).toBe(false)
  })

  it('rejects justificacion of exactly 19 characters', () => {
    const result = anularNCSchema.safeParse({ justificacion: '1234567890123456789' })
    expect(result.success).toBe(false)
  })

  it('accepts justificacion of exactly 20 characters', () => {
    const result = anularNCSchema.safeParse({ justificacion: '12345678901234567890' })
    expect(result.success).toBe(true)
  })

  it('rejects justificacion longer than 2000 characters', () => {
    const result = anularNCSchema.safeParse({ justificacion: 'a'.repeat(2001) })
    expect(result.success).toBe(false)
  })
})
