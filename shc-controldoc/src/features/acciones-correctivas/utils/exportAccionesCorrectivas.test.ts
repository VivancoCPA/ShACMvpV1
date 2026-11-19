import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import i18n from '../../../i18n'
import {
  buildACExportFilename,
  buildAccionesCorrectivasWorkbook,
  formatFechaCalendario,
  formatTimestampLima,
} from './exportAccionesCorrectivas'
import type { AccionCorrectivaListadoItem } from '../types/accionesCorrectivasListado.types'

const ac: AccionCorrectivaListadoItem = {
  id: 'ac-1',
  origenTipo: 'QE',
  origenId: 'qe-1',
  origenNumero: 'QE-2026-001',
  titulo: 'Título',
  descripcion: 'Recalibrar balanza',
  tipo: 'PREVENTIVA',
  prioridad: 'MEDIA',
  responsableId: 'u-1',
  responsableNombre: 'Ana Pérez',
  areaId: 'area-001',
  areaNombre: 'Almacén',
  plazoFecha: '2026-11-20T00:00:00Z',
  estadoNormalizado: 'CERRADA',
  estadoOriginal: 'CERRADA',
  ejecutadaEn: '2026-11-10T15:00:00Z',
  verificadaEn: '2026-11-12T03:30:00Z',
  verificadaPorNombre: 'Juan Mendoza',
  creadoEn: '2026-11-03T02:00:00Z',
  fechaCierre: '2026-11-12T03:30:00Z',
  vencida: false,
  diasHabilesRestantes: 0,
}

describe('exportAccionesCorrectivas', () => {
  it('fechas: timestamps en hora de Lima y plazo como fecha de calendario sin corrimiento', () => {
    // 03/11 02:00 UTC = 02/11 21:00 en Lima.
    expect(formatTimestampLima('2026-11-03T02:00:00Z')).toBe('02/11/2026')
    // Medianoche UTC del 20/11: convertida a Lima sería el 19/11 — no debe correrse.
    expect(formatFechaCalendario('2026-11-20T00:00:00Z')).toBe('20/11/2026')
    expect(formatFechaCalendario('2026-11-20')).toBe('20/11/2026')
    expect(formatTimestampLima(null)).toBe('')
  })

  it('arma la hoja "Acciones correctivas" con encabezados y una fila por AC', async () => {
    await i18n.changeLanguage('es-PE')
    const wb = buildAccionesCorrectivasWorkbook([ac], i18n)
    expect(wb.SheetNames).toEqual(['Acciones correctivas'])
    const filas = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Acciones correctivas'], { header: 1 })
    expect(filas[0]).toEqual([
      'Origen',
      'Descripción',
      'Tipo',
      'Responsable',
      'Área',
      'Plazo',
      'Estado',
      'Verificada por',
      'Estado original',
      'Fecha de creación',
      'Fecha de ejecución',
      'Fecha de cierre',
    ])
    expect(filas[1]).toEqual([
      'QE QE-2026-001',
      'Recalibrar balanza',
      'Preventiva',
      'Ana Pérez',
      'Almacén',
      '20/11/2026',
      'Cerrada',
      'Juan Mendoza',
      'Cerrada',
      '02/11/2026',
      '10/11/2026',
      '11/11/2026',
    ])
  })

  it('nombre de archivo con slug de empresa y fecha de Lima', () => {
    expect(buildACExportFilename('Almacenes Andinos S.A.C.', new Date('2026-12-01T03:00:00Z'))).toBe(
      'acciones-correctivas-almacenes-andinos-s-a-c-20261130.xlsx',
    )
  })
})
