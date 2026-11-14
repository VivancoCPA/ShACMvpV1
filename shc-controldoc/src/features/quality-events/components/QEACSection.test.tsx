import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { QEACSection } from './QEACSection'
import { useAuthStore } from '../../../stores/authStore'
import { createMockUser } from '../../../mocks/fixtures/mockUser'
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

const iniciarMutate = vi.fn()
const ejecutarMutate = vi.fn()
const verificarMutate = vi.fn()
const subirMutate = vi.fn()
const eliminarMutate = vi.fn()
const createMutateAsync = vi.fn()

vi.mock('../hooks/useCreateQEAccion', () => ({
  useCreateQEAccion: () => ({ mutateAsync: createMutateAsync, isPending: false }),
}))

// ac-ejecucion-verificacion-evidencias: el responsable inicia/ejecuta, el JCA verifica.
vi.mock('../hooks/useAccionCorrectivaFlujo', () => ({
  useIniciarQEAccion: () => ({ mutate: iniciarMutate, isPending: false }),
  useEjecutarQEAccion: () => ({ mutate: ejecutarMutate, isPending: false }),
  useVerificarQEAccion: () => ({ mutate: verificarMutate, isPending: false }),
  useSubirEvidenciaAC: () => ({ mutate: subirMutate, isPending: false }),
  useEliminarEvidenciaAC: () => ({ mutate: eliminarMutate, isPending: false }),
}))

vi.mock('../hooks/useEvidenciaACBlob', () => ({
  useEvidenciaACBlob: () => ({ blobUrl: null, isLoading: false, isError: false }),
  useAbrirEvidenciaAC: () => vi.fn(() => Promise.resolve()),
}))

// ac-tipo-responsables: candidatos filtrados por tipo con la misma tabla que el backend.
const candidatosFixture = [
  { id: 'u-ope', nombreCompleto: 'Olga Operaria', rol: 'OPERARIO' },
  { id: 'u-sup', nombreCompleto: 'Saúl Supervisor', rol: 'SUPERVISOR' },
  { id: 'u-jca', nombreCompleto: 'Julia Calidad', rol: 'JEFE_CALIDAD_SYST' },
  { id: 'u-jcd', nombreCompleto: 'Jorge Documentos', rol: 'JEFE_CONTROL_DOCUMENTARIO' },
  { id: 'u-aud', nombreCompleto: 'Ana Auditora', rol: 'AUDITOR_INTERNO' },
  { id: 'u-dir', nombreCompleto: 'Diana Dirección', rol: 'ALTA_DIRECCION' },
] as const

vi.mock('../../../api/endpoints/users.api', async () => {
  const { ROLES_RESPONSABLE_POR_TIPO_AC } = await import('../../../constants/accionCorrectivaTipo.constants')
  return {
    getCandidatosResponsableAC: (tipo: keyof typeof ROLES_RESPONSABLE_POR_TIPO_AC) =>
      Promise.resolve(candidatosFixture.filter((c) => ROLES_RESPONSABLE_POR_TIPO_AC[tipo].includes(c.rol))),
  }
})

// Permite simular una empresa cuya configuración deja un tipo sin candidatos (ac-responsables-configurable-empresa).
const candidatosState = vi.hoisted(() => ({ vacio: false }))

vi.mock('../hooks/useCandidatosResponsableAC', async () => {
  const { ROLES_RESPONSABLE_POR_TIPO_AC } = await import('../../../constants/accionCorrectivaTipo.constants')
  return {
    candidatosResponsableACQueryKey: (tipo: string) => ['acciones-correctivas', 'candidatos', tipo],
    useCandidatosResponsableAC: (tipo: keyof typeof ROLES_RESPONSABLE_POR_TIPO_AC | undefined) => ({
      data:
        tipo && !candidatosState.vacio
          ? candidatosFixture.filter((c) => ROLES_RESPONSABLE_POR_TIPO_AC[tipo].includes(c.rol))
          : [],
      isLoading: false,
    }),
  }
})

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQueryClient: () => ({
    fetchQuery: ({ queryFn }: { queryFn: () => Promise<unknown> }) => queryFn(),
  }),
}))

vi.mock('../../users/hooks/useUserNames', () => ({
  useUserNames: () => ({
    getName: (id?: string | null) => (id === 'user-003' ? 'María Castro' : 'common:userNames.noDisponible'),
    getUser: () => undefined,
    isLoading: false,
  }),
}))

vi.mock('../hooks/useSolicitarAjustePlazoAC', () => ({
  useSolicitarAjustePlazoAC: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../hooks/useRevisarAjustePlazoAC', () => ({
  useRevisarAjustePlazoAC: () => ({ mutate: vi.fn(), isPending: false }),
}))

const descartarMutate = vi.fn()
vi.mock('../hooks/useDescartarSolicitudAC', () => ({
  useDescartarSolicitudAC: () => ({ mutate: descartarMutate, isPending: false }),
}))

const enEjecucionAC: AccionCorrectivaQE = {
  id: 'ac-1',
  qeId: 'qe-2026-001',
  titulo: 'Reforzar EPP',
  descripcion: 'Reforzar el uso de EPP en almacén',
  responsableId: 'user-003',
  responsableNombre: 'María Castro',
  tipo: 'CORRECTIVA',
  plazoFecha: '2026-08-01',
  estado: 'EN_EJECUCION',
  creadoEn: '2026-01-01T00:00:00Z',
  actualizadoEn: '2026-01-01T00:00:00Z',
  solicitudesAjustePlazo: [],
}

const evidenciaPdf = {
  id: 'ev-1',
  nombreArchivo: 'acta.pdf',
  contentType: 'application/pdf',
  tamanioBytes: 2048,
  subidoEn: '2026-01-02T00:00:00Z',
}

const DESCRIPCION_VALIDA = 'Se reforzó la supervisión del uso de EPP en los tres turnos y se adjunta el acta.'

function usuario(id: string, rol: 'JEFE_CALIDAD_SYST' | 'OPERARIO' | 'SUPERVISOR') {
  useAuthStore.setState({
    user: createMockUser({ id, nombre: 'Test', apellido: 'User', email: `${id}@shac.internal`, rol }),
    isAuthenticated: true,
    accessToken: 'token',
  })
}

function renderAC(ac: AccionCorrectivaQE) {
  return render(
    <QEACSection qeId="qe-2026-001" qeEstado="EN_EJECUCION" qeSeveridad="MEDIA" accionesCorrectivas={[ac]} solicitudesAC={0} />,
  )
}

describe('QEACSection — botones por rol y estado (ac-ejecucion-verificacion-evidencias)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('PENDIENTE: el responsable ve "Iniciar" y llama al endpoint de iniciar', () => {
    usuario('user-003', 'OPERARIO')
    renderAC({ ...enEjecucionAC, estado: 'PENDIENTE' })

    fireEvent.click(screen.getByText('detail.acSection.actions.iniciar'))
    expect(iniciarMutate).toHaveBeenCalledWith('ac-1')
  })

  it('el JCA que no es responsable no ve "Iniciar" ni "Marcar como ejecutada"', () => {
    usuario('user-005', 'JEFE_CALIDAD_SYST')
    const { unmount } = renderAC({ ...enEjecucionAC, estado: 'PENDIENTE' })
    expect(screen.queryByText('detail.acSection.actions.iniciar')).not.toBeInTheDocument()
    unmount()

    renderAC(enEjecucionAC)
    expect(screen.queryByText('detail.acSection.actions.marcarEjecutada')).not.toBeInTheDocument()
  })

  it('EN_EJECUCION: el responsable ve "Marcar como ejecutada"', () => {
    usuario('user-003', 'OPERARIO')
    renderAC(enEjecucionAC)
    expect(screen.getByText('detail.acSection.actions.marcarEjecutada')).toBeInTheDocument()
  })

  it('COMPLETADA: el JCA ve "Verificar"; el responsable solo el badge', () => {
    const completada: AccionCorrectivaQE = {
      ...enEjecucionAC,
      estado: 'COMPLETADA',
      descripcionEvidencia: DESCRIPCION_VALIDA,
      evidencias: [evidenciaPdf],
    }
    usuario('user-005', 'JEFE_CALIDAD_SYST')
    const { unmount } = renderAC(completada)
    expect(screen.getByText('detail.acSection.actions.verificar')).toBeInTheDocument()
    unmount()

    usuario('user-003', 'OPERARIO')
    renderAC(completada)
    expect(screen.queryByText('detail.acSection.actions.verificar')).not.toBeInTheDocument()
    expect(screen.getByText('detail.acSection.acStatus.COMPLETADA')).toBeInTheDocument()
  })

  it('un JCA responsable ve "Marcar como ejecutada" y luego "Verificar"', () => {
    usuario('user-003', 'JEFE_CALIDAD_SYST')
    const { unmount } = renderAC(enEjecucionAC)
    expect(screen.getByText('detail.acSection.actions.marcarEjecutada')).toBeInTheDocument()
    unmount()

    renderAC({ ...enEjecucionAC, estado: 'COMPLETADA', evidencias: [evidenciaPdf] })
    expect(screen.getByText('detail.acSection.actions.verificar')).toBeInTheDocument()
  })

  it('CERRADA muestra "Verificada por" y ningún botón de acción', () => {
    usuario('user-005', 'JEFE_CALIDAD_SYST')
    renderAC({
      ...enEjecucionAC,
      estado: 'CERRADA',
      verificadaPorNombre: 'Julia Calidad',
      verificadaEn: '2026-02-01T10:00:00Z',
      evidencias: [evidenciaPdf],
    })
    expect(screen.getByText(/detail\.acSection\.verificadaPor.*Julia Calidad/)).toBeInTheDocument()
    expect(screen.queryByText('detail.acSection.actions.verificar')).not.toBeInTheDocument()
    expect(screen.queryByText('detail.acSection.actions.marcarEjecutada')).not.toBeInTheDocument()
  })

  it('una AC devuelta muestra el aviso con el motivo', () => {
    usuario('user-003', 'OPERARIO')
    renderAC({ ...enEjecucionAC, motivoDevolucion: 'Falta la foto del después.' })
    expect(screen.getByText(/detail\.acSection\.devuelta.*Falta la foto del después\./)).toBeInTheDocument()
  })

  it('una AC histórica con evidenciaUrl muestra el enlace', () => {
    usuario('user-005', 'JEFE_CALIDAD_SYST')
    renderAC({ ...enEjecucionAC, estado: 'CERRADA', evidenciaUrl: 'https://intranet/evidencia.pdf' })
    expect(screen.getByText('detail.acSection.evidencias.historica').closest('a')).toHaveAttribute(
      'href',
      'https://intranet/evidencia.pdf',
    )
  })
})

describe('QEACSection — modal "Marcar como ejecutada"', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usuario('user-003', 'OPERARIO')
  })

  const confirmar = () => screen.getByText('detail.acSection.ejecutarModal.confirmar')

  it('"Confirmar" está deshabilitado sin archivos aunque la descripción sea válida', async () => {
    renderAC(enEjecucionAC)
    fireEvent.click(screen.getByText('detail.acSection.actions.marcarEjecutada'))
    fireEvent.change(screen.getByLabelText(/detail\.acSection\.evidencias\.descripcion/), {
      target: { value: DESCRIPCION_VALIDA },
    })
    await waitFor(() => expect(confirmar()).toBeDisabled())
  })

  it('"Confirmar" está deshabilitado con una descripción corta', async () => {
    renderAC({ ...enEjecucionAC, evidencias: [evidenciaPdf] })
    fireEvent.click(screen.getByText('detail.acSection.actions.marcarEjecutada'))
    fireEvent.change(screen.getByLabelText(/detail\.acSection\.evidencias\.descripcion/), {
      target: { value: 'Muy corta' },
    })
    await waitFor(() => expect(confirmar()).toBeDisabled())
  })

  it('con archivo y descripción válida llama a ejecutar', async () => {
    renderAC({ ...enEjecucionAC, evidencias: [evidenciaPdf] })
    fireEvent.click(screen.getByText('detail.acSection.actions.marcarEjecutada'))
    fireEvent.change(screen.getByLabelText(/detail\.acSection\.evidencias\.descripcion/), {
      target: { value: DESCRIPCION_VALIDA },
    })
    await waitFor(() => expect(confirmar()).toBeEnabled())
    fireEvent.click(confirmar())

    await waitFor(() =>
      expect(ejecutarMutate).toHaveBeenCalledWith(
        { acId: 'ac-1', data: { descripcionEvidencia: DESCRIPCION_VALIDA } },
        expect.anything(),
      ),
    )
  })

  it('rechaza en el cliente un archivo de más de 50 MB sin subirlo', () => {
    renderAC(enEjecucionAC)
    fireEvent.click(screen.getByText('detail.acSection.actions.marcarEjecutada'))

    const grande = new File(['x'], 'video.mp4', { type: 'video/mp4' })
    Object.defineProperty(grande, 'size', { value: 51 * 1024 * 1024 })
    fireEvent.change(screen.getByTestId('qeac-evidencias-input'), { target: { files: [grande] } })

    expect(screen.getByRole('alert')).toHaveTextContent('detail.acSection.evidencias.errorTamano')
    expect(subirMutate).not.toHaveBeenCalled()
  })

  it('sube el archivo al seleccionarlo y lo agrega a la lista', () => {
    subirMutate.mockImplementation((_vars: unknown, opts: { onSuccess: (ev: unknown) => void; onSettled: () => void }) => {
      opts.onSuccess({ ...evidenciaPdf, id: 'ev-nuevo', nombreArchivo: 'foto.png', contentType: 'image/png' })
      opts.onSettled()
    })
    renderAC(enEjecucionAC)
    fireEvent.click(screen.getByText('detail.acSection.actions.marcarEjecutada'))

    const foto = new File(['png'], 'foto.png', { type: 'image/png' })
    fireEvent.change(screen.getByTestId('qeac-evidencias-input'), { target: { files: [foto] } })

    expect(subirMutate).toHaveBeenCalledWith(expect.objectContaining({ file: foto }), expect.anything())
    expect(screen.getByText('foto.png')).toBeInTheDocument()
  })

  it('quitar un archivo llama al DELETE y lo saca de la lista', () => {
    eliminarMutate.mockImplementation((_id: string, opts: { onSuccess: () => void }) => opts.onSuccess())
    renderAC({ ...enEjecucionAC, evidencias: [evidenciaPdf] })
    fireEvent.click(screen.getByText('detail.acSection.actions.marcarEjecutada'))
    expect(screen.getByText('acta.pdf')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/detail\.acSection\.evidencias\.quitar/))

    expect(eliminarMutate).toHaveBeenCalledWith('ev-1', expect.anything())
    expect(screen.queryByText('acta.pdf')).not.toBeInTheDocument()
  })
})

describe('QEACSection — modal "Verificar AC"', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usuario('user-005', 'JEFE_CALIDAD_SYST')
  })

  const completada: AccionCorrectivaQE = {
    ...enEjecucionAC,
    estado: 'COMPLETADA',
    descripcionEvidencia: DESCRIPCION_VALIDA,
    evidencias: [evidenciaPdf],
  }

  it('muestra la descripción y los archivos de la evidencia', () => {
    renderAC(completada)
    fireEvent.click(screen.getByText('detail.acSection.actions.verificar'))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText(DESCRIPCION_VALIDA)).toBeInTheDocument()
    expect(dialog.getByText('acta.pdf')).toBeInTheDocument()
  })

  it('"Aprobar y cerrar" verifica con aprobada: true', () => {
    renderAC(completada)
    fireEvent.click(screen.getByText('detail.acSection.actions.verificar'))
    fireEvent.click(screen.getByText('detail.acSection.verificar.aprobar'))
    expect(verificarMutate).toHaveBeenCalledWith({ acId: 'ac-1', data: { aprobada: true } }, expect.anything())
  })

  it('"Devolver" exige motivo antes de enviar', async () => {
    renderAC(completada)
    fireEvent.click(screen.getByText('detail.acSection.actions.verificar'))
    fireEvent.click(screen.getByText('detail.acSection.verificar.devolver'))
    fireEvent.click(screen.getByText('detail.acSection.verificar.confirmarDevolucion'))

    await waitFor(() => expect(screen.getByText(/al menos 20 caracteres/)).toBeInTheDocument())
    expect(verificarMutate).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/detail\.acSection\.verificar\.motivo/), {
      target: { value: 'Falta la foto del después de la instalación.' },
    })
    fireEvent.click(screen.getByText('detail.acSection.verificar.confirmarDevolucion'))
    await waitFor(() =>
      expect(verificarMutate).toHaveBeenCalledWith(
        { acId: 'ac-1', data: { aprobada: false, comentario: 'Falta la foto del después de la instalación.' } },
        expect.anything(),
      ),
    )
  })
})

describe('QEACSection — notificación de transición automática a PENDIENTE_CIERRE', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a toast.info for JEFE_CALIDAD_SYST when qeEstado transitions EN_EJECUCION → PENDIENTE_CIERRE', () => {
    useAuthStore.setState({
      user: createMockUser({
        id: 'user-005',
        nombre: 'Luis',
        apellido: 'Paredes',
        email: 'luis@shac.internal',
        rol: 'JEFE_CALIDAD_SYST',
      }),
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
      user: createMockUser({
        id: 'user-002',
        nombre: 'Carlos',
        apellido: 'Mendoza',
        email: 'carlos@shac.internal',
        rol: 'OPERARIO',
      }),
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
      user: createMockUser({
        id: 'user-005',
        nombre: 'Luis',
        apellido: 'Paredes',
        email: 'luis@shac.internal',
        rol: 'JEFE_CALIDAD_SYST',
      }),
      isAuthenticated: true,
      accessToken: 'token',
    })

    render(<QEACSection qeId="qe-2026-001" qeEstado="EN_INVESTIGACION" qeSeveridad="MEDIA" accionesCorrectivas={[]} solicitudesAC={2} />)

    expect(screen.getByText(/detail\.acSection\.solicitudesACBanner/)).toBeInTheDocument()
  })

  it('hides the banner when solicitudesAC is 0', () => {
    useAuthStore.setState({
      user: createMockUser({
        id: 'user-005',
        nombre: 'Luis',
        apellido: 'Paredes',
        email: 'luis@shac.internal',
        rol: 'JEFE_CALIDAD_SYST',
      }),
      isAuthenticated: true,
      accessToken: 'token',
    })

    render(<QEACSection qeId="qe-2026-001" qeEstado="EN_INVESTIGACION" qeSeveridad="MEDIA" accionesCorrectivas={[]} solicitudesAC={0} />)

    expect(screen.queryByText(/detail\.acSection\.solicitudesACBanner/)).not.toBeInTheDocument()
  })

  it('hides the banner for roles other than JEFE_CALIDAD_SYST even when solicitudesAC > 0', () => {
    useAuthStore.setState({
      user: createMockUser({
        id: 'user-003',
        nombre: 'María',
        apellido: 'Castro',
        email: 'maria@shac.internal',
        rol: 'SUPERVISOR',
      }),
      isAuthenticated: true,
      accessToken: 'token',
    })

    render(<QEACSection qeId="qe-2026-001" qeEstado="EN_INVESTIGACION" qeSeveridad="MEDIA" accionesCorrectivas={[]} solicitudesAC={2} />)

    expect(screen.queryByText(/detail\.acSection\.solicitudesACBanner/)).not.toBeInTheDocument()
  })
})

describe('QEACSection — tipo de acción y responsables por tipo (ac-tipo-responsables)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    candidatosState.vacio = false
    useAuthStore.setState({
      user: createMockUser({
        id: 'user-005',
        nombre: 'Luis',
        apellido: 'Paredes',
        email: 'luis@shac.internal',
        rol: 'JEFE_CALIDAD_SYST',
      }),
      isAuthenticated: true,
      accessToken: 'token',
    })
  })

  function abrirModal() {
    render(
      <QEACSection
        qeId="qe-2026-001"
        qeEstado="EN_INVESTIGACION" qeSeveridad="MEDIA"
        accionesCorrectivas={[]}
        solicitudesAC={0}
      />,
    )
    fireEvent.click(screen.getByText('detail.acSection.actions.add'))
  }

  const opcionesResponsable = () =>
    Array.from((screen.getByLabelText(/detail.acSection.fields.responsable/) as HTMLSelectElement).options)
      .map((o) => o.value)
      .filter(Boolean)

  it('sin tipo el responsable está deshabilitado y pide elegir el tipo primero', () => {
    abrirModal()

    const responsable = screen.getByLabelText(/detail.acSection.fields.responsable/)
    expect(responsable).toBeDisabled()
    expect(screen.getByText('detail.acSection.placeholders.elegirTipoPrimero')).toBeInTheDocument()
  })

  it('sin candidatos para el tipo, orienta al JCA a consultar al administrador', () => {
    candidatosState.vacio = true
    abrirModal()

    fireEvent.change(screen.getByLabelText(/detail.acSection.fields.tipo/), { target: { value: 'MEJORA' } })

    expect(screen.getByText(/detail\.acSection\.sinCandidatos detail\.acSection\.sinCandidatosConsulta/)).toBeInTheDocument()
  })

  it('con MEJORA solo lista JCA, JCD y DIR, con su rol', () => {
    abrirModal()

    fireEvent.change(screen.getByLabelText(/detail.acSection.fields.tipo/), { target: { value: 'MEJORA' } })

    expect(screen.getByLabelText(/detail.acSection.fields.responsable/)).not.toBeDisabled()
    expect(opcionesResponsable()).toEqual(['u-jca', 'u-jcd', 'u-dir'])
    expect(screen.getByText('Julia Calidad · auth:roles.JEFE_CALIDAD_SYST')).toBeInTheDocument()
  })

  it('al cambiar a un tipo que excluye al responsable elegido lo limpia y avisa', async () => {
    abrirModal()
    const tipo = screen.getByLabelText(/detail.acSection.fields.tipo/)
    const responsable = screen.getByLabelText(/detail.acSection.fields.responsable/)

    fireEvent.change(tipo, { target: { value: 'CORRECTIVA' } })
    fireEvent.change(responsable, { target: { value: 'u-ope' } })
    expect(responsable).toHaveValue('u-ope')

    fireEvent.change(tipo, { target: { value: 'MEJORA' } })

    await waitFor(() => expect(responsable).toHaveValue(''))
    expect(
      screen.getByText(
        `detail.acSection.responsableNoValido:${JSON.stringify({ nombre: 'Olga Operaria', tipo: 'common:acTipo.MEJORA' })}`,
      ),
    ).toBeInTheDocument()
  })

  it('al cambiar a un tipo que mantiene al responsable no lo limpia', async () => {
    abrirModal()
    const tipo = screen.getByLabelText(/detail.acSection.fields.tipo/)
    const responsable = screen.getByLabelText(/detail.acSection.fields.responsable/)

    fireEvent.change(tipo, { target: { value: 'CORRECTIVA' } })
    fireEvent.change(responsable, { target: { value: 'u-jca' } })
    fireEvent.change(tipo, { target: { value: 'MEJORA' } })

    await waitFor(() => expect(opcionesResponsable()).toEqual(['u-jca', 'u-jcd', 'u-dir']))
    expect(responsable).toHaveValue('u-jca')
    expect(screen.queryByText(/detail.acSection.responsableNoValido/)).not.toBeInTheDocument()
  })

  it('envía el tipo en el alta', async () => {
    createMutateAsync.mockResolvedValueOnce({})
    abrirModal()

    fireEvent.change(screen.getByLabelText(/detail.acSection.fields.descripcion/), {
      target: { value: 'Implementar mejora en el proceso de despacho' },
    })
    fireEvent.change(screen.getByLabelText(/detail.acSection.fields.tipo/), { target: { value: 'MEJORA' } })
    fireEvent.change(screen.getByLabelText(/detail.acSection.fields.responsable/), { target: { value: 'u-jcd' } })
    fireEvent.change(screen.getByLabelText(/detail.acSection.fields.plazoFecha/), { target: { value: '2026-12-15' } })
    fireEvent.click(screen.getByText('detail.acSection.actions.save'))

    await waitFor(() =>
      expect(createMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'MEJORA', responsableId: 'u-jcd' })),
    )
  })

  it('muestra en el campo el error de responsableId devuelto por el servidor', async () => {
    createMutateAsync.mockRejectedValueOnce({
      response: { data: { errors: ['responsableId: El responsable no puede asignarse a una acción de tipo MEJORA'] } },
    })
    abrirModal()

    fireEvent.change(screen.getByLabelText(/detail.acSection.fields.descripcion/), {
      target: { value: 'Implementar mejora en el proceso de despacho' },
    })
    fireEvent.change(screen.getByLabelText(/detail.acSection.fields.tipo/), { target: { value: 'MEJORA' } })
    fireEvent.change(screen.getByLabelText(/detail.acSection.fields.responsable/), { target: { value: 'u-jcd' } })
    fireEvent.change(screen.getByLabelText(/detail.acSection.fields.plazoFecha/), { target: { value: '2026-12-15' } })
    fireEvent.click(screen.getByText('detail.acSection.actions.save'))

    expect(
      await screen.findByText('El responsable no puede asignarse a una acción de tipo MEJORA'),
    ).toBeInTheDocument()
  })

  it('la lista muestra el badge del tipo de cada AC', () => {
    render(
      <QEACSection
        qeId="qe-2026-001"
        qeEstado="EN_EJECUCION" qeSeveridad="MEDIA"
        accionesCorrectivas={[{ ...enEjecucionAC, tipo: 'MEJORA' }]}
        solicitudesAC={0}
      />,
    )

    expect(screen.getByText('common:acTipo.MEJORA')).toBeInTheDocument()
  })

  it('el panel de ajuste de plazo muestra el nombre del solicitante, nunca su id', () => {
    render(
      <QEACSection
        qeId="qe-2026-001"
        qeEstado="EN_EJECUCION" qeSeveridad="MEDIA"
        accionesCorrectivas={[
          {
            ...enEjecucionAC,
            solicitudesAjustePlazo: [
              {
                id: 'sol-1',
                estado: 'PENDIENTE',
                fechaSolicitada: '2026-09-01',
                justificacion: 'Demora del proveedor',
                solicitadoPorId: 'user-003',
                solicitadoEn: '2026-07-20T00:00:00Z',
                requiereAprobacionGerencia: false,
              },
            ],
          },
        ]}
        solicitudesAC={0}
      />,
    )

    expect(
      screen.getByText(`detail.acSection.ajustePlazo.panel.solicitadoPor:${JSON.stringify({ nombre: 'María Castro' })}`),
    ).toBeInTheDocument()
    expect(screen.queryByText(/user-003/)).not.toBeInTheDocument()
  })
})

describe('QEACSection — acciones del aviso de solicitudes (solicitudes-ac-y-ac-del-qe-en-origen)', () => {
  const MOTIVO = 'La solicitud duplica una AC ya registrada en el QE.'

  beforeEach(() => {
    descartarMutate.mockReset()
    usuario('user-005', 'JEFE_CALIDAD_SYST')
  })

  function renderBanner(props: { solicitudesAC: number; readOnly?: boolean }) {
    return render(
      <QEACSection
        qeId="qe-2026-001"
        qeEstado="EN_INVESTIGACION"
        qeSeveridad="MEDIA"
        accionesCorrectivas={[]}
        solicitudesAC={props.solicitudesAC}
        readOnly={props.readOnly}
      />,
    )
  }

  // qe-quitar-boton-crear-ac-duplicado: el aviso solo ofrece descartar; la AC se crea con "Nueva AC" del encabezado.
  it('el aviso solo ofrece "Descartar solicitud" y el encabezado mantiene "Nueva AC"', () => {
    renderBanner({ solicitudesAC: 1 })

    const aviso = screen.getByText(/detail\.acSection\.solicitudesACBanner/).parentElement as HTMLElement
    expect(within(aviso).getAllByRole('button').map((b) => b.textContent)).toEqual(['detail.acSection.descartarSolicitud'])
    expect(screen.getAllByRole('button', { name: /detail\.acSection\.actions\.add/ })).toHaveLength(1)
  })

  it('crear la AC desde "Nueva AC" con una solicitud pendiente hace desaparecer el aviso', async () => {
    createMutateAsync.mockResolvedValueOnce({})
    const { rerender } = renderBanner({ solicitudesAC: 1 })

    fireEvent.click(screen.getByRole('button', { name: /detail\.acSection\.actions\.add/ }))
    fireEvent.change(screen.getByLabelText(/detail.acSection.fields.descripcion/), {
      target: { value: 'Implementar mejora en el proceso de despacho' },
    })
    fireEvent.change(screen.getByLabelText(/detail.acSection.fields.tipo/), { target: { value: 'MEJORA' } })
    fireEvent.change(screen.getByLabelText(/detail.acSection.fields.responsable/), { target: { value: 'u-jcd' } })
    fireEvent.change(screen.getByLabelText(/detail.acSection.fields.plazoFecha/), { target: { value: '2026-12-15' } })
    fireEvent.click(screen.getByText('detail.acSection.actions.save'))
    await waitFor(() => expect(createMutateAsync).toHaveBeenCalled())

    // El servidor descuenta la solicitud; la invalidación de ['quality-events'] refresca el QE con solicitudesAC = 0.
    rerender(
      <QEACSection qeId="qe-2026-001" qeEstado="EN_INVESTIGACION" qeSeveridad="MEDIA" accionesCorrectivas={[]} solicitudesAC={0} />,
    )
    expect(screen.queryByText(/detail\.acSection\.solicitudesACBanner/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /detail\.acSection\.actions\.add/ })).toBeInTheDocument()
  })

  it('con readOnly muestra el aviso sin acciones', () => {
    renderBanner({ solicitudesAC: 1, readOnly: true })

    expect(screen.getByText(/detail\.acSection\.solicitudesACBanner/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'detail.acSection.descartarSolicitud' })).not.toBeInTheDocument()
  })

  it('un motivo corto muestra error y no llama al endpoint', async () => {
    renderBanner({ solicitudesAC: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'detail.acSection.descartarSolicitud' }))

    fireEvent.change(screen.getByLabelText(/detail\.acSection\.motivoDescarte/), { target: { value: 'corto' } })
    fireEvent.click(screen.getByRole('button', { name: 'detail.acSection.confirmarDescarte' }))

    expect(await screen.findByText('El motivo debe tener al menos 20 caracteres.')).toBeInTheDocument()
    expect(descartarMutate).not.toHaveBeenCalled()
  })

  it('descartar con motivo válido llama al hook y el aviso desaparece al refrescar el QE', async () => {
    descartarMutate.mockImplementation((_motivo: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
    const { rerender } = renderBanner({ solicitudesAC: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'detail.acSection.descartarSolicitud' }))

    fireEvent.change(screen.getByLabelText(/detail\.acSection\.motivoDescarte/), { target: { value: MOTIVO } })
    fireEvent.click(screen.getByRole('button', { name: 'detail.acSection.confirmarDescarte' }))

    await waitFor(() => expect(descartarMutate).toHaveBeenCalledWith(MOTIVO, expect.anything()))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // La invalidación de ['quality-events'] refresca el detalle con solicitudesAC = 0.
    rerender(
      <QEACSection qeId="qe-2026-001" qeEstado="EN_INVESTIGACION" qeSeveridad="MEDIA" accionesCorrectivas={[]} solicitudesAC={0} />,
    )
    expect(screen.queryByText(/detail\.acSection\.solicitudesACBanner/)).not.toBeInTheDocument()
  })
})
