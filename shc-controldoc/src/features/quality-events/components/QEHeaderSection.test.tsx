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

let getNameMock = (_id?: string | null) => 'Ricardo Flores'
vi.mock('../../users/hooks/useUserNames', () => ({
  useUserNames: () => ({ getName: (id?: string | null) => getNameMock(id), isLoading: false }),
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

const buildQualityEventPdfMock = vi.fn((..._args: unknown[]) => ({ output: () => new Blob() }))
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
    empresaId: 'empresa-001',
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
  getNameMock = () => 'Ricardo Flores'
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

  it('generates the PDF from the qe prop (not the mutation result) once the mutation succeeds', () => {
    // El backend real responde 204 sin cuerpo a export-pdf (solo registra auditoría) — la
    // mutación ya no devuelve un QE, así que el PDF se arma con el prop `qe` (ver design.md
    // Hallazgo 6, cutover-quality-events).
    currentUser = makeUser({ rol: 'JEFE_CALIDAD_SYST' })
    const qe = makeQE({})
    exportMutate.mockImplementation((_vars, opts) => {
      opts.onSuccess()
    })

    render(<QEHeaderSection qe={qe} />)
    const button = screen.getByText('detail.header.exportarPDF').closest('button')
    fireEvent.click(button!)

    expect(buildQualityEventPdfMock).toHaveBeenCalledWith(
      qe,
      expect.objectContaining({ exportadoPorNombre: 'Ana Torres', reportadoPorNombre: 'Ricardo Flores' }),
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

describe('QEHeaderSection — reportadoPor muestra el nombre resuelto (nombres-usuarios-reales)', () => {
  it('muestra el nombre resuelto por useUserNames, no el id crudo', () => {
    getNameMock = () => 'Ricardo Flores'
    currentUser = makeUser({ rol: 'JEFE_CALIDAD_SYST' })
    const qe = makeQE({ reportadoPorId: 'user-reportante-001' })
    render(<QEHeaderSection qe={qe} />)

    expect(screen.getByText('Ricardo Flores')).toBeInTheDocument()
    expect(screen.queryByText('user-reportante-001')).not.toBeInTheDocument()
  })

  it('muestra el texto genérico cuando el id no se resuelve', () => {
    getNameMock = () => 'common:userNames.noDisponible'
    currentUser = makeUser({ rol: 'JEFE_CALIDAD_SYST' })
    const qe = makeQE({ reportadoPorId: 'user-desconocido' })
    render(<QEHeaderSection qe={qe} />)

    expect(screen.getByText('common:userNames.noDisponible')).toBeInTheDocument()
    expect(screen.queryByText('user-desconocido')).not.toBeInTheDocument()
  })
})
