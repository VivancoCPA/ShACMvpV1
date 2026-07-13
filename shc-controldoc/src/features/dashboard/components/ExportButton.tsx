import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FileDown, FileSpreadsheet, FileType2, Loader2 } from 'lucide-react'
import { useAuthStore } from '../../../stores/authStore'
import { useDashboardWidgetStateStore } from '../../../stores/dashboardWidgetStateStore'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { useAccionesRequeridas } from '../hooks/useAccionesRequeridas'
import { useLocales } from '../../incidents/hooks/useLocales'
import { useIncidentList } from '../../incidents/hooks/useIncidentList'
import { buildJefeCalidadExportSections } from '../export/buildJefeCalidadExportSections'
import { buildAltaDireccionExportSections } from '../export/buildAltaDireccionExportSections'
import { exportToExcel } from '../export/exportToExcel'
import { exportToPdf } from '../export/exportToPdf'
import type { DashboardExportI18n, DashboardExportMeta, DashboardExportRol, HeatmapPorLocalEntry } from '../export/dashboardExport.types'

type ExportFormat = 'xlsx' | 'pdf'

function useHeatmapPorLocal(): HeatmapPorLocalEntry[] {
  const { locales } = useLocales()
  const { incidentes } = useIncidentList()
  const rango = useDashboardWidgetStateStore((s) => s.heatmapRango)

  return useMemo(() => {
    const desde = new Date()
    desde.setMonth(desde.getMonth() - rango)
    const desdeMs = desde.getTime()
    const enPeriodo = incidentes.filter((inc) => new Date(inc.fechaEvento).getTime() >= desdeMs)
    return locales
      .filter((local) => local.activo)
      .map((local) => ({
        local: local.nombre,
        conteo: enPeriodo.filter((inc) => inc.localId === local.id).length,
      }))
      .sort((a, b) => b.conteo - a.conteo)
  }, [locales, incidentes, rango])
}

interface ExportFormatModalProps {
  isExporting: boolean
  onClose: () => void
  onSelect: (formato: ExportFormat) => void
}

function ExportFormatModal({ isExporting, onClose, onSelect }: ExportFormatModalProps) {
  const { t } = useTranslation('dashboard')
  const modalRef = useRef<HTMLDivElement>(null)
  const headingId = 'export-format-modal-title'

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm dark:bg-ink/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="w-full max-w-sm rounded-xl bg-surface-card p-6 shadow-xl dark:bg-surface-dark-elevated"
      >
        <h2 id={headingId} className="mb-4 text-lg font-semibold text-ink dark:text-on-dark">
          {t('export.modal.title')}
        </h2>
        <p className="mb-5 text-sm text-muted dark:text-on-dark-soft">{t('export.modal.description')}</p>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            disabled={isExporting}
            onClick={() => onSelect('xlsx')}
            className="flex items-center gap-3 rounded-md border border-hairline bg-canvas px-4 py-3 text-left text-sm font-medium text-ink hover:bg-surface-soft disabled:opacity-50 dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 shrink-0" />
            )}
            {t('export.modal.excel')}
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={() => onSelect('pdf')}
            className="flex items-center gap-3 rounded-md border border-hairline bg-canvas px-4 py-3 text-left text-sm font-medium text-ink hover:bg-surface-soft disabled:opacity-50 dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <FileType2 className="h-4 w-4 shrink-0" />
            )}
            {t('export.modal.pdf')}
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
          >
            {t('export.modal.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ExportButton() {
  const { t, i18n } = useTranslation('dashboard')
  const rol = useAuthStore((s) => s.user?.rol)
  const user = useAuthStore((s) => s.user)
  const { data } = useDashboardSummary()
  const { items: accionesRequeridas } = useAccionesRequeridas()
  const heatmapPorLocal = useHeatmapPorLocal()
  const heatmapRango = useDashboardWidgetStateStore((s) => s.heatmapRango)
  const [modalOpen, setModalOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  if (rol !== 'JEFE_CALIDAD_SYST' && rol !== 'ALTA_DIRECCION') return null
  if (!data || !user) return null
  if (rol === 'JEFE_CALIDAD_SYST' && data.rol !== 'JEFE_CALIDAD') return null
  if (rol === 'ALTA_DIRECCION' && data.rol !== 'ALTA_DIRECCION') return null

  async function handleSelect(formato: ExportFormat) {
    if (!data || !user) return
    setIsExporting(true)
    try {
      const exportRol = rol as DashboardExportRol
      const i18nAdapter: DashboardExportI18n = { t, language: i18n.language }
      const meta: DashboardExportMeta = {
        rol: exportRol,
        rolLabel: t(`export.rolLabel.${exportRol}`),
        usuario: `${user.nombre} ${user.apellido}`,
        generadoEn: new Date(),
        heatmapRangoMeses: heatmapRango,
      }

      let sections
      if (data.rol === 'JEFE_CALIDAD') {
        sections = buildJefeCalidadExportSections(data.data, accionesRequeridas, heatmapPorLocal, i18nAdapter)
      } else if (data.rol === 'ALTA_DIRECCION') {
        sections = buildAltaDireccionExportSections(data.data, accionesRequeridas, heatmapPorLocal, i18nAdapter)
      } else {
        return
      }

      if (formato === 'xlsx') {
        exportToExcel(sections, meta, i18nAdapter)
      } else {
        await exportToPdf(sections, meta, i18nAdapter)
      }

      toast.success(t('export.toast.success'))
      setModalOpen(false)
    } catch {
      toast.error(t('export.toast.error'))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-2 rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
      >
        <FileDown className="h-4 w-4" />
        {t('export.button')}
      </button>

      {modalOpen && (
        <ExportFormatModal
          isExporting={isExporting}
          onClose={() => setModalOpen(false)}
          onSelect={handleSelect}
        />
      )}
    </>
  )
}
