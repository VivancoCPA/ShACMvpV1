import { describe, it, expect } from 'vitest'
import { localFormSchema } from './localForm.schema'

function buildPngFile(sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], 'plano.png', { type: 'image/png' })
}

describe('localFormSchema', () => {
  it('acepta un Local válido con plano PNG de 1.5MB', () => {
    const result = localFormSchema.safeParse({
      nombre: 'Almacén Sur',
      direccion: 'Av. Industrial 450',
      planoUrl: buildPngFile(1.5 * 1024 * 1024),
      planoAncho: 1200,
      planoAlto: 800,
    })
    expect(result.success).toBe(true)
  })

  it('rechaza nombre con menos de 3 caracteres', () => {
    const result = localFormSchema.safeParse({ nombre: 'Al', direccion: 'Av. Industrial 450' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('nombre'))).toBe(true)
    }
  })

  it('rechaza direccion vacía', () => {
    const result = localFormSchema.safeParse({ nombre: 'Almacén Sur', direccion: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('direccion'))).toBe(true)
    }
  })

  it('rechaza planoUrl que no es PNG (RN-LOC-003)', () => {
    const jpegFile = new File([new Uint8Array(1024)], 'plano.jpg', { type: 'image/jpeg' })
    const result = localFormSchema.safeParse({
      nombre: 'Almacén Sur',
      direccion: 'Av. Industrial 450',
      planoUrl: jpegFile,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('PNG'))).toBe(true)
    }
  })

  it('rechaza planoUrl mayor a 2MB (RN-LOC-003)', () => {
    const result = localFormSchema.safeParse({
      nombre: 'Almacén Sur',
      direccion: 'Av. Industrial 450',
      planoUrl: buildPngFile(2.1 * 1024 * 1024),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('2 MB'))).toBe(true)
    }
  })

  it('acepta planoUrl de exactamente 2MB', () => {
    const result = localFormSchema.safeParse({
      nombre: 'Almacén Sur',
      direccion: 'Av. Industrial 450',
      planoUrl: buildPngFile(2 * 1024 * 1024),
    })
    expect(result.success).toBe(true)
  })
})
