import * as XLSX from 'xlsx'
import { buildExportFilename } from './buildExportFilename'
import { formatFechaHora, sectionPeriodoLabel } from './dashboardExport.utils'
import type { DashboardExportI18n, DashboardExportMeta, DashboardExportSection } from './dashboardExport.types'

const MAX_SHEET_NAME_LENGTH = 31

function sheetName(titulo: string, usados: Set<string>): string {
  const base = titulo.replace(/[\\/*?:[\]]/g, ' ').slice(0, MAX_SHEET_NAME_LENGTH)
  let name = base
  let suffix = 2
  while (usados.has(name)) {
    const suffixStr = ` (${suffix})`
    name = `${base.slice(0, MAX_SHEET_NAME_LENGTH - suffixStr.length)}${suffixStr}`
    suffix += 1
  }
  usados.add(name)
  return name
}

function buildSheet(section: DashboardExportSection, meta: DashboardExportMeta, i18n: DashboardExportI18n) {
  const contexto: (string | number)[][] = [
    [i18n.t('dashboard:export.meta.rol'), meta.rolLabel],
    [i18n.t('dashboard:export.meta.periodo'), sectionPeriodoLabel(section, meta, i18n)],
    [i18n.t('dashboard:export.meta.generadoEn'), formatFechaHora(meta.generadoEn, i18n)],
    [i18n.t('dashboard:export.meta.usuario'), meta.usuario],
    [],
  ]

  const cuerpo: (string | number)[][] = section.empty
    ? [[i18n.t('dashboard:export.emptyMessage')]]
    : [section.headers, ...section.rows]

  return XLSX.utils.aoa_to_sheet([...contexto, ...cuerpo])
}

export function exportToExcel(
  sections: DashboardExportSection[],
  meta: DashboardExportMeta,
  i18n: DashboardExportI18n,
): void {
  const workbook = XLSX.utils.book_new()
  const usedNames = new Set<string>()

  for (const section of sections) {
    const worksheet = buildSheet(section, meta, i18n)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName(section.titulo, usedNames))
  }

  XLSX.writeFile(workbook, buildExportFilename(meta.rol, 'xlsx', meta.generadoEn))
}
