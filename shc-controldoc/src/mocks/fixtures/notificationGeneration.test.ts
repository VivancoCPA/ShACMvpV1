import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  isResolvableAccount,
  createCambioEstadoNotification,
  createAsignacionNotification,
  buildVencimientoKey,
  generateVencimientoNotifications,
} from './notificationGeneration'
import { getQeStore, resetStore as resetQeStore } from '../handlers/quality-events.handlers'
import { getIncidentsStore, resetStore as resetIncidentsStore } from '../handlers/incidents.handlers'
import { resetStore as resetNotificationsStore } from './notifications.fixtures'
import type { QualityEvent } from '../../features/quality-events/types/qualityEvent.types'
import type { Incidente } from '../../features/incidents/types/incident.types'

vi.mock('../../features/dashboard/utils/semaforoPendientes', () => ({
  calcularEstadoSemaforoDesdeFecha: () => ({ estado: 'AMARILLO', diasHabilesRestantes: 3 }),
}))

function baseIncidente(overrides: Partial<Incidente>): Incidente {
  const now = '2026-01-01T00:00:00Z'
  return {
    id: 'inc-notif-001',
    numero: 'INC-NOTIF-001',
    tipo: 'ACCIDENTE',
    estado: 'ABIERTO',
    severidad: 'ALTA',
    descripcion: 'Incidente de prueba con descripción suficientemente larga',
    areaId: 'area-001',
    turno: 'DIA',
    fechaEvento: now,
    fechaReporte: now,
    reportadoPorId: 'user-operario-001',
    huboLesionados: false,
    auditTrail: [],
    creadoEn: now,
    actualizadoEn: now,
    ...overrides,
  }
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

afterEach(() => {
  resetQeStore()
  resetIncidentsStore()
  resetNotificationsStore()
})

describe('isResolvableAccount', () => {
  it('returns true for a real authFixtures id', () => {
    expect(isResolvableAccount('user-operario-001')).toBe(true)
  })

  it('returns false for a legacy domain-only id, even though seedLegacyNames has a display name for it', () => {
    expect(isResolvableAccount('user-003')).toBe(false)
  })
})

describe('createCambioEstadoNotification', () => {
  const base = {
    entidadTipo: 'QE' as const,
    entidadId: 'qe-x',
    entidadCodigo: 'QE-2026-999',
    estadoNuevo: 'EN_INVESTIGACION',
    link: '/quality-events/qe-x',
  }

  it('notifies the reporter when someone else changes state', () => {
    const created = createCambioEstadoNotification({
      ...base,
      reportadoPorId: 'user-operario-001',
      responsablesACActivas: [],
      actorId: 'user-supervisor-001',
    })
    expect(created.some((n) => n.usuarioId === 'user-operario-001' && n.tipo === 'CAMBIO_ESTADO')).toBe(true)
  })

  it('never notifies the acting user even when they are the reporter', () => {
    const created = createCambioEstadoNotification({
      ...base,
      reportadoPorId: 'user-supervisor-001',
      responsablesACActivas: ['user-operario-001'],
      actorId: 'user-supervisor-001',
    })
    expect(created.some((n) => n.usuarioId === 'user-supervisor-001')).toBe(false)
    expect(created.some((n) => n.usuarioId === 'user-operario-001')).toBe(true)
  })

  it('silently skips an unresolvable recipient without throwing', () => {
    expect(() =>
      createCambioEstadoNotification({
        ...base,
        reportadoPorId: 'user-003',
        responsablesACActivas: [],
        actorId: 'user-supervisor-001',
      }),
    ).not.toThrow()

    const created = createCambioEstadoNotification({
      ...base,
      reportadoPorId: 'user-003',
      responsablesACActivas: [],
      actorId: 'user-supervisor-001',
    })
    expect(created).toHaveLength(0)
  })

  it('deduplicates a recipient listed as both reporter and an AC responsable', () => {
    const created = createCambioEstadoNotification({
      ...base,
      reportadoPorId: 'user-operario-001',
      responsablesACActivas: ['user-operario-001'],
      actorId: 'user-supervisor-001',
    })
    expect(created).toHaveLength(1)
  })
})

describe('createAsignacionNotification', () => {
  const base = {
    entidadTipo: 'DOCUMENTO' as const,
    entidadId: 'doc-x',
    entidadCodigo: 'PRC-CD-999',
    link: '/documents/doc-x',
    mensaje: 'Asignación de prueba',
  }

  it('notifies a new responsable distinct from the actor', () => {
    const created = createAsignacionNotification({
      ...base,
      asignadoId: 'user-operario-001',
      actorId: 'user-supervisor-001',
    })
    expect(created?.usuarioId).toBe('user-operario-001')
    expect(created?.tipo).toBe('ASIGNACION')
  })

  it('returns null and creates nothing on self-assignment', () => {
    const created = createAsignacionNotification({
      ...base,
      asignadoId: 'user-supervisor-001',
      actorId: 'user-supervisor-001',
    })
    expect(created).toBeNull()
  })

  it('returns null for an unresolvable asignadoId', () => {
    const created = createAsignacionNotification({
      ...base,
      asignadoId: 'user-003',
      actorId: 'user-supervisor-001',
    })
    expect(created).toBeNull()
  })
})

describe('buildVencimientoKey', () => {
  it('is stable for identical inputs', () => {
    expect(buildVencimientoKey('AC', 'ac-001')).toBe(buildVencimientoKey('AC', 'ac-001'))
  })

  it('differs by entidadTipo for the same id', () => {
    expect(buildVencimientoKey('AC', 'x-001')).not.toBe(buildVencimientoKey('DOCUMENTO', 'x-001'))
    expect(buildVencimientoKey('AC', 'x-001')).not.toBe(buildVencimientoKey('INCIDENTE', 'x-001'))
  })
})

describe('generateVencimientoNotifications', () => {
  it('creates exactly one notification for an AC newly in AMARILLO and does not duplicate on a second run', () => {
    const seed = getQeStore()[0]
    const qeFixture: QualityEvent = {
      ...seed,
      id: 'qe-notif-test-1',
      numero: 'QE-NOTIF-TEST-1',
      accionesCorrectivas: [
        {
          id: 'ac-notif-test-1',
          qeId: 'qe-notif-test-1',
          descripcion: 'AC de prueba',
          responsableId: 'user-operario-001',
          responsableNombre: 'Luis Quispe',
          plazoFecha: '2026-08-01',
          estado: 'EN_EJECUCION',
          creadoEn: '2026-01-01T00:00:00Z',
          actualizadoEn: '2026-01-01T00:00:00Z',
          solicitudesAjustePlazo: [],
        },
      ],
    }
    getQeStore().push(qeFixture)

    const firstRun = generateVencimientoNotifications()
    expect(firstRun.filter((n) => n.entidadId === 'ac-notif-test-1')).toHaveLength(1)

    const secondRun = generateVencimientoNotifications()
    expect(secondRun.filter((n) => n.entidadId === 'ac-notif-test-1')).toHaveLength(0)
  })
})

describe('generateVencimientoNotifications — RN-INC-006 (incidente sin QE vinculado)', () => {
  it('notifies JEFE_CALIDAD_SYST and the area SUPERVISOR when an incident passes its plazo without a qeId', () => {
    getIncidentsStore().push(
      baseIncidente({
        id: 'inc-notif-rojo',
        numero: 'INC-NOTIF-ROJO',
        tipo: 'ACCIDENTE',
        areaId: 'area-001',
        fechaEvento: hoursAgo(25),
      }),
    )

    const created = generateVencimientoNotifications().filter((n) => n.entidadId === 'inc-notif-rojo')

    expect(created.some((n) => n.usuarioId === 'user-jefecalidad-001' && n.tipo === 'VENCIMIENTO')).toBe(true)
    // user-supervisor-002's areaIds includes 'area-001'
    expect(created.some((n) => n.usuarioId === 'user-supervisor-002')).toBe(true)
    // user-supervisor-001's areaIds do not include 'area-001'
    expect(created.some((n) => n.usuarioId === 'user-supervisor-001')).toBe(false)
  })

  it('does not duplicate the notification on a second run', () => {
    getIncidentsStore().push(
      baseIncidente({ id: 'inc-notif-dup', numero: 'INC-NOTIF-DUP', tipo: 'ACCIDENTE', fechaEvento: hoursAgo(25) }),
    )

    const firstRun = generateVencimientoNotifications().filter((n) => n.entidadId === 'inc-notif-dup')
    expect(firstRun.length).toBeGreaterThan(0)

    const secondRun = generateVencimientoNotifications().filter((n) => n.entidadId === 'inc-notif-dup')
    expect(secondRun).toHaveLength(0)
  })

  it('creates nothing once the incident has a qeId, even if it is overdue', () => {
    getIncidentsStore().push(
      baseIncidente({
        id: 'inc-notif-linked',
        numero: 'INC-NOTIF-LINKED',
        tipo: 'ACCIDENTE',
        fechaEvento: hoursAgo(25),
        qeId: 'qe-2026-005',
      }),
    )

    const created = generateVencimientoNotifications().filter((n) => n.entidadId === 'inc-notif-linked')
    expect(created).toHaveLength(0)
  })

  it('creates nothing while still within the plazo (AMARILLO preview handled only by the badge)', () => {
    getIncidentsStore().push(
      baseIncidente({ id: 'inc-notif-amarillo', numero: 'INC-NOTIF-AMARILLO', tipo: 'ACCIDENTE', fechaEvento: hoursAgo(20) }),
    )

    const created = generateVencimientoNotifications().filter((n) => n.entidadId === 'inc-notif-amarillo')
    expect(created).toHaveLength(0)
  })

  it('creates nothing for a CERRADO incident, no matter how overdue', () => {
    getIncidentsStore().push(
      baseIncidente({
        id: 'inc-notif-cerrado',
        numero: 'INC-NOTIF-CERRADO',
        tipo: 'ACCIDENTE',
        estado: 'CERRADO',
        fechaEvento: hoursAgo(999),
      }),
    )

    const created = generateVencimientoNotifications().filter((n) => n.entidadId === 'inc-notif-cerrado')
    expect(created).toHaveLength(0)
  })
})
