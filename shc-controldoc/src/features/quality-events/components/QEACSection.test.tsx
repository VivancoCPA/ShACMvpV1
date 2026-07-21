import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QEACSection } from './QEACSection'
import { useAuthStore } from '../../../stores/authStore'
import type { AccionCorrectivaQE } from '../types/qualityEvent.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
    i18n: { language: 'es-PE' },
  }),
}))

const toastInfo = vi.fn()
vi.mock('sonner', () => ({
  toast: { info: (...args: unknown[]) => toastInfo(...args), success: vi.fn(), error: vi.fn() },
}))

const cerrarMutate = vi.fn()
const iniciarMutate = vi.fn()
const createMutateAsync = vi.fn()

vi.mock('../hooks/useCreateQEAccion', () => ({
  useCreateQEAccion: () => ({ mutateAsync: createMutateAsync, isPending: false }),
}))

vi.mock('../hooks/useUpdateQEAccion', () => ({
  useUpdateQEAccion: () => ({ mutate: iniciarMutate, isPending: false }),
}))

vi.mock('../hooks/useCerrarQEAccion', () => ({
  useCerrarQEAccion: () => ({ mutate: cerrarMutate, isPending: false }),
}))

vi.mock('../../nonconformities/hooks/useUsers', () => ({
  useUsers: () => ({ data: [] }),
}))

vi.mock('../hooks/useSolicitarAjustePlazoAC', () => ({
  useSolicitarAjustePlazoAC: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../hooks/useRevisarAjustePlazoAC', () => ({
  useRevisarAjustePlazoAC: () => ({ mutate: vi.fn(), isPending: false }),
}))

const enEjecucionAC: AccionCorrectivaQE = {
  id: 'ac-1',
  qeId: 'qe-2026-001',
  titulo: 'Reforzar EPP',
  descripcion: 'Reforzar el uso de EPP en almacén',
  responsableId: 'user-003',
  responsableNombre: 'María Castro',
  plazoFecha: '2026-08-01',
  estado: 'EN_EJECUCION',
  creadoEn: '2026-01-01T00:00:00Z',
  actualizadoEn: '2026-01-01T00:00:00Z',
  solicitudesAjustePlazo: [],
}

describe('QEACSection — cierre con evidencia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: {
        id: 'user-005',
        nombre: 'Luis',
        apellido: 'Paredes',
        email: 'luis@shac.internal',
        rol: 'JEFE_CALIDAD_SYST',
      },
      isAuthenticated: true,
      accessToken: 'token',
    })
  })

  it('blocks submission and does not call the mutation when descripcionEvidencia is empty', async () => {
    render(
      <QEACSection
        qeId="qe-2026-001"
        qeEstado="EN_EJECUCION" qeSeveridad="MEDIA"
        accionesCorrectivas={[enEjecucionAC]}
        solicitudesAC={0}
      />,
    )

    fireEvent.click(screen.getByText('detail.acSection.actions.cerrar'))

    const submitButton = screen.getByText('detail.acSection.actions.cerrarModal')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getAllByText(/obligatoria/i).length).toBeGreaterThan(0)
    })
    expect(cerrarMutate).not.toHaveBeenCalled()
  })

  it('calls the mutation once descripcionEvidencia is provided', async () => {
    render(
      <QEACSection
        qeId="qe-2026-001"
        qeEstado="EN_EJECUCION" qeSeveridad="MEDIA"
        accionesCorrectivas={[enEjecucionAC]}
        solicitudesAC={0}
      />,
    )

    fireEvent.click(screen.getByText('detail.acSection.actions.cerrar'))

    const textarea = screen.getByPlaceholderText('detail.acSection.placeholders.evidencia')
    fireEvent.change(textarea, { target: { value: 'Evidencia adjunta con fotos.' } })

    fireEvent.click(screen.getByText('detail.acSection.actions.cerrarModal'))

    await waitFor(() => {
      expect(cerrarMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          acId: 'ac-1',
          data: expect.objectContaining({ descripcionEvidencia: 'Evidencia adjunta con fotos.' }),
        }),
        expect.anything(),
      )
    })
  })
})

describe('QEACSection — notificación de transición automática a PENDIENTE_CIERRE', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a toast.info for JEFE_CALIDAD_SYST when qeEstado transitions EN_EJECUCION → PENDIENTE_CIERRE', () => {
    useAuthStore.setState({
      user: {
        id: 'user-005',
        nombre: 'Luis',
        apellido: 'Paredes',
        email: 'luis@shac.internal',
        rol: 'JEFE_CALIDAD_SYST',
      },
      isAuthenticated: true,
      accessToken: 'token',
    })

    const { rerender } = render(
      <QEACSection qeId="qe-2026-001" qeEstado="EN_EJECUCION" qeSeveridad="MEDIA" accionesCorrectivas={[]} solicitudesAC={0} />,
    )
    expect(toastInfo).not.toHaveBeenCalled()

    rerender(
      <QEACSection qeId="qe-2026-001" qeEstado="PENDIENTE_CIERRE" qeSeveridad="MEDIA" accionesCorrectivas={[]} solicitudesAC={0} />,
    )

    expect(toastInfo).toHaveBeenCalledTimes(1)
  })

  it('shows the toast regardless of the acting user role — real recipients are notified via a persisted notification instead', () => {
    useAuthStore.setState({
      user: {
        id: 'user-002',
        nombre: 'Carlos',
        apellido: 'Mendoza',
        email: 'carlos@shac.internal',
        rol: 'OPERARIO',
      },
      isAuthenticated: true,
      accessToken: 'token',
    })

    const { rerender } = render(
      <QEACSection qeId="qe-2026-001" qeEstado="EN_EJECUCION" qeSeveridad="MEDIA" accionesCorrectivas={[]} solicitudesAC={0} />,
    )

    rerender(
      <QEACSection qeId="qe-2026-001" qeEstado="PENDIENTE_CIERRE" qeSeveridad="MEDIA" accionesCorrectivas={[]} solicitudesAC={0} />,
    )

    expect(toastInfo).toHaveBeenCalledTimes(1)
  })
})

describe('QEACSection — banner de solicitudes de AC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the pending-AC-requests banner for JEFE_CALIDAD_SYST when solicitudesAC > 0', () => {
    useAuthStore.setState({
      user: {
        id: 'user-005',
        nombre: 'Luis',
        apellido: 'Paredes',
        email: 'luis@shac.internal',
        rol: 'JEFE_CALIDAD_SYST',
      },
      isAuthenticated: true,
      accessToken: 'token',
    })

    render(<QEACSection qeId="qe-2026-001" qeEstado="EN_INVESTIGACION" qeSeveridad="MEDIA" accionesCorrectivas={[]} solicitudesAC={2} />)

    expect(screen.getByText(/detail\.acSection\.solicitudesACBanner/)).toBeInTheDocument()
  })

  it('hides the banner when solicitudesAC is 0', () => {
    useAuthStore.setState({
      user: {
        id: 'user-005',
        nombre: 'Luis',
        apellido: 'Paredes',
        email: 'luis@shac.internal',
        rol: 'JEFE_CALIDAD_SYST',
      },
      isAuthenticated: true,
      accessToken: 'token',
    })

    render(<QEACSection qeId="qe-2026-001" qeEstado="EN_INVESTIGACION" qeSeveridad="MEDIA" accionesCorrectivas={[]} solicitudesAC={0} />)

    expect(screen.queryByText(/detail\.acSection\.solicitudesACBanner/)).not.toBeInTheDocument()
  })

  it('hides the banner for roles other than JEFE_CALIDAD_SYST even when solicitudesAC > 0', () => {
    useAuthStore.setState({
      user: {
        id: 'user-003',
        nombre: 'María',
        apellido: 'Castro',
        email: 'maria@shac.internal',
        rol: 'SUPERVISOR',
      },
      isAuthenticated: true,
      accessToken: 'token',
    })

    render(<QEACSection qeId="qe-2026-001" qeEstado="EN_INVESTIGACION" qeSeveridad="MEDIA" accionesCorrectivas={[]} solicitudesAC={2} />)

    expect(screen.queryByText(/detail\.acSection\.solicitudesACBanner/)).not.toBeInTheDocument()
  })
})
