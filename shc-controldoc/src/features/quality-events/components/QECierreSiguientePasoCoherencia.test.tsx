import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '../../../stores/authStore'
import { getUsersStore } from '../../../mocks/fixtures/auth.fixtures'
import { getRolEfectivo } from '../../../mocks/fixtures/empresas.fixtures'
import { buildSiguientePaso } from '../../../mocks/handlers/shared/qeSiguientePaso'
import { QECierreSection } from './QECierreSection'
import { QESiguientePasoBanner } from './QESiguientePasoBanner'
import type { QEAuditTrailEntry, QualityEvent } from '../types/qualityEvent.types'
import type { UserRole } from '../../../types/auth.types'

// qe-reapertura-reinicia-cierre D3: el indicador "Siguiente paso" y los botones de QECierreSection
// deben usar la misma condición — "Te toca a ti" ⇔ el usuario ve la acción del paso. Origen del
// change: QE-2026-006 decía "Te toca a ti" al supervisor sin mostrarle el botón de firma.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${Object.values(opts).join(' | ')}` : key,
    i18n: { language: 'es-PE' },
  }),
}))

vi.mock('../api/quality-events.api', () => ({
  firmarCierre: vi.fn(),
  cerrarQE: vi.fn(),
  rechazarCierre: vi.fn(),
}))

vi.mock('../../areas/hooks/useAreas', () => ({
  useArea: () => ({ data: { id: 'area-001', nombre: 'Almacén Norte', activo: true, creadoEn: '' } }),
}))

const EMPRESA = 'empresa-001'
const SUPERVISOR = { id: 'user-sup-coherencia', nombreCompleto: 'Luis Peralta' }

const jca = getUsersStore().find((u) => u.activo && getRolEfectivo(u.id, EMPRESA) === 'JEFE_CALIDAD_SYST')!

const entrada = (accion: string, campoModificado?: string, timestamp = '2026-11-10T10:00:00.000Z'): QEAuditTrailEntry => ({
  id: `aud-${accion}-${timestamp}`,
  entidadTipo: 'QualityEvent',
  entidadId: 'qe-coh',
  accion,
  campoModificado,
  realizadoPorId: jca.id,
  realizadoPorNombre: 'JCA',
  timestamp,
  generadoPorIA: false,
})

function makeQE(overrides: Partial<QualityEvent>): QualityEvent {
  return {
    id: 'qe-coh',
    numero: 'QE-2026-006',
    origen: 'O1_INCIDENTE_CAMPO',
    tipo: 'CALIDAD',
    severidad: 'MEDIA',
    estado: 'PENDIENTE_CIERRE',
    ciclo: 2,
    descripcion: 'Evento',
    areaId: 'area-001',
    empresaId: EMPRESA,
    turno: 'DIA',
    fechaHoraEvento: '2026-08-01T08:00:00.000Z',
    fechaHoraReporte: '2026-08-01T08:00:00.000Z',
    reportadoPorId: 'user-reportante',
    documentosVinculados: [],
    requiereEvaluacionRiesgos: false,
    solicitudesAC: 0,
    accionesCorrectivas: [],
    supervisoresArea: [{ ...SUPERVISOR, avatarUrl: null }],
    auditTrail: [entrada('REABIERTO', 'motivo', '2026-10-20T09:00:00.000Z')],
    creadoEn: '2026-08-01T08:00:00.000Z',
    actualizadoEn: '2026-11-10T10:00:00.000Z',
    ...overrides,
  }
}

const ESCENARIOS: { nombre: string; qe: QualityEvent; accion: string }[] = [
  { nombre: 'sin resultado', qe: makeQE({}), accion: 'form' },
  { nombre: 'con resultado sin firmas', qe: makeQE({ resultadoCierre: 'r'.repeat(120) }), accion: 'detail.cierre.firstSignature.button' },
  {
    nombre: 'con la firma del JCA',
    qe: makeQE({
      resultadoCierre: 'r'.repeat(120),
      cerradoPorId: jca.id,
      cerradoPorNombre: 'JCA',
      auditTrail: [entrada('REABIERTO', 'motivo', '2026-10-20T09:00:00.000Z'), entrada('FIRMA_CIERRE_JEFE_CALIDAD', 'cerradoPorId')],
    }),
    accion: 'detail.cierre.secondSignature.button',
  },
]

const USUARIOS: { id: string; rol: UserRole }[] = [
  { id: jca.id, rol: 'JEFE_CALIDAD_SYST' },
  { id: SUPERVISOR.id, rol: 'SUPERVISOR' },
]

function renderDetalle(qe: QualityEvent) {
  const conPaso = { ...qe, siguientePaso: buildSiguientePaso(qe) }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <QESiguientePasoBanner qe={conPaso} />
        <QECierreSection qe={conPaso} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const veAccion = (accion: string) =>
  accion === 'form'
    ? screen.queryByLabelText('detail.cierre.form.resultadoCierre') !== null
    : screen.queryByRole('button', { name: accion }) !== null

describe('Coherencia "Siguiente paso" ↔ botones de QECierreSection', () => {
  afterEach(() => {
    cleanup()
    useAuthStore.setState({ user: null })
  })

  for (const escenario of ESCENARIOS) {
    for (const usuario of USUARIOS) {
      it(`${escenario.nombre} — ${usuario.rol}`, () => {
        useAuthStore.setState({
          user: {
            id: usuario.id,
            nombre: 'Usuario',
            apellido: 'Actual',
            email: 'u@shac.pe',
            rol: usuario.rol,
            createdAt: '2026-01-01T00:00:00.000Z',
            activo: true,
            tienePinFirma: true,
          },
        })
        renderDetalle(escenario.qe)

        const teToca = screen.queryByText('detail.siguientePaso.teToca') !== null
        expect(veAccion(escenario.accion)).toBe(teToca)
      })
    }
  }

  it('el JCA tiene su turno en al menos un escenario y el supervisor también', () => {
    const turnos = ESCENARIOS.map((e) => buildSiguientePaso(e.qe).responsables.map((r) => r.id))
    expect(turnos.some((ids) => ids.includes(jca.id))).toBe(true)
    expect(turnos.some((ids) => ids.includes(SUPERVISOR.id))).toBe(true)
  })

  it('con las dos firmas presentes el paso es CIERRE_INCONSISTENTE, nunca FIRMA_SUPERVISOR', () => {
    const qe = makeQE({ resultadoCierre: 'r'.repeat(120), cerradoPorId: jca.id, cierreFirmaSupervisorId: SUPERVISOR.id })
    expect(buildSiguientePaso(qe).paso).toBe('CIERRE_INCONSISTENTE')
  })
})
