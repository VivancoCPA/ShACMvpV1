import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { QEHeaderSection } from './QEHeaderSection'
import type { QualityEvent } from '../types/qualityEvent.types'
import type { User } from '../../../types/auth.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es-PE' } }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('../../areas/hooks/useAreas', () => ({
  useArea: () => ({ data: { id: 'area-001', nombre: 'Almacén Norte' } }),
}))

vi.mock('../../../mocks/fixtures/userIdentity.fixtures', () => ({
  resolveUserDisplayName: () => 'Ricardo Flores',
}))

let currentUser: User | null = null
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: User | null }) => unknown) => selector({ user: currentUser }),
}))

const exportMutate = vi.fn()
let exportIsPending = false
vi.mock('../hooks/useExportQualityEventPdf', () => ({
  useExportQualityEventPdf: () => ({ mutate: exportMutate, isPending: exportIsPending }),
}))

const buildQualityEventPdfMock = vi.fn(() => ({ output: () => new Blob() }))
vi.mock('../export/buildQualityEventPdf', () => ({
  buildQualityEventPdf: (...args: unknown[]) => buildQualityEventPdfMock(...args),
}))

const downloadBlobMock = vi.fn()
vi.mock('../../../utils/downloadBlob', () => ({
  downloadBlob: (...args: unknown[]) => downloadBlobMock(...args),
}))

function makeUser(overrides: Partial<User>): User {
  return {
    id: 'user-jc-001',
    nombre: 'Ana',
    apellido: 'Torres',
    email: 'ana@shac.internal',
    rol: 'JEFE_CALIDAD_SYST',
    createdAt: '2026-01-01T00:00:00Z',
    activo: true,
    ...overrides,
  }
}

function makeQE(overrides: Partial<QualityEvent>): QualityEvent {
  return {
    id: 'qe-2026-010',
    numero: 'QE-2026-010',
    origen: 'O1_INCIDENTE_CAMPO',
    tipo: 'SST',
    severidad: 'ALTA',
    estado: 'ABIERTO',
    ciclo: 1,
    descripcion: 'Descripción del evento',
    areaId: 'area-001',
    turno: 'DIA',
    fechaHoraEvento: '2026-06-01T07:00:00Z',
    fechaHoraReporte: '2026-06-01T08:00:00Z',
    reportadoPorId: 'user-001',
    documentosVinculados: [],
    requiereEvaluacionRiesgos: false,
    solicitudesAC: 0,
    accionesCorrectivas: [],
    auditTrail: [],
    creadoEn: '2026-06-01T08:00:00Z',
    actualizadoEn: '2026-06-01T08:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  exportMutate.mockReset()
  exportIsPending = false
  buildQualityEventPdfMock.mockClear()
  downloadBlobMock.mockClear()
})

describe('QEHeaderSection — export PDF button', () => {
  it('renders the export button for an authorized role and triggers the mutation before generating the PDF', () => {
    currentUser = makeUser({ rol: 'JEFE_CALIDAD_SYST' })
    const qe = makeQE({})
    render(<QEHeaderSection qe={qe} />)

    const button = screen.getByText('detail.header.exportarPDF').closest('button')
    expect(button).not.toBeNull()
    fireEvent.click(button!)

    expect(exportMutate).toHaveBeenCalledTimes(1)
  })

  it('generates the PDF and downloads it once the mutation succeeds', () => {
    currentUser = makeUser({ rol: 'JEFE_CALIDAD_SYST' })
    const qe = makeQE({})
    const updatedQe = { ...qe, auditTrail: [{ id: 'a1' } as never] }
    exportMutate.mockImplementation((_vars, opts) => {
      opts.onSuccess(updatedQe)
    })

    render(<QEHeaderSection qe={qe} />)
    const button = screen.getByText('detail.header.exportarPDF').closest('button')
    fireEvent.click(button!)

    expect(buildQualityEventPdfMock).toHaveBeenCalledWith(
      updatedQe,
      expect.objectContaining({ exportadoPorNombre: 'Ana Torres' }),
    )
    expect(downloadBlobMock).toHaveBeenCalledWith(expect.anything(), 'QE-2026-010.pdf')
  })

  it('does not render the export button for OPERARIO', () => {
    currentUser = makeUser({ id: 'user-op-001', rol: 'OPERARIO' })
    const qe = makeQE({})
    render(<QEHeaderSection qe={qe} />)
    expect(screen.queryByText('detail.header.exportarPDF')).not.toBeInTheDocument()
  })

  it('does not render the export button for JEFE_CONTROL_DOCUMENTARIO', () => {
    currentUser = makeUser({ id: 'user-jcd-001', rol: 'JEFE_CONTROL_DOCUMENTARIO' })
    const qe = makeQE({})
    render(<QEHeaderSection qe={qe} />)
    expect(screen.queryByText('detail.header.exportarPDF')).not.toBeInTheDocument()
  })
})
