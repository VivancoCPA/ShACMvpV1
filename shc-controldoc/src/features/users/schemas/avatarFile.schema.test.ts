import { describe, it, expect } from 'vitest'
import { validateAvatarFile } from './avatarFile.schema'

describe('validateAvatarFile (RN-USR-007)', () => {
  it('rechaza un archivo de formato no permitido', () => {
    const result = validateAvatarFile({ type: 'application/pdf', size: 1024 })
    expect(result.ok).toBe(false)
    expect(result.message).toBe('users:form.validation.avatarFormatoInvalido')
  })

  it('rechaza una imagen que excede 2MB', () => {
    const result = validateAvatarFile({ type: 'image/png', size: 3 * 1024 * 1024 })
    expect(result.ok).toBe(false)
    expect(result.message).toBe('users:form.validation.avatarTamanoInvalido')
  })

  it('acepta una imagen jpg válida de 500KB', () => {
    const result = validateAvatarFile({ type: 'image/jpeg', size: 500 * 1024 })
    expect(result.ok).toBe(true)
    expect(result.message).toBeUndefined()
  })

  it('acepta una imagen png válida de exactamente 2MB', () => {
    const result = validateAvatarFile({ type: 'image/png', size: 2 * 1024 * 1024 })
    expect(result.ok).toBe(true)
  })
})
