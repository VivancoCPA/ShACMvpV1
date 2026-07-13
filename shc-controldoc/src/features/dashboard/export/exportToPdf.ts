import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas'
import { buildExportFilename } from './buildExportFilename'
import { formatFechaHora, sectionPeriodoLabel } from './dashboardExport.utils'
import type { DashboardExportI18n, DashboardExportMeta, DashboardExportSection } from './dashboardExport.types'

const MARGIN = 14
export const TENDENCIA_VOLUMEN_CHART_SELECTOR = '[data-export-chart="tendencia-volumen"]'
export const TENDENCIA_KPIS_CHART_SELECTOR = '[data-export-chart="tendencia-kpis"]'

async function captureChart(selector: string): Promise<{ dataUrl: string; ratio: number } | null> {
  const node = document.querySelector<HTMLElement>(selector)
  if (!node) return null
  const canvas = await html2canvas(node, { scale: 2 })
  return { dataUrl: canvas.toDataURL('image/png'), ratio: canvas.height / canvas.width }
}

function drawPortada(doc: jsPDF, meta: DashboardExportMeta, i18n: DashboardExportI18n): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFontSize(20)
  doc.text(i18n.t('dashboard:export.pdf.portadaTitulo'), pageWidth / 2, 40, { align: 'center' })

  doc.setFontSize(12)
  const lines = [
    `${i18n.t('dashboard:export.meta.rol')}: ${meta.rolLabel}`,
    `${i18n.t('dashboard:export.meta.periodo')}: ${i18n.t('dashboard:export.periodo.snapshot')}`,
    `${i18n.t('dashboard:export.meta.generadoEn')}: ${formatFechaHora(meta.generadoEn, i18n)}`,
    `${i18n.t('dashboard:export.meta.usuario')}: ${meta.usuario}`,
  ]
  lines.forEach((line, i) => doc.text(line, pageWidth / 2, 55 + i * 8, { align: 'center' }))
}

function drawSectionHeading(
  doc: jsPDF,
  section: DashboardExportSection,
  meta: DashboardExportMeta,
  i18n: DashboardExportI18n,
): void {
  doc.setFontSize(14)
  doc.text(section.titulo, MARGIN, MARGIN + 4)
  doc.setFontSize(9)
  doc.text(
    `${i18n.t('dashboard:export.meta.periodo')}: ${sectionPeriodoLabel(section, meta, i18n)}`,
    MARGIN,
    MARGIN + 10,
  )
}

function drawTablaSection(doc: jsPDF, section: DashboardExportSection, i18n: DashboardExportI18n): void {
  if (section.empty) {
    doc.setFontSize(10)
    doc.text(i18n.t('dashboard:export.emptyMessage'), MARGIN, MARGIN + 22)
    return
  }
  autoTable(doc, {
    startY: MARGIN + 16,
    head: [section.headers],
    body: section.rows,
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 8 },
  })
}

async function drawGraficoTendenciaSection(doc: jsPDF, i18n: DashboardExportI18n) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const usableWidth = pageWidth - MARGIN * 2
  let cursorY = MARGIN + 16

  const images = (
    await Promise.all([captureChart(TENDENCIA_VOLUMEN_CHART_SELECTOR), captureChart(TENDENCIA_KPIS_CHART_SELECTOR)])
  ).filter((img): img is NonNullable<typeof img> => img !== null)

  if (images.length === 0) {
    doc.setFontSize(10)
    doc.text(i18n.t('dashboard:export.emptyMessage'), MARGIN, cursorY)
    return
  }

  for (const image of images) {
    const imgHeight = usableWidth * image.ratio
    if (cursorY + imgHeight > pageHeight - MARGIN) {
      doc.addPage()
      cursorY = MARGIN
    }
    doc.addImage(image.dataUrl, 'PNG', MARGIN, cursorY, usableWidth, imgHeight)
    cursorY += imgHeight + 8
  }
}

export async function exportToPdf(
  sections: DashboardExportSection[],
  meta: DashboardExportMeta,
  i18n: DashboardExportI18n,
): Promise<void> {
  const doc = new jsPDF()
  drawPortada(doc, meta, i18n)

  for (const section of sections) {
    doc.addPage()
    drawSectionHeading(doc, section, meta, i18n)

    if (section.kind === 'grafico-tendencia') {
      await drawGraficoTendenciaSection(doc, i18n)
    } else {
      drawTablaSection(doc, section, i18n)
    }
  }

  doc.save(buildExportFilename(meta.rol, 'pdf', meta.generadoEn))
}
