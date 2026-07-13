import { describe, expect, it } from 'vitest'
import { buildExportFilename } from './buildExportFilename'

describe('buildExportFilename', () => {
  it('genera el nombre para Excel de Jefe de Calidad con el slug y timestamp esperados', () => {
    const now = new Date(2026, 6, 12, 14, 30)
    expect(buildExportFilename('JEFE_CALIDAD_SYST', 'xlsx', now)).toBe(
      'SHAC-Informe-Ejecutivo-jefe-calidad-20260712-1430.xlsx',
    )
  })

  it('genera el nombre para PDF de Alta Dirección con el slug y timestamp esperados', () => {
    const now = new Date(2026, 6, 12, 9, 5)
    expect(buildExportFilename('ALTA_DIRECCION', 'pdf', now)).toBe(
      'SHAC-Informe-Ejecutivo-alta-direccion-20260712-0905.pdf',
    )
  })

  it('rellena con ceros mes, día, hora y minuto de un solo dígito', () => {
    const now = new Date(2026, 0, 1, 0, 1)
    expect(buildExportFilename('JEFE_CALIDAD_SYST', 'xlsx', now)).toBe(
      'SHAC-Informe-Ejecutivo-jefe-calidad-20260101-0001.xlsx',
    )
  })
})
