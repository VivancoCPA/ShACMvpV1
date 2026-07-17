import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
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
    area: 'Calidad',
    confidencialidad: 'INTERNO',
    autorId: 'user-autor-001',
    archivoOriginalUrl: null,
    archivoOriginalNombre: null,
    archivoOriginalBloqueado: false,
    archivoDistribucionUrl: null,
    qeVinculados: [],
    historialVersiones: [],
    auditTrail: [],
    creadoEn: '2026-01-01T08:00:00.000Z',
    actualizadoEn: '2026-01-01T08:00:00.000Z',
    ...overrides,
  }
}

function renderPanel(documento: Documento) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DocumentActionPanel documento={documento} />
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
