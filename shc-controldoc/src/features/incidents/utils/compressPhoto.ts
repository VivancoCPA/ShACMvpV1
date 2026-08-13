import imageCompression from 'browser-image-compression'

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
}

/**
 * Comprime una foto en un Web Worker en el momento en que se adjunta al
 * formulario (m7-f2-offline-sync design.md D2), no al sincronizar. Si la
 * compresión falla (formato no soportado, error del worker), retorna el
 * archivo original sin comprimir en vez de bloquear el adjunto — la captura
 * de evidencia nunca debe fallar por un problema de compresión.
 */
export async function compressPhoto(file: File): Promise<File> {
  try {
    return await imageCompression(file, COMPRESSION_OPTIONS)
  } catch {
    return file
  }
}
