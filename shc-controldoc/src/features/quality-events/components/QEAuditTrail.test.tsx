import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QEAuditTrail } from './QEAuditTrail'
import type { QEAuditTrailEntry } from '../types/qualityEvent.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE' },
  }),
}))

let mockEntries: QEAuditTrailEntry[] = []
vi.mock('../hooks/useQEAuditTrail', () => ({
  useQEAuditTrail: () => ({ data: mockEntries, isLoading: false }),
}))

function makeEntry(overrides: Partial<QEAuditTrailEntry>): QEAuditTrailEntry {
  return {
    id: 'aud-1',
    entidadTipo: 'QualityEvent',
    entidadId: 'qe-2026-001',
    accion: 'CREADO',
    realizadoPorId: 'user-001',
    realizadoPorNombre: 'Ricardo Flores',
    timestamp: '2026-06-01T08:00:00Z',
    generadoPorIA: false,
    ...overrides,
  }
}

describe('QEAuditTrail — RN-QE-010/011/012 edit entries', () => {
  it('shows the field diff for QE_REPORTE_INICIAL_EDITADO', () => {
    mockEntries = [
      makeEntry({
        accion: 'QE_REPORTE_INICIAL_EDITADO',
        campoModificado: 'areaAfectada',
        valorAnterior: 'Almacén Norte',
        valorNuevo: 'Almacén Sur',
      }),
    ]
    render(<QEAuditTrail qeId="qe-2026-001" />)
    expect(screen.getByText(/Almacén Norte/)).toBeInTheDocument()
    expect(screen.getByText(/Almacén Sur/)).toBeInTheDocument()
  })

  it('shows the severity diff for QE_SEVERIDAD_EDITADA', () => {
    mockEntries = [
      makeEntry({ accion: 'QE_SEVERIDAD_EDITADA', valorAnterior: 'MEDIA', valorNuevo: 'CRITICA' }),
    ]
    render(<QEAuditTrail qeId="qe-2026-001" />)
    expect(screen.getByText(/MEDIA/)).toBeInTheDocument()
    expect(screen.getByText(/CRITICA/)).toBeInTheDocument()
  })

  it('shows the mineral diff for QE_MINERAL_EDITADO', () => {
    mockEntries = [
      makeEntry({ accion: 'QE_MINERAL_EDITADO', valorAnterior: 'Cobre', valorNuevo: 'Zinc' }),
    ]
    render(<QEAuditTrail qeId="qe-2026-001" />)
    expect(screen.getByText(/Cobre/)).toBeInTheDocument()
    expect(screen.getByText(/Zinc/)).toBeInTheDocument()
  })

  it('renders a distinct icon for each of the three edit accion types', () => {
    mockEntries = [
      makeEntry({ id: 'a1', accion: 'QE_REPORTE_INICIAL_EDITADO', campoModificado: 'descripcion', valorAnterior: 'x', valorNuevo: 'y' }),
      makeEntry({ id: 'a2', accion: 'QE_SEVERIDAD_EDITADA', valorAnterior: 'MEDIA', valorNuevo: 'ALTA' }),
      makeEntry({ id: 'a3', accion: 'QE_MINERAL_EDITADO', valorAnterior: 'Cobre', valorNuevo: 'Zinc' }),
    ]
    const { container } = render(<QEAuditTrail qeId="qe-2026-001" />)
    const svgClasses = Array.from(container.querySelectorAll('li svg')).map((el) => el.getAttribute('class'))
    expect(new Set(svgClasses).size).toBe(3)
  })
})
