import { describe, expect, it } from 'vitest'
import { getFileNameFromContentDisposition } from './contentDisposition'

describe('getFileNameFromContentDisposition', () => {
  it('resuelve filename con comillas', () => {
    const header = 'attachment; filename="PRC-CD-001.docx"'
    expect(getFileNameFromContentDisposition(header, 'fallback.bin')).toBe('PRC-CD-001.docx')
  })

  it('resuelve filename sin comillas', () => {
    const header = 'attachment; filename=PRC-CD-001.docx'
    expect(getFileNameFromContentDisposition(header, 'fallback.bin')).toBe('PRC-CD-001.docx')
  })

  it('resuelve solo filename* con tildes y espacios', () => {
    const header = "attachment; filename*=UTF-8''Procedimiento%20de%20Inspecci%C3%B3n.docx"
    expect(getFileNameFromContentDisposition(header, 'fallback.bin')).toBe(
      'Procedimiento de Inspección.docx',
    )
  })

  it('cuando ambos están presentes, gana filename*', () => {
    const header =
      "attachment; filename=Procedimiento.docx; filename*=UTF-8''Procedimiento%20de%20Inspecci%C3%B3n.docx"
    expect(getFileNameFromContentDisposition(header, 'fallback.bin')).toBe(
      'Procedimiento de Inspección.docx',
    )
  })

  it('usa el fallback cuando el header está vacío', () => {
    expect(getFileNameFromContentDisposition('', 'fallback.bin')).toBe('fallback.bin')
  })

  it('usa el fallback cuando el header es undefined', () => {
    expect(getFileNameFromContentDisposition(undefined, 'fallback.bin')).toBe('fallback.bin')
  })

  it('usa el fallback si filename* trae un valor mal codificado', () => {
    const header = "attachment; filename*=UTF-8''%E0%A4%A"
    expect(getFileNameFromContentDisposition(header, 'fallback.bin')).toBe('fallback.bin')
  })
})
