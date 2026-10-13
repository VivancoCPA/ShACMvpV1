import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Document, Page, pdfjs } from 'react-pdf'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Printer,
  Loader2,
  AlertTriangle,
  FileX,
} from 'lucide-react'
import { getDocumentVisorBlob } from '../../../api/endpoints/documents.api'
import { useAuthStore } from '../../../stores/authStore'
import { QUERY_KEYS } from '../constants'

// visor-documentos (design.md D6) — worker de pdf.js configurado una sola vez a nivel de módulo,
// sin CDN externo (esta app corre su propio build Vite, sin la restricción de un Artifact).
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const ZOOM_MIN = 0.5
const ZOOM_MAX = 2.5
const ZOOM_STEP = 0.25

// Roles con permiso de impresión (RN-DOC-010, D3 del proposal) — la impresión es la única
// excepción a "sin descarga para nadie"; no hay botón de descarga en ningún caso.
function puedeImprimir(rol: string | undefined): boolean {
  return rol === 'JEFE_CONTROL_DOCUMENTARIO' || rol === 'ALTA_DIRECCION'
}

// Mide el ancho disponible del contenedor para "ajustar al ancho" — ResizeObserver es una
// suscripción a una API del navegador, no una derivación de estado/props ya conocidos (distinto
// del caso que prohíbe la regla 1 de CLAUDE.md: useEffect para derivar estado).
function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return width
}

interface DocumentViewerProps {
  documentoId: string
}

export function DocumentViewer({ documentoId }: DocumentViewerProps) {
  const { t } = useTranslation('documents')
  const userRol = useAuthStore((s) => s.user?.rol)
  const containerRef = useRef<HTMLDivElement>(null)
  const containerWidth = useContainerWidth(containerRef)

  const [pageNumber, setPageNumber] = useState(1)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [fitWidth, setFitWidth] = useState(true)
  const [scale, setScale] = useState(1)
  const [isPrinting, setIsPrinting] = useState(false)

  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['documents', 'visor', documentoId],
    // fix-log-refresco-inmediato: el backend registra VISUALIZACION en el audit trail del
    // documento, pero sin esta invalidación el detalle (refetchOnWindowFocus: false) no la
    // muestra hasta recargar. Se invalida acá, dentro de la propia queryFn tras el éxito, en vez
    // de con un useEffect sobre query.isSuccess — así corre exactamente una vez por ejecución
    // exitosa, nunca en un fallo, sin depender de un efecto adicional que vigile el estado de la
    // query. No dispara una segunda carga del visor: esta query (['documents','visor',...]) es
    // independiente de documents.detail, y nada remonta DocumentViewer como consecuencia.
    queryFn: async () => {
      const blob = await getDocumentVisorBlob(documentoId)
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.detail(documentoId) })
      return blob
    },
    retry: false,
    staleTime: 0,
  })

  const errorInfo = useErrorMessage(query.error, t)

  const handlePrint = async () => {
    if (!query.data) return
    setIsPrinting(true)
    const url = URL.createObjectURL(query.data)
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.setAttribute('aria-hidden', 'true')

    const cleanup = () => {
      URL.revokeObjectURL(url)
      iframe.remove()
      setIsPrinting(false)
    }

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } finally {
        // No todos los navegadores disparan 'afterprint' de forma confiable dentro de un
        // iframe oculto — se limpia tras un margen razonable en vez de depender solo de ese
        // evento (D6/R4 de design.md).
        setTimeout(cleanup, 2000)
      }
    }
    iframe.src = url
    document.body.appendChild(iframe)
  }

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-lg bg-surface-soft dark:bg-surface-dark-soft"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-canvas px-3 py-2 dark:border-hairline/20 dark:bg-surface-dark">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t('visor.paginaAnterior')}
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            className="rounded-md p-1.5 text-ink hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-40 dark:text-on-dark dark:hover:bg-surface-dark-elevated"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span className="min-w-max px-1 text-xs text-muted dark:text-on-dark-soft">
            {numPages ? t('visor.paginaDe', { actual: pageNumber, total: numPages }) : '—'}
          </span>
          <button
            type="button"
            aria-label={t('visor.paginaSiguiente')}
            disabled={!numPages || pageNumber >= numPages}
            onClick={() => setPageNumber((p) => Math.min(numPages ?? p, p + 1))}
            className="rounded-md p-1.5 text-ink hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-40 dark:text-on-dark dark:hover:bg-surface-dark-elevated"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t('visor.alejar')}
            onClick={() => {
              setFitWidth(false)
              setScale((s) => Math.max(ZOOM_MIN, s - ZOOM_STEP))
            }}
            className="rounded-md p-1.5 text-ink hover:bg-surface-soft dark:text-on-dark dark:hover:bg-surface-dark-elevated"
          >
            <ZoomOut size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t('visor.acercar')}
            onClick={() => {
              setFitWidth(false)
              setScale((s) => Math.min(ZOOM_MAX, s + ZOOM_STEP))
            }}
            className="rounded-md p-1.5 text-ink hover:bg-surface-soft dark:text-on-dark dark:hover:bg-surface-dark-elevated"
          >
            <ZoomIn size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setFitWidth(true)}
            aria-pressed={fitWidth}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium ${
              fitWidth
                ? 'bg-coral/10 text-coral'
                : 'text-ink hover:bg-surface-soft dark:text-on-dark dark:hover:bg-surface-dark-elevated'
            }`}
          >
            <Maximize2 size={14} aria-hidden="true" />
            {t('visor.ajustarAlAncho')}
          </button>

          {puedeImprimir(userRol) && (
            <button
              type="button"
              onClick={() => void handlePrint()}
              disabled={!query.data || isPrinting}
              className="ml-2 inline-flex items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-60 dark:border-hairline/30 dark:text-on-dark dark:hover:bg-surface-dark-elevated"
            >
              {isPrinting
                ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                : <Printer size={14} aria-hidden="true" />}
              {isPrinting ? t('visor.imprimiendo') : t('visor.imprimir')}
            </button>
          )}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto px-2 py-4">
        {query.isLoading && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted dark:text-on-dark-soft">
            <Loader2 size={28} className="animate-spin" aria-hidden="true" />
            <p className="text-sm">{t('visor.generandoVistaPrevia')}</p>
          </div>
        )}

        {query.isError && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted dark:text-on-dark-soft">
            {errorInfo.isNoFile
              ? <FileX size={28} aria-hidden="true" />
              : <AlertTriangle size={28} className="text-error" aria-hidden="true" />}
            <p className="text-sm">{errorInfo.message}</p>
            {!errorInfo.isNoFile && (
              <button
                type="button"
                onClick={() => void query.refetch()}
                className="rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-soft dark:border-hairline/30 dark:text-on-dark"
              >
                {t('visor.reintentar')}
              </button>
            )}
          </div>
        )}

        {query.data && (
          <div className="flex justify-center">
            <Document
              file={query.data}
              onLoadSuccess={({ numPages: total }) => {
                setNumPages(total)
                setPageNumber((p) => Math.min(p, total))
              }}
              loading={
                <div className="flex items-center justify-center p-10">
                  <Loader2 size={24} className="animate-spin text-muted" aria-hidden="true" />
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                width={fitWidth ? (containerWidth ?? undefined) : undefined}
                scale={fitWidth ? undefined : scale}
              />
            </Document>
          </div>
        )}
      </div>
    </div>
  )
}

// responseType: 'blob' aplica también al cuerpo de una respuesta de error — el JSON real del
// ApiResponse (con el mensaje de negocio) llega como Blob, no parseado. Leerlo es una operación
// async sobre un objeto externo (no una derivación de estado/props ya conocidos en React), así
// que el único punto de la regla 1 de CLAUDE.md que aplica aquí es "no usar useEffect para
// derivar estado" — esto no deriva estado, lee contenido async de una respuesta HTTP, el mismo
// tipo de efecto que ya justifica useEffect en el resto del codebase (fetch, suscripciones).
function useErrorMessage(
  error: unknown,
  t: (key: string, opts?: Record<string, unknown>) => string,
): { message: string; isNoFile: boolean } {
  const [resuelto, setResuelto] = useState<{ message: string; isNoFile: boolean }>({
    message: t('visor.errorGenerico'),
    isNoFile: false,
  })

  useEffect(() => {
    if (!error) return

    if (!isAxiosError(error) || !(error.response?.data instanceof Blob)) {
      setResuelto({ message: t('visor.errorGenerico'), isNoFile: false })
      return
    }

    const status = error.response.status
    let cancelado = false

    error.response.data
      .text()
      .then((texto) => {
        if (cancelado) return
        let mensaje: string | undefined
        try {
          mensaje = (JSON.parse(texto) as { message?: string }).message
        } catch {
          mensaje = undefined
        }

        // El mensaje "sin archivo para visualizar" llega como texto literal en español desde el
        // backend (no una clave i18n con namespace, p.ej. "documents:errors.notFound" para los
        // demás 404) — a diferencia de otros flujos (p.ej. toast.error(serverMsg ?? t(...)) en
        // useCreateNuevaVersion) este mensaje SÍ necesita traducción (en-US), así que solo se usa
        // la forma del mensaje para DETECTAR el caso (heurística: sin ':' → literal, no una
        // clave), y el texto mostrado siempre sale de t(), nunca del backend directamente.
        const esSinArchivo = status === 404 && !!mensaje && !mensaje.includes(':')
        setResuelto({
          message: esSinArchivo ? t('visor.sinArchivoParaVisualizar') : t('visor.errorGenerico'),
          isNoFile: esSinArchivo,
        })
      })
      .catch(() => {
        if (!cancelado) setResuelto({ message: t('visor.errorGenerico'), isNoFile: false })
      })

    return () => {
      cancelado = true
    }
  }, [error, t])

  return resuelto
}
