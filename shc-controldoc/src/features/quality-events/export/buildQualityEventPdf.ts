import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { resolveUserDisplayName } from '../../../mocks/fixtures/userIdentity.fixtures'
import { formatNormativaVinculada } from '../utils/qualityEventHelpers'
import {
  QE_ORIGIN_LABELS,
  QE_TYPE_LABELS,
  QE_SEVERITY_LABELS,
} from '../../../constants/shared.constants'
import type { QualityEvent, IshikawaCategoria } from '../types/qualityEvent.types'

export interface QEExportMeta {
  exportadoPorNombre: string
  generadoEn: Date
}

const MARGIN = 14
const PLACEHOLDER = 'Sin información registrada aún'

const TURNO_LABELS: Record<QualityEvent['turno'], string> = {
  DIA: 'Día',
  TARDE: 'Tarde',
  NOCHE: 'Noche',
}

const AC_ESTADO_LABELS: Record<'PENDIENTE' | 'EN_EJECUCION' | 'CERRADA', string> = {
  PENDIENTE: 'Pendiente',
  EN_EJECUCION: 'En ejecución',
  CERRADA: 'Cerrada',
}

const ISHIKAWA_LABELS: Record<IshikawaCategoria, string> = {
  METODO: 'Método',
  MAQUINA: 'Máquina',
  MATERIAL: 'Material',
  MANO_DE_OBRA: 'Mano de obra',
  MEDICION: 'Medición',
  MEDIO_AMBIENTE: 'Medio ambiente',
}

function formatFechaHora(value?: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function formatFecha(value?: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(new Date(value))
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(title, MARGIN, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  return y + 8
}

function drawParagraph(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 5): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[]
  doc.text(lines, x, y)
  return y + lines.length * lineHeight
}

function drawCabecera(doc: jsPDF, qe: QualityEvent, y: number): number {
  y = drawSectionTitle(doc, 'Cabecera', y)

  const lines = [
    `Número: ${qe.numero}`,
    `Origen: ${QE_ORIGIN_LABELS[qe.origen]}`,
    `Tipo: ${QE_TYPE_LABELS[qe.tipo]}`,
    `Severidad: ${QE_SEVERITY_LABELS[qe.severidad]}`,
    `Área Afectada: ${qe.areaId}`,
    ...(qe.mineralInvolucrado ? [`Mineral Involucrado: ${qe.mineralInvolucrado}`] : []),
    `Turno: ${TURNO_LABELS[qe.turno]}`,
    `Fecha y hora del evento: ${formatFechaHora(qe.fechaHoraEvento)}`,
    `Fecha y hora del reporte: ${formatFechaHora(qe.fechaHoraReporte)}`,
    `Reportado por: ${resolveUserDisplayName(qe.reportadoPorId)}`,
  ]
  if (qe.ciclo > 1) lines.push(`Ciclo ${qe.ciclo} — Reabierto`)

  for (const line of lines) {
    doc.text(line, MARGIN, y)
    y += 6
  }
  return y + 4
}

function drawDescripcion(doc: jsPDF, qe: QualityEvent, y: number, pageWidth: number): number {
  y = drawSectionTitle(doc, 'Descripción', y)
  const maxWidth = pageWidth - MARGIN * 2

  y = drawParagraph(doc, qe.descripcion || PLACEHOLDER, MARGIN, y, maxWidth)

  if (qe.descripcionAmpliada) {
    y += 3
    y = drawParagraph(doc, qe.descripcionAmpliada, MARGIN, y, maxWidth)
  }

  if (qe.origen === 'O3_HALLAZGO_AUDITORIA') {
    if (qe.hallazgoCodigo) {
      y += 3
      doc.text(`Código de hallazgo: ${qe.hallazgoCodigo}`, MARGIN, y)
      y += 6
    }
    if (qe.normativaVinculada) {
      y += 3
      doc.text(`Normativa vinculada: ${formatNormativaVinculada(qe.normativaVinculada)}`, MARGIN, y)
      y += 6
    }
  }

  return y + 4
}

function drawCausaRaiz(doc: jsPDF, qe: QualityEvent, y: number, pageWidth: number): number {
  y = drawSectionTitle(doc, 'Causa Raíz', y)
  const maxWidth = pageWidth - MARGIN * 2

  const tieneCincoPorques =
    qe.metodoAnalisis === '5_PORQUES' && (qe.cincoPorques ?? []).some((p) => p.respuesta.trim() !== '')
  const tieneIshikawa =
    qe.metodoAnalisis === 'ISHIKAWA' && (qe.ishikawa ?? []).some((i) => i.causa.trim() !== '')
  const tieneCausaRaizDefinitiva = !!qe.causaRaizDefinitiva

  if (!tieneCincoPorques && !tieneIshikawa && !tieneCausaRaizDefinitiva) {
    doc.text(PLACEHOLDER, MARGIN, y)
    return y + 10
  }

  if (tieneCincoPorques) {
    for (const [i, porque] of (qe.cincoPorques ?? []).entries()) {
      y = drawParagraph(doc, `¿Por qué ${i + 1}? ${porque.respuesta || '—'}`, MARGIN, y, maxWidth)
      y += 1
    }
  } else if (tieneIshikawa) {
    for (const item of qe.ishikawa ?? []) {
      y = drawParagraph(doc, `${ISHIKAWA_LABELS[item.categoria]}: ${item.causa || '—'}`, MARGIN, y, maxWidth)
      y += 1
    }
  }

  if (tieneCausaRaizDefinitiva) {
    y += 3
    y = drawParagraph(doc, `Causa raíz definitiva: ${qe.causaRaizDefinitiva}`, MARGIN, y, maxWidth)
  }

  const causaRaizAprobadaEntry = qe.auditTrail.find((e) => e.accion === 'CAUSA_RAIZ_APROBADA' && e.generadoPorIA)
  if (causaRaizAprobadaEntry) {
    y += 3
    doc.text(
      `Borrador IA — validado por ${resolveUserDisplayName(qe.causaRaizAprobadaPorId ?? causaRaizAprobadaEntry.realizadoPorId)}`,
      MARGIN,
      y,
    )
    y += 6
  }

  return y + 4
}

function drawPlanAcciones(doc: jsPDF, qe: QualityEvent, y: number): void {
  y = drawSectionTitle(doc, 'Plan de Acciones Correctivas', y)

  if (qe.accionesCorrectivas.length === 0) {
    doc.text(PLACEHOLDER, MARGIN, y)
    return
  }

  autoTable(doc, {
    startY: y,
    head: [['Descripción', 'Responsable', 'Plazo', 'Estado', 'Evidencia', 'Resultado']],
    body: qe.accionesCorrectivas.map((ac) => [
      ac.descripcion,
      ac.responsableNombre,
      formatFecha(ac.plazoFecha),
      AC_ESTADO_LABELS[ac.estado],
      ac.descripcionEvidencia || ac.evidenciaUrl || '—',
      ac.estado === 'CERRADA' ? 'Cerrada con evidencia' : '—',
    ]),
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 8 },
  })
}

function drawCierre(doc: jsPDF, qe: QualityEvent, y: number, pageWidth: number): void {
  y = drawSectionTitle(doc, 'Cierre', y)
  const maxWidth = pageWidth - MARGIN * 2

  if (!qe.resultadoCierre) {
    doc.text(PLACEHOLDER, MARGIN, y)
    return
  }

  y = drawParagraph(doc, `Resultado del cierre: ${qe.resultadoCierre}`, MARGIN, y, maxWidth)
  y += 3
  doc.text(`Plazo de verificación: ${qe.plazoVerificacionDias ?? '—'} días`, MARGIN, y)
  y += 6
  doc.text(`Resultado de verificación: ${qe.resultadoVerificacion ?? '—'}`, MARGIN, y)
  y += 8

  const firmaJefeCalidad = qe.auditTrail.find((e) => e.accion === 'FIRMA_CIERRE_JEFE_CALIDAD')
  const firmaSegunda = qe.auditTrail.find((e) => e.accion === 'FIRMA_CIERRE_SEGUNDA')

  doc.text('Firmas:', MARGIN, y)
  y += 6
  doc.text(
    firmaJefeCalidad
      ? `Jefe de Calidad: ${firmaJefeCalidad.realizadoPorNombre} — ${formatFechaHora(firmaJefeCalidad.timestamp)}`
      : 'Jefe de Calidad: —',
    MARGIN,
    y,
  )
  y += 6
  const segundaRolLabel = qe.cierreFirmaSupervisorRol === 'ALTA_DIRECCION' ? 'Alta Dirección' : 'Supervisor'
  doc.text(
    firmaSegunda
      ? `${segundaRolLabel}: ${firmaSegunda.realizadoPorNombre} — ${formatFechaHora(firmaSegunda.timestamp)}`
      : 'Segunda firma: —',
    MARGIN,
    y,
  )
}

function drawAuditTrail(doc: jsPDF, qe: QualityEvent, y: number): void {
  y = drawSectionTitle(doc, 'Audit Trail', y)

  if (qe.auditTrail.length === 0) {
    doc.text(PLACEHOLDER, MARGIN, y)
    return
  }

  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Acción', 'Usuario', 'Detalle']],
    body: qe.auditTrail.map((entry) => [
      formatFechaHora(entry.timestamp),
      entry.accion,
      entry.realizadoPorNombre,
      [
        entry.estadoAnterior && entry.estadoNuevo ? `${entry.estadoAnterior} → ${entry.estadoNuevo}` : '',
        entry.campoModificado ?? '',
        entry.valorNuevo ?? '',
      ]
        .filter(Boolean)
        .join(' '),
    ]),
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 7 },
  })
}

function drawFooters(doc: jsPDF, qe: QualityEvent, meta: QEExportMeta): void {
  const totalPages = doc.getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const generadoEnLabel = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Lima',
  }).format(meta.generadoEn)

  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `${qe.numero} · Página ${page} de ${totalPages} · ${generadoEnLabel} · ${meta.exportadoPorNombre}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' },
    )
  }
}

export function buildQualityEventPdf(qe: QualityEvent, meta: QEExportMeta): jsPDF {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  let y = MARGIN + 10
  drawCabecera(doc, qe, y)

  doc.addPage()
  y = MARGIN + 10
  drawDescripcion(doc, qe, y, pageWidth)

  doc.addPage()
  y = MARGIN + 10
  drawCausaRaiz(doc, qe, y, pageWidth)

  doc.addPage()
  y = MARGIN + 10
  drawPlanAcciones(doc, qe, y)

  doc.addPage()
  y = MARGIN + 10
  drawCierre(doc, qe, y, pageWidth)

  doc.addPage()
  y = MARGIN + 10
  drawAuditTrail(doc, qe, y)

  drawFooters(doc, qe, meta)

  return doc
}
