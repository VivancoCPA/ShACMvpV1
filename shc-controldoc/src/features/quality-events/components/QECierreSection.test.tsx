import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useAuthStore } from '../../../stores/authStore'
import { QECierreSection } from './QECierreSection'
import type { QualityEvent } from '../types/qualityEvent.types'

// PinModal (firma de cierre de QE) used to have no feedback at all for a user without a
// configured PIN, and useFirmarCierre's generic onError toast didn't distinguish
// 'PIN_NO_CONFIGURADO' from any other failure — see pin-firma-ui/specs/quality-event-cierre.

// Con opciones, la clave se acompaña de sus valores interpolados para poder afirmar sobre ellos.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${Object.values(opts).join(' | ')}` : key,
    i18n: { language: 'es-PE' },
  }),
}))

const firmarCierreMock = vi.fn()
const cerrarQEMock = vi.fn()
const rechazarCierreMock = vi.fn()
vi.mock('../api/quality-events.api', () => ({
  firmarCierre: (...args: unknown[]) => firmarCierreMock(...args),
  cerrarQE: (...args: unknown[]) => cerrarQEMock(...args),
  rechazarCierre: (...args: unknown[]) => rechazarCierreMock(...args),
}))

vi.mock('../../areas/hooks/useAreas', () => ({
  useArea: () => ({ data: { id: 'area-001', nombre: 'Almacén Norte', activo: true, creadoEn: '' } }),
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

function setUser(
  tienePinFirma: boolean | undefined,
  rol: 'JEFE_CALIDAD_SYST' | 'SUPERVISOR' = 'JEFE_CALIDAD_SYST',
  id = 'user-jefe',
) {
  useAuthStore.setState({
    user: {
      id,
      nombre: 'Jefe',
      apellido: 'Calidad',
      email: 'jefe@shac.pe',
      rol,
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
    expect(screen.getByLabelText('detail.cierre.pinModal.placeholder')).toBeInTheDocument()
    expect(screen.queryByText('detail.cierre.pinModal.noPinConfigured')).not.toBeInTheDocument()
  })

  // pin-olvidado-pista: pista "¿Olvidaste tu PIN?" bajo el input.
  it('shows the forgot-PIN link to /perfil#pin-firma when the signer has a PIN', () => {
    setUser(true)
    renderSection(makeQE())

    fireEvent.click(screen.getByRole('button', { name: 'detail.cierre.firstSignature.button' }))

    expect(screen.getByRole('link', { name: 'detail.cierre.pinModal.forgotPinLink' })).toHaveAttribute(
      'href',
      '/perfil#pin-firma',
    )
  })

  it('points the setup link to /perfil#pin-firma and hides the forgot-PIN link without a PIN', () => {
    setUser(false)
    renderSection(makeQE())

    fireEvent.click(screen.getByRole('button', { name: 'detail.cierre.firstSignature.button' }))

    expect(screen.getByRole('link', { name: 'detail.cierre.pinModal.configurePinLink' })).toHaveAttribute(
      'href',
      '/perfil#pin-firma',
    )
    expect(screen.queryByRole('link', { name: 'detail.cierre.pinModal.forgotPinLink' })).not.toBeInTheDocument()
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

const SUPERVISORES = [
  { id: 'user-sup-a', nombreCompleto: 'Luis Soto' },
  { id: 'user-sup-b', nombreCompleto: 'Rosa Vega' },
]

const firmaJcaLegacy = {
  id: 'aud-1',
  entidadTipo: 'QualityEvent' as const,
  entidadId: 'qe-001',
  accion: 'FIRMA_REGISTRADA',
  campoModificado: 'cerradoPorId',
  valorNuevo: 'user-jefe',
  realizadoPorId: 'user-jefe',
  realizadoPorNombre: 'Ana Pérez',
  timestamp: '2026-03-02T15:00:00.000Z',
  generadoPorIA: false,
}

describe('QECierreSection — firmas, supervisores del área y rechazo (qe-cierre-firma-supervisor-area)', () => {
  afterEach(() => {
    cleanup()
    firmarCierreMock.mockReset()
    cerrarQEMock.mockReset()
    rechazarCierreMock.mockReset()
    useAuthStore.setState({ user: null })
  })

  it('shows both signatures pending before the JCA signs', () => {
    setUser(true)
    renderSection(makeQE())

    expect(screen.getByText('detail.cierre.firma1')).toBeInTheDocument()
    expect(screen.getByText('detail.cierre.pendiente')).toBeInTheDocument()
    expect(screen.getByText('detail.cierre.firma2 Almacén Norte')).toBeInTheDocument()
    expect(screen.getByText('detail.cierre.esperaJCA')).toBeInTheDocument()
  })

  it('shows the first signer name and date, also from a legacy FIRMA_REGISTRADA entry', () => {
    setUser(true)
    renderSection(makeQE({ cerradoPorId: 'user-jefe', cerradoPorNombre: 'Ana Pérez', auditTrail: [firmaJcaLegacy] }))

    // Solo la parte de fecha: la hora formateada trae espacios Unicode que el matcher normaliza distinto.
    const fecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(new Date(firmaJcaLegacy.timestamp))
    expect(screen.getByText(/detail\.cierre\.firmaHecha Ana Pérez \|/).textContent).toContain(fecha)
  })

  it('lists who can sign and that they were notified when the second signature is pending', () => {
    setUser(true)
    renderSection(makeQE({ cerradoPorId: 'user-jefe', cerradoPorNombre: 'Ana Pérez', supervisoresArea: SUPERVISORES }))

    expect(screen.getByText('detail.cierre.puedenFirmar Luis Soto, Rosa Vega')).toBeInTheDocument()
    expect(screen.getByText('detail.cierre.avisoEnviado')).toBeInTheDocument()
  })

  it('shows sign and reject buttons to a supervisor of the area', () => {
    setUser(true, 'SUPERVISOR', 'user-sup-a')
    renderSection(makeQE({ cerradoPorId: 'user-jefe', supervisoresArea: SUPERVISORES }))

    expect(screen.getByRole('button', { name: 'detail.cierre.secondSignature.button' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'detail.cierre.rechazar' })).toBeInTheDocument()
  })

  it('shows only the message to a supervisor of another area', () => {
    setUser(true, 'SUPERVISOR', 'user-sup-otra-area')
    renderSection(makeQE({ cerradoPorId: 'user-jefe', supervisoresArea: SUPERVISORES }))

    expect(screen.getByText('detail.cierre.noEsDelArea Almacén Norte')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'detail.cierre.secondSignature.button' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'detail.cierre.rechazar' })).not.toBeInTheDocument()
  })

  it('requires at least 20 characters to reject and then calls the endpoint', async () => {
    setUser(true, 'SUPERVISOR', 'user-sup-a')
    rechazarCierreMock.mockResolvedValueOnce(makeQE({ estado: 'EN_EJECUCION' }))
    renderSection(makeQE({ cerradoPorId: 'user-jefe', supervisoresArea: SUPERVISORES }))

    fireEvent.click(screen.getByRole('button', { name: 'detail.cierre.rechazar' }))
    const dialog = within(screen.getByRole('dialog'))
    const textarea = dialog.getByLabelText('detail.cierre.motivoRechazo')
    fireEvent.change(textarea, { target: { value: 'Muy corto' } })
    fireEvent.click(dialog.getByRole('button', { name: 'detail.cierre.rechazar' }))

    await waitFor(() => expect(screen.getByText('detail.cierre.motivoRechazoMin')).toBeInTheDocument())
    expect(rechazarCierreMock).not.toHaveBeenCalled()

    fireEvent.change(textarea, { target: { value: 'Falta evidencia fotográfica de la AC 2' } })
    fireEvent.click(dialog.getByRole('button', { name: 'detail.cierre.rechazar' }))

    await waitFor(() =>
      expect(rechazarCierreMock).toHaveBeenCalledWith('qe-001', 'Falta evidencia fotográfica de la AC 2'),
    )
  })

  it('shows the amber rejection notice in EN_EJECUCION after a rejection', () => {
    setUser(true)
    renderSection(
      makeQE({
        estado: 'EN_EJECUCION',
        auditTrail: [
          {
            ...firmaJcaLegacy,
            id: 'aud-2',
            accion: 'CIERRE_RECHAZADO',
            campoModificado: undefined,
            estadoAnterior: 'PENDIENTE_CIERRE',
            estadoNuevo: 'EN_EJECUCION',
            valorNuevo: 'Falta evidencia fotográfica de la AC 2',
            realizadoPorNombre: 'Luis Soto',
          },
        ],
      }),
    )

    expect(screen.getByRole('status')).toHaveTextContent('detail.cierre.rechazadoAviso Luis Soto')
    expect(screen.getByRole('status')).toHaveTextContent('Falta evidencia fotográfica de la AC 2')
  })

  it('renders nothing in EN_EJECUCION without a rejection', () => {
    setUser(true)
    const { container } = renderSection(makeQE({ estado: 'EN_EJECUCION' }))

    expect(container).toBeEmptyDOMElement()
  })

  it('shows AREA_SIN_SUPERVISOR inline with a link to Usuarios for the JCA', async () => {
    setUser(true)
    cerrarQEMock.mockRejectedValueOnce(
      makeAxiosError(422, { success: false, message: 'AREA_SIN_SUPERVISOR: ...', errorCode: 'AREA_SIN_SUPERVISOR' }),
    )
    renderSection(makeQE({ resultadoCierre: undefined }))

    fireEvent.change(screen.getByLabelText('detail.cierre.form.resultadoCierre'), {
      target: { value: 'A'.repeat(120) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'detail.cierre.form.submit' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('errors.AREA_SIN_SUPERVISOR Almacén Norte'),
    )
    expect(screen.getByRole('link', { name: 'detail.cierre.irAUsuarios' })).toHaveAttribute('href', '/usuarios')
  })
})
