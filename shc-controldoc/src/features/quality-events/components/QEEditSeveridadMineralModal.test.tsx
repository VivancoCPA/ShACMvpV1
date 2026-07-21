import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QEEditSeveridadMineralModal } from './QEEditSeveridadMineralModal'
import type { QualityEvent } from '../types/qualityEvent.types'
import type { QEEditAccess } from '../types/qualityEventPermissions.types'

beforeEach(() => vi.clearAllMocks())
afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE' },
  }),
}))

const toastError = vi.fn()
const toastSuccess = vi.fn()
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args), success: (...args: unknown[]) => toastSuccess(...args) },
}))

const severidadMutate = vi.fn((_vars: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
vi.mock('../hooks/useEditarSeveridad', () => ({
  useEditarSeveridad: () => ({ mutate: severidadMutate, isPending: false }),
}))

const mineralMutate = vi.fn((_vars: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
vi.mock('../hooks/useEditarMineral', () => ({
  useEditarMineral: () => ({ mutate: mineralMutate, isPending: false }),
}))

const baseQE: QualityEvent = {
  id: 'qe-2026-200',
  numero: 'QE-2026-200',
  origen: 'O2_NC_DETECTADA',
  tipo: 'CALIDAD',
  severidad: 'ALTA',
  estado: 'EN_INVESTIGACION',
  ciclo: 1,
  descripcion: 'Descripción del evento',
  areaId: 'area-001',
  turno: 'DIA',
  fechaHoraEvento: '2026-06-01T08:00:00Z',
  fechaHoraReporte: '2026-06-01T08:30:00Z',
  reportadoPorId: 'user-001',
  mineralInvolucrado: 'Cobre',
  documentosVinculados: [],
  requiereEvaluacionRiesgos: false,
  solicitudesAC: 0,
  accionesCorrectivas: [],
  auditTrail: [],
  creadoEn: '2026-06-01T08:30:00Z',
  actualizadoEn: '2026-06-01T08:30:00Z',
}

const onClose = vi.fn()

describe('QEEditSeveridadMineralModal', () => {
  it('renders only severidad when access.mineral is false', () => {
    const access: QEEditAccess = { reporteInicial: false, severidad: true, mineral: false }
    render(<QEEditSeveridadMineralModal qe={baseQE} access={access} onClose={onClose} />)
    expect(screen.getByLabelText('editSeveridadMineralModal.fields.severidad')).toBeInTheDocument()
    expect(screen.queryByLabelText('editSeveridadMineralModal.fields.mineralInvolucrado')).not.toBeInTheDocument()
  })

  it('renders only mineral when access.severidad is false', () => {
    const access: QEEditAccess = { reporteInicial: false, severidad: false, mineral: true }
    render(<QEEditSeveridadMineralModal qe={{ ...baseQE, tipo: 'OPERACIONAL' }} access={access} onClose={onClose} />)
    expect(screen.getByLabelText('editSeveridadMineralModal.fields.mineralInvolucrado')).toBeInTheDocument()
    expect(screen.queryByLabelText('editSeveridadMineralModal.fields.severidad')).not.toBeInTheDocument()
  })

  it('renders both fields when both flags are true', () => {
    const access: QEEditAccess = { reporteInicial: false, severidad: true, mineral: true }
    render(<QEEditSeveridadMineralModal qe={baseQE} access={access} onClose={onClose} />)
    expect(screen.getByLabelText('editSeveridadMineralModal.fields.severidad')).toBeInTheDocument()
    expect(screen.getByLabelText('editSeveridadMineralModal.fields.mineralInvolucrado')).toBeInTheDocument()
  })

  it('never renders reporte-inicial fields', () => {
    const access: QEEditAccess = { reporteInicial: false, severidad: true, mineral: true }
    render(<QEEditSeveridadMineralModal qe={baseQE} access={access} onClose={onClose} />)
    expect(screen.queryByLabelText(/descripcion/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/areaAfectada/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/turno/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/fechaHoraEvento/i)).not.toBeInTheDocument()
  })

  it('disables submit when nothing changed', () => {
    const access: QEEditAccess = { reporteInicial: false, severidad: true, mineral: true }
    render(<QEEditSeveridadMineralModal qe={baseQE} access={access} onClose={onClose} />)
    expect(screen.getByRole('button', { name: 'editSeveridadMineralModal.actions.submit' })).toBeDisabled()
  })

  it('triggers only useEditarSeveridad when only severidad changed', async () => {
    const access: QEEditAccess = { reporteInicial: false, severidad: true, mineral: true }
    render(<QEEditSeveridadMineralModal qe={baseQE} access={access} onClose={onClose} />)

    await userEvent.selectOptions(screen.getByLabelText('editSeveridadMineralModal.fields.severidad'), 'CRITICA')
    await userEvent.click(screen.getByRole('button', { name: 'editSeveridadMineralModal.actions.submit' }))

    expect(severidadMutate).toHaveBeenCalledTimes(1)
    expect(mineralMutate).not.toHaveBeenCalled()
  })

  it('triggers both mutations in order when both fields changed', async () => {
    const callOrder: string[] = []
    severidadMutate.mockImplementationOnce((_vars, opts) => {
      callOrder.push('severidad')
      opts?.onSuccess?.()
    })
    mineralMutate.mockImplementationOnce((_vars, opts) => {
      callOrder.push('mineral')
      opts?.onSuccess?.()
    })

    const access: QEEditAccess = { reporteInicial: false, severidad: true, mineral: true }
    render(<QEEditSeveridadMineralModal qe={baseQE} access={access} onClose={onClose} />)

    await userEvent.selectOptions(screen.getByLabelText('editSeveridadMineralModal.fields.severidad'), 'CRITICA')
    await userEvent.selectOptions(screen.getByLabelText('editSeveridadMineralModal.fields.mineralInvolucrado'), 'Zinc')
    await userEvent.click(screen.getByRole('button', { name: 'editSeveridadMineralModal.actions.submit' }))

    expect(callOrder).toEqual(['severidad', 'mineral'])
  })

  it('shows the CRITICA banner when changing severidad to CRITICA', async () => {
    const access: QEEditAccess = { reporteInicial: false, severidad: true, mineral: false }
    render(<QEEditSeveridadMineralModal qe={baseQE} access={access} onClose={onClose} />)
    expect(screen.queryByText('editSeveridadMineralModal.criticaBanner')).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('editSeveridadMineralModal.fields.severidad'), 'CRITICA')
    expect(screen.getByText('editSeveridadMineralModal.criticaBanner')).toBeInTheDocument()
  })

  it('does not show the banner when severidad is already CRITICA and unchanged', () => {
    const access: QEEditAccess = { reporteInicial: false, severidad: true, mineral: false }
    render(<QEEditSeveridadMineralModal qe={{ ...baseQE, severidad: 'CRITICA' }} access={access} onClose={onClose} />)
    expect(screen.queryByText('editSeveridadMineralModal.criticaBanner')).not.toBeInTheDocument()
  })

  it('cancel closes without mutating', async () => {
    const access: QEEditAccess = { reporteInicial: false, severidad: true, mineral: false }
    render(<QEEditSeveridadMineralModal qe={baseQE} access={access} onClose={onClose} />)

    await userEvent.selectOptions(screen.getByLabelText('editSeveridadMineralModal.fields.severidad'), 'CRITICA')
    await userEvent.click(screen.getByRole('button', { name: 'editSeveridadMineralModal.actions.cancel' }))

    expect(severidadMutate).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
