import { describe, it, expect } from 'vitest'
import { areaFormSchema } from './areaForm.schema'

describe('areaFormSchema', () => {
  it('acepta un Área válida con solo nombre', () => {
    const result = areaFormSchema.safeParse({ nombre: 'Patio de Concentrado' })
    expect(result.success).toBe(true)
  })

  it('acepta un Área válida con nombre y descripcion', () => {
    const result = areaFormSchema.safeParse({
      nombre: 'Patio de Concentrado',
      descripcion: 'Zona de acopio temporal de concentrado antes de despacho',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza nombre con menos de 3 caracteres', () => {
    const result = areaFormSchema.safeParse({ nombre: 'Pa' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('nombre'))).toBe(true)
    }
  })

  it('rechaza nombre vacío', () => {
    const result = areaFormSchema.safeParse({ nombre: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('nombre'))).toBe(true)
    }
  })
})
