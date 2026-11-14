import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { toast } from 'sonner'
import { MemoryRouter } from 'react-router-dom'
import { QEInvestigationSection } from './QEInvestigationSection'
import type { QualityEvent, SugerenciaCausaRaizIA } from '../types/qualityEvent.types'
import type { User } from '../../../types/auth.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join('|')}` : key,
    i18n: { language: 'es-PE' },
  }),
}))

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

let currentUser: User | null = null
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: User | null }) => unknown) => selector({ user: currentUser }),
}))

const updateMutateAsync = vi.fn()
vi.mock('../hooks/useUpdateQualityEvent', () => ({
  useUpdateQualityEvent: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
}))

type AprobarOptions = { onSuccess?: () => void; onError?: (error: unknown) => void }
const aprobarMutate = vi.fn<(vars: { id: string; pin: string }, options?: AprobarOptions) => void>()
vi.mock('../hooks/useAprobarCausaRaiz', () => ({
  useAprobarCausaRaiz: () => ({ mutate: aprobarMutate, isPending: false }),
}))

// qe-asistente-ia
let asistenteIAActivo = true
let asistenteIASimulado = false
vi.mock('../hooks/useFuncionalidades', () => ({
  useFuncionalidades: () => ({ data: { asistenteIA: asistenteIAActivo, asistenteIASimulado } }),
}))

type AsistirOptions = { onSuccess?: (s: SugerenciaCausaRaizIA) => void; onError?: (error: unknown) => void }
const asistirMutate = vi.fn<(vars: { id: string; metodo: string }, options?: AsistirOptions) => void>()
let asistirPending = false
vi.mock('../hooks/useAsistenteIA', () => ({
  useAsistenteIA: () => ({ mutate: asistirMutate, isPending: asistirPending }),
}))

vi.mock('../hooks/useCreateQEAccion', () => ({
  useCreateQEAccion: () => ({ mutateAsync: vi.fn(), isPending: false }),
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

vi.mock('../hooks/useCandidatosResponsableAC', async () => {
  const { ROLES_RESPONSABLE_POR_TIPO_AC } = await import('../../../constants/accionCorrectivaTipo.constants')
  return {
    candidatosResponsableACQueryKey: (tipo: string) => ['acciones-correctivas', 'candidatos', tipo],
    useCandidatosResponsableAC: (tipo: keyof typeof ROLES_RESPONSABLE_POR_TIPO_AC | undefined) => ({
      data: tipo ? candidatosFixture.filter((c) => ROLES_RESPONSABLE_POR_TIPO_AC[tipo].includes(c.rol)) : [],
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

let getNameMock = (): string => 'Luis Paredes'
vi.mock('../../users/hooks/useUserNames', () => ({
  useUserNames: () => ({ getName: () => getNameMock(), isLoading: false }),
}))

const CAUSA_RAIZ_VALIDA = 'x'.repeat(150)

function makeUser(overrides: Partial<User>): User {
  return {
    id: 'user-jca-001',
    nombre: 'Ana',
    apellido: 'Torres',
    email: 'ana@shac.internal',
    rol: 'JEFE_CALIDAD_SYST',
    tienePinFirma: true,
    ...overrides,
  } as User
}

function makeQE(overrides: Partial<QualityEvent>): QualityEvent {
  return {
    id: 'qe-2026-010',
    numero: 'QE-2026-010',
    origen: 'O1_INCIDENTE_CAMPO',
    tipo: 'SST',
    severidad: 'ALTA',
    estado: 'ANALISIS_COMPLETADO',
    ciclo: 1,
    descripcion: 'Descripción',
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

function renderSection(qe: QualityEvent) {
  return render(
    <MemoryRouter>
      <QEInvestigationSection qe={qe} />
    </MemoryRouter>,
  )
}

function apiError(errorCode: string) {
  return { response: { data: { errorCode, message: errorCode } } }
}

async function abrirPinModal() {
  fireEvent.click(screen.getByText('detail.investigation.aprobarCausaRaiz'))
  await screen.findByText('detail.investigation.pinModal.title')
}

function confirmarPin(pin: string) {
  fireEvent.change(screen.getByLabelText('detail.investigation.pinModal.placeholder'), { target: { value: pin } })
  fireEvent.click(screen.getByText('detail.investigation.pinModal.confirm'))
}

beforeEach(() => {
  currentUser = null
  getNameMock = () => 'Luis Paredes'
  updateMutateAsync.mockReset().mockResolvedValue({})
  aprobarMutate.mockReset()
  asistenteIAActivo = true
  asistenteIASimulado = false
  asistirPending = false
  asistirMutate.mockReset()
  vi.mocked(toast).mockClear()
  vi.mocked(toast.error).mockClear()
})

describe('QEInvestigationSection — sello de aprobación de causa raíz (nombres-usuarios-reales)', () => {
  it('muestra el nombre resuelto por useUserNames, no el id crudo', () => {
    const qe = makeQE({
      causaRaizDefinitiva: 'Falta de mantenimiento preventivo',
      causaRaizAprobadaPorId: 'user-jefecalidad-001',
      causaRaizFirmadaEn: '2026-06-05T10:00:00Z',
    })

    renderSection(qe)

    expect(screen.getByText('Luis Paredes', { exact: false })).toBeInTheDocument()
    expect(screen.queryByText('user-jefecalidad-001', { exact: false })).not.toBeInTheDocument()
  })

  it('muestra el texto genérico cuando el id no se resuelve', () => {
    getNameMock = () => 'common:userNames.noDisponible'
    const qe = makeQE({
      causaRaizDefinitiva: 'Falta de mantenimiento preventivo',
      causaRaizAprobadaPorId: 'user-desconocido',
      causaRaizFirmadaEn: '2026-06-05T10:00:00Z',
    })

    renderSection(qe)

    expect(screen.getByText('common:userNames.noDisponible', { exact: false })).toBeInTheDocument()
  })
})

describe('QEInvestigationSection — guardar análisis (qe-analisis-causa-raiz-fix)', () => {
  it('envía solo la lista de la herramienta activa y la causa raíz', async () => {
    currentUser = makeUser({})
    renderSection(makeQE({ estado: 'EN_INVESTIGACION' }))

    fireEvent.change(screen.getByLabelText('detail.investigation.porque:1'), { target: { value: 'Falla del sensor' } })
    fireEvent.click(screen.getByText('detail.investigation.guardar'))

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1))
    const { data } = updateMutateAsync.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(data.metodoAnalisis).toBe('5_PORQUES')
    expect(data).not.toHaveProperty('ishikawa')
    expect((data.cincoPorques as { respuesta: string }[])[0].respuesta).toBe('Falla del sensor')
    expect(data).toHaveProperty('causaRaizDefinitiva')
  })

  it('muestra las respuestas guardadas al recargar el QE (5 Porqués e Ishikawa)', () => {
    currentUser = makeUser({ rol: 'AUDITOR_INTERNO' })
    const cincoPorques = [1, 2, 3, 4, 5].map((n) => ({ pregunta: `¿Por qué ${n}?`, respuesta: `Respuesta guardada ${n}` }))
    const { unmount } = renderSection(makeQE({ metodoAnalisis: '5_PORQUES', cincoPorques }))
    expect(screen.getByText('Respuesta guardada 3')).toBeInTheDocument()
    unmount()

    renderSection(makeQE({ metodoAnalisis: 'ISHIKAWA', ishikawa: [{ categoria: 'MEDICION', causa: 'Balanza descalibrada' }] }))
    expect(screen.getByText('Balanza descalibrada')).toBeInTheDocument()
  })

  it('no envía la causa raíz una vez firmada', async () => {
    currentUser = makeUser({})
    renderSection(makeQE({
      causaRaizDefinitiva: CAUSA_RAIZ_VALIDA,
      causaRaizAprobadaPorId: 'user-jca-001',
      causaRaizFirmadaEn: '2026-06-05T10:00:00Z',
    }))

    fireEvent.click(screen.getByText('detail.investigation.guardar'))

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1))
    const { data } = updateMutateAsync.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(data).not.toHaveProperty('causaRaizDefinitiva')
  })
})

describe('QEInvestigationSection — permisos por rol (qe-analisis-causa-raiz-fix)', () => {
  it('el SUPERVISOR responsable edita pero no ve "Aprobar"', () => {
    currentUser = makeUser({ id: 'user-sup-001', rol: 'SUPERVISOR' })
    renderSection(makeQE({ responsableInvestigacionId: 'user-sup-001', causaRaizDefinitiva: CAUSA_RAIZ_VALIDA }))

    expect(screen.getByText('detail.investigation.guardar')).toBeInTheDocument()
    expect(screen.getByLabelText('detail.investigation.causaRaizDefinitiva')).toBeInTheDocument()
    expect(screen.queryByText('detail.investigation.aprobarCausaRaiz')).not.toBeInTheDocument()
    expect(screen.getByText('detail.investigation.pendienteAprobacion')).toBeInTheDocument()
  })

  it('el SUPERVISOR no asignado ve el análisis en solo lectura', () => {
    currentUser = makeUser({ id: 'user-sup-002', rol: 'SUPERVISOR' })
    renderSection(makeQE({ responsableInvestigacionId: 'user-sup-001', causaRaizDefinitiva: CAUSA_RAIZ_VALIDA }))

    expect(screen.queryByText('detail.investigation.guardar')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText('detail.investigation.aprobarCausaRaiz')).not.toBeInTheDocument()
  })
})

describe('QEInvestigationSection — aprobación con PIN (qe-analisis-causa-raiz-fix)', () => {
  it('envía solo { pin } al endpoint de aprobación', async () => {
    currentUser = makeUser({})
    renderSection(makeQE({ causaRaizDefinitiva: CAUSA_RAIZ_VALIDA }))

    await abrirPinModal()
    confirmarPin('9081')

    expect(aprobarMutate).toHaveBeenCalledTimes(1)
    expect(aprobarMutate.mock.calls[0][0]).toEqual({ id: 'qe-2026-010', pin: '9081' })
    expect(updateMutateAsync).not.toHaveBeenCalled()
  })

  it('guarda los cambios pendientes antes de abrir el modal', async () => {
    currentUser = makeUser({})
    renderSection(makeQE({ causaRaizDefinitiva: CAUSA_RAIZ_VALIDA }))

    fireEvent.change(screen.getByLabelText('detail.investigation.causaRaizDefinitiva'), {
      target: { value: 'y'.repeat(150) },
    })
    await abrirPinModal()

    expect(updateMutateAsync).toHaveBeenCalledTimes(1)
    const { data } = updateMutateAsync.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(data.causaRaizDefinitiva).toBe('y'.repeat(150))
  })

  it('PIN_INCORRECTO se muestra dentro del modal, sin cerrarlo', async () => {
    currentUser = makeUser({})
    aprobarMutate.mockImplementation((_vars, options) => options?.onError?.(apiError('PIN_INCORRECTO')))
    renderSection(makeQE({ causaRaizDefinitiva: CAUSA_RAIZ_VALIDA }))

    await abrirPinModal()
    confirmarPin('1111')

    expect(await screen.findByText('detail.investigation.errors.PIN_INCORRECTO')).toBeInTheDocument()
    expect(screen.getByText('detail.investigation.pinModal.title')).toBeInTheDocument()
    expect(screen.getByText('detail.investigation.pinModal.forgotPinLink').closest('a')).toHaveAttribute(
      'href',
      '/perfil#pin-firma',
    )
  })

  it('PIN_NO_CONFIGURADO muestra el enlace a Mi Perfil', async () => {
    currentUser = makeUser({})
    aprobarMutate.mockImplementation((_vars, options) => options?.onError?.(apiError('PIN_NO_CONFIGURADO')))
    renderSection(makeQE({ causaRaizDefinitiva: CAUSA_RAIZ_VALIDA }))

    await abrirPinModal()
    confirmarPin('1111')

    const link = await screen.findByText('detail.investigation.pinModal.configurePinLink')
    expect(link.closest('a')).toHaveAttribute('href', '/perfil#pin-firma')
  })

  it('un PIN mal formado no llama al endpoint', async () => {
    currentUser = makeUser({})
    renderSection(makeQE({ causaRaizDefinitiva: CAUSA_RAIZ_VALIDA }))

    await abrirPinModal()
    confirmarPin('12a4')

    expect(screen.getByText('detail.investigation.pinModal.error')).toBeInTheDocument()
    expect(aprobarMutate).not.toHaveBeenCalled()
  })
})

// ─── qe-asistente-ia ──────────────────────────────────────────────────────────

const SUGERENCIA: SugerenciaCausaRaizIA = {
  causaRaizProbable: 'c'.repeat(150),
  cincoPorques: [1, 2, 3, 4, 5].map((n) => ({ pregunta: `Pregunta IA ${n}`, respuesta: `Respuesta IA ${n}` })),
  accionesSugeridas: [
    { descripcion: 'Actualizar el procedimiento de verificación previa del equipo', tipo: 'CORRECTIVA', rolResponsableSugerido: 'Supervisor de área', plazoDiasHabiles: 10 },
    { descripcion: 'Capacitar a los tres turnos en la verificación previa del equipo', tipo: 'PREVENTIVA', rolResponsableSugerido: 'Jefe de Calidad', plazoDiasHabiles: 15 },
  ],
  modelo: 'claude-sonnet-5-5',
  generadoEn: '2026-10-29T10:00:00Z',
}

function pedirSugerencia(metodo = '5_PORQUES'): AsistirOptions {
  fireEvent.click(screen.getByText('detail.investigation.asistirIA'))
  expect(asistirMutate).toHaveBeenCalledWith({ id: 'qe-2026-010', metodo }, expect.anything())
  return asistirMutate.mock.calls[0][1]!
}

function recibirSugerencia(sugerencia = SUGERENCIA, metodo = '5_PORQUES') {
  const options = pedirSugerencia(metodo)
  act(() => options.onSuccess?.(sugerencia))
}

// qe-asistente-ia-ishikawa: la IA devuelve las categorías en otro orden que el formulario.
const CATEGORIAS = ['METODO', 'MAQUINA', 'MATERIAL', 'MANO_DE_OBRA', 'MEDICION', 'MEDIO_AMBIENTE'] as const
const SUGERENCIA_ISHIKAWA: SugerenciaCausaRaizIA = {
  ...SUGERENCIA,
  cincoPorques: null,
  ishikawa: [...CATEGORIAS].reverse().map((categoria) => ({ categoria, causa: `Causa IA ${categoria}` })),
}

function ultimoToastAction(): () => void {
  const options = vi.mocked(toast).mock.calls.at(-1)![1] as unknown as { action: { onClick: () => void } }
  return options.action.onClick
}

describe('QEInvestigationSection — asistente IA (qe-asistente-ia)', () => {
  it('no muestra el botón si la funcionalidad está desactivada', () => {
    asistenteIAActivo = false
    currentUser = makeUser({})
    renderSection(makeQE({ estado: 'EN_INVESTIGACION' }))

    expect(screen.queryByText('detail.investigation.asistirIA')).not.toBeInTheDocument()
  })

  it('no muestra el botón al SUPERVISOR no asignado', () => {
    currentUser = makeUser({ id: 'user-sup-002', rol: 'SUPERVISOR' })
    renderSection(makeQE({ estado: 'EN_INVESTIGACION', responsableInvestigacionId: 'user-sup-001' }))

    expect(screen.queryByText('detail.investigation.asistirIA')).not.toBeInTheDocument()
  })

  it('muestra "Analizando…" mientras espera', () => {
    asistirPending = true
    currentUser = makeUser({})
    renderSection(makeQE({ estado: 'EN_INVESTIGACION' }))

    expect(screen.getByText('detail.investigation.ia.analizando')).toBeInTheDocument()
  })

  it('muestra el panel con la etiqueta sin tocar el formulario', () => {
    currentUser = makeUser({})
    renderSection(makeQE({ estado: 'EN_INVESTIGACION' }))

    recibirSugerencia()

    expect(screen.getAllByText('detail.investigation.ia.etiqueta').length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/detail.investigation.causaRaizDefinitiva/)).toHaveValue('')
    expect(screen.queryByText('detail.investigation.ia.simulado')).not.toBeInTheDocument()
  })

  it('en modo simulado la etiqueta agrega "(modo simulado — no es una sugerencia real)"', () => {
    asistenteIASimulado = true
    currentUser = makeUser({})
    renderSection(makeQE({ estado: 'EN_INVESTIGACION' }))

    recibirSugerencia()

    expect(screen.getByText('detail.investigation.ia.simulado')).toBeInTheDocument()
  })

  it('"Usar" copia la causa raíz con marca IA, al editar pasa a IA (editado) y se envía origenIA', async () => {
    currentUser = makeUser({})
    renderSection(makeQE({ estado: 'EN_INVESTIGACION' }))
    recibirSugerencia()

    fireEvent.click(screen.getAllByText('detail.investigation.ia.usar')[0])
    const textarea = screen.getByLabelText(/detail.investigation.causaRaizDefinitiva/)
    expect(textarea).toHaveValue(SUGERENCIA.causaRaizProbable)
    expect(screen.getByText('detail.investigation.ia.marca')).toBeInTheDocument()

    fireEvent.change(textarea, { target: { value: `${SUGERENCIA.causaRaizProbable} ajustada` } })
    expect(screen.getByText('detail.investigation.ia.marcaEditada')).toBeInTheDocument()

    fireEvent.click(screen.getByText('detail.investigation.guardar'))
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled())
    expect(updateMutateAsync.mock.calls[0][0].data.origenIA).toEqual({ causaRaiz: 'IA_EDITADO' })
  })

  it('sin sugerencia aplicada no envía origenIA', async () => {
    currentUser = makeUser({})
    renderSection(makeQE({ estado: 'EN_INVESTIGACION' }))

    fireEvent.click(screen.getByText('detail.investigation.guardar'))
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled())
    expect(updateMutateAsync.mock.calls[0][0].data).not.toHaveProperty('origenIA')
  })

  it('"Usar" en los 5 Porqués con datos previos pide confirmación antes de reemplazar', () => {
    currentUser = makeUser({})
    renderSection(makeQE({
      estado: 'EN_INVESTIGACION',
      metodoAnalisis: '5_PORQUES',
      cincoPorques: [1, 2, 3, 4, 5].map((n) => ({ pregunta: `¿Por qué ${n}?`, respuesta: `Previa ${n}` })),
    }))
    recibirSugerencia()

    // Bloques en orden: causa raíz, 5 Porqués.
    fireEvent.click(screen.getAllByText('detail.investigation.ia.usar')[1])

    expect(toast).toHaveBeenCalledWith('detail.investigation.ia.confirmarReemplazo', expect.anything())
    expect(screen.getByLabelText('detail.investigation.porque:1')).toHaveValue('Previa 1')

    const options = vi.mocked(toast).mock.calls.at(-1)![1] as unknown as { action: { onClick: () => void } }
    act(() => options.action.onClick())
    expect(screen.getByLabelText('detail.investigation.porque:1')).toHaveValue('Respuesta IA 1')
    expect(screen.getByText('Pregunta IA 1')).toBeInTheDocument()
  })

  it('"Crear AC" abre el formulario de alta precargado', () => {
    currentUser = makeUser({})
    renderSection(makeQE({ estado: 'EN_INVESTIGACION' }))
    recibirSugerencia()

    fireEvent.click(screen.getAllByText('detail.investigation.ia.crearAC')[0])

    expect(screen.getByText('detail.acSection.agregarModal.title')).toBeInTheDocument()
    expect(screen.getByLabelText(/detail.acSection.fields.descripcion/)).toHaveValue(SUGERENCIA.accionesSugeridas[0].descripcion)
  })

  it('"Crear AC" precarga el tipo sugerido por la IA y lista sus candidatos (ac-tipo-responsables)', () => {
    currentUser = makeUser({})
    renderSection(makeQE({ estado: 'EN_INVESTIGACION' }))
    recibirSugerencia()

    // Segunda acción sugerida: PREVENTIVA → SUP, JCA, JCD y DIR.
    fireEvent.click(screen.getAllByText('detail.investigation.ia.crearAC')[1])

    expect(screen.getByLabelText(/detail.acSection.fields.tipo/)).toHaveValue('PREVENTIVA')
    const responsable = screen.getByLabelText(/detail.acSection.fields.responsable/)
    expect(responsable).not.toBeDisabled()
    const opciones = Array.from((responsable as HTMLSelectElement).options).map((o) => o.value).filter(Boolean)
    expect(opciones).toEqual(['u-sup', 'u-jca', 'u-jcd', 'u-dir'])
  })

  it('un 503 muestra el toast del servidor y deja el formulario intacto', () => {
    currentUser = makeUser({})
    renderSection(makeQE({ estado: 'EN_INVESTIGACION', causaRaizDefinitiva: 'Texto previo' }))

    const options = pedirSugerencia()
    act(() =>
      options.onError?.({
        response: { data: { errorCode: 'IA_NO_DISPONIBLE', message: 'El asistente no está disponible en este momento.' } },
      }),
    )

    expect(toast.error).toHaveBeenCalledWith('El asistente no está disponible en este momento.')
    expect(screen.getByLabelText(/detail.investigation.causaRaizDefinitiva/)).toHaveValue('Texto previo')
    expect(screen.queryByText('detail.investigation.ia.etiqueta')).not.toBeInTheDocument()
  })

  it('IA_LIMITE_DIARIO muestra el mensaje traducido', () => {
    currentUser = makeUser({})
    renderSection(makeQE({ estado: 'EN_INVESTIGACION' }))

    const options = pedirSugerencia()
    act(() => options.onError?.(apiError('IA_LIMITE_DIARIO')))

    expect(toast.error).toHaveBeenCalledWith('errors.IA_LIMITE_DIARIO')
  })
})

describe('QEInvestigationSection — asistente IA con Ishikawa (qe-asistente-ia-ishikawa)', () => {
  it('con Ishikawa elegido envía { metodo: ISHIKAWA }', () => {
    currentUser = makeUser({})
    renderSection(makeQE({ estado: 'EN_INVESTIGACION', metodoAnalisis: 'ISHIKAWA' }))

    pedirSugerencia('ISHIKAWA')
  })

  it('envía el método visible aunque no esté guardado', () => {
    currentUser = makeUser({})
    renderSection(makeQE({ estado: 'EN_INVESTIGACION', metodoAnalisis: '5_PORQUES' }))
    fireEvent.click(screen.getByLabelText('detail.investigation.toolIshikawa'))
    act(() => ultimoToastAction()())

    pedirSugerencia('ISHIKAWA')
  })

  it('muestra el bloque Ishikawa y no el de 5 Porqués', () => {
    currentUser = makeUser({})
    renderSection(makeQE({ estado: 'EN_INVESTIGACION', metodoAnalisis: 'ISHIKAWA' }))
    recibirSugerencia(SUGERENCIA_ISHIKAWA, 'ISHIKAWA')

    expect(screen.getByText('detail.investigation.ia.bloqueIshikawa')).toBeInTheDocument()
    expect(screen.getByText('Causa IA MEDICION')).toBeInTheDocument()
    expect(screen.queryByText('detail.investigation.tool5Porques', { selector: 'p' })).not.toBeInTheDocument()
  })

  it('"Usar" completa las 6 categorías por categoría y deja el método en Ishikawa', () => {
    currentUser = makeUser({})
    renderSection(makeQE({ estado: 'EN_INVESTIGACION', metodoAnalisis: 'ISHIKAWA' }))
    recibirSugerencia(SUGERENCIA_ISHIKAWA, 'ISHIKAWA')

    // Bloques en orden: causa raíz, Ishikawa.
    fireEvent.click(screen.getAllByText('detail.investigation.ia.usar')[1])

    expect(toast).not.toHaveBeenCalled()
    for (const categoria of CATEGORIAS) {
      expect(screen.getByLabelText(`detail.investigation.ishikawaCategoria.${categoria}`)).toHaveValue(`Causa IA ${categoria}`)
    }
    expect(screen.getByLabelText('detail.investigation.toolIshikawa')).toBeChecked()
    expect(screen.getByText('detail.investigation.ia.marca')).toBeInTheDocument()
  })

  it('con causas previas pide confirmación antes de reemplazar', () => {
    currentUser = makeUser({})
    renderSection(makeQE({
      estado: 'EN_INVESTIGACION',
      metodoAnalisis: 'ISHIKAWA',
      ishikawa: CATEGORIAS.map((categoria) => ({ categoria, causa: `Previa ${categoria}` })),
    }))
    recibirSugerencia(SUGERENCIA_ISHIKAWA, 'ISHIKAWA')

    fireEvent.click(screen.getAllByText('detail.investigation.ia.usar')[1])

    expect(toast).toHaveBeenCalledWith('detail.investigation.ia.confirmarReemplazoIshikawa', expect.anything())
    expect(screen.getByLabelText('detail.investigation.ishikawaCategoria.METODO')).toHaveValue('Previa METODO')
    act(() => ultimoToastAction()())
    expect(screen.getByLabelText('detail.investigation.ishikawaCategoria.METODO')).toHaveValue('Causa IA METODO')
  })

  it('al editar una causa la marca pasa a IA (editado) y se envía origenIA.ishikawa = IA_EDITADO', async () => {
    currentUser = makeUser({})
    renderSection(makeQE({ estado: 'EN_INVESTIGACION', metodoAnalisis: 'ISHIKAWA' }))
    recibirSugerencia(SUGERENCIA_ISHIKAWA, 'ISHIKAWA')
    fireEvent.click(screen.getAllByText('detail.investigation.ia.usar')[1])

    fireEvent.change(screen.getByLabelText('detail.investigation.ishikawaCategoria.MAQUINA'), {
      target: { value: 'Causa ajustada' },
    })
    expect(screen.getByText('detail.investigation.ia.marcaEditada')).toBeInTheDocument()

    fireEvent.click(screen.getByText('detail.investigation.guardar'))
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled())
    const { data } = updateMutateAsync.mock.calls[0][0]
    expect(data.metodoAnalisis).toBe('ISHIKAWA')
    expect(data).not.toHaveProperty('cincoPorques')
    expect(data.origenIA).toEqual({ ishikawa: 'IA_EDITADO' })
  })

  it('si el método cambió mientras esperaba, pide confirmar el cambio de método', () => {
    currentUser = makeUser({})
    renderSection(makeQE({ estado: 'EN_INVESTIGACION', metodoAnalisis: 'ISHIKAWA' }))
    // Llega una sugerencia de 5 Porqués (pedida antes de cambiar a Ishikawa).
    const options = pedirSugerencia('ISHIKAWA')
    act(() => options.onSuccess?.(SUGERENCIA))

    fireEvent.click(screen.getAllByText('detail.investigation.ia.usar')[1])

    expect(toast).toHaveBeenCalledWith(
      'detail.investigation.ia.confirmarCambioMetodo:detail.investigation.tool5Porques',
      expect.anything(),
    )
    expect(screen.getByLabelText('detail.investigation.toolIshikawa')).toBeChecked()
    act(() => ultimoToastAction()())
    expect(screen.getByLabelText('detail.investigation.tool5Porques')).toBeChecked()
    expect(screen.getByLabelText('detail.investigation.porque:1')).toHaveValue('Respuesta IA 1')
  })

  it('con 5 Porqués elegido "Usar" no cambia de método ni pide confirmación (regresión)', async () => {
    currentUser = makeUser({})
    renderSection(makeQE({ estado: 'EN_INVESTIGACION', metodoAnalisis: '5_PORQUES' }))
    recibirSugerencia()

    expect(screen.queryByText('detail.investigation.ia.bloqueIshikawa')).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByText('detail.investigation.ia.usar')[1])

    expect(toast).not.toHaveBeenCalled()
    expect(screen.getByLabelText('detail.investigation.porque:1')).toHaveValue('Respuesta IA 1')
    fireEvent.click(screen.getByText('detail.investigation.guardar'))
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled())
    expect(updateMutateAsync.mock.calls[0][0].data.origenIA).toEqual({ cincoPorques: 'IA' })
  })
})
