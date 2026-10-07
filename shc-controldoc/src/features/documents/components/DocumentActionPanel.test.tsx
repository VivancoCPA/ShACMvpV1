import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '../../../stores/authStore'
import { DocumentActionPanel } from './DocumentActionPanel'
import type { Documento } from '../../../types/documents.types'

// Regression test: DocumentActionPanel used to gate "Aprobar revisión"/"Rechazar"
// (EN_REVISION) and "Firmar"/"Rechazar" (EN_APROBACION) on a generic role check
// (JEFE_CALIDAD_SYST / JEFE_CONTROL_DOCUMENTARIO) OR'd with the specific
// revisorId/aprobadorId assignment. That let any Jefe Calidad act on a document
// they were not assigned to review/approve — the same bug class already fixed
// for the /documents/:id/edit guard (autorId-based instead of role-based).
// permissions.ts already scopes these correctly (see permissions.test.ts); this
// panel now must agree with it: only the assigned revisorId/aprobadorId acts.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE' },
  }),
}))

function makeDocumento(overrides: Partial<Documento>): Documento {
  return {
    id: 'doc-001',
    codigo: 'PRC-CD-001',
    titulo: 'Procedimiento de prueba',
    tipo: 'PRC',
    version: 'v1.0',
    estado: 'EN_REVISION',
    areaId: 'Calidad',
    empresaId: 'empresa-001',
    confidencialidad: 'INTERNO',
    autorId: 'user-autor-001',
    archivoOriginalUrl: null,
    archivoOriginalNombre: null,
    archivoOriginalBloqueado: false,
    archivoDistribucionUrl: null,
    qeVinculados: [],
    ncVinculados: [],
    auditTrail: [],
    creadoEn: '2026-01-01T08:00:00.000Z',
    actualizadoEn: '2026-01-01T08:00:00.000Z',
    ...overrides,
  }
}

function renderPanel(documento: Documento, getName: (id?: string | null) => string = (id) => id ?? '') {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DocumentActionPanel documento={documento} getName={getName} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
})

describe('DocumentActionPanel — EN_REVISION approve/reject scoped to revisorId', () => {
  it('JEFE_CALIDAD_SYST que NO es el revisor asignado no ve Aprobar/Rechazar', () => {
    const documento = makeDocumento({ estado: 'EN_REVISION', revisorId: 'user-revisor-001' })
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'user-jefecalidad-999', rol: 'JEFE_CALIDAD_SYST' } as never,
    })

    renderPanel(documento)

    expect(screen.queryByText('detail.actions.approveReview')).not.toBeInTheDocument()
    expect(screen.queryByText('detail.actions.reject')).not.toBeInTheDocument()
  })

  it('JEFE_CONTROL_DOCUMENTARIO que NO es el revisor asignado no ve Aprobar/Rechazar', () => {
    const documento = makeDocumento({ estado: 'EN_REVISION', revisorId: 'user-revisor-001' })
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'user-jefedocs-999', rol: 'JEFE_CONTROL_DOCUMENTARIO' } as never,
    })

    renderPanel(documento)

    expect(screen.queryByText('detail.actions.approveReview')).not.toBeInTheDocument()
    expect(screen.queryByText('detail.actions.reject')).not.toBeInTheDocument()
  })

  it('el revisor asignado (revisorId) sí ve Aprobar/Rechazar', () => {
    const documento = makeDocumento({ estado: 'EN_REVISION', revisorId: 'user-revisor-001' })
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'user-revisor-001', rol: 'JEFE_CALIDAD_SYST' } as never,
    })

    renderPanel(documento)

    expect(screen.getByText('detail.actions.approveReview')).toBeInTheDocument()
    expect(screen.getByText('detail.actions.reject')).toBeInTheDocument()
  })
})

describe('DocumentActionPanel — EN_APROBACION firmar/rechazar scoped to aprobadorId', () => {
  it('JEFE_CALIDAD_SYST que NO es el aprobador asignado no ve Firmar/Rechazar', () => {
    const documento = makeDocumento({ estado: 'EN_APROBACION', aprobadorId: 'user-aprobador-001' })
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'user-jefecalidad-999', rol: 'JEFE_CALIDAD_SYST' } as never,
    })

    renderPanel(documento)

    expect(screen.queryByText('detail.actions.sign')).not.toBeInTheDocument()
    expect(screen.queryByText('detail.actions.reject')).not.toBeInTheDocument()
  })

  it('el aprobador asignado (aprobadorId) sí ve Firmar/Rechazar', () => {
    const documento = makeDocumento({ estado: 'EN_APROBACION', aprobadorId: 'user-aprobador-001' })
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'user-aprobador-001', rol: 'JEFE_CALIDAD_SYST' } as never,
    })

    renderPanel(documento)

    expect(screen.getByText('detail.actions.sign')).toBeInTheDocument()
    expect(screen.getByText('detail.actions.reject')).toBeInTheDocument()
  })
})

describe('DocumentActionPanel — preview de PDF muestra el nombre del aprobador (nombres-usuarios-reales)', () => {
  function makePublicadoDocumento(aprobadorId: string) {
    return makeDocumento({
      estado: 'PUBLICADO',
      archivoUrl: 'https://example.com/doc.pdf',
      aprobadorId,
    })
  }

  it('muestra el nombre resuelto por getName en "Aprobado por"', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'user-otro', rol: 'ALTA_DIRECCION' } as never,
    })
    renderPanel(makePublicadoDocumento('user-aprobador-001'), (id) =>
      id === 'user-aprobador-001' ? 'Luis Paredes' : (id ?? ''),
    )

    fireEvent.click(screen.getByText('actions.exportarPdfControlado'))

    expect(screen.getByText('Luis Paredes')).toBeInTheDocument()
  })

  it('muestra el texto genérico cuando getName no resuelve al aprobador', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'user-otro', rol: 'ALTA_DIRECCION' } as never,
    })
    renderPanel(makePublicadoDocumento('user-desconocido'), () => 'common:userNames.noDisponible')

    fireEvent.click(screen.getByText('actions.exportarPdfControlado'))

    expect(screen.getByText('common:userNames.noDisponible')).toBeInTheDocument()
    expect(screen.queryByText('user-desconocido')).not.toBeInTheDocument()
  })
})

// nueva-version-autor-permisos: mismo bug class que arriba, pero en BORRADOR — "Enviar a
// revisión"/"Eliminar" se gatean por el flag global isJefeCalidad antes de este fix, sin
// considerar si ese mismo usuario es el revisor/aprobador asignado de ESTE documento (en cuyo
// caso el backend resuelve docRole REVISOR/APROBADOR, de solo lectura en BORRADOR, y responde 403).
describe('DocumentActionPanel — BORRADOR enviar a revisión/eliminar según precedencia de docRole', () => {
  function makeBorrador(overrides: Partial<Documento> = {}) {
    return makeDocumento({
      estado: 'BORRADOR',
      revisorId: 'user-revisor-001',
      aprobadorId: 'user-aprobador-001',
      ...overrides,
    })
  }

  it('JEFE_CALIDAD_SYST que es el revisor asignado de este BORRADOR no ve Enviar a revisión ni Eliminar', () => {
    const documento = makeBorrador({ revisorId: 'user-jca-001' })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-jca-001', rol: 'JEFE_CALIDAD_SYST' } as never })

    renderPanel(documento)

    expect(screen.queryByText('detail.actions.sendToReview')).not.toBeInTheDocument()
    expect(screen.queryByText('detail.actions.delete')).not.toBeInTheDocument()
  })

  it('JEFE_CONTROL_DOCUMENTARIO que es el aprobador asignado de este BORRADOR no ve Enviar a revisión ni Eliminar', () => {
    const documento = makeBorrador({ aprobadorId: 'user-jcd-001' })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-jcd-001', rol: 'JEFE_CONTROL_DOCUMENTARIO' } as never })

    renderPanel(documento)

    expect(screen.queryByText('detail.actions.sendToReview')).not.toBeInTheDocument()
    expect(screen.queryByText('detail.actions.delete')).not.toBeInTheDocument()
  })

  it('JEFE_CALIDAD_SYST que NO es revisor/aprobador de este documento sí ve Enviar a revisión y Eliminar', () => {
    const documento = makeBorrador()
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-jca-ajeno', rol: 'JEFE_CALIDAD_SYST' } as never })

    renderPanel(documento)

    expect(screen.getByText('detail.actions.sendToReview')).toBeInTheDocument()
    expect(screen.getByText('detail.actions.delete')).toBeInTheDocument()
  })

  it('el AUTOR sí ve Enviar a revisión y Eliminar cuando hay revisor y aprobador asignados', () => {
    const documento = makeBorrador({ autorId: 'user-autor-001' })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-autor-001', rol: 'OPERARIO' } as never })

    renderPanel(documento)

    expect(screen.getByText('detail.actions.sendToReview')).toBeInTheDocument()
    expect(screen.getByText('detail.actions.delete')).toBeInTheDocument()
  })
})

describe('DocumentActionPanel — aviso cuando falta revisor o aprobador en BORRADOR', () => {
  it('el AUTOR ve "Enviar a revisión" deshabilitado si falta revisorId', () => {
    const documento = makeDocumento({
      estado: 'BORRADOR',
      autorId: 'user-autor-001',
      aprobadorId: 'user-aprobador-001',
      revisorId: undefined,
    })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-autor-001', rol: 'OPERARIO' } as never })

    renderPanel(documento)

    const boton = screen.getByText('detail.actions.sendToReview').closest('button')
    expect(boton).toBeDisabled()
  })

  it('el AUTOR ve "Enviar a revisión" deshabilitado si falta aprobadorId', () => {
    const documento = makeDocumento({
      estado: 'BORRADOR',
      autorId: 'user-autor-001',
      revisorId: 'user-revisor-001',
      aprobadorId: undefined,
    })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-autor-001', rol: 'OPERARIO' } as never })

    renderPanel(documento)

    const boton = screen.getByText('detail.actions.sendToReview').closest('button')
    expect(boton).toBeDisabled()
  })

  it('el AUTOR ve "Enviar a revisión" habilitado cuando hay revisor y aprobador asignados', () => {
    const documento = makeDocumento({
      estado: 'BORRADOR',
      autorId: 'user-autor-001',
      revisorId: 'user-revisor-001',
      aprobadorId: 'user-aprobador-001',
    })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-autor-001', rol: 'OPERARIO' } as never })

    renderPanel(documento)

    const boton = screen.getByText('detail.actions.sendToReview').closest('button')
    expect(boton).not.toBeDisabled()
  })
})

// revision-periodica-permiso-por-rol (D1): "Iniciar revisión periódica" se autoriza por rol
// GLOBAL (canManagePeriodicReview), no por docRole/perms.canStartReview — a diferencia de
// "Enviar a revisión"/"Aprobar"/"Firmar" (arriba), un JEFE_CALIDAD_SYST/JEFE_CONTROL_DOCUMENTARIO
// ve este botón aunque sea autor/revisor/aprobador asignado del documento PUBLICADO.
describe('DocumentActionPanel — PUBLICADO: Iniciar revisión periódica por rol global', () => {
  it('JEFE_CALIDAD_SYST que es el aprobador asignado de este PUBLICADO sí ve "Iniciar revisión periódica"', () => {
    const documento = makeDocumento({
      estado: 'PUBLICADO',
      autorId: 'user-autor-001',
      aprobadorId: 'user-jca-001',
    })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-jca-001', rol: 'JEFE_CALIDAD_SYST' } as never })

    renderPanel(documento)

    expect(screen.getByText('detail.actions.startPeriodicReview')).toBeInTheDocument()
  })

  it('JEFE_CONTROL_DOCUMENTARIO que es el autor de este PUBLICADO sí ve "Iniciar revisión periódica"', () => {
    const documento = makeDocumento({ estado: 'PUBLICADO', autorId: 'user-jcd-001' })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-jcd-001', rol: 'JEFE_CONTROL_DOCUMENTARIO' } as never })

    renderPanel(documento)

    expect(screen.getByText('detail.actions.startPeriodicReview')).toBeInTheDocument()
  })

  it('SUPERVISOR no ve "Iniciar revisión periódica" en PUBLICADO', () => {
    const documento = makeDocumento({ estado: 'PUBLICADO', autorId: 'user-autor-001' })
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-sup-001', rol: 'SUPERVISOR' } as never })

    renderPanel(documento)

    expect(screen.queryByText('detail.actions.startPeriodicReview')).not.toBeInTheDocument()
  })
})
