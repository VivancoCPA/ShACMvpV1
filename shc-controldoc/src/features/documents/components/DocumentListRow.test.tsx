import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DocumentListRow } from './DocumentListRow'
import type { Documento } from '../../../types/documents.types'
import type { UserRole } from '../../../types/auth.types'

// revision-periodica-permiso-por-rol (D1/D5): el icono ↻ ("Iniciar revisión") se autoriza por
// rol GLOBAL (canManagePeriodicReview), no por la aproximación de docRole de
// userRoleToDocRole/perms.canStartReview — regression guard explícito, aunque hoy coincida con
// el comportamiento previo (ver comentario en DocumentListRow.tsx).

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../../areas/hooks/useAreas', () => ({
  useArea: () => ({ data: undefined }),
}))

function makeDocumento(overrides: Partial<Documento>): Documento {
  return {
    id: 'doc-001',
    codigo: 'PRC-CD-001',
    titulo: 'Procedimiento de prueba',
    tipo: 'PRC',
    version: 'v1.0',
    estado: 'PUBLICADO',
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

function renderRow(documento: Documento, userRole: UserRole) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <table>
          <tbody>
            <DocumentListRow documento={documento} userRole={userRole} index={0} onClick={() => {}} />
          </tbody>
        </table>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
})

describe('DocumentListRow — icono "Iniciar revisión" por rol global', () => {
  it('JEFE_CALIDAD_SYST que es el aprobador asignado de este PUBLICADO sí ve el icono ↻', () => {
    const documento = makeDocumento({ aprobadorId: 'user-jca-001' })

    renderRow(documento, 'JEFE_CALIDAD_SYST')

    expect(screen.getByLabelText('list.actions.iniciarRevision')).toBeInTheDocument()
  })

  it('JEFE_CONTROL_DOCUMENTARIO que es el autor de este PUBLICADO sí ve el icono ↻', () => {
    const documento = makeDocumento({ autorId: 'user-jcd-001' })

    renderRow(documento, 'JEFE_CONTROL_DOCUMENTARIO')

    expect(screen.getByLabelText('list.actions.iniciarRevision')).toBeInTheDocument()
  })

  it('SUPERVISOR no ve el icono ↻ en PUBLICADO', () => {
    const documento = makeDocumento({})

    renderRow(documento, 'SUPERVISOR')

    expect(screen.queryByLabelText('list.actions.iniciarRevision')).not.toBeInTheDocument()
  })

  it('JEFE_CALIDAD_SYST no ve el icono ↻ fuera de PUBLICADO', () => {
    const documento = makeDocumento({ estado: 'EN_REVISION_PERIODICA' })

    renderRow(documento, 'JEFE_CALIDAD_SYST')

    expect(screen.queryByLabelText('list.actions.iniciarRevision')).not.toBeInTheDocument()
  })
})
