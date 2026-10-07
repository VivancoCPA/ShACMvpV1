import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QEInvestigationSection } from './QEInvestigationSection'
import type { QualityEvent } from '../types/qualityEvent.types'
import type { User } from '../../../types/auth.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join('|')}` : key,
    i18n: { language: 'es-PE' },
  }),
}))

let currentUser: User | null = null
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: User | null }) => unknown) => selector({ user: currentUser }),
}))

vi.mock('../hooks/useUpdateQualityEvent', () => ({
  useUpdateQualityEvent: () => ({ mutate: vi.fn(), isPending: false }),
}))

let getNameMock = (_id?: string | null) => 'Luis Paredes'
vi.mock('../../users/hooks/useUserNames', () => ({
  useUserNames: () => ({ getName: (id?: string | null) => getNameMock(id), isLoading: false }),
}))

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

beforeEach(() => {
  currentUser = null
  getNameMock = () => 'Luis Paredes'
})

describe('QEInvestigationSection — sello de aprobación de causa raíz (nombres-usuarios-reales)', () => {
  it('muestra el nombre resuelto por useUserNames, no el id crudo', () => {
    const qe = makeQE({
      causaRaizDefinitiva: 'Falta de mantenimiento preventivo',
      causaRaizAprobadaPorId: 'user-jefecalidad-001',
      causaRaizFirmadaEn: '2026-06-05T10:00:00Z',
    })

    render(<QEInvestigationSection qe={qe} />)

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

    render(<QEInvestigationSection qe={qe} />)

    expect(screen.getByText('common:userNames.noDisponible', { exact: false })).toBeInTheDocument()
  })
})
