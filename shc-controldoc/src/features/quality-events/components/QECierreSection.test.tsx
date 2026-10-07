import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useAuthStore } from '../../../stores/authStore'
import { QECierreSection } from './QECierreSection'
import type { QualityEvent } from '../types/qualityEvent.types'

// PinModal (firma de cierre de QE) used to have no feedback at all for a user without a
// configured PIN, and useFirmarCierre's generic onError toast didn't distinguish
// 'PIN_NO_CONFIGURADO' from any other failure — see pin-firma-ui/specs/quality-event-cierre.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE' },
  }),
}))

const firmarCierreMock = vi.fn()
vi.mock('../api/quality-events.api', () => ({
  firmarCierre: (...args: unknown[]) => firmarCierreMock(...args),
  cerrarQE: vi.fn(),
}))

function makeQE(overrides: Partial<QualityEvent> = {}): QualityEvent {
  return {
    id: 'qe-001',
    numero: 'QE-2026-001',
    origen: 'O1_INCIDENTE_CAMPO',
    tipo: 'CALIDAD',
    severidad: 'MEDIA',
    estado: 'PENDIENTE_CIERRE',
    ciclo: 1,
    descripcion: 'Evento de prueba',
    areaId: 'area-001',
    empresaId: 'empresa-001',
    turno: 'DIA',
    fechaHoraEvento: '2026-01-01T08:00:00.000Z',
    fechaHoraReporte: '2026-01-01T08:00:00.000Z',
    reportadoPorId: 'user-reportante',
    documentosVinculados: [],
    requiereEvaluacionRiesgos: false,
    solicitudesAC: 0,
    accionesCorrectivas: [],
    auditTrail: [],
    creadoEn: '2026-01-01T08:00:00.000Z',
    actualizadoEn: '2026-01-01T08:00:00.000Z',
    resultadoCierre: 'Causa raíz corregida.',
    ...overrides,
  }
}

function setUser(tienePinFirma: boolean | undefined) {
  useAuthStore.setState({
    user: {
      id: 'user-jefe',
      nombre: 'Jefe',
      apellido: 'Calidad',
      email: 'jefe@shac.pe',
      rol: 'JEFE_CALIDAD_SYST',
      createdAt: '2026-01-01T00:00:00.000Z',
      activo: true,
      tienePinFirma,
    },
  })
}

function renderSection(qe: QualityEvent) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <QECierreSection qe={qe} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function makeAxiosError(status: number, data: Record<string, unknown>) {
  return new AxiosError('Request failed', undefined, undefined, undefined, {
    status,
    data,
    statusText: '',
    headers: {},
    config: {} as never,
  })
}

describe('QECierreSection — PinModal de firma', () => {
  afterEach(() => {
    cleanup()
    firmarCierreMock.mockReset()
    useAuthStore.setState({ user: null })
  })

  it('shows a setup notice instead of the PIN field when the signer has no PIN configured', () => {
    setUser(false)
    renderSection(makeQE())

    fireEvent.click(screen.getByRole('button', { name: 'detail.cierre.firstSignature.button' }))

    expect(screen.getByText('detail.cierre.pinModal.noPinConfigured')).toBeInTheDocument()
    expect(screen.queryByLabelText('detail.cierre.pinModal.placeholder')).not.toBeInTheDocument()
    expect(screen.queryByText('detail.cierre.pinModal.confirm')).not.toBeInTheDocument()
  })

  it('switches to the same notice when the backend reports PIN_NO_CONFIGURADO mid-session', async () => {
    setUser(true)
    firmarCierreMock.mockRejectedValueOnce(
      makeAxiosError(422, { success: false, message: 'PIN_NO_CONFIGURADO: ...', errorCode: 'PIN_NO_CONFIGURADO' }),
    )
    renderSection(makeQE())

    fireEvent.click(screen.getByRole('button', { name: 'detail.cierre.firstSignature.button' }))
    fireEvent.change(screen.getByLabelText('detail.cierre.pinModal.placeholder'), { target: { value: '1234' } })
    fireEvent.click(screen.getByText('detail.cierre.pinModal.confirm'))

    await waitFor(() => expect(screen.getByText('detail.cierre.pinModal.noPinConfigured')).toBeInTheDocument())
  })

  it('keeps the modal open with an inline-handled 401 for an incorrect PIN', async () => {
    setUser(true)
    firmarCierreMock.mockRejectedValueOnce(makeAxiosError(401, { success: false, message: 'PIN incorrecto' }))
    renderSection(makeQE())

    fireEvent.click(screen.getByRole('button', { name: 'detail.cierre.firstSignature.button' }))
    fireEvent.change(screen.getByLabelText('detail.cierre.pinModal.placeholder'), { target: { value: '9999' } })
    fireEvent.click(screen.getByText('detail.cierre.pinModal.confirm'))

    await waitFor(() => expect(firmarCierreMock).toHaveBeenCalled())
    expect(screen.getByText('detail.cierre.pinModal.placeholder')).toBeInTheDocument
    expect(screen.queryByText('detail.cierre.pinModal.noPinConfigured')).not.toBeInTheDocument()
  })

  it('registers the first signature on a valid PIN', async () => {
    setUser(true)
    firmarCierreMock.mockResolvedValueOnce(makeQE({ cerradoPorId: 'user-jefe' }))
    renderSection(makeQE())

    fireEvent.click(screen.getByRole('button', { name: 'detail.cierre.firstSignature.button' }))
    fireEvent.change(screen.getByLabelText('detail.cierre.pinModal.placeholder'), { target: { value: '1234' } })
    fireEvent.click(screen.getByText('detail.cierre.pinModal.confirm'))

    await waitFor(() =>
      expect(firmarCierreMock).toHaveBeenCalledWith('qe-001', { rol: 'JEFE_CALIDAD_SYST', pin: '1234' }),
    )
  })
})
