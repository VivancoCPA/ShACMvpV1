import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FileText, FileSpreadsheet, FileVideo, File as FileIcon, X } from 'lucide-react'
import { useAbrirEvidenciaAC, useEvidenciaACBlob } from '../hooks/useEvidenciaACBlob'
import { formatearTamanio } from '../utils/formatearTamanio'
import type { EvidenciaACQE } from '../types/qualityEvent.types'

function IconoPorTipo({ contentType }: { contentType: string }) {
  if (contentType === 'application/pdf' || contentType.includes('word')) return <FileText size={18} aria-hidden="true" />
  if (contentType.startsWith('video/')) return <FileVideo size={18} aria-hidden="true" />
  if (contentType.includes('spreadsheet')) return <FileSpreadsheet size={18} aria-hidden="true" />
  return <FileIcon size={18} aria-hidden="true" />
}

function Miniatura({ qeId, acId, evidencia }: { qeId: string; acId: string; evidencia: EvidenciaACQE }) {
  const esImagen = evidencia.contentType.startsWith('image/')
  const { blobUrl } = useEvidenciaACBlob(qeId, acId, evidencia.id, esImagen)

  if (esImagen && blobUrl) {
    return <img src={blobUrl} alt="" className="h-10 w-10 shrink-0 rounded-sm object-cover" />
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-surface-soft text-muted dark:bg-surface-dark-soft dark:text-on-dark-soft">
      <IconoPorTipo contentType={evidencia.contentType} />
    </span>
  )
}

// Fila de una evidencia ya subida: miniatura (imágenes) o ícono por tipo, nombre que abre el
// archivo autenticado en una pestaña nueva y, opcionalmente, botón para quitarla.
export function EvidenciaACItem({
  qeId,
  acId,
  evidencia,
  onQuitar,
  quitando = false,
}: {
  qeId: string
  acId: string
  evidencia: EvidenciaACQE
  onQuitar?: () => void
  quitando?: boolean
}) {
  const { t, i18n } = useTranslation('qualityEvents')
  const abrir = useAbrirEvidenciaAC(qeId, acId)

  const onAbrir = () => {
    abrir(evidencia.id).catch(() => toast.error(t('detail.acSection.evidencias.errorAbrir')))
  }

  return (
    <li className="flex items-center gap-3 rounded-md border border-hairline p-2 dark:border-hairline/20">
      <Miniatura qeId={qeId} acId={acId} evidencia={evidencia} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onAbrir}
          className="block max-w-full truncate text-left text-sm text-coral hover:underline dark:text-coral"
          title={t('detail.acSection.evidencias.abrir')}
        >
          {evidencia.nombreArchivo}
        </button>
        <p className="text-xs text-muted dark:text-on-dark-soft">{formatearTamanio(evidencia.tamanioBytes, i18n.language)}</p>
      </div>
      {onQuitar && (
        <button
          type="button"
          onClick={onQuitar}
          disabled={quitando}
          aria-label={t('detail.acSection.evidencias.quitar', { nombre: evidencia.nombreArchivo })}
          className="rounded-sm p-1 text-muted hover:bg-surface-soft hover:text-error disabled:opacity-60 dark:text-on-dark-soft dark:hover:bg-surface-dark-soft"
        >
          <X size={16} />
        </button>
      )}
    </li>
  )
}
