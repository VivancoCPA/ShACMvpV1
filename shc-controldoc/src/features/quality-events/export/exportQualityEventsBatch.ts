import JSZip from 'jszip'
import { exportQualityEventPdf } from '../api/quality-events.api'
import { buildQualityEventPdf } from './buildQualityEventPdf'

export interface BatchExportProgress {
  completed: number
  total: number
}

export async function exportQualityEventsBatch(
  qeIds: string[],
  exportadoPorNombre: string,
  onProgress?: (progress: BatchExportProgress) => void,
): Promise<Blob> {
  const zip = new JSZip()
  const total = qeIds.length

  for (let i = 0; i < qeIds.length; i++) {
    const updatedQe = await exportQualityEventPdf(qeIds[i])
    const doc = buildQualityEventPdf(updatedQe, { exportadoPorNombre, generadoEn: new Date() })
    zip.file(`${updatedQe.numero}.pdf`, doc.output('blob'))
    onProgress?.({ completed: i + 1, total })
  }

  return zip.generateAsync({ type: 'blob' })
}

export function buildBatchExportFilename(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const min = pad(date.getMinutes())
  return `quality-events-export-${yyyy}${mm}${dd}-${hh}${min}.zip`
}
