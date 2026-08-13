import { describe, it, expect, vi } from 'vitest'
import imageCompression from 'browser-image-compression'
import { compressPhoto } from './compressPhoto'

vi.mock('browser-image-compression', () => ({
  default: vi.fn(),
}))

function buildFile(name = 'foto.jpg'): File {
  return new File(['contenido'], name, { type: 'image/jpeg' })
}

describe('compressPhoto', () => {
  it('retorna el archivo comprimido cuando la compresión tiene éxito', async () => {
    const original = buildFile()
    const compressed = buildFile('foto-comprimida.jpg')
    vi.mocked(imageCompression).mockResolvedValueOnce(compressed)

    const result = await compressPhoto(original)

    expect(result).toBe(compressed)
    expect(imageCompression).toHaveBeenCalledWith(
      original,
      expect.objectContaining({ useWebWorker: true }),
    )
  })

  it('retorna el archivo original si la compresión falla, sin lanzar', async () => {
    const original = buildFile()
    vi.mocked(imageCompression).mockRejectedValueOnce(new Error('worker error'))

    const result = await compressPhoto(original)

    expect(result).toBe(original)
  })
})
