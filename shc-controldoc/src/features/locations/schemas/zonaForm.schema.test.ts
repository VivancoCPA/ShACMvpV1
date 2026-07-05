import { describe, it, expect } from 'vitest'
import { zonaFormSchema } from './zonaForm.schema'

describe('zonaFormSchema', () => {
  it('acepta una Zona válida con solo nombre', () => {
    const result = zonaFormSchema.safeParse({ nombre: 'Zona de Carga' })
    expect(result.success).toBe(true)
  })

  it('acepta una Zona válida con nombre y descripcion', () => {
    const result = zonaFormSchema.safeParse({
      nombre: 'Zona de Carga',
      descripcion: 'Área de carga y descarga de camiones',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza nombre con menos de 3 caracteres', () => {
    const result = zonaFormSchema.safeParse({ nombre: 'Zo' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('nombre'))).toBe(true)
    }
  })
})
