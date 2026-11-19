import * as XLSX from 'xlsx'
import { fechaLima } from './limaFechas'
import type { AccionCorrectivaListadoItem } from '../types/accionesCorrectivasListado.types'

// Exportación a Excel del listado filtrado de AC (modulo-acciones-correctivas D8). El backend
// devuelve el JSON (/api/acciones-correctivas/export) y el libro se arma aquí con `xlsx`.

export interface ACExportI18n {
  t(key: string, options?: Record<string, unknown>): string
}

const fechaLimaDdMmAaaa = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** Timestamp → dd/mm/aaaa en hora de Lima. */
export function formatTimestampLima(iso: string | null | undefined): string {
  return iso ? fechaLimaDdMmAaaa.format(new Date(iso)) : ''
}

/** Fecha de calendario (medianoche UTC) → dd/mm/aaaa, sin conversión de zona (no corre un día). */
export function formatFechaCalendario(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

const COLUMNAS = [
  'columnas.origen',
  'columnas.descripcion',
  'columnas.tipo',
  'columnas.responsable',
  'columnas.area',
  'columnas.plazo',
  'columnas.estado',
  'columnas.verificadaPor',
  'columnas.estadoOriginal',
  'columnas.creadoEn',
  'columnas.ejecutadaEn',
  'columnas.fechaCierre',
] as const

export function buildAccionesCorrectivasRows(items: AccionCorrectivaListadoItem[], i18n: ACExportI18n): string[][] {
  const t = (k: string) => i18n.t(`accionesCorrectivas:${k}`)
  const encabezados = COLUMNAS.map((c) => t(c))
  const filas = items.map((ac) => [
    `${t(`origen.${ac.origenTipo}`)} ${ac.origenNumero}`,
    ac.descripcion,
    t(`tipo.${ac.tipo}`),
    ac.responsableNombre,
    ac.areaNombre ?? ac.areaId,
    formatFechaCalendario(ac.plazoFecha),
    t(`estado.${ac.estadoNormalizado}`),
    ac.estadoNormalizado === 'CERRADA' ? (ac.verificadaPorNombre ?? '') : '',
    t(`estadoOriginal.${ac.estadoOriginal}`),
    formatTimestampLima(ac.creadoEn),
    formatTimestampLima(ac.ejecutadaEn),
    formatTimestampLima(ac.fechaCierre),
  ])
  return [encabezados, ...filas]
}

export function buildAccionesCorrectivasWorkbook(items: AccionCorrectivaListadoItem[], i18n: ACExportI18n): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new()
  const hoja = XLSX.utils.aoa_to_sheet(buildAccionesCorrectivasRows(items, i18n))
  XLSX.utils.book_append_sheet(workbook, hoja, i18n.t('accionesCorrectivas:exportHoja').slice(0, 31))
  return workbook
}

function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** `acciones-correctivas-{empresa}-{yyyyMMdd}.xlsx`, con la fecha en hora de Lima. */
export function buildACExportFilename(empresa: string, ahora: Date = new Date()): string {
  return `acciones-correctivas-${slug(empresa) || 'empresa'}-${fechaLima(ahora).replace(/-/g, '')}.xlsx`
}

export function descargarAccionesCorrectivasXlsx(
  items: AccionCorrectivaListadoItem[],
  i18n: ACExportI18n,
  empresa: string,
): void {
  XLSX.writeFile(buildAccionesCorrectivasWorkbook(items, i18n), buildACExportFilename(empresa))
}
